import { FACTIONS, isMinorFaction, ringDelta, zoneAt } from './world.js';
import { aiNoise, aiSettings } from './ai-settings.js';
import { aiCombatCommands, aiAttackRange } from './ai-combat.js';
import { aiEconomicTarget, buildingOffers } from './economy.js';
import { candidateOnMeetingStage } from './electoral-buildings.js';
import { canBeHit, nearestEnemy } from './combat-state.js';
import { styleInfluenceMultiplier } from './campaign-styles.js';
import { adaptationSettings, aiAdaptation, factionPressure, truceFilter } from './ai-balance.js';
import { approaching, observeAxis, reflectOnRival, thinkingPause, validMind, visibleRival, worthChasing } from './ai-mind.js';
import { campaignEventAICommands } from './ai-events.js';
import { isHumanCandidate } from './human-candidates.js';
import { rideGarage, tactics } from './ai-moments.js';
import { biomeSympathisants } from './territory.js';
import { aiObservation } from './ai-observation.js';
import { nearbyNpcs } from './npc-proximity.js';
import { filmed, pressMember } from './press-rules.js';
import { airborne } from './combat-actions.js';

const distance = (state, a, b) => Math.abs(ringDelta(a, b, state.world.length));
const hostile = (c, n) => canBeHit(n) && n.faction_id !== c.faction_id;
const FIGHTERS = ['MILITANT', 'SERVICE_D_ORDRE'];
/** Groupe adverse de militants ou de service d’ordre nettement plus nombreux que ses propres troupes. */
const outnumbered = (c, units) => {
  let theirs = 0, ours = 0;
  for (const n of units) if (FIGHTERS.includes(n.role)) {
    if (hostile(c, n)) theirs++;
    if (n.faction_id === c.faction_id) ours++;
  }
  return theirs >= 3 && theirs > ours + 1;
};

/** Le plus proche en un passage, avec les mêmes égalités que les anciens tris stables. */
function closest(state, c, units, eligible) {
  let best, bestDistance = Infinity;
  for (const unit of units) {
    if (!eligible(unit)) continue;
    const d = distance(state, c.x, unit.x);
    if (!best || d < bestDistance || d === bestDistance && unit.id.localeCompare(best.id) < 0) {
      best = unit; bestDistance = d;
    }
  }
  return best;
}

function outnumberedNear(state, c, x, radius) {
  let ours = 0, theirs = 0;
  for (const units of [nearbyNpcs(state, x, radius), state.temporary_units]) for (const n of units) {
    if (!FIGHTERS.includes(n.role) || distance(state, x, n.x) > radius) continue;
    if (hostile(c, n)) theirs++;
    if (n.faction_id === c.faction_id) ours++;
  }
  return theirs >= 3 && theirs > ours + 1;
}

/**
 * Territoire d’un camp : son cœur = les quartiers dont il possède le bâtiment, plus ceux où il a
 * la majorité des soutiens sans qu’un autre camp en tienne le bâtiment. Le reste est à prendre.
 */
export function coreZones(state, c) {
  return new Set(state.electorate.filter(e => e.controller === c.faction_id || !e.controller && e.support[c.faction_id] > 0
    && Object.entries(e.support).every(([f, n]) => f === c.faction_id || ['neutral', 'pending'].includes(f) || n < e.support[c.faction_id]))
    .map(e => e.subzone_id));
}

/** Rapport de force dans son cœur : troupes adverses (un candidat compte double) contre ses militants et son service d’ordre. */
export function territoryThreat(state, c, core = coreZones(state, c)) {
  let theirs = 0, ours = 0;
  for (const units of [state.candidates, state.npcs, state.temporary_units || []]) for (const n of units) {
    if (!core.has(zoneAt(state.world, n.x).id)) continue;
    if (n.faction_id === c.faction_id) { if (FIGHTERS.includes(n.role)) ours++; continue; }
    if (!hostile(c, n) || isMinorFaction(n.faction_id)) continue;
    if (FIGHTERS.includes(n.role)) theirs++; else if (n.role === 'CANDIDAT') theirs += 2;
  }
  return { theirs, ours, weak: theirs >= 3 && theirs > ours + 1 };
}

/** Sympathisants et militants des grands camps adverses dans un quartier : ce qu’une attaque peut faire tomber. */
const isEnemySupporter = (c, n) => hostile(c, n) && !isMinorFaction(n.faction_id)
  && ['SYMPATHISANT', 'MILITANT', 'SERVICE_D_ORDRE'].includes(n.role);
const ticks = (config, seconds) => Math.max(1, Math.ceil(seconds * config.balance.simulation_architecture.fixed_tick_hz));

export function chooseAIObjective(state, config, c, adaptation = aiAdaptation(state, config, c)) {
  const settings = aiSettings(state, config), hz = config.balance.simulation_architecture.fixed_tick_hz;
  let observation;
  const opening = config.balance.ai_economy.enabled && state.phase === 'CAMPAIGN' && !c.headquarters_site_id;
  if (opening) {
    observation = aiObservation(state);
    // Une permanence ne se prend qu’avec des soutiens sur place : viser un quartier où il y en a déjà,
    // ou des passants à convaincre, plutôt que la plus proche d’un quartier vide.
    const required = config.balance.buildings.permanence.required_presence_N1 ?? 0;
    const missing = site => {
      const group = observation.zones.get(site.subzone_id);
      const ready = (group.readyByFaction.get(c.faction_id) || 0) + group.readyNeutral;
      return Math.max(0, required - ready);
    };
    const cost = site => distance(state, c.x, site.x) + missing(site) * 60;
    let first, firstCost = Infinity, current, currentCost = Infinity;
    for (const site of state.buildings) if (site.type === 'permanence' && !site.owner_id) {
      const value = cost(site);
      if (!first || value < firstCost || value === firstCost && site.id.localeCompare(first.id) < 0) { first = site; firstCost = value; }
      if (c.ai_objective?.purpose === 'SETUP' && site.subzone_id === c.ai_objective.subzone_id
        && (!current || value < currentCost || value === currentCost && site.id.localeCompare(current.id) < 0)) { current = site; currentCost = value; }
    }
    if (current && c.ai_objective.expires_tick > state.tick && !missing(current)) return c.ai_objective;
    // Changer de cible seulement pour une option nettement meilleure, sinon prolonger.
    const best = current && currentCost <= firstCost + 20 ? current : first;
    if (best) return { subzone_id: best.subzone_id, purpose: 'SETUP', expires_tick: state.tick + Math.ceil(settings.opening_seconds * hz) };
  }
  const previous = c.ai_objective;
  // Se sentir faible : des troupes adverses plus nombreuses que les siennes dans son cœur.
  // Reculer à sa permanence, transformer ses sympathisants en militants (tracts), puis contre-attaquer.
  // Le rapport de force est réévalué deux fois par seconde (calcul sur toute la carte), et à chaque image pendant un repli.
  const glance = ticks(config, 0.5), regrouping = previous?.purpose === 'REGROUP' && previous.expires_tick > state.tick;
  const look = regrouping || (state.tick + Math.floor(aiNoise(state.seed, `${c.id}:threat`) * glance)) % glance === 0;
  const core = look ? coreZones(state, c) : null, threat = look ? territoryThreat(state, c, core) : { weak: false };
  // Un repli engagé dure jusqu’à avoir au moins autant de troupes que l’adversaire (pas de va-et-vient).
  if (look && (threat.weak || regrouping && threat.ours < threat.theirs)) {
    const rally = state.buildings.filter(b => b.type === 'permanence' && b.owner_id === c.faction_id && b.state === 'ACTIVE')
      .map(b => ({ b, ready: biomeSympathisants(state, b.biome_id, c.faction_id, true).length }))
      .filter(r => r.ready >= 2).sort((a, b) => b.ready - a.ready || distance(state, c.x, a.b.x) - distance(state, c.x, b.b.x))[0]?.b;
    if (rally && c.money >= 0.5) {
      if (previous?.purpose === 'REGROUP' && previous.subzone_id === rally.subzone_id && previous.expires_tick > state.tick) return previous;
      return { subzone_id: rally.subzone_id, purpose: 'REGROUP', expires_tick: state.tick + ticks(config, 20) };
    }
  }
  const oldZone = state.electorate.find(e => e.subzone_id === previous?.subzone_id);
  // Une attaque s’arrête quand le quartier est nettoyé : on n’attend pas sur place que les neutres reviennent.
  const keep = previous && previous.expires_tick > state.tick && !['SETUP', 'REGROUP'].includes(previous.purpose)
    && oldZone && (previous.purpose === 'CONQUER' ? oldZone.controller !== c.faction_id
      : previous.purpose === 'ATTACK' ? state.npcs.some(n => isEnemySupporter(c, n) && zoneAt(state.world, n.x).id === oldZone.subzone_id)
      : previous.purpose === 'DEFEND' && oldZone.controller === c.faction_id);
  // Réévaluer de temps en temps en chemin : l’IA peut changer d’avis si la situation a bougé.
  const reconsider = ticks(config, settings.reconsider_seconds ?? 9);
  const offset = Math.floor(aiNoise(state.seed, `${c.id}:reconsider`) * reconsider);
  if (keep && (state.tick + offset) % reconsider !== 0) return previous;
  observation ??= aiObservation(state);
  const s = adaptationSettings(config), boost = Math.max(0, adaptation.boost), tactic = tactics(config);
  // Un bon joueur s’empare vite d’un local de faction (service d’ordre ou cabinet), puis reprend les sites laissés vacants.
  const hasFactionSite = state.buildings.some(b => b.type === 'faction' && b.owner_id === c.faction_id && b.state === 'ACTIVE');
  // Les dons n’arrivent qu’à une permanence du même quartier : en ouvrir une là où il n’y en a pas encore.
  const fundedBiomes = new Set(state.buildings.filter(b => b.type === 'permanence' && b.owner_id === c.faction_id && b.state === 'ACTIVE').map(b => b.biome_id));
  const heart = core ?? coreZones(state, c);
  const choices = state.electorate.map(e => {
    const group = observation.zones.get(e.subzone_id), { zone, units } = group;
    // Le fief d’un candidat mineur n’est pas à conquérir : son QG ne s’achète pas tant qu’il est en campagne.
    const minorFief = isMinorFaction(e.controller);
    let neutral = 0, ours = 0, enemyCount = 0, guards = 0, prey = 0, enemyPressure = 0;
    let invaded = false;
    // Compter en un passage et conserver l'ordre d'addition des poids de chaque soutien.
    for (const n of units) {
      if (n.role === 'NEUTRE') neutral++;
      if (n.faction_id === c.faction_id) ours++;
      if (!hostile(c, n) || isMinorFaction(n.faction_id)) continue;
      enemyCount++;
      const pressure = factionPressure(adaptation, n.faction_id);
      enemyPressure = Math.max(enemyPressure, pressure);
      if (!minorFief && ['SYMPATHISANT', 'MILITANT', 'SERVICE_D_ORDRE'].includes(n.role)) prey = prey + 1 + 0.6 * pressure;
      if (FIGHTERS.includes(n.role)) guards++;
      if (FIGHTERS.includes(n.role) || n.role === 'CANDIDAT') invaded = true;
    }
    const sites = group.buildings.filter(b => b.owner_id && b.owner_id !== c.faction_id && !isMinorFaction(b.owner_id) && b.state === 'ACTIVE');
    const enemySites = sites.length;
    const enemyOwned = e.controller && e.controller !== c.faction_id && !minorFief || enemySites > 0
      || enemyCount > ours + 1;
    const allied = e.controller === c.faction_id;
    const threatened = allied && enemyCount >= Math.max(1, ours - 1);
    const frontier = state.electorate.some(n => e.adjacent_subzone_ids.includes(n.subzone_id) && n.controller === c.faction_id);
    // Son cœur envahi : y revenir chasser l’intrus (le repli gère le cas où il est trop fort).
    invaded = heart.has(zone.id) && (invaded || state.candidates.some(n => hostile(c, n) && !isMinorFaction(n.faction_id)
      && (FIGHTERS.includes(n.role) || n.role === 'CANDIDAT') && zoneAt(state.world, n.x).id === zone.id));
    // Partie à trois : on grignote en priorité le camp qui domine, on épargne un humain distancé.
    const pressure = factionPressure(adaptation, e.controller);
    const focusSites = sites.filter(b => factionPressure(adaptation, b.owner_id) > 0).length;
    const threatPressure = threatened ? enemyPressure : 0;
    const vacant = group.buildings.filter(b => b.ownership_model === 'capturable'
      && ['EMPTY', 'NEUTRAL', 'CLOSED'].includes(b.state) && !(b.type === 'faction' && hasFactionSite));
    const opening = vacant.some(b => b.type === 'faction') ? 20
      : vacant.some(b => b.type === 'permanence' && !fundedBiomes.has(b.biome_id)) ? 18 : vacant.length ? 6 : 0;
    const score = (enemyOwned ? settings.enemy_priority * (1 + 0.4 * boost) : allied ? -35 : minorFief ? -20 : 12) + (threatened ? 40 + threatPressure * 10 : 0)
      // Défendre seul un quartier occupé par un groupe adverse, c’est se faire mettre K.-O. : attendre des renforts.
      - (threatened && outnumbered(c, units) ? 30 + threatPressure * 10 : 0)
      + (frontier ? 12 : 0) + neutral * 1.4 + enemySites * 8 + focusSites * 4 + Math.min(12, enemyCount * 2) + opening
      + (pressure > 0 ? s.focus_zone_bonus * (1 + boost) : pressure < 0 ? s.spared_zone_penalty * pressure : 0)
      - guards * 3
      // On attaque de proche en proche : un quartier frontalier ou tout proche, pas l’autre bout de la carte.
      + e.electoral_weight * 0.2 + Math.min(tactic.prey_cap, prey * tactic.prey_weight)
        * (frontier || distance(state, c.x, zone.center) <= tactic.attack_near_units ? 1 : tactic.far_attack_factor) + (invaded ? tactic.invaded_bonus : 0)
      + (styleInfluenceMultiplier(config, c, zone.biome_id) - 1) * 30
      - distance(state, c.x, zone.center) * 0.6 * (1 - 0.3 * boost) - (!keep && previous?.subzone_id === zone.id ? 10 : 0)
      + aiNoise(state.seed, `${c.id}:${zone.id}`) * 3;
    return { zone, score, purpose: threatened || invaded ? 'DEFEND' : prey >= 3 && guards <= 2 ? 'ATTACK' : 'CONQUER' };
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
  let best, bestDistance = Infinity;
  for (const p of state.money_pickups || []) {
    const d = distance(state, c.x, p.x);
    const starting = p.height_ratio > 0 && zoneAt(state.world, p.x).biome_id === home;
    const wanted = starting
      ? (!c.headquarters_site_id ? c.money < firstHQCost || d <= 4 : d <= 40)
      : d <= money.donation.ai_handoff_search_radius_units;
    if (!wanted) continue;
    if (rival && stance !== 'FIGHT' && distance(state, rival.x, p.x) < Math.min(d, 3)) continue;
    // Pas de billet au milieu d’un groupe adverse : c’est là qu’on vient d’être mis K.-O.
    if (outnumberedNear(state, c, p.x, config.balance.physical_units.militant.detection_range)) continue;
    if (!best || d < bestDistance || d === bestDistance && p.id.localeCompare(best.id) < 0) { best = p; bestDistance = d; }
  }
  return best ?? null;
}

/**
 * Reportage aux trousses : sortir du champ de la caméra (esquive qui traverse le duo jusque dans le dos
 * du cadreur, sinon saut au-dessus du faisceau), puis abattre le cadreur (30 PV), ce qui renvoie le duo.
 * Un seul test tant qu’aucun reportage ne vise ce candidat : rien à calculer le reste du temps.
 */
function pressAICommands(state, config, c, settings) {
  const group = state.press_team, t = tactics(config);
  if (!t.press_reaction || group?.phase !== 'ACTIVE' || group.target_id !== c.id) return null;
  const camera = pressMember(state, 'PRESS_CAMERA');
  if (!canBeHit(camera)) return null;
  const d = ringDelta(c.x, camera.x, state.world.length), toward = Math.sign(d) || c.facing;
  // À portée, frapper suffit : un coup reçu interrompt le tournage.
  if (Math.abs(d) <= aiAttackRange(config, c) || !filmed(state, config, c)
    || airborne(c) || c.dash_active || c.combat.attack_id || c.combat.stun_ticks || c.combat.press_tick != null)
    return aiCombatCommands(state, config, c, camera, t.press_attack_tempo);
  const result = [{ type: 'SetCampaignActive', candidateId: c.id, active: true },
    { type: 'InteractionPresence', candidateId: c.id, active: false }, { type: 'Move', candidateId: c.id, axis: toward }];
  if (settings.dash && c.dash_charges > 0 && Math.abs(d) <= config.balance.dash.distance - t.press_dash_margin_units)
    result.push({ type: 'Dash', candidateId: c.id, direction: toward });
  else if (c.combat.jump_tick == null) result.push({ type: 'Jump', candidateId: c.id });
  return result;
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
    // On n’achète rien à vélo ou en scooter : sauter pour en descendre.
    if (arrived && purchase && c.vehicle) return [...commands(0), { type: 'Jump', candidateId: c.id }];
    // Long trajet : passer d’abord prendre son véhicule s’il est tout près (immobile devant le garage).
    const garage = !arrived && rideGarage(state, config, c, x);
    if (garage) {
      const g = ringDelta(c.x, garage.x, state.world.length), atGarage = Math.abs(g) <= config.balance.vehicles.garage_radius_units * 0.6;
      return commands(atGarage ? 0 : Math.sign(g), atGarage);
    }
    return commands(arrived ? 0 : Math.sign(d), arrived && purchase);
  };
  const activeMeeting = state.buildings.find(b => b.type === 'meeting' && b.meeting_candidate_id === c.id);
  if (activeMeeting) {
    const result = go(activeMeeting.x, config.balance.buildings.meeting.podium_half_width * 0.4);
    if (result[2].axis === 0 && c.podium_site_id !== activeMeeting.id && c.combat.height <= 0 && c.combat.jump_tick == null)
      result.push({ type: 'Jump', candidateId: c.id });
    return result;
  }
  // 0. Une équipe de reportage filme ce candidat : s’en débarrasser passe avant tout le reste.
  const press = pressAICommands(state, config, c, settings);
  if (press) return press;
  const adaptation = aiAdaptation(state, config, c);
  const notes = [];
  const note = mind => { if (mind !== c.ai_mind) notes.push({ type: 'SetAIMind', candidateId: c.id, mind }); };

  // 1. Un candidat rival en vue : observer, puis combattre, fuir ou l’éviter.
  // Le camp à contenir passe avant les autres, même s’il n’est pas le plus proche.
  const sight = Math.max(settings.detection_range, 4);
  const rival = visibleRival(state, c, sight, o => o.faction_id === adaptation.focus) ?? visibleRival(state, c, sight);
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
  // Seul face à un groupe de militants adverses (ils frappent de loin et reculent quand on approche),
  // même un candidat courageux recule dès les premiers coups, et tient son repli tant que le groupe est là.
  const swarmed = !!danger && outnumberedNear(state, c, c.x, settings.detection_range);
  const recovering = (cautious && c.resistance < config.balance.candidate_combat.resistance_max * 0.55 || swarmed)
    && c.ai_objective?.purpose === 'RECOVER' && c.ai_objective.expires_tick > state.tick;
  const previousRetreat = c.ai_objective?.purpose === 'RECOVER';
  const fragile = c.resistance < config.balance.candidate_combat.resistance_max * settings.retreat_ratio * (1 + risk * 0.5);
  if (recovering || !previousRetreat && danger && (cautious && fragile || swarmed && c.resistance < config.balance.candidate_combat.resistance_max * tactics(config).swarm_retreat_ratio)) {
    // Adversaires listés une fois (et non recopiés pour chaque quartier) ; mêmes comptes, même tri.
    const hostiles = [];
    for (const units of [state.candidates, state.npcs, state.temporary_units]) for (const n of units) if (hostile(c, n)) hostiles.push(n);
    const count = accept => { let total = 0; for (const n of hostiles) if (accept(n)) total++; return total; };
    const safeZones = state.world.subzones.map(z => ({ z, danger: count(n => distance(state, z.center, n.x) <= config.balance.candidate_combat.recovery_safe_distance + z.width / 2) }))
      .sort((a, b) => a.danger - b.danger || distance(state, c.x, a.z.center) - distance(state, c.x, b.z.center));
    const safe = safeZones[0].z;
    // Fuir du côté où les ennemis sont les moins nombreux, pas seulement à l’opposé du plus proche.
    const pressureOn = side => count(n => (FIGHTERS.includes(n.role) || n.role === 'CANDIDAT')
      && Math.sign(ringDelta(c.x, n.x, state.world.length)) === side && distance(state, c.x, n.x) <= settings.detection_range * 2);
    const away = -(Math.sign(ringDelta(c.x, danger?.x ?? c.x, state.world.length)) || c.facing);
    const result = danger ? commands(pressureOn(-away) < pressureOn(away) ? -away : away) : go(safe.center, 1);
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
  // Trêve contre le meneur : les soutiens de l’autre camp distancé ne sont combattus que s’ils attaquent.
  const keep = truceFilter(state, config, c.faction_id, adaptation) ?? (() => true);
  // Achat visé ; un meeting se lance depuis la scène (on y saute).
  const economic = aiEconomicTarget(state, config, c, objective, adaptation);
  const pursue = target => {
    if (target.type !== 'meeting' || candidateOnMeetingStage(state, config, c, target))
      return go(target.x, target.interaction_radius * config.prototype.ai.stop_distance_radius_ratio, true);
    const approach = go(target.x, Math.min(0.25, target.interaction_radius * config.prototype.ai.stop_distance_radius_ratio));
    if (approach[2].axis === 0 && c.combat.height <= 0 && c.combat.jump_tick == null) approach.push({ type: 'Jump', candidateId: c.id });
    return approach;
  };
  // Le coup du moment (local de faction, raid, meeting, mobilisation finale) ne se laisse pas distraire
  // par les soutiens adverses du quartier, sauf s’ils sont au contact.
  const opponent = nearestEnemy(state, c, settings.detection_range, n => n.role !== 'CANDIDAT' && zoneAt(state.world, n.x).id === zone.id && keep(n));
  // En repli, on ne s’arrête pas pour se battre en chemin, sauf au contact.
  if (opponent && (!c.purchase_hold && !economic?.decisive && objective.purpose !== 'REGROUP' || distance(state, c.x, opponent.x) <= config.balance.physical_units.militant.verbal_range))
    return finish([...plan, ...aiCombatCommands(state, config, c, opponent, combatTempo(state, adaptation, opponent))]);
  const retained = state.npcs.find(n => n.role === 'NEUTRE' && n.persuasion?.actor_id === c.id);
  if (retained && !economic?.decisive) return finish([...plan, ...commands(0)]);
  // Finir une transaction engagée évite de remettre son compteur à zéro.
  if (c.purchase_hold) {
    const site = state.buildings.find(b => b.id === c.purchase_hold.target_id);
    // (Un sondage déclenché en passant devant l’institut n’était pas voulu : on ne le termine pas.)
    const offer = site && buildingOffers(state, config, c, site).find(o => o.key === c.purchase_hold.key && o.enabled && o.kind !== 'POLL');
    if (offer) return finish([...plan, ...go(offer.x, offer.radius * config.prototype.ai.stop_distance_radius_ratio, true)]);
  }
  if (economic?.decisive) return finish([...plan, ...pursue(economic)]);
  // Un achat déjà à portée (tracts devant sa permanence…) se fait avant d’aller ramasser des billets.
  if (economic && distance(state, c.x, economic.x) <= economic.interaction_radius + 1.5) return finish([...plan, ...pursue(economic)]);
  // En route pour attaquer ou défendre un quartier : pas de détour, sauf pour ce qui est sur le chemin.
  const mission = ['ATTACK', 'DEFEND'].includes(objective.purpose) && !here;
  const onTheWay = x => !mission || distance(state, c.x, x) <= tactics(config).mission_detour_units;
  // Chasse : comme un joueur, abattre les sympathisants et militants adverses qui passent à portée.
  // Chaque soutien abattu rentre chez lui redevenir neutre : une voix en moins pour l’adversaire.
  if (objective.purpose !== 'REGROUP') {
    const t = tactics(config), radius = mission ? t.hunt_radius_mission_units : t.hunt_radius_units;
    // (Calcul léger : il tourne à chaque image pour chaque IA.)
    const nearby = nearbyNpcs(state, c.x, radius + 5).filter(n => distance(state, c.x, n.x) <= radius + 5 && hostile(c, n));
    const guards = [...nearby.filter(n => FIGHTERS.includes(n.role)), ...state.temporary_units.filter(u => hostile(c, u) && distance(state, c.x, u.x) <= radius + 5)];
    const prey = closest(state, c, nearby, n => {
      if (!['SYMPATHISANT', 'MILITANT'].includes(n.role) || isMinorFaction(n.faction_id) || distance(state, c.x, n.x) > radius || !keep(n)) return false;
      let count = 0;
      for (const guard of guards) if (guard !== n && distance(state, n.x, guard.x) <= 5 && ++count > t.hunt_max_guards) return false;
      return count <= t.hunt_max_guards;
    });
    if (prey) return finish([...plan, ...aiCombatCommands(state, config, c, prey, combatTempo(state, adaptation, prey))]);
  }
  const pickup = moneyPickup(state, config, c, avoid, stance);
  if (pickup && onTheWay(pickup.x)) {
    const result = go(pickup.x, config.balance.money.pickup_radius_units * 0.45);
    if (result[2].axis === 0 && pickup.height_ratio > 0 && c.combat.jump_tick == null && c.combat.height === 0)
      result.push({ type: 'Jump', candidateId: c.id });
    return finish([...plan, ...result]);
  }
  // Les dons attendent à la permanence : on y passe quand le trajet en vaut la peine (500 € à côté, bien plus au loin).
  const funding = closest(state, c, state.buildings, b => b.type === 'permanence' && b.owner_id === c.faction_id && b.state === 'ACTIVE'
    && b.stored_money_cents >= config.balance.money.donation.ai_funding_collection_threshold_eur * 100 * (1 + distance(state, c.x, b.x) / tactics(config).funding_distance_units));
  if (funding && onTheWay(funding.x)) return finish([...plan, ...go(funding.x, config.balance.money.donation.collection_radius_units * 0.6)]);
  const firstHQCost = config.balance.buildings.permanence.first_headquarters_capture_cost;
  const nextInvestment = c.headquarters_site_id ? config.balance.buildings.permanence.capture_cost : firstHQCost;
  if (c.money < nextInvestment && !state.buildings.some(b => b.type === 'permanence' && b.owner_id === c.faction_id && b.state === 'ACTIVE')) {
    const donor = closest(state, c, nearbyNpcs(state, c.x, config.balance.money.donation.ai_handoff_search_radius_units), n => n.role === 'SYMPATHISANT' && n.faction_id === c.faction_id && n.donation_cents > 0
      && !state.buildings.some(b => b.type === 'permanence' && b.owner_id === c.faction_id && b.state === 'ACTIVE'
        && b.biome_id === zoneAt(state.world, n.x).biome_id)
      && distance(state, c.x, n.x) <= config.balance.money.donation.ai_handoff_search_radius_units);
    if (donor) return finish([...plan, ...go(donor.x, config.balance.money.donation.handoff_radius_units * 0.6)]);
  }
  if (economic && onTheWay(economic.x)) return finish([...plan, ...pursue(economic)]);
  const units = aiObservation(state).zones.get(zone.id).units;
  const defender = closest(state, c, units, n => hostile(c, n) && keep(n));
  // Réduire la présence adverse avant de recruter si elle maintient un site ennemi.
  const enemySite = state.buildings.some(b => b.subzone_id === zone.id && b.owner_id && b.owner_id !== c.faction_id && b.state === 'ACTIVE');
  // En attaque, abattre d’abord le maximum de sympathisants et militants adverses du quartier.
  if (here && (enemySite || objective.purpose === 'ATTACK') && defender) return finish([...plan, ...aiCombatCommands(state, config, c, defender, combatTempo(state, adaptation, defender))]);
  // Convaincre les neutres disponibles (pas ceux emportés par un rassemblement).
  const target = closest(state, c, units, n => n.role === 'NEUTRE' && !n.persuasion && !n.rally_event_id);
  if (target) return finish([...plan, ...go(target.x, config.prototype.persuasion.radius_units * config.prototype.ai.stop_distance_radius_ratio)]);
  // Après avoir recruté, traverser la zone pour en chasser les soutiens adverses.
  if (here && defender && objective.purpose !== 'REGROUP') return finish([...plan, ...aiCombatCommands(state, config, c, defender, combatTempo(state, adaptation, defender))]);
  return finish([...plan, ...go(zone.center, config.prototype.persuasion.radius_units)]);
}
