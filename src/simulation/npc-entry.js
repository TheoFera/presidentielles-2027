// Durée commune à l'arrivée visuelle et à la disponibilité pour la persuasion.
export const NPC_ENTRY_SECONDS = 1.6;

export function npcHasArrived(npc, tick, tickHz) {
  return npc.entry_tick == null || tick - npc.entry_tick >= Math.max(1, NPC_ENTRY_SECONDS * tickHz);
}
