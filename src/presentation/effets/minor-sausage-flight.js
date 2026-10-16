const clamp = value => Math.max(0, Math.min(1, value));
const smooth = value => { const t = clamp(value); return t * t * (3 - 2 * t); };
export const SAUSAGE_SIZE = .32;
export const SAUSAGE_HELD_ANGLE = .1;

/** Raccords aux mains en pixels, sans déplacer la zone de collision du projectile. */
export function sausageFlightPose(power, tick, hz, balance, geometry) {
  const { x, y, release, releaseOrigin, catchHand, ownerOrigin, distance, turnDistance } = geometry;
  let px = x, py = y;
  if (!power.returning) {
    const progress = clamp((power.travelled - balance.release_offset) / (balance.range - balance.release_offset));
    px += (release.x - releaseOrigin.x) * (1 - progress);
    py += (release.y - releaseOrigin.y) * (1 - progress);
  } else {
    const progress = clamp(1 - distance / Math.max(.001, turnDistance));
    px += (catchHand.x - ownerOrigin.x) * progress;
    py += (catchHand.y - ownerOrigin.y) * progress;
  }
  const direction = power.direction, held = SAUSAGE_HELD_ANGLE * direction;
  let angle = held + Math.max(0, tick - power.launch_tick) / hz * 12 * direction;
  if (power.catch_started_tick != null) {
    const start = held + (power.catch_started_tick - power.launch_tick) / hz * 12 * direction;
    const end = held + direction * Math.ceil((start - held) * direction / (2 * Math.PI)) * 2 * Math.PI;
    angle = start + (end - start) * smooth(1 - distance / Math.max(.001, power.catch_start_distance));
  }
  return { x: px, y: py, angle };
}
