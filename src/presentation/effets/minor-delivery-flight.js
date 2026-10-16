const ticks = (seconds, hz) => Math.ceil(seconds * hz - 1e-9);
const launchTick = (drop, hz, balance) => drop.launch_tick ?? drop.tick - ticks(balance.warning_seconds, hz);

export const DELIVERY_SIZES = Object.freeze({ plane: 2.15, missile: .46 });

/** Une seule courbe de passage : le nez suit réellement le déplacement, sans angle plafonné. */
export function deliveryPlanePose(power, tick, hz, balance, metrics, screenX) {
  const first = launchTick(power.impacts[0], hz, balance), last = launchTick(power.impacts.at(-1), hz, balance);
  const start = power.started_tick + ticks(balance.call_seconds, hz), end = last + ticks(balance.exit_seconds, hz);
  const h = metrics.characterHeight, width = h * DELIVERY_SIZES.plane;
  const ground = metrics.groundY + h * (metrics.groundOffsetRatio ?? .06);
  const altitude = Math.max(h * .3, ground * .35), offscreen = -width * .65;
  const midpoint = (start + end) / 2, duration = (end - start) / (2 * hz);
  const curvature = (altitude - offscreen) / (duration * duration);
  const interval = (launchTick(power.impacts[1], hz, balance) - first) / hz;
  // Vitesse horizontale constante ; la courbe reste peu inclinée par sa géométrie.
  const speed = Math.max(balance.spacing * metrics.pixelsPerUnit / interval, 2 * curvature * duration / Math.tan(.52));
  const flightSeconds = (power.impacts[0].tick - first) / hz;
  const firingX = screenX(power.impacts[0].x) - power.direction * Math.max(h * 1.2, speed * flightSeconds * .65);
  const time = (tick - midpoint) / hz;
  const x = firingX + power.direction * speed * (tick - first) / hz, y = altitude - curvature * time * time;
  const velocity = { x: power.direction * speed, y: -2 * curvature * time };
  return { x, y, width, velocity, angle: power.direction * Math.atan2(velocity.y, speed), visible: tick >= start && tick <= end };
}

/** Le missile hérite du cap et de la vitesse du Rafale, puis infléchit sa course vers sa zone. */
export function deliveryMissilePose(power, drop, tick, hz, balance, metrics, screenX) {
  const launch = launchTick(drop, hz, balance);
  const plane = deliveryPlanePose(power, launch, hz, balance, metrics, screenX), h = metrics.characterHeight;
  const forward = { x: power.direction * Math.cos(plane.angle), y: power.direction * Math.sin(plane.angle) };
  const normal = { x: -Math.sin(plane.angle), y: Math.cos(plane.angle) };
  const from = { x: plane.x - forward.x * plane.width * .18 + normal.x * h * .65,
    y: plane.y - forward.y * plane.width * .18 + normal.y * h * .65 };
  const target = { x: screenX(drop.x), y: metrics.groundY + h * (metrics.groundOffsetRatio ?? .06) };
  const progress = Math.max(0, Math.min(1, (tick - launch) / (drop.tick - launch)));
  const duration = (drop.tick - launch) / hz, straight = .3;
  const launchSpeed = Math.hypot(plane.velocity.x, plane.velocity.y) * 1.18;
  const lead = launchSpeed * duration * straight;
  const turn = { x: from.x + forward.x * lead, y: from.y + forward.y * lead };
  let x, y, angle;
  if (progress <= straight) {
    x = from.x + forward.x * lead * progress / straight;
    y = from.y + forward.y * lead * progress / straight;
    angle = Math.atan2(forward.y, forward.x);
  } else {
    // La tangente et la vitesse au raccord prolongent exactement le départ rectiligne.
    const handle = launchSpeed * duration * (1 - straight) / 3;
    const c1 = { x: turn.x + forward.x * handle, y: turn.y + forward.y * handle };
    const c2 = { x: target.x - power.direction * h * .14, y: target.y - h * .65 };
    const t = (progress - straight) / (1 - straight), u = 1 - t;
    const curve = key => u ** 3 * turn[key] + 3 * u * u * t * c1[key] + 3 * u * t * t * c2[key] + t ** 3 * target[key];
    const tangent = key => 3 * u * u * (c1[key] - turn[key]) + 6 * u * t * (c2[key] - c1[key]) + 3 * t * t * (target[key] - c2[key]);
    x = curve('x'); y = curve('y'); angle = Math.atan2(tangent('y'), tangent('x'));
  }
  return { from, target, progress, x, y, angle, visible: tick >= launch && tick < drop.tick };
}
