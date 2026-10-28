// CRS envoyés par le cabinet administratif : ils montent du bas de l'écran jusqu'au bâtiment,
// encadrent l'entrée pendant que le rideau descend, puis redescendent comme l'équipe de reportage.
import { CLOSURE_ARRIVAL_SECONDS, CLOSURE_EXIT_SECONDS } from '../../simulation/closure-squads.js';
import { ringDelta, wrap } from '../../simulation/world.js';
import { entryPath } from './npc-entry.js';

// Deux CRS de chaque côté de l'entrée, en unités de carte, tournés vers le bâtiment.
const POSTS = [-1.5, -0.8, 0.8, 1.5];

/** Position de chaque CRS d'une escouade à l'instant `tick` (fractionnaire) : place, regard et trajet. */
export function closureSquadMembers(squad, building, tick, hz, worldLength) {
  const arrival = Math.min(1, Math.max(0, (tick - squad.started_tick) / (CLOSURE_ARRIVAL_SECONDS * hz)));
  const leave = squad.leave_tick == null ? 0 : Math.min(1, Math.max(0, (tick - squad.leave_tick) / (CLOSURE_EXIT_SECONDS * hz)));
  return POSTS.map((post, index) => {
    const inward = post < 0 ? 1 : -1;
    // Un petit décalage par CRS : ils n'avancent pas tous du même pas.
    const lag = index * .06, stagger = p => Math.min(1, Math.max(0, (p - lag) / (1 - lag)));
    const phase = leave > 0 ? 'LEAVING' : arrival < 1 ? 'ARRIVING' : 'GUARDING';
    return { id: `${squad.id}:${index}`, x: wrap(building.x + post, worldLength), index, phase,
      facing: phase === 'LEAVING' ? -inward : inward,
      // 1 = à sa place devant le bâtiment, 0 = encore (ou de nouveau) sous le bas de l'écran.
      progress: phase === 'LEAVING' ? 1 - stagger(leave) : stagger(arrival) };
  });
}

export function drawClosureSquads(renderer, state, screenUnits) {
  if (!state.closure_squads?.length) return;
  const { metrics: m, p } = renderer, hz = renderer.config.balance.simulation_architecture.fixed_tick_hz;
  const tick = renderer.buildingShutterTick ?? state.tick, length = state.world.length;
  const zoom = (renderer.config.balance.camera.framing_zoom ?? 1) * (renderer.zoomBoost || 1);
  const height = m.characterHeight * p.npc_height_multiplier;
  const rise = (renderer.height - m.groundY) / zoom + height * 1.2, side = height * 1.6, bob = height * .035;
  for (const squad of state.closure_squads) {
    const building = state.buildings.find(b => b.id === squad.target_id);
    if (!building || Math.abs(ringDelta(renderer.cameraX, building.x, length)) > screenUnits * .6 + 2) continue;
    for (const member of closureSquadMembers(squad, building, tick, hz, length)) {
      const walking = member.phase !== 'GUARDING';
      const crs = { id: member.id, role: 'CRS', faction_id: squad.faction_id, temporary: true, x: member.x,
        facing: member.facing, moving: walking, combat: {}, variant: member.index };
      if (!walking) { renderer.drawPerson(crs, renderer.screenX(member.x), state); continue; }
      // Même trajet que l'arrivée des habitants : montée en courbe depuis le bas, puis quelques pas de côté.
      const path = entryPath(member.progress, tick / hz + member.index * .37);
      const away = member.phase === 'LEAVING' ? member.facing : -member.facing;
      renderer.metrics = { ...m, groundY: m.groundY + rise * path.lift - bob * path.bob };
      try { renderer.drawPerson(crs, renderer.screenX(member.x) + away * side * path.side, state); }
      finally { renderer.metrics = m; }
    }
  }
}
