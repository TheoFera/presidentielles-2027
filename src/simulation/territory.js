import { FACTIONS, ringDelta, zoneAt } from './world.js';

export const stableIdOrder = (a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
export const distance = (state, a, b) => Math.abs(ringDelta(a, b, state.world.length));
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

export function incomePerSecond(state, config, factionId) {
  const money = config.balance.money;
  const buildings = state.buildings.filter(b => b.type === 'financement' && b.owner_id === factionId && b.state === 'ACTIVE');
  const income = money.base_passive_income_per_second + buildings.reduce((sum, b) => sum + config.balance.buildings.financement.income_per_second_by_level[b.level - 1], 0);
  return income * (factionId === 'philippe' ? money.philippe_income_multiplier : 1);
}

export function localPersuasionMultiplier(state, config, actor) {
  const subzoneId = zoneAt(state.world, actor.x).id;
  return state.buildings.filter(b => b.type === 'permanence' && b.owner_id === actor.faction_id && b.state === 'ACTIVE' && b.subzone_id === subzoneId)
    .reduce((multiplier, b) => Math.min(multiplier, config.balance.buildings.permanence.local_persuasion_time_multiplier_by_level[b.level - 1]), 1);
}

export function createElectorate(world, config) {
  return world.subzones.map(zone => {
    const support = { ...config.layout.starting_support.default };
    for (const faction of FACTIONS) {
      if (config.layout.starting_positions[faction] !== zone.id) continue;
      let bonus = config.layout.starting_support.home_zone_base_bonus_points[faction];
      if (faction === 'le_pen' && config.layout.starting_support.additional_le_pen_home_bonus_from_balance) bonus += config.balance.influence.le_pen_home_start_support_bonus_points;
      const actual = Math.min(support.neutral, bonus);
      support[faction] += actual; support.neutral -= actual;
    }
    return { subzone_id: zone.id, support, influence_per_second: factionRecord(0), net_change_per_second: factionRecord(0) };
  });
}

/** Visible recruits generate a rate; they never stand for a number of voters. */
export function updateInfluence(simulation) {
  const { state, config, hz } = simulation;
  const settings = config.balance.influence;
  for (const zone of state.world.subzones) {
    const election = state.electorate.find(e => e.subzone_id === zone.id);
    const rates = factionRecord(0);
    for (const npc of localUnits(state, zone.id)) {
      if (npc.role === 'SYMPATHISANT') rates[npc.faction_id] += config.balance.physical_units.sympathisant.local_influence_per_second;
      if (npc.role === 'MILITANT') rates[npc.faction_id] += config.balance.physical_units.militant.influence_per_second;
    }
    for (const building of state.buildings) {
      if (building.subzone_id === zone.id && building.type === 'permanence' && building.state === 'ACTIVE') {
        rates[building.owner_id] += config.balance.buildings.permanence.local_influence_by_level[building.level - 1];
      }
    }
    rates.le_pen *= settings.le_pen_gain_multiplier;
    election.influence_per_second = rates;
    const before = { ...election.support };
    const resistance = Math.pow(before.neutral / 100, settings.neutral_resistance_curve_power);
    const requested = FACTIONS.map(f => rates[f] / hz * resistance);
    const total = requested.reduce((a, b) => a + b, 0);
    const scale = total > 0 ? Math.min(1, before.neutral / total) : 0;
    FACTIONS.forEach((f, i) => { election.support[f] += requested[i] * scale; });
    // When neutral support is rare, modest transfers between opponents are simultaneous.
    if (before.neutral < settings.allow_opponent_conversion_below_neutral_percent) {
      const transfers = [];
      for (const receiver of FACTIONS) {
        const available = FACTIONS.filter(f => f !== receiver).reduce((sum, f) => sum + before[f], 0);
        if (!available) continue;
        for (const donor of FACTIONS.filter(f => f !== receiver)) transfers.push({ donor, receiver,
          amount: rates[receiver] / hz * (1 - resistance) * settings.opponent_conversion_multiplier * before[donor] / available });
      }
      for (const donor of FACTIONS) {
        const outgoing = transfers.filter(t => t.donor === donor);
        const demand = outgoing.reduce((sum, t) => sum + t.amount, 0);
        const ratio = demand ? Math.min(1, before[donor] / demand) : 0;
        for (const transfer of outgoing) {
          election.support[donor] -= transfer.amount * ratio;
          election.support[transfer.receiver] += transfer.amount * ratio;
        }
      }
    }
    election.support.neutral = Math.max(0, 100 - FACTIONS.reduce((sum, f) => sum + election.support[f], 0));
    for (const faction of FACTIONS) election.net_change_per_second[faction] = (election.support[faction] - before[faction]) * hz;
  }
}
