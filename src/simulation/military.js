import { ringDelta, subzoneGap, wrap, zoneAt } from './world.js';
import { moveNpcTowards } from './tasks.js';
import { distance, stableIdOrder } from './territory.js';
import { buildingSettings } from './building-rules.js';
import { releaseDonation } from './money.js';
import { interrupted, targetable } from './combat-state.js';
import { startNpcAttack } from './combat.js';
import { nearbyNpcs } from './npc-proximity.js';
import { headquartersProtected } from './strategic-sites.js';
import { npcGender } from './npc-appearance.js';
import { defensiveGuard, guardDefendsPosition } from './service-order-rules.js';
import { serviceOrderPostOffset, serviceOrderFacadeOffset, serviceOrderCombatPlace, serviceOrderSeed, serviceOrderMarchOffsets, serviceOrderMarchSpeed } from './service-order-formation.js';

const availableRecruit = (state, n, faction) => n.faction_id === faction && targetable(n) && !interrupted(n) && !n.combat?.engaged
  && !n.meeting_target_id && !n.rally_event_id && n.rally_return_x == null && !(n.handoff_until_tick > state.tick);

function assignRecruit(sim, npc, building, kind, style, extra = {}) {
  for (const neutral of sim.state.npcs) if (neutral.persuasion?.actor_id === npc.id) neutral.persuasion = null;
  npc.persuasion_target_ids = [];
  npc.task = { kind, service_id: building.id, target_id: building.id, ...extra,
    style, gender: npcGender(npc, sim.state), destination_x: building.x, destination_subzone_id: building.subzone_id,
    phase: 'TRAVEL', elapsed_ticks: 0 };
}

/** Les trois places sont réservées à la création, sans créer de nouveaux électeurs. */
export function recruitDefensiveGuards(sim, building) {
  const pending = building.guard_recruitment;
  if (!pending?.slots.length || building.state !== 'ACTIVE' || building.variant !== 'service_ordre' || pending.owner_id !== building.owner_id) return;
  const { state } = sim, zone = zoneAt(state.world, building.x);
  const recruits = state.npcs.filter(n => ['SYMPATHISANT', 'MILITANT'].includes(n.role)
    && availableRecruit(state, n, building.owner_id) && (!n.task || n.task.kind === 'EXPAND')
    && subzoneGap(state.world, zone, zoneAt(state.world, n.x)) <= sim.config.balance.physical_units.service_ordre.recruit_subzone_radius)
    .sort((a, b) => distance(state, a.x, building.x) - distance(state, b.x, building.x) || stableIdOrder(a, b));
  for (const npc of recruits.slice(0, pending.slots.length)) {
    assignRecruit(sim, npc, building, 'JOIN_GUARD', pending.slots.shift());
    sim.emit('GuardRecruitAssigned', { npc_id: npc.id, target_id: building.id });
  }
}

export function updateGuardRecruitment(sim) {
  for (const building of sim.state.buildings) recruitDefensiveGuards(sim, building);
}

/** Sympathisants libres d'un camp, du plus proche au plus éloigné du local : les recrues d'un raid. */
export function raidRecruits(state, building, faction) {
  return state.npcs.filter(n => n.role === 'SYMPATHISANT' && availableRecruit(state, n, faction) && !n.task)
    .sort((a, b) => distance(state, a.x, building.x) - distance(state, b.x, building.x) || stableIdOrder(a, b));
}

/** Achat d'un raid : les sympathisants les plus proches viennent au local pour en ressortir en service d'ordre. */
export function startRaid(sim, building, faction, direction) {
  const { state, config } = sim;
  const recruits = raidRecruits(state, building, faction).slice(0, config.balance.physical_units.service_ordre.raid_recruits);
  const id = `raid:${state.next_raid_id++}`;
  recruits.forEach((npc, index) => assignRecruit(sim, npc, building, 'JOIN_RAID', index % 3, { raid_id: id, direction }));
  sim.emit('RaidStarted', { raid_id: id, target_id: building.id, direction, npc_ids: recruits.map(n => n.id) });
  return recruits.length;
}

/** Une recrue marche jusqu'à la porte du local, entre un instant, puis ressort en service d'ordre. */
export function updateRaidRecruit(sim, npc) {
  const { state, config } = sim;
  const task = npc.task;
  const building = state.buildings.find(b => b.id === task.service_id);
  // Local perdu en chemin : la recrue conserve son rôle civil.
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
  npc.so_assignment = { style: task.style ?? 0, gender: task.gender ?? npcGender(npc, state) };
  npc.raid = task.kind === 'JOIN_RAID'
    ? { id: task.raid_id, building_id: building.id, direction: task.direction, started_tick: state.tick, phase: 'GATHER' } : null;
  npc.task = null; npc.promoted_tick = state.tick; npc.persuasion_target_ids = []; npc.facing = task.direction ?? npc.facing;
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
const gatherX = (state, npc, spacing, hz) => {
  const members = squad(state, npc.raid), index = members.indexOf(npc);
  const offsets = serviceOrderMarchOffsets(members, npc.raid, npc.raid.started_tick ?? 0, hz);
  return npc.guard_anchor_x + npc.raid.direction * (spacing * 2 + offsets[index]);
};

function moveRaidTowards(sim, npc, destination, settings) {
  const speed = serviceOrderMarchSpeed(sim.state, npc, squad(sim.state, npc.raid), settings, sim.hz);
  if (speed < .001) { npc.moving = false; npc.facing = npc.raid.direction; return; }
  moveNpcTowards(sim, npc, destination, speed);
}

function startRaidDash(sim, npc, target, formation, s) {
  const d = ringDelta(npc.x, target.x, sim.state.world.length), gap = Math.abs(d);
  if (!formation.attacking || gap < s.raid_dash_min_range || gap > s.raid_dash_distance + s.raid_dash_contact_range
    || sim.state.tick < (npc.combat.raid_dash_ready_tick ?? 0)
    // Le garde rejoint son côté de combat, sans traverser la cible ni ses camarades.
    || Math.sign(ringDelta(target.x, formation.destination, sim.state.world.length)) !== -Math.sign(d)
    || sim.state.npcs.some(n => n !== npc && n.role === 'SERVICE_D_ORDRE' && n.faction_id === npc.faction_id
      && ringDelta(npc.x, n.x, sim.state.world.length) * Math.sign(d) > 0
      && ringDelta(npc.x, n.x, sim.state.world.length) * Math.sign(d) < gap)) return false;
  const dashTicks = sim.secondsToTicks(s.raid_dash_seconds);
  const attack = startNpcAttack(sim, npc, 'RAID_DASH', {
    target_id: target.id, range: s.raid_dash_contact_range, contact_range: s.raid_dash_contact_range,
    damage: s.raid_dash_damage, knockback: s.knockback, electoral_damage: s.electoral_damage,
    windup_ticks: sim.secondsToTicks(s.raid_dash_windup_seconds), active_ticks: dashTicks,
    recovery_ticks: sim.secondsToTicks(s.raid_dash_recovery_seconds),
    dash_ticks: dashTicks, dash_distance: s.raid_dash_distance, dash_remaining: s.raid_dash_distance,
    cooldown_seconds: s.attack_cooldown_seconds,
  });
  if (!attack) return false;
  npc.combat.raid_dash_ready_tick = sim.state.tick + sim.secondsToTicks(s.raid_dash_cooldown_seconds);
  npc.moving = false;
  return true;
}

/** Trois sentinelles fixes au local ; une sortie seulement en cas d'affrontement. */
function updateDefensiveGuard(sim, npc) {
  const { state, config } = sim, s = config.balance.physical_units.service_ordre;
  npc.pressure_target_id = null;
  const members = state.npcs.filter(n => defensiveGuard(n) && n.faction_id === npc.faction_id
    && (npc.source_site_id ? n.source_site_id === npc.source_site_id : n.guard_biome_id === npc.guard_biome_id)).sort(stableIdOrder);
  const index = Math.max(0, members.indexOf(npc));
  const sites = state.buildings.filter(b => b.state === 'ACTIVE' && b.owner_id === npc.faction_id && b.biome_id === npc.guard_biome_id);
  const post = sites.find(b => b.id === npc.source_site_id) || sites.filter(b => b.variant === 'service_ordre')
    .sort((a, b) => distance(state, npc.guard_anchor_x, a.x) - distance(state, npc.guard_anchor_x, b.x) || stableIdOrder(a, b))[0];
  const zone = post && zoneAt(state.world, post.x), margin = config.prototype.world.arrival_epsilon_units;
  let destination = post ? Math.max(zone.start + margin, Math.min(zone.end - margin, post.x + serviceOrderPostOffset(npc, index, members.length, state.tick, sim.hz))) : npc.guard_anchor_x;
  const candidates = state.candidates.concat(nearbyNpcs(state, npc.x, s.defense_detection_range), state.temporary_units);
  const calmTicks = sim.secondsToTicks(s.defense_calm_seconds);
  const noiseTick = t => t.combat?.engaged || t.combat?.attack_id || state.attacks.some(a => a.owner_id === t.id)
    ? state.tick : t.combat?.last_hit?.tick ?? -Infinity;
  const noisy = t => state.tick - noiseTick(t) <= calmTicks;
  const target = candidates.filter(t => t.id !== npc.id && targetable(t) && t.faction_id !== npc.faction_id && t.role !== 'SYMPATHISANT'
    && (noisy(t) || npc.task?.target_id === t.id && state.tick <= (npc.task.alert_until_tick ?? -1))
    && guardDefendsPosition(state, npc, t.x) && guardDefendsPosition(state, npc, npc.x)
    && distance(state, npc.x, t.x) <= s.defense_detection_range
    // Pas de poursuite au travers d'une sous-zone neutre ou ennemie.
    && state.world.subzones.every(z => {
      const delta = ringDelta(npc.x, t.x, state.world.length), along = ringDelta(npc.x, z.center, state.world.length) * Math.sign(delta);
      return along <= 0 || along >= Math.abs(delta) || guardDefendsPosition(state, npc, z.center);
    })).sort((a, b) => (a.role === 'CANDIDAT' ? 0 : 1) - (b.role === 'CANDIDAT' ? 0 : 1)
      || distance(state, npc.x, a.x) - distance(state, npc.x, b.x) || stableIdOrder(a, b))[0];
  npc.combat.target_id = target?.id ?? null; npc.combat.engaged = !!target;
  npc.moving = false;
  if (interrupted(npc)) return;
  let phase = 'POST', formation = null;
  if (target) {
    phase = 'DEFEND'; formation = serviceOrderCombatPlace(state, npc, target, s, sim.hz); destination = formation.destination;
    npc.facing = Math.sign(ringDelta(npc.x, target.x, state.world.length)) || npc.facing;
    const arrived = moveNpcTowards(sim, npc, destination, s.move_speed);
    npc.facing = Math.sign(ringDelta(npc.x, target.x, state.world.length)) || npc.facing;
    if (arrived && formation.attacking && distance(state, npc.x, target.x) <= s.attack_range) startNpcAttack(sim, npc, 'GUARD', { range: s.attack_range, damage: s.attack_damage, knockback: s.knockback,
      electoral_damage: s.electoral_damage, cooldown_seconds: s.attack_cooldown_seconds });
  } else if (!moveNpcTowards(sim, npc, destination, Math.min(s.move_speed, .75))) phase = 'RETURN';
  else {
    npc.moving = false;
    const look = Math.floor((state.tick / sim.hz + serviceOrderSeed(npc.id) % 11) / (5 + serviceOrderSeed(npc.id) % 4));
    npc.facing = (look + index) % 2 ? 1 : -1;
  }
  const alertUntil = target ? Math.max(noiseTick(target) + calmTicks, npc.task?.target_id === target.id ? npc.task.alert_until_tick ?? 0 : 0) : 0;
  npc.task = { kind: 'GUARD', phase, target_id: target?.id ?? null, alert_until_tick: alertUntil,
    formation_index: formation?.index ?? index, combat_side: formation?.side ?? null,
    destination_x: wrap(destination, state.world.length), destination_subzone_id: zoneAt(state.world, destination).id };
}

/**
 * Un raid n'a pas de fin : le groupe part quand toutes ses recrues sont sorties du local, puis avance
 * sans jamais rentrer. Il va fermer les bâtiments adverses et ne se bat qu'avec les adversaires tout
 * proches, sauf un candidat adverse dans les parages, qu'il prend en chasse. Battu, un garde devient un PNJ battu qui rentre chez lui, comme les autres soutiens.
 */
export function updateGuard(sim, npc) {
  const { state, config } = sim;
  const s = config.balance.physical_units.service_ordre;
  if (!npc.raid) { updateDefensiveGuard(sim, npc); return; }
  const raid = npc.raid;
  npc.pressure_target_id = null;
  // Le groupe attend ses recrues puis avance ensemble, avec des écarts irréguliers.
  if (raid.phase === 'GATHER' && !state.npcs.some(n => n.role === 'SYMPATHISANT' && n.task?.kind === 'JOIN_RAID' && n.task.raid_id === raid.id)
    && squad(state, raid).every(g => g.raid.phase !== 'GATHER' || distance(state, g.x, gatherX(state, g, s.spacing_units, sim.hz)) <= config.prototype.world.arrival_epsilon_units)) {
    raid.phase = 'OUTBOUND';
  }
  const near = (t, range) => t.id !== npc.id && targetable(t) && t.faction_id !== npc.faction_id && Math.abs(ringDelta(npc.x, t.x, state.world.length)) <= range;
  const closest = (a, b) => distance(state, npc.x, a.x) - distance(state, npc.x, b.x) || stableIdOrder(a, b);
  // Un candidat adverse à portée (environ un tiers de sous-zone) attire tous les gardes, avant tout le reste.
  const candidate = state.candidates.filter(c => near(c, s.candidate_focus_range)).sort(closest)[0];
  const engageRange = Math.max(s.engage_range, s.raid_dash_distance + s.raid_dash_contact_range);
  const target = candidate || nearbyNpcs(state, npc.x, engageRange).concat(state.temporary_units).filter(t => t.role !== 'SYMPATHISANT' && near(t, engageRange))
    .sort((a, b) => {
      const priority = unit => unit.combat?.attack_id || unit.combat?.engaged ? 0 : unit.role === 'MILITANT' ? 1 : 2;
      return priority(a) - priority(b) || closest(a, b);
    })[0] || null;
  npc.combat.target_id = target?.id || null;
  npc.combat.engaged = !!target;
  npc.moving = false;
  if (interrupted(npc)) return;
  const slot = guardSlot(state, npc, s.spacing_units);
  let destination; let phase; let formation = null, pressureSite = null;
  if (target) {
    formation = serviceOrderCombatPlace(state, npc, target, s, sim.hz);
    destination = formation.destination; phase = 'DEFEND';
    const d = ringDelta(npc.x, target.x, state.world.length); npc.facing = Math.sign(d) || npc.facing;
    if (startRaidDash(sim, npc, target, formation, s)) return;
    const arrived = moveNpcTowards(sim, npc, destination, s.move_speed);
    npc.facing = Math.sign(ringDelta(npc.x, target.x, state.world.length)) || npc.facing;
    if (arrived && formation.attacking && distance(state, npc.x, target.x) <= s.attack_range) startNpcAttack(sim, npc, 'GUARD', { range: s.attack_range, damage: s.attack_damage, knockback: s.knockback,
      electoral_damage: s.electoral_damage, cooldown_seconds: s.attack_cooldown_seconds });
  } else if (raid.phase === 'GATHER') {
    // Devant la porte, côté raid, en attendant les dernières recrues.
    phase = 'GATHER'; destination = gatherX(state, npc, s.spacing_units, sim.hz);
    if (moveNpcTowards(sim, npc, destination, s.move_speed)) npc.facing = raid.direction;
  } else {
    const hostileSite = state.buildings.filter(b => b.state === 'ACTIVE' && b.owner_id && b.owner_id !== npc.faction_id && !headquartersProtected(state, b)
      && (npc.task?.phase === 'PRESSURE' && npc.task.target_id === b.id
        || ringDelta(npc.x, b.x, state.world.length) * raid.direction >= -s.attack_range))
      .sort((a, b) => Math.abs(ringDelta(npc.x, a.x, state.world.length)) - Math.abs(ringDelta(npc.x, b.x, state.world.length)) || stableIdOrder(a, b))[0];
    if (hostileSite) {
      pressureSite = hostileSite;
      // Chacun rejoint une place devant la façade avant de commencer à la frapper.
      // La portée de combat ne sert pas à fermer un bâtiment à distance.
      phase = 'PRESSURE'; destination = wrap(hostileSite.x + serviceOrderFacadeOffset(npc, slot.index, squad(state, raid).length, state.tick, sim.hz), state.world.length);
      const approaching = distance(state, npc.x, destination) > 4;
      if (approaching) moveRaidTowards(sim, npc, destination, s);
      else if (moveNpcTowards(sim, npc, destination, s.move_speed)) {
        npc.moving = false; npc.pressure_target_id = hostileSite.id;
        // Les côtés convergent vers la porte, en restant sur la ligne de marche.
        npc.facing = Math.sign(ringDelta(npc.x, hostileSite.x, state.world.length)) || raid.direction;
      }
    } else {
      phase = 'RAID'; destination = wrap(npc.x + raid.direction * s.move_speed, state.world.length);
      moveRaidTowards(sim, npc, destination, s);
    }
  }
  npc.task = { kind: 'GUARD', phase, target_id: target?.id || pressureSite?.id || null, formation_index: formation?.index ?? slot.index, combat_side: formation?.side ?? null,
    destination_x: wrap(destination, state.world.length), destination_subzone_id: zoneAt(state.world, destination).id };
}
