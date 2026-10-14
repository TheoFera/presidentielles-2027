// Le rideau est purement visuel : les règles de prise et de fermeture restent immédiates.
export const BUILDING_SHUTTER_SECONDS = 1;

/** 0 = rideau relevé, 1 = rideau abaissé. Les services neutres restent ouverts. */
export function buildingShutterProgress(building, tick, tickHz) {
  if (!building.controls_zone) return 0;
  const target = building.state === 'ACTIVE' ? 0 : 1;
  const transition = building.shutter_transition;
  if (!transition) return target;
  const elapsed = Math.max(0, Math.min(1, (tick - transition.tick) / (BUILDING_SHUTTER_SECONDS * tickHz)));
  const eased = elapsed * elapsed * (3 - 2 * elapsed);
  return transition.from + (target - transition.from) * eased;
}

/** À appeler avant le changement d'état ; une inversion repart de la position actuelle. */
export function prepareBuildingShutterTransition(building, nextState, tick, tickHz) {
  if (!building.controls_zone || (building.state === 'ACTIVE') === (nextState === 'ACTIVE')) return;
  building.shutter_transition = { tick, from: buildingShutterProgress(building, tick, tickHz) };
}
