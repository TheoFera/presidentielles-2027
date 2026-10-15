import { ringDelta, wrap, zoneAt } from './world.js';
import { moveNpcTowards } from './tasks.js';
import { distance, stableIdOrder } from './territory.js';
import { buildingSettings } from './building-rules.js';
import { releaseDonation } from './money.js';
import { interrupted, targetable } from './combat-state.js';
import { startNpcAttack } from './combat.js';
import { nearbyNpcs } from './npc-proximity.js';

/** Sympathisants libres d'un camp, du plus proche au plus éloigné du local : les recrues d'un raid. */
export function raidRecruits(state, building, faction) {
  return state.npcs.filter(n => n.role === 'SYMPATHISANT' && n.faction_id === faction && !n.task && !n.meeting_target_id
    && !n.rally_event_id && n.rally_return_x == null && !(n.handoff_until_tick > state.tick))
    .sort((a, b) => distance(state, a.x, building.x) - distance(state, b.x, building.x) || stableIdOrder(a, b));
}

/** Achat d'un raid : les sympathisants les plus proches viennent au local pour en ressortir en service d'ordre. */
export function startRaid(sim, building, faction, direction) {
  const { state, config } = sim;
  const recruits = raidRecruits(state, building, faction).slice(0, config.balance.physical_units.service_ordre.raid_recruits);
  const id = `raid:${state.next_raid_id++}`;
  for (const npc of recruits) {
    for (const neutral of state.npcs) if (neutral.persuasion?.actor_id === npc.id) neutral.persuasion = null;
    npc.persuasion_target_ids = [];
    npc.task = { kind: 'JOIN_RAID', raid_id: id, service_id: building.id, target_id: building.id, direction,
      destination_x: building.x, destination_subzone_id: building.subzone_id, phase: 'TRAVEL', elapsed_ticks: 0 };
  }
  sim.emit('RaidStarted', { raid_id: id, target_id: building.id, direction, npc_ids: recruits.map(n => n.id) });
  return recruits.length;
}

/** Une recrue marche jusqu'à la porte du local, entre un instant, puis ressort en service d'ordre. */
export function updateRaidRecruit(sim, npc) {
  const { state, config } = sim;
  const task = npc.task;
  const building = state.buildings.find(b => b.id === task.service_id);
  // Local perdu en chemin : la recrue redevient un simple sympathisant.
  if (!building || building.state !== 'ACTIVE' || building.owner_id !== npc.faction_id) { npc.task = null; npc.moving = false; return; }
  if (task.phase === 'TRAVEL') {
    if (!moveNpcTowards(sim, npc, building.x, config.balance.physical_units.sympathisant.task_move_speed)) return;
    task.phase = 'INSIDE'; task.elapsed_ticks = 0;
  }
  npc.moving = false;
  if (++task.elapsed_ticks < sim.secondsToTicks(buildingSettings(config, building).pickup_seconds)) return;
  releaseDonation(sim, npc);
  npc.role = 'SERVICE_D_ORDRE'; npc.hidden_durability = config.balance.physical_units.service_ordre.hidden_durability;
  npc.guard_biome_id = building.biome_id; npc.guard_anchor_x = building.x; npc.source_site_id = building.id;
  npc.raid = { id: task.raid_id, building_id: building.id, direction: task.direction, started_tick: state.tick, phase: 'GATHER' };
  npc.task = null; npc.promoted_tick = state.tick; npc.persuasion_target_ids = []; npc.facing = task.direction;
  sim.emit('GuardEquipped', { npc_id: npc.id, target_id: building.id, raid_id: task.raid_id });
}

/** Chaque garde a sa propre place dans son groupe de raid : jamais tous au même point. */
const squad = (state, raid) => state.npcs.filter(n => n.role === 'SERVICE_D_ORDRE' && n.raid?.id === raid.id).sort(stableIdOrder);

function guardSlot(state, npc, spacing) {
  const members = squad(state, npc.raid);
  const index = Math.max(0, members.indexOf(npc));
  return { index, offset: (index - (members.length - 1) / 2) * spacing };
}

/** Place d'attente devant la porte, côté raid. */
const gatherX = (state, npc, spacing) => npc.guard_anchor_x + npc.raid.direction * spacing * 2 + guardSlot(state, npc, spacing).offset;

/**
 * Un raid n'a pas de fin : le groupe part quand toutes ses recrues sont sorties du local, puis avance
 * sans jamais rentrer. Il va fermer les bâtiments adverses et ne se bat qu'avec les adversaires tout
 * proches, sauf un candidat adverse dans les parages, qu'il prend en chasse. Battu, un garde devient un PNJ battu qui rentre chez lui, comme les autres soutiens.
 */
export function updateGuard(sim, npc) {
  const { state, config } = sim;
  const s = config.balance.physical_units.service_ordre;
  // Un garde sans raid (apparu par le panneau de débogage, par exemple) part droit devant.
  if (!npc.raid) npc.raid = { id: `raid:${state.next_raid_id++}`, building_id: npc.source_site_id ?? null, direction: npc.facing, started_tick: state.tick, phase: 'OUTBOUND' };
  const raid = npc.raid;
  npc.pressure_target_id = null;
  // Le groupe part quand toutes les recrues sont sorties et que chacun a pris sa place : ils marchent alors côte à côte.
  if (raid.phase === 'GATHER' && !state.npcs.some(n => n.role === 'SYMPATHISANT' && n.task?.kind === 'JOIN_RAID' && n.task.raid_id === raid.id)
    && squad(state, raid).every(g => g.raid.phase !== 'GATHER' || distance(state, g.x, gatherX(state, g, s.spacing_units)) <= config.prototype.world.arrival_epsilon_units)) {
    raid.phase = 'OUTBOUND';
  }
  const near = (t, range) => t.id !== npc.id && targetable(t) && t.faction_id !== npc.faction_id && Math.abs(ringDelta(npc.x, t.x, state.world.length)) <= range;
  const closest = (a, b) => distance(state, npc.x, a.x) - distance(state, npc.x, b.x) || stableIdOrder(a, b);
  // Un candidat adverse à portée (environ un tiers de sous-zone) attire tous les gardes, avant tout le reste.
  const candidate = state.candidates.filter(c => near(c, s.candidate_focus_range)).sort(closest)[0];
  const target = candidate || nearbyNpcs(state, npc.x, s.engage_range).concat(state.temporary_units).filter(t => t.role !== 'SYMPATHISANT' && near(t, s.engage_range))
    .sort((a, b) => {
      const priority = unit => unit.combat?.attack_id || unit.combat?.engaged ? 0 : unit.role === 'MILITANT' ? 1 : 2;
      return priority(a) - priority(b) || closest(a, b);
    })[0] || null;
  npc.combat.target_id = target?.id || null;
  npc.combat.engaged = !!target;
  if (interrupted(npc)) return;
  const slot = guardSlot(state, npc, s.spacing_units);
  // Autour d'une cible ou d'un bâtiment, les gardes s'arrêtent à des distances différentes au lieu de s'empiler.
  const reach = Math.max(0.4, s.attack_range - (slot.index % 3) * s.spacing_units);
  let destination; let phase;
  if (target) {
    destination = target.x; phase = 'DEFEND';
    const d = ringDelta(npc.x, target.x, state.world.length); npc.facing = Math.sign(d) || npc.facing;
    if (Math.abs(d) > reach) moveNpcTowards(sim, npc, target.x, s.move_speed);
    else startNpcAttack(sim, npc, 'GUARD', { range: s.attack_range, damage: s.attack_damage, knockback: s.knockback,
      electoral_damage: s.electoral_damage, cooldown_seconds: s.attack_cooldown_seconds });
  } else if (raid.phase === 'GATHER') {
    // Devant la porte, côté raid, en attendant les dernières recrues.
    phase = 'GATHER'; destination = gatherX(state, npc, s.spacing_units);
    if (moveNpcTowards(sim, npc, destination, s.move_speed)) npc.facing = raid.direction;
  } else {
    const hostileSite = state.buildings.filter(b => b.state === 'ACTIVE' && b.owner_id && b.owner_id !== npc.faction_id && !b.headquarters
      && ringDelta(npc.x, b.x, state.world.length) * raid.direction >= -s.attack_range)
      .sort((a, b) => Math.abs(ringDelta(npc.x, a.x, state.world.length)) - Math.abs(ringDelta(npc.x, b.x, state.world.length)) || stableIdOrder(a, b))[0];
    if (hostileSite) {
      phase = 'PRESSURE'; destination = hostileSite.x;
      if (distance(state, npc.x, hostileSite.x) > reach) moveNpcTowards(sim, npc, hostileSite.x, s.move_speed);
      else { npc.moving = false; npc.pressure_target_id = hostileSite.id; }
    } else {
      phase = 'RAID'; destination = wrap(npc.x + raid.direction * s.move_speed, state.world.length);
      moveNpcTowards(sim, npc, destination, s.move_speed);
    }
  }
  npc.task = { kind: 'GUARD', phase, target_id: target?.id || null, destination_x: wrap(destination, state.world.length), destination_subzone_id: zoneAt(state.world, destination).id };
}
