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
  reset() { this.accumulator = 0; }
  get alpha() { return this.accumulator / this.dt; }
}
