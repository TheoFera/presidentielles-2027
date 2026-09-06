import { random } from './world.js';

export function spawnIntervalBoundsTicks(simulation, zone, socialPoint = null) {
  const growth = simulation.config.layout.neutral_population_growth;
  const missingPopulation = Math.max(1, zone.max_npcs_by_origin - zone.initial_neutral_count);
  const socialPoints = simulation.state.world.socialPoints.filter(point => point.subzone_id === zone.id);
  const socialPointCount = Math.max(1, socialPoints.length);
  const pointIndex = Math.max(0, socialPoints.findIndex(point => point.id === socialPoint?.id));
  const spawnQuota = Math.floor(missingPopulation / socialPointCount) + (pointIndex < missingPopulation % socialPointCount ? 1 : 0);
  const campaignDays = Math.max(1, simulation.config.balance.time.starting_days_before_first_round - growth.target_days_before_first_round);
  const campaignTicks = campaignDays * simulation.secondsToTicks(simulation.config.balance.time.real_seconds_per_game_day);
  const baseTicks = spawnQuota > 0 ? Math.max(1, Math.floor(campaignTicks / spawnQuota)) : campaignTicks + 1;
  return {
    min: Math.max(1, Math.floor(baseTicks * growth.interval_randomness.min_factor)),
    max: Math.max(1, Math.floor(baseTicks * growth.interval_randomness.max_factor)),
  };
}

export function spawnIntervalTicks(simulation, zone, socialPoint = null) {
  const { min, max } = spawnIntervalBoundsTicks(simulation, zone, socialPoint);
  return min + Math.floor(random(simulation.state) * (max - min + 1));
}

export function createSpawnTimers(simulation) {
  return simulation.state.world.socialPoints.map(point => {
    const zone = simulation.state.world.subzones.find(z => z.id === point.subzone_id);
    return { social_point_id: point.id, subzone_id: zone.id, elapsed_ticks: 0, interval_ticks: spawnIntervalTicks(simulation, zone, point), skipped_count: 0 };
  });
}

export function updateSpawns(simulation) {
  const { state } = simulation;
  if (!simulation.config.layout.neutral_population_growth.enabled) return;
  for (const timer of state.spawn_timers) {
    timer.elapsed_ticks++;
    if (timer.elapsed_ticks < timer.interval_ticks) continue;
    const zone = state.world.subzones.find(z => z.id === timer.subzone_id);
    const point = state.world.socialPoints.find(p => p.id === timer.social_point_id);
    if (!simulation.spawn(zone, undefined, true, point)) timer.skipped_count++;
    // A full camp never banks missed spawns. There is a new seeded delay every attempt.
    timer.elapsed_ticks = 0;
    timer.interval_ticks = spawnIntervalTicks(simulation, zone, point);
  }
}
