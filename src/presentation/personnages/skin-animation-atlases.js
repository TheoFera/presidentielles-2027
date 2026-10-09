// Generated pose measurements are kept separate from animation timing.
import { skinAtlasData } from './skin-animation-data.js';

export const skinAnimationAtlases = skinAtlasData;

export function skinAnimationFor(actor) {
  const skin = skinAnimationAtlases[actor.current_campaign_style];
  return skin?.faction === actor.faction_id ? skin : null;
}
