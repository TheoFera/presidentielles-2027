import { initializeMobileCombat, mobileCommand } from './mobile-combat.js';
import { validAIDifficulty } from './ai-settings.js';
import { CampaignStyleSystem, styleInfluenceMultiplier } from './campaign-styles.js';
import { initializeCampaign, campaignCommand, updateCampaignEvents, CampaignEventDirector } from './campaign-events.js';
import { FACTIONS, buildWorld, fingerprint, random, ringDelta, wrap, zoneAt } from './world.js';
import { createInfrastructure, updateEconomy, updateProduction } from './economy.js';
import { createSpawnTimers, updateSpawns, completePopulation } from './spawns.js';
import { createElectorate, localPersuasionMultiplier, populationByOrigin } from './territory.js';
import { createPolls, refreshElectoralState, updatePolls } from './electoral-state.js';
import { convertNeutral, neutralizeSupporter, applyOpinionDelta } from './npc-votes.js';
import { triggerMeeting, updateElectoralBuildings, meetingAttendeeStep } from './electoral-buildings.js';
import { updateCollector, updateMilitant } from './tasks.js';
import { validateSnapshot } from './snapshots.js';
import { movementBlocked, combatState, canCampaign, demobilizeUnit, interrupted } from './combat-state.js';
import { beginCombatTick, activateUltimate, requestAttack, updateCombat, updateMilitantCombat, wallBlockedPosition } from './combat.js';
import { updateEquipmentCollector, updateEquipmentProduction, updateGuard } from './military.js';
import { GamePhase, commandAllowed } from './phases.js';
import { ArenaSimulation } from './arena-simulation.js';
import { initialMatchState, startArena, finishArena, finishSprint, applyMatchDebug } from './match-lifecycle.js';
import { updateStrategicSites } from './strategic-sites.js';
import { updateCandidateResistance } from './candidate-resistance.js';
import { initializeMoney, prepareDonations, scheduleNextDonation, settleMoney, updateDonationCourier } from './money.js';

const clone = value => JSON.parse(JSON.stringify(value));
const presentationWorlds = new WeakMap();
function presentationWorld(world) {
  if (!presentationWorlds.has(world)) {
    // World geometry is static for a match. Share a detached, read-only copy
    // between render snapshots; mutable gameplay data is still copied per tick.
    const freeze = value => {
      if (value && typeof value === 'object') {
        for (const child of Object.values(value)) freeze(child);
        Object.freeze(value);
      }
      return value;
    };
    presentationWorlds.set(world, freeze(clone(world)));
  }
  return presentationWorlds.get(world);
}
const byId = (a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0;

export class GameSimulation {
  constructor(config, seed = config.prototype.seed, localCandidateId = 'candidate:melenchon', profile = {}, options = {}) {
    const difficulty = options.aiDifficulty ?? config.balance.ai?.difficulty ?? 'normal';
    if (!validAIDifficulty(difficulty)) throw new Error('Difficulté de l’IA inconnue : facile, normal ou difficile attendu.');
    this.config = clone(config);
    this.hz = config.balance.simulation_architecture.fixed_tick_hz;
    const initialSeed = Number(seed) >>> 0 || 1;
    const world = buildWorld(config);
    const rng = { rng_state: initialSeed };
    const infrastructure = createInfrastructure(world, config, rng);
    this.state = {
      snapshot_version: 11, config_fingerprint: fingerprint(config), ...initialMatchState(),
      seed: initialSeed, rng_state: rng.rng_state, tick: 0, next_npc_id: 1, next_event_id: 1,
      next_order_id: 1, next_transaction_id: 1, next_money_pickup_id: 1, transactions: [], money_pickups: [],
      next_attack_id: 1, next_projectile_id: 1, next_power_id: 1, next_temporary_id: 1, next_hit_id: 1, next_raid_id: 1,
      attacks: [], projectiles: [], powers: [], temporary_units: [], hit_results: [],
      phase: GamePhase.CAMPAIGN, days_remaining: config.balance.time.starting_days_before_first_round,
      local_candidate_id: FACTIONS.some(f => `candidate:${f}` === localCandidateId) ? localCandidateId : 'candidate:melenchon', ai_enabled: true,
      ai_difficulty: difficulty,
      world, candidates: [], npcs: [], buildings: infrastructure.buildings, building_slots: infrastructure.slots,
      spawn_timers: [], electorate: createElectorate(world, config), events: [],
      polls: createPolls(), actualGameState: null,
    };
    for (const faction of FACTIONS) {
      const start = world.subzones.find(zone => zone.id === config.layout.starting_positions[faction]);
      this.state.candidates.push({
        id: `candidate:${faction}`, role: 'CANDIDAT', faction_id: faction, eliminated: false,
        ai_objective: null,
        x: start.start + start.width * config.prototype.world.candidate_start_ratio,
        axis: 0, facing: 1, moving: false, campaign_active: true, persuasion_target_ids: [], special_charge: 0, podium_site_id: null,
        combat: combatState(), electoral_damage_received: 0, hits_received: 0, refunds_received: 0,
        resistance: config.balance.candidate_combat.resistance_max, last_damage_tick: -1000000, is_ko: false, disappeared: false,
        ko_started_tick: -1, disappear_tick: -1, respawn_tick: -1, headquarters_site_id: null,
        interaction_active: true, purchase_hold: null, purchase_latch_target_id: null, interaction_pause_until_tick: 0, interaction_chain_site_id: null,
        total_spent: 0, total_earned: 0, income_per_second: 0, spending: { BUILD: 0, UPGRADE: 0, PRINT: 0 },
        money: 0,
        start_x: start.start + start.width * config.prototype.world.candidate_start_ratio, last_hq_x: null,
      });
    }
    for (const zone of world.subzones) {
      const points = world.socialPoints.filter(p => p.subzone_id === zone.id);
      for (let index = 0; index < zone.initial_neutral_count; index++) {
        const spread = config.prototype.world.initial_spawn_spread_ratio;
        const ratio = (1 - spread) / 2 + spread * (index + 0.5) / zone.initial_neutral_count;
        this.spawn(zone, zone.start + zone.width * ratio, false, points[index % points.length]);
      }
    }
    initializeMoney(this);
    for (const c of this.state.candidates) initializeMobileCombat(this, c);
    initializeCampaign(this);
    CampaignStyleSystem.initialize(this, profile);
    this.state.spawn_timers = createSpawnTimers(this);
    refreshElectoralState(this.state);
  }

  secondsToTicks(seconds) { return Math.ceil(seconds * this.hz - 1e-9); }
  getState({ presentation = false } = {}) {
    if (!presentation) return clone(this.state);
    const { world, ...dynamic } = this.state;
    return { ...clone({ ...dynamic, campaign_snapshot: null }), world: presentationWorld(world) };
  }
  exportSnapshot() {
    // Un outil de test ou une commande peut avoir changé un PNJ depuis le dernier tick.
    refreshElectoralState(this.state);
    return JSON.stringify(this.state, null, 2);
  }

  /** Snapshot import is atomic. Invalid saves never damage the live game. */
  importSnapshot(json) {
    const next = typeof json === 'string' ? JSON.parse(json) : clone(json);
    this.state = validateSnapshot(next, this);
    return this.getState();
  }

  emit(type, data) {
    if (this.state.phase === GamePhase.SECOND_ROUND_SPRINT) {
      if (type === 'MeetingStarted') this.state.telemetry.sprint_meetings++;
      if (type === 'NpcConverted' && this.state.npcs.find(n => n.id === data.npc_id)?.former_eliminated_faction
        && !this.state.telemetry.reconverted_npc_ids.includes(data.npc_id)) this.state.telemetry.reconverted_npc_ids.push(data.npc_id);
    }
    this.state.events.push({ ...data, id: `event:${this.state.next_event_id++}`, tick: this.state.tick, type });
    const limit = this.config.prototype.debug.event_history_limit;
    if (this.state.events.length > limit) this.state.events.splice(0, this.state.events.length - limit);
  }

  waitTicks() {
    const world = this.config.prototype.world;
    return this.secondsToTicks(world.roam_wait_seconds_min + random(this.state) * (world.roam_wait_seconds_max - world.roam_wait_seconds_min));
  }

  spawn(zone, x, announce = true, originPoint = null) {
    if (this.state.phase !== GamePhase.CAMPAIGN || this.state.npcs.length >= this.config.layout.total_electors) return null;
    if (populationByOrigin(this.state, zone.id) >= zone.max_npcs_by_origin) return null;
    const points = this.state.world.socialPoints.filter(p => p.subzone_id === zone.id);
    const point = originPoint || points[Math.floor(random(this.state) * points.length)];
    if (x === undefined) x = point.x + (random(this.state) * 2 - 1) * this.config.prototype.world.respawn_spread_units;
    const npc = {
      id: `npc:${this.state.next_npc_id++}`, role: 'NEUTRE', faction_id: null,
      origin_biome_id: zone.biome_id, origin_subzone_id: zone.id, origin_social_point_id: point.id,
      x: wrap(x, this.state.world.length), facing: random(this.state) < 0.5 ? -1 : 1,
      moving: false, roam_target_x: wrap(x, this.state.world.length), roam_wait_ticks: this.waitTicks(),
      persuasion: null, persuasion_target_ids: [], hidden_durability: 0, converted_tick: -1, promoted_tick: -1, task: null,
      combat: combatState(), raid: null, guard_biome_id: null, guard_anchor_x: null, demobilized_tick: -1, meeting_target_id: null,
      donation_cents: 0, next_donation_tick: null,
    };
    this.state.npcs.push(npc);
    if (announce) this.emit('NeutralSpawned', { npc_id: npc.id, subzone_id: zone.id });
    return npc;
  }

  applyCommand(command) {
    if (!commandAllowed(this.state, command, this.config.prototype.debug.commands_enabled)) return;
    if (CampaignStyleSystem.command(this, command)) return;
    if (campaignCommand(this, command)) return;
    if (applyMatchDebug(this, command)) return;
    if (this.state.phase === GamePhase.FIRST_ROUND_ARENA && command.type === 'DebugSetAIEnabled') {
      if (typeof command.enabled === 'boolean') this.state.ai_enabled = command.enabled;
      return;
    }
    if (this.state.phase === GamePhase.FIRST_ROUND_ARENA && command.type === 'DebugSelectCandidate') {
      if (this.state.candidates.some(c => c.id === command.candidateId)) this.state.local_candidate_id = command.candidateId;
      return;
    }
    if (this.state.phase === GamePhase.FIRST_ROUND_ARENA && !['DebugSelectCandidate', 'DebugSetAIEnabled'].includes(command.type)) {
      new ArenaSimulation(this.config, this.state.arena).applyCommand(command); return;
    }
    const candidate = this.state.candidates.find(c => c.id === command.candidateId);
    if (candidate?.eliminated || command.factionId === this.state.eliminated_faction) return;
    if (command.type === 'SetAIObjective') {
      const objective = command.objective;
      if (candidate && this.state.ai_enabled && objective && ['SETUP', 'CONQUER', 'DEFEND', 'RECOVER'].includes(objective.purpose)
        && this.state.world.subzones.some(z => z.id === objective.subzone_id) && Number.isInteger(objective.expires_tick)
        && objective.expires_tick > this.state.tick) candidate.ai_objective = {
          subzone_id: objective.subzone_id, purpose: objective.purpose, expires_tick: objective.expires_tick };
      return;
    }
    if (mobileCommand(this, candidate, command, activateUltimate)) return;
    if (command.type === 'Attack') { requestAttack(this, candidate, command.direction); return; }
    if (command.type === 'Move') {
      if (candidate && [-1, 0, 1].includes(command.axis)) candidate.axis = command.axis;
      return;
    }
    if (command.type === 'SetCampaignActive') {
      if (candidate && typeof command.active === 'boolean') candidate.campaign_active = command.active;
      return;
    }
    if (command.type === 'InteractionPresence') {
      if (candidate && typeof command.active === 'boolean') candidate.interaction_active = command.active;
      return;
    }
    if (!this.config.prototype.debug.commands_enabled) return;
    switch (command.type) {
      case 'DebugAddInfluence': {
        if (!candidate || !FACTIONS.includes(command.factionId)) break;
        const zone = zoneAt(this.state.world, candidate.x);
        applyOpinionDelta(this, command.factionId, 100 / this.config.layout.total_electors, { subzoneId: zone.id, source: 'DÉBOGAGE' });
        break;
      }
      case 'DebugNeutral50': {
        if (!candidate) break;
        const zone = zoneAt(this.state.world, candidate.x);
        for (const npc of this.state.npcs.filter(n => zoneAt(this.state.world, n.x).id === zone.id && n.role === 'SYMPATHISANT')) {
          if (random(this.state) < 0.5) neutralizeSupporter(this, npc, 'DÉBOGAGE');
        }
        break;
      }
      case 'DebugBuildElectoral': {
        if (!candidate || !['tour_communication', 'institut_sondage', 'meeting'].includes(command.buildingType)) break;
        const building = this.state.buildings.find(b => b.subzone_id === zoneAt(this.state.world, candidate.x).id && b.type === command.buildingType);
        if (building.state === 'ACTIVE' || (building.owner_id && building.owner_id !== candidate.faction_id)) break;
        if (building.type === 'tour_communication' && this.state.buildings.filter(b => b.type === building.type && b.state === 'ACTIVE' && b.owner_id === candidate.faction_id).length >= this.config.balance.buildings.tour_communication.global_limit) break;
        building.owner_id = candidate.faction_id; building.level = 1; building.state = 'ACTIVE'; building.last_action_tick = this.state.tick;
        this.emit('DebugBuildingConstructed', { target_id: building.id });
        break;
      }
      case 'DebugMeeting': {
        if (!candidate) break;
        const building = this.state.buildings.find(b => b.type === 'meeting' && b.subzone_id === zoneAt(this.state.world, candidate.x).id && b.state === 'ACTIVE');
        if (building) triggerMeeting(this, building, candidate.faction_id, candidate.id);
        break;
      }
      case 'DebugControlZone': {
        if (!candidate) break;
        const zone = zoneAt(this.state.world, candidate.x);
        for (const npc of this.state.npcs.filter(n => zoneAt(this.state.world, n.x).id === zone.id)) {
          if (npc.role === 'SYMPATHISANT' && npc.faction_id !== candidate.faction_id) neutralizeSupporter(this, npc, 'DÉBOGAGE');
          if (npc.role === 'NEUTRE') convertNeutral(this, npc, candidate.faction_id, 'DÉBOGAGE');
        }
        this.emit('DebugZoneControlled', { subzone_id: zone.id, candidate_id: candidate.id });
        break;
      }
      case 'DebugSpawnUnit': {
        if (!candidate || !FACTIONS.includes(command.factionId) || !['SYMPATHISANT', 'MILITANT', 'SERVICE_D_ORDRE'].includes(command.role)
          || (command.role === 'SERVICE_D_ORDRE' && command.factionId === 'philippe')) break;
        const zone = this.state.world.subzones.find(z => z.id === this.config.layout.starting_positions[command.factionId]);
        const npc = this.spawn(zone, candidate.x + candidate.facing * this.config.balance.debug.combat_spawn_distance);
        if (!npc) { this.emit('DebugSpawnCapacityReached', { subzone_id: zone.id }); break; }
        npc.role = command.role; npc.faction_id = command.factionId;
        if (npc.role === 'SYMPATHISANT') scheduleNextDonation(this, npc);
        npc.hidden_durability = this.config.balance.physical_units[command.role === 'SERVICE_D_ORDRE' ? 'service_ordre' : command.role.toLowerCase()].hidden_durability;
        npc.guard_biome_id = command.role === 'SERVICE_D_ORDRE' ? zoneAt(this.state.world, npc.x).biome_id : null;
        npc.guard_anchor_x = command.role === 'SERVICE_D_ORDRE' ? npc.x : null;
        npc.roam_wait_ticks = this.secondsToTicks(10);
        this.emit('DebugUnitSpawned', { npc_id: npc.id, role: npc.role });
        break;
      }
      case 'DebugSelectCandidate':
        if (candidate) {
          this.state.local_candidate_id = candidate.id;
          for (const c of this.state.candidates) c.axis = 0;
          this.emit('ControllerChanged', { candidate_id: candidate.id });
        }
        break;
      case 'DebugSetAIEnabled':
        if (typeof command.enabled === 'boolean') {
          this.state.ai_enabled = command.enabled;
          for (const c of this.state.candidates) if (c.id !== this.state.local_candidate_id) c.axis = 0;
        }
        break;
      case 'DebugTeleport': {
        const zone = this.state.world.subzones.find(z => z.id === command.subzoneId);
        if (candidate && zone) { candidate.x = zone.center; candidate.axis = 0; this.emit('CandidateTeleported', { candidate_id: candidate.id, subzone_id: zone.id }); }
        break;
      }
      case 'DebugTeleportTarget': {
        const target = [...this.state.buildings, ...this.state.npcs].find(e => e.id === command.targetId);
        if (candidate && target) {
          candidate.x = target.x; candidate.axis = 0; candidate.purchase_hold = null;
          this.emit('CandidateTeleported', { candidate_id: candidate.id, target_id: target.id });
        }
        break;
      }
      case 'DebugGrantMoney':
        if (candidate) {
          candidate.money += this.config.balance.debug.test_money_amount;
          this.emit('DebugMoneyGranted', { candidate_id: candidate.id, amount: this.config.balance.debug.test_money_amount });
        }
        break;
      case 'DebugDemobilize': {
        const npc = this.state.npcs.find(n => n.id === command.npcId);
        if (npc) demobilizeUnit(this, npc);
        break;
      }
    }
    refreshElectoralState(this.state);
  }

  step(commands = []) {
    if (this.state.phase === GamePhase.RESULTS) return;
    const previousPhase = this.state.phase;
    const controlsBefore = this.state.electorate.map(e => e.controller);
    for (const command of commands) {
      this.applyCommand(command);
      if (this.state.phase !== previousPhase) return; // New phase accepts only the next tick's inputs.
    }
    const state = this.state;
    if (state.campaign_style_selection) return;
    state.match_tick++;
    if (state.phase === GamePhase.FIRST_ROUND_ARENA) {
      const arena = new ArenaSimulation(this.config, state.arena); arena.step();
      if (state.arena.eliminated_faction) finishArena(this, state.arena.eliminated_faction);
      return;
    }
    const dt = 1 / this.hz;
    state.tick++;
    beginCombatTick(this);
    for (const candidate of state.candidates) {
      if (candidate.eliminated || candidate.is_ko || candidate.campaign_arena_id || movementBlocked(candidate)) continue;
      candidate.x = wallBlockedPosition(this, candidate, wrap(candidate.x + candidate.axis * this.config.prototype.movement.candidate_speed_units_per_second * dt, state.world.length));
      candidate.moving = candidate.axis !== 0;
      if (candidate.axis) candidate.facing = candidate.axis;
      if (candidate.podium_site_id) {
        const podium = state.buildings.find(b => b.id === candidate.podium_site_id);
        if (!podium || Math.abs(ringDelta(candidate.x, podium.x, state.world.length)) > this.config.balance.buildings.meeting.podium_half_width) {
          candidate.podium_site_id = null;
          candidate.combat.height = 0;
        }
      }
    }
    updateSpawns(this);
    for (const npc of state.npcs) {
      if (npc.role === 'MILITANT') updateMilitantCombat(this, npc);
      if (npc.role === 'SERVICE_D_ORDRE') updateGuard(this, npc);
    }
    updateCombat(this);
    updateCandidateResistance(this);
    updateCampaignEvents(this);
    CampaignStyleSystem.update(this);
    this.updatePersuasion();
    updateEconomy(this);
    updateProduction(this);
    updateEquipmentProduction(this);
    prepareDonations(this);
    this.updateNpcs();
    updateElectoralBuildings(this);
    updateStrategicSites(this);
    settleMoney(this);
    refreshElectoralState(state);
    const days = state.phase === GamePhase.SECOND_ROUND_SPRINT ? 0 : Math.max(0,
      this.config.balance.time.starting_days_before_first_round - (state.campaign_time_offset || 0) - Math.floor(state.tick / this.secondsToTicks(this.config.balance.time.real_seconds_per_game_day)));
    if (days !== state.days_remaining) { state.days_remaining = days; this.emit('DayChanged', { days_remaining: days }); }
    state.campaign_day_remaining = days;
    state.campaign_elapsed_days = this.config.balance.time.starting_days_before_first_round - days;
    state.campaign_progress_01 = state.campaign_elapsed_days / this.config.balance.time.starting_days_before_first_round;
    if (state.phase === GamePhase.CAMPAIGN && !state.campaign_style_selection) CampaignEventDirector.update(this);
    updatePolls(this);
    if (state.phase === GamePhase.CAMPAIGN && days === 0 && !state.campaign_style_selection) {
      completePopulation(this);
      refreshElectoralState(state);
      startArena(this);
    }
    else if (state.phase === GamePhase.SECOND_ROUND_SPRINT) {
      state.sprint_elapsed_ticks++; state.sprint_remaining_ticks = Math.max(0, state.sprint_remaining_ticks - 1);
      state.electorate.forEach((e, i) => {
        if (e.controller !== controlsBefore[i] && !state.telemetry.changed_subzone_ids.includes(e.subzone_id)) state.telemetry.changed_subzone_ids.push(e.subzone_id);
      });
      if (state.sprint_remaining_ticks === 0) finishSprint(this);
    }
  }

  persuasionTicks(actor) {
    const settings = this.config.balance.persuasion;
    const base = actor.role === 'MILITANT' ? settings.militant_base_seconds
      : settings.candidate_base_seconds * (actor.faction_id === 'melenchon' ? settings.melenchon_personal_time_multiplier : 1);
    const candidate = this.state.candidates.find(item => item.faction_id === actor.faction_id);
    const biome = zoneAt(this.state.world, actor.x).biome_id;
    const style = Math.max(0.1, styleInfluenceMultiplier(this.config, candidate, biome));
    return this.secondsToTicks(base * localPersuasionMultiplier(this.state, this.config, actor) / style);
  }

  updatePersuasion() {
    const state = this.state;
    const radius = this.config.prototype.persuasion.radius_units;
    const maxTargets = this.config.balance.persuasion.max_simultaneous_targets_per_actor;
    // Gameplay sees an actor's activity intention, never its input source or camera ownership.
    const eligible = [...state.candidates.filter(c => !c.eliminated && c.campaign_active), ...state.npcs.filter(n => n.role === 'MILITANT')]
      .filter(actor => canCampaign(actor) && !actor.moving && !actor.axis && Math.abs(actor.combat?.knockback_velocity || 0) <= 0.02);
    const claims = [];
    for (const actor of eligible) {
      for (const npc of state.npcs) {
        const distance = Math.abs(ringDelta(actor.x, npc.x, state.world.length));
        if (npc.role === 'NEUTRE' && distance <= radius) claims.push({ actor, npc, distance, retained: npc.persuasion?.actor_id === actor.id });
      }
    }
    // Keep a conversation until it breaks. New claims use distance then stable IDs,
    // so overlapping actors can never convert the same person twice in a tick.
    claims.sort((a, b) => Number(b.retained) - Number(a.retained) || a.distance - b.distance || byId(a.actor, b.actor) || byId(a.npc, b.npc));
    const assigned = new Map();
    for (const actor of [...state.candidates, ...state.npcs]) actor.persuasion_target_ids = [];
    for (const { actor, npc } of claims) {
      if (assigned.has(npc.id) || actor.persuasion_target_ids.length >= maxTargets) continue;
      assigned.set(npc.id, actor);
      actor.persuasion_target_ids.push(npc.id);
    }
    for (const npc of state.npcs) {
      const actor = assigned.get(npc.id);
      if (!actor) { npc.persuasion = null; continue; }
      if (npc.persuasion?.actor_id !== actor.id) npc.persuasion = { actor_id: actor.id, elapsed_ticks: 0, required_ticks: this.persuasionTicks(actor) };
      npc.persuasion.elapsed_ticks++;
      npc.facing = ringDelta(npc.x, actor.x, state.world.length) < 0 ? -1 : 1;
      if (npc.persuasion.elapsed_ticks >= npc.persuasion.required_ticks) {
        convertNeutral(this, npc, actor.faction_id, 'PERSUASION');
        actor.persuasion_target_ids = actor.persuasion_target_ids.filter(id => id !== npc.id);
      }
    }
  }

  updateNpcs() {
    const state = this.state;
    const settings = this.config.prototype.world;
    for (const npc of state.npcs) {
      if (npc.role === 'SERVICE_D_ORDRE' || npc.combat.engaged || interrupted(npc)) continue;
      npc.moving = false;
      const origin = state.world.socialPoints.find(p => p.id === npc.origin_social_point_id);
      if (npc.meeting_target_id && meetingAttendeeStep(this, npc)) continue;
      if (npc.role === 'SYMPATHISANT' && npc.task?.kind === 'COLLECT_TRACT') { updateCollector(this, npc); continue; }
      if (npc.role === 'SYMPATHISANT' && ['DELIVER_DONATION', 'RETURN_DONATION'].includes(npc.task?.kind)) { updateDonationCourier(this, npc); continue; }
      if (npc.role === 'MILITANT' && npc.task?.kind === 'COLLECT_EQUIPMENT') { updateEquipmentCollector(this, npc); continue; }
      if (npc.role === 'MILITANT') { updateMilitant(this, npc); continue; }
      if (npc.role === 'DEMOBILISE') {
        const delta = ringDelta(npc.x, npc.roam_target_x, state.world.length);
        const step = this.config.balance.physical_units.demobilized.move_speed / this.hz;
        if (Math.abs(delta) <= step) {
          npc.x = npc.roam_target_x; npc.role = 'NEUTRE'; npc.roam_wait_ticks = this.waitTicks();
          this.emit('NpcReturnedHome', { npc_id: npc.id, social_point_id: origin.id });
        } else {
          npc.facing = Math.sign(delta); npc.x = wrap(npc.x + npc.facing * step, state.world.length); npc.moving = true;
        }
        continue;
      }
      if (npc.persuasion && this.config.prototype.persuasion.freeze_target_while_persuading) continue;
      if (npc.roam_wait_ticks > 0) { npc.roam_wait_ticks--; continue; }
      const delta = ringDelta(npc.x, npc.roam_target_x, state.world.length);
      if (Math.abs(delta) <= settings.arrival_epsilon_units) {
        const zone = state.world.subzones.find(z => z.id === npc.origin_subzone_id);
        npc.roam_target_x = Math.max(zone.start + settings.arrival_epsilon_units, Math.min(zone.end - settings.arrival_epsilon_units, origin.x + (random(state) * 2 - 1) * settings.roam_radius_units));
        npc.roam_wait_ticks = this.waitTicks();
      } else {
        npc.facing = Math.sign(delta); npc.moving = true;
        npc.x = wrap(npc.x + npc.facing * Math.min(Math.abs(delta), settings.roam_speed_units_per_second / this.hz), state.world.length);
      }
    }
  }

  describeCandidate(candidate) {
    return { ...candidate, zone: zoneAt(this.state.world, candidate.x).id };
  }
}
