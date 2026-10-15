import { airborne, charging, cancelCharge, diving, startDive, updateActions, verticalHit } from './combat-actions.js';
import { updateMobileCombat, successfulNormalHit, changeCharge } from './mobile-combat.js';
import { activeCampaignStyle } from './campaign-styles.js';
import { startStyleUltimate, updateStyleTemporary, updateMolotov, updateStyleEffects } from './style-ultimates.js';
import { combatDelta, combatPosition } from './combat-geometry.js';
import { distance, stableIdOrder } from './territory.js';
import { moveNpcTowards } from './tasks.js';
import { canBeHit, combatActors, findCombatActor, combatState, enemies, hit, interrupted, nearestEnemy } from './combat-state.js';
import { truceFilter } from './ai-balance.js';
import { FACTIONS } from './world.js';
import { isHumanCandidate } from './human-candidates.js';
import { pendingSatchel, invisibleToEnemies } from './minor-ultimate-catalog.js';
import { startMinorUltimate, updateMinorUltimates, detonateSatchel, barrierBlockedPosition, revealCandidate, toolsAttack, applyToolHit } from './minor-ultimates.js';

export function requestAttack(sim, actor, direction = null) {
  if (!actor || actor.eliminated || actor.role !== 'CANDIDAT' || !actor.campaign_active || actor.is_ko) return;
  actor.combat.buffer_until_tick = sim.state.tick + sim.secondsToTicks(sim.config.balance.candidate_combat.input_buffer_seconds);
  if ([-1, 1].includes(direction)) actor.combat.requested_direction = direction;
}

export function cancelCurrentAttack(sim, actor) {
  cancelCharge(actor);
  sim.state.attacks = sim.state.attacks.filter(a => a.owner_id !== actor.id);
  Object.assign(actor.combat, { attack_id: null, buffer_until_tick: -1, requested_direction: null, hitstop_ticks: 0 });
}

export function attackInput(sim, actor, type) {
  if (type === 'CancelAttack') { cancelCharge(actor); actor.combat.buffer_until_tick = -1; return; }
  const c = actor.combat, b = sim.config.balance.candidate_combat;
  if (type === 'ReleaseAttack') {
    if (c.press_tick == null) return;
    if (c.press_airborne) { cancelCharge(actor); return; }
    const held = sim.state.tick - c.press_tick, readyTicks = sim.secondsToTicks(b.charge_ready_seconds);
    const wasCharging = charging(actor), full = held >= readyTicks;
    cancelCharge(actor);
    // Le coup léger est parti à l’appui : relâcher avant le début de la charge ne fait rien de plus.
    if (!wasCharging) return;
    if (interrupted(actor) || actor.is_ko) return;
    // Relâché tôt : dégâts proportionnels au chargement ; charge complète = léger bonus et chute.
    const ratio = Math.min(1, held / readyTicks);
    const damage = full ? b.charged_damage : b.charged_damage * b.charged_partial_max_ratio * ratio;
    c.combo_step = 0; c.combo_expires_tick = 0; c.buffer_until_tick = -1;
    makeAttack(sim, actor, 'CHARGED', { strong: true, step: 0, range: b.finisher_range, partial: !full,
      damage, knockback: 0, stun_seconds: full ? b.charged_stun_seconds : b.hit_stun_seconds,
      electoral_damage: b.electoral_damage_on_finisher_percent_points });
    return;
  }
  if (!actor.campaign_active || actor.is_ko || actor.eliminated || actor.campaign_debate_id || actor.crisis_meeting_id && type !== 'Jump'
    || c.stun_ticks) return;
  // Le saut interrompt un coup, sauf la réception d’un plongeon (sinon, plongeons à l’infini).
  const diveRecovery = sim.state.attacks.some(a => a.id === c.attack_id && a.kind === 'DIVE');
  if (type === 'Jump' && !airborne(actor) && !diveRecovery && Math.abs(c.knockback_velocity) <= 0.02) {
    cancelCurrentAttack(sim, actor); c.jump_tick = sim.state.tick; c.height = 0; c.jump_base = 0;
    // Sur un pupitre du mode Débat, le saut part de la hauteur du pupitre.
    if (sim.state.platforms?.length) { c.jump_base = actor.platform_id ? sim.state.platforms.find(p => p.id === actor.platform_id).height : 0; c.height = c.jump_base; c.drop_through_id = null; actor.platform_id = null; }
    actor.podium_site_id = null;
    actor.dash_active = false; actor.dash_until_tick = 0; actor.dash_invulnerable_until_tick = 0;
    actor.purchase_hold = null; actor.style_hold = null; actor.style_interaction_held = false;
    return;
  }
  if (type === 'PressAttack' && !actor.dash_active && c.press_tick == null) {
    if (airborne(actor)) { c.press_tick = sim.state.tick; c.press_airborne = true; requestAttack(sim, actor); return; }
    // Frappe dès l’appui ; garder le bouton enfoncé enchaîne ensuite sur la charge.
    c.press_tick = sim.state.tick; c.press_airborne = false; requestAttack(sim, actor);
  }
}

export function beginCombatTick(sim) {
  const { state, config, hz } = sim;
  updateMobileCombat(sim);
  for (const actor of combatActors(state)) {
    // Les hologrammes recopient Mélenchon plus loin : ils ne bougent, ne sautent ni ne reculent seuls.
    if (actor.role === 'HOLOGRAMME') continue;
    actor.moving = !!actor.dash_active;
    updateActions(sim, actor);
    const c = actor.combat;
    if (sim.state.tick > c.combo_expires_tick) c.combo_step = 0;
    c.engaged = false;
    if (c.cooldown_ticks > 0) c.cooldown_ticks--;
    if (c.stun_ticks > 0) c.stun_ticks--;
    if (c.hitstop_ticks > 0) { c.hitstop_ticks--; continue; }
    if (Math.abs(c.knockback_velocity) > 0.02) {
      actor.x = barrierBlockedPosition(sim, actor, combatPosition(state, actor.x + c.knockback_velocity / hz));
      c.knockback_velocity *= Math.max(0, 1 - config.balance.candidate_combat.knockback_decay_per_second / hz);
    } else c.knockback_velocity = 0;
  }
}

export function wallBlockedPosition(sim, actor, desired) {
  desired = barrierBlockedPosition(sim, actor, desired);
  const d = combatDelta(sim.state, actor.x, desired);
  if (!d) return desired;
  const radius = sim.config.balance.specials.philippe_crs_wall.interception_radius;
  const guards = sim.state.temporary_units.filter(t => t.role === 'CRS' && enemies(actor, t));
  for (const guard of guards.sort((a, b) => distance(sim.state, actor.x, a.x) - distance(sim.state, actor.x, b.x))) {
    const ahead = combatDelta(sim.state, actor.x, guard.x) * Math.sign(d);
    if (ahead >= 0 && ahead <= Math.abs(d) + radius) return combatPosition(sim.state, actor.x + Math.sign(d) * Math.max(0, ahead - radius));
  }
  return desired;
}

/** Les candidats adverses ne se superposent pas au sol : en se collant, ils se repoussent
 * à parts égales (ou entièrement l’autre si l’un est contre un bord du débat).
 * Sauter par-dessus reste possible, le dash traverse, les PNJ ne sont pas concernés. */
export function separateCandidates(sim) {
  const { state } = sim, width = sim.config.balance.candidate_combat.body_width;
  const solid = c => !c.vehicle && !c.dash_active && c.combat.jump_tick == null && !(c.combat.knockdown_tick != null && c.combat.stun_ticks > 0);
  const bodies = state.candidates.filter(c => canBeHit(c) && solid(c)).sort(stableIdOrder);
  for (let i = 0; i < bodies.length; i++) for (let j = i + 1; j < bodies.length; j++) {
    const a = bodies[i], b = bodies[j];
    if (!enemies(a, b) || Math.abs((a.combat.height || 0) - (b.combat.height || 0)) > 0.5) continue;
    const d = combatDelta(state, a.x, b.x), overlap = width - Math.abs(d);
    if (overlap <= 1e-9) continue;
    const side = Math.sign(d) || 1;
    const before = { a: a.x, b: b.x };
    a.x = barrierBlockedPosition(sim, a, combatPosition(state, a.x - side * overlap / 2)); b.x = barrierBlockedPosition(sim, b, combatPosition(state, b.x + side * overlap / 2));
    const rest = overlap - Math.abs(combatDelta(state, before.a, a.x)) - Math.abs(combatDelta(state, before.b, b.x));
    if (rest > 1e-9) {
      if (Math.abs(combatDelta(state, before.a, a.x)) < overlap / 2) b.x = barrierBlockedPosition(sim, b, combatPosition(state, b.x + side * rest));
      else a.x = barrierBlockedPosition(sim, a, combatPosition(state, a.x - side * rest));
    }
  }
}

function makeAttack(sim, actor, kind, spec) {
  if (['CANDIDATE', 'CHARGED', 'DIVE'].includes(kind)) {
    revealCandidate(sim, actor);
    spec = toolsAttack(sim, actor, spec);
  }
  const b = sim.config.balance.candidate_combat;
  const attack = { id: `attack:${sim.state.next_attack_id++}`, owner_id: actor.id, faction_id: actor.faction_id,
    kind, direction: actor.facing, elapsed_ticks: 0, hit_ids: [], launched: false, charged: false,
    windup_ticks: sim.secondsToTicks(spec.strong ? b.finisher_windup_seconds : b.light_windup_seconds),
    active_ticks: sim.secondsToTicks(b.active_seconds), recovery_ticks: sim.secondsToTicks(spec.strong ? b.finisher_recovery_seconds : b.light_recovery_seconds), ...spec };
  actor.combat.attack_id = attack.id;
  sim.state.attacks.push(attack);
  sim.emit('AttackStarted', { attack_id: attack.id, actor_id: actor.id, kind, combo_step: spec.step || 0 });
  return attack;
}

export function startNpcAttack(sim, actor, kind, settings) {
  if (interrupted(actor) || actor.combat.cooldown_ticks > 0) return;
  makeAttack(sim, actor, kind, settings);
  actor.combat.cooldown_ticks = sim.secondsToTicks(settings.cooldown_seconds);
}

/** Un coup léger qui a touché peut être interrompu dès la fin de l’arrêt sur image
 * pour enchaîner le suivant : le combo est garanti s’il est tapé à temps. */
function comboCancel(sim, actor) {
  const c = actor.combat, attack = sim.state.attacks.find(a => a.id === c.attack_id);
  return !!attack && attack.kind === 'CANDIDATE' && attack.step < 3 && attack.hit_ids.length > 0
    && attack.elapsed_ticks >= sim.secondsToTicks(sim.config.balance.candidate_combat.combo_cancel_seconds)
    && !c.hitstop_ticks && !c.stun_ticks && !charging(actor) && !actor.dash_active && !airborne(actor);
}

function startCandidateAttack(sim, actor) {
  const c = actor.combat; const b = sim.config.balance;
  const cancel = comboCancel(sim, actor);
  if (actor.campaign_debate_id || actor.crisis_meeting_id || actor.eliminated || c.buffer_until_tick < sim.state.tick || interrupted(actor) && !cancel || !actor.campaign_active || actor.is_ko) return;
  // Pas de plongeon au ras du sol : l’appui reste en mémoire jusqu’à la hauteur minimale.
  if (diving(actor) || airborne(actor) && c.height < b.candidate_combat.dive_min_height) return;
  c.buffer_until_tick = -1;
  if (cancel) sim.state.attacks = sim.state.attacks.filter(a => a.id !== c.attack_id);
  if (c.requested_direction) actor.facing = c.requested_direction;
  c.requested_direction = null; actor.purchase_hold = null;
  if (airborne(actor)) {
    // En l’air, Frapper déclenche le coup plongeant.
    const k = b.candidate_combat;
    startDive(sim, actor); c.combo_step = 0;
    makeAttack(sim, actor, 'DIVE', { step: 0, strong: false, windup_ticks: 0, active_ticks: sim.secondsToTicks(10),
      recovery_ticks: sim.secondsToTicks(k.dive_landing_recovery_seconds), range: k.dive_range, damage: k.dive_damage,
      knockback: k.dive_knockback, stun_seconds: k.hit_stun_seconds, electoral_damage: k.electoral_damage_on_light_hit_percent_points });
    return;
  }
  c.combo_step = sim.state.tick > c.combo_expires_tick ? 1 : c.combo_step % 3 + 1;
  c.combo_expires_tick = sim.state.tick + sim.secondsToTicks(b.candidate_combat.combo_reset_seconds);
  const strong = c.combo_step === 3;
  const scarf = actor.ultimate_effect?.kind === 'SCARF' && actor.ultimate_effect.expires_tick > sim.state.tick;
  makeAttack(sim, actor, scarf ? 'SCARF' : 'CANDIDATE', { step: c.combo_step, strong,
    stun_seconds: !scarf && !strong ? b.candidate_combat.light_stun_seconds : b.candidate_combat.hit_stun_seconds,
    range: scarf ? b.specials.scarf.range : strong ? b.candidate_combat.finisher_range : b.candidate_combat.light_range,
    damage: scarf ? b.specials.scarf.damage : strong ? b.candidate_combat.finisher_hidden_damage : b.candidate_combat.light_hit_hidden_damage,
    knockback: scarf ? b.specials.scarf.knockback : strong ? b.candidate_combat.finisher_knockback : b.candidate_combat.light_knockback,
    electoral_damage: strong ? b.candidate_combat.electoral_damage_on_finisher_percent_points : b.candidate_combat.electoral_damage_on_light_hit_percent_points });
}

export function ultimateBlockedReason(sim, actor) {
  if (!actor || actor.eliminated || actor.is_ko || !actor.campaign_active) return 'Ultime indisponible : candidat hors combat.';
  if (!activeCampaignStyle(sim.config, actor)) return 'Choisis d’abord un style à ton QG.';
  const satchel = pendingSatchel(sim.state, actor);
  if (satchel) return actor.combat.stun_ticks > 0 ? 'Personnage étourdi : attends de reprendre le contrôle.' : satchel.launched ? null : 'Lancer du cartable en cours.';
  if (actor.bardella_guardian_armed) return 'Bardellisation déjà armée : elle se déclenchera au prochain KO.';
  if (activeCampaignStyle(sim.config, actor).ultimate.kind === 'BARDELLA' && actor.bardellisation_used) return 'Bardellisation déjà utilisée pour cette vie.';
  if (actor.ultimate_effect) return 'Un effet d’ultime est encore actif.';
  if (sim.state.powers.some(p => p.owner_id === actor.id && ['SAUSAGE', 'DELIVERY', 'BARRIER'].includes(p.kind) && p.expires_tick > sim.state.tick)) return 'Un ultime est encore en cours.';
  if (actor.special_charge < sim.config.balance.special_charge.required_points) return `Ultime chargé à ${Math.floor(100 * actor.special_charge / sim.config.balance.special_charge.required_points)} % : touche des adversaires pour le recharger.`;
  if (actor.combat.stun_ticks > 0) return 'Personnage étourdi : attends de reprendre le contrôle.';
  return null;
}

export function activateUltimate(sim, actor) {
  if (ultimateBlockedReason(sim, actor)) return;
  if (pendingSatchel(sim.state, actor)) { detonateSatchel(sim, actor); return; }
  const style = activeCampaignStyle(sim.config, actor);
  if (!style || style.ultimate.kind === 'BARDELLA' && actor.bardellisation_used) return;
  cancelCharge(actor);
  sim.state.attacks = sim.state.attacks.filter(a => a.owner_id !== actor.id);
  Object.assign(actor.combat, { attack_id: null, buffer_until_tick: -1, requested_direction: null, hitstop_ticks: 0, knockback_velocity: 0 });
  actor.dash_active = false; actor.dash_until_tick = 0; actor.dash_invulnerable_until_tick = 0;
  actor.dash_buffer_direction = 0; actor.dash_buffer_until_tick = -1;
  actor.purchase_hold = null; actor.style_hold = null; actor.style_interaction_held = false; actor.interaction_active = false;
  actor.interaction_locked = false; actor.axis = 0;
  const meeting = sim.state.campaign_events?.find(e => e.id === actor.crisis_meeting_id && e.attempt?.candidate_id === actor.id);
  if (meeting) { meeting.attempt = null; meeting.retry_tick = sim.state.tick + sim.secondsToTicks(1); sim.emit('InterruptCrisisMeeting', { campaign_event_id: meeting.id, candidate_id: actor.id }); }
  actor.crisis_meeting_id = null;
  changeCharge(sim, actor, 0); actor.combat.combo_step = 0;
  actor.active_ultimate_id = style.ultimate.kind;
  sim.emit('UltimateActivated', { candidate_id: actor.id, kind: style.ultimate.kind });
  if (style.ultimate.kind === 'BARDELLA') { actor.bardella_guardian_armed = true; sim.emit('BardellaGuardianArmed', { candidate_id: actor.id }); return; }
  triggerSpecial(sim, actor);
}

function triggerSpecial(sim, actor) {
  const { state, config } = sim;
  const kind = activeCampaignStyle(config, actor)?.ultimate.kind;
  if (!kind) return;
  const power = { id: `power:${state.next_power_id++}`, owner_id: actor.id, faction_id: actor.faction_id, kind, started_tick: state.tick, expires_tick: state.tick };
  state.powers.push(power);
  if (startMinorUltimate(sim, actor, power) || startStyleUltimate(sim, actor, power)) {
    // New styles share the same authoritative power lifetime.
  } else if (kind === 'WAVE') {
    const s = config.balance.specials.le_pen_navy_wave;
    const range = s.range_screens * config.prototype.world.units_per_screen;
    const launchTick=state.tick+sim.secondsToTicks(s.launch_delay_seconds);
    power.expires_tick=launchTick+sim.secondsToTicks(range/s.travel_speed);
    state.projectiles.push({ id: `projectile:${state.next_projectile_id++}`, power_id: power.id, owner_id: actor.id, faction_id: actor.faction_id,
      kind:'WAVE',x:actor.x,direction:actor.facing,speed:s.travel_speed,remaining_range:range,launch_tick:launchTick,launched:false,
      hit_ids:[],damage:s.candidate_resistance_damage,knockback:s.knockback,electoral_damage:s.candidate_electoral_damage_percent_points });
  } else {
    const hologram = kind === 'HOLOGRAMS';
    const s = hologram ? config.balance.specials.melenchon_holograms : config.balance.specials.philippe_crs_wall;
    power.expires_tick += sim.secondsToTicks(s.duration_seconds + (hologram ? s.appearance_seconds : 0));
    const offsets = hologram ? Array.from({ length: s.count }, (_, i) => (i % 2 ? 1 : -1) * (s.spawn_distance + Math.floor(i / 2) * s.spawn_spacing))
      : [...Array.from({ length: s.guards_left }, (_, i) => -(i + 1) * s.follow_offset), ...Array.from({ length: s.guards_right }, (_, i) => (i + 1) * s.follow_offset)];
    // Les hologrammes rejouent les gestes de Mélenchon avec un léger retard, plus grand pour les plus éloignés.
    if (hologram) power.trail = [];
    for (const [i, offset] of offsets.entries()) state.temporary_units.push({ id: `temporary:${state.next_temporary_id++}`, power_id: power.id,
      ...(hologram ? { mirror_delay_ticks: sim.secondsToTicks(s.echo_delay_seconds * (Math.floor(i / 2) + 1)), mirror_done_id: null } : {}),
      owner_id: actor.id, role: hologram ? 'HOLOGRAMME' : 'CRS', faction_id: actor.faction_id, ...(actor.team_id ? { team_id: actor.team_id } : {}), temporary: true, expired: false,
      x: hologram ? hologramX(state, actor, offset) : combatPosition(state, actor.x + offset), follow_offset: offset, facing: hologram ? actor.facing : Math.sign(offset) || actor.facing,
      // Un hologramme n’a pas de points de vie : il disparaît seulement à la fin du pouvoir.
      moving: false, spawn_tick: state.tick, ready_tick: state.tick + sim.secondsToTicks(hologram ? s.appearance_seconds : 0), expires_tick: power.expires_tick, hidden_durability: hologram ? 0 : s.guard_hidden_durability,
      combat: combatState(), persuasion_target_ids: [] });
  }
  // The same button consumes the power; a short recovery prevents double activation.
  makeAttack(sim, actor, 'SPECIAL', { strong: true, range: 0, damage: 0, knockback: 0, electoral_damage: 0,
    ...(kind === 'DELIVERY' ? { windup_ticks: sim.secondsToTicks(config.balance.minor_ultimates.delivery.call_seconds) } : {}) });
  sim.emit('SpecialTriggered', { power_id: power.id, candidate_id: actor.id, kind: power.kind });
}

// Hors du débat, la rue fait le tour du monde ; sur un plateau, la copie peut dépasser le bord.
const hologramX = (state, owner, offset) => state.debate_bounds ? owner.x + offset : combatPosition(state, owner.x + offset);
const MIRRORED_ATTACKS = ['CANDIDATE', 'CHARGED', 'SCARF', 'DIVE'];
const MIRRORED_POSE = ['press_tick', 'charge_active', 'press_airborne', 'jump_tick', 'height', 'jump_base', 'dive_tick', 'drop_through_id',
  'stun_ticks', 'hitstop_ticks', 'knockdown_tick', 'combo_step', 'combo_expires_tick', 'knockback_velocity'];
// Dates recopiées : décalées du retard de l’hologramme pour que l’animation se joue en différé.
const MIRRORED_TICKS = ['press_tick', 'jump_tick', 'dive_tick', 'knockdown_tick', 'combo_expires_tick'];
const MIRRORED_ATTACK_FIELDS = ['id', 'kind', 'step', 'strong', 'partial', 'range', 'stun_seconds', 'damage', 'knockback', 'electoral_damage',
  'direction', 'elapsed_ticks', 'windup_ticks', 'active_ticks', 'recovery_ticks'];

/** Mémorise l’état de Mélenchon à ce tick, pour que ses hologrammes le rejouent en différé. */
function recordHologramTrail(sim) {
  const { state } = sim;
  for (const power of state.powers) {
    if (power.kind !== 'HOLOGRAMS' || !power.trail) continue;
    const owner = state.candidates.find(c => c.id === power.owner_id);
    if (!owner) continue;
    const c = owner.combat, attack = state.attacks.find(a => a.id === c.attack_id && MIRRORED_ATTACKS.includes(a.kind));
    const pose = {};
    for (const key of MIRRORED_POSE) if (c[key] !== undefined) pose[key] = c[key];
    power.trail.push({ tick: state.tick, x: owner.x, facing: owner.facing, moving: !!owner.moving, axis: owner.axis || 0,
      dash_active: !!owner.dash_active, turn_tick: owner.turn_tick ?? null, pose,
      attack: attack ? Object.fromEntries(MIRRORED_ATTACK_FIELDS.filter(k => attack[k] !== undefined).map(k => [k, attack[k]])) : null });
    const longest = Math.max(0, ...state.temporary_units.filter(u => u.power_id === power.id).map(u => u.mirror_delay_ticks || 0));
    if (power.trail.length > longest + 1) power.trail.splice(0, power.trail.length - longest - 1);
  }
}

/** Hologramme de Mélenchon : copie exacte du candidat, décalée sur le côté.
 * Il rejoue, avec un léger retard, tout ce qu’a fait Mélenchon : marche, saut, charge et coups,
 * toujours à sa hauteur (pas de chute au-dessus du vide), en traversant tout.
 * Ses coups font exactement les mêmes dégâts que ceux de Mélenchon. */
function mirrorHologram(sim, unit, power) {
  const { state } = sim, trail = power?.trail;
  if (!trail?.length) return;
  const frame = trail[Math.max(0, trail.length - 1 - unit.mirror_delay_ticks)], delay = state.tick - frame.tick;
  unit.x = state.debate_bounds ? frame.x + unit.follow_offset : combatPosition(state, frame.x + unit.follow_offset);
  unit.facing = frame.facing; unit.moving = frame.moving; unit.axis = frame.axis;
  unit.dash_active = frame.dash_active; unit.turn_tick = frame.turn_tick == null ? frame.turn_tick : frame.turn_tick + delay;
  const to = unit.combat;
  for (const key of MIRRORED_POSE) { if (frame.pose[key] === undefined) delete to[key]; else to[key] = frame.pose[key]; }
  for (const key of MIRRORED_TICKS) if (to[key] != null) to[key] += delay;
  const source = frame.attack;
  let copy = state.attacks.find(a => a.id === to.attack_id);
  if (copy && (!source || copy.mirror_of !== source.id)) { state.attacks = state.attacks.filter(a => a !== copy); copy = null; to.attack_id = null; }
  // Un coup copié ne se rejoue qu’une fois, même s’il s’est terminé un peu avant celui de Mélenchon.
  if (!source || state.tick < (unit.ready_tick || 0) || !copy && unit.mirror_done_id === source.id) return;
  if (!copy) {
    copy = makeAttack(sim, unit, 'HOLOGRAM', { mirror_of: source.id, mirror_kind: source.kind, step: source.step || 0, strong: !!source.strong,
      partial: !!source.partial, range: source.range, stun_seconds: source.stun_seconds,
      damage: source.damage, knockback: source.knockback, electoral_damage: source.electoral_damage });
    unit.mirror_done_id = source.id;
  }
  Object.assign(copy, { direction: source.direction, elapsed_ticks: source.elapsed_ticks, windup_ticks: source.windup_ticks,
    active_ticks: source.active_ticks, recovery_ticks: source.recovery_ticks });
}

function meleeTargets(sim, owner, attack) {
  const radius = sim.config.balance.candidate_combat.target_radius;
  return combatActors(sim.state).filter(t => distance(sim.state, owner.x, t.x) <= attack.range + radius
    && combatDelta(sim.state, owner.x, t.x) * attack.direction >= -radius
    && enemies(owner, t) && !attack.hit_ids.includes(t.id) && verticalHit(sim.config, owner, t, attack))
    .sort((a, b) => distance(sim.state, owner.x, a.x) - distance(sim.state, owner.x, b.x) || stableIdOrder(a, b));
}

function updateAttacks(sim) {
  for (const attack of [...sim.state.attacks]) {
    if (sim.state.debate_bounds && sim.state.eliminated_faction) break;
    const actor = findCombatActor(sim.state, attack.owner_id);
    if (!actor || actor.combat.attack_id !== attack.id || !actor.faction_id || actor.expired) continue;
    if (actor.combat.hitstop_ticks > 0) continue;
    attack.elapsed_ticks++;
    if (attack.elapsed_ticks >= attack.windup_ticks && attack.elapsed_ticks < attack.windup_ticks + attack.active_ticks) {
      if (attack.kind === 'VERBAL' && !attack.launched) {
        const s = sim.config.balance.physical_units.militant;
        sim.state.projectiles.push({ id: `projectile:${sim.state.next_projectile_id++}`, power_id: null, owner_id: actor.id, faction_id: actor.faction_id,
          kind: 'VERBAL', x: actor.x, direction: attack.direction, speed: s.projectile_speed, remaining_range: s.projectile_range,
          hit_ids: [], damage: s.verbal_damage, knockback: s.verbal_knockback, electoral_damage: s.verbal_attack_electoral_damage });
        attack.launched = true;
      } else if (!['VERBAL', 'SPECIAL'].includes(attack.kind) && (MIRRORED_ATTACKS.includes(attack.mirror_kind || attack.kind) || attack.hit_ids.length === 0)) {
        const targets = meleeTargets(sim, actor, attack);
        for (const target of (MIRRORED_ATTACKS.includes(attack.mirror_kind || attack.kind) ? targets : targets.slice(0, 1))) {
        if (target && hit(sim, actor, target, attack, attack.id)) {
          attack.hit_ids.push(target.id);
          applyToolHit(sim, actor, target, attack);
          if (['CANDIDATE', 'CHARGED', 'DIVE'].includes(attack.kind) && !attack.charged) { successfulNormalHit(sim, actor, target, attack); attack.charged = true; }
        }
        }
      }
    }
    if (attack.elapsed_ticks >= attack.windup_ticks + attack.active_ticks + attack.recovery_ticks) actor.combat.attack_id = null;
  }
  sim.state.attacks = sim.state.attacks.filter(a => { const owner = findCombatActor(sim.state, a.owner_id); return owner?.combat.attack_id === a.id && !owner.expired; });
}

function updateProjectiles(sim) {
  const { state, config } = sim;
  for (const p of state.projectiles) {
    if (state.debate_bounds && state.eliminated_faction) break;
    const owner = findCombatActor(state, p.owner_id);
    if (!owner || owner.faction_id !== p.faction_id || owner.expired) { p.remaining_range = 0; continue; }
    if(p.launch_tick!=null&&state.tick<p.launch_tick)continue;
    if(p.kind==='WAVE'&&!p.launched){p.x=owner.x;p.direction=owner.facing;p.launched=true;}
    if(p.kind==='MOLOTOV'&&!p.launched){
      const target=findCombatActor(state, p.target_id);
      const visible=config.prototype.world.units_per_screen/2;
      const seen=target&&enemies(owner,target)&&!invisibleToEnemies(target,state.tick)&&Math.abs(combatDelta(state,owner.x,target.x))<=visible;
      const targetX=seen?target.x:combatPosition(state,owner.x+owner.facing*6);
      const delta=combatDelta(state,owner.x,targetX);
      p.x=owner.x;p.target_x=targetX;p.direction=Math.sign(delta)||owner.facing;
      p.remaining_range=Math.max(.1,Math.abs(delta));p.initial_range=p.remaining_range;p.launched=true;
    }
    if (p.kind === 'BUBBLE') { const target = findCombatActor(state, p.target_id); if (target && enemies(owner,target) && !invisibleToEnemies(target,state.tick)) p.direction = Math.sign(combatDelta(state,p.x,target.x)) || p.direction; }
    const step = Math.min(p.remaining_range, p.speed / sim.hz);
    if (updateMolotov(sim, p, step)) continue;
    const radius = p.kind === 'BUBBLE' ? config.balance.specials.zemmour.bubble_hit_radius : config.balance.candidate_combat.target_radius;
    const targets = combatActors(state).filter(t => {
      const along = combatDelta(state, p.x, t.x) * p.direction;
      return along >= -radius - (p.kind === 'WAVE' ? config.balance.specials.le_pen_navy_wave.body_length_units : 0)
        && along <= step + radius && enemies(owner, t) && !p.hit_ids.includes(t.id)
        && (p.kind !== 'VERBAL' || t.role !== 'SYMPATHISANT') && verticalHit(config, owner, t, p);
    })
      .sort((a, b) => distance(state, p.x, a.x) - distance(state, p.x, b.x) || stableIdOrder(a, b));
    for (const target of targets) {
      if (state.debate_bounds && state.eliminated_faction) break;
      let damage = p.damage;
      if (p.kind === 'WAVE') {
        const s = config.balance.specials.le_pen_navy_wave;
        if (target.role === 'SYMPATHISANT') damage = s.sympathisant_instant_demobilize ? target.hidden_durability : config.balance.physical_units.sympathisant.hidden_durability;
        else if (target.role === 'MILITANT') damage = config.balance.physical_units.militant.hidden_durability * s.militant_damage_fraction_of_full_durability;
        else if (target.role === 'SERVICE_D_ORDRE') damage = config.balance.physical_units.service_ordre.hidden_durability * s.service_ordre_damage_fraction_of_full_durability;
        else if (target.temporary) damage = config.balance.physical_units.service_ordre.hidden_durability * s.service_ordre_damage_fraction_of_full_durability;
      }
      const result = hit(sim, owner, target, { ...p, damage, ranged: true, strong: p.kind === 'WAVE' }, p.id);
      // Une esquive ou un relevé protégé ne consomme pas la touche de la vague.
      if (p.kind === 'WAVE' && !result) continue;
      p.hit_ids.push(target.id);
      if (['VERBAL', 'BUBBLE'].includes(p.kind)) { p.remaining_range = 0; break; }
    }
    const nextX = p.x + p.direction * step;
    p.x = combatPosition(state, nextX); p.remaining_range -= step;
    if (state.debate_bounds && p.x !== nextX) p.remaining_range = 0;
  }
  state.projectiles = state.projectiles.filter(p => p.remaining_range > 0);
}

function updateTemporaryUnits(sim) {
  const { state, config } = sim;
  recordHologramTrail(sim);
  for (const unit of state.temporary_units) {
    if (state.tick >= unit.expires_tick) unit.expired = true;
    const owner = state.candidates.find(c => c.id === unit.owner_id);
    if (!owner || owner.is_ko || owner.eliminated) { unit.expired = true; continue; }
    if (unit.expired) continue;
    if (unit.role === 'HOLOGRAMME') { mirrorHologram(sim, unit, state.powers.find(p => p.id === unit.power_id)); continue; }
    if (interrupted(unit) || state.tick < (unit.ready_tick || 0)) continue;
    if (updateStyleTemporary(sim, unit)) continue;
    const s = config.balance.specials.philippe_crs_wall;
    moveNpcTowards(sim, unit, combatPosition(state, owner.x + unit.follow_offset), s.follow_speed);
    const target = nearestEnemy(state, unit, s.attack_range + config.balance.candidate_combat.target_radius);
    unit.combat.target_id = target?.id || null;
    if (!target) continue;
    const d = combatDelta(state, unit.x, target.x);
    unit.facing = Math.sign(d) || unit.facing;
    if (Math.abs(d) <= s.attack_range + config.balance.candidate_combat.target_radius) startNpcAttack(sim, unit, 'CRS', {
      range: s.attack_range, damage: s.guard_hit_hidden_damage, knockback: s.guard_knockback,
      electoral_damage: s.electoral_damage, cooldown_seconds: s.attack_cooldown_seconds });
  }
  const expiredOwners = new Set(state.temporary_units.filter(t => t.expired).map(t => t.id));
  state.projectiles = state.projectiles.filter(p => !expiredOwners.has(p.owner_id));
  state.temporary_units = state.temporary_units.filter(t => !t.expired);
  state.powers = state.powers.filter(p => p.expires_tick > state.tick);
}

export function updateMilitantCombat(sim, npc) {
  const s = sim.config.balance.physical_units.militant;
  let target = nearestEnemy(sim.state, npc, s.detection_range, t => t.role !== 'SYMPATHISANT');
  // Partie à trois : les militants d’une IA ne s’en prennent pas à l’autre camp qui contient le meneur.
  // (La trêve ne concerne que deux camps joués par l’ordinateur : inutile de la calculer face au joueur.)
  const bot = faction => FACTIONS.includes(faction) && !sim.state.candidates.some(c => c.faction_id === faction && isHumanCandidate(sim.state, c.id));
  const keep = target && target.faction_id !== npc.faction_id && bot(target.faction_id) && bot(npc.faction_id) ? truceFilter(sim.state, sim.config, npc.faction_id) : null;
  if (keep && !keep(target)) target = nearestEnemy(sim.state, npc, s.detection_range, t => t.role !== 'SYMPATHISANT' && keep(t));
  npc.combat.target_id = target?.id || null;
  if (!target) return false;
  npc.combat.engaged = true;
  if (interrupted(npc)) return true;
  const d = combatDelta(sim.state, npc.x, target.x);
  npc.facing = Math.sign(d) || npc.facing;
  if (Math.abs(d) > s.verbal_range) moveNpcTowards(sim, npc, target.x, s.move_speed);
  else {
    if (Math.abs(d) < s.preferred_distance && !npc.combat.attack_id) moveNpcTowards(sim, npc, combatPosition(sim.state, npc.x - npc.facing * s.preferred_distance), s.move_speed);
    npc.facing = Math.sign(d) || npc.facing;
    startNpcAttack(sim, npc, 'VERBAL', { range: s.verbal_range, damage: s.verbal_damage, knockback: s.verbal_knockback,
      electoral_damage: s.verbal_attack_electoral_damage, cooldown_seconds: s.verbal_cooldown_seconds });
  }
  return true;
}

export function updateCombat(sim) {
  for (const c of [...sim.state.candidates].sort(stableIdOrder)) startCandidateAttack(sim, c);
  updateTemporaryUnits(sim);
  updateAttacks(sim);
  updateProjectiles(sim);
  updateMinorUltimates(sim);
  updateStyleEffects(sim);
  const expiredIds = new Set(sim.state.temporary_units.filter(t => t.expired).map(t => t.id));
  sim.state.projectiles = sim.state.projectiles.filter(p => !expiredIds.has(p.owner_id));
  sim.state.temporary_units = sim.state.temporary_units.filter(t => !t.expired);
  sim.state.attacks = sim.state.attacks.filter(a => findCombatActor(sim.state, a.owner_id)?.combat.attack_id === a.id);
}
