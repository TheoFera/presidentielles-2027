/**
 * Commandes d'un invité, numérotées pas par pas (Campagne et Débat).
 *
 * L'invité compte ses pas de simulation (`seq`). Il n'envoie un message que lorsque quelque
 * chose change (direction, coup, saut…) et un court signe de vie quelques fois par seconde :
 * entre deux messages, il garde la même direction. Peu de messages, donc peu de données.
 *
 * L'hôte range chaque pas reçu sur sa propre ligne du temps (`seq + offset` = numéro de tick)
 * et renvoie le dernier pas appliqué (`ack`) : la prédiction de l'invité repart de là.
 * - Mode « retour en arrière » (Débat) : chaque pas est prévu pour le tick où il arrive au plus tôt.
 *   Un pas retardé par un à-coup du réseau arrive après son tick : l'hôte recalcule depuis ce tick.
 *   (L'hôte ne cale pas les pas sur l'instant exact où l'invité les a joués : il devrait deviner
 *   les pas pas encore arrivés, et ses suppositions fausseraient la prédiction de l'invité.)
 * - Mode « avance » (Campagne, trop lourde à recalculer) : l'hôte applique les pas avec une
 *   petite marge, pour qu'ils arrivent presque toujours à temps ; un pas en retard est appliqué
 *   au tick suivant.
 */

// Signe de vie : au moins un message tous les 6 pas (5 par seconde).
export const HEARTBEAT_TICKS = 6;
// Sans nouvelles depuis 1 s, le joueur distant est considéré comme absent : son candidat s'arrête.
const IDLE_MS = 1000;
// Fenêtre d'observation des arrivées pour caler la ligne du temps.
const SAMPLES = 40;
// Recalage au plus d'un tick toutes les 15 (une demi-seconde), sauf grand écart (reprise après une pause).
const ADJUST_EVERY = 15, RESYNC_TICKS = 15;

const axisOf = commands => commands.findLast(c => c.type === 'Move')?.axis;

/** Côté invité : faut-il envoyer ce pas ? */
export class InputSender {
  constructor({ heartbeat = HEARTBEAT_TICKS } = {}) { this.heartbeat = heartbeat; this.reset(); }
  reset() { this.lastSeq = -Infinity; this.lastAxis = null; }
  /** `commands` : commandes sortantes du pas (avec un Move). */
  shouldSend(seq, commands) {
    const axis = axisOf(commands) ?? 0;
    const send = axis !== this.lastAxis || commands.some(c => c.type !== 'Move') || seq - this.lastSeq >= this.heartbeat;
    if (send) { this.lastSeq = seq; this.lastAxis = axis; }
    return send;
  }
}

/** Côté hôte : la ligne du temps d'un joueur distant. */
export class InputTimeline {
  /**
   * `rollback` : true en Débat (l'hôte peut recalculer), false en Campagne.
   * `keep` : nombre de ticks gardés pour un éventuel retour en arrière.
   */
  constructor({ rollback = false, keep = 30, now = () => performance.now() } = {}) {
    Object.assign(this, { rollback, keep, now });
    this.frames = new Map(); this.known = 0; this.lastSeq = 0; this.offset = null;
    this.samples = []; this.sinceAdjust = 0; this.lastHeard = -Infinity; this.ranges = new Map(); this.latePending = [];
  }
  /** Dernier pas de l'invité pris en compte par l'hôte. */
  get ack() { return this.offset === null ? null : this.lastSeq; }
  idle() { return this.now() - this.lastHeard > IDLE_MS; }

  /**
   * Un message de l'invité, reçu alors que l'hôte a déjà simulé `hostTick`.
   * Renvoie le tick depuis lequel recalculer (mode retour en arrière), sinon null.
   */
  receive(seq, commands, hostTick) {
    if (!Number.isInteger(seq) || seq <= this.known) return null;
    const axis = axisOf(commands), actions = commands.filter(c => c.type !== 'Move');
    const guessed = this.axisAt(seq - 1);
    this.frames.set(seq, { axis: axis ?? guessed, actions });
    this.known = seq; this.lastHeard = this.now();
    this.samples.push(hostTick - seq);
    if (this.samples.length > SAMPLES) this.samples.shift();
    // Premier message (ou retour après une absence) : la ligne du temps repart de ce pas.
    if (this.offset === null) { this.offset = this.desiredOffset(); this.lastSeq = seq - 1; }
    // Pas déjà dépassé par l'hôte : il avait supposé « même direction, rien de neuf ».
    if (seq > this.lastSeq) return null;
    if (!actions.length && (axis === undefined || axis === guessed)) return null;
    const tick = this.tickOf(seq);
    if (this.rollback && tick !== null) return tick;
    this.latePending.push(...actions);
    return null;
  }

  /** Commandes du joueur distant pour le tick `tick` (null s'il est absent). */
  commandsFor(tick) {
    if (this.offset !== null && this.idle()) { this.offset = null; this.samples = []; this.ranges.clear(); this.latePending = []; }
    if (this.offset === null) return null;
    if (++this.sinceAdjust >= ADJUST_EVERY) this.adjust();
    const lo = this.lastSeq, hi = Math.max(lo, tick - this.offset);
    const range = { lo, hi, late: this.latePending.splice(0) };
    this.ranges.set(tick, range); this.lastSeq = hi;
    this.prune(tick);
    return this.commandsOf(range);
  }
  /** Mêmes commandes, recalculées avec les pas arrivés depuis (retour en arrière). */
  replayCommands(tick) {
    const range = this.ranges.get(tick);
    return range ? this.commandsOf(range) : null;
  }

  commandsOf({ lo, hi, late }) {
    const actions = [...late];
    for (let seq = lo + 1; seq <= hi; seq++) actions.push(...(this.frames.get(seq)?.actions || []));
    return [{ type: 'Move', axis: this.axisAt(hi) }, ...actions];
  }
  /** Direction du dernier pas connu jusqu'à `seq` (au-delà de ce qui est reçu : on suppose qu'elle continue). */
  axisAt(seq) {
    for (let s = Math.min(seq, this.known); s > this.known - 400 && s > 0; s--) {
      const frame = this.frames.get(s);
      if (frame?.axis !== undefined) return frame.axis;
    }
    return 0;
  }
  tickOf(seq) {
    for (const [tick, range] of this.ranges) if (range && range.lo < seq && seq <= range.hi) return tick;
    return null;
  }
  /** Décalage visé entre les numéros de l'invité et les ticks de l'hôte. */
  desiredOffset() {
    const sorted = [...this.samples].sort((a, b) => a - b);
    // Retour en arrière : un message sur deux arrive à temps, les plus lents sont rejoués. Caler sur
    // les plus rapides obligerait l'hôte à trop deviner ; caler sur les plus lents retarderait tout.
    if (this.rollback) return sorted[Math.floor(sorted.length / 2)] + 1;
    // Avance : 9 messages sur 10 arrivent au moins un tick avant d'être appliqués.
    return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.9))] + 1;
  }
  adjust() {
    this.sinceAdjust = 0;
    const gap = this.desiredOffset() - this.offset;
    if (Math.abs(gap) > RESYNC_TICKS) this.offset += gap;
    else if (gap >= 1) this.offset++;
    else if (gap <= -1) this.offset--;
  }
  prune(tick) {
    for (const t of this.ranges.keys()) if (t <= tick - this.keep) this.ranges.delete(t);
    const oldest = Math.min(...[...this.ranges.values()].map(r => r.lo), this.lastSeq);
    // On garde aussi le dernier pas plus ancien : il donne la direction en cours.
    const anchor = Math.max(0, ...[...this.frames.keys()].filter(seq => seq <= oldest));
    for (const seq of this.frames.keys()) if (seq < anchor) this.frames.delete(seq);
  }
}
