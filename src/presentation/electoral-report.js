import { FACTIONS } from '../simulation/world.js';

export function electoralReport(state, config, candidate) {
  const hz = config.balance.simulation_architecture.fixed_tick_hz;
  const f = v => v.toLocaleString('fr-FR', { maximumFractionDigits: 5 });
  const names = { melenchon: 'M', le_pen: 'LP', philippe: 'EP', neutral: 'N' };
  const scores = support => Object.entries(names).map(([id, name]) => `${name} ${f(support[id])} %`).join(' · ');
  const poll = state.polls[candidate.faction_id];
  const lines = ['', '— CONQUÊTE ET INFORMATION —', `J-${state.days_remaining} · score national réel :`, scores(state.actualGameState.national_support),
    `Contrôles : M ${state.actualGameState.controlled_counts.melenchon} · LP ${state.actualGameState.controlled_counts.le_pen} · EP ${state.actualGameState.controlled_counts.philippe} · contestées ${state.actualGameState.controlled_counts.contested}`,
    `Règle : ≥ ${f(config.balance.influence.control_min_leader_percent)} % et ≥ ${f(config.balance.influence.control_required_lead_points)} points d’avance sur le deuxième candidat.`,
    `Institut du camp suivi : ${poll.active ? 'Actif' : 'Inactif'} · fréquence ${f(config.balance.buildings.institut_sondage.poll_refresh_seconds)} s`,
    poll.lastPollSnapshot ? `Dernier sondage affiché (tick ${poll.lastPollSnapshot.measured_tick}) :\n${scores(poll.lastPollSnapshot.national_support)}\nÂge : ${f((state.tick - poll.lastPollSnapshot.measured_tick) / hz)} s · prochain : ${poll.active ? `${f((poll.next_poll_tick - state.tick) / hz)} s` : 'suspendu ; dernière mesure conservée'}` : 'Sondage : jamais publié ; cercle et scores masqués.',
    `Présence candidat : ${f(config.balance.influence.candidate_presence_per_second)} /s · gain LP ×${f(config.balance.influence.le_pen_gain_multiplier)}`,
    '', '— LES 18 SOUS-ZONES, DANS L’ORDRE —'];
  for (const e of state.electorate) {
    lines.push(`${e.subzone_id} · poids ${f(e.electoral_weight)} · tête ${names[e.leader] || 'égalité'} · contrôle ${names[e.controller] || 'contesté'}`,
      `  ${scores(e.support)}`, `  Voisines : ${e.adjacent_subzone_ids.join(' / ')} · biomes voisins : ${e.adjacent_biome_ids.join(' / ')}`);
    for (const faction of FACTIONS) {
      const s = e.influence_sources[faction];
      lines.push(`  ${names[faction]} ${f(e.influence_per_second[faction])}/s : S ${f(s.sympathisants)} + M ${f(s.militants)} + Permanence ${f(s.permanence)} + candidat ${f(s.candidate)} + bonus Meeting ${f(s.meeting)} + Tour ${f(s.tower_base)}×${f(s.tower_multiplier)} ; ensemble ×${f(s.faction_multiplier)}`);
    }
  }
  lines.push('', '— TOURS ET MEETINGS —');
  for (const b of state.buildings.filter(b => b.owner_id && ['tour_communication', 'meeting'].includes(b.type))) {
    const settings = config.balance.buildings[b.type];
    if (b.type === 'tour_communication') lines.push(`${b.subzone_id} · Tour ${names[b.owner_id]} · niveau ${b.level} · ${b.state === 'ACTIVE' ? `base ${f(settings.global_influence_per_second_by_level[b.level - 1])}/s` : 'fermée : influence nulle'}`);
    else lines.push(`${b.subzone_id} · Meeting ${names[b.owner_id]} · niveau ${b.level} · ${b.state === 'ACTIVE' ? `événement ${f(settings.activation_cost_by_level[b.level - 1])} k € · impulsion ${f(settings.influence_burst_by_level[b.level - 1])}` : 'fermé'}`,
      `  Délai : ${f(Math.max(0, b.meeting_ready_tick - state.tick) / hz)} s · bonus actif : ${b.state === 'ACTIVE' && b.meeting_until_tick > state.tick ? `×${f(settings.ally_influence_multiplier_by_level[b.meeting_level - 1])}, encore ${f((b.meeting_until_tick - state.tick) / hz)} s` : 'aucun'} · événements : ${b.meetings_held}`);
  }
  const impact = [...state.hit_results].reverse().find(hit => hit.electoral_changes?.length);
  if (impact) {
    lines.push('', `— AVANT / APRÈS LE COUP ${impact.id} —`);
    for (const e of impact.electoral_changes) lines.push(`${e.subzone_id} : ${scores(e.before)}\n  → ${scores(e.after)}\n  Contrôle : ${names[e.controller_before] || 'contesté'} → ${names[e.controller_after] || 'contesté'}`);
  }
  return lines.join('\n');
}
