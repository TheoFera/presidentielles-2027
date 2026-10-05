// Un nouveau PNJ n'apparaît pas d'un coup : il arrive du bas de l'écran en marchant.
// Effet d'affichage seulement ; la simulation le place directement à sa position.

export const NPC_ENTRY_SECONDS = 1.6;

/**
 * Avancement de l'arrivée (0 = tout en bas, 1 = arrivé) pour chaque PNJ récemment apparu.
 * Les évènements `NeutralSpawned` sont rangés par ordre chronologique : on lit depuis la fin.
 */
export function npcEntryProgress(state, tickHz, alpha = 0, seconds = NPC_ENTRY_SECONDS) {
  const progress = new Map();
  const duration = Math.max(1, seconds * tickHz);
  const events = state.events || [];
  for (let i = events.length - 1; i >= 0; i--) {
    const event = events[i];
    const elapsed = state.tick + alpha - event.tick;
    if (elapsed >= duration) break;
    if (event.type === 'NeutralSpawned' && !progress.has(event.npc_id)) progress.set(event.npc_id, Math.max(0, elapsed / duration));
  }
  return progress;
}

/** Ralentit en fin de trajet, comme quelqu'un qui arrive à sa place. */
export const entryLift = progress => {
  const remaining = 1 - Math.min(1, Math.max(0, progress));
  return remaining * (0.35 + 0.65 * remaining);
};
