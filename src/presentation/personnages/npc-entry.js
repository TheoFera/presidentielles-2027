// Un nouveau PNJ n'apparaît pas d'un coup : il arrive du bas de l'écran en marchant.
// Effet d'affichage seulement ; la simulation le place directement à sa position.

export const NPC_ENTRY_SECONDS = 1.6;

/**
 * Avancement de l'arrivée (0 = tout en bas, 1 = arrivé) pour chaque PNJ récemment apparu.
 * On lit l'instant d'apparition sur le PNJ lui-même : le journal d'évènements est trop court
 * (quelques entrées) et n'est pas transmis aux invités en multijoueur.
 */
export function npcEntryProgress(state, tickHz, alpha = 0, seconds = NPC_ENTRY_SECONDS) {
  const progress = new Map();
  const duration = Math.max(1, seconds * tickHz);
  for (const npc of state.npcs || []) {
    if (npc.entry_tick == null) continue;
    const elapsed = state.tick + alpha - npc.entry_tick;
    if (elapsed < duration) progress.set(npc.id, Math.max(0, elapsed / duration));
  }
  return progress;
}

/**
 * Trajet d'arrivée, en fractions : `lift` (hauteur sous le trottoir), `side` (écart sur le côté)
 * et `bob` (petit rebond de chaque pas). Le PNJ monte d'abord, puis tourne pour finir de côté
 * jusqu'à sa place : la trajectoire est une courbe, pas une ligne droite.
 */
export function entryPath(progress, time) {
  const remaining = 1 - Math.min(1, Math.max(0, progress));
  const step = Math.abs(Math.sin(time * 13)); // un rebond par pas, au rythme des jambes;
  return { lift: remaining * remaining, side: remaining, bob: step * Math.min(1, remaining * 6) };
}
