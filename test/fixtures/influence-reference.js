// Previous algorithm, kept as an independent numerical reference for the
// per-call indexes. In particular, additions retain their original order.
import { FACTIONS, zoneAt } from '../../src/simulation/world.js';
import { localUnits, meetingMultiplier } from '../../src/simulation/territory.js';
import { influenceMultiplier, GamePhase } from '../../src/simulation/phases.js';
import { styleInfluenceMultiplier } from '../../src/simulation/campaign-styles.js';

export function refreshInfluenceReference(state, config) {
  const tower = config.balance.buildings.tour_communication;
  for (const zone of state.world.subzones) {
    const election = state.electorate.find(e => e.subzone_id === zone.id);
    const sources = Object.fromEntries(FACTIONS.map(f => [f, { sympathisants: 0, militants: 0, permanence: 0, candidate: 0, meeting: 0, tower: 0, tower_base: 0, tower_multiplier: 1, faction_multiplier: 1 }]));
    for (const npc of localUnits(state, zone.id)) {
      if (npc.role === 'SYMPATHISANT') sources[npc.faction_id].sympathisants += config.balance.physical_units.sympathisant.local_influence_per_second;
      if (npc.role === 'MILITANT') sources[npc.faction_id].militants += config.balance.physical_units.militant.influence_per_second;
    }
    for (const building of state.buildings) {
      if (building.subzone_id === zone.id && building.type === 'permanence' && building.state === 'ACTIVE') {
        const value = config.balance.buildings.permanence.local_influence_by_level[building.level - 1];
        sources[building.owner_id].permanence += value * (building.headquarters ? config.balance.buildings.permanence.hq_influence_multiplier : 1);
      }
    }
    for (const candidate of state.candidates) {
      if (!candidate.eliminated && !candidate.campaign_arena_id && !candidate.is_ko && candidate.campaign_active && !candidate.combat.attack_id && !candidate.combat.stun_ticks && !candidate.combat.hitstop_ticks
        && !candidate.combat.engaged && zoneAt(state.world, candidate.x).id === zone.id) sources[candidate.faction_id].candidate += config.balance.influence.candidate_presence_per_second;
    }
    for (const faction of FACTIONS) {
      const source = sources[faction];
      source.meeting = (source.sympathisants + source.militants) * (meetingMultiplier(state, config, zone.id, faction) - 1);
      source.tower_base = state.buildings.filter(b => b.type === 'tour_communication' && b.state === 'ACTIVE' && b.owner_id === faction)
        .reduce((sum, b) => sum + tower.global_influence_per_second_by_level[b.level - 1], 0);
      const level = Math.max(1, state.buildings.find(b => b.type === 'tour_communication' && b.state === 'ACTIVE' && b.owner_id === faction)?.level || 1);
      source.tower_multiplier = election.controller === faction ? tower.controlled_zone_multiplier_by_level[level - 1]
        : state.electorate.some(e => election.adjacent_subzone_ids.includes(e.subzone_id) && e.controller === faction) ? tower.adjacent_zone_multiplier_by_level[level - 1] : tower.distant_zone_multiplier_by_level[level - 1];
      source.tower = source.tower_base * source.tower_multiplier * (state.phase === GamePhase.SECOND_ROUND_SPRINT ? config.balance.second_round.tower_influence_multiplier : 1);
      source.faction_multiplier = faction === 'le_pen' ? config.balance.influence.le_pen_gain_multiplier : 1;
      election.influence_per_second[faction] = (source.sympathisants + source.militants + source.permanence + source.candidate + source.meeting + source.tower) * source.faction_multiplier * influenceMultiplier(state, config) * styleInfluenceMultiplier(config, state.candidates.find(c => c.faction_id === faction), election.biome_id);
    }
    election.influence_sources = sources;
  }
}
