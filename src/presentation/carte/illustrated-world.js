import { plateAssetIds } from './carte-plate.js';

const biomeNames = ['bobo','banlieue','periurbain','campagne','retraites','riches'];
export function worldAssetIds(manifest, state) {
  const wanted = new Set(['vehicles', 'riders-melenchon', 'riders-le_pen', 'riders-philippe', 'riders-bardella']);
  for (const biome of biomeNames) wanted.add(`building-meeting_stage-${biome}`).add(`building-meeting_micro-${biome}`);
  // La carte plate peint déjà ciel, nuages, arbres et façades.
  for (const id of plateAssetIds()) wanted.add(id);
  for (const id of Object.keys(manifest)) {
    if (/^(character-|ultimate-|npc-|security-|crs-|journalist-|fx-|ui-|minor-)/.test(id)) wanted.add(id);
  }
  return [...wanted];
}

export function preloadWorld(renderer, state, zone) {
  if (renderer.artZone === zone.index && renderer.artWorld === state.world) return;
  renderer.artZone = zone.index;
  renderer.artWorld = state.world;
  // Pin the complete playable map, including remote buildings and animation
  // variants, before play. Crossing a boundary no longer evicts visible art.
  void renderer.assets.keep(worldAssetIds(renderer.assets.manifest, state));
}
