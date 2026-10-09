import { seasonAt } from '../../simulation/campaign-events.js';
import { plateAssetIds } from './carte-plate.js';

const biomeNames = ['bobo','banlieue','periurbain','campagne','retraites','riches'];
export function scenerySeasonFilter(progress) {
  const season=seasonAt(progress||0), values=[[1,0,1],[.65,.3,1],[.24,0,1.06],[1.08,.06,1.08]];
  const current=values[season.index],next=values[(season.index+1)%4];
  // Arrondi au cinquantième : la teinte évolue par petits paliers invisibles,
  // ce qui permet de réutiliser les tuiles déjà teintées (voir tintedTile dans carte-plate.js).
  const [saturation,sepia,brightness]=current.map((v,i)=>Math.round((v+(next[i]-v)*season.blend)*50)/50);
  if(saturation===1&&sepia===0&&brightness===1)return 'none';
  return `saturate(${saturation}) sepia(${sepia}) brightness(${brightness})`;
}

export function worldAssetIds(manifest, state) {
  const wanted = new Set(['background-debate', 'vehicles', 'riders-melenchon', 'riders-le_pen', 'riders-philippe', 'riders-bardella']);
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
