export const territoryColors = { melenchon: '#b94e54', le_pen: '#30496b', philippe: '#e9e9e2', contested: '#9da79e' };

/** Rounding the published values preserves a displayed total of 100.0 %. */
export function roundedPollScores(support) {
  const entries = Object.entries(support).map(([faction, value], order) => ({ faction, order, tenths: Math.floor(value * 10), remainder: value * 10 % 1 }));
  const missing = 1000 - entries.reduce((sum, e) => sum + e.tenths, 0);
  const ranked = [...entries].sort((a, b) => b.remainder - a.remainder || a.order - b.order);
  for (let i = 0; i < missing; i++) ranked[i % ranked.length].tenths++;
  return Object.fromEntries(entries.map(e => [e.faction, e.tenths / 10]));
}

/** Presentation reads only measured information; it never calculates a live score. */
export class ElectoralDisplay {
  constructor(config) {
    this.hz = config.balance.simulation_architecture.fixed_tick_hz;
    this.day = document.getElementById('day');
    this.circle = document.getElementById('electoral-circle');
    this.scores = document.getElementById('poll-scores');
    this.element = document.getElementById('electoral-display');
    this.signature = '';
  }
  update(state, faction) {
    const sprint = state.phase === 'SECOND_ROUND_SPRINT';
    this.element.hidden = !['CAMPAIGN', 'SECOND_ROUND_SPRINT'].includes(state.phase);
    this.element.classList.toggle('sprint-clock', sprint);
    this.day.textContent = sprint ? `${Math.ceil(state.sprint_remaining_ticks / this.hz)}` : `J-${state.days_remaining}`;
    this.day.setAttribute('aria-label', sprint ? `${this.day.textContent} secondes avant le second tour` : `J-${state.days_remaining}`);
    const poll = state.polls[faction];
    const snapshot = poll.lastPollSnapshot;
    this.circle.hidden = !snapshot; this.scores.hidden = !snapshot;
    this.element.classList.toggle('poll-stale', !!snapshot && !poll.active);
    const signature = `${faction}:${state.seed}:${poll.active}:${snapshot?.measured_tick}:${JSON.stringify(snapshot)}`;
    if (signature === this.signature) return;
    this.signature = signature;
    this.circle.replaceChildren(); this.scores.replaceChildren();
    if (!snapshot) return;
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 80 80'); svg.setAttribute('aria-label', 'Dernier sondage : 18 sous-zones, dans l’ordre du monde');
    const polar = angle => [40 + 32 * Math.sin(angle), 40 - 32 * Math.cos(angle)];
    snapshot.zones.forEach((zone, index) => {
      const angle = Math.PI * 2 / snapshot.zones.length;
      const start = polar(index * angle + 0.045); const end = polar((index + 1) * angle - 0.045);
      const path = document.createElementNS(svg.namespaceURI, 'path');
      path.setAttribute('d', `M${start[0]},${start[1]} A32,32 0 0 1 ${end[0]},${end[1]}`);
      path.setAttribute('fill', 'none'); path.setAttribute('stroke', territoryColors[zone.controller || 'contested']); path.setAttribute('stroke-width', '5');
      path.setAttribute('data-zone', zone.subzone_id); svg.append(path);
    });
    this.circle.append(svg);
    const labels = { melenchon: 'Mélenchon', le_pen: 'Le Pen', philippe: 'Philippe', neutral: 'Neutres' };
    const rounded = roundedPollScores(snapshot.national_support);
    for (const faction of Object.keys(labels)) {
      const span = document.createElement('span');
      const value = rounded[faction].toLocaleString('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
      span.setAttribute('aria-label', `${labels[faction]} : ${value} %`);
      span.title = labels[faction];
      const dot = document.createElement('i'); dot.style.background = territoryColors[faction] || territoryColors.contested;
      span.append(dot, `${value} %`); this.scores.append(span);
    }
    this.scores.title = poll.active ? 'Dernier sondage : mesure périodique' : 'Dernière mesure conservée : Institut fermé';
  }
}

export function drawTerritoryFlags(renderer, state) {
  const { ctx, metrics, width } = renderer;
  for (const e of state.electorate) {
    const zone = state.world.subzones.find(z => z.id === e.subzone_id);
    const x = renderer.screenX(zone.start + zone.width * 0.59);
    if (x < -25 || x > width) continue;
    const y = metrics.groundY - metrics.characterHeight * 1.85;
    ctx.fillStyle = '#6b756b'; ctx.fillRect(x, y, 2, 48);
    ctx.fillStyle = territoryColors[e.controller || 'contested']; ctx.fillRect(x + 2, y + 1, 21, 12);
    ctx.strokeStyle = '#6b756b'; ctx.lineWidth = 1; ctx.strokeRect(x + 2, y + 1, 21, 12);
    if (!e.controller) { ctx.beginPath(); ctx.moveTo(x + 3, y + 12); ctx.lineTo(x + 22, y + 2); ctx.stroke(); }
  }
}

export function drawElectoralBuilding(renderer, state, building) {
  const { ctx, metrics: m, config, p, height, width } = renderer;
  const x = renderer.screenX(building.x);
  if (x < -70 || x > width + 70) return;
  const ground = m.groundY;
  const color = p.factions[building.owner_id || building.meeting_faction_id]?.color || '#758477';
  const active = building.state === 'ACTIVE';
  const labels = { tour_communication: 'COMM.', institut_sondage: 'SONDAGE', meeting: 'MEETING' };
  ctx.save(); ctx.textAlign = 'center'; ctx.lineWidth = 2;
  ctx.strokeStyle = active ? '#617064' : '#878d84'; ctx.fillStyle = '#c0c8ba';
  if (building.type === 'tour_communication') {
    const top = ground - height * 0.54;
    ctx.beginPath(); ctx.moveTo(x - 20, ground); ctx.lineTo(x, top); ctx.lineTo(x + 20, ground); ctx.stroke();
    for (let i = 0; i < 6; i++) {
      const y = top + (i + 1) * (ground - top) / 6;
      ctx.beginPath(); ctx.moveTo(x - i * 3, y - 30); ctx.lineTo(x + (i + 1) * 3, y); ctx.lineTo(x - (i + 1) * 3, y); ctx.stroke();
    }
    ctx.fillStyle = active ? color : '#878d84'; ctx.fillRect(x - 6, top - 10, 12, 19);
    if (active) {
      const pulse = (state.tick % 75) / 75;
      ctx.globalAlpha = 0.6 * (1 - pulse); ctx.strokeStyle = color;
      for (const direction of [-1, 1]) { ctx.beginPath(); ctx.arc(x, top, 11 + pulse * 20, direction < 0 ? 2.35 : -0.8, direction < 0 ? 3.95 : 0.8); ctx.stroke(); }
      ctx.globalAlpha = 1;
    }
  } else if (building.type === 'institut_sondage') {
    const top = ground - height * 0.3;
    ctx.fillRect(x - 29, top, 58, ground - top); ctx.strokeRect(x - 29, top, 58, ground - top);
    ctx.fillStyle = active ? color : '#878d84'; ctx.fillRect(x - 31, top - 4, 62, 6);
    ctx.fillStyle = '#e8eadf'; ctx.fillRect(x - 22, top + 19, 44, 35);
    ctx.fillStyle = '#667a69'; for (let i = 0; i < 3; i++) ctx.fillRect(x - 15 + i * 11, top + 46 - i * 6, 7, 4 + i * 6);
    ctx.fillStyle = '#728172'; ctx.fillRect(x - 12, ground - 60, 24, 60);
  } else {
    const running = active && building.meeting_until_tick > state.tick;
    ctx.fillStyle = '#778474'; ctx.fillRect(x - 40, ground - 17, 80, 17);
    ctx.fillStyle = '#c0c8ba'; ctx.fillRect(x - 13, ground - 58, 26, 41);
    ctx.fillStyle = active ? color : '#878d84'; ctx.fillRect(x - 14, ground - 59, 28, 7);
    ctx.strokeStyle = active ? color : '#878d84'; ctx.beginPath(); ctx.moveTo(x + 4, ground - 59); ctx.lineTo(x + 4, ground - 73); ctx.lineTo(x - 2, ground - 76); ctx.stroke();
    ctx.fillStyle = running ? color : '#8a9788';
    for (const side of [-1, 1]) { ctx.fillRect(x + side * 35 - 2, ground - 130, 3, 113); ctx.fillRect(x + side * 35, ground - 129, side * 22, 18); }
    if (running) {
      const phase = (state.tick - building.meeting_started_tick) / config.balance.simulation_architecture.fixed_tick_hz;
      ctx.strokeStyle = color; ctx.globalAlpha = 0.65 * (1 - phase % 1);
      ctx.beginPath(); ctx.arc(x, ground - 56, 22 + (phase % 1) * 58, Math.PI, 2 * Math.PI); ctx.stroke(); ctx.globalAlpha = 1;
      ctx.font = 'bold 17px system-ui'; ctx.fillText('✦', x - 28, ground - 145 - Math.sin(phase * 4) * 4); ctx.fillText('✦', x + 30, ground - 158 + Math.sin(phase * 4) * 4);
    }
  }
  ctx.fillStyle = '#e7e9e0'; ctx.fillRect(x - 31, ground - 34, 62, 17);
  ctx.fillStyle = active ? '#435444' : '#68726d'; ctx.font = '600 9px system-ui'; ctx.fillText(active ? labels[building.type] : 'NEUTRE', x, ground - 22);
  for (let i = 0; i < building.level; i++) { ctx.fillStyle = color; ctx.fillRect(x - 10 + i * 8, ground - 12, 5, 3); }
  if (building.level >= 2 && building.type === 'tour_communication') { ctx.fillStyle = color; ctx.fillRect(x + 12, ground - height * 0.43, 7, 18); }
  if (building.level >= 3 && building.type === 'tour_communication') { ctx.fillStyle = color; ctx.fillRect(x - 20, ground - height * 0.36, 7, 22); }
  if (building.closure_progress > 0) { ctx.fillStyle = `rgba(120,126,123,${Math.min(0.82, building.closure_progress * 0.82)})`; ctx.fillRect(x - 43, ground - height * 0.56, 86, height * 0.56); }
  ctx.restore();
}
