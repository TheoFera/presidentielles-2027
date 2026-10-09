/**
 * Rythme d'affichage régulier pour l'application Android.
 * Sur un écran à 120 Hz, le jeu n'arrive pas toujours à dessiner une image toutes les 8,3 ms :
 * ses images tombaient alors tantôt après 8 ms, tantôt après 16 ou 25 ms, et ce rythme irrégulier
 * se voyait comme des saccades. Chrome évite ce problème parce que le téléphone le cale sur 60 Hz ;
 * une appli ne peut pas l'imposer (certains téléphones, dont Xiaomi, ignorent sa demande).
 * Le jeu ne dessine donc qu'une image sur deux à 100 Hz et plus : 60 images par seconde, à intervalles
 * égaux, avec 16,7 ms pour chacune. À 60 ou 90 Hz, toutes les images sont dessinées, comme avant.
 */
export class FramePacer {
  constructor({ target = 60, samples = 40 } = {}) {
    this.target = target;
    this.samples = samples;
    this.intervals = [];
    this.last = null;
    this.lastDrawn = -Infinity;
  }

  /** Durée d'un rafraîchissement de l'écran (ms), ou 0 tant qu'elle n'est pas connue. */
  refreshInterval() {
    if (this.intervals.length < 10) return 0;
    // Un rafraîchissement est la durée la plus courte observée régulièrement : une image lourde
    // allonge certains écarts, jamais ne les raccourcit.
    const sorted = [...this.intervals].sort((a, b) => a - b);
    return sorted[Math.floor(sorted.length * 0.2)];
  }

  /** Vrai si l'image de cet appel à requestAnimationFrame doit être calculée et dessinée. */
  shouldDraw(now) {
    if (this.last !== null) {
      const interval = now - this.last;
      if (interval > 2 && interval < 40) {
        this.intervals.push(interval);
        if (this.intervals.length > this.samples) this.intervals.shift();
      }
    }
    this.last = now;
    const refresh = this.refreshInterval();
    // Nombre de rafraîchissements par image : 2 à 120 ou 144 Hz, 1 à 60 ou 90 Hz.
    const step = refresh ? Math.max(1, Math.floor(1000 / this.target / refresh + 0.1)) : 1;
    // Demi-rafraîchissement de marge : un léger retard de l'appel ne fait pas sauter une image de plus.
    if (step === 1 || now - this.lastDrawn >= refresh * (step - 0.5)) {
      this.lastDrawn = now;
      return true;
    }
    return false;
  }
}
