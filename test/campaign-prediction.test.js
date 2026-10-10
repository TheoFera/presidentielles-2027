import test from 'node:test';
import assert from 'node:assert/strict';
import { campaignConfig } from '../scripts/validate-campaign.mjs';
import { GameSimulation } from '../src/simulation/game-simulation.js';
import { AIController } from '../src/simulation/controllers.js';
import { CampaignPrediction } from '../src/network/campaign-prediction.js';
import { InputSender, InputTimeline } from '../src/network/input-timeline.js';
import { encodePresentationState } from '../src/network/state-stream.js';
import { ringDelta } from '../src/simulation/world.js';

/** Campagne entre un hôte et un invité : `latency` ticks par trajet, plus jusqu'à `jitter` au hasard. */
function play({ latency, jitter = 0, ticks }) {
  let time = 0, seed = 5;
  const random = () => (seed = seed * 48271 % 2147483647) / 2147483647;
  const config = campaignConfig(), sim = new GameSimulation(config, 2027), ai = new AIController(config);
  const guestId = sim.state.candidates[1].id;
  sim.state.human_candidate_ids = [sim.state.local_candidate_id, guestId];
  const timeline = new InputTimeline({ now: () => time }), sender = new InputSender(), prediction = new CampaignPrediction(config, guestId);
  const toHost = [], toGuest = [], predicted = new Map(), truth = new Map();
  let upAt = 0, downAt = 0, frame = 0, messages = 0;
  for (let t = 0; t < ticks; t++) {
    time = t * 1000 / 30;
    // Invité : va et vient, un pas numéroté par tick, envoyé seulement s'il change.
    const commands = [{ type: 'Move', axis: Math.floor(t / 25) % 3 - 1 }], seq = prediction.step(commands);
    if (prediction.active) predicted.set(seq, prediction.x);
    if (sender.shouldSend(seq, commands)) { messages++; toHost.push({ at: upAt = Math.max(upAt, t + latency + Math.floor(random() * (jitter + 1))), seq, commands }); }
    while (toHost.length && toHost[0].at <= t) { const m = toHost.shift(); timeline.receive(m.seq, m.commands, frame); }
    // Hôte : l'ordinateur pour les autres, la ligne du temps pour l'invité.
    frame++;
    const remote = (timeline.commandsFor(frame) || [{ type: 'Move', axis: 0 }]).map(c => ({ ...c, candidateId: guestId }));
    sim.step(sim.state.candidates.flatMap(c => c.id === guestId ? remote : ai.commands(sim.state, c.id)));
    if (timeline.ack != null) truth.set(timeline.ack, sim.state.candidates.find(c => c.id === guestId).x);
    if (t % 2 === 0) toGuest.push({ at: downAt = Math.max(downAt, t + latency + Math.floor(random() * (jitter + 1))), state: JSON.parse(JSON.stringify(encodePresentationState({ ...sim.presentationView(), input_acks: { [guestId]: timeline.ack } }))) });
    while (toGuest.length && toGuest[0].at <= t) prediction.authoritative(toGuest.shift().state);
  }
  const length = sim.state.world.length;
  const errors = [...predicted].filter(([seq]) => truth.has(seq)).map(([seq, x]) => Math.abs(ringDelta(x, truth.get(seq), length)));
  return { errors, messages };
}
const mean = list => list.reduce((a, b) => a + b, 0) / list.length;

test('Campagne en réseau : le candidat de l’invité part dès l’appui, à la même place que chez l’hôte', () => {
  for (const [latency, jitter] of [[3, 0], [1, 3]]) {
    const { errors } = play({ latency, jitter, ticks: 600 });
    assert.ok(errors.length > 400, `${errors.length} comparaisons`);
    // L'hôte peut gêner le candidat (bousculade, coups de l'ordinateur) : la médiane reste exacte.
    const sorted = [...errors].sort((a, b) => a - b);
    assert.ok(sorted[Math.floor(sorted.length / 2)] < 0.01, `réseau ${latency}+${jitter} : écart médian ${sorted[Math.floor(sorted.length / 2)]}`);
    assert.ok(mean(errors) < 0.15, `réseau ${latency}+${jitter} : écart moyen ${mean(errors)}`);
  }
});

test('Campagne en réseau : l’invité envoie peu de messages', () => {
  const { messages } = play({ latency: 3, ticks: 300 });
  assert.ok(messages < 80, `${messages} messages en 10 s`);
});

test('Horloge : un pas joué dès l’appui est rattrapé ensuite, jamais plus d’un d’avance', async () => {
  const { FixedClock } = await import('../src/simulation/fixed-clock.js');
  const clock = new FixedClock(30);
  let ticks = 0;
  const tick = () => ticks++;
  clock.advance(0.02, tick);
  assert.equal(clock.pull(tick), true);
  assert.equal(clock.pull(tick), false, 'un seul pas d’avance');
  // Une seconde plus tard : 30 pas au total, comme sans appui.
  for (let i = 0; i < 49; i++) clock.advance(0.02, tick);
  assert.equal(ticks, 30);
  assert.ok(clock.alpha >= 0 && clock.alpha <= 1);
});
