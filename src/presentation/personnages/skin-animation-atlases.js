// Generated pose measurements are kept separate from animation timing.
import { skinAtlasData } from './skin-animation-data.js';

export const skinAnimationAtlases = skinAtlasData;

// Caler les deux gestes de la Déferlante sur la hauteur visible de la garde.
// La hauteur reste calée sur la garde ; ces deux dessins sont affinés de 10 %.
const surgeSkin = skinAnimationAtlases.melenchon_communautariste;
const surgeGestureScale = surgeSkin.extras.actions.referenceHeight / surgeSkin.combat.referenceHeight;
surgeSkin.extras.actions.frameScales = Array.from({ length: 16 }, (_, frame) => frame >= 14
  ? surgeGestureScale * surgeSkin.combat.frames[0][3] / surgeSkin.extras.actions.frames[frame][3] : 1);
surgeSkin.extras.actions.frameWidthScales = Array.from({ length: 16 }, (_, frame) => frame >= 14 ? .9 : 1);

// Le bord supérieur croise une chaussure de la pose précédente : suivre les cheveux
// au pixel près dans cette zone, au lieu de conserver la large bande de découpe.
surgeSkin.extras.actions.clips[14].splice(0, 4,
  [791,985], [791,986], [782,986], [782,987], [776,987], [776,989],
  [768,989], [768,991], [760,991], [760,993], [753,993], [753,996],
  [747,996], [747,999], [739,999], [739,1004]);

export function skinAnimationFor(actor) {
  const skin = skinAnimationAtlases[actor.current_campaign_style];
  return skin?.faction === actor.faction_id ? skin : null;
}
