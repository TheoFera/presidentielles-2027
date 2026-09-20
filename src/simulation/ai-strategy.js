import { FACTIONS, ringDelta, zoneAt } from './world.js';
import { aiNoise, aiSettings } from './ai-settings.js';
import { aiCombatCommands } from './ai-combat.js';
import { aiEconomicTarget, buildingOffers } from './economy.js';
import { canBeHit, nearestEnemy } from './combat-state.js';
import { styleInfluenceMultiplier } from './campaign-styles.js';

const distance = (state, a, b) => Math.abs(ringDelta(a, b, state.world.length));
const hostile = (c, n) => canBeHit(n) && n.faction_id !== c.faction_id;

export function chooseAIObjective(state, config, c) {
  const settings = aiSettings(state, config), hz = config.balance.simulation_architecture.fixed_tick_hz;
  const opening = config.balance.ai_economy.enabled && state.phase === 'CAMPAIGN' && !c.headquarters_site_id && state.tick < settings.opening_seconds * hz;
  if (opening) {
    const sites = state.buildings.filter(b => b.type === 'permanence' && !b.owner_id);
    sites.sort((a, b) => distance(state, c.x, a.x) - distance(state, c.x, b.x) || a.id.localeCompare(b.id));
    if (sites[0]) return { subzone_id: sites[0].subzone_id, purpose: 'SETUP', expires_tick: Math.ceil(settings.opening_seconds * hz) };
  }
  const previous = c.ai_objective;
  const oldZone = state.electorate.find(e => e.subzone_id === previous?.subzone_id);
  if (previous && previous.expires_tick > state.tick && previous.purpose !== 'SETUP'
    && oldZone && (previous.purpose === 'CONQUER' ? oldZone.controller !== c.faction_id
      : previous.purpose === 'DEFEND' && oldZone.net_change_per_second[c.faction_id] < 0)) return previous;
  const choices = state.electorate.map(e => {
    const zone = state.world.subzones.find(z => z.id === e.subzone_id);
    const units = state.npcs.filter(n => zoneAt(state.world, n.x).id === zone.id);
    const neutral = units.filter(n => n.role === 'NEUTRE').length;
    const enemies = units.filter(n => hostile(c, n));
    const enemySites = state.buildings.filter(b => b.subzone_id === zone.id && b.owner_id && b.owner_id !== c.faction_id && b.state === 'ACTIVE').length;
    const enemyOwned = e.controller && e.controller !== c.faction_id || enemySites > 0
      || enemies.length > units.filter(n => n.faction_id === c.faction_id).length + 1;
    const allied = e.controller === c.faction_id;
    const threatened = allied && e.net_change_per_second[c.faction_id] < 0;
    const frontier = state.electorate.some(n => e.adjacent_subzone_ids.includes(n.subzone_id) && n.controller === c.faction_id);
    const rivalSupport = Math.max(...FACTIONS.filter(f => f !== c.faction_id).map(f => e.support[f]));
    const score = (enemyOwned ? settings.enemy_priority : allied ? -35 : 12) + (threatened ? 40 : 0)
      + (frontier ? 12 : 0) + neutral * 1.4 + enemySites * 6 + Math.min(12, enemies.length * 2)
      - enemies.filter(n => ['MILITANT', 'SERVICE_D_ORDRE'].includes(n.role)).length * 3
      + e.electoral_weight * 2 - Math.max(0, rivalSupport - e.support[c.faction_id]) * 0.2
      + (styleInfluenceMultiplier(config, c, zone.biome_id) - 1) * 30
      - distance(state, c.x, zone.center) * 0.6 - (previous?.subzone_id === zone.id ? 10 : 0)
      + aiNoise(state.seed, `${c.id}:${zone.id}`) * 3;
    return { zone, score, purpose: threatened ? 'DEFEND' : 'CONQUER' };
  }).sort((a, b) => b.score - a.score || a.zone.id.localeCompare(b.zone.id));
  const best = choices[0];
  const travelSeconds = distance(state, c.x, best.zone.center) / config.prototype.movement.candidate_speed_units_per_second;
  return { subzone_id: best.zone.id, purpose: best.purpose,
    expires_tick: state.tick + Math.ceil((travelSeconds + settings.commitment_seconds) * hz) };
}

export function strategicAICommands(state, config, c) {
  const settings = aiSettings(state, config);
  const commands = (axis, purchase = false) => [{ type: 'SetCampaignActive', candidateId: c.id, active: state.ai_enabled },
    { type: 'InteractionPresence', candidateId: c.id, active: state.ai_enabled && purchase }, { type: 'Move', candidateId: c.id, axis }];
  if (!state.ai_enabled || c.is_ko) return [...commands(0), { type: 'CancelAttack', candidateId: c.id }];
  if (c.combat.press_tick != null) {
    const target = nearestEnemy(state, c, settings.detection_range);
    return target ? aiCombatCommands(state, config, c, target) : [...commands(0), { type: 'CancelAttack', candidateId: c.id }];
  }
  const go = (x, radius, purchase = false) => {
    const d = ringDelta(c.x, x, state.world.length), arrived = Math.abs(d) <= radius;
    return commands(arrived ? 0 : Math.sign(d), arrived && purchase);
  };
  const danger = nearestEnemy(state, c, settings.detection_range);
  // Repli avec hystérésis : se mettre hors de portée puis récupérer avant de repartir.
  const recovering = c.ai_objective?.purpose === 'RECOVER' && c.resistance < config.balance.candidate_combat.resistance_max * 0.8;
  if (recovering || danger && c.resistance < config.balance.candidate_combat.resistance_max * settings.retreat_ratio) {
    const safeZones = state.world.subzones.map(z => ({ z, danger: [...state.candidates, ...state.npcs, ...state.temporary_units]
      .filter(n => hostile(c, n) && distance(state, z.center, n.x) <= config.balance.candidate_combat.recovery_safe_distance + z.width / 2).length }))
      .sort((a, b) => a.danger - b.danger || distance(state, c.x, a.z.center) - distance(state, c.x, b.z.center));
    const safe = safeZones[0].z;
    const result = danger ? commands(-(Math.sign(ringDelta(c.x, danger.x, state.world.length)) || c.facing)) : go(safe.center, 1);
    if (danger && settings.dash && c.dash_charges > 0) result.push({ type: 'Dash', candidateId: c.id, direction: result[2].axis });
    return [{ type: 'SetAIObjective', candidateId: c.id, objective: { subzone_id: safe.id, purpose: 'RECOVER', expires_tick: state.tick + 10 * config.balance.simulation_architecture.fixed_tick_hz } }, ...result];
  }
  const objective = chooseAIObjective(state, config, c);
  const plan = objective === c.ai_objective ? [] : [{ type: 'SetAIObjective', candidateId: c.id, objective }];
  const zone = state.world.subzones.find(z => z.id === objective.subzone_id);
  const here = zoneAt(state.world, c.x).id === zone.id;
  // Ne pas poursuivre un candidat à travers toute la carte : défendre au contact,
  // ou éliminer les soutiens qui tiennent réellement l’objectif de conquête.
  const opponent = nearestEnemy(state, c, settings.detection_range, n =>
    distance(state, c.x, n.x) <= config.balance.candidate_combat.light_range
    || n.combat?.target_id === c.id
    || zoneAt(state.world, n.x).id === zone.id);
  if (opponent) return [...plan, ...aiCombatCommands(state, config, c, opponent)];
  const retained = state.npcs.find(n => n.role === 'NEUTRE' && n.persuasion?.actor_id === c.id);
  if (retained) return [...plan, ...commands(0)];
  // Finir une transaction engagée évite de remettre son compteur à zéro.
  if (c.purchase_hold) {
    const site = state.buildings.find(b => b.id === c.purchase_hold.target_id);
    const offer = site && buildingOffers(state, config, c, site).find(o => o.key === c.purchase_hold.key && o.enabled);
    if (offer) return [...plan, ...go(offer.x, offer.radius * config.prototype.ai.stop_distance_radius_ratio, true)];
  }
  const economic = aiEconomicTarget(state, config, c, objective);
  if (economic) return [...plan, ...go(economic.x, economic.interaction_radius * config.prototype.ai.stop_distance_radius_ratio, true)];
  const targets = state.npcs.filter(n => n.role === 'NEUTRE' && !n.persuasion && zoneAt(state.world, n.x).id === zone.id)
    .sort((a, b) => distance(state, c.x, a.x) - distance(state, c.x, b.x) || a.id.localeCompare(b.id));
  if (targets[0]) return [...plan, ...go(targets[0].x, config.prototype.persuasion.radius_units * config.prototype.ai.stop_distance_radius_ratio)];
  // Après avoir recruté, traverser la zone pour en chasser les soutiens adverses.
  const defenders = state.npcs.filter(n => hostile(c, n) && zoneAt(state.world, n.x).id === zone.id)
    .sort((a, b) => distance(state, c.x, a.x) - distance(state, c.x, b.x) || a.id.localeCompare(b.id));
  if (here && defenders[0]) return [...plan, ...aiCombatCommands(state, config, c, defenders[0])];
  return [...plan, ...go(zone.center, config.prototype.persuasion.radius_units)];
}
