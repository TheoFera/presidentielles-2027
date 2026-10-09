export const FACTIONS = ['melenchon', 'le_pen', 'philippe'];
/** Candidats mineurs : un QG fixe, quelques sympathisants, pas d'économie ; éliminés définitivement s'ils sont battus. */
export const MINOR_FACTIONS = ['glucksmann', 'roussel', 'arthaud', 'dupont_aignan', 'retailleau', 'attal'];
export const ALL_FACTIONS = [...FACTIONS, ...MINOR_FACTIONS];
export const isMinorFaction = faction => MINOR_FACTIONS.includes(faction);

export function wrap(x, length) { return ((x % length) + length) % length; }

/** Shortest signed distance on the ring, including across the Paris/riches seam. */
export function ringDelta(from, to, length) { return wrap(to - from + length / 2, length) - length / 2; }

export function buildWorld(config) {
  const width = config.prototype.world.units_per_screen * config.layout.screens_per_subzone;
  const zones = config.layout.biomes.flatMap((biome, biomeIndex) => biome.subzones.map((zone, localIndex) => ({
    ...zone, biome_id: biome.id, biome_index: biomeIndex, biome_name: biome.display_name, local_index: localIndex,
  })));
  const subzones = zones.map((zone, index) => ({ ...zone, index, start: index * width, end: (index + 1) * width, center: (index + 0.5) * width, width }));
  const socialPoints = subzones.flatMap(zone => Array.from({ length: config.layout.social_points_per_subzone }, (_, index) => ({
    id: `social:${zone.id}:${index}`, biome_id: zone.biome_id, subzone_id: zone.id,
    x: zone.start + zone.width * (index + 1) / (config.layout.social_points_per_subzone + 1),
  })));
  // These are inert scenery volumes, never faction buildings or purchasable slots.
  const scenery = subzones.flatMap(zone => config.prototype.presentation.building_x_ratios.map((ratio, index) => ({
    id: `scenery:${zone.id}:${index}`, subzone_id: zone.id, x: zone.start + zone.width * ratio, variant: (zone.local_index + index) % 3,
  })));
  return { length: subzones.length * width, subzones, socialPoints, scenery };
}

/** Place personnelle d'un PNJ dans sa sous-zone (ancien état sans place : le point d'origine). */
export function npcHomeX(state, npc) {
  return npc.home_x ?? state.world.socialPoints.find(p => p.id === npc.origin_social_point_id).x;
}

export function zoneAt(world, x) {
  return world.subzones[Math.floor(wrap(x, world.length) / world.subzones[0].width)];
}

/** Stateful xorshift32. Only simulation code calls this; the state goes into snapshots. */
export function random(state) {
  let x = state.rng_state;
  x ^= x << 13; x ^= x >>> 17; x ^= x << 5;
  state.rng_state = x >>> 0;
  return state.rng_state / 4294967296;
}

export function fingerprint(config) {
  let hash = 2166136261;
  for (const char of JSON.stringify(config)) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  return (hash >>> 0).toString(16);
}

/** Nombre de sous-zones qui séparent deux sous-zones sur l'anneau (0 = même sous-zone, 1 = limitrophe). */
export function subzoneGap(world, a, b) {
  const gap = Math.abs(a.index - b.index);
  return Math.min(gap, world.subzones.length - gap);
}
