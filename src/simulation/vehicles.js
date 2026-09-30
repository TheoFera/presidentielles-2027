import { canCampaign } from './combat-state.js';
import { ringDelta } from './world.js';

export const garageVehicle = type => ({ garage_velo: 'velo', garage_scooter: 'scooter' })[type] || null;
const actions = new Set(['Attack', 'PressAttack', 'Jump', 'Dash', 'ActivateUltimate', 'SelectCampaignStyle']);

export function dismountVehicle(candidate) {
  if (!candidate) return;
  candidate.vehicle = null;
  candidate.vehicle_hold = null;
}

export function vehicleCommand(candidate, command) {
  if (actions.has(command.type) || command.type === 'HoldCampaignStyle' && command.active) dismountVehicle(candidate);
}

export function candidateTravelSpeed(config, candidate) {
  const multiplier = candidate.vehicle ? config.balance.vehicles[`${candidate.vehicle.type}_speed_multiplier`] : 1;
  return config.prototype.movement.candidate_speed_units_per_second * multiplier;
}

export function updateVehicles(sim) {
  const { state, config } = sim;
  const settings = config.balance.vehicles;
  for (const candidate of state.candidates) {
    if (candidate.eliminated || candidate.is_ko || candidate.campaign_debate_id || !canCampaign(candidate)
      || candidate.combat.jump_tick != null || candidate.combat.height > 0 || candidate.style_interaction_held
      || !['CAMPAIGN', 'SECOND_ROUND_SPRINT'].includes(state.phase)) {
      dismountVehicle(candidate); continue;
    }
    if (candidate.vehicle) continue;
    const site = !candidate.axis && candidate.interaction_active && state.buildings.find(b => garageVehicle(b.type)
      && b.state === 'ACTIVE' && b.owner_id === candidate.faction_id
      && Math.abs(ringDelta(candidate.x, b.x, state.world.length)) <= settings.garage_radius_units);
    if (!site) { candidate.vehicle_hold = null; continue; }
    if (candidate.vehicle_hold?.site_id !== site.id) candidate.vehicle_hold = { site_id: site.id, elapsed_ticks: 0 };
    if (++candidate.vehicle_hold.elapsed_ticks < sim.secondsToTicks(settings.mount_seconds)) continue;
    candidate.vehicle = { type: garageVehicle(site.type), site_id: site.id };
    candidate.vehicle_hold = null;
    sim.emit('VehicleMounted', { candidate_id: candidate.id, target_id: site.id, vehicle_type: candidate.vehicle.type });
  }
}

export function validateVehicles(state, fail, config) {
  for (const candidate of state.candidates) {
    const vehicle = candidate.vehicle, hold = candidate.vehicle_hold;
    if (vehicle && (!['velo', 'scooter'].includes(vehicle.type)
      || !state.buildings.some(b => b.id === vehicle.site_id && garageVehicle(b.type) === vehicle.type))) fail('véhicule invalide');
    if (vehicle != null && (typeof vehicle !== 'object' || !vehicle.type)) fail('véhicule invalide');
    if (hold != null && (typeof hold !== 'object' || !hold.site_id)) fail('attente du véhicule invalide');
    if (hold && (vehicle || !Number.isInteger(hold.elapsed_ticks) || hold.elapsed_ticks < 0
      || hold.elapsed_ticks >= Math.ceil(config.balance.vehicles.mount_seconds * config.balance.simulation_architecture.fixed_tick_hz)
      || !state.buildings.some(b => b.id === hold.site_id && garageVehicle(b.type)))) fail('attente du véhicule invalide');
  }
}
