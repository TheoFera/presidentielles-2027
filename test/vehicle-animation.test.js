import test from 'node:test';
import assert from 'node:assert/strict';
import { CAMPAIGN_STYLES } from '../src/simulation/campaign-styles.js';
import { mountedVehicleAssetId, vehicleWheelSpin, vehicleWheelTravel } from '../src/presentation/carte/vehicles.js';

test('Le scooter moderne dépend du garage périurbain, pour toutes les tenues et Bardella', () => {
  const state = { buildings: [
    { id: 'peri', subzone_id: 'periurbain_b' },
    { id: 'campagne', subzone_id: 'campagne_a' },
  ] };
  for (const faction_id of ['melenchon', 'le_pen', 'philippe']) {
    for (const current_campaign_style of [null, ...CAMPAIGN_STYLES[faction_id].map(s => s.id)]) {
      const entity = { faction_id, current_campaign_style, vehicle: { type: 'scooter', site_id: 'peri' } };
      assert.equal(mountedVehicleAssetId(entity, state), `riders-periurbain-${faction_id}`);
      entity.bardella_form = true;
      assert.equal(mountedVehicleAssetId(entity, state), 'riders-periurbain-bardella');
      entity.bardella_form = false;
      entity.vehicle.site_id = 'campagne';
      assert.equal(mountedVehicleAssetId(entity, state), `riders-${faction_id}`);
      entity.vehicle = { type: 'velo', site_id: 'peri' };
      assert.equal(mountedVehicleAssetId(entity, state), `riders-${faction_id}`);
    }
  }
});

test('Les roues suivent le déplacement, les arrêts et le passage autour de la carte', () => {
  const renderer = { cameraX: 98, metrics: { anchorX: 100, pixelsPerUnit: 10 } };
  const entity = { id: 'candidat', vehicle: { type: 'velo', site_id: 'garage' } };
  const state = { tick: 1, world: { length: 100 } };
  const travel = x => vehicleWheelTravel(renderer, entity, x, state);
  assert.equal(travel(100), 0);
  state.tick++;
  assert.equal(travel(120), 2);
  state.tick++;
  renderer.cameraX = 1;
  // La caméra suit le candidat : son déplacement à l'écran ne suffit pas.
  entity.vehicle = { ...entity.vehicle };
  assert.equal(travel(100), 3);
  state.tick++;
  assert.equal(travel(100), 3);
  state.tick++;
  assert.equal(travel(90), 2);
  state.tick = 0;
  assert.equal(travel(90), 0);
  entity.vehicle = { type: 'scooter', site_id: 'autre-garage' };
  assert.equal(travel(120), 0);
});

test('À grande vitesse, les rayons tournent toujours dans le sens du déplacement', () => {
  const limit = Math.PI * 2 / 12 / 3;
  // 10 pixels par image pour une roue de 21 pixels : presque un écart entre deux rayons.
  let spin = vehicleWheelSpin(null, 0, 50, 21, 12);
  spin = vehicleWheelSpin(spin, 0.2, 50, 21, 12);
  assert.equal(spin.angle, limit);
  spin = vehicleWheelSpin(spin, 0.25, 50, 21, 12);
  assert.ok(spin.angle > limit && spin.angle < limit * 2);
  spin = vehicleWheelSpin(spin, -5, 50, 21, 12);
  assert.ok(spin.angle < limit);
});
