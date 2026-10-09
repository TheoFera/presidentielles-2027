import { DebateMatch, debateFighterIds, debateModeAICommands } from '../simulation/debate-mode.js';

/**
 * Prédiction du débat chez un invité.
 *
 * Sans elle, l'invité voit ses propres gestes après un aller-retour complet jusqu'à l'hôte.
 * Avec elle, son téléphone fait avancer lui-même le combat à partir du dernier état reçu de
 * l'hôte, en y rejouant les pas de l'invité que l'hôte n'a pas encore appliqués : ses gestes
 * s'affichent tout de suite. L'hôte reste l'arbitre : chaque nouvel état reçu recale la
 * prédiction, et l'écart éventuel est effacé en douceur.
 *
 * Chaque pas de l'invité porte un numéro (`seq`). L'hôte en applique un par pas de simulation
 * (voir RemoteInputQueue) et renvoie dans chaque état le dernier numéro appliqué (`input_acks`).
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
    this.offsets = new Map();
  }
  get active() { return this.state !== null; }

  /** Un pas de l'invité : il est numéroté, gardé jusqu'à ce que l'hôte l'applique, et joué aussitôt. */
  step(commands) {
    const seq = ++this.seq;
    this.history.push({ seq, commands });
    if (this.history.length > MAX_HISTORY) this.history.shift();
    if (this.state) { this.previous = this.state; this.state = clone(this.state); this.run(this.state, commands); }
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
  decay(seconds) {
    const keep = Math.exp(-Math.max(0, seconds) / SMOOTH_SECONDS);
    for (const [id, offset] of this.offsets) {
      offset.x *= keep; offset.height *= keep;
      if (Math.abs(offset.x) < 1e-3 && Math.abs(offset.height) < 1e-3) this.offsets.delete(id);
    }
  }

  /** États à afficher (précédent et courant, pour le lissage entre deux pas). */
  view() {
    const compose = state => {
      const shown = { ...this.base, local_candidate_id: this.localId };
      for (const key of PREDICTED) shown[key] = state[key];
      if (this.offsets.size) shown.candidates = state.candidates.map(c => {
        const offset = this.offsets.get(c.id);
        if (!offset) return c;
        return { ...c, x: c.x + offset.x, combat: c.combat && { ...c.combat, height: (c.combat.height ?? 0) + offset.height } };
      });
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
 * Pas d'un joueur distant chez l'hôte : un pas reçu est appliqué par pas de simulation, comme
 * l'invité l'a prédit. Si le réseau en livre plusieurs d'un coup, ils attendent et passent un
 * par tick : la prédiction reste juste. Une file restée encombrée pendant une seconde (retard
 * installé) se résorbe en fusionnant deux pas à la fois : un pas de déplacement perdu, à peine
 * visible. Au-delà de `maxQueued`, tout est appliqué d'un coup.
 */
export class RemoteInputQueue {
  constructor({ maxQueued = 10, window = 30 } = {}) {
    this.frames = []; this.ack = null; this.maxQueued = maxQueued; this.window = window;
    this.calls = 0; this.lowest = Infinity; this.excess = 0;
  }
  push(seq, commands) {
    if (!Number.isInteger(seq) || (this.ack !== null && seq <= this.ack) || this.frames.some(f => f.seq >= seq)) return;
    this.frames.push({ seq, commands });
    if (this.frames.length > 60) this.frames.shift();
  }
  /** Commandes du prochain pas (vide si rien de neuf : la direction en cours reste appliquée). */
  next() {
    // Plus petite file vue sur la dernière seconde : ce qui en dépasse 1 est du retard installé.
    this.lowest = Math.min(this.lowest, this.frames.length);
    if (++this.calls >= this.window) { this.excess = Math.max(0, this.lowest - 1); this.calls = 0; this.lowest = Infinity; }
    if (!this.frames.length) return [];
    let count = 1;
    // Trop de retard accumulé : tous les pas en attente sont appliqués d'un coup.
    if (this.frames.length > this.maxQueued) count = this.frames.length;
    else if (this.excess > 0 && this.frames.length > 1) { count = 2; this.excess--; }
    const frames = this.frames.splice(0, count);
    this.ack = frames.at(-1).seq;
    const commands = frames.flatMap(f => f.commands);
    // Ordre d'origine gardé ; une seule direction, la dernière.
    const lastMove = commands.findLastIndex(c => c.type === 'Move');
    return commands.filter((c, i) => c.type !== 'Move' || i === lastMove);
  }
}
