// Écarte à l'écran les PNJ immobiles qui se tiennent au même endroit.
// Ceux qui marchent se croisent librement ; la simulation garde les vraies positions.

const STEP_SPEED = 0.9;     // unités par seconde : un pas de côté tranquille
const WALKER_SPEED = 0.35;  // pendant une marche, le décalage ne change que très peu l'allure
const STEPPING = 0.12;      // au-dessus de cette vitesse, le PNJ immobile est dessiné en train de marcher

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
  constructor() { this.offsets = new Map(); this.steps = new Map(); this.lastTime = null; }

  /** Chaque PNJ rejoint sa place à petits pas : jamais de glissement rapide ni de saut. */
  update(state, gap, now = performance.now()) {
    const dt = this.lastTime === null ? 0 : Math.min(0.1, (now - this.lastTime) / 1000);
    this.lastTime = now;
    const targets = crowdTargets(state, gap);
    const offsets = new Map();
    this.steps = new Map();
    for (const npc of state.npcs) {
      const current = this.offsets.get(npc.id) || 0;
      const goal = targets.get(npc.id) || 0;
      const limit = (npc.moving ? WALKER_SPEED : STEP_SPEED) * dt;
      const change = Math.max(-limit, Math.min(limit, goal - current));
      const value = current + change;
      if (goal || Math.abs(value) > 0.001) offsets.set(npc.id, value);
      if (!npc.moving && dt > 0 && Math.abs(change) / dt > STEPPING) this.steps.set(npc.id, Math.sign(change));
    }
    this.offsets = offsets;
  }

  offset(id) { return this.offsets.get(id) || 0; }

  /** Sens du pas de côté en cours (-1 ou 1), sinon 0. */
  stepping(id) { return this.steps.get(id) || 0; }
}
