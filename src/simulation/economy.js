import { isMinorFaction, subzoneGap, wrap, zoneAt } from './world.js';
import { biomeSympathisants, distance, localSympathisants, stableIdOrder } from './territory.js';
import { buildingSettings, printsTracts } from './building-rules.js';
import { commitFactionAction, factionOffers, nearestFactionOffer } from './faction-buildings.js';
import { canCampaign } from './combat-state.js';
import { candidateOnMeetingStage, meetingOffers, triggerMeeting } from './electoral-buildings.js';
import { paymentStatus } from './campaign-budget.js';
import { captureLimitReason, captureSite, createInfrastructure, localPoliticalPresence } from './strategic-sites.js';
import { publishPoll } from './electoral-state.js';

export { createInfrastructure } from './strategic-sites.js';

/** Authoritative quote. The renderer only displays this result and the saved timer. */
export function buildingOffer(state, config, candidate, building) {
  if (candidate.eliminated || !['CAMPAIGN', 'SECOND_ROUND_SPRINT'].includes(state.phase)) return null;
  if (building.type === 'faction') return nearestFactionOffer(state, config, candidate, building);
  if (building.type === 'meeting' && state.campaign_events?.some(e => e.status === 'ACTIVE' && e.target_site_id === building.id && ['MEETING_DE_CRISE', 'DEBAT_THEMATIQUE'].includes(e.family))) return null;
  if (building.type === 'meeting') return meetingOffers(state, config, candidate, building)
    .sort((a, b) => distance(state, candidate.x, a.x) - distance(state, candidate.x, b.x))[0] || null;
  const printing = building.type === 'imprimerie' || building.type === 'permanence' && building.state === 'ACTIVE' && building.owner_id === candidate.faction_id;
  const settings = printing ? config.balance.buildings.imprimerie : buildingSettings(config, building, candidate.faction_id);
  let kind; let cost; let available = true; let reason = null;
  if (printing) {
    kind = 'PRINT'; cost = settings.tract_cost_by_level[building.level - 1];
    if (biomeSympathisants(state, building.biome_id, candidate.faction_id).length < settings.required_local_sympathisants_to_use) {
      available = false; reason = 'NO_SYMPATHISANT';
    }
  } else if (building.type === 'institut_sondage') {
    kind = 'POLL'; cost = settings.poll_cost;
  } else if (['EMPTY', 'NEUTRAL', 'CLOSED'].includes(building.state)) {
    kind = 'CAPTURE'; cost = building.type === 'permanence' && !candidate.headquarters_site_id
      ? settings.first_headquarters_capture_cost : settings.capture_cost;
    const presence = localPoliticalPresence(state, building.subzone_id, candidate.faction_id);
    const required = settings.required_presence_N1;
    if (presence < required) { available = false; reason = 'INSUFFICIENT_PRESENCE'; }
    reason ||= captureLimitReason(state, config, building, candidate.faction_id);
  } else if (building.owner_id === candidate.faction_id && building.level < settings.max_level) {
    kind = 'UPGRADE'; cost = settings.upgrade_costs[building.level - 1];
    if (localPoliticalPresence(state, building.subzone_id, candidate.faction_id) < settings[`required_presence_N${building.level + 1}`]) {
      available = false; reason = 'INSUFFICIENT_PRESENCE';
    }
  } else return null;
  if (building.type === 'tour_communication' && kind === 'CAPTURE'
    && state.buildings.filter(b => b.type === building.type && b.owner_id === candidate.faction_id && b.state === 'ACTIVE').length >= settings.global_limit) {
    available = false; reason = 'GLOBAL_LIMIT';
  }
  return { target_id: building.id, key: `${building.id}:${kind}:${building.level}`, kind, cost,
    required_ticks: Math.ceil((kind === 'CAPTURE' ? settings.capture_seconds : settings.purchase_hold_seconds ?? config.balance.interaction.default_hold_seconds) * config.balance.simulation_architecture.fixed_tick_hz),
    ...paymentStatus(candidate, config, cost, available ? null : reason) };
}

export function buildingOffers(state, config, candidate, building) {
  if (building.type === 'meeting' && state.campaign_events?.some(e => e.status === 'ACTIVE' && e.target_site_id === building.id && ['MEETING_DE_CRISE', 'DEBAT_THEMATIQUE'].includes(e.family))) return [];
  if (candidate.eliminated || !['CAMPAIGN', 'SECOND_ROUND_SPRINT'].includes(state.phase)) return [];
  // Un candidat mineur n'achète rien, et son QG est imprenable tant qu'il est en campagne.
  if (candidate.minor || isMinorFaction(building.owner_id)) return [];
  if (building.type === 'faction') return factionOffers(state, config, candidate, building);
  if (building.type === 'meeting') return meetingOffers(state, config, candidate, building);
  const offer = buildingOffer(state, config, candidate, building);
  const offers = offer ? [{ ...offer, x: building.x, radius: config.balance.interaction.radius_units }] : [];
  if (building.type === 'financement' && building.state === 'ACTIVE' && building.owner_id === candidate.faction_id
    && building.level < config.balance.buildings.financement.max_level) {
    const settings = config.balance.buildings.financement;
    const reason = localPoliticalPresence(state, building.subzone_id, candidate.faction_id) < settings[`required_presence_N${building.level + 1}`]
      ? 'INSUFFICIENT_PRESENCE' : null;
    const cost = settings.upgrade_costs[building.level - 1];
    offers.push({ target_id: building.id, key: `${building.id}:UPGRADE:${building.level}`, kind: 'UPGRADE', cost,
      required_ticks: Math.ceil(settings.purchase_hold_seconds * config.balance.simulation_architecture.fixed_tick_hz),
      x: wrap(building.x + settings.upgrade_offset, state.world.length), radius: settings.upgrade_radius, label: 'AMÉLIORER',
      ...paymentStatus(candidate, config, cost, reason) });
  }
  return offers;
}

export function nearestOffer(state, config, candidate) {
  const offers = state.buildings.filter(b => b.id !== candidate.purchase_latch_target_id).flatMap(b => buildingOffers(state, config, candidate, b));
  return offers.filter(o => distance(state, candidate.x, o.x) <= o.radius
    && (o.kind !== 'MEETING' || candidateOnMeetingStage(state, config, candidate,
      state.buildings.find(building => building.id === o.target_id))))
    .sort((a, b) => distance(state, candidate.x, a.x) - distance(state, candidate.x, b.x) || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0))[0] || null;
}

function transact(simulation, candidate, offer) {
  const { state, config } = simulation;
  const building = state.buildings.find(b => b.id === offer.target_id);
  const fresh = buildingOffers(state, config, candidate, building).find(o => o.key === offer.key);
  if (!fresh?.enabled || !paymentStatus(candidate, config, fresh.cost).enabled || fresh.key !== offer.key || distance(state, candidate.x, fresh.x ?? building.x) > (fresh.radius ?? config.balance.interaction.radius_units)) return false;
  const transaction = { id: `transaction:${state.next_transaction_id++}`, tick: state.tick, candidate_id: candidate.id,
    faction_id: candidate.faction_id, target_id: building.id, kind: fresh.kind, cost: fresh.cost };
  // One synchronous commit: ownership/queue validation and money are never split by a UI callback.
  candidate.money = Math.max(0, candidate.money - fresh.cost);
  candidate.total_spent += fresh.cost;
  candidate.spending[fresh.kind] = (candidate.spending[fresh.kind] || 0) + fresh.cost;
  state.transactions.push(transaction);
  if (state.transactions.length > config.balance.debug.transaction_history_limit) state.transactions.shift();
  const handled = fresh.kind === 'MEETING' ? triggerMeeting(simulation, building, candidate.faction_id, candidate.id)
    : fresh.kind === 'POLL' ? (publishPoll(simulation, candidate.faction_id, building), true)
    : commitFactionAction(simulation, candidate, building, fresh);
  if (handled) {
    // Raid, equipment and closure are committed through the same transaction path.
  } else if (fresh.kind === 'PRINT') {
    const order = { id: `order:${state.next_order_id++}`, service_id: building.id, faction_id: candidate.faction_id,
      purchased_tick: state.tick, cost: fresh.cost, assigned_npc_id: null, state: 'QUEUED', production_elapsed_ticks: 0 };
    building.queue.push(order);
    simulation.emit('TractOrdered', { ...transaction, order_id: order.id });
  } else if (fresh.kind === 'CAPTURE') {
    captureSite(simulation, building, candidate);
  } else {
    building.level++;
    simulation.emit('BuildingUpgraded', { ...transaction, level: building.level });
  }
  building.last_action_tick = state.tick;
  if (['EQUIP', 'POLL', 'RAID', 'CLOSE'].includes(fresh.kind)) {
    candidate.purchase_latch_target_id = building.id;
  }
  // Les tracts s'enchaînent tant qu'on reste devant : courte pause, sans devoir repartir.
  if (['CAPTURE', 'UPGRADE', 'PRINT'].includes(fresh.kind)) candidate.interaction_pause_until_tick = state.tick + simulation.secondsToTicks(buildingSettings(config, building).upgrade_pause_seconds || 0.4);
  if (fresh.kind === 'MEETING') {
    candidate.interaction_chain_site_id = building.id;
    candidate.interaction_pause_until_tick = state.tick + simulation.secondsToTicks(config.balance.buildings.meeting.upgrade_pause_seconds);
  }
  candidate.purchase_hold = null;
  return true;
}

export function updateEconomy(simulation) {
  const { state, config } = simulation;
  for (const building of state.buildings) if (building.ownership_model === 'capturable' && building.state !== 'ACTIVE') building.capture_progress = 0;
  for (const candidate of [...state.candidates].sort(stableIdOrder)) {
    if (candidate.eliminated) continue;
    candidate.income_per_second = 0;
    const latched = state.buildings.find(b => b.id === candidate.purchase_latch_target_id);
    if (latched && distance(state, candidate.x, latched.x) > config.balance.interaction.radius_units) candidate.purchase_latch_target_id = null;
    const chained = state.buildings.find(b => b.id === candidate.interaction_chain_site_id);
    const chainRadius = chained?.type === 'meeting' ? config.balance.buildings.meeting.interaction_radius : config.balance.interaction.radius_units;
    if (chained && distance(state, candidate.x, chained.x) > chainRadius) candidate.interaction_chain_site_id = null;
    if (candidate.vehicle || state.campaign_style_selection || candidate.style_interaction_held || candidate.style_hold || !candidate.campaign_active || !candidate.interaction_active || !canCampaign(candidate) || state.tick < (candidate.interaction_pause_until_tick || 0)) { candidate.purchase_hold = null; continue; }
    const offer = nearestOffer(state, config, candidate);
    for (const building of state.buildings) if (building.id === offer?.target_id) {
      building.next_level_available = !!offer.enabled;
      building.level_lock_reason = offer.reason || null;
      if (building.state !== 'ACTIVE') building.required_presence = buildingSettings(config, building, candidate.faction_id).required_presence_N1;
    }
    if (!offer?.enabled) { candidate.purchase_hold = null; continue; }
    if (candidate.purchase_hold?.key !== offer.key) candidate.purchase_hold = { ...offer, elapsed_ticks: 0 };
    candidate.purchase_hold.elapsed_ticks++;
    const heldBuilding = state.buildings.find(b => b.id === candidate.purchase_hold.target_id);
    if (heldBuilding && candidate.purchase_hold.kind === 'CAPTURE') heldBuilding.capture_progress = candidate.purchase_hold.elapsed_ticks / candidate.purchase_hold.required_ticks;
    if (candidate.purchase_hold.elapsed_ticks >= offer.required_ticks) {
      transact(simulation, candidate, offer);
      candidate.purchase_hold = null;
    }
  }
  // A rival may have claimed the same slot in this tick. Remove any obsolete hold immediately.
  for (const candidate of state.candidates) {
    if (candidate.purchase_hold && nearestOffer(state, config, candidate)?.key !== candidate.purchase_hold.key) candidate.purchase_hold = null;
    candidate.income_per_second = 0;
  }
}

export function updateProduction(simulation) {
  const { state, config } = simulation;
  const settings = config.balance.buildings.imprimerie;
  for (const service of state.buildings.filter(b => printsTracts(b) && b.state === 'ACTIVE').sort(stableIdOrder)) {
    for (const order of service.queue) {
      const worker = state.npcs.find(n => n.id === order.assigned_npc_id);
      if (worker && (worker.role !== 'SYMPATHISANT' || worker.task?.order_id !== order.id || worker.faction_id !== order.faction_id)) order.assigned_npc_id = null;
      if (!worker) order.assigned_npc_id = null;
      if (order.assigned_npc_id) continue;
      // Un sympathisant ne traverse pas la carte pour un tract : il vient de la sous-zone du point d’impression ou d’une voisine.
      const serviceZone = zoneAt(state.world, service.x);
      const eligible = state.npcs.filter(n => n.role === 'SYMPATHISANT' && n.faction_id === order.faction_id
        && !n.task && !n.rally_event_id && n.rally_return_x == null
        && subzoneGap(state.world, zoneAt(state.world, n.x), serviceZone) <= config.balance.physical_units.sympathisant.tract_pickup_zone_radius)
        .sort((a, b) => distance(state, a.x, service.x) - distance(state, b.x, service.x) || stableIdOrder(a, b));
      if (eligible.length) {
        const npc = eligible[0];
        order.assigned_npc_id = npc.id;
        npc.task = { kind: 'COLLECT_TRACT', order_id: order.id, service_id: service.id, target_id: service.id,
          destination_x: service.x, destination_subzone_id: service.subzone_id, phase: 'TRAVEL', elapsed_ticks: 0 };
        simulation.emit('TractWorkerAssigned', { npc_id: npc.id, order_id: order.id, service_id: service.id });
      }
    }
    const next = service.queue.find(order => order.state !== 'READY');
    if (!next) continue;
    next.state = 'PRINTING';
    next.production_elapsed_ticks++;
    if (next.production_elapsed_ticks >= simulation.secondsToTicks(settings.equipment_seconds_by_level[service.level - 1])) {
      next.state = 'READY';
      simulation.emit('TractReady', { order_id: next.id, service_id: service.id });
    }
  }
}

/** Compatibilité des outils : le développement initial vise un QG réellement capturable. */
export function aiDevelopmentZone(state, config, candidate) {
  if (candidate.headquarters_site_id) return null;
  const site = state.buildings.filter(b => b.type === 'permanence' && !b.owner_id)
    .sort((a, b) => distance(state, candidate.x, a.x) - distance(state, candidate.x, b.x) || stableIdOrder(a, b))[0];
  return site ? { zone: state.world.subzones.find(z => z.id === site.subzone_id), next_type: 'permanence', desired_kind: 'CAPTURE' } : null;
}

/** Même devis, présence et budget que le joueur ; aucun achat à distance. */
export function aiEconomicTarget(state, config, candidate, objective = null, adaptation = null) {
  const settings = config.balance.ai_economy;
  if (!settings.enabled) return null;
  // Adaptation : face à un humain dominant, l’IA accepte de plus longs détours et lance plus volontiers ses meetings.
  const boost = Math.max(0, adaptation?.boost ?? 0);
  const spared = adaptation?.spared ?? new Set();
  const zone = zoneAt(state.world, candidate.x);
  // Comme un bon joueur, l’IA ne garde pas son argent : plus elle en a, plus elle fait de détours pour le dépenser.
  const wealth = Math.min(1, Math.max(0, candidate.money / (settings.investment_reference_k ?? 20)));
  // Militants, service d’ordre, raids, fermetures et nouvelles permanences valent un vrai trajet.
  const armyDetour = (settings.army_detour_units ?? 0) * (1 + boost);
  const hasFactionSite = state.buildings.some(b => b.type === 'faction' && b.owner_id === candidate.faction_id && b.state === 'ACTIVE');
  // Tant qu’elle n’a pas de local de faction, l’IA met de côté de quoi en prendre un, au lieu de tout disperser.
  const freeSlot = !hasFactionSite && candidate.headquarters_site_id && state.phase === 'CAMPAIGN'
    && state.buildings.find(b => b.type === 'faction' && ['EMPTY', 'NEUTRAL', 'CLOSED'].includes(b.state));
  const savings = freeSlot ? buildingSettings(config, freeSlot, candidate.faction_id).capture_cost : 0;
  const options = [];
  for (const building of state.buildings) {
    if (building.id === candidate.purchase_latch_target_id) continue;
    const local = building.subzone_id === (objective?.subzone_id ?? zone.id);
    // Les autres investissements hors objectif restent des détours sur le trajet.
    const detour = (building.owner_id === candidate.faction_id ? 10 : 4) * (1 + boost) * (1 + 2 * wealth);
    const far = distance(state, candidate.x, building.x);
    if (!local && (objective?.purpose === 'SETUP' || far > Math.max(detour, armyDetour))) continue;
    for (const offer of buildingOffers(state, config, candidate, building)) {
      const firstHQ = !candidate.headquarters_site_id && building.type === 'permanence' && offer.kind === 'CAPTURE';
      const firstFunding = building.type === 'financement' && offer.kind === 'CAPTURE'
        && !state.buildings.some(b => b.type === 'financement' && b.owner_id === candidate.faction_id && b.state === 'ACTIVE');
      // Une permanence dans un nouveau quartier y fait remonter les dons : c’est un placement, pas une dépense.
      const newBranch = building.type === 'permanence' && offer.kind === 'CAPTURE' && !firstHQ
        && !state.buildings.some(b => b.type === 'permanence' && b.owner_id === candidate.faction_id && b.state === 'ACTIVE' && b.biome_id === building.biome_id);
      const army = ['PRINT', 'EQUIP', 'RAID', 'CLOSE'].includes(offer.kind) || newBranch
        || building.type === 'faction' && offer.kind === 'CAPTURE' && !hasFactionSite;
      if (!local && far > (army ? Math.max(detour, armyDetour) : detour)) continue;
      if (!offer.enabled && !(offer.kind === 'MEETING' && offer.reason === 'NOT_ON_STAGE')) continue;
      if (offer.kind === 'POLL') continue;
      // Les petites dépenses (tracts, équipement) restent permises pendant l’épargne.
      if (savings && building.type !== 'faction' && !firstHQ && !newBranch && offer.cost > 1 && candidate.money - offer.cost < savings) continue;
      if (objective?.purpose === 'SETUP' && !(building.type === 'permanence' && offer.kind === 'CAPTURE')) continue;
      if (offer.kind === 'PRINT') {
        const supporters = biomeSympathisants(state, building.biome_id, candidate.faction_id, true);
        const queued = state.buildings.filter(b => b.biome_id === building.biome_id && printsTracts(b))
          .flatMap(b => b.queue).filter(o => o.faction_id === candidate.faction_id).length;
        const militants = state.npcs.filter(n => n.faction_id === candidate.faction_id && n.role === 'MILITANT' && zoneAt(state.world, n.x).biome_id === building.biome_id).length;
        if (supporters.length - queued <= settings.reserve_sympathisants_per_biome || militants + queued >= settings.militant_goal_per_biome) continue;
        // Préserver les soutiens indispensables au maintien des sites déjà capturés.
        if (supporters.some(n => state.buildings.some(b => b.subzone_id === zoneAt(state.world, n.x).id && b.owner_id === candidate.faction_id
          && b.state === 'ACTIVE' && localSympathisants(state, b.subzone_id, candidate.faction_id).length - queued <= (buildingSettings(config, b).required_presence_N1 ?? 0)))) continue;
      }
      // Un service d’ordre de quelques gardes suffit pour lancer des raids.
      if (offer.kind === 'EQUIP' && state.npcs.filter(n => n.role === 'SERVICE_D_ORDRE' && n.source_site_id === building.id).length
        + building.queue.length >= (settings.guard_goal_per_site ?? Infinity)) continue;
      // Laisser respirer un humain distancé : pas de fermeture administrative contre lui.
      if (offer.kind === 'CLOSE' && spared.has(state.buildings.find(b => b.id === offer.victim_id)?.owner_id)) continue;
      if (offer.kind === 'RAID') {
        const direction = offer.direction;
        const enemy = state.buildings.some(b => b.state === 'ACTIVE' && b.owner_id && b.owner_id !== candidate.faction_id
          && wrap((b.x - building.x) * direction, state.world.length) < state.world.length / 2);
        if (!enemy) continue;
      }
      // Le local de faction, ses gardes, puis ses raids et fermetures, sont les coups décisifs : ils valent un long trajet.
      const decisive = building.type === 'faction' && (offer.kind === 'CAPTURE' ? !hasFactionSite : ['EQUIP', 'RAID', 'CLOSE'].includes(offer.kind));
      const priority = offer.kind === 'CAPTURE' ? (firstHQ ? 0 : decisive ? 0.5 : newBranch ? 1.5 : firstFunding ? 2
        : building.type === 'tour_communication' ? 3 : building.type === 'financement' ? 4 : 5)
        : offer.kind === 'CLOSE' || offer.kind === 'RAID' ? 1
        : offer.kind === 'UPGRADE' ? 2.5 : offer.kind === 'PRINT' ? 3 : offer.kind === 'EQUIP' ? 2
        : offer.kind === 'MEETING' ? 7 - 4 * boost : 8;
      options.push({ ...building, x: offer.x, interaction_radius: offer.radius, offer, decisive,
        rank: priority + distance(state, candidate.x, offer.x) * (decisive ? 0.1 : 0.35) });
    }
  }
  return options.sort((a, b) => a.rank - b.rank || a.offer.key.localeCompare(b.offer.key))[0] || null;
}
