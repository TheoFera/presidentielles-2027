import { combatDelta } from './combat-geometry.js';
import { influenceMultiplier, GamePhase } from './phases.js';
import { FACTIONS, ringDelta, zoneAt } from './world.js';
import { convertInfluence, leadership, refreshElectoralState } from './electoral-state.js';

export const stableIdOrder = (a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
export const distance = (state, a, b) => Math.abs(combatDelta(state, a, b));
export const factionRecord = value => Object.fromEntries(FACTIONS.map(f => [f, value]));

export function localUnits(state, subzoneId, factionId = null) {
  return state.npcs.filter(n => (!factionId || n.faction_id === factionId) && zoneAt(state.world, n.x).id === subzoneId);
}

export function localSympathisants(state, subzoneId, factionId) {
  return localUnits(state, subzoneId, factionId).filter(n => n.role === 'SYMPATHISANT');
}

export function biomeSympathisants(state, biomeId, factionId, availableOnly = false) {
  return state.npcs.filter(n => n.role === 'SYMPATHISANT' && n.faction_id === factionId
    && zoneAt(state.world, n.x).biome_id === biomeId && (!availableOnly || !n.task));
}

export function waitingAtPoint(state, pointId) {
  return state.npcs.filter(n => n.origin_social_point_id === pointId && n.role === 'NEUTRE').length;
}

export function incomeBreakdown(state, config, factionId) {
  const money = config.balance.money;
  const eliminated = state.eliminated_faction === factionId;
  const byBiome = Object.fromEntries(config.layout.biomes.map(b => [b.id, {
    count: 0, rate: money.supporter_income_per_second_by_origin_biome[b.id], income: 0,
  }]));
  // Recruitment and promotions retain the spawn biome, regardless of current position.
  for (const npc of state.npcs) {
    if (eliminated || npc.faction_id !== factionId || !['SYMPATHISANT', 'MILITANT', 'SERVICE_D_ORDRE'].includes(npc.role)) continue;
    byBiome[npc.origin_biome_id].count++;
  }
  for (const biome of Object.values(byBiome)) biome.income = biome.count * biome.rate;
  const supporters = Object.values(byBiome).reduce((sum, biome) => sum + biome.income, 0);
  const buildings = eliminated ? 0 : state.buildings.filter(b => b.type === 'financement' && b.owner_id === factionId && b.state === 'ACTIVE')
    .reduce((sum, b) => sum + config.balance.buildings.financement.income_per_second_by_level[b.level - 1], 0);
  const base = eliminated ? 0 : money.base_passive_income_per_second;
  const multiplier = factionId === 'philippe' ? money.philippe_income_multiplier : 1;
  return { base, supporters, buildings, multiplier, byBiome, total: (base + supporters + buildings) * multiplier };
}

export function incomePerSecond(state, config, factionId) {
  return incomeBreakdown(state, config, factionId).total;
}

export function localPersuasionMultiplier(state, config, actor) {
  const subzoneId = zoneAt(state.world, actor.x).id;
  return state.buildings.filter(b => b.type === 'permanence' && b.owner_id === actor.faction_id && b.state === 'ACTIVE' && b.subzone_id === subzoneId)
    .reduce((multiplier, b) => Math.min(multiplier, config.balance.buildings.permanence.local_persuasion_time_multiplier_by_level[b.level - 1]), 1);
}

export function createElectorate(world, config) {
  return world.subzones.map((zone, index) => {
    const support = { ...config.layout.starting_support.default };
    for (const faction of FACTIONS) {
      if (config.layout.starting_positions[faction] !== zone.id) continue;
      let bonus = config.layout.starting_support.home_zone_base_bonus_points[faction];
      if (faction === 'le_pen' && config.layout.starting_support.additional_le_pen_home_bonus_from_balance) bonus += config.balance.influence.le_pen_home_start_support_bonus_points;
      const actual = Math.min(support.neutral, bonus);
      support[faction] += actual; support.neutral -= actual;
    }
    const biomes = config.layout.biomes;
    const biomeIndex = biomes.findIndex(b => b.id === zone.biome_id);
    return { subzone_id: zone.id, support, ...leadership(support, config),
      electoral_weight: config.layout.electoral_weights.by_subzone[zone.id] ?? config.layout.electoral_weights.default,
      adjacent_subzone_ids: [world.subzones[(index + world.subzones.length - 1) % world.subzones.length].id, world.subzones[(index + 1) % world.subzones.length].id],
      adjacent_biome_ids: [biomes[(biomeIndex + biomes.length - 1) % biomes.length].id, biomes[(biomeIndex + 1) % biomes.length].id],
      influence_sources: Object.fromEntries(FACTIONS.map(f => [f, emptySources()])),
      influence_per_second: factionRecord(0), net_change_per_second: factionRecord(0) };
  });
}

const emptySources = () => ({ sympathisants: 0, militants: 0, permanence: 0, candidate: 0, meeting: 0,
  tower: 0, tower_base: 0, tower_multiplier: 1, faction_multiplier: 1 });

export function meetingMultiplier(state, config, zoneId, faction) {
  return state.buildings.filter(b => b.type === 'meeting' && b.state === 'ACTIVE' && b.owner_id === faction
    && b.subzone_id === zoneId && b.meeting_until_tick > state.tick)
    .reduce((best, b) => Math.max(best, config.balance.buildings.meeting.ally_influence_multiplier_by_level[b.meeting_level - 1]), 1);
}

/** Source accounting is separate from transfers, so all towers use the same control state. */
export function refreshInfluenceSources(state, config) {
  const tower = config.balance.buildings.tour_communication;
  for (const zone of state.world.subzones) {
    const election = state.electorate.find(e => e.subzone_id === zone.id);
    const sources = Object.fromEntries(FACTIONS.map(f => [f, emptySources()]));
    for (const npc of localUnits(state, zone.id)) {
      if (npc.role === 'SYMPATHISANT') sources[npc.faction_id].sympathisants += config.balance.physical_units.sympathisant.local_influence_per_second;
      if (npc.role === 'MILITANT') sources[npc.faction_id].militants += config.balance.physical_units.militant.influence_per_second;
    }
    for (const building of state.buildings) {
      if (building.subzone_id === zone.id && building.type === 'permanence' && building.state === 'ACTIVE') {
        sources[building.owner_id].permanence += config.balance.buildings.permanence.local_influence_by_level[building.level - 1];
      }
    }
    for (const candidate of state.candidates) {
      if (!candidate.eliminated && candidate.campaign_active && !candidate.combat.attack_id && !candidate.combat.stun_ticks && !candidate.combat.hitstop_ticks
        && !candidate.combat.engaged && zoneAt(state.world, candidate.x).id === zone.id) sources[candidate.faction_id].candidate += config.balance.influence.candidate_presence_per_second;
    }
    for (const faction of FACTIONS) {
      const source = sources[faction];
      source.meeting = (source.sympathisants + source.militants) * (meetingMultiplier(state, config, zone.id, faction) - 1);
      source.tower_base = state.buildings.filter(b => b.type === 'tour_communication' && b.state === 'ACTIVE' && b.owner_id === faction)
        .reduce((sum, b) => sum + tower.global_influence_per_second_by_level[b.level - 1], 0);
      source.tower_multiplier = election.controller === faction ? tower.controlled_zone_multiplier
        : state.electorate.some(e => election.adjacent_subzone_ids.includes(e.subzone_id) && e.controller === faction) ? tower.adjacent_zone_multiplier : tower.distant_zone_multiplier;
      source.tower = source.tower_base * source.tower_multiplier * (state.phase === GamePhase.SECOND_ROUND_SPRINT ? config.balance.second_round.tower_influence_multiplier : 1);
      source.faction_multiplier = faction === 'le_pen' ? config.balance.influence.le_pen_gain_multiplier : 1;
      election.influence_per_second[faction] = (source.sympathisants + source.militants + source.permanence + source.candidate + source.meeting + source.tower) * source.faction_multiplier * influenceMultiplier(state, config);
    }
    election.influence_sources = sources;
  }
}

/** Visible recruits generate a rate; they never stand for a number of voters. */
export function updateInfluence(simulation) {
  const { state, config, hz } = simulation;
  refreshElectoralState(state, config);
  refreshInfluenceSources(state, config);
  for (const election of state.electorate) {
    const changes = convertInfluence(election, Object.fromEntries(FACTIONS.map(f => [f, election.influence_per_second[f] / hz])), config);
    for (const f of FACTIONS) election.net_change_per_second[f] = changes[f] * hz;
  }
  refreshElectoralState(state, config);
  refreshInfluenceSources(state, config);
}
