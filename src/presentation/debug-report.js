import { buildingOffer } from '../simulation/economy.js';
import { FACTIONS, zoneAt } from '../simulation/world.js';
import { incomeBreakdown, localUnits, populationByOrigin, waitingAtPoint } from '../simulation/territory.js';
import { remainingCampaignBudget } from '../simulation/campaign-budget.js';
import { buildingSettings, buildingLabel } from '../simulation/building-rules.js';
import { combatReport, transactionNames } from './combat-report.js';

export const roleNames = { NEUTRE: 'Neutre', SYMPATHISANT: 'Sympathisant', MILITANT: 'Militant', SERVICE_D_ORDRE: 'Service d’ordre', DEMOBILISE: 'Retour à l’origine' };
export const buildingNames = { permanence: 'Permanence', financement: 'Financement', imprimerie: 'Imprimerie', faction: 'Local SO / Cabinet', tour_communication: 'Tour de communication', institut_sondage: 'Institut de sondage', meeting: 'Meeting' };
export const reasonNames = { CAMPAIGN_BUDGET_EXCEEDED: 'Plafond de campagne insuffisant', GLOBAL_LIMIT: 'Limite de Tours actives atteinte', CANDIDATE_LIMIT: 'Limite par candidat atteinte', INSUFFICIENT_PRESENCE: 'Présence politique locale insuffisante', QUEUE_FULL: 'File pleine', SO_LIMIT: 'Cap de SO atteint pour ce Local', LEVEL_REQUIRED: 'Niveau 3 requis', CAMPAIGN_RUNNING: 'Campagne de financement en cours', ADMINISTRATIVE_BAN: 'Meeting temporairement interdit à ce candidat', NO_SYMPATHISANT: 'Aucun Sympathisant allié dans le biome', INSUFFICIENT_FUNDS: 'Fonds insuffisants', NO_MILITANT: 'Aucun Militant disponible dans le biome', NO_GUARD: 'Aucun SO disponible', COOLDOWN: 'Délai de réutilisation', NO_BUILDING: 'Aucune cible éligible' };

export function managementReport(state, config, candidate, npc, building) {
  const f = number => number.toLocaleString('fr-FR', { maximumFractionDigits: 3 });
  const hz = config.balance.simulation_architecture.fixed_tick_hz;
  const names = config.prototype.presentation.factions;
  const zone = zoneAt(state.world, candidate.x);
  const units = localUnits(state, zone.id);
  const election = state.electorate.find(e => e.subzone_id === zone.id);
  const lines = [
    '', '— SOUS-ZONE ACTUELLE —',
    `Neutres présents : ${units.filter(n => n.role === 'NEUTRE').length}`,
    `PNJ originaires de cette sous-zone : ${populationByOrigin(state, zone.id)} / ${zone.max_npcs_by_origin} (tous rôles et camps, même partis ailleurs)`,
    populationByOrigin(state, zone.id) >= zone.max_npcs_by_origin ? 'Plafond atteint : aucune nouvelle apparition.' : 'Apparitions actives jusqu’au plafond de population d’origine.',
    `Moyenne : ${f(zone.mean_spawn_days)} jour(s), soit ${f(zone.mean_spawn_days * config.balance.time.real_seconds_per_game_day)} s`,
    `Variation : ×${f(zone.spawn_randomness.min_factor)} à ×${f(zone.spawn_randomness.max_factor)}`,
    ...state.spawn_timers.filter(t => t.subzone_id === zone.id).map(timer => {
      const waiting = waitingAtPoint(state, timer.social_point_id);
      return `${timer.social_point_id}\n  Neutres issus de ce point : ${waiting} · prochaine tentative : ${f((timer.interval_ticks - timer.elapsed_ticks) / hz)} s\n  Délai tiré : ${f(timer.interval_ticks / hz)} s · tentatives sans place : ${timer.skipped_count}`;
    }),
    ...FACTIONS.map(faction => {
      const s = units.filter(n => n.faction_id === faction && n.role === 'SYMPATHISANT').length;
      const m = units.filter(n => n.faction_id === faction && n.role === 'MILITANT').length;
      const so = units.filter(n => n.faction_id === faction && n.role === 'SERVICE_D_ORDRE').length;
      return `${names[faction].name} : implantation ${s} S · ${m} M · ${so} SO\n  Influence : ${f(election.influence_per_second[faction])} point/s avant résistance\n  Soutien : ${f(election.support[faction])} % · variation nette ${f(election.net_change_per_second[faction])} point/s`;
    }),
    `Électorat abstrait neutre : ${f(election.support.neutral)} %`,
    'PNJ physiques et électorat abstrait sont distincts.',
  ];
  if (npc) {
    const task = npc.task;
    const phases = { TRAVEL: 'En déplacement', WAIT_PRINT: 'Attend la préparation', PICKUP: 'Récupère son équipement', WAIT: 'Attend dans le secteur', RECRUIT: 'Recrute par proximité', PATROL: 'Patrouille', DEFEND: 'Défend', RAID: 'Raid', RETURN: 'Retour au biome' };
    lines.push('', '— TÂCHE DU PNJ INSPECTÉ —', `Camp : ${npc.faction_id ? names[npc.faction_id].name : 'Aucun'}`,
      `Tâche : ${npc.role === 'DEMOBILISE' ? 'Retour au point d’origine' : task?.kind === 'COLLECT_EQUIPMENT' ? 'Chercher un équipement SO' : task?.kind === 'GUARD' ? 'Garde territoriale' : task?.kind === 'COLLECT_TRACT' ? 'Chercher un tract' : task?.kind === 'EXPAND' ? 'Étendre le réseau' : 'Vie locale'}`,
      `État : ${phases[task?.phase] || (npc.persuasion ? 'Écoute un recruteur' : npc.moving ? 'Marche' : 'Attend')}`,
      `Cible : ${task?.target_id || npc.persuasion?.actor_id || 'Aucune'}`,
      `Destination : ${task ? `${task.destination_subzone_id} · x=${f(task.destination_x)}` : npc.role === 'DEMOBILISE' ? npc.origin_social_point_id : `x=${f(npc.roam_target_x)}`}`);
    if (task?.order_id) {
      const service = state.buildings.find(b => b.id === task.service_id);
      lines.push(`Commande réservée : ${task.order_id} · retrait ${f(task.elapsed_ticks / hz)} / ${f(buildingSettings(config, service).pickup_seconds)} s`);
    }
  }
  if (building) {
    const settings = buildingSettings(config, building, candidate.faction_id);
    const offer = buildingOffer(state, config, candidate, building);
    const price = offer?.cost ?? (building.state === 'NEUTRAL' ? settings.capture_cost : null);
    lines.push('', '— BÂTIMENT INSPECTÉ —', `${buildingLabel(building, candidate.faction_id)} · ${building.id}`,
      `${building.subzone_id} · x=${f(building.x)}`,
      `Propriétaire : ${building.owner_id ? names[building.owner_id].name : building.ownership_model === 'neutral_service' ? 'Service neutre, jamais possédé' : 'Aucun'}`,
      `Niveau : ${building.level} · état : ${building.state === 'NEUTRAL' ? 'Neutre' : 'En activité'}${building.headquarters ? ' · QG' : ''}`,
      `Présence politique : ${building.current_political_presence} · seuil ${building.required_presence} · pression SO ${f(building.hostile_pressure)} · effective ${f(building.current_effective_presence)}`,
      `Fermeture : ${f(building.closure_progress * 100)} % · capture : ${f(building.capture_progress * 100)} %`,
      `Coût actuel : ${price === null ? 'Aucune dépense disponible' : `${f(price)} k €`}`,
      `Prochain niveau : ${building.level < settings.max_level ? building.level + 1 : 'aucun'} · verrou : ${offer?.reason ? reasonNames[offer.reason] : 'aucun'}`);
    if (building.type === 'financement') lines.push(`Financement : ${building.funding_state} · reste ${building.funding_end_tick ? f((building.funding_end_tick - state.tick) / hz) : 0} s · influence ×${f(building.funding_influence_factor || 0)} · hasard ×${f(building.funding_random_factor || 0)} · cagnotte ${f(building.funding_expected_payout)} k €`);
    if (building.type === 'institut_sondage') lines.push(`Dernier payeur : ${building.last_poll_candidate_id || 'aucun'} · âge : ${building.last_poll_tick === null ? 'aucun sondage' : `${f((state.tick - building.last_poll_tick) / hz)} s`}`);
    if (building.type === 'imprimerie' || building.variant === 'service_ordre') {
      lines.push(`File : ${building.queue.length}/${settings.max_queue_length} · équipements récupérés : ${building.delivered_count}`);
      const states = { QUEUED: 'En attente', PRINTING: 'Impression', READY: 'Prêt' };
      for (const order of building.queue) lines.push(`${order.id} · ${names[order.faction_id].name} · ${states[order.state]}\n  ${order.assigned_npc_id || 'Attend une unité disponible'} · production ${f(order.production_elapsed_ticks / hz)} / ${f(order.production_required_ticks ? order.production_required_ticks / hz : settings.equipment_seconds_by_level[0])} s`);
    }
  }
  const income = incomeBreakdown(state, config, candidate.faction_id);
  lines.push('', '— ÉCONOMIE DU CANDIDAT —', `Argent exact : ${f(candidate.money)} k €`,
    `Revenu passif total : ${f(income.total)} k €/s`,
    `Avant bonus : base ${f(income.base)} + partisans ${f(income.supporters)} + financements ${f(income.buildings)} k €/s`,
    `Multiplicateur du candidat : ×${f(income.multiplier)}`,
    'Partisans par biome d’origine (Sympathisants, Militants et Services d’ordre) :',
    ...config.layout.biomes.map(biome => {
      const source = income.byBiome[biome.id];
      return `  ${biome.display_name} : ${source.count} × ${f(source.rate)} = ${f(source.income)} k €/s avant bonus`;
    }),
    `Revenus cumulés : ${f(candidate.total_earned)} k € · dépenses cumulées : ${f(candidate.total_spent)} k €`,
    `Plafond de campagne : ${f(config.balance.money.campaign_spending_limit)} k € · reste dépensable : ${f(remainingCampaignBudget(candidate, config))} k €`,
    `Constructions : ${f(candidate.spending.BUILD)} · améliorations : ${f(candidate.spending.UPGRADE)} · tracts : ${f(candidate.spending.PRINT)} k €`,
    candidate.purchase_hold ? `Paiement : ${candidate.purchase_hold.target_id}\n  ${f(candidate.purchase_hold.elapsed_ticks / hz)} / ${f(candidate.purchase_hold.required_ticks / hz)} s · ${f(candidate.purchase_hold.cost)} k €` : 'Paiement : aucun',
    ...state.transactions.filter(t => t.candidate_id === candidate.id).slice(-5).map(t => `${t.id} · −${f(t.cost)} k € · ${transactionNames[t.kind]} · ${t.target_id}`),
    combatReport(state, config, candidate, npc, building));
  return lines.join('\n');
}
