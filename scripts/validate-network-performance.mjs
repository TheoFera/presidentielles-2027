import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { campaignConfig } from './validate-campaign.mjs';
import { GameSimulation } from '../src/simulation/game-simulation.js';
import { AIController, LocalHumanController } from '../src/simulation/controllers.js';
import { startArena, finishArena, finishSprint } from '../src/simulation/match-lifecycle.js';
import { PeerSession } from '../src/network/peer-session.js';
import { stateDelta, applyStateDelta, presentationState } from '../src/network/state-stream.js';
import { outgoingCommands } from '../src/network/shared-commands.js';

const sim = new GameSimulation(campaignConfig(), 2027), ai = new AIController(sim.config), frames = [];
const capture = () => frames.push(sim.getState({ presentation: true }));
const advance = count => {
  for (let i = 0; i < count; i++) {
    sim.step(sim.state.candidates.flatMap(c => ai.commands(sim.state, c.id)));
    if (i % 3 === 0) capture();
  }
};
capture(); advance(600); startArena(sim); capture(); advance(60);
finishArena(sim, 'philippe'); capture(); advance(90);
for (const e of sim.state.electorate) e.support = { melenchon: 60, le_pen: 30, philippe: 0, neutral: 10 };
finishSprint(sim); capture();

function reference(count) {
  const baselines = Array(count), packets = [];
  for (const frame of frames) {
    const row = [];
    for (let i = 0; i < count; i++) {
      const delta = stateDelta(frame, baselines[i]); baselines[i] = delta.next;
      row.push(JSON.stringify({ type: 'snapshot', data: delta.packet }));
    }
    packets.push(row);
  }
  return packets;
}

function optimized(count) {
  const session = new PeerSession({}, 'benchmark'), packets = [];
  session.peers = new Map(Array.from({ length: count }, (_, i) => [i, {
    connected: true, outbox: [], channel: { readyState: 'open', bufferedAmount: 0 },
  }]));
  // Measure the real broadcaster up to enqueue. Fragmentation and transport are
  // unchanged and tested separately with real browser channels and backpressure.
  let row;
  session.enqueue = (peer, json, baseline) => { peer.baseline = baseline; row.push(json); return true; };
  for (const frame of frames) { row = []; session.broadcast('snapshot', frame); packets.push(row); }
  return packets;
}

const report = { frames: frames.length, phases: [...new Set(frames.map(frame => frame.phase))], measurements: [] };
for (const guests of [1, 2]) {
  const expected = reference(guests), actual = optimized(guests);
  assert.deepEqual(actual, expected, 'Chaque paquet doit rester identique octet par octet');
  let received;
  for (let i = 0; i < actual.length; i++) {
    received = applyStateDelta(received, JSON.parse(actual[i][0]).data);
    assert.deepEqual(received, presentationState(frames[i]));
  }
  const rounds = [];
  for (let round = 0; round < 6; round++) {
    const result = {};
    for (const mode of round % 2 ? ['after', 'before'] : ['before', 'after']) {
      const start = performance.now(); (mode === 'before' ? reference : optimized)(guests);
      result[mode] = performance.now() - start;
    }
    rounds.push(result);
  }
  const median = mode => rounds.map(r => r[mode]).sort((a, b) => a - b).slice(2, 4).reduce((a, b) => a + b) / 2;
  report.measurements.push({ guests, beforeMs: median('before'), afterMs: median('after'), rounds, bytes: actual.flat().reduce((sum, packet) => sum + Buffer.byteLength(packet), 0) });
}
const human = new LocalHumanController(); human.setAxis(1);
const commands = human.commands({}, 'candidate:le_pen');
report.movementCommandBytes = {
  before: Buffer.byteLength(JSON.stringify({ type: 'commands', data: { commands } })),
  after: Buffer.byteLength(JSON.stringify({ type: 'commands', data: { commands: outgoingCommands(commands) } })),
};
await mkdir('artifacts/performance', { recursive: true });
await writeFile('artifacts/performance/multiplayer-benchmark.json', JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
