import { random } from './world.js';
import { waitingAtPoint } from './territory.js';

export function spawnIntervalTicks(simulation, zone) {
  const { min_factor, max_factor } = zone.spawn_randomness;
  const factor = min_factor + random(simulation.state) * (max_factor - min_factor);
  return simulation.secondsToTicks(zone.mean_spawn_days * simulation.config.balance.time.real_seconds_per_game_day * factor);
}

export function createSpawnTimers(simulation) {
  return simulation.state.world.socialPoints.map(point => {
    const zone = simulation.state.world.subzones.find(z => z.id === point.subzone_id);
    return { social_point_id: point.id, subzone_id: zone.id, elapsed_ticks: 0, interval_ticks: spawnIntervalTicks(simulation, zone), skipped_count: 0 };
  });
}

export function updateSpawns(simulation) {
  const { state } = simulation;
  for (const timer of state.spawn_timers) {
    timer.elapsed_ticks++;
    if (timer.elapsed_ticks < timer.interval_ticks) continue;
    const zone = state.world.subzones.find(z => z.id === timer.subzone_id);
    const point = state.world.socialPoints.find(p => p.id === timer.social_point_id);
    const returning = state.npcs.filter(n => n.role === 'DEMOBILISE' && n.origin_social_point_id === point.id).length;
    if (waitingAtPoint(state, point.id) + returning < zone.max_neutrals_waiting) simulation.spawn(zone, undefined, true, point);
    else timer.skipped_count++;
    // A full camp never banks missed spawns. There is a new seeded delay every attempt.
    timer.elapsed_ticks = 0;
    timer.interval_ticks = spawnIntervalTicks(simulation, zone);
  }
}
