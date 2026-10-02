/**
 * Tampon d'affichage d'un invité.
 *
 * En 4G, les états de l'hôte arrivent par grappes irrégulières. Les afficher dès leur
 * arrivée fait sauter puis figer les personnages. On les range ici selon leur tick
 * (l'horloge de l'hôte) et on affiche avec un léger retard constant : il y a presque
 * toujours deux états encadrant l'instant affiché, et le mouvement reste fluide.
 */
export class SnapshotBuffer {
  constructor(tickSeconds, { minDelay = 0.06, maxDelay = 0.35 } = {}) {
    this.dt = tickSeconds; this.minDelay = minDelay; this.maxDelay = maxDelay;
    this.reset();
  }
  reset() {
    this.items = []; this.offset = null; this.jitter = 0; this.spacing = 0.1; this.lastArrival = null;
    this.renderTick = null; this.renderedAt = null;
  }
  /** Range un état reçu. `now` en secondes (horloge locale). */
  push(state, now) {
    const tick = state?.tick;
    if (!Number.isFinite(tick)) { this.reset(); this.items.push({ tick: 0, state }); return; }
    const last = this.items.at(-1);
    // Paquet en retard : ignoré. Grand retour en arrière (nouvelle partie) : on repart de zéro.
    if (last && tick < last.tick) { if (last.tick - tick < 300) return; this.reset(); }
    if (last && tick === last.tick) { last.state = state; return; }
    // Décalage entre l'horloge locale et celle de l'hôte : le paquet le plus rapide fait foi.
    // Il remonte doucement pour suivre une connexion qui ralentit durablement.
    const sample = now - tick * this.dt;
    if (this.offset === null) this.offset = sample;
    else {
      const since = this.lastArrival === null ? 0 : Math.max(0, now - this.lastArrival);
      this.offset = Math.min(sample, this.offset + since * 0.02);
      // Pire retard récent d'un paquet par rapport au plus rapide (gigue du réseau) :
      // il s'oublie lentement, 20 ms par seconde, quand la connexion se calme.
      this.jitter = Math.max(sample - this.offset, this.jitter - since * 0.02);
    }
    if (last) this.spacing += ((tick - last.tick) * this.dt - this.spacing) * 0.1;
    this.lastArrival = now;
    this.items.push({ tick, state });
    if (this.items.length > 60) this.items.shift();
  }
  get delay() {
    return Math.max(this.minDelay, Math.min(this.maxDelay, this.spacing + this.jitter + 0.01));
  }
  /** Le plus récent état reçu (pour les commandes et l'interface). */
  get latest() { return this.items.at(-1)?.state ?? null; }
  /** Deux états et la proportion entre eux pour l'instant affiché. */
  sample(now) {
    const items = this.items;
    if (!items.length) return null;
    if (items.length === 1 || this.offset === null) { const state = items.at(-1).state; return { previous: state, state, alpha: 1 }; }
    // L'instant affiché avance toujours : il accélère ou ralentit d'au plus 10 %
    // pour rejoindre sa cible, sans jamais reculer quand la gigue change.
    const target = (now - this.offset - this.delay) / this.dt;
    if (this.renderTick === null || Math.abs(target - this.renderTick) > 15) this.renderTick = target;
    else {
      const speed = 1 + Math.max(-0.1, Math.min(0.1, (target - this.renderTick) * 0.05));
      this.renderTick += Math.max(0, now - this.renderedAt) / this.dt * speed;
    }
    this.renderedAt = now;
    const renderTick = this.renderTick;
    if (renderTick >= items.at(-1).tick) { const state = items.at(-1).state; return { previous: state, state, alpha: 1 }; }
    if (renderTick <= items[0].tick) return { previous: items[0].state, state: items[0].state, alpha: 1 };
    let i = 1;
    while (items[i].tick <= renderTick) i++;
    // Les états plus anciens que la paire affichée ne servent plus.
    if (i > 1) items.splice(0, i - 1), i = 1;
    const a = items[0], b = items[1];
    return { previous: a.state, state: b.state, alpha: (renderTick - a.tick) / (b.tick - a.tick) };
  }
}
