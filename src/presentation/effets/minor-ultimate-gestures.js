// Même calendrier que les projectiles : le changement de pose coïncide avec le lâcher.
export function minorUltimateGesture(power, tick, hz, balance, distanceToOwner = Infinity) {
  const age = (tick - power.started_tick) / hz;
  if (power.kind === 'DELIVERY' && age < balance.delivery.call_seconds) {
    const phase = age / balance.delivery.call_seconds;
    return { atlas: 'phone', index: phase < .2 ? 1 : phase < .82 ? 2 : 3 };
  }
  const sausage = power.kind === 'SAUSAGE';
  if (!sausage && power.kind !== 'SATCHEL') return null;
  const atlas = sausage ? 'sausageThrow' : 'satchelThrow';
  if (sausage && power.caught_tick != null) {
    const phase = (tick - power.caught_tick) / (hz * balance.sausage.catch_seconds);
    return { atlas, index: phase < .4 ? 6 : 7, held: true };
  }
  if (sausage && power.returning && distanceToOwner < balance.sausage.speed * .2) return { atlas, index: 5 };
  const release = power.launch_tick ?? power.started_tick;
  if (tick < release) return { atlas, index: tick < (release + power.started_tick) / 2 ? 1 : 2, held: true };
  const sinceRelease = (tick - release) / hz;
  if (sinceRelease < .12) return { atlas, index: 3 };
  if (sinceRelease < .24) return { atlas, index: 4 };
  if (!sausage && sinceRelease < .36) return { atlas, index: 5 };
  return null;
}

// Le mur garde sa longueur, y compris à mi-bascule. L'apparition le révèle par découpe.
export function minorBarrierPose(power, tick, hz, balance, characterHeight) {
  return {
    height: balance.height * characterHeight,
    reveal: Math.min(1, Math.max(0, (tick - power.started_tick) / (hz * .2))),
    progress: Math.min(1, Math.max(0, (tick - power.fall_tick) / (hz * balance.fall_seconds))),
  };
}
