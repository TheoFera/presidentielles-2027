import { DebateMatch, debateFighterIds, debateModeAICommands } from '../simulation/debate-mode.js';
import { InputTimeline } from './input-timeline.js';

/**
 * Prédiction du débat chez un invité.
 *
 * Sans elle, l'invité voit ses propres gestes après un aller-retour complet jusqu'à l'hôte.
 * Avec elle, son téléphone fait avancer lui-même le combat à partir du dernier état reçu de
 * l'hôte, en y rejouant les pas de l'invité que l'hôte n'a pas encore appliqués : ses gestes
 * s'affichent tout de suite. L'hôte reste l'arbitre : chaque nouvel état reçu recale la
 * prédiction, et l'écart éventuel est effacé en douceur.
 *
 * Chaque pas de l'invité porte un numéro (`seq`). L'hôte les range sur sa ligne du temps (voir
 * input-timeline.js et DebateHost) et renvoie dans chaque état le dernier numéro appliqué (`input_acks`).
 */

const clone = value => JSON.parse(JSON.stringify(value));
// Au-delà de cet écart (unités de monde), c'est un vrai saut (K.O., nouveau round) : pas de lissage.
const SNAP_UNITS = 3;
// Temps pour effacer environ 63 % d'une correction.
const SMOOTH_SECONDS = 0.08;
// Au-delà, l'hôte ne répond plus : inutile de rejouer plus loin.
const MAX_HISTORY = 90;
// Champs pris dans le combat prédit ; le reste (phase, rounds, événements sonores) vient de l'hôte.
const PREDICTED = ['tick', 'candidates', 'attacks', 'projectiles', 'powers', 'temporary_units', 'hit_results'];

export class DebatePrediction {
  /** `match` : le DebateMatch préparé par l'invité (il fournit les règles, pas l'état). */
  constructor(match, localId) {
    this.match = match; this.localId = localId;
    // Combattants joués par l'ordinateur : leurs décisions sont recalculées ici à l'identique.
    const ids = debateFighterIds(match.setup.fighters);
    this.aiIds = new Set(ids.filter((id, i) => !match.setup.fighters[i].player));
    this.seq = 0; this.history = []; this.base = null; this.state = null; this.previous = null;
    this.offsets = new Map(); this.smooth = SMOOTH_SECONDS;
  }
  get active() { return this.state !== null; }

  /** Un pas de l'invité : il est numéroté, gardé jusqu'à ce que l'hôte l'applique, et joué aussitôt. */
  step(commands) {
    const seq = ++this.seq;
    this.history.push({ seq, commands });
    if (this.history.length > MAX_HISTORY) this.history.shift();
    this.newEvents = [];
    if (this.state) {
      this.previous = this.state; this.state = clone(this.state);
      const first = this.state.next_event_id;
      this.run(this.state, commands);
      // Événements de ce pas (pour jouer tout de suite les sons de nos gestes).
      this.newEvents = this.state.events.filter(e => Number(String(e.id).slice(6)) >= first);
    }
    return seq;
  }

  /** Nouvel état de l'hôte : on repart de lui et on rejoue les pas qu'il n'a pas encore appliqués. */
  authoritative(state) {
    this.base = state;
    const ack = state?.input_acks?.[this.localId];
    if (Number.isInteger(ack)) this.history = this.history.filter(h => h.seq > ack);
    // Hors combat (compte à rebours, fin de round) ou combat en attente d'un joueur : rien à prédire.
    if (state?.phase !== 'FIGHT' || state.sync_wait || !Number.isInteger(ack)) { this.state = this.previous = null; this.offsets.clear(); return; }
    const shown = this.state ? this.view().state : null;
    // Une seule copie de travail ; l'état d'avant le dernier pas est gardé pour le lissage.
    let current = clone(state), previous = current;
    // Graine du hasard de l'ordinateur : l'hôte l'envoie à part (`ai_seed`), elle ne change pas pendant un débat.
    current.rng_state = state.ai_seed ?? current.rng_state ?? 1;
    this.history.forEach(({ commands }, i) => {
      if (i === this.history.length - 1) { previous = current; current = clone(current); }
      this.run(current, commands);
    });
    this.previous = previous; this.state = current;
    // L'écart entre ce qui était affiché et la nouvelle prédiction est gardé, puis effacé peu à peu.
    if (!shown) return;
    for (const c of current.candidates) {
      const old = shown.candidates.find(o => o.id === c.id);
      if (!old) { this.offsets.delete(c.id); continue; }
      const x = old.x - c.x, height = (old.combat?.height ?? 0) - (c.combat?.height ?? 0);
      this.offsets.set(c.id, Math.abs(x) > SNAP_UNITS || Math.abs(height) > SNAP_UNITS ? { x: 0, height: 0 } : { x, height });
    }
  }

  /** À chaque image : les corrections s'estompent. */
  decay(seconds) { decayOffsets(this.offsets, seconds, this.smooth); }

  /** États à afficher (précédent et courant, pour le lissage entre deux pas). */
  view() {
    const compose = state => {
      const shown = { ...this.base, local_candidate_id: this.localId };
      for (const key of PREDICTED) shown[key] = state[key];
      if (this.offsets.size) shown.candidates = withOffsets(state.candidates, this.offsets);
      return shown;
    };
    return { previous: compose(this.previous), state: compose(this.state) };
  }

  /** Un pas du combat : nos commandes, les décisions de l'ordinateur, et pour les autres joueurs leur dernière direction. */
  run(state, commands) {
    const runner = Object.assign(Object.create(DebateMatch.prototype), {
      config: this.match.config, baseConfig: this.match.baseConfig, setup: this.match.setup, hz: this.match.hz, state,
    });
    const others = state.candidates.filter(c => c.id !== this.localId).flatMap(c => this.aiIds.has(c.id)
      ? debateModeAICommands(state, this.match.baseConfig, c.id)
      : [{ type: 'Move', candidateId: c.id, axis: c.axis ?? 0 }]);
    runner.step([...others, ...commands.map(command => ({ ...command, candidateId: this.localId }))]);
  }
}

/**
 * Débat chez l'hôte en multijoueur : il fait avancer le combat avec ses propres commandes, celles
 * de l'ordinateur et les pas numérotés des invités (voir input-timeline.js). Quand un pas d'invité
 * est retardé par un à-coup du réseau, l'hôte revient au tick où il aurait dû être joué et recalcule
 * jusqu'au présent (« retour en arrière ») : pas de file d'attente qui s'allonge, pas de pas
 * fusionnés, et la prédiction de l'invité reste juste. Recalculer quelques pas de débat ne coûte
 * qu'une fraction de milliseconde.
 *
 * Attente des joueurs : chaque invité indique le dernier pas de l'hôte qu'il a reçu (`seen`). Si un
 * invité ne donne plus de nouvelles ou prend trop de retard, l'hôte met le combat en attente pour
 * tout le monde (`waiting`, envoyé comme `sync_wait`) et reprend quand chacun est de nouveau à jour.
 * Un nouveau round ne démarre pas tant que chaque invité n'a pas reçu son compte à rebours.
 */
// Mise en attente : plus de nouvelles depuis 0,7 s (l'invité en envoie au moins 5 par seconde), ou un
// aller-retour (envoi d'un état par l'hôte → message de l'invité qui en accuse réception) au-delà de
// 0,8 s ET 0,5 s plus long que d'habitude pour ce joueur : on attend la fin d'un à-coup, mais une
// connexion lente en permanence ne bloque pas le combat.
const WAIT_SILENCE_MS = 700, WAIT_LAG_FRAMES = 24, WAIT_EXTRA_FRAMES = 15;
// Reprise : nouvelles depuis moins de 0,4 s et aller-retour revenu près de l'habitude, pendant 10 pas.
const RESUME_SILENCE_MS = 400, RESUME_LAG_FRAMES = 12, RESUME_EXTRA_FRAMES = 6, RESUME_FRAMES = 10;

export class DebateHost {
  constructor(match, { localId, remoteIds, keep = 12, now } = {}) {
    this.match = match; this.localId = localId; this.keep = keep;
    this.timelines = new Map([...remoteIds].map(id => [id, new InputTimeline({ rollback: true, keep: keep + 4, now })]));
    // Numéro de pas propre à l'hôte : le tick du débat s'arrête parfois (fin de match, nouveau round).
    this.frame = 0; this.version = 0; this.rolledBack = false;
    this.history = new Map([[0, match.getState()]]); this.localLog = new Map();
    this.offsets = new Map(); this.smooth = SMOOTH_SECONDS;
    this.seen = new Map(); this.lag = new Map(); this.lags = new Map(); this.waiting = false; this.syncedFor = 0; this.roundFrame = 0; this.lastPhase = match.state.phase;
  }
  /** Un pas : `localCommands`, les commandes du joueur de l'hôte. */
  step(localCommands) {
    const frame = ++this.frame;
    if (this.updateWaiting()) {
      // En attente : le combat ne bouge pas, mais les pas des invités sont consommés (pas de retard à la reprise).
      for (const timeline of this.timelines.values()) timeline.commandsFor(frame);
      this.localLog.set(frame, null);
    } else {
      this.localLog.set(frame, localCommands);
      this.match.step(this.commandsAt(frame, localCommands, false));
    }
    this.afterStep(frame);
    this.version++;
    const old = frame - this.keep - 5;
    this.history.delete(old); this.localLog.delete(old);
  }
  afterStep(frame) {
    this.history.set(frame, this.match.getState());
    const phase = this.match.state.phase;
    if (phase === 'COUNTDOWN' && this.lastPhase !== 'COUNTDOWN') this.roundFrame = frame;
    this.lastPhase = phase;
  }
  /** Un message d'invité (`id` : son combattant ; `seen` : dernier pas de l'hôte qu'il a reçu). */
  receive(id, seq, commands, seen = null) {
    if (!this.timelines.has(id)) return;
    // Aller-retour en pas de l'hôte : de l'envoi de l'état `seen` à ce message qui en accuse réception.
    if (Number.isInteger(seen) && seen >= (this.seen.get(id) ?? 0)) {
      const lag = this.frame - seen;
      this.seen.set(id, seen); this.lag.set(id, lag);
      // Mesures récentes (8 s environ) pour connaître l'aller-retour habituel de ce joueur.
      const list = this.lags.get(id) || []; list.push(lag); if (list.length > 40) list.shift(); this.lags.set(id, list);
    }
    const from = this.timelines.get(id).receive(seq, commands, this.frame);
    if (from != null) this.rollback(from);
  }
  /** Un invité est-il à jour ? `strict` : seuils de reprise, plus exigeants que ceux de mise en attente. */
  inSync(id, strict) {
    const timeline = this.timelines.get(id), silence = timeline.now() - timeline.lastHeard, lag = this.lag.get(id) ?? Infinity;
    // Habituel : le quart le plus rapide des mesures récentes. Un à-coup ne le change pas, une lenteur durable si.
    const list = [...(this.lags.get(id) || [])].sort((a, b) => a - b), usual = list.length ? list[list.length >> 2] : 0;
    return strict ? silence < RESUME_SILENCE_MS && lag < Math.max(RESUME_LAG_FRAMES, usual + RESUME_EXTRA_FRAMES)
      : silence < WAIT_SILENCE_MS && lag < Math.max(WAIT_LAG_FRAMES, usual + WAIT_EXTRA_FRAMES);
  }
  updateWaiting() {
    const ids = [...this.timelines.keys()];
    if (!ids.length) return false;
    // Nouveau round : chaque invité doit avoir reçu le début du compte à rebours.
    const roundGate = this.match.state.phase === 'COUNTDOWN' && ids.some(id => (this.seen.get(id) ?? -1) < this.roundFrame);
    if (this.waiting) {
      this.syncedFor = !roundGate && ids.every(id => this.inSync(id, true)) ? this.syncedFor + 1 : 0;
      if (this.syncedFor >= RESUME_FRAMES) this.waiting = false;
    } else if (roundGate || ids.some(id => !this.inSync(id, false))) { this.waiting = true; this.syncedFor = 0; }
    return this.waiting;
  }
  rollback(from) {
    const base = this.history.get(from - 1);
    if (!base || from > this.frame) return;
    const before = new Map(this.match.state.candidates.map(c => [c.id, c]));
    this.match.state = clone(base); this.match.copy = base;
    for (let frame = from; frame <= this.frame; frame++) {
      // Pas joués pendant une attente : le combat n'avait pas bougé.
      const local = this.localLog.get(frame);
      if (local !== null) this.match.step(this.commandsAt(frame, local || [], true));
      this.history.set(frame, this.match.getState());
    }
    // Les combattants déplacés par le recalcul glissent jusqu'à leur nouvelle place.
    for (const c of this.match.state.candidates) {
      const old = before.get(c.id);
      if (!old || c.id === this.localId) continue;
      const x = old.x - c.x, height = (old.combat?.height ?? 0) - (c.combat?.height ?? 0), offset = this.offsets.get(c.id) || { x: 0, height: 0 };
      if (Math.abs(x) > SNAP_UNITS || Math.abs(height) > SNAP_UNITS) { this.offsets.delete(c.id); continue; }
      this.offsets.set(c.id, { x: offset.x + x, height: offset.height + height });
    }
    this.version++; this.rolledBack = true;
  }
  /** Vrai une fois après un retour en arrière : l'affichage doit relire l'état. */
  consumeRollback() { const value = this.rolledBack; this.rolledBack = false; return value; }
  commandsAt(frame, localCommands, replay) {
    const state = this.match.state;
    return state.candidates.flatMap(c => {
      if (c.id === this.localId) return localCommands.map(command => ({ ...command, candidateId: c.id }));
      const timeline = this.timelines.get(c.id);
      if (!timeline) return debateModeAICommands(state, this.match.baseConfig, c.id);
      const commands = replay ? timeline.replayCommands(frame) : timeline.commandsFor(frame);
      // Sans nouvelles depuis 1 s : son combattant s'arrête.
      if (!commands) return [{ type: 'SetCampaignActive', candidateId: c.id, active: true }, { type: 'Move', candidateId: c.id, axis: 0 }, { type: 'CancelAttack', candidateId: c.id }];
      return [{ type: 'SetCampaignActive', candidateId: c.id, active: true }, ...commands.map(command => ({ ...command, candidateId: c.id }))];
    });
  }
  /** Dernier pas appliqué de chaque invité, envoyé avec l'état. */
  acks() {
    const acks = {};
    for (const [id, timeline] of this.timelines) if (timeline.ack != null) acks[id] = timeline.ack;
    return acks;
  }
  /** À chaque image : les glissements dus aux recalculs s'estompent. */
  decay(seconds) { decayOffsets(this.offsets, seconds, this.smooth); }
  /** État à dessiner chez l'hôte : les combattants recalés glissent au lieu de sauter. */
  display(state) { return this.offsets.size ? { ...state, candidates: withOffsets(state.candidates, this.offsets) } : state; }
}

function decayOffsets(offsets, seconds, smooth) {
  const keep = Math.exp(-Math.max(0, seconds) / smooth);
  for (const [id, offset] of offsets) {
    offset.x *= keep; offset.height *= keep;
    if (Math.abs(offset.x) < 1e-3 && Math.abs(offset.height) < 1e-3) offsets.delete(id);
  }
}
function withOffsets(candidates, offsets) {
  return candidates.map(c => {
    const offset = offsets.get(c.id);
    if (!offset) return c;
    return { ...c, x: c.x + offset.x, combat: c.combat && { ...c.combat, height: (c.combat.height ?? 0) + offset.height } };
  });
}
