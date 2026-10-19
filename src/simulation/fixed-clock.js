/** Render frames feed elapsed time here. Simulation only ever advances by one fixed tick. */
export class FixedClock {
  constructor(hz) { this.dt = 1 / hz; this.accumulator = 0; }
  /**
   * tick(last) reçoit true pour le dernier pas joué pendant cette image.
   * maxTicks limite les pas d'une même image : le retard restant est joué aux images suivantes.
   * maxBacklog borne ce retard (en secondes) : au-delà, le temps est abandonné, comme avant.
   */
  advance(seconds, tick, { maxTicks = Infinity, maxBacklog = Infinity } = {}) {
    this.accumulator = Math.min(this.accumulator + Math.max(0, seconds), Math.max(maxBacklog, this.accumulator));
    let ticks = 0;
    while (this.accumulator + 1e-10 >= this.dt && ticks < maxTicks) {
      tick(ticks + 1 >= maxTicks || this.accumulator - this.dt + 1e-10 < this.dt);
      this.accumulator = Math.max(0, this.accumulator - this.dt);
      ticks++;
    }
    return ticks;
  }
  /**
   * Joue le pas suivant tout de suite (une touche vient d'être pressée) au lieu d'attendre jusqu'à
   * un pas entier. L'horloge prend un pas d'avance, qu'elle rattrape ensuite ; jamais plus d'un.
   */
  pull(tick) {
    if (this.accumulator < 0) return false;
    tick();
    this.accumulator -= this.dt;
    return true;
  }
  reset() { this.accumulator = 0; }
  // Des pas peuvent rester à jouer (maxTicks) : l'image montre alors le dernier état, sans extrapoler.
  get alpha() { return Math.min(1, Math.max(0, this.accumulator / this.dt)); }
}

/**
 * Rattrapage lissé : après une image lente (nettoyage de la mémoire, carte graphique), jouer tout le
 * retard d'un coup rendait l'image suivante encore plus lente (jusqu'à 8 pas, effet boule de neige).
 * Un pas par image au plus, deux si le retard dépasse trois pas (100 ms) : le jeu rattrape en
 * quelques images. Les pas joués et leur ordre ne changent pas. Accéléré (débogage) : pas de limite.
 */
export function catchUpTicks(clock, seconds, speed = 1) {
  if (speed > 1) return Infinity;
  return (clock.accumulator + Math.max(0, seconds)) / clock.dt >= 3 ? 2 : 1;
}
