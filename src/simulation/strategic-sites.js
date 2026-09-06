import { fundingModifiers } from './campaign-events.js';
import { random, ringDelta, zoneAt } from './world.js';
import { buildingSettings, factionVariant, isCapturable, presenceForLevel } from './building-rules.js';
import { stableIdOrder } from './territory.js';

const neutralTypes = new Set(['imprimerie', 'meeting', 'institut_sondage']);

function shuffle(state, values) {
  const result = [...values];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random(state) * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function typeSettings(config, type) {
  return type === 'faction' ? config.balance.buildings.faction_slot_melenchon_lepen_service_ordre : config.balance.buildings[type];
}

/** Les emplacements sont explicites ; seule leur affectation est tirée par la RNG autoritaire. */
export function createInfrastructure(world, config, rngState) {
  const generation = config.layout.strategic_site_generation;
  const slots = generation.slots.map(slot => {
    const zone = world.subzones.find(z => z.id === slot.subzone_id);
    return { id: `slot:${slot.site_id}`, site_id: slot.site_id, x: zone.start + zone.width * slot.x_ratio,
      subzone_id: zone.id, biome_id: zone.biome_id };
  });
  const assigned = new Map();
  const assignRandom = (type, biome, predicate = () => true) => {
    const choices = slots.filter(s => s.biome_id === biome.id && !assigned.has(s.id) && predicate(s));
    if (!choices.length) throw new Error(`Aucun emplacement admissible pour ${type} dans ${biome.id}.`);
    assigned.set(choices[Math.floor(random(rngState) * choices.length)].id, type);
  };
  for (const biome of config.layout.biomes) {
    const centralSubzone = biome.subzones[1].id;
    assignRandom('permanence', biome, slot => slot.subzone_id === centralSubzone);
    assignRandom('faction', biome, slot => slot.subzone_id !== centralSubzone);
  }
  for (const biomeId of generation.fixed_biomes_by_type.institut_sondage) {
    const biome = config.layout.biomes.find(candidate => candidate.id === biomeId);
    assignRandom('institut_sondage', biome);
  }
  for (const type of ['imprimerie', 'meeting']) for (const biome of config.layout.biomes) assignRandom(type, biome);
  const free = slots.filter(s => !assigned.has(s.id));
  const assignedCounts = [...assigned.values()].reduce((counts, type) => ({ ...counts, [type]: (counts[type] || 0) + 1 }), {});
  const remaining = Object.entries(generation.site_counts).flatMap(([type, count]) => Array.from({
    length: count - (assignedCounts[type] || 0),
  }, () => type));
  let valid = null;
  for (let attempt = 0; attempt < 2000 && !valid; attempt++) {
    const types = shuffle(rngState, remaining); const perBiome = new Map(); const perSubzone = new Map(); let ok = true;
    for (const [slotId, type] of assigned) {
      const slot = slots.find(candidate => candidate.id === slotId);
      const biomeKey = `${slot.biome_id}:${type}`; const subzoneKey = `${slot.subzone_id}:${type}`;
      perBiome.set(biomeKey, (perBiome.get(biomeKey) || 0) + 1);
      perSubzone.set(subzoneKey, (perSubzone.get(subzoneKey) || 0) + 1);
    }
    for (let i = 0; i < free.length; i++) {
      const biomeKey = `${free[i].biome_id}:${types[i]}`; const subzoneKey = `${free[i].subzone_id}:${types[i]}`;
      const biomeCount = (perBiome.get(biomeKey) || 0) + 1; const subzoneCount = (perSubzone.get(subzoneKey) || 0) + 1;
      const settings = typeSettings(config, types[i]);
      if (biomeCount > settings.max_per_biome || subzoneCount > settings.max_per_subzone) { ok = false; break; }
      perBiome.set(biomeKey, biomeCount); perSubzone.set(subzoneKey, subzoneCount);
    }
    if (ok) valid = types;
  }
  if (!valid) throw new Error('Impossible de répartir les sites stratégiques avec les caps configurés.');
  free.forEach((slot, index) => assigned.set(slot.id, valid[index]));
  const buildings = slots.map(slot => {
    const type = assigned.get(slot.id); const service = neutralTypes.has(type);
    return { id: slot.site_id, site_id: slot.site_id, type, slot_id: slot.id, x: slot.x, subzone_id: slot.subzone_id, biome_id: slot.biome_id,
      ownership_model: service ? 'neutral_service' : 'capturable', owner_id: null, level: service ? 1 : 0,
      state: service ? 'ACTIVE' : 'NEUTRAL', active: service, neutral: true,
      capture_progress: 0, closure_progress: 0, required_presence: 0, current_political_presence: 0,
      hostile_pressure: 0, current_effective_presence: 0, next_level_available: false, level_lock_reason: null,
      queue: [], last_action_tick: -1, delivered_count: 0, variant: null, headquarters: false,
      raid_ready_tick: 0, closure_ready_tick: 0,
      funding_state: 'INACTIVE', funding_started_tick: null, funding_end_tick: null, funding_duration_ticks: 0,
      funding_progress_01: 0, funding_influence_factor: null, funding_campaign_progression_factor: null,
      funding_random_factor: null, funding_target_payout: 0, funding_accumulated_payout: 0,
      funding_expected_payout: 0, funding_last_payout: 0, funding_completed_tick: null,
      meeting_ready_by_faction: { melenchon: 0, le_pen: 0, philippe: 0 },
      meeting_banned_until_by_faction: { melenchon: 0, le_pen: 0, philippe: 0 },
      meeting_started_tick: -1, meeting_until_tick: 0, meeting_level: 1, meetings_held: 0,
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
  const s = buildingSettings(config, building);
  let required = presenceForLevel(s, 'maintain_presence', building.level);
  const anchor = state.buildings.find(b => b.type === 'permanence' && b.owner_id === building.owner_id && b.state === 'ACTIVE'
    && b.biome_id === building.biome_id && b.level >= 3);
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
  building.capture_progress = 0; building.closure_progress = 0; building.variant = building.type === 'faction' ? factionVariant(candidate.faction_id) : null;
  candidate.interaction_chain_site_id = building.id;
  if (building.type === 'permanence' && !sim.state.buildings.some(b => b.type === 'permanence' && b.owner_id === candidate.faction_id && b.headquarters)) {
    building.headquarters = true; candidate.headquarters_site_id = building.id; candidate.last_hq_x = building.x;
    sim.emit('HeadquartersEstablished', { candidate_id: candidate.id, target_id: building.id });
  }
  sim.emit('SiteCaptured', { candidate_id: candidate.id, target_id: building.id, level: 1 });
}

export function neutralizeSite(sim, building, reason = 'PRESENCE_LOST') {
  if (!isCapturable(building) || building.owner_id === null) return false;
  const oldOwner = building.owner_id; const wasHeadquarters = building.headquarters; const oldX = building.x;
  building.owner_id = null; building.level = 0; building.state = 'NEUTRAL'; building.active = false; building.neutral = true;
  building.capture_progress = 0; building.closure_progress = 0; building.current_political_presence = 0; building.current_effective_presence = 0;
  building.hostile_pressure = 0; building.variant = null; building.headquarters = false;
  building.funding_state = 'INACTIVE'; building.funding_started_tick = null; building.funding_end_tick = null;
  building.funding_duration_ticks = 0; building.funding_progress_01 = 0; building.funding_influence_factor = null;
  building.funding_campaign_progression_factor = null; building.funding_random_factor = null;
  building.funding_target_payout = 0; building.funding_accumulated_payout = 0; building.funding_expected_payout = 0;
  building.funding_last_payout = 0; building.funding_completed_tick = null;
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

export function startFundingCampaign(sim, building) {
  const s = sim.config.balance.buildings.financement;
  const modifiers = fundingModifiers(sim.state, building.owner_id);
  if (!modifiers.can_start_new_campaign || building.funding_state === 'RUNNING') return false;
  const duration = s.campaign_duration_min + random(sim.state) * (s.campaign_duration_max - s.campaign_duration_min);
  const randomFactor = s.random_min + random(sim.state) * (s.random_max - s.random_min);
  const score = sim.state.actualGameState.national_support[building.owner_id];
  const influenceFactor = 1 + score / 100 * s.influence_factor;
  const campaignProgressionFactor = s.campaign_progression_factor_start
    + sim.state.campaign_progress_01 * (s.campaign_progression_factor_end - s.campaign_progression_factor_start);
  const rawTarget = s.payout_base * s.payout_level_multiplier[building.level - 1]
    * influenceFactor * campaignProgressionFactor * randomFactor * modifiers.payout_multiplier;
  const target = Math.min(modifiers.payout_max ?? Infinity, rawTarget);
  building.funding_state = 'RUNNING'; building.funding_duration_ticks = sim.secondsToTicks(duration * modifiers.campaign_duration_multiplier);
  building.funding_started_tick = sim.state.tick; building.funding_end_tick = sim.state.tick + building.funding_duration_ticks;
  building.funding_progress_01 = 0; building.funding_influence_factor = influenceFactor;
  building.funding_campaign_progression_factor = campaignProgressionFactor; building.funding_random_factor = randomFactor;
  building.funding_target_payout = target; building.funding_accumulated_payout = 0;
  // Alias conservé pour les outils et rapports existants.
  building.funding_expected_payout = target;
  sim.emit('FundingCampaignStarted', { target_id: building.id, owner_id: building.owner_id,
    duration_ticks: building.funding_duration_ticks, target_payout: target });
  return true;
}

export function updateStrategicSites(sim) {
  const { state, config, hz } = sim;
  for (const building of state.buildings) {
    if (building.funding_state === 'RUNNING') {
      const elapsed = Math.max(0, state.tick - building.funding_started_tick);
      building.funding_progress_01 = Math.min(1, elapsed / building.funding_duration_ticks);
      building.funding_accumulated_payout = building.funding_target_payout * building.funding_progress_01;
    }
    if (building.funding_state === 'RUNNING' && state.tick >= building.funding_end_tick) {
      const candidate = state.candidates.find(c => c.faction_id === building.owner_id);
      if (candidate && !candidate.eliminated && building.state === 'ACTIVE') {
        const payout = building.funding_accumulated_payout;
        candidate.money += payout; candidate.total_earned += payout;
        sim.emit('FundingCampaignCompleted', { target_id: building.id, candidate_id: candidate.id, payout });
        building.funding_last_payout = payout; building.funding_completed_tick = state.tick; building.last_action_tick = state.tick;
      }
      building.funding_state = 'COMPLETED'; building.funding_started_tick = null; building.funding_end_tick = null;
      building.funding_progress_01 = 1;
    }
    if (!isCapturable(building) || building.state !== 'ACTIVE') continue;
    building.current_political_presence = localPoliticalPresence(state, building.subzone_id, building.owner_id);
    building.hostile_pressure = state.npcs.filter(n => n.role === 'SERVICE_D_ORDRE' && n.faction_id !== building.owner_id
      && n.pressure_target_id === building.id).reduce((sum, n) => sum + config.balance.buildings.faction_slot_melenchon_lepen_service_ordre.hostile_pressure_per_SO, 0);
    building.required_presence = currentMaintainThreshold(state, config, building);
    building.current_effective_presence = Math.max(0, building.current_political_presence - building.hostile_pressure);
    if (building.headquarters) { building.closure_progress = 0; continue; }
    const s = buildingSettings(config, building);
    if (building.current_effective_presence < building.required_presence) building.closure_progress += 1 / sim.secondsToTicks(s.closure_delay_seconds);
    else building.closure_progress = Math.max(0, building.closure_progress - s.closure_recovery_per_second / hz);
    if (building.closure_progress >= 1 - 1e-9) neutralizeSite(sim, building);
  }
}

export function localUnitDamageMultiplier(state, config, target) {
  if (!['SYMPATHISANT', 'MILITANT'].includes(target.role)) return 1;
  const biome = zoneAt(state.world, target.x).biome_id;
  const anchors = state.buildings.filter(b => b.type === 'permanence' && b.owner_id === target.faction_id && b.state === 'ACTIVE' && b.biome_id === biome);
  if (!anchors.length) return 1;
  return Math.min(...anchors.map(b => {
    const s = config.balance.buildings.permanence;
    const base = target.role === 'SYMPATHISANT' ? s.sympathisant_damage_multiplier_by_level[b.level - 1] : s.militant_damage_multiplier_by_level[b.level - 1];
    return b.headquarters ? base * s.hq_resistance_multiplier : base;
  }));
}
