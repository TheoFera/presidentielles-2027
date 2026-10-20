import { zoneAt } from './world.js';
import { zoneController } from './zone-control.js';

// Chaque tenue possède une version homme et une version femme.
export const SERVICE_ORDER_STYLES = {
  melenchon: {
    DEFENSE: ['melenchon-cgt', 'melenchon-orange-1', 'melenchon-orange-2'],
    RAID: ['melenchon-antifa-1', 'melenchon-antifa-2', 'melenchon-cite'],
  },
  le_pen: {
    DEFENSE: ['le-pen-rural', 'le-pen-rural-2', 'le-pen-rural-3'],
    RAID: ['le-pen-gud-1', 'le-pen-gud-2', 'le-pen-veteran'],
  },
};

export const defensiveGuard = npc => npc.role === 'SERVICE_D_ORDRE' && !npc.raid;

/** La garde défend uniquement les sous-zones tenues dans son biome de rattachement. */
export function guardDefendsPosition(state, npc, x) {
  const zone = zoneAt(state.world, x);
  return zone.biome_id === npc.guard_biome_id && zoneController(state, zone.id) === npc.faction_id;
}
