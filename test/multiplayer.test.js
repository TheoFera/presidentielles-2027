import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createMultiplayerHandler, sanitizeCommands } from '../scripts/multiplayer-server.mjs';
import { campaignConfig } from '../scripts/validate-campaign.mjs';
import { GameSimulation } from '../src/simulation/game-simulation.js';
import { CampaignStyleSystem, CAMPAIGN_STYLES } from '../src/simulation/campaign-styles.js';
import { lanAddresses, connectionInfo } from '../scripts/lan-addresses.mjs';
import { PeerSession, encodeInvitation, decodeInvitation } from '../src/network/peer-session.js';
import { stateDelta, applyStateDelta, presentationState, encodePresentationState, encodeStateDelta } from '../src/network/state-stream.js';
import { outgoingCommands } from '../src/network/shared-commands.js';
import { LocalHumanController } from '../src/simulation/controllers.js';
import { startArena, finishArena, finishSprint } from '../src/simulation/match-lifecycle.js';
import { qrFrames, QrCollector } from '../src/network/qr-transfer.js';

test('Les vues partagent uniquement une géométrie immuable et restent isolées de la simulation', () => {
  const sim = new GameSimulation(campaignConfig(), 2027);
  const first = sim.getState({ presentation: true });
  const second = sim.getState({ presentation: true });
  assert.deepEqual(first, { ...sim.getState(), campaign_snapshot: null });
  assert.equal(first.world, second.world);
  assert.notEqual(first.world, sim.state.world);
  assert.throws(() => { first.world.subzones[0].start = -1; }, TypeError);
  first.candidates[0].money = -1;
  assert.notEqual(first.candidates[0].money, second.candidates[0].money);
  assert.notEqual(first.candidates[0].money, sim.state.candidates[0].money);
  const saved = sim.exportSnapshot();
  sim.importSnapshot(saved);
  const restored = sim.getState({ presentation: true });
  assert.notEqual(restored.world, first.world);
  assert.deepEqual(restored.world, first.world);
  // Full saves retain the existing independent, editable snapshot contract.
  const full = sim.getState();
  full.world.subzones[0].start = -1;
  assert.notEqual(sim.state.world.subzones[0].start, -1);
});

test('Les QR animés se reconstruisent dans le désordre, sans mélanger deux invitations', async () => {
  const offer = encodeInvitation({ type: 'offer', id: 'test-qr', description: { type: 'offer', sdp: Array.from({ length: 900 }, (_, i) => `candidate:${i}`).join('\n') } });
  const frames = await qrFrames(offer);
  assert.ok(frames.length > 1);
  const collector = new QrCollector();
  const other = await qrFrames(encodeInvitation({ type: 'answer', id: 'other', description: { type: 'answer', sdp: 'v=0' } }));
  await collector.add(frames.at(-1)); await collector.add(frames.at(-1));
  await collector.add(other[0]);
  let result;
  for (const frame of frames.slice(0, -1).reverse()) result = await collector.add(frame);
  assert.equal(result.value, offer);
  await assert.rejects(() => collector.add('https://example.com'));
  await assert.rejects(() => collector.add('P27Q:1:t:1:0:126:a'));
  await assert.rejects(() => collector.add('P27Q:1:t:1:0:1:corrompu'));
});

test('Le scan sait aussi relire des QR non compressés', async () => {
  const compressor = globalThis.CompressionStream;
  try {
    globalThis.CompressionStream = undefined;
    const value = 'P27:' + 'a'.repeat(700), frames = await qrFrames(value), collector = new QrCollector();
    let result; for (const frame of frames) result = await collector.add(frame);
    assert.equal(result.value, value);
  } finally { globalThis.CompressionStream = compressor; }
});

test('L’invitation directe conserve la description et refuse une réponse utilisée comme invitation', () => {
  const data = { type: 'offer', id: 'joueur-2', fingerprint: 'abc', description: { type: 'offer', sdp: 'v=0\r\na=candidate:1 local\r\n' } };
  const encoded = encodeInvitation(data);
  assert.deepEqual(decodeInvitation(encoded, 'offer'), { version: 3, ...data });
  assert.throws(() => decodeInvitation(encoded, 'answer'));
  assert.throws(() => decodeInvitation('un code invalide', 'offer'));
  assert.throws(() => decodeInvitation(encodeInvitation({ ...data, version: 1 }), 'offer'));
});

test('Le flux différentiel restitue la campagne, le duel et le résultat sans transmettre la sauvegarde interne', () => {
  const sim = new GameSimulation(campaignConfig(), 2027);
  let baseline, received;
  const transfer = () => {
    const delta = stateDelta(sim.state, baseline);
    baseline = delta.next;
    received = applyStateDelta(received, JSON.parse(JSON.stringify(delta.packet)));
    assert.deepEqual(received, presentationState(sim.state));
    return JSON.stringify(delta.packet).length;
  };
  transfer(); startArena(sim); transfer();
  const saved = JSON.stringify(sim.state.campaign_snapshot);
  assert.equal(sim.getState({ presentation: true }).campaign_snapshot, null);
  assert.equal(JSON.stringify(sim.state.campaign_snapshot), saved);
  sim.step([]);
  assert.ok(transfer() < JSON.stringify(sim.state).length / 5, 'Le duel ne retransmet pas le monde figé');
  finishArena(sim, 'philippe'); transfer();
  sim.state.npcs.slice(0,60).forEach(n => { n.role = 'SYMPATHISANT'; n.faction_id = 'melenchon'; });
  sim.state.npcs.slice(60,90).forEach(n => { n.role = 'SYMPATHISANT'; n.faction_id = 'le_pen'; });
  finishSprint(sim); transfer();
  assert.equal(received.phase, 'RESULTS');
});

test('Un canal saturé attend, reprend ses fragments et conserve la base après une image ignorée', t => {
  const errors = [], snapshots = [];
  const host = new PeerSession({ ended: error => errors.push(error) }, 'test');
  const guest = new PeerSession({ ended: error => errors.push(error), snapshot: state => snapshots.push(state) }, 'test');
  guest.room = { phase: 'playing' };
  let saturated = true, maxBuffered = 0;
  const incoming = { readyState: 'open', bufferedAmount: 0 };
  const receiver = { connection: { close() {} } }; guest.bindChannel(receiver, incoming);
  const channel = { readyState: 'open', bufferedAmount: 0, send(text) {
    if (saturated) { const error = new Error('full'); error.name = 'OperationError'; throw error; }
    this.bufferedAmount += Buffer.byteLength(text); maxBuffered = Math.max(maxBuffered, this.bufferedAmount);
    incoming.onmessage({ data: text });
  } };
  const peer = { connection: { close() {} } }; host.bindChannel(peer, channel); host.peers.set('guest', peer);
  t.after(() => { host.close(); guest.close(); });
  const first = { tick: 1, text: 'é'.repeat(300000), campaign_snapshot: { huge: 'ignored' } };
  assert.equal(host.send(peer, 'snapshot', first), true);
  assert.equal(host.send(peer, 'snapshot', { ...first, tick: 2 }), false);
  assert.equal(host.send(peer, 'ping', {}), true);
  saturated = false;
  while (peer.outbox.length) { channel.bufferedAmount = 0; channel.onbufferedamountlow(); }
  assert.equal(snapshots.length, 1);
  assert.equal(snapshots[0].tick, 1);
  channel.bufferedAmount = 0;
  host.send(peer, 'snapshot', { ...first, tick: 3 });
  while (peer.outbox.length) { channel.bufferedAmount = 0; channel.onbufferedamountlow(); }
  assert.equal(snapshots[1].tick, 3);
  assert.equal(snapshots[1].text, first.text);
  assert.ok(maxBuffered < 65000);
  assert.deepEqual(errors, []);
});

test('L’encodage mutualisé produit exactement le format réseau existant, y compris les suppressions', () => {
  let baseline;
  const state = { tick: 0, nested: { value: 1 }, text: 'Élysée « test »\n"\\😀', values: [null, false, 0, -2.5], optional: undefined, campaign_snapshot: { secret: true } };
  for (let step = 0; step < 5; step++) {
    state.tick++;
    state.nested.value++;
    if (step === 1) state['clé"\\'] = { amount: 0.1 + 0.2 };
    if (step === 2) delete state.text;
    if (step === 3) { state.values = []; state.optional = null; }
    const reference = stateDelta(state, baseline);
    const encoded = encodePresentationState(state);
    assert.equal(encodeStateDelta(encoded, baseline), JSON.stringify(reference.packet));
    assert.deepEqual(encoded, reference.next);
    baseline = encoded;
  }
});

test('Deux invités partagent un encodage ; un invité en retard retrouve exactement le dernier état', t => {
  const errors = [], deliveries = [[], []], guests = [];
  const host = new PeerSession({ ended: error => errors.push(error) }, 'test');
  host.isHost = true;
  const peers = deliveries.map((snapshots, index) => {
    const guest = new PeerSession({ ended: error => errors.push(error), snapshot: state => snapshots.push(state) }, 'test');
    guests.push(guest); guest.room = { phase: 'playing' };
    const incoming = { readyState: 'open', bufferedAmount: 0 };
    guest.bindChannel({ connection: { close() {} } }, incoming);
    const peer = { connection: { close() {} } };
    host.bindChannel(peer, { readyState: 'open', bufferedAmount: 0, send: data => incoming.onmessage({ data }) });
    peer.connected = true; host.peers.set(`guest-${index}`, peer);
    return peer;
  });
  t.after(() => { host.close(); guests.forEach(guest => guest.close()); });
  let encodings = 0;
  const state = { tick: 1, value: { toJSON() { encodings++; return { count: state.tick, label: 'Même état' }; } } };
  host.broadcast('snapshot', state);
  assert.equal(encodings, 1);
  assert.equal(peers[0].baseline, peers[1].baseline);
  peers[1].channel.bufferedAmount = 40000;
  const slowBaseline = peers[1].baseline;
  state.tick = 2; state.newField = 'Nouveau';
  host.broadcast('snapshot', state);
  assert.equal(encodings, 2);
  assert.equal(peers[1].baseline, slowBaseline);
  assert.equal(deliveries[1].length, 1);
  peers[1].channel.bufferedAmount = 0;
  state.tick = 3; delete state.newField;
  host.broadcast('snapshot', state);
  assert.equal(encodings, 3);
  assert.deepEqual(deliveries[0].at(-1), deliveries[1].at(-1));
  assert.deepEqual(deliveries[0][0], { tick: 1, value: { count: 1, label: 'Même état' }, campaign_snapshot: null });
  assert.equal(deliveries[0].at(-1).tick, 3);
  assert.equal(peers[0].baseline, peers[1].baseline);
  for (const peer of peers) peer.channel.bufferedAmount = 40000;
  state.tick = 4; host.broadcast('snapshot', state);
  assert.equal(encodings, 3, 'Aucun encodage si tous les invités sont saturés');
  assert.deepEqual(errors, []);
});

test('Les commandes allégées conservent toutes les actions, leur ordre et l’identité imposée par l’hôte', () => {
  const human = new LocalHumanController();
  human.setAxis(1); human.pressAttack(); human.releaseAttack(); human.jump(); human.dash(-1);
  const commands = human.commands({}, 'candidate:philippe');
  commands.push({ type: 'HoldCampaignStyle', candidateId: 'candidate:philippe', active: false });
  const before = JSON.stringify(commands);
  const compact = outgoingCommands(commands);
  const relevant = sanitizeCommands(commands, 'le_pen').filter(c => !['SetCampaignActive', 'InteractionPresence'].includes(c.type));
  assert.deepEqual(sanitizeCommands(compact, 'le_pen'), relevant);
  assert.equal(JSON.stringify(commands), before, 'Le contrôleur reste inchangé');
  assert.ok(compact.every(c => !Object.hasOwn(c, 'candidateId')));
  assert.ok(JSON.stringify(compact).length < before.length / 2);
  assert.deepEqual(outgoingCommands([]), []);
});

test('L’adresse Wi-Fi proposée exclut les boucles locales et respecte le port et l’interface utilisée', () => {
  const interfaces = { loopback: [{ family: 'IPv4', address: '127.0.0.1', internal: true }], wifi: [{ family: 'IPv4', address: '192.168.1.25', internal: false }], ethernet: [{ family: 'IPv4', address: '10.0.0.2', internal: false }], ipv6: [{ family: 'IPv6', address: '::1', internal: true }] };
  assert.deepEqual(lanAddresses(2028, '0.0.0.0', interfaces), ['http://192.168.1.25:2028', 'http://10.0.0.2:2028']);
  assert.deepEqual(lanAddresses(2028, '127.0.0.1', interfaces), []);
  assert.equal(connectionInfo({ socket: { localAddress: '::ffff:10.0.0.2' } }, 2028, '0.0.0.0', interfaces).join_urls[0], 'http://10.0.0.2:2028');
});

test('Les commandes réseau sont limitées au candidat attribué et excluent le débogage', () => {
  assert.deepEqual(sanitizeCommands([{ type: 'Move', candidateId: 'candidate:philippe', axis: 1, money: 999 }], 'le_pen'), [{ type: 'Move', candidateId: 'candidate:le_pen', axis: 1 }]);
  assert.throws(() => sanitizeCommands([{ type: 'DebugGrantMoney' }], 'le_pen'));
  assert.throws(() => sanitizeCommands(Array(21).fill({ type: 'Attack' }), 'le_pen'));
});

test('Salons : candidats uniques, autorisations, préparation de tous les joueurs et fermeture', async t => {
  const handler = createMultiplayerHandler();
  const server = http.createServer(handler);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => { handler.close(); server.closeAllConnections(); server.close(); });
  const base = `http://127.0.0.1:${server.address().port}/api/multiplayer/`;
  async function request(action, data = {}) {
    const response = await fetch(base + action, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
    return { status: response.status, ...await response.json() };
  }
  const host = await request('create', { faction: 'melenchon' });
  assert.equal(host.status, 200);
  const auth = { code: host.code, token: host.token };
  assert.equal((await request('start', auth)).status, 400);
  assert.equal(host.room.players[0].faction, null);
  assert.equal((await request('choose', { ...auth, faction: 'melenchon' })).status, 400);
  const guest = await request('join', { code: host.code, faction: 'le_pen' });
  const guestAuth = { code: guest.code, token: guest.token };
  assert.equal(guest.room.players[1].faction, null);
  assert.equal((await request('start', auth)).status, 400);
  assert.equal((await request('choose', { ...auth, faction: 'melenchon' })).status, 400);
  const third = await request('join', { code: host.code });
  const thirdAuth = { code: third.code, token: third.token };
  assert.ok(third.room.players.every(player => player.faction === null));
  assert.equal((await request('choose', { ...auth, faction: 'melenchon' })).status, 200);
  assert.equal((await request('choose', { ...guestAuth, faction: 'melenchon' })).status, 400);
  assert.equal((await request('choose', { ...guestAuth, faction: 'le_pen' })).status, 200);
  assert.equal((await request('start', auth)).status, 400);
  assert.equal((await request('choose', { ...thirdAuth, faction: 'philippe' })).status, 200);
  assert.equal(guest.room.players.length, 2);
  assert.ok(!JSON.stringify(guest.room).includes(host.token));
  assert.equal((await request('start', guestAuth)).status, 400);
  assert.equal((await request('pause', { ...auth, token: 'intrus' })).status, 400);
  assert.equal((await request('start', auth)).status, 200);
  assert.equal((await request('choose', { ...guestAuth, faction: 'philippe' })).status, 400);
  assert.equal((await request('join', { code: host.code, faction: 'philippe' })).status, 400);
  assert.equal((await request('ready', auth)).status, 200);
  assert.equal((await request('commands', { ...guestAuth, commands: [] })).status, 400);
  assert.equal((await request('ready', guestAuth)).status, 200);
  assert.equal((await request('commands', { ...guestAuth, commands: [] })).status, 400);
  assert.equal((await request('ready', thirdAuth)).status, 200);
  assert.equal((await request('commands', { ...guestAuth, commands: [{ type: 'Move', axis: 1 }] })).status, 200);
  assert.equal((await request('snapshot', { ...guestAuth, state: { tick: 1, candidates: [] } })).status, 400);
  assert.equal((await request('pause', { ...guestAuth, paused: true })).status, 200);
  await request('leave', guestAuth);
  assert.equal((await request('heartbeat', auth)).status, 400);
});

test('Le serveur local transmet les mêmes états aux deux invités et restitue les commandes allégées', { timeout: 10000 }, async t => {
  const handler = createMultiplayerHandler(), server = http.createServer(handler), streams = [];
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => { streams.forEach(controller => controller.abort()); handler.close(); server.closeAllConnections(); server.close(); });
  const base = `http://127.0.0.1:${server.address().port}/api/multiplayer/`;
  async function request(action, data = {}) {
    const response = await fetch(base + action, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
    const result = await response.json(); assert.equal(response.status, 200, JSON.stringify(result)); return result;
  }
  async function listen(auth) {
    const controller = new AbortController(); streams.push(controller);
    const response = await fetch(base + 'events?' + new URLSearchParams(auth), { signal: controller.signal });
    assert.equal(response.status, 200);
    const reader = response.body.getReader(), decoder = new TextDecoder(); let buffer = '';
    return async type => {
      while (true) {
        let end;
        while ((end = buffer.indexOf('\n\n')) >= 0) {
          const message = buffer.slice(0, end); buffer = buffer.slice(end + 2);
          if (message.startsWith(`event: ${type}\n`)) return JSON.parse(message.slice(message.indexOf('data: ') + 6));
        }
        const next = await reader.read(); assert.equal(next.done, false);
        buffer += decoder.decode(next.value, { stream: true });
      }
    };
  }
  const host = await request('create'), guest = await request('join', { code: host.code }), third = await request('join', { code: host.code });
  const auth = [host, guest, third].map(player => ({ code: host.code, token: player.token }));
  const receive = await Promise.all(auth.map(listen));
  for (const [i, faction] of ['melenchon', 'le_pen', 'philippe'].entries()) await request('choose', { ...auth[i], faction });
  await request('start', auth[0]);
  for (const player of auth) await request('ready', player);
  for (const tick of [1, 2]) {
    const state = { tick, candidates: [{ id: 'candidate:melenchon', x: tick * .1 }], message: 'État « partagé »\n😀' };
    await request('snapshot', { ...auth[0], state });
    for (const read of receive.slice(1)) assert.deepEqual(await read('snapshot'), state);
  }
  const commands = outgoingCommands([{ type: 'Move', candidateId: 'candidate:philippe', axis: 1 }, { type: 'PressAttack' }, { type: 'ReleaseAttack' }]);
  await request('commands', { ...auth[1], commands });
  assert.deepEqual(await receive[0]('commands'), { playerId: guest.id, commands: sanitizeCommands(commands, 'le_pen') });
});

test('Chaque humain choisit son style au QG ; un choix en cours n’est jamais écrasé', () => {
  const sim = new GameSimulation(campaignConfig(), 42);
  const [first, second, third] = sim.state.candidates;
  sim.state.human_candidate_ids = [first.id, second.id];
  CampaignStyleSystem.headquartersEstablished(sim, first);
  CampaignStyleSystem.headquartersEstablished(sim, second);
  assert.equal(sim.state.campaign_style_selection.candidate_id, first.id);
  assert.equal(second.current_campaign_style, null);
  CampaignStyleSystem.select(sim, first, CAMPAIGN_STYLES[first.faction_id][0].id);
  CampaignStyleSystem.headquartersEstablished(sim, second);
  assert.equal(sim.state.campaign_style_selection.candidate_id, second.id);
  const tick = sim.state.tick; sim.step(); assert.equal(sim.state.tick, tick);
  CampaignStyleSystem.select(sim, second, CAMPAIGN_STYLES[second.faction_id][0].id);
  assert.equal(sim.state.campaign_style_selection, null);
  CampaignStyleSystem.headquartersEstablished(sim, third);
  assert.ok(third.current_campaign_style);
});
