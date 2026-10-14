import test from 'node:test';
import assert from 'node:assert/strict';
import { config } from '../scripts/game-config.mjs';
import { GameSimulation } from '../src/simulation/game-simulation.js';
import { captureSite, neutralizeSite } from '../src/simulation/strategic-sites.js';
import { defeatMinor } from '../src/simulation/minor-candidates.js';
import { buildingShutterProgress } from '../src/simulation/building-shutters.js';
import { BUILDING_OPENINGS } from '../src/presentation/carte/building-shutters.js';
import { plateFeatureFrame } from '../src/presentation/carte/carte-plate.js';
import { ringDelta } from '../src/simulation/world.js';

const make = () => new GameSimulation(structuredClone(config), 42);
const garage = sim => sim.state.buildings.find(b => b.type === 'garage_velo');

test('Les 18 contrôles reflètent leur activité ; les locaux libres sont fermés et les services ouverts', () => {
  const sim = make();
  const controls = sim.state.buildings.filter(b => b.controls_zone);
  assert.equal(controls.length, 18);
  assert.deepEqual(Object.keys(BUILDING_OPENINGS).sort(), controls.map(b => b.site_id).sort());
  for (const b of sim.state.buildings) {
    const expected = b.controls_zone && b.state !== 'ACTIVE' ? 1 : 0;
    assert.equal(buildingShutterProgress(b, 0, sim.hz), expected);
    assert.equal(buildingShutterProgress(b, sim.hz * 20, sim.hz), expected);
    if (!b.controls_zone) {
      b.state = 'NEUTRAL';
      assert.equal(buildingShutterProgress(b, 0, sim.hz), 0, 'Aucun rideau sur un service neutre');
      assert.ok(!BUILDING_OPENINGS[b.site_id]);
    }
  }
});

test('La prise ouvre en une seconde ; la perte referme, sans modifier le contrôle immédiat', () => {
  const sim = make(), b = garage(sim), actor = sim.state.candidates[0];
  sim.state.tick = 10;
  captureSite(sim, b, actor);
  assert.equal(b.state, 'ACTIVE');
  assert.equal(buildingShutterProgress(b, 9, sim.hz), 1);
  assert.equal(buildingShutterProgress(b, 10, sim.hz), 1);
  assert.equal(buildingShutterProgress(b, 10 + sim.hz / 2, sim.hz), 0.5);
  assert.equal(buildingShutterProgress(b, 10 + sim.hz, sim.hz), 0);
  sim.state.tick += sim.hz * 2;
  assert.equal(neutralizeSite(sim, b, 'CABINET_ADMINISTRATIF'), true);
  assert.equal(b.state, 'NEUTRAL');
  assert.equal(buildingShutterProgress(b, sim.state.tick, sim.hz), 0);
  assert.equal(buildingShutterProgress(b, sim.state.tick + sim.hz / 2, sim.hz), 0.5);
  assert.equal(buildingShutterProgress(b, sim.state.tick + sim.hz, sim.hz), 1);
});

test('Les QG des six candidats secondaires sont ouverts et se ferment quand ils sont battus', () => {
  const sim = make(), minors = sim.state.candidates.filter(c => c.minor);
  assert.equal(minors.length, 6);
  sim.state.tick = sim.hz * 2;
  for (const minor of minors) {
    const b = sim.state.buildings.find(b => b.id === minor.headquarters_site_id);
    assert.equal(buildingShutterProgress(b, sim.state.tick, sim.hz), 0);
    defeatMinor(sim, minor);
    assert.equal(b.state, 'NEUTRAL');
    assert.equal(buildingShutterProgress(b, sim.state.tick, sim.hz), 0);
    assert.equal(buildingShutterProgress(b, sim.state.tick + sim.hz, sim.hz), 1);
  }
});

test('Une fermeture puis une reprise en cours de mouvement ne font pas sauter le rideau', () => {
  const sim = make(), b = garage(sim), actor = sim.state.candidates[0];
  captureSite(sim, b, actor);
  sim.state.tick += Math.floor(sim.hz / 3);
  const opening = buildingShutterProgress(b, sim.state.tick, sim.hz);
  neutralizeSite(sim, b);
  assert.equal(buildingShutterProgress(b, sim.state.tick, sim.hz), opening);
  sim.state.tick += Math.floor(sim.hz / 3);
  const closing = buildingShutterProgress(b, sim.state.tick, sim.hz);
  assert.ok(closing > opening && closing < 1);
  captureSite(sim, b, actor);
  assert.equal(buildingShutterProgress(b, sim.state.tick, sim.hz), closing);
  const transition = structuredClone(b.shutter_transition);
  sim.state.tick++;
  captureSite(sim, b, actor);
  assert.deepEqual(b.shutter_transition, transition, 'Un bâtiment déjà actif ne rejoue pas son ouverture');
  assert.equal(buildingShutterProgress(b, sim.state.tick + sim.hz, sim.hz), 0);
});

test('Le mouvement reprend après sauvegarde et accepte les anciens états sans rideau', () => {
  const sim = make(), b = garage(sim);
  captureSite(sim, b, sim.state.candidates[0]);
  sim.state.tick = Math.floor(sim.hz / 3);
  const restored = make(); restored.importSnapshot(sim.exportSnapshot());
  for (const offset of [0, 0.25, sim.hz / 2, sim.hz * 3]) {
    assert.equal(buildingShutterProgress(garage(restored), sim.state.tick + offset, sim.hz),
      buildingShutterProgress(b, sim.state.tick + offset, sim.hz));
  }
  const legacy = JSON.parse(sim.exportSnapshot());
  for (const site of legacy.buildings) delete site.shutter_transition;
  restored.importSnapshot(JSON.stringify(legacy));
  assert.equal(buildingShutterProgress(garage(restored), restored.state.tick, sim.hz), 0);
});

test('Une animation reçue avec un tick futur, une position invalide ou sur un institut est rejetée', () => {
  const sim = make();
  for (const invalid of [{ tick: 1, from: 1 }, { tick: 0, from: -0.1 }, { tick: 0, from: 1.1 }, { tick: 0.5, from: 1 }]) {
    const snapshot = JSON.parse(sim.exportSnapshot());
    snapshot.buildings.find(b => b.controls_zone).shutter_transition = invalid;
    assert.throws(() => sim.importSnapshot(JSON.stringify(snapshot)), /animation du rideau invalide/);
  }
  const snapshot = JSON.parse(sim.exportSnapshot());
  snapshot.buildings.find(b => b.type === 'institut_sondage').shutter_transition = { tick: 0, from: 1 };
  assert.throws(() => sim.importSnapshot(JSON.stringify(snapshot)), /animation du rideau invalide/);
});

test('Les rideaux suivent exactement les arrondis des tuiles, même au raccord circulaire et au zoom', () => {
  const { state } = make();
  for (const b of state.buildings.filter(b => b.controls_zone)) {
    const zone = state.world.subzones.find(z => z.id === b.subzone_id), opening = BUILDING_OPENINGS[b.site_id];
    const position = b.x;
    assert.ok(opening.x >= 0 && opening.y >= 0 && opening.x + opening.w <= 1920 && opening.y + opening.h <= 1004);
    for (const scale of [0.37, 0.5, 1.25]) for (const cameraX of [0.2, state.world.length - 0.2, b.x]) {
      const pixelsPerUnit = 1920 / zone.width * scale;
      const renderer = { fixedWorldState: state, cameraX, metrics: { anchorX: 401.3, groundY: 700.3, pixelsPerUnit } };
      const frame = plateFeatureFrame(renderer, b, opening);
      const left = 401.3 + (ringDelta(cameraX, zone.center, state.world.length) - zone.width / 2) * pixelsPerUnit;
      assert.equal(frame.x0, Math.round(left));
      assert.equal(frame.y0, Math.round(700.3 - 1004 * scale));
      assert.ok(Math.abs((frame.left - frame.x0) / frame.scaleX - opening.x) < 1e-9);
      assert.ok(Math.abs((frame.top - frame.y0) / frame.scaleY - opening.y) < 1e-9);
      assert.equal(b.x, position);
    }
  }
});
