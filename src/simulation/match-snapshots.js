import { FACTIONS } from './world.js';
import { GamePhase } from './phases.js';
import { validateCombatSnapshot } from './combat-snapshots.js';

export function validateMatchSnapshot(s, sim, fail, validateWorld, nested) {
  const integer = n => Number.isInteger(n) && n >= 0;
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const support = x => x && [...FACTIONS, 'neutral'].every(f => Number.isFinite(x[f]) && x[f] >= 0 && x[f] <= 100)
    && Math.abs(Object.values(x).reduce((a, b) => a + b, 0) - 100) < 1e-7;
  if (!integer(s.match_tick) || !integer(s.phase_started_match_tick) || s.phase_started_match_tick > s.match_tick
    || !integer(s.sprint_elapsed_ticks) || !integer(s.extensions) || !Array.isArray(s.finalists)) fail('horloge de partie invalide');
  const t = s.telemetry;
  if (!t || !integer(t.arena_hits) || !integer(t.arena_candidate_hits) || t.arena_candidate_hits > t.arena_hits || !integer(t.sprint_meetings)
    || !Number.isFinite(t.arena_duration_seconds) || t.arena_duration_seconds < 0
    || !Array.isArray(t.changed_subzone_ids) || new Set(t.changed_subzone_ids).size !== t.changed_subzone_ids.length || t.changed_subzone_ids.some(id => !s.world.subzones.some(z => z.id === id))
    || !Array.isArray(t.reconverted_npc_ids) || new Set(t.reconverted_npc_ids).size !== t.reconverted_npc_ids.length || t.reconverted_npc_ids.some(id => !s.npcs.some(n => n.id === id && n.former_eliminated_faction))) fail('télémétrie invalide');
  for (const c of s.candidates) if (typeof c.eliminated !== 'boolean' || c.eliminated !== (c.faction_id === s.eliminated_faction)
    || c.eliminated && (c.campaign_active || c.interaction_active || c.axis || c.purchase_hold || c.combat.attack_id)) fail('candidat éliminé incohérent');
  for (const n of s.npcs) if (n.former_eliminated_faction !== undefined && (!s.eliminated_faction || n.former_eliminated_faction !== s.eliminated_faction)) fail('ancienne affiliation incohérente');
  const late = [GamePhase.SECOND_ROUND_SPRINT, GamePhase.RESULTS].includes(s.phase);
  if (late) {
    if (!FACTIONS.includes(s.eliminated_faction) || !same(s.finalists, FACTIONS.filter(f => f !== s.eliminated_faction)) || !integer(s.sprint_remaining_ticks)
      || s.days_remaining !== 0 || s.arena !== null || s.campaign_snapshot !== null || !support(t.j0_scores) || !support(t.sprint_start_scores)
      || t.eliminated_faction !== s.eliminated_faction) fail('second tour incohérent');
    if (s.npcs.some(n => n.faction_id === s.eliminated_faction) || s.buildings.some(b => b.owner_id === s.eliminated_faction || b.queue.some(o => o.faction_id === s.eliminated_faction))
      || [...s.attacks, ...s.projectiles, ...s.powers, ...s.temporary_units].some(a => a.faction_id === s.eliminated_faction)
      || s.electorate.some(e => e.support[s.eliminated_faction] !== 0 || e.influence_per_second[s.eliminated_faction] !== 0)) fail('camp éliminé encore actif');
  } else if (s.eliminated_faction !== null || s.finalists.length || s.sprint_remaining_ticks !== null || s.sprint_elapsed_ticks || s.extensions) fail('élimination prématurée');
  if (s.phase === GamePhase.FIRST_ROUND_ARENA) {
    if (nested || !s.campaign_snapshot || s.campaign_snapshot.phase !== GamePhase.CAMPAIGN || s.days_remaining !== 0 || !support(t.j0_scores)) fail('monde gelé absent');
    validateWorld(s.campaign_snapshot, sim, true);
    for (const key of ['tick', 'rng_state', 'candidates', 'npcs', 'buildings', 'electorate', 'polls', 'actualGameState', 'spawn_timers', 'attacks', 'projectiles', 'powers', 'temporary_units', 'hit_results', 'transactions', 'next_npc_id', 'next_order_id', 'next_transaction_id', 'next_attack_id', 'next_projectile_id', 'next_power_id', 'next_temporary_id', 'next_hit_id', 'next_raid_id']) if (!same(s[key], s.campaign_snapshot[key])) fail(`monde évolué pendant l’arène : ${key}`);
    if (!same(t.j0_scores, s.campaign_snapshot.actualGameState.national_support)) fail('scores à J0 incohérents');
    const a = s.arena; const cfg = sim.config.balance.first_round_arena;
    if (!a || !integer(a.tick) || !integer(a.hit_count) || !integer(a.candidate_hit_count) || !integer(a.rng_state) || a.rng_state < 1 || a.rng_state > 0xffffffff
      || !same(a.world, s.world) || !same(a.arena_bounds, { min: cfg.edge_margin, max: cfg.width_units - cfg.edge_margin })
      || !Array.isArray(a.candidates) || a.candidates.length !== 3 || a.npcs?.length !== 0 || a.buildings?.length !== 0
      || a.eliminated_faction !== null && !FACTIONS.includes(a.eliminated_faction)) fail('arène invalide');
    const ids = new Set();
    for (const c of a.candidates) {
      if (ids.has(c.id) || c.id !== `candidate:${c.faction_id}` || !FACTIONS.includes(c.faction_id) || c.role !== 'CANDIDAT' || c.eliminated
        || !Number.isFinite(c.x) || c.x < a.arena_bounds.min || c.x > a.arena_bounds.max || ![-1, 0, 1].includes(c.axis) || ![-1, 1].includes(c.facing)
        || typeof c.campaign_active !== 'boolean' || typeof c.moving !== 'boolean' || !Number.isFinite(c.special_charge) || c.special_charge < 0
        || !Number.isFinite(c.arena_hp) || c.arena_hp < 0 || c.arena_hp > c.arena_initial_hp
        || c.arena_initial_hp !== t.j0_scores[c.faction_id]) fail('jauge ou candidat d’arène invalide');
      ids.add(c.id);
    }
    const zero = a.candidates.filter(c => c.arena_hp === 0);
    if (a.eliminated_faction ? !zero.some(c => c.faction_id === a.eliminated_faction) : zero.length) fail('KO d’arène incohérent');
    for (const key of ['next_attack_id', 'next_projectile_id', 'next_temporary_id', 'next_power_id', 'next_hit_id', 'next_event_id', 'next_raid_id']) if (!integer(a[key]) || a[key] < 1) fail('compteur d’arène invalide');
    for (const key of ['attacks', 'projectiles', 'temporary_units', 'powers', 'hit_results', 'events']) if (!Array.isArray(a[key])) fail('collection d’arène absente');
    for (const entity of [...a.attacks, ...a.projectiles, ...a.temporary_units, ...a.powers]) { if (ids.has(entity.id)) fail('ID d’arène dupliqué'); ids.add(entity.id); }
    validateCombatSnapshot(a, sim, fail);
    if (a.temporary_units.some(c => c.x < a.arena_bounds.min || c.x > a.arena_bounds.max)) fail('temporaire hors plateau');
  } else if (s.arena !== null || s.campaign_snapshot !== null) fail('arène hors phase');
  if (s.phase === GamePhase.RESULTS) {
    const r = s.result;
    if (!r || !s.finalists.includes(r.winner) || !s.finalists.includes(r.second) || r.winner === r.second || s.sprint_remaining_ticks !== 0
      || !same(r.scores, s.actualGameState.national_support) || !same(t.final_scores, r.scores) || t.winner !== r.winner || !integer(r.decided_tick) || r.decided_tick !== s.tick
      || r.scores[r.winner] + 1e-10 < r.scores[r.second]) fail('résultat invalide');
  } else if (s.result !== null) fail('résultat prématuré');
}
