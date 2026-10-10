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
    // Hors combat (compte à rebours, fin de round), rien à prédire : l'affichage suit l'hôte.
    if (state?.phase !== 'FIGHT' || !Number.isInteger(ack)) { this.state = this.previous = null; this.offsets.clear(); return; }
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
 */
export class DebateHost {
  constructor(match, { localId, remoteIds, keep = 12, now } = {}) {
    this.match = match; this.localId = localId; this.keep = keep;
    this.timelines = new Map([...remoteIds].map(id => [id, new InputTimeline({ rollback: true, keep: keep + 4, now })]));
    // Numéro de pas propre à l'hôte : le tick du débat s'arrête parfois (fin de match, nouveau round).
    this.frame = 0; this.version = 0; this.rolledBack = false;
    this.history = new Map([[0, match.getState()]]); this.localLog = new Map();
    this.offsets = new Map(); this.smooth = SMOOTH_SECONDS;
  }
  /** Un pas : `localCommands`, les commandes du joueur de l'hôte. */
  step(localCommands) {
    const frame = ++this.frame;
    this.localLog.set(frame, localCommands);
    this.match.step(this.commandsAt(frame, localCommands, false));
    this.history.set(frame, this.match.getState());
    this.version++;
    this.history.delete(frame - this.keep - 1); this.localLog.delete(frame - this.keep - 1);
  }
  /** Un message d'invité (`id` : son combattant). Recalcule si son pas arrive en retard. */
  receive(id, seq, commands) {
    const from = this.timelines.get(id)?.receive(seq, commands, this.frame);
    if (from != null) this.rollback(from);
  }
  rollback(from) {
    const base = this.history.get(from - 1);
    if (!base || from > this.frame) return;
    const before = new Map(this.match.state.candidates.map(c => [c.id, c]));
    this.match.state = clone(base); this.match.copy = base;
    for (let frame = from; frame <= this.frame; frame++) {
      this.match.step(this.commandsAt(frame, this.localLog.get(frame) || [], true));
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
