import { combatAtlasFor, MELENCHON_REFERENCE_HEIGHT, MELENCHON_HEIGHT_STRETCH } from '../personnages/melenchon-combat.js';
import { scarfCostumeActor } from '../personnages/scarf-costume.js';

// Même corps et même échelle que les coups ordinaires : garde, armé, bras tendu, retour.
export function scarfBody(entity, gesture, height) {
  const atlas = combatAtlasFor(scarfCostumeActor(entity)), frame = [0, 2, 3, 2][gesture];
  const scale = height / (atlas.referenceHeight || MELENCHON_REFERENCE_HEIGHT) * (atlas.frameScales?.[frame] ?? 1) * MELENCHON_HEIGHT_STRETCH;
  return { atlas, frame, scale };
}

export function scarfGrip(atlas, frame, scale) {
  const [sx, sy, sw, sh, px, py] = atlas.frames[frame];
  const hands = [[243,132],[549,147],[844,139],[1225,113]];
  const hand = atlas.sprite === 'character-philippe-combat-v1' && hands[frame];
  return { x: ((hand?.[0] ?? sx + sw * .77) - px) * scale, y: ((hand?.[1] ?? sy + sh * .38) - py) * scale };
}

export function scarfHand(entity, height, gesture = 2) {
  const { atlas, frame, scale } = scarfBody(entity, gesture, height);
  return scarfGrip(atlas, frame, scale);
}
