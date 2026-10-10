import { movementBlocked } from '../simulation/combat-state.js';
import { candidateTravelSpeed } from '../simulation/vehicles.js';
import { ringDelta, wrap } from '../simulation/world.js';

/**
 * Prédiction de la Campagne chez un invité : seulement le déplacement de son propre candidat.
 *
 * Recalculer toute la campagne (centaines de passants, bâtiments, électeurs) à chaque état reçu
 * serait trop lourd pour un téléphone. Le déplacement suffit pour le ressenti : l'invité voit son
 * candidat partir dès l'appui, au lieu d'attendre l'aller-retour jusqu'à l'hôte. Le reste (coups,
 * passants, autres candidats) suit l'hôte, avec le léger retard du tampon d'affichage.
 *
 * Même principe qu'en Débat : pas numérotés, dernier pas appliqué renvoyé par l'hôte
 * (`input_acks`), pas suivants rejoués, petits écarts effacés en douceur.
 */

// Au-delà, c'est un vrai saut (téléportation, K.O.) : pas de lissage.
const SNAP_UNITS = 3;
const MAX_HISTORY = 90;
const MOVING_PHASES = new Set(['CAMPAIGN', 'SECOND_ROUND_SPRINT']);

export class CampaignPrediction {
  constructor(config, localId) {
    this.config = config; this.localId = localId; this.hz = config.balance.simulation_architecture.fixed_tick_hz;
    this.seq = 0; this.history = []; this.base = null; this.offset = 0; this.smooth = 0.08;
    this.x = null; this.previousX = null; this.axis = 0;
  }
  get active() { return this.x !== null; }

  /** Un pas de l'invité : numéroté, gardé jusqu'à ce que l'hôte l'applique, et joué aussitôt. */
  step(commands) {
    const seq = ++this.seq, axis = commands.findLast(c => c.type === 'Move')?.axis ?? 0;
    this.history.push({ seq, axis });
    if (this.history.length > MAX_HISTORY) this.history.shift();
    if (this.x !== null) { this.previousX = this.x; this.x = this.move(this.x, axis); this.axis = axis; }
    return seq;
  }

  /** Nouvel état de l'hôte : position de notre candidat, puis nos pas qu'il n'a pas encore appliqués. */
  authoritative(state) {
    const ack = state?.input_acks?.[this.localId];
    if (Number.isInteger(ack)) this.history = this.history.filter(h => h.seq > ack);
    const c = state?.candidates?.find(candidate => candidate.id === this.localId);
    const shown = this.x === null ? null : this.displayX(1);
    this.base = { state, candidate: c };
    if (!c || !Number.isInteger(ack) || !this.canMove(state, c)) { this.x = this.previousX = null; this.offset = 0; return; }
    let x = c.x, previous = x;
    for (const { axis } of this.history) { previous = x; x = this.move(x, axis); }
    this.previousX = previous; this.x = x; this.axis = this.history.at(-1)?.axis ?? c.axis ?? 0;
    // L'écart avec ce qui était affiché s'efface peu à peu.
    if (shown !== null) {
      const gap = ringDelta(x, shown, this.length);
      this.offset = Math.abs(gap) > SNAP_UNITS ? 0 : gap;
    }
  }

  decay(seconds) { this.offset *= Math.exp(-Math.max(0, seconds) / this.smooth); if (Math.abs(this.offset) < 1e-3) this.offset = 0; }

  /** Position à afficher, entre le pas précédent et le pas courant (`alpha` de l'horloge locale). */
  displayX(alpha) {
    const t = Math.max(0, Math.min(1, alpha));
    return wrap(this.previousX + ringDelta(this.previousX, this.x, this.length) * t + this.offset, this.length);
  }

  /** Remplace notre candidat dans les états affichés (même objet avant et après : pas de double lissage). */
  apply(shown, previous, alpha) {
    if (!this.active) return { shown, previous };
    const x = this.displayX(alpha), axis = this.axis;
    const swap = state => state && { ...state, candidates: state.candidates.map(c => c.id !== this.localId ? c
      : { ...c, x, moving: axis !== 0, facing: axis || c.facing }) };
    const local = swap(shown);
    return { shown: local, previous: previous && { ...previous, candidates: previous.candidates.map(c => c.id === this.localId ? local.candidates.find(o => o.id === c.id) ?? c : c) } };
  }

  get length() { return this.base?.state?.world?.length || 1; }
  canMove(state, c) {
    return MOVING_PHASES.has(state.phase) && !c.eliminated && !c.is_ko && !c.campaign_debate_id && !movementBlocked(c);
  }
  move(x, axis) {
    const c = this.base?.candidate;
    if (!c || !axis) return x;
    return wrap(x + axis * candidateTravelSpeed(this.config, c) / this.hz, this.length);
  }
}
