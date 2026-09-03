import { FACTIONS, buildWorld, fingerprint } from './world.js';
import { createInfrastructure } from './economy.js';
import { buildingSettings, factionVariant } from './building-rules.js';
import { validateCombatSnapshot } from './combat-snapshots.js';

/** Validate the entire snapshot before committing anything to the running simulation. */
export function validateSnapshot(next, simulation) {
  const { config } = simulation;
  const fail = detail => { throw new Error(`État JSON incompatible : ${detail}.`); };
  const integer = (n, min = 0) => Number.isInteger(n) && n >= min;
  const finite = n => Number.isFinite(n) && n >= 0;
  if (!next || next.snapshot_version !== 3 || next.config_fingerprint !== fingerprint(config)) fail('version ou réglages différents ; utilise une sauvegarde du troisième jalon');
  if (JSON.stringify(next.world) !== JSON.stringify(buildWorld(config))) fail('monde différent');
  if (!integer(next.tick) || !integer(next.seed, 1) || !integer(next.rng_state, 1) || next.rng_state > 0xffffffff) fail('horloge ou graine invalide');
  for (const field of ['next_npc_id', 'next_event_id', 'next_order_id', 'next_transaction_id', 'next_attack_id', 'next_projectile_id', 'next_power_id', 'next_temporary_id', 'next_hit_id', 'next_raid_id']) if (!integer(next[field], 1)) fail('compteur invalide');
  for (const field of ['candidates', 'npcs', 'events', 'buildings', 'building_slots', 'transactions', 'electorate', 'spawn_timers', 'attacks', 'projectiles', 'powers', 'temporary_units', 'hit_results']) if (!Array.isArray(next[field])) fail(`collection absente : ${field}`);
  if (next.candidates.length !== FACTIONS.length || next.phase !== 'EXPLORATION_GREYBOX' || typeof next.ai_enabled !== 'boolean') fail('phase ou contrôleurs invalides');
  if (!integer(next.days_remaining, config.prototype.time.minimum_days_remaining_for_milestone) || next.days_remaining > config.balance.time.starting_days_before_first_round) fail('jour invalide');
  const infrastructure = createInfrastructure(next.world, config);
  if (JSON.stringify(next.building_slots) !== JSON.stringify(infrastructure.slots) || next.buildings.length !== infrastructure.buildings.length) fail('emplacements différents');
  const ids = new Set();
  for (const entity of [...next.world.subzones, ...next.world.socialPoints, ...next.world.scenery, ...next.building_slots, ...next.buildings, ...next.candidates, ...next.npcs, ...next.temporary_units, ...next.attacks, ...next.projectiles, ...next.powers]) {
    if (typeof entity.id !== 'string' || ids.has(entity.id)) fail('ID absent ou dupliqué');
    ids.add(entity.id);
  }
  const candidateIds = new Set(FACTIONS.map(f => `candidate:${f}`));
  const actorIds = new Set([...candidateIds, ...next.npcs.filter(n => n.role === 'MILITANT').map(n => n.id)]);
  const validPosition = x => Number.isFinite(x) && x >= 0 && x < next.world.length;
  if (!candidateIds.has(next.local_candidate_id)) fail('contrôle local inconnu');
  for (const candidate of next.candidates) {
    if (!candidateIds.has(candidate.id) || candidate.id !== `candidate:${candidate.faction_id}` || candidate.role !== 'CANDIDAT') fail('candidat inconnu');
    if (!validPosition(candidate.x) || ![-1, 0, 1].includes(candidate.axis) || ![-1, 1].includes(candidate.facing) || typeof candidate.moving !== 'boolean'
      || typeof candidate.campaign_active !== 'boolean' || typeof candidate.interaction_active !== 'boolean') fail('candidat invalide');
    for (const field of ['money', 'total_spent', 'total_earned', 'income_per_second', 'special_charge', 'electoral_damage_received', 'hits_received', 'refunds_received']) if (!finite(candidate[field])) fail('économie du candidat invalide');
    if (!candidate.spending || ['BUILD', 'UPGRADE', 'PRINT'].some(k => !finite(candidate.spending[k]))) fail('dépenses invalides');
    if (candidate.purchase_latch_target_id !== null && !next.buildings.some(b => b.id === candidate.purchase_latch_target_id)) fail('interaction inconnue');
    const hold = candidate.purchase_hold;
    if (hold && (!next.buildings.some(b => b.id === hold.target_id) || !['BUILD', 'UPGRADE', 'PRINT', 'REBUILD', 'EQUIP', 'RAID', 'CLOSE'].includes(hold.kind) || !finite(hold.cost)
      || !integer(hold.required_ticks, 1) || !integer(hold.elapsed_ticks) || hold.elapsed_ticks >= hold.required_ticks || typeof hold.key !== 'string')) fail('paiement invalide');
  }
  for (const actor of [...next.candidates, ...next.npcs]) {
    if (!Array.isArray(actor.persuasion_target_ids) || actor.persuasion_target_ids.length > config.balance.persuasion.max_simultaneous_targets_per_actor
      || actor.persuasion_target_ids.some(id => !next.npcs.some(n => n.id === id && n.role === 'NEUTRE' && n.persuasion?.actor_id === actor.id))) fail('conversation incohérente');
  }
  if (next.spawn_timers.length !== next.world.socialPoints.length) fail('timers absents');
  const timerPoints = new Set();
  for (const timer of next.spawn_timers) {
    const point = next.world.socialPoints.find(p => p.id === timer.social_point_id);
    const zone = next.world.subzones.find(z => z.id === timer.subzone_id);
    if (!point || !zone || point.subzone_id !== timer.subzone_id || timerPoints.has(point.id)) fail('point de spawn invalide');
    timerPoints.add(point.id);
    const mean = zone.mean_spawn_days * config.balance.time.real_seconds_per_game_day;
    if (!integer(timer.elapsed_ticks) || !integer(timer.interval_ticks, 1) || timer.elapsed_ticks >= timer.interval_ticks || !integer(timer.skipped_count)
      || timer.interval_ticks < simulation.secondsToTicks(mean * zone.spawn_randomness.min_factor)
      || timer.interval_ticks > simulation.secondsToTicks(mean * zone.spawn_randomness.max_factor)) fail('timer de spawn invalide');
  }
  const orderIds = new Set();
  const assigned = new Set();
  for (const building of next.buildings) {
    const expected = infrastructure.buildings.find(b => b.id === building.id);
    if (!expected) fail('bâtiment inconnu');
    for (const field of ['type', 'slot_id', 'x', 'subzone_id', 'biome_id', 'ownership_model']) if (building[field] !== expected[field]) fail('bâtiment déplacé ou altéré');
    if (!Array.isArray(building.queue) || !integer(building.delivered_count) || !Number.isInteger(building.last_action_tick) || building.last_action_tick > next.tick) fail('état du bâtiment invalide');
    if (building.type !== 'imprimerie') {
      const settings = buildingSettings(config, building);
      if (!integer(building.level) || building.level > settings.max_level) fail('niveau invalide');
      if (building.state === 'EMPTY' ? building.level !== 0 || building.owner_id !== null
        : !FACTIONS.includes(building.owner_id) || (building.state === 'CLOSED' ? building.level !== 0 : building.state !== 'ACTIVE' || building.level < 1)) fail('propriété invalide');
      if (!integer(building.raid_ready_tick) || !integer(building.closure_ready_tick)) fail('délai de bâtiment invalide');
      if (building.type === 'faction' && building.variant !== (building.owner_id ? factionVariant(building.owner_id) : null)) fail('bâtiment factionnel invalide');
      if (building.variant !== 'service_ordre' || building.state !== 'ACTIVE') { if (building.queue.length) fail('file sur bâtiment inactif'); continue; }
      if (building.queue.length > settings.max_queue_length) fail('file d’équipement pleine');
    }
    if (building.type === 'imprimerie' && (building.owner_id !== null || building.level !== 1 || building.state !== 'ACTIVE' || building.queue.length > config.balance.buildings.imprimerie.max_queue_length)) fail('service neutre invalide');
    let unfinishedFound = false;
    for (const order of building.queue) {
      if (!/^order:\d+$/.test(order.id) || Number(order.id.slice(6)) >= next.next_order_id || orderIds.has(order.id) || order.service_id !== building.id) fail('ordre de production invalide');
      orderIds.add(order.id);
      const equipment = building.variant === 'service_ordre';
      const duration = equipment ? order.production_required_ticks : simulation.secondsToTicks(config.balance.buildings.imprimerie.equipment_seconds_by_level[0]);
      if (equipment && (!buildingSettings(config, building).equipment_seconds_by_level.map(s => simulation.secondsToTicks(s)).includes(duration) || order.faction_id !== building.owner_id)) fail('équipement invalide');
      if (!FACTIONS.includes(order.faction_id) || !finite(order.cost) || !integer(order.purchased_tick) || order.purchased_tick > next.tick || !integer(order.production_elapsed_ticks)) fail('commande d’impression invalide');
      if (order.state === 'READY') { if (order.production_elapsed_ticks !== duration || unfinishedFound) fail('production incohérente'); }
      else if (order.state === 'PRINTING') {
        if (unfinishedFound || order.production_elapsed_ticks < 1 || order.production_elapsed_ticks >= duration) fail('production simultanée invalide');
        unfinishedFound = true;
      } else if (order.state === 'QUEUED') { if (order.production_elapsed_ticks !== 0) fail('file invalide'); unfinishedFound = true; }
      else fail('état de production inconnu');
      if (order.assigned_npc_id !== null) {
        const npc = next.npcs.find(n => n.id === order.assigned_npc_id);
        if (!npc || npc.role !== (equipment ? 'MILITANT' : 'SYMPATHISANT') || npc.faction_id !== order.faction_id || npc.task?.order_id !== order.id || assigned.has(npc.id)) fail('affectation incohérente');
        assigned.add(npc.id);
      }
    }
  }
  for (const npc of next.npcs) {
    if (!/^npc:\d+$/.test(npc.id) || Number(npc.id.slice(4)) >= next.next_npc_id) fail('compteur PNJ invalide');
    const origin = next.world.socialPoints.find(p => p.id === npc.origin_social_point_id);
    if (!origin || origin.biome_id !== npc.origin_biome_id || origin.subzone_id !== npc.origin_subzone_id) fail('origine PNJ invalide');
    if (!validPosition(npc.x) || !validPosition(npc.roam_target_x) || ![-1, 1].includes(npc.facing) || !integer(npc.roam_wait_ticks) || typeof npc.moving !== 'boolean') fail('déplacement PNJ invalide');
    if (!['NEUTRE', 'SYMPATHISANT', 'MILITANT', 'SERVICE_D_ORDRE', 'DEMOBILISE'].includes(npc.role)) fail('rôle PNJ inconnu');
    if (['SYMPATHISANT', 'MILITANT', 'SERVICE_D_ORDRE'].includes(npc.role) ? !FACTIONS.includes(npc.faction_id) : npc.faction_id !== null) fail('faction PNJ invalide');
    if (npc.role === 'SERVICE_D_ORDRE' && (npc.faction_id === 'philippe' || !config.layout.biomes.some(b => b.id === npc.guard_biome_id) || !validPosition(npc.guard_anchor_x))) fail('Service d’ordre invalide');
    if (!finite(npc.hidden_durability) || !Number.isInteger(npc.converted_tick) || npc.converted_tick > next.tick || !Number.isInteger(npc.promoted_tick) || npc.promoted_tick > next.tick) fail('état PNJ invalide');
    const p = npc.persuasion;
    if (p && (npc.role !== 'NEUTRE' || !actorIds.has(p.actor_id) || !integer(p.elapsed_ticks) || !integer(p.required_ticks, 1) || p.required_ticks <= p.elapsed_ticks)) fail('persuasion invalide');
    const task = npc.task;
    if (!task) continue;
    if (!validPosition(task.destination_x) || !next.world.subzones.some(z => z.id === task.destination_subzone_id)) fail('destination invalide');
    if (['COLLECT_TRACT', 'COLLECT_EQUIPMENT'].includes(task.kind)) {
      if (npc.role !== (task.kind === 'COLLECT_TRACT' ? 'SYMPATHISANT' : 'MILITANT') || !assigned.has(npc.id) || !orderIds.has(task.order_id) || task.target_id !== task.service_id
        || !next.buildings.some(b => b.id === task.service_id && b.queue.some(o => o.id === task.order_id && o.assigned_npc_id === npc.id))
        || !['TRAVEL', 'WAIT_PRINT', 'PICKUP'].includes(task.phase) || !integer(task.elapsed_ticks)) fail('tâche de collecte invalide');
    } else if (task.kind === 'EXPAND') {
      if (npc.role !== 'MILITANT' || !integer(task.next_decision_tick) || !['TRAVEL', 'WAIT', 'RECRUIT'].includes(task.phase)
        || (task.target_id !== null && !next.npcs.some(n => n.id === task.target_id))) fail('tâche de Militant invalide');
    } else if (task.kind === 'GUARD') {
      if (npc.role !== 'SERVICE_D_ORDRE' || !['PATROL', 'DEFEND', 'RAID', 'RETURN'].includes(task.phase)) fail('garde invalide');
    } else fail('tâche inconnue');
  }
  if (next.electorate.length !== next.world.subzones.length) fail('électorat incomplet');
  next.electorate.forEach((record, index) => {
    if (record.subzone_id !== next.world.subzones[index].id || !record.support || !record.influence_per_second || !record.net_change_per_second) fail('électorat invalide');
    const values = [...FACTIONS, 'neutral'].map(f => record.support[f]);
    if (values.some(v => !finite(v) || v > 100) || Math.abs(values.reduce((a, b) => a + b, 0) - 100) > 1e-7) fail('scores non normalisés');
    if (FACTIONS.some(f => !finite(record.influence_per_second[f]) || !Number.isFinite(record.net_change_per_second[f]))) fail('influence invalide');
  });
  validateCombatSnapshot(next, simulation, fail);
  return next;
}
