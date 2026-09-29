// Écarte à l'écran les PNJ immobiles qui se tiennent au même endroit.
// Ceux qui marchent se croisent librement ; la simulation garde les vraies positions.

/** Décalage visé pour chaque PNJ immobile : un groupe serré est réparti autour de son centre. */
export function crowdTargets(state, gap) {
  const targets = new Map();
  const still = state.npcs
    .filter(n => !n.moving && !n.meeting_target_id && !n.rally_event_id)
    .sort((a, b) => a.x - b.x || (a.id < b.id ? -1 : 1));
  let cluster = [];
  const spread = () => {
    if (cluster.length > 1) {
      const center = cluster.reduce((sum, n) => sum + n.x, 0) / cluster.length;
      cluster.forEach((n, i) => targets.set(n.id, center + (i - (cluster.length - 1) / 2) * gap - n.x));
    }
    cluster = [];
  };
  for (const npc of still) {
    if (cluster.length && npc.x - cluster.at(-1).x >= gap) spread();
    cluster.push(npc);
  }
  spread();
  return targets;
}

export class CrowdSpacing {
  constructor() { this.offsets = new Map(); this.lastTime = null; }

  /** Glisse doucement chaque PNJ vers sa place : aucun saut quand il s'arrête ou repart. */
  update(state, gap, now = performance.now()) {
    const dt = this.lastTime === null ? 0 : Math.min(0.1, (now - this.lastTime) / 1000);
    this.lastTime = now;
    const targets = crowdTargets(state, gap);
    const ease = 1 - Math.exp(-dt * 6);
    const next = new Map();
    for (const npc of state.npcs) {
      const current = this.offsets.get(npc.id) || 0;
      const goal = targets.get(npc.id) || 0;
      const value = current + (goal - current) * ease;
      if (goal || Math.abs(value) > 0.001) next.set(npc.id, value);
    }
    this.offsets = next;
  }

  offset(id) { return this.offsets.get(id) || 0; }
}
