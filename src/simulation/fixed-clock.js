/** Render frames feed elapsed time here. Simulation only ever advances by one fixed tick. */
export class FixedClock {
  constructor(hz) { this.dt = 1 / hz; this.accumulator = 0; }
  advance(seconds, tick) {
    this.accumulator += Math.max(0, seconds);
    let ticks = 0;
    while (this.accumulator + 1e-10 >= this.dt) {
      tick();
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
  get alpha() { return Math.max(0, this.accumulator / this.dt); }
}
