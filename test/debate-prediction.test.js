import test from 'node:test';
import assert from 'node:assert/strict';
import { campaignConfig } from '../scripts/validate-campaign.mjs';
import { validateConfig } from '../src/config.js';
import { DebateMatch } from '../src/simulation/debate-mode.js';
import { DebatePrediction, RemoteInputQueue } from '../src/network/debate-prediction.js';
import { encodePresentationState } from '../src/network/state-stream.js';

const config = validateConfig(campaignConfig());
const setup = { format: '1v1', map: 'remue_menage', seed: 5, fighters: [{ faction: 'melenchon', style: 'melenchon_universaliste' }, { faction: 'le_pen', style: 'le_pen_souverainiste' }] };

/** Hôte et invité reliés par `latency` ticks de réseau dans chaque sens ; l'hôte ne bouge pas. */
function play({ latency, ticks, guestInput }) {
  const host = new DebateMatch(config, setup), guest = new DebateMatch(config, { ...setup, seed: 77 });
  const [hostId, guestId] = host.state.candidates.map(c => c.id);
  while (host.state.phase !== 'FIGHT') host.step([]);
  const prediction = new DebatePrediction(guest, guestId), queue = new RemoteInputQueue();
  const toHost = [], toGuest = [], hostX = new Map(), report = { errors: [], responses: [] };
  let lastAxis = 0;
  for (let t = 0; t < ticks; t++) {
    // Invité : un pas numéroté, joué tout de suite et envoyé.
    const commands = guestInput(t), axis = commands.find(c => c.type === 'Move')?.axis;
    const before = prediction.active ? prediction.state.candidates.find(c => c.id === guestId).x : null;
    const seq = prediction.step(commands);
    toHost.push({ at: t + latency, seq, commands });
    if (prediction.active && axis !== undefined && axis !== lastAxis && axis !== 0) {
      // Réactivité : dès le pas où la touche change, son personnage part dans le bon sens.
      report.responses.push(Math.sign(prediction.state.candidates.find(c => c.id === guestId).x - before) === axis);
    }
    if (axis !== undefined) lastAxis = axis;
    // Hôte : un pas de l'invité par tick, puis un état avec le dernier pas appliqué.
    while (toHost.length && toHost[0].at <= t) { const m = toHost.shift(); queue.push(m.seq, m.commands.map(c => ({ ...c, candidateId: guestId }))); }
    host.step([{ type: 'Move', candidateId: hostId, axis: 0 }, ...queue.next()]);
    hostX.set(host.state.tick, host.state.candidates.find(c => c.id === guestId).x);
    toGuest.push({ at: t + latency, state: JSON.parse(JSON.stringify(encodePresentationState({ ...host.state, input_acks: { [guestId]: queue.ack } }))) });
    while (toGuest.length && toGuest[0].at <= t) prediction.authoritative(toGuest.shift().state);
    // Fidélité : la position prédite comparée à celle que l'hôte aura au même tick.
    if (prediction.active) report.errors.push({ tick: prediction.state.tick, x: prediction.state.candidates.find(c => c.id === guestId).x });
  }
  report.errors = report.errors.filter(e => hostX.has(e.tick)).map(e => Math.abs(e.x - hostX.get(e.tick)));
  return { report, queue, prediction };
}

test('Prédiction du débat : le geste de l’invité s’affiche au pas même, fidèle à l’hôte', () => {
  // L'invité va et vient toutes les 20 ticks (2/3 s), avec 100 ms de réseau dans chaque sens.
  const { report, queue, prediction } = play({ latency: 3, ticks: 300, guestInput: t => [{ type: 'Move', axis: Math.floor(t / 20) % 2 ? -1 : 1 }] });
  assert.ok(prediction.active);
  assert.ok(report.responses.length >= 10 && report.responses.every(Boolean), 'réaction immédiate à chaque changement de direction');
  const worst = Math.max(...report.errors), mean = report.errors.reduce((a, b) => a + b, 0) / report.errors.length;
  assert.ok(mean < 0.02, `écart moyen ${mean}`);
  assert.ok(worst < 0.2, `pire écart ${worst}`);
  // L'hôte a appliqué chaque pas : il n'en reste que ceux encore en route.
  assert.ok(prediction.history.length <= 2 * 3 + 2, `${prediction.history.length} pas en attente`);
  assert.equal(queue.frames.length, 0);
});

test('Prédiction du débat : sauts et coups prédits restent proches de l’hôte', () => {
  const input = t => [{ type: 'Move', axis: t % 50 < 25 ? 1 : 0 }, ...(t % 37 === 0 ? [{ type: 'Jump' }] : []), ...(t % 23 === 0 ? [{ type: 'Attack', direction: 1 }] : [])];
  const { report } = play({ latency: 4, ticks: 300, guestInput: input });
  const mean = report.errors.reduce((a, b) => a + b, 0) / report.errors.length;
  assert.ok(mean < 0.05, `écart moyen ${mean}`);
});

test('File de l’hôte : un pas par tick, dans l’ordre, fusion si le retard s’accumule', () => {
  const queue = new RemoteInputQueue({ maxQueued: 3 });
  queue.push(1, [{ type: 'Move', axis: 1 }]); queue.push(2, [{ type: 'Move', axis: -1 }, { type: 'Jump' }]);
  queue.push(2, [{ type: 'Move', axis: 1 }]); // Doublon ignoré.
  assert.deepEqual(queue.next(), [{ type: 'Move', axis: 1 }]); assert.equal(queue.ack, 1);
  assert.deepEqual(queue.next(), [{ type: 'Move', axis: -1 }, { type: 'Jump' }]); assert.equal(queue.ack, 2);
  assert.deepEqual(queue.next(), [], 'rien de neuf : la direction en cours continue');
  queue.push(1, [{ type: 'Jump' }]); // Pas déjà appliqué : ignoré.
  for (let seq = 3; seq <= 7; seq++) queue.push(seq, [{ type: 'Move', axis: seq % 2 ? 1 : -1 }, ...(seq === 4 ? [{ type: 'Attack', direction: 1 }] : [])]);
  // Cinq pas en attente : appliqués d'un coup, une seule direction (la dernière), aucun coup perdu.
  assert.deepEqual(queue.next(), [{ type: 'Attack', direction: 1 }, { type: 'Move', axis: 1 }]);
  assert.equal(queue.ack, 7);
});

test('File de l’hôte : un retard installé se résorbe en douceur', () => {
  const queue = new RemoteInputQueue();
  // Un à-coup réseau livre 5 pas d'un coup, puis les pas arrivent de nouveau un par tick.
  let seq = 0;
  for (let i = 0; i < 5; i++) queue.push(++seq, [{ type: 'Move', axis: 1 }]);
  const lengths = [];
  for (let tick = 0; tick < 150; tick++) { queue.push(++seq, [{ type: 'Move', axis: 1 }]); queue.next(); lengths.push(queue.frames.length); }
  assert.equal(lengths[10], 5, 'pas de fusion au premier à-coup');
  assert.ok(lengths.at(-1) <= 1, `file finale ${lengths.at(-1)}`);
  // Jamais plus d'un pas fusionné à la fois : la file ne raccourcit que d'un pas par tick.
  assert.ok(lengths.every((n, i) => !i || lengths[i - 1] - n <= 1));
});

test('Prédiction du débat : hors combat, l’affichage suit l’hôte', () => {
  const match = new DebateMatch(config, setup), prediction = new DebatePrediction(match, match.state.candidates[1].id);
  prediction.step([{ type: 'Move', axis: 1 }]);
  prediction.authoritative({ ...match.getState(), input_acks: { [match.state.candidates[1].id]: 1 } });
  assert.equal(match.state.phase, 'COUNTDOWN');
  assert.equal(prediction.active, false);
});
