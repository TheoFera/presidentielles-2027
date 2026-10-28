// Fermeture par le cabinet administratif : des CRS montent du bas de l'écran jusqu'au bâtiment
// (comme les journalistes et les habitants), le bâtiment ferme à leur arrivée, puis ils repartent.
import { NPC_ENTRY_SECONDS } from './npc-entry.js';
import { BUILDING_SHUTTER_SECONDS } from './building-shutters.js';

export const CLOSURE_ARRIVAL_SECONDS = NPC_ENTRY_SECONDS;
// Les CRS restent devant le bâtiment le temps que le rideau descende.
export const CLOSURE_HOLD_SECONDS = BUILDING_SHUTTER_SECONDS + 0.4;
export const CLOSURE_EXIT_SECONDS = NPC_ENTRY_SECONDS;
