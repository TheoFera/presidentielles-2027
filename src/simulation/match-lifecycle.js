import { clearCampaignUltimate } from './campaign-styles.js';
import { resolveCampaignEvent } from './campaign-events.js';
import { GamePhase } from './phases.js';
import { completePopulation } from './spawns.js';
import { ArenaSimulation } from './arena-simulation.js';
import { FACTIONS } from './world.js';
import { combatState, demobilizeUnit, combatActors } from './combat-state.js';
import { neutralizeSite } from './strategic-sites.js';
import { refreshElectoralState, updatePolls } from './electoral-state.js';
import { convertNeutral, neutralizeSupporter } from './npc-votes.js';

const clone = value => JSON.parse(JSON.stringify(value));
export const initialMatchState = () => ({
  match_tick: 0, phase_started_match_tick: 0, arena: null, campaign_snapshot: null,
  eliminated_faction: null, finalists: [], sprint_remaining_ticks: null, sprint_elapsed_ticks: 0, extensions: 0, result: null,
  telemetry: { j0_scores: null, eliminated_faction: null, arena_duration_seconds: 0, arena_hits: 0, arena_candidate_hits: 0,
    sprint_start_scores: null, final_scores: null, changed_subzone_ids: [], reconverted_npc_ids: [], sprint_meetings: 0, winner: null },
});

export function startArena(sim) {
  for (const e of sim.state.campaign_events || []) if (e.status === 'ACTIVE') resolveCampaignEvent(sim, e, 'EXPIRED');
  const s = sim.state;
  if (s.phase !== GamePhase.CAMPAIGN) return false;
  completePopulation(sim);
  s.days_remaining = 0; s.campaign_day_remaining = 0; s.campaign_elapsed_days = sim.config.balance.time.starting_days_before_first_round; s.campaign_progress_01 = 1;
  refreshElectoralState(s);
  s.telemetry.j0_scores = clone(s.actualGameState.national_support);
  for (const c of s.candidates) {
    const charge = c.special_charge; clearCampaignUltimate(sim, c); c.special_charge = charge; c.bardella_form = false;
  }
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
  for (const c of s.candidates) {
    const arenaCandidate = old.arena.candidates.find(a => a.id === c.id);
    clearCampaignUltimate(sim, c); c.bardella_form = false;
    c.bardellisation_used ||= !!arenaCandidate?.bardellisation_used;
  }
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
  for (const b of s.buildings.filter(b => b.owner_id === eliminated && !b.headquarters)) neutralizeSite(sim, b, 'CANDIDATE_ELIMINATED');
  for (const b of s.buildings.filter(b => b.owner_id === eliminated)) neutralizeSite(sim, b, 'CANDIDATE_ELIMINATED');
  for (const b of s.buildings) {
    // Shared neutral services retain their identity, availability and other factions' orders.
    b.queue = b.queue.filter(o => o.faction_id !== eliminated);
    if (b.type === 'meeting' && b.state === 'ACTIVE') b.meeting_until_tick = Math.max(b.meeting_until_tick, s.tick);
  }
  s.temporary_units = s.temporary_units.filter(t => t.faction_id !== eliminated);
  s.powers = s.powers.filter(p => p.faction_id !== eliminated);
  const actors = combatActors(s);
  s.attacks = s.attacks.filter(a => a.faction_id !== eliminated && actors.some(t => t.id === a.owner_id));
  s.projectiles = s.projectiles.filter(p => p.faction_id !== eliminated && actors.some(t => t.id === p.owner_id));
  for (const c of s.candidates) {
    if (c.purchase_hold && s.buildings.find(b => b.id === c.purchase_hold.target_id)?.abandoned_by === eliminated) c.purchase_hold = null;
  }
  s.polls[eliminated] = { active: false, next_poll_tick: null, lastPollSnapshot: null };
  for (const f of s.finalists) if (s.polls[f].active) s.polls[f].next_poll_tick = Math.min(s.polls[f].next_poll_tick, s.tick + sim.secondsToTicks(sim.config.balance.second_round.poll_refresh_seconds));
  refreshElectoralState(s); updatePolls(sim);
  s.telemetry.sprint_start_scores = clone(s.actualGameState.national_support);
  sim.emit('SprintStarted', { eliminated_faction: eliminated, finalists: [...s.finalists] });
  return true;
}

export function finishSprint(sim) {
  const s = sim.state;
  refreshElectoralState(s);
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
  for (const c of s.candidates) clearCampaignUltimate(sim, c);
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
    refreshElectoralState(s);
    let difference = s.actualGameState.national_counts[a] - s.actualGameState.national_counts[b];
    const donor = difference > 0 ? a : b;
    while (difference !== 0) {
      const npc = s.npcs.find(n => n.role === 'SYMPATHISANT' && n.faction_id === donor);
      if (!npc) break;
      neutralizeSupporter(sim, npc, 'DÉBOGAGE');
      difference += difference > 0 ? -1 : 1;
    }
    refreshElectoralState(s); s.sprint_remaining_ticks = 0; finishSprint(sim); return true;
  }
  if (command.type === 'DebugNeutral50All') {
    for (const npc of s.npcs.filter(n => n.role === 'SYMPATHISANT')) if (Number(n.id.slice(4)) % 2 === 0) neutralizeSupporter(sim, npc, 'DÉBOGAGE');
    refreshElectoralState(s); return true;
  }
  return false;
}
