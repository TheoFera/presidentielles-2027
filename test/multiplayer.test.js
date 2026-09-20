import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createMultiplayerHandler, sanitizeCommands } from '../scripts/multiplayer-server.mjs';
import { campaignConfig } from '../scripts/validate-campaign.mjs';
import { GameSimulation } from '../src/simulation/game-simulation.js';
import { CampaignStyleSystem, CAMPAIGN_STYLES } from '../src/simulation/campaign-styles.js';
import { lanAddresses, connectionInfo } from '../scripts/lan-addresses.mjs';
import { encodeInvitation, decodeInvitation } from '../src/network/peer-session.js';

test('L’invitation directe conserve la description et refuse une réponse utilisée comme invitation', () => {
  const data = { type: 'offer', id: 'joueur-2', fingerprint: 'abc', description: { type: 'offer', sdp: 'v=0\r\na=candidate:1 local\r\n' } };
  const encoded = encodeInvitation(data);
  assert.deepEqual(decodeInvitation(encoded, 'offer'), { version: 1, ...data });
  assert.throws(() => decodeInvitation(encoded, 'answer'));
  assert.throws(() => decodeInvitation('un code invalide', 'offer'));
  assert.throws(() => decodeInvitation(encodeInvitation({ ...data, version: 2 }), 'offer'));
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
  assert.equal((await request('join', { code: host.code, faction: 'melenchon' })).status, 400);
  const guest = await request('join', { code: host.code, faction: 'le_pen' });
  const guestAuth = { code: guest.code, token: guest.token };
  assert.equal(guest.room.players.length, 2);
  assert.ok(!JSON.stringify(guest.room).includes(host.token));
  assert.equal((await request('start', guestAuth)).status, 400);
  assert.equal((await request('pause', { ...auth, token: 'intrus' })).status, 400);
  assert.equal((await request('start', auth)).status, 200);
  assert.equal((await request('join', { code: host.code, faction: 'philippe' })).status, 400);
  assert.equal((await request('ready', auth)).status, 200);
  assert.equal((await request('commands', { ...guestAuth, commands: [] })).status, 400);
  assert.equal((await request('ready', guestAuth)).status, 200);
  assert.equal((await request('commands', { ...guestAuth, commands: [{ type: 'Move', axis: 1 }] })).status, 200);
  assert.equal((await request('snapshot', { ...guestAuth, state: { tick: 1, candidates: [] } })).status, 400);
  assert.equal((await request('pause', { ...guestAuth, paused: true })).status, 200);
  await request('leave', guestAuth);
  assert.equal((await request('heartbeat', auth)).status, 400);
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
