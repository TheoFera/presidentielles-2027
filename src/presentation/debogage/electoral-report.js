export function electoralReport(state, config, candidate) {
  const hz = config.balance.simulation_architecture.fixed_tick_hz;
  const names = { melenchon: 'Mélenchon', le_pen: 'Le Pen', philippe: 'Philippe', neutral: 'Neutres', pending: 'À apparaître' };
  const scores = support => Object.entries(names).map(([id, name]) => `${name} ${support[id].toLocaleString('fr-FR', { maximumFractionDigits: 1 })} %`).join(' · ');
  const poll = state.polls[candidate.faction_id];
  const lines = ['', '— ÉLECTEURS PHYSIQUES —', `${state.npcs.length} / ${config.layout.total_electors} PNJ apparus`,
    `Voix actuelles : ${Object.entries(names).map(([id, name]) => `${name} ${state.actualGameState.national_counts[id]}`).join(' · ')}`,
    `Pourcentages : ${scores(state.actualGameState.national_support)}`,
    `Territoires contrôlés : ${Object.entries(state.actualGameState.controlled_counts).map(([id, count]) => `${names[id] || 'Contestés'} ${count}`).join(' · ')}`,
    poll.lastPollSnapshot ? `Dernier sondage acheté il y a ${((state.tick - poll.lastPollSnapshot.measured_tick) / hz).toFixed(1)} s : ${scores(poll.lastPollSnapshot.national_support)}` : 'Aucun sondage acheté.',
    '', '— SOUS-ZONES —'];
  for (const zone of state.electorate) {
    lines.push(`${zone.subzone_id} · ${Object.entries(names).map(([id, name]) => `${name} ${zone.support[id]}`).join(' · ')} · contrôle ${names[zone.controller] || 'contesté'}`);
  }
  lines.push('', '— COMMUNICATION ET MEETINGS —');
  for (const building of state.buildings.filter(item => item.type === 'tour_communication' && item.owner_id || item.type === 'meeting')) {
    if (building.type === 'tour_communication') lines.push(`${building.subzone_id} · Tour ${names[building.owner_id]} · ${building.state === 'ACTIVE' ? 'une action toutes les 15 s' : 'inactive'}`);
    else lines.push(`${building.subzone_id} · Promontoire · ${building.meeting_candidate_id ? `meeting de ${names[building.meeting_faction_id]} : ${(building.meeting_hold_ticks / hz).toFixed(1)} / 15 s` : 'disponible'} · meetings validés : ${building.meetings_held}`);
  }
  return lines.join('\n');
}
