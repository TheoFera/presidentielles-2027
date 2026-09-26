import { random, zoneAt } from './world.js';
import { releaseDonation, scheduleNextDonation } from './money.js';

export const isVoter = npc => ['SYMPATHISANT', 'MILITANT', 'SERVICE_D_ORDRE'].includes(npc.role);

export function convertNeutral(sim, npc, faction, source = 'PERSUASION') {
  if (npc.role !== 'NEUTRE' || !faction) return false;
  npc.role = 'SYMPATHISANT';
  npc.faction_id = faction;
  npc.hidden_durability = sim.config.balance.physical_units.sympathisant.hidden_durability;
  npc.converted_tick = sim.state.tick;
  npc.persuasion = null;
  npc.roam_wait_ticks = sim.waitTicks();
  npc.donation_cents = 0;
  scheduleNextDonation(sim, npc);
  sim.emit('NpcConverted', { npc_id: npc.id, faction_id: faction, source });
  return true;
}

export function neutralizeSupporter(sim, npc, source = 'OPINION') {
  if (npc.role !== 'SYMPATHISANT') return false;
  const previousFaction = npc.faction_id;
  releaseDonation(sim, npc);
  for (const building of sim.state.buildings) for (const order of building.queue) {
    if (order.assigned_npc_id === npc.id) order.assigned_npc_id = null;
  }
  npc.role = 'NEUTRE';
  npc.faction_id = null;
  npc.hidden_durability = 0;
  npc.persuasion = null;
  npc.task = null;
  npc.roam_wait_ticks = sim.waitTicks();
  sim.emit('NpcNeutralized', { npc_id: npc.id, previous_faction_id: previousFaction, source });
  return true;
}

export function pickNpc(sim, candidates) {
  if (!candidates.length) return null;
  return candidates[Math.floor(random(sim.state) * candidates.length)];
}

export function applyOpinionDelta(sim, faction, deltaPoints, { biomeId = null, subzoneId = null, source = 'ÉVÉNEMENT' } = {}) {
  const magnitude = Math.abs(deltaPoints) * sim.config.layout.total_electors / 100;
  if (!(magnitude > 0)) return 0;
  let count = Math.floor(magnitude);
  if (random(sim.state) < magnitude - count) count++;
  let changed = 0;
  while (changed < count) {
    const eligible = sim.state.npcs.filter(npc => {
      const zone = zoneAt(sim.state.world, npc.x);
      return (!biomeId || zone.biome_id === biomeId) && (!subzoneId || zone.id === subzoneId)
        && (deltaPoints >= 0 ? npc.role === 'NEUTRE' : npc.role === 'SYMPATHISANT' && npc.faction_id === faction);
    });
    const npc = pickNpc(sim, eligible);
    if (!npc) break;
    if (deltaPoints >= 0) convertNeutral(sim, npc, faction, source);
    else neutralizeSupporter(sim, npc, source);
    changed++;
  }
  return changed;
}
