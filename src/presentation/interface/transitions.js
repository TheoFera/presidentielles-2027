/**
 * Transitions entre les « scènes » de la campagne : la carte, un débat, l’écran des résultats.
 * Un rideau sombre (#phase-fade) cache le changement de décor ; « Place au vote… » annonce les résultats.
 * Logique pure, avancée par la boucle de jeu avec le temps écoulé : testable sans navigateur.
 */

/** Scène que l’état demande d’afficher. */
export function campaignScene(state) {
  if (['FIRST_ROUND_RESULTS', 'RESULTS'].includes(state.phase)) return 'results';
  if (state.phase === 'FIRST_ROUND_DEBATE') return 'debate';
  const debate = state.campaign_events?.find(e => e.status === 'ACTIVE' && e.debate && e.participants.includes(state.local_candidate_id));
  return debate ? `debate:${debate.id}` : 'map';
}

export class SceneTransitions {
  /** `settings` : durées en secondes (prototype_config.json → presentation.transitions). */
  constructor(settings) { this.settings = settings; this.reset(); }
  /** Nouvelle partie : la première scène vue s’affiche sans transition. */
  reset() { this.scene = null; this.target = null; this.steps = []; this.curtain = 0; }
  /** Étapes pour passer de la scène affichée à `next`. « swap » : moment où le décor change. */
  plan(next, solo) {
    const s = this.settings;
    if (next === 'results') return [{ kind: 'vote', seconds: s.vote_seconds }, { kind: 'swap' }];
    // L’écran des résultats est opaque : le rideau est déjà « fermé », il ne reste qu’à l’ouvrir.
    if (this.scene === 'results') return [{ kind: 'swap', curtain: 1 }, { kind: 'reveal', seconds: s.reveal_seconds }];
    // Fin d’un débat : l’image se fige un instant sur le coup décisif (en solo, la partie attend).
    const hold = solo && this.scene?.startsWith('debate') ? [{ kind: 'hold', seconds: s.debate_hold_seconds }] : [];
    return [...hold, { kind: 'cover', seconds: s.cover_seconds }, { kind: 'swap' }, { kind: 'reveal', seconds: s.reveal_seconds }];
  }
  /**
   * Avance d’une image et dit à la boucle quoi faire :
   * - draw : redessiner la carte (non pendant que le rideau se ferme, ni derrière les résultats) ;
   * - freeze : arrêter la simulation (solo seulement : en multijoueur, la partie ne s’arrête pas) ;
   * - swap : le décor vient de changer (recadrer la caméra) ;
   * - curtain : opacité du rideau, de 0 à 1 ; vote : « Place au vote… » à l’écran ;
   * - results : l’écran des résultats peut s’ouvrir.
   */
  update(next, elapsed, { solo = true, instant = false } = {}) {
    if (this.scene === null) { this.scene = this.target = next; this.steps = []; this.curtain = 0; }
    if (next !== this.target) {
      const changing = this.steps.some(step => step.kind === 'swap');
      // Décor pas encore changé : on vise simplement la nouvelle scène (sauf l’annonce du vote, à garder).
      if (!changing || next === 'results') this.steps = instant ? [{ kind: 'swap' }] : this.plan(next, solo);
      this.target = next;
    }
    let swap = false, time = elapsed;
    while (this.steps.length) {
      const step = this.steps[0];
      if (step.kind === 'swap') {
        this.scene = this.target; swap = true; this.steps.shift();
        if (step.curtain != null) this.curtain = step.curtain;
        continue;
      }
      step.time = (step.time ?? 0) + time;
      const progress = step.seconds > 0 ? Math.min(1, step.time / step.seconds) : 1;
      if (step.kind === 'cover') this.curtain = Math.max(this.curtain, progress);
      if (step.kind === 'reveal') this.curtain = Math.min(this.curtain, 1 - progress);
      if (progress < 1) break;
      time = step.time - step.seconds; this.steps.shift();
    }
    if (!this.steps.length && this.scene === this.target && this.scene !== 'results') this.curtain = 0;
    const changing = this.steps.some(step => step.kind === 'swap');
    return {
      draw: !changing && this.scene !== 'results', freeze: solo && changing, swap,
      curtain: this.curtain, vote: this.steps[0]?.kind === 'vote', results: this.scene === 'results',
    };
  }
}
