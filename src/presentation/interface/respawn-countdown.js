// Campagne : quand le candidat du joueur est K.-O., le monde passe en gris et un grand
// décompte (même style que le « 3, 2, 1 » du mode Débat) indique le temps avant le retour
// à la permanence. Le HUD garde ses couleurs : seul le décor est teinté.

/** Secondes entières restantes avant la réapparition, ou null si le candidat n'attend pas. */
export function respawnSecondsLeft(state, candidate, hz) {
  if (!candidate?.is_ko || candidate.minor || candidate.eliminated || candidate.campaign_debate_id || !['CAMPAIGN', 'SECOND_ROUND_SPRINT'].includes(state.phase)) return null;
  if (!(candidate.respawn_tick >= 0)) return null;
  return Math.max(1, Math.ceil((candidate.respawn_tick - state.tick) / hz));
}

export class RespawnCountdown {
  constructor(game, world, hz) {
    this.world = world; this.hz = hz; this.shown = null;
    this.root = document.createElement('div'); this.root.id = 'respawn-countdown'; this.root.hidden = true; this.root.setAttribute('role', 'status');
    this.root.innerHTML = '<span class="respawn-label">Retour à la permanence</span><strong class="respawn-digit"></strong>';
    this.digit = this.root.querySelector('.respawn-digit');
    game.insertBefore(this.root, world.nextSibling);
  }
  /** `hidden` : pause, résultats, choix du style… le décompte et le gris s'effacent. */
  update(state, candidate, hidden = false) {
    const seconds = hidden ? null : respawnSecondsLeft(state, candidate, this.hz);
    if (seconds === this.shown) return;
    this.shown = seconds;
    this.world.classList.toggle('is-knocked-out', seconds !== null);
    this.root.hidden = seconds === null;
    if (seconds === null) return;
    this.digit.textContent = String(seconds);
    // Chaque chiffre claque, comme le compte à rebours du débat.
    this.digit.getAnimations().forEach(a => a.cancel());
    if (!matchMedia('(prefers-reduced-motion: reduce)').matches) this.digit.animate([{ transform: 'scale(1.8)', opacity: 0 }, { transform: 'scale(1)', opacity: 1 }], { duration: 260, easing: 'cubic-bezier(.2,1.4,.4,1)' });
  }
}
