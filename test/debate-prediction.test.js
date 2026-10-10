import test from 'node:test';
import assert from 'node:assert/strict';
import { campaignConfig } from '../scripts/validate-campaign.mjs';
import { validateConfig } from '../src/config.js';
import { DebateMatch } from '../src/simulation/debate-mode.js';
import { DebatePrediction, DebateHost } from '../src/network/debate-prediction.js';
import { InputSender, InputTimeline } from '../src/network/input-timeline.js';
import { encodePresentationState } from '../src/network/state-stream.js';
import { outgoingCommands } from '../src/network/shared-commands.js';

const config = validateConfig(campaignConfig());
const fighter = (faction, style, player) => ({ faction, style, player });
const duel = { format: '1v1', map: 'remue_menage', seed: 5, fighters: [fighter('melenchon', 'melenchon_universaliste', true), fighter('le_pen', 'le_pen_souverainiste', true)] };
const trio = { format: '1v1v1', map: 'remue_menage', seed: 9, fighters: [fighter('philippe', 'philippe_gestionnaire', true), fighter('le_pen', 'le_pen_zemmouriste', true), fighter('melenchon', 'melenchon_populiste', false)] };

/**
 * Hôte et invité reliés par un réseau simulé : `latency` ticks par trajet, plus jusqu'à `jitter`
 * ticks au hasard (canal ordonné : un message retardé retient les suivants).
 */
function play({ setup = duel, latency, jitter = 0, ticks, guestInput, hostInput = () => [{ type: 'Move', axis: 0 }] }) {
  let time = 0, seed = 3;
  const random = () => (seed = seed * 48271 % 2147483647) / 2147483647;
  const match = new DebateMatch(config, setup), guestMatch = new DebateMatch(config, { ...setup, seed: 77 });
  const [hostId, guestId] = match.state.candidates.map(c => c.id);
  while (match.state.phase !== 'FIGHT') match.step([]);
  // Vérité finale de l'hôte, tick par tick (réécrite par les retours en arrière).
  const truth = new Map(), step = match.step.bind(match);
  match.step = commands => { step(commands); truth.set(match.state.tick, new Map(match.state.candidates.map(c => [c.id, c.x]))); };
  const host = new DebateHost(match, { localId: hostId, remoteIds: [guestId], now: () => time });
  const prediction = new DebatePrediction(guestMatch, guestId), sender = new InputSender();
  const toHost = [], toGuest = [], predicted = [];
  let upAt = 0, downAt = 0, messages = 0, rollbacks = 0;
  const rollback = host.rollback.bind(host); host.rollback = from => { rollbacks++; rollback(from); };
  for (let t = 0; t < ticks; t++) {
    time = t * 1000 / 30;
    const commands = guestInput(t), seq = prediction.step(commands);
    const outgoing = outgoingCommands(commands.map(c => ({ ...c, candidateId: guestId })));
    if (sender.shouldSend(seq, outgoing)) { messages++; toHost.push({ at: upAt = Math.max(upAt, t + latency + Math.floor(random() * (jitter + 1))), seq, commands: outgoing }); }
    while (toHost.length && toHost[0].at <= t) { const m = toHost.shift(); host.receive(guestId, m.seq, m.commands); }
    host.step(hostInput(t));
    const sent = { ...match.getState(), input_acks: host.acks(), ai_seed: match.state.rng_state };
    toGuest.push({ at: downAt = Math.max(downAt, t + latency + Math.floor(random() * (jitter + 1))), state: JSON.parse(JSON.stringify(encodePresentationState(sent))) });
    while (toGuest.length && toGuest[0].at <= t) prediction.authoritative(toGuest.shift().state);
    if (prediction.active) predicted.push({ tick: prediction.state.tick, positions: new Map(prediction.state.candidates.map(c => [c.id, c.x])) });
  }
  // Écart entre la prédiction de l'invité et la vérité finale de l'hôte, au même tick.
  const error = id => predicted.filter(p => truth.has(p.tick)).map(p => Math.abs(p.positions.get(id) - truth.get(p.tick).get(id)));
  return { host, prediction, messages, rollbacks, error, ids: match.state.candidates.map(c => c.id) };
}
const mean = list => list.reduce((a, b) => a + b, 0) / list.length;
const goAndBack = t => [{ type: 'Move', axis: Math.floor(t / 20) % 3 - 1 }];

test('Débat en réseau : la prédiction de l’invité colle à la vérité de l’hôte', () => {
  // Réseau régulier, Wi-Fi de téléphone, très mauvais réseau (60 à 300 ms irréguliers).
  for (const [latency, jitter, limit] of [[3, 0, 0.001], [1, 3, 0.01], [2, 7, 0.05]]) {
    const run = play({ latency, jitter, ticks: 400, guestInput: goAndBack });
    const own = run.error(run.ids[1]);
    assert.ok(own.length > 300);
    assert.ok(mean(own) < limit, `réseau ${latency}+${jitter} : écart moyen ${mean(own)}`);
  }
});

test('Débat en réseau : l’invité envoie un message seulement quand ça change, plus 5 signes de vie par seconde', () => {
  const run = play({ latency: 3, ticks: 300, guestInput: goAndBack });
  // 300 pas (10 s) : environ 50 signes de vie et 15 changements, au lieu de 300 messages.
  assert.ok(run.messages < 80, `${run.messages} messages`);
});

test('Débat en réseau : un geste retardé par le réseau est rejoué à son instant (retour en arrière)', () => {
  const run = play({ latency: 2, jitter: 4, ticks: 200, guestInput: t => [{ type: 'Move', axis: t % 40 < 20 ? 1 : -1 }, ...(t % 31 === 0 ? [{ type: 'Jump' }] : [])] });
  assert.ok(run.rollbacks >= 5, `${run.rollbacks} retours en arrière`);
  // L'hôte et l'invité restent d'accord sur la position de l'invité, sauts compris.
  assert.ok(mean(run.error(run.ids[1])) < 0.05);
});

test('Débat en réseau : un adversaire joué par l’ordinateur est prédit à l’identique', () => {
  const run = play({ setup: trio, latency: 3, jitter: 2, ticks: 400, guestInput: goAndBack });
  const ai = run.error(run.ids[2]);
  assert.ok(ai.length > 300);
  assert.ok(mean(ai) < 0.02, `écart moyen de l’IA ${mean(ai)}`);
});

test('Ligne du temps de l’hôte : direction supposée entre deux messages, absence après 1 s', () => {
  let now = 0;
  const timeline = new InputTimeline({ now: () => now });
  timeline.receive(10, [{ type: 'Move', axis: 1 }], 100);
  const first = timeline.commandsFor(101);
  assert.deepEqual(first, [{ type: 'Move', axis: 1 }]);
  // Rien de neuf : même direction.
  assert.deepEqual(timeline.commandsFor(102), [{ type: 'Move', axis: 1 }]);
  timeline.receive(12, [{ type: 'Move', axis: 1 }, { type: 'Jump' }], 102);
  const later = [timeline.commandsFor(103), timeline.commandsFor(104)].flat();
  assert.equal(later.filter(c => c.type === 'Jump').length, 1, 'le saut est joué une fois');
  now = 1500;
  assert.equal(timeline.commandsFor(105), null, 'joueur absent');
});

test('Prédiction du débat : hors combat, l’affichage suit l’hôte', () => {
  const match = new DebateMatch(config, duel), prediction = new DebatePrediction(match, match.state.candidates[1].id);
  prediction.step([{ type: 'Move', axis: 1 }]);
  prediction.authoritative({ ...match.getState(), input_acks: { [match.state.candidates[1].id]: 1 } });
  assert.equal(match.state.phase, 'COUNTDOWN');
  assert.equal(prediction.active, false);
});

test('Sons : un coup prédit sonne tout de suite, sans être rejoué quand l’hôte le confirme', async () => {
  const { SoundDirector } = await import('../src/presentation/interface/audio.js');
  const played = [];
  const audio = { play: cue => played.push(cue), duck() {}, music() {}, jingle() {} };
  const sounds = new SoundDirector(audio, 30);
  const state = (events, tick) => ({ mode: 'DEBATE', phase: 'FIGHT', tick, local_candidate_id: 'a', candidates: [{ id: 'a', faction_id: 'melenchon' }, { id: 'b', faction_id: 'le_pen' }], events });
  sounds.update(state([], 1));
  sounds.predicted([{ id: 'event:5', type: 'HitResolved', source_id: 'a', target_id: 'b' }], state([], 2));
  assert.deepEqual(played, ['hit']);
  // L'hôte confirme le même coup : pas de second son. Un autre coup, lui, sonne.
  sounds.update(state([{ id: 'event:5', type: 'HitResolved', source_id: 'a', target_id: 'b' }], 3));
  assert.deepEqual(played, ['hit']);
  sounds.update(state([{ id: 'event:5', type: 'HitResolved', source_id: 'a', target_id: 'b' }, { id: 'event:6', type: 'HitResolved', source_id: 'a', target_id: 'b' }], 4));
  assert.deepEqual(played, ['hit', 'hit']);
});
