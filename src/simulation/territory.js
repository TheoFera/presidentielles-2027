import { combatDelta } from './combat-geometry.js';
import { FACTIONS, zoneAt } from './world.js';
import { emptySupport } from './electoral-state.js';

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

export function populationByOrigin(state, subzoneId) {
  return state.npcs.filter(n => n.origin_subzone_id === subzoneId).length;
}

export function incomeBreakdown(state, config, factionId) {
  const byBiome = Object.fromEntries(config.layout.biomes.map(b => [b.id, {
    count: 0, donation_eur: config.balance.money.donation.base_eur * config.balance.money.donation.biome_multipliers[b.id], held_eur: 0,
  }]));
  for (const npc of state.npcs) {
    if (npc.faction_id !== factionId || npc.role !== 'SYMPATHISANT') continue;
    byBiome[npc.origin_biome_id].count++;
    byBiome[npc.origin_biome_id].held_eur += npc.donation_cents / 100;
  }
  const held_eur = Object.values(byBiome).reduce((sum, biome) => sum + biome.held_eur, 0);
  const stored_eur = state.buildings.filter(b => b.type === 'financement' && b.owner_id === factionId)
    .reduce((sum, b) => sum + b.stored_money_cents / 100, 0);
  return { byBiome, held_eur, stored_eur };
}

export const incomePerSecond = () => 0;

export function localPersuasionMultiplier(state, config, actor) {
  const subzoneId = zoneAt(state.world, actor.x).id;
  return state.buildings.filter(b => b.type === 'permanence' && b.owner_id === actor.faction_id && b.state === 'ACTIVE' && b.subzone_id === subzoneId)
    .reduce((multiplier, b) => Math.min(multiplier, config.balance.buildings.permanence.local_persuasion_time_multiplier_by_level[b.level - 1]), 1);
}

export function createElectorate(world, config) {
  return world.subzones.map((zone, index) => {
    const biomes = config.layout.biomes;
    const biomeIndex = biomes.findIndex(b => b.id === zone.biome_id);
    return { subzone_id: zone.id, biome_id: zone.biome_id, support: emptySupport(), leader: null, controller: null,
      electoral_weight: zone.max_npcs_by_origin,
      adjacent_subzone_ids: [world.subzones[(index + world.subzones.length - 1) % world.subzones.length].id, world.subzones[(index + 1) % world.subzones.length].id],
      adjacent_biome_ids: [biomes[(biomeIndex + biomes.length - 1) % biomes.length].id, biomes[(biomeIndex + 1) % biomes.length].id] };
  });
}
