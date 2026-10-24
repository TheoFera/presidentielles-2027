import { zoneAt } from './world.js';

// Le local de chaque sous-zone, rangé une fois par liste de bâtiments (la liste et ces deux champs ne changent pas
// en cours de partie ; une partie chargée a sa propre liste). Le premier trouvé, comme `find`.
const controllingSites = new WeakMap();

/** Seul le local désigné par le tableau détermine le contrôle, indépendamment des votes. */
export function controllingSite(state, subzoneId) {
  let sites = controllingSites.get(state.buildings);
  if (!sites) {
    sites = new Map();
    for (const site of state.buildings) if (site.controls_zone && !sites.has(site.subzone_id)) sites.set(site.subzone_id, site);
    controllingSites.set(state.buildings, sites);
  }
  return sites.get(subzoneId) || null;
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
