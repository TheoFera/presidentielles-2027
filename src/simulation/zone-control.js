import { zoneAt } from './world.js';

/** Seul le local désigné par le tableau détermine le contrôle, indépendamment des votes. */
export function controllingSite(state, subzoneId) {
  return state.buildings.find(site => site.controls_zone && site.subzone_id === subzoneId) || null;
}

export function zoneController(state, subzoneId) {
  const site = controllingSite(state, subzoneId);
  return site?.state === 'ACTIVE' ? site.owner_id : null;
}

export function hostilePersuasionMultiplier(state, config, actor, target) {
  const owner = zoneController(state, zoneAt(state.world, target.x).id);
  return owner && owner !== actor.faction_id ? config.balance.zone_control.enemy_persuasion_time_multiplier : 1;
}

export function controlledUnitDamageMultiplier(state, config, target) {
  if (!['SYMPATHISANT', 'MILITANT'].includes(target.role)) return 1;
  const owner = zoneController(state, zoneAt(state.world, target.x).id);
  if (!owner || owner !== target.faction_id) return 1;
  // Avantage de Philippe : ses quartiers tenus protègent davantage ses soutiens.
  const control = config.balance.zone_control;
  return 1 / (owner === 'philippe' ? control.philippe_supporter_health_multiplier ?? control.supporter_health_multiplier : control.supporter_health_multiplier);
}
