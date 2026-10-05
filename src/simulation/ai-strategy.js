import { FACTIONS, isMinorFaction, ringDelta, zoneAt } from './world.js';
import { aiNoise, aiSettings } from './ai-settings.js';
import { aiCombatCommands, aiAttackRange } from './ai-combat.js';
import { aiEconomicTarget, buildingOffers } from './economy.js';
import { candidateOnMeetingStage } from './electoral-buildings.js';
import { canBeHit, nearestEnemy } from './combat-state.js';
import { styleInfluenceMultiplier } from './campaign-styles.js';
import { adaptationSettings, aiAdaptation, factionPressure } from './ai-balance.js';
import { approaching, observeAxis, reflectOnRival, thinkingPause, validMind, visibleRival, worthChasing } from './ai-mind.js';
import { campaignEventAICommands } from './ai-events.js';
import { isHumanCandidate } from './human-candidates.js';

const distance = (state, a, b) => Math.abs(ringDelta(a, b, state.world.length));
const hostile = (c, n) => canBeHit(n) && n.faction_id !== c.faction_id;
const ticks = (config, seconds) => Math.max(1, Math.ceil(seconds * config.balance.simulation_architecture.fixed_tick_hz));

export function chooseAIObjective(state, config, c, adaptation = aiAdaptation(state, config, c)) {
  const settings = aiSettings(state, config), hz = config.balance.simulation_architecture.fixed_tick_hz;
  const opening = config.balance.ai_economy.enabled && state.phase === 'CAMPAIGN' && !c.headquarters_site_id;
  if (opening) {
    if (c.ai_objective?.purpose === 'SETUP' && c.ai_objective.expires_tick > state.tick
      && state.buildings.some(b => b.type === 'permanence' && !b.owner_id && b.subzone_id === c.ai_objective.subzone_id)) return c.ai_objective;
    const sites = state.buildings.filter(b => b.type === 'permanence' && !b.owner_id);
    sites.sort((a, b) => distance(state, c.x, a.x) - distance(state, c.x, b.x) || a.id.localeCompare(b.id));
    if (sites[0]) return { subzone_id: sites[0].subzone_id, purpose: 'SETUP', expires_tick: state.tick + Math.ceil(settings.opening_seconds * hz) };
  }
  const previous = c.ai_objective;
  const oldZone = state.electorate.find(e => e.subzone_id === previous?.subzone_id);
  const keep = previous && previous.expires_tick > state.tick && previous.purpose !== 'SETUP'
    && oldZone && (previous.purpose === 'CONQUER' ? oldZone.controller !== c.faction_id
      : previous.purpose === 'DEFEND' && oldZone.controller === c.faction_id);
  // Réévaluer de temps en temps en chemin : l’IA peut changer d’avis si la situation a bougé.
  const reconsider = ticks(config, settings.reconsider_seconds ?? 9);
  const offset = Math.floor(aiNoise(state.seed, `${c.id}:reconsider`) * reconsider);
  if (keep && (state.tick + offset) % reconsider !== 0) return previous;
  const s = adaptationSettings(config), boost = Math.max(0, adaptation.boost);
  // Un bon joueur s’empare vite d’un local de faction (service d’ordre ou cabinet), puis reprend les sites laissés vacants.
  const hasFactionSite = state.buildings.some(b => b.type === 'faction' && b.owner_id === c.faction_id && b.state === 'ACTIVE');
  // Les dons n’arrivent qu’à une permanence du même quartier : en ouvrir une là où il n’y en a pas encore.
  const fundedBiomes = new Set(state.buildings.filter(b => b.type === 'permanence' && b.owner_id === c.faction_id && b.state === 'ACTIVE').map(b => b.biome_id));
  const choices = state.electorate.map(e => {
    const zone = state.world.subzones.find(z => z.id === e.subzone_id);
    const units = state.npcs.filter(n => zoneAt(state.world, n.x).id === zone.id);
    const neutral = units.filter(n => n.role === 'NEUTRE').length;
    // Le fief d’un candidat mineur n’est pas à conquérir : son QG ne s’achète pas tant qu’il est en campagne.
    const enemies = units.filter(n => hostile(c, n) && !isMinorFaction(n.faction_id));
    const minorFief = isMinorFaction(e.controller);
    const sites = state.buildings.filter(b => b.subzone_id === zone.id && b.owner_id && b.owner_id !== c.faction_id && !isMinorFaction(b.owner_id) && b.state === 'ACTIVE');
    const enemySites = sites.length;
    const enemyOwned = e.controller && e.controller !== c.faction_id && !minorFief || enemySites > 0
      || enemies.length > units.filter(n => n.faction_id === c.faction_id).length + 1;
    const allied = e.controller === c.faction_id;
    const threatened = allied && enemies.length >= Math.max(1, units.filter(n => n.faction_id === c.faction_id).length - 1);
    const frontier = state.electorate.some(n => e.adjacent_subzone_ids.includes(n.subzone_id) && n.controller === c.faction_id);
    const rivalSupport = Math.max(...FACTIONS.filter(f => f !== c.faction_id).map(f => e.support[f]));
    // Partie à trois : on grignote en priorité le camp qui domine, on épargne un humain distancé.
    const pressure = factionPressure(adaptation, e.controller);
    const focusSites = sites.filter(b => factionPressure(adaptation, b.owner_id) > 0).length;
    const threatPressure = threatened ? Math.max(0, ...enemies.map(n => factionPressure(adaptation, n.faction_id))) : 0;
    const vacant = state.buildings.filter(b => b.subzone_id === zone.id && b.ownership_model === 'capturable'
      && ['EMPTY', 'NEUTRAL', 'CLOSED'].includes(b.state) && !(b.type === 'faction' && hasFactionSite));
    const opening = vacant.some(b => b.type === 'faction') ? 20
      : vacant.some(b => b.type === 'permanence' && !fundedBiomes.has(b.biome_id)) ? 18 : vacant.length ? 6 : 0;
    const score = (enemyOwned ? settings.enemy_priority * (1 + 0.4 * boost) : allied ? -35 : minorFief ? -20 : 12) + (threatened ? 40 + threatPressure * 10 : 0)
      + (frontier ? 12 : 0) + neutral * 1.4 + enemySites * 8 + focusSites * 4 + Math.min(12, enemies.length * 2) + opening
      + (pressure > 0 ? s.focus_zone_bonus * (1 + boost) : pressure < 0 ? -s.spared_zone_penalty : 0)
      - enemies.filter(n => ['MILITANT', 'SERVICE_D_ORDRE'].includes(n.role)).length * 3
      + e.electoral_weight * 0.2 - Math.max(0, rivalSupport - e.support[c.faction_id]) * 2
      + (styleInfluenceMultiplier(config, c, zone.biome_id) - 1) * 30
      - distance(state, c.x, zone.center) * 0.6 * (1 - 0.3 * boost) - (!keep && previous?.subzone_id === zone.id ? 10 : 0)
      + aiNoise(state.seed, `${c.id}:${zone.id}`) * 3;
    return { zone, score, purpose: threatened ? 'DEFEND' : 'CONQUER' };
  }).sort((a, b) => b.score - a.score || a.zone.id.localeCompare(b.zone.id));
  const best = choices[0];
  if (keep) {
    // Changer d’avis seulement pour une option nettement meilleure.
    const current = choices.find(choice => choice.zone.id === previous.subzone_id);
    if (!current || best.zone.id === previous.subzone_id || best.score < current.score + 15) return previous;
  }
  const travelSeconds = distance(state, c.x, best.zone.center) / config.prototype.movement.candidate_speed_units_per_second;
  return { subzone_id: best.zone.id, purpose: best.purpose,
    expires_tick: state.tick + Math.ceil((travelSeconds + settings.commitment_seconds) * hz) };
}

/** Cadence de frappe : plus vive contre un humain dominant, retenue contre un humain épargné. */
function combatTempo(state, adaptation, target) {
  if (adaptation.spared.has(target.faction_id)) return 0.6;
  return isHumanCandidate(state, target.id) || target.faction_id === adaptation.focus ? 1 + 0.35 * Math.max(0, adaptation.boost) : 1;
}

/** Billets : tout l’argent de départ du quartier, puis ce qui traîne à portée, sans se jeter sur un rival. */
function moneyPickup(state, config, c, rival, stance) {
  const money = config.balance.money, firstHQCost = config.balance.buildings.permanence.first_headquarters_capture_cost;
  const home = zoneAt(state.world, c.start_x).biome_id;
  const options = [];
  for (const p of state.money_pickups || []) {
    const d = distance(state, c.x, p.x);
    const starting = p.height_ratio > 0 && zoneAt(state.world, p.x).biome_id === home;
    const wanted = starting
      ? (!c.headquarters_site_id ? c.money < firstHQCost || d <= 4 : d <= 40)
      : d <= money.donation.ai_handoff_search_radius_units;
    if (!wanted) continue;
    if (rival && stance !== 'FIGHT' && distance(state, rival.x, p.x) < Math.min(d, 3)) continue;
    options.push({ p, d });
  }
  options.sort((a, b) => a.d - b.d || a.p.id.localeCompare(b.p.id));
  return options[0]?.p ?? null;
}

export function strategicAICommands(state, config, c) {
  const settings = aiSettings(state, config);
  const commands = (axis, purchase = false) => [{ type: 'SetCampaignActive', candidateId: c.id, active: state.ai_enabled },
    { type: 'InteractionPresence', candidateId: c.id, active: state.ai_enabled && purchase }, { type: 'Move', candidateId: c.id, axis }];
  // Après un K.-O., repartir l’esprit neuf.
  if (!state.ai_enabled || c.is_ko) return [...(c.ai_mind && state.ai_enabled ? [{ type: 'SetAIMind', candidateId: c.id, mind: null }] : []),
    ...commands(0), { type: 'CancelAttack', candidateId: c.id }];
  if (c.combat.press_tick != null) {
    const target = nearestEnemy(state, c, settings.detection_range);
    return target ? aiCombatCommands(state, config, c, target) : [...commands(0), { type: 'CancelAttack', candidateId: c.id }];
  }
  const go = (x, radius, purchase = false) => {
    const d = ringDelta(c.x, x, state.world.length), arrived = Math.abs(d) <= radius;
    return commands(arrived ? 0 : Math.sign(d), arrived && purchase);
  };
  const activeMeeting = state.buildings.find(b => b.type === 'meeting' && b.meeting_candidate_id === c.id);
  if (activeMeeting) {
    const result = go(activeMeeting.x, config.balance.buildings.meeting.podium_half_width * 0.4);
    if (result[2].axis === 0 && c.podium_site_id !== activeMeeting.id && c.combat.height <= 0 && c.combat.jump_tick == null)
      result.push({ type: 'Jump', candidateId: c.id });
    return result;
  }
  const adaptation = aiAdaptation(state, config, c);
  const notes = [];
  const note = mind => { if (mind !== c.ai_mind) notes.push({ type: 'SetAIMind', candidateId: c.id, mind }); };

  // 1. Un candidat rival en vue : observer, puis combattre, fuir ou l’éviter.
  const rival = visibleRival(state, c, Math.max(settings.detection_range, 4));
  let avoid = null, stance = null, avoidMargin = 2.6;
  if (rival) {
    const mind = reflectOnRival(state, config, c, rival, adaptation);
    note(mind); stance = mind.stance;
    const d = distance(state, c.x, rival.x), range = aiAttackRange(config, c);
    if (stance === 'FIGHT' && (!c.purchase_hold || d <= range + 0.5) && worthChasing(state, config, c, rival, adaptation))
      return [...notes, ...aiCombatCommands(state, config, c, rival, combatTempo(state, adaptation, rival))];
    // Observer n’empêche pas de travailler : on ne s’arrête vraiment que si le rival s’approche.
    const persuading = c.persuasion_target_ids?.length > 0 || state.npcs.some(n => n.persuasion?.actor_id === c.id);
    const pressing = approaching(state, c, rival) && d <= range + 4 || d <= range + 2.6;
    if (stance === 'OBSERVE' && pressing) return [...notes, ...commands(persuading ? 0 : observeAxis(state, config, c, rival))];
    // Assez loin d’un rival qui ne suit pas : la fuite redevient une simple prudence.
    const escaped = stance === 'FLEE' && d > range + 4 && !approaching(state, c, rival);
    if (stance === 'FLEE' && !escaped) {
      const away = -(Math.sign(ringDelta(c.x, rival.x, state.world.length)) || c.facing);
      const result = [...notes, ...commands(away)];
      if (settings.dash && c.dash_charges > 0 && d <= 2.5 && approaching(state, c, rival) && c.combat.jump_tick == null) result.push({ type: 'Dash', candidateId: c.id, direction: away });
      return result;
    }
    if (stance === 'AVOID' || stance === 'OBSERVE' || escaped) avoid = rival;
    // Après une fuite, ne pas revenir vers le rival juste au bord de la distance de sécurité (sinon va-et-vient).
    avoidMargin = escaped ? 5.5 : 2.6;
  } else if (c.ai_mind?.opponent_id) note(null);
  // En évitement, ne jamais s’approcher du rival : attendre qu’il passe ou que l’avis change.
  const finish = result => {
    if (avoid) {
      const move = result.find(r => r.type === 'Move'), toward = Math.sign(ringDelta(c.x, avoid.x, state.world.length));
      if (move && move.axis === toward && distance(state, c.x, avoid.x) <= aiAttackRange(config, c) + avoidMargin) move.axis = 0;
    }
    return [...notes, ...result];
  };

  // 2. Pause de réflexion en cours.
  if (!rival && validMind(state, c.ai_mind) && c.ai_mind.stance === 'THINK' && state.tick < c.ai_mind.review_tick) return finish(commands(0));

  // 3. Soutiens adverses menaçants : repli prudent, d’autant plus qu’on transporte de l’argent.
  const danger = nearestEnemy(state, c, settings.detection_range, n => n.role !== 'CANDIDAT');
  const risk = Math.min(1, c.money * config.balance.candidate_combat.ko_money_drop_ratio / adaptationSettings(config).money_risk_reference_k);
  // Décision stable pour cette vie : une minorité se replie, les autres tiennent le combat.
  const cautious = aiNoise(state.seed, `${c.id}:retreat:${c.ko_started_tick}`) < settings.retreat_chance * (1 + risk);
  const recovering = cautious && c.ai_objective?.purpose === 'RECOVER' && c.ai_objective.expires_tick > state.tick
    && c.resistance < config.balance.candidate_combat.resistance_max * 0.55;
  const previousRetreat = c.ai_objective?.purpose === 'RECOVER';
  if (recovering || cautious && !previousRetreat && danger && c.resistance < config.balance.candidate_combat.resistance_max * settings.retreat_ratio * (1 + risk * 0.5)) {
    const safeZones = state.world.subzones.map(z => ({ z, danger: [...state.candidates, ...state.npcs, ...state.temporary_units]
      .filter(n => hostile(c, n) && distance(state, z.center, n.x) <= config.balance.candidate_combat.recovery_safe_distance + z.width / 2).length }))
      .sort((a, b) => a.danger - b.danger || distance(state, c.x, a.z.center) - distance(state, c.x, b.z.center));
    const safe = safeZones[0].z;
    const result = danger ? commands(-(Math.sign(ringDelta(c.x, danger.x, state.world.length)) || c.facing)) : go(safe.center, 1);
    if (danger && settings.dash && c.dash_charges > 0) result.push({ type: 'Dash', candidateId: c.id, direction: result[2].axis });
    return [...notes, { type: 'SetAIObjective', candidateId: c.id, objective: { subzone_id: safe.id, purpose: 'RECOVER', expires_tick: recovering ? c.ai_objective.expires_tick : state.tick + 6 * config.balance.simulation_architecture.fixed_tick_hz } }, ...result];
  }
  // Un repli expiré sous pression débouche sur un combat, pas sur un nouveau délai de fuite.
  if (previousRetreat && danger && c.resistance < config.balance.candidate_combat.resistance_max * 0.55) return [...notes, ...aiCombatCommands(state, config, c, danger)];

  // 4. Un soutien adverse au contact ou qui nous vise : régler ça avant tout déplacement.
  const assailant = nearestEnemy(state, c, settings.detection_range, n => n.role !== 'CANDIDAT'
    && (distance(state, c.x, n.x) <= aiAttackRange(config, c) || n.combat?.target_id === c.id));
  if (assailant && !c.purchase_hold) return [...notes, ...aiCombatCommands(state, config, c, assailant, combatTempo(state, adaptation, assailant))];

  // 5. Événements de campagne, pesés selon le terrain, le danger et le coût.
  const eventCommands = campaignEventAICommands(state, config, c, adaptation);
  if (eventCommands) return finish(eventCommands);

  // 6. Objectif territorial ; un changement de plan peut s’accompagner d’un temps de réflexion.
  const objective = chooseAIObjective(state, config, c, adaptation);
  const plan = objective === c.ai_objective ? [] : [{ type: 'SetAIObjective', candidateId: c.id, objective }];
  if (plan.length && c.ai_objective && !['SETUP', 'RECOVER'].includes(c.ai_objective.purpose) && objective.purpose !== 'SETUP' && !rival) {
    const pause = thinkingPause(state, config, c, adaptation);
    if (pause) { note(pause); return finish([...plan, ...commands(0)]); }
  }
  const zone = state.world.subzones.find(z => z.id === objective.subzone_id);
  const here = zoneAt(state.world, c.x).id === zone.id;
  // Ne pas poursuivre à travers la carte : éliminer les soutiens qui tiennent réellement l’objectif.
  const opponent = nearestEnemy(state, c, settings.detection_range, n => n.role !== 'CANDIDAT' && zoneAt(state.world, n.x).id === zone.id);
  if (opponent && (!c.purchase_hold || distance(state, c.x, opponent.x) <= config.balance.physical_units.militant.verbal_range))
    return finish([...plan, ...aiCombatCommands(state, config, c, opponent, combatTempo(state, adaptation, opponent))]);
  const retained = state.npcs.find(n => n.role === 'NEUTRE' && n.persuasion?.actor_id === c.id);
  if (retained) return finish([...plan, ...commands(0)]);
  // Finir une transaction engagée évite de remettre son compteur à zéro.
  if (c.purchase_hold) {
    const site = state.buildings.find(b => b.id === c.purchase_hold.target_id);
    const offer = site && buildingOffers(state, config, c, site).find(o => o.key === c.purchase_hold.key && o.enabled);
    if (offer) return finish([...plan, ...go(offer.x, offer.radius * config.prototype.ai.stop_distance_radius_ratio, true)]);
  }
  const pickup = moneyPickup(state, config, c, avoid, stance);
  if (pickup) {
    const result = go(pickup.x, config.balance.money.pickup_radius_units * 0.45);
    if (result[2].axis === 0 && pickup.height_ratio > 0 && c.combat.jump_tick == null && c.combat.height === 0)
      result.push({ type: 'Jump', candidateId: c.id });
    return finish([...plan, ...result]);
  }
  // Un coup décisif payable (local de faction, raid, fermeture) passe avant la tournée des dons.
  const economic = aiEconomicTarget(state, config, c, objective, adaptation);
  if (economic?.decisive) return finish([...plan, ...go(economic.x, economic.interaction_radius * config.prototype.ai.stop_distance_radius_ratio, true)]);
  const funding = state.buildings.filter(b => ['permanence', 'financement'].includes(b.type) && b.owner_id === c.faction_id && b.state === 'ACTIVE'
    && b.stored_money_cents >= config.balance.money.donation.ai_funding_collection_threshold_eur * 100)
    .sort((a, b) => distance(state, c.x, a.x) - distance(state, c.x, b.x) || a.id.localeCompare(b.id))[0];
  if (funding) return finish([...plan, ...go(funding.x, config.balance.money.donation.collection_radius_units * 0.6)]);
  const firstHQCost = config.balance.buildings.permanence.first_headquarters_capture_cost;
  const nextInvestment = c.headquarters_site_id ? config.balance.buildings.permanence.capture_cost : firstHQCost;
  if (c.money < nextInvestment && !state.buildings.some(b => b.type === 'permanence' && b.owner_id === c.faction_id && b.state === 'ACTIVE')) {
    const donor = state.npcs.filter(n => n.role === 'SYMPATHISANT' && n.faction_id === c.faction_id && n.donation_cents > 0
      && !state.buildings.some(b => b.type === 'permanence' && b.owner_id === c.faction_id && b.state === 'ACTIVE'
        && b.biome_id === zoneAt(state.world, n.x).biome_id)
      && distance(state, c.x, n.x) <= config.balance.money.donation.ai_handoff_search_radius_units)
      .sort((a, b) => distance(state, c.x, a.x) - distance(state, c.x, b.x) || a.id.localeCompare(b.id))[0];
    if (donor) return finish([...plan, ...go(donor.x, config.balance.money.donation.handoff_radius_units * 0.6)]);
  }
  if (economic?.type === 'meeting' && !candidateOnMeetingStage(state, config, c, economic)) {
    const approach = go(economic.x, Math.min(0.25, economic.interaction_radius * config.prototype.ai.stop_distance_radius_ratio));
    if (approach[2].axis === 0 && c.combat.height <= 0 && c.combat.jump_tick == null)
      approach.push({ type: 'Jump', candidateId: c.id });
    return finish([...plan, ...approach]);
  }
  if (economic) return finish([...plan, ...go(economic.x, economic.interaction_radius * config.prototype.ai.stop_distance_radius_ratio, true)]);
  const defenders = state.npcs.filter(n => hostile(c, n) && zoneAt(state.world, n.x).id === zone.id)
    .sort((a, b) => distance(state, c.x, a.x) - distance(state, c.x, b.x) || a.id.localeCompare(b.id));
  // Réduire la présence adverse avant de recruter si elle maintient un site ennemi.
  const enemySite = state.buildings.some(b => b.subzone_id === zone.id && b.owner_id && b.owner_id !== c.faction_id && b.state === 'ACTIVE');
  if (here && enemySite && defenders[0]) return finish([...plan, ...aiCombatCommands(state, config, c, defenders[0], combatTempo(state, adaptation, defenders[0]))]);
  // Convaincre les neutres disponibles (pas ceux emportés par un rassemblement).
  const targets = state.npcs.filter(n => n.role === 'NEUTRE' && !n.persuasion && !n.rally_event_id && zoneAt(state.world, n.x).id === zone.id)
    .sort((a, b) => distance(state, c.x, a.x) - distance(state, c.x, b.x) || a.id.localeCompare(b.id));
  if (targets[0]) return finish([...plan, ...go(targets[0].x, config.prototype.persuasion.radius_units * config.prototype.ai.stop_distance_radius_ratio)]);
  // Après avoir recruté, traverser la zone pour en chasser les soutiens adverses.
  if (here && defenders[0]) return finish([...plan, ...aiCombatCommands(state, config, c, defenders[0], combatTempo(state, adaptation, defenders[0]))]);
  return finish([...plan, ...go(zone.center, config.prototype.persuasion.radius_units)]);
}
