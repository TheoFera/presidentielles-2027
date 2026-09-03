import { GamePhase } from './phases.js';
import { ArenaSimulation } from './arena-simulation.js';
import { FACTIONS } from './world.js';
import { combatState, demobilizeUnit, combatActors } from './combat-state.js';
import { createInfrastructure } from './economy.js';
import { refreshElectoralState, updatePolls } from './electoral-state.js';
import { refreshInfluenceSources } from './territory.js';

const clone = value => JSON.parse(JSON.stringify(value));
export const initialMatchState = () => ({
  match_tick: 0, phase_started_match_tick: 0, arena: null, campaign_snapshot: null,
  eliminated_faction: null, finalists: [], sprint_remaining_ticks: null, sprint_elapsed_ticks: 0, extensions: 0, result: null,
  telemetry: { j0_scores: null, eliminated_faction: null, arena_duration_seconds: 0, arena_hits: 0, arena_candidate_hits: 0,
    sprint_start_scores: null, final_scores: null, changed_subzone_ids: [], reconverted_npc_ids: [], sprint_meetings: 0, winner: null },
});

export function startArena(sim) {
  const s = sim.state;
  if (s.phase !== GamePhase.CAMPAIGN) return false;
  s.days_remaining = 0;
  refreshElectoralState(s, sim.config);
  s.telemetry.j0_scores = clone(s.actualGameState.national_support);
  const saved = clone(s); // Full, non-recursive, JSON-compatible world snapshot.
  s.arena = ArenaSimulation.create(sim.config, s);
  s.campaign_snapshot = saved;
  s.phase = GamePhase.FIRST_ROUND_ARENA; s.phase_started_match_tick = s.match_tick;
  sim.emit('ArenaStarted', { scores: clone(s.telemetry.j0_scores) });
  return true;
}

export function finishArena(sim, eliminated) {
  const old = sim.state;
  if (old.phase !== GamePhase.FIRST_ROUND_ARENA || !FACTIONS.includes(eliminated)) return false;
  const telemetry = clone(old.telemetry);
  telemetry.eliminated_faction = eliminated;
  telemetry.arena_duration_seconds = old.arena.tick / sim.hz;
  telemetry.arena_hits = old.arena.hit_count; telemetry.arena_candidate_hits = old.arena.candidate_hit_count;
  // Restore before neutralising: no arena money, positions, charge or cooldown leaks into the world.
  sim.state = clone(old.campaign_snapshot);
  const s = sim.state;
  s.match_tick = old.match_tick; s.local_candidate_id = old.local_candidate_id; s.ai_enabled = old.ai_enabled;
  s.telemetry = telemetry; s.phase = GamePhase.SECOND_ROUND_SPRINT; s.phase_started_match_tick = s.match_tick;
  s.eliminated_faction = eliminated; s.finalists = FACTIONS.filter(f => f !== eliminated);
  s.sprint_remaining_ticks = sim.secondsToTicks(sim.config.balance.time.second_round_sprint_seconds);
  for (const c of s.candidates) if (c.faction_id === eliminated) {
    c.eliminated = true; c.axis = 0; c.moving = false; c.campaign_active = false; c.interaction_active = false;
    c.combat = combatState(); c.purchase_hold = null; c.purchase_latch_target_id = null; c.persuasion_target_ids = []; c.income_per_second = 0;
  }
  for (const npc of s.npcs) if (npc.faction_id === eliminated) {
    npc.former_eliminated_faction = eliminated;
    demobilizeUnit(sim, npc); npc.combat.knockback_velocity = 0;
    npc.guard_biome_id = null; npc.guard_anchor_x = null;
  }
  for (const npc of s.npcs) if (npc.persuasion?.actor_id === `candidate:${eliminated}`) npc.persuasion = null;
  const fresh = createInfrastructure(s.world, sim.config).buildings;
  s.buildings = s.buildings.map(b => b.owner_id === eliminated ? { ...fresh.find(f => f.id === b.id), abandoned_by: eliminated } : b);
  for (const b of s.buildings) {
    // Shared neutral services retain their identity, availability and other factions' orders.
    b.queue = b.queue.filter(o => o.faction_id !== eliminated);
    if (b.type === 'meeting' && b.state === 'ACTIVE') b.meeting_ready_tick = Math.max(b.meeting_until_tick, Math.min(b.meeting_ready_tick, s.tick + sim.secondsToTicks(sim.config.balance.second_round.meeting_cooldown_seconds)));
  }
  s.temporary_units = s.temporary_units.filter(t => t.faction_id !== eliminated);
  s.powers = s.powers.filter(p => p.faction_id !== eliminated);
  const actors = combatActors(s);
  s.attacks = s.attacks.filter(a => a.faction_id !== eliminated && actors.some(t => t.id === a.owner_id));
  s.projectiles = s.projectiles.filter(p => p.faction_id !== eliminated && actors.some(t => t.id === p.owner_id));
  for (const c of s.candidates) {
    if (c.purchase_hold && s.buildings.find(b => b.id === c.purchase_hold.target_id)?.abandoned_by === eliminated) c.purchase_hold = null;
  }
  for (const e of s.electorate) { e.support.neutral += e.support[eliminated]; e.support[eliminated] = 0; e.net_change_per_second[eliminated] = 0; }
  s.polls[eliminated] = { active: false, next_poll_tick: null, lastPollSnapshot: null };
  for (const f of s.finalists) if (s.polls[f].active) s.polls[f].next_poll_tick = Math.min(s.polls[f].next_poll_tick, s.tick + sim.secondsToTicks(sim.config.balance.second_round.poll_refresh_seconds));
  refreshElectoralState(s, sim.config); refreshInfluenceSources(s, sim.config); updatePolls(sim);
  s.telemetry.sprint_start_scores = clone(s.actualGameState.national_support);
  sim.emit('SprintStarted', { eliminated_faction: eliminated, finalists: [...s.finalists] });
  return true;
}

export function finishSprint(sim) {
  const s = sim.state;
  refreshElectoralState(s, sim.config);
  const scores = s.actualGameState.national_support;
  const [a, b] = s.finalists;
  // Equality at floating-point precision only, never equality of the displayed rounded poll.
  const tied = Math.abs(scores[a] - scores[b]) <= 1e-10;
  if (tied && sim.config.balance.second_round.tie_rule === 'REPEAT_OVERTIME') {
    s.extensions++; s.sprint_remaining_ticks = sim.secondsToTicks(sim.config.balance.second_round.extension_seconds);
    s.phase_started_match_tick = s.match_tick;
    sim.emit('OvertimeStarted', { seconds: sim.config.balance.second_round.extension_seconds, extension: s.extensions });
    return;
  }
  // Optional deterministic tie break: J0 score, then seeded order for an exact second tie.
  const tieWinner = s.telemetry.j0_scores[a] === s.telemetry.j0_scores[b] ? s.finalists[s.seed % 2]
    : s.telemetry.j0_scores[a] > s.telemetry.j0_scores[b] ? a : b;
  const winner = tied ? tieWinner : scores[a] > scores[b] ? a : b;
  const second = winner === a ? b : a;
  s.result = { winner, second, scores: clone(scores), decided_tick: s.tick, tie_break: tied, extensions: s.extensions };
  s.telemetry.final_scores = clone(scores); s.telemetry.winner = winner;
  s.phase = GamePhase.RESULTS; s.phase_started_match_tick = s.match_tick;
  sim.emit('MatchFinished', { winner, second, scores: clone(scores) });
}

export function applyMatchDebug(sim, command) {
  const s = sim.state;
  if (['DebugForceJ0', 'DebugStartArena'].includes(command.type)) { startArena(sim); return true; }
  if (['DebugFinishArena', 'DebugStartSprint'].includes(command.type)) {
    if (!FACTIONS.includes(command.factionId)) return true;
    if (s.phase === GamePhase.CAMPAIGN) startArena(sim);
    finishArena(sim, command.factionId); return true;
  }
  if (command.type === 'DebugSprint10') { s.sprint_remaining_ticks = sim.secondsToTicks(10); return true; }
  if (command.type === 'DebugForceTie') {
    const [a, b] = s.finalists;
    for (const e of s.electorate) e.support[a] = e.support[b] = (e.support[a] + e.support[b]) / 2;
    refreshElectoralState(s, sim.config); s.sprint_remaining_ticks = 0; finishSprint(sim); return true;
  }
  if (command.type === 'DebugNeutral50All') {
    const camps = s.finalists.length ? s.finalists : FACTIONS;
    for (const e of s.electorate) {
      const sum = camps.reduce((sum, f) => sum + e.support[f], 0);
      for (const f of camps) e.support[f] = sum ? e.support[f] * 50 / sum : 50 / camps.length;
      e.support.neutral = 50;
    }
    refreshElectoralState(s, sim.config); refreshInfluenceSources(s, sim.config); return true;
  }
  return false;
}
