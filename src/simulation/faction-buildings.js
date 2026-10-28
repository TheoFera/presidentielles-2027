import { wrap } from './world.js';
import { distance, stableIdOrder } from './territory.js';
import { buildingSettings, factionVariant } from './building-rules.js';
import { paymentStatus } from './campaign-budget.js';
import { captureLimitReason, captureSite, headquartersProtected, localPoliticalPresence, neutralizeSite } from './strategic-sites.js';
import { cancelMeeting } from './electoral-buildings.js';
import { raidRecruitCount, startRaid } from './military.js';
import { demobilizeUnit } from './combat-state.js';
import { recordFeat } from './campaign-feats.js';
import { CLOSURE_ARRIVAL_SECONDS, CLOSURE_EXIT_SECONDS, CLOSURE_HOLD_SECONDS } from './closure-squads.js';

export function cabinetTarget(state, config, cabinet, direction) {
  const allowed = buildingSettings(config, cabinet).allowed_targets_by_level[cabinet.level - 1];
  return state.buildings.filter(b => b.state === 'ACTIVE' && !headquartersProtected(state, b) && !pendingClosure(state, b)
    && (b.type === 'meeting' ? b.meeting_until_tick > state.tick && b.meeting_faction_id && b.meeting_faction_id !== cabinet.owner_id
      : b.owner_id && b.owner_id !== cabinet.owner_id && allowed.includes(b.type === 'faction' ? b.variant : b.type)))
    .map(b => ({ b, distance: wrap((b.x - cabinet.x) * direction, state.world.length) }))
    .filter(item => item.distance > 0).sort((a, b) => a.distance - b.distance || stableIdOrder(a.b, b.b))[0]?.b || null;
}

function quote(state, config, candidate, building, kind, cost, x, radius, reason = null, extra = {}) {
  const settings = buildingSettings(config, building, candidate.faction_id);
  return { target_id: building.id, kind, key: `${building.id}:${kind}:${building.level}:${extra.direction || 0}:${extra.victim_id || ''}`,
    cost, x: wrap(x, state.world.length), radius, required_ticks: Math.ceil((kind === 'CAPTURE' ? settings.capture_seconds : settings.purchase_hold_seconds) * config.balance.simulation_architecture.fixed_tick_hz),
    ...paymentStatus(candidate, config, cost, reason), ...extra };
}

/** Distinct ground positions choose the action, without a menu or buy button. */
export function factionOffers(state, config, candidate, building) {
  const s = buildingSettings(config, building, candidate.faction_id);
  const p = config.balance.faction_interactions;
  if (['EMPTY', 'NEUTRAL', 'CLOSED'].includes(building.state)) {
    const reason = localPoliticalPresence(state, building.subzone_id, candidate.faction_id) < s.required_presence_N1 ? 'INSUFFICIENT_PRESENCE'
      : captureLimitReason(state, config, building, candidate.faction_id);
    return [quote(state, config, candidate, building, 'CAPTURE', s.capture_cost, building.x, p.center_radius, reason)];
  }
  if (building.owner_id !== candidate.faction_id) return [];
  const offers = [];
  if (building.level < s.max_level) {
    const reason = localPoliticalPresence(state, building.subzone_id, candidate.faction_id) < s[`required_presence_N${building.level + 1}`] ? 'INSUFFICIENT_PRESENCE' : null;
    const chained = candidate.interaction_chain_site_id === building.id;
    offers.push(quote(state, config, candidate, building, 'UPGRADE', s.upgrade_costs[building.level - 1], chained ? building.x : building.x + p.upgrade_offset,
      chained ? p.center_radius : p.upgrade_radius, reason, { label: 'AMÉLIORER' }));
  }
  if (building.variant === 'service_ordre') {
    // Pas d'équipement à acheter : un raid recrute lui-même ses gardes parmi les sympathisants libres.
    const recruits = config.balance.physical_units.service_ordre.raid_recruits;
    for (const direction of [-1, 1]) {
      const blocked = building.level < s.raid_unlock_level ? 'LEVEL_REQUIRED' : state.tick < building.raid_ready_tick ? 'COOLDOWN'
        : raidRecruitCount(state, candidate.faction_id) < recruits ? 'NO_SUPPORTER' : null;
      offers.push(quote(state, config, candidate, building, 'RAID', config.balance.physical_units.service_ordre.raid_cost, building.x + direction * p.side_offset, p.side_radius, blocked, { direction, label: direction < 0 ? '← RAID' : 'RAID →' }));
    }
  } else {
    for (const direction of [-1, 1]) {
      const victim = cabinetTarget(state, config, building, direction);
      const reason = state.tick < building.closure_ready_tick ? 'COOLDOWN' : !victim ? 'NO_BUILDING' : null;
      offers.push(quote(state, config, candidate, building, 'CLOSE', s.close_enemy_building_cost_by_level[building.level - 1], building.x + direction * p.side_offset, p.side_radius, reason,
        { direction, victim_id: victim?.id || null, label: direction < 0 ? '← FERMER' : 'FERMER →' }));
    }
  }
  return offers;
}

export function commitFactionAction(sim, candidate, building, offer) {
  const { state, config } = sim;
  if (offer.kind === 'CAPTURE' && building.type === 'faction') { captureSite(sim, building, candidate); return true; }
  if (offer.kind === 'RAID') {
    startRaid(sim, building, candidate.faction_id, offer.direction);
    recordFeat(state, candidate.faction_id, 'raids');
    building.raid_ready_tick = state.tick + sim.secondsToTicks(config.balance.physical_units.service_ordre.raid_cooldown_seconds);
    return true;
  }
  if (offer.kind === 'CLOSE') {
    const victim = state.buildings.find(b => b.id === offer.victim_id);
    if (!victim || headquartersProtected(state, victim) || pendingClosure(state, victim)) return false;
    // Les CRS du cabinet arrivent d'abord du bas de l'écran ; le bâtiment ferme à leur arrivée.
    const targetFaction = victim.type === 'meeting' ? victim.meeting_faction_id : victim.owner_id;
    (state.closure_squads ||= []).push({ id: `closure:${victim.id}:${state.tick}`, target_id: victim.id, cabinet_id: building.id,
      faction_id: candidate.faction_id, target_faction_id: targetFaction, cost: offer.cost || 0, started_tick: state.tick,
      close_tick: state.tick + sim.secondsToTicks(CLOSURE_ARRIVAL_SECONDS), leave_tick: null, closed: false });
    building.closure_ready_tick = state.tick + sim.secondsToTicks(buildingSettings(config, building).closure_cooldown_seconds);
    sim.emit('ClosureSquadSent', { target_id: victim.id, cabinet_id: building.id });
    return true;
  }
  return false;
}

/** Une escouade de CRS est-elle déjà en route ou sur place pour fermer ce bâtiment ? */
export function pendingClosure(state, building) {
  return state.closure_squads?.some(squad => squad.target_id === building.id && !squad.closed) || false;
}

function closeBuilding(sim, building, victim, factionId, targetFaction) {
  const { state, config } = sim;
  if (victim.type === 'meeting') {
    cancelMeeting(sim, victim);
    victim.meeting_banned_until_by_faction[targetFaction] = state.tick + sim.secondsToTicks(buildingSettings(config, building).meeting_ban_seconds);
  } else {
    if (targetFaction !== factionId) recordFeat(state, factionId, 'buildings_closed');
    neutralizeSite(sim, victim, 'CABINET_ADMINISTRATIF');
  }
  for (const order of victim.queue) {
    const worker = state.npcs.find(n => n.id === order.assigned_npc_id);
    if (worker) worker.task = null;
    // Undelivered equipment is refunded; the closed building keeps no active queue.
    const payer = state.candidates.find(c => c.faction_id === order.faction_id);
    payer.money += order.cost; payer.refunds_received += order.cost;
    sim.emit('EquipmentRefunded', { order_id: order.id, candidate_id: payer.id, amount: order.cost });
  }
  victim.queue = [];
  for (const c of state.candidates) {
    if (c.purchase_hold?.target_id === victim.id) c.purchase_hold = null;
    if (c.interaction_chain_site_id === victim.id) c.interaction_chain_site_id = null;
  }
  // « Dossiers » : la fermeture renvoie chez eux les soutiens du camp visé autour du bâtiment ; ils redeviennent neutres.
  const radius = buildingSettings(config, building).close_demobilize_radius_units ?? 0;
  let sentHome = 0;
  if (radius > 0 && targetFaction) for (const npc of state.npcs) {
    if (npc.faction_id !== targetFaction || !['SYMPATHISANT', 'MILITANT', 'SERVICE_D_ORDRE'].includes(npc.role) || distance(state, npc.x, victim.x) > radius) continue;
    demobilizeUnit(sim, npc); sentHome++;
  }
  sim.emit('BuildingClosed', { target_id: victim.id, cabinet_id: building.id, owner_id: victim.owner_id, sent_home: sentHome });
}

/** Escouades de CRS : fermeture à l'arrivée, courte garde le temps du rideau, puis départ. */
export function updateClosureSquads(sim) {
  const { state } = sim;
  if (!state.closure_squads?.length) return;
  for (const squad of state.closure_squads) {
    if (squad.closed || state.tick < squad.close_tick) continue;
    squad.closed = true; squad.leave_tick = state.tick + sim.secondsToTicks(CLOSURE_HOLD_SECONDS);
    const building = state.buildings.find(b => b.id === squad.cabinet_id), victim = state.buildings.find(b => b.id === squad.target_id);
    // Entre l'ordre et l'arrivée, la cible a pu changer de main ou le meeting finir : rien à fermer, l'ordre est remboursé.
    const still = victim && victim.state === 'ACTIVE' && !headquartersProtected(state, victim) && (victim.type === 'meeting'
      ? victim.meeting_until_tick > state.tick && victim.meeting_faction_id === squad.target_faction_id
      : victim.owner_id === squad.target_faction_id);
    if (still) { closeBuilding(sim, building, victim, squad.faction_id, squad.target_faction_id); continue; }
    squad.cancelled = true;
    const payer = state.candidates.find(c => c.faction_id === squad.faction_id);
    if (payer && squad.cost) { payer.money += squad.cost; payer.refunds_received = (payer.refunds_received || 0) + squad.cost; }
    sim.emit('ClosureSquadCancelled', { target_id: squad.target_id, cabinet_id: squad.cabinet_id, refund: squad.cost });
  }
  const gone = sim.secondsToTicks(CLOSURE_EXIT_SECONDS);
  state.closure_squads = state.closure_squads.filter(squad => !squad.closed || state.tick - squad.leave_tick < gone);
}

export function nearestFactionOffer(state, config, candidate, building) {
  return factionOffers(state, config, candidate, building).sort((a, b) => distance(state, candidate.x, a.x) - distance(state, candidate.x, b.x))[0] || null;
}
