import { CampaignStyleSystem } from './campaign-styles.js';
import { scatterMoney } from './money.js';
import { random, ringDelta, zoneAt } from './world.js';
import { buildingSettings, siteVariant, acceptsDonations, isCapturable, presenceForLevel } from './building-rules.js';
import { stableIdOrder } from './territory.js';

const neutralTypes = new Set(['imprimerie', 'meeting', 'institut_sondage']);

/** Les fonctions et les coordonnées viennent du tableau, sans tirage aléatoire. */
export function createInfrastructure(world, config, _rngState) {
  const slots = config.layout.strategic_site_generation.slots.map(slot => {
    const zone = world.subzones.find(z => z.id === slot.subzone_id);
    return { ...slot, id: `slot:${slot.site_id}`, x: zone.start + zone.width * slot.x_ratio, biome_id: zone.biome_id };
  });
  const buildings = slots.map(slot => {
    const type = slot.type; const service = neutralTypes.has(type);
    return { id: slot.site_id, site_id: slot.site_id, type, slot_id: slot.id, x: slot.x, subzone_id: slot.subzone_id, biome_id: slot.biome_id,
      controls_zone: !!slot.controls_zone, fixed_variant: slot.fixed_variant || null, label: slot.label || null,
      next_sponsor_tick: 0, ownership_model: service ? 'neutral_service' : 'capturable', owner_id: null, level: service ? 1 : 0,
      state: service ? 'ACTIVE' : 'NEUTRAL', active: service, neutral: true,
      capture_progress: 0, closure_progress: 0, required_presence: 0, current_political_presence: 0,
      hostile_pressure: 0, current_effective_presence: 0, next_level_available: false, level_lock_reason: null,
      queue: [], last_action_tick: -1, delivered_count: 0, variant: null, headquarters: false,
      raid_ready_tick: 0, closure_ready_tick: 0,
      stored_money_cents: 0, last_collection_cents: 0, last_collection_tick: null,
      meeting_ready_by_faction: { melenchon: 0, le_pen: 0, philippe: 0 },
      meeting_banned_until_by_faction: { melenchon: 0, le_pen: 0, philippe: 0 },
      meeting_started_tick: -1, meeting_until_tick: 0, meeting_level: 1, meeting_faction_id: null, meetings_held: 0,
      meeting_candidate_id: null, meeting_hold_ticks: 0, meeting_pause_ticks: 0, meeting_wave_tick: -1, meeting_wave_faction_id: null,
      next_broadcast_tick: 0,
      last_poll_candidate_id: null, last_poll_tick: null };
  });
  return { buildings, slots };
}

export function localPoliticalPresence(state, subzoneId, faction) {
  return state.npcs.filter(n => n.faction_id === faction && zoneAt(state.world, n.x).id === subzoneId
    && ['SYMPATHISANT', 'MILITANT'].includes(n.role)).length;
}

export function activeOwnedSites(state, type, faction) {
  return state.buildings.filter(b => b.type === type && b.owner_id === faction && b.state === 'ACTIVE');
}

export function captureLimitReason(state, config, building, faction) {
  const s = buildingSettings(config, building, faction);
  if (Number.isFinite(s.max_per_candidate) && activeOwnedSites(state, building.type, faction).length >= s.max_per_candidate) return 'CANDIDATE_LIMIT';
  return null;
}

export function currentMaintainThreshold(state, config, building) {
  if (!building.owner_id || !isCapturable(building)) return 0;
  if (building.controls_zone) return 0;
  const s = buildingSettings(config, building);
  let required = presenceForLevel(s, 'maintain_presence', building.level);
  const anchor = state.buildings.find(b => b.type === 'permanence' && b.owner_id === building.owner_id && b.state === 'ACTIVE'
    && b.biome_id === building.biome_id);
  if (anchor) required -= config.balance.buildings.permanence.biome_maintain_presence_reduction_by_level[anchor.level - 1];
  return Math.max(0, required);
}

export function plannedHeadquartersSuccessor(state, faction, fromX = null) {
  const candidate = state.candidates.find(c => c.faction_id === faction);
  const origin = fromX ?? candidate?.last_hq_x ?? candidate?.start_x ?? 0;
  return state.buildings.filter(b => b.type === 'permanence' && b.owner_id === faction && b.state === 'ACTIVE' && !b.headquarters)
    .sort((a, b) => Math.abs(ringDelta(origin, a.x, state.world.length)) - Math.abs(ringDelta(origin, b.x, state.world.length)) || stableIdOrder(a, b))[0] || null;
}

export function captureSite(sim, building, candidate) {
  building.owner_id = candidate.faction_id; building.level = 1; building.state = 'ACTIVE'; building.active = true; building.neutral = false;
  building.capture_progress = 0; building.closure_progress = 0; building.variant = building.type === 'faction' ? siteVariant(building, candidate.faction_id) : null;
  candidate.interaction_chain_site_id = building.id;
  if (building.type === 'permanence' && !sim.state.buildings.some(b => b.type === 'permanence' && b.owner_id === candidate.faction_id && b.headquarters)) {
    building.headquarters = true; candidate.headquarters_site_id = building.id; candidate.last_hq_x = building.x;
    sim.emit('HeadquartersEstablished', { candidate_id: candidate.id, target_id: building.id });
    CampaignStyleSystem.headquartersEstablished(sim, candidate);
  }
  sim.emit('SiteCaptured', { candidate_id: candidate.id, target_id: building.id, level: 1 });
}

export function neutralizeSite(sim, building, reason = 'PRESENCE_LOST') {
  if (!isCapturable(building) || building.owner_id === null) return false;
  if ((acceptsDonations(building) || building.type === 'financement') && building.stored_money_cents) {
    scatterMoney(sim, building.x, building.stored_money_cents);
    sim.emit('FundingDropped', { target_id: building.id, amount_cents: building.stored_money_cents });
    building.stored_money_cents = 0;
  }
  const oldOwner = building.owner_id; const wasHeadquarters = building.headquarters; const oldX = building.x;
  building.owner_id = null; building.level = 0; building.state = 'NEUTRAL'; building.active = false; building.neutral = true;
  building.next_broadcast_tick = 0;
  building.capture_progress = 0; building.closure_progress = 0; building.current_political_presence = 0; building.current_effective_presence = 0;
  building.hostile_pressure = 0; building.variant = null; building.headquarters = false;
  building.last_collection_cents = 0; building.last_collection_tick = null;
  for (const order of building.queue) {
    const worker = sim.state.npcs.find(n => n.id === order.assigned_npc_id); if (worker) worker.task = null;
  }
  building.queue = [];
  if (wasHeadquarters) {
    const candidate = sim.state.candidates.find(c => c.faction_id === oldOwner); if (candidate) candidate.last_hq_x = oldX;
    const successor = plannedHeadquartersSuccessor(sim.state, oldOwner, oldX);
    if (successor) { successor.headquarters = true; candidate.headquarters_site_id = successor.id; candidate.last_hq_x = successor.x;
      sim.emit('HeadquartersSucceeded', { candidate_id: candidate.id, target_id: successor.id }); }
    else if (candidate) candidate.headquarters_site_id = null;
  }
  sim.emit('SiteNeutralized', { target_id: building.id, previous_owner_id: oldOwner, reason });
  return true;
}

export function updateStrategicSites(sim) {
  const { state, config, hz } = sim;
  for (const building of state.buildings) {
    if (!isCapturable(building) || building.state !== 'ACTIVE') continue;
    building.current_political_presence = localPoliticalPresence(state, building.subzone_id, building.owner_id);
    building.hostile_pressure = state.npcs.filter(n => n.role === 'SERVICE_D_ORDRE' && n.faction_id !== building.owner_id
      && n.pressure_target_id === building.id).reduce((sum, n) => sum + config.balance.buildings.faction_slot_melenchon_lepen_service_ordre.hostile_pressure_per_SO, 0);
    building.required_presence = currentMaintainThreshold(state, config, building);
    building.current_effective_presence = Math.max(0, building.current_political_presence - building.hostile_pressure);
    if (building.headquarters) { building.closure_progress = 0; continue; }
    const s = buildingSettings(config, building);
    if (building.controls_zone ? building.hostile_pressure > building.current_political_presence : building.current_effective_presence < building.required_presence) building.closure_progress += 1 / sim.secondsToTicks(s.closure_delay_seconds);
    else building.closure_progress = Math.max(0, building.closure_progress - s.closure_recovery_per_second / hz);
    if (building.closure_progress >= 1 - 1e-9) neutralizeSite(sim, building);
  }
}

export { controlledUnitDamageMultiplier as localUnitDamageMultiplier } from './zone-control.js';
