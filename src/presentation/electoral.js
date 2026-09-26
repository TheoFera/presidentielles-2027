import { buildingAssetId } from './illustrated-buildings.js';
import { ringDelta } from '../simulation/world.js';

const MEETING_SPRITE_HEIGHT_IN_CHARACTERS = 1.7;
const MEETING_SPRITE_GROUND_ANCHOR = 0.88;
const MEETING_FOREGROUND_DECK_START = 0.70;
const MEETING_FOREGROUND_SIDE_WIDTH = 0.24;

export function isOnMeetingStage(entity, config, state) {
  if (entity.role !== 'CANDIDAT' || entity.combat.height < config.balance.buildings.meeting.podium_height) return false;
  if (entity.podium_site_id) return true;
  // Pendant le saut, le personnage passe derrière le premier plan dès qu'il atteint l'estrade.
  return entity.combat.jump_tick != null && !!state?.buildings.some(building => building.type === 'meeting'
    && building.state === 'ACTIVE' && Math.abs(ringDelta(entity.x, building.x, state.world.length))
      <= config.balance.buildings.meeting.podium_half_width);
}

function meetingSpriteFrame(renderer, state, building) {
  const sprite = renderer.assets.get(buildingAssetId(building, state.world));
  if (!sprite) return null;
  const height = renderer.metrics.characterHeight * MEETING_SPRITE_HEIGHT_IN_CHARACTERS;
  const width = height * sprite.naturalWidth / sprite.naturalHeight;
  return { sprite, width, height, left: renderer.screenX(building.x) - width / 2,
    top: renderer.metrics.groundY - height * MEETING_SPRITE_GROUND_ANCHOR };
}

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
    const dayText = sprint ? `${Math.ceil(state.sprint_remaining_ticks / this.hz)}` : `J-${state.days_remaining}`;
    if (this.day.textContent !== dayText) this.day.textContent = dayText;
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
    const labels = { melenchon: 'Mélenchon', le_pen: 'Le Pen', philippe: 'Philippe', neutral: 'Neutres', pending: 'À apparaître' };
    const rounded = roundedPollScores(snapshot.national_support);
    for (const faction of Object.keys(labels)) {
      const span = document.createElement('span');
      const value = rounded[faction].toLocaleString('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
      span.setAttribute('aria-label', `${labels[faction]} : ${value} %`);
      span.title = labels[faction];
      const dot = document.createElement('i'); dot.style.background = territoryColors[faction] || territoryColors.contested;
      span.append(dot, `${value} %`); this.scores.append(span);
    }
    this.scores.title = 'Dernier sondage acheté : les chiffres restent ceux de cette mesure.';
  }
}

export function drawTerritoryFlags(renderer, state) {
  const { ctx, metrics, width } = renderer;
  for (const e of state.electorate) {
    const zone = state.world.subzones.find(z => z.id === e.subzone_id);
    const x = renderer.screenX(zone.start + zone.width * 0.59);
    if (x < -25 || x > width) continue;
    const y = metrics.groundY - metrics.characterHeight * 1.85;
    ctx.save();
    ctx.fillStyle = '#4b4b3f'; ctx.fillRect(x, y, 3, metrics.groundY - y);
    ctx.fillStyle = '#b8ad8c'; ctx.fillRect(x + 1, y, 1, metrics.groundY - y);
    ctx.fillStyle = e.controller ? territoryColors[e.controller] : '#eee4c9';
    ctx.strokeStyle = '#45473d'; ctx.lineWidth = 1.2;
    const flutter = Math.sin(state.tick / 15 + zone.index) * 2;
    ctx.beginPath(); ctx.moveTo(x + 3, y + 2); ctx.quadraticCurveTo(x + 13, y - 1, x + 26, y + 3 + flutter);
    ctx.lineTo(x + 24, y + 18 + flutter); ctx.quadraticCurveTo(x + 13, y + 13, x + 3, y + 17); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#d3b267'; ctx.beginPath(); ctx.arc(x + 1.5, y - 2, 3, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.restore();
  }
}

export function drawElectoralBuilding(renderer, state, building) {
  if (building.type === 'meeting') { drawMeetingPodium(renderer, state, building); return; }
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
    const visualLevel = running ? building.meeting_level : 1;
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
      if (visualLevel >= 2) { ctx.fillStyle = color; ctx.fillRect(x - 58, ground - 112, 20, 12); ctx.fillRect(x + 38, ground - 123, 20, 12); }
      if (visualLevel >= 3) { ctx.fillStyle = '#f1d66c'; ctx.font = 'bold 20px system-ui'; ctx.fillText('★', x, ground - 168); }
    }
  }
  ctx.fillStyle = '#e7e9e0'; ctx.fillRect(x - 31, ground - 34, 62, 17);
  ctx.fillStyle = active ? '#435444' : '#68726d'; ctx.font = '600 9px system-ui'; ctx.fillText(active ? labels[building.type] : 'NEUTRE', x, ground - 22);
  const displayedLevel = building.type === 'meeting' && building.meeting_until_tick > state.tick ? building.meeting_level : building.level;
  for (let i = 0; i < displayedLevel; i++) { ctx.fillStyle = color; ctx.fillRect(x - 10 + i * 8, ground - 12, 5, 3); }
  if (building.level >= 2 && building.type === 'tour_communication') { ctx.fillStyle = color; ctx.fillRect(x + 12, ground - height * 0.43, 7, 18); }
  if (building.level >= 3 && building.type === 'tour_communication') { ctx.fillStyle = color; ctx.fillRect(x - 20, ground - height * 0.36, 7, 22); }
  if (building.closure_progress > 0) { ctx.fillStyle = `rgba(120,126,123,${Math.min(0.82, building.closure_progress * 0.82)})`; ctx.fillRect(x - 43, ground - height * 0.56, 86, height * 0.56); }
  ctx.restore();
}

function drawMeetingPodium(renderer, state, building) {
  const { ctx, metrics: m, config, width } = renderer;
  const x = renderer.screenX(building.x);
  if (x < -m.characterHeight || x > width + m.characterHeight) return;
  const settings = config.balance.buildings.meeting;
  const color = config.prototype.presentation.factions[building.meeting_faction_id]?.color || '#7d8a78';
  const top = m.groundY - settings.podium_height * m.characterHeight;
  const halfWidth = settings.podium_half_width * m.pixelsPerUnit;
  const spriteId = buildingAssetId(building, state.world);
  const frame = meetingSpriteFrame(renderer, state, building);
  if (!frame) void renderer.assets.load(spriteId);
  ctx.save(); ctx.textAlign = 'center';
  let progressY = top - 25;
  if (frame) {
    // Les six détourage ont leur pied à environ 88 % de leur hauteur. L'estrade
    // dessinée se superpose ainsi au plancher physique situé à 0,3 personnage.
    ctx.drawImage(frame.sprite, frame.left, frame.top, frame.width, frame.height);
    progressY = frame.top - 12;
  } else {
    ctx.fillStyle = '#69776b'; ctx.fillRect(x - halfWidth, top, halfWidth * 2, m.groundY - top);
    ctx.fillStyle = '#c2b58d'; ctx.fillRect(x - halfWidth - 3, top - 5, halfWidth * 2 + 6, 5);
    ctx.strokeStyle = '#4b5b4d'; ctx.strokeRect(x - halfWidth, top, halfWidth * 2, m.groundY - top);
    ctx.fillStyle = '#536a59'; ctx.fillRect(x - 4, top - 13, 8, 8);
  }
  if (building.meeting_candidate_id) {
    const progress = building.meeting_hold_ticks / (settings.hold_seconds * config.balance.simulation_architecture.fixed_tick_hz);
    ctx.fillStyle = '#e6eadb'; ctx.fillRect(x - 29, progressY, 58, 5);
    ctx.fillStyle = color; ctx.fillRect(x - 29, progressY, 58 * progress, 5);
    ctx.fillStyle = '#28392c'; ctx.font = 'bold 10px system-ui';
    ctx.fillText(`${Math.floor(building.meeting_hold_ticks / config.balance.simulation_architecture.fixed_tick_hz)} / 15 s`, x, progressY - 5);
  }
  const elapsed = (state.tick - building.meeting_wave_tick) / config.balance.simulation_architecture.fixed_tick_hz;
  if (building.meeting_wave_tick >= 0 && elapsed >= 0 && elapsed < settings.wave_visual_seconds) {
    const zone = state.world.subzones.find(item => item.id === building.subzone_id);
    const progress = elapsed / settings.wave_visual_seconds;
    const radius = Math.max(building.x - zone.start, zone.end - building.x) * m.pixelsPerUnit * progress;
    ctx.globalAlpha = 1 - progress; ctx.strokeStyle = color; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(Math.max(renderer.screenX(zone.start), x - radius), top - 14);
    ctx.lineTo(Math.min(renderer.screenX(zone.end), x + radius), top - 14); ctx.stroke();
  }
  ctx.restore();
}

/** Les candidats sur l'estrade passent derrière son bord et ses poteaux ; les passants au sol seront dessinés ensuite. */
export function drawMeetingForeground(renderer, state) {
  const { ctx, config } = renderer;
  for (const building of state.buildings) {
    if (building.type !== 'meeting' || !state.candidates.some(candidate => isOnMeetingStage(candidate, config, state)
      && (candidate.podium_site_id === building.id || candidate.combat.jump_tick != null
        && Math.abs(ringDelta(candidate.x, building.x, state.world.length)) <= config.balance.buildings.meeting.podium_half_width))) continue;
    const frame = meetingSpriteFrame(renderer, state, building);
    if (!frame) continue;
    const { sprite, left, top, width, height } = frame;
    ctx.save();
    ctx.beginPath(); ctx.rect(left, top, width, renderer.metrics.groundY - top); ctx.clip();
    const sourceY = sprite.naturalHeight * MEETING_FOREGROUND_DECK_START;
    ctx.drawImage(sprite, 0, sourceY, sprite.naturalWidth, sprite.naturalHeight - sourceY,
      left, top + height * MEETING_FOREGROUND_DECK_START, width, height * (1 - MEETING_FOREGROUND_DECK_START));
    const sourceSide = sprite.naturalWidth * MEETING_FOREGROUND_SIDE_WIDTH;
    ctx.drawImage(sprite, 0, 0, sourceSide, sprite.naturalHeight,
      left, top, width * MEETING_FOREGROUND_SIDE_WIDTH, height);
    ctx.drawImage(sprite, sprite.naturalWidth - sourceSide, 0, sourceSide, sprite.naturalHeight,
      left + width * (1 - MEETING_FOREGROUND_SIDE_WIDTH), top, width * MEETING_FOREGROUND_SIDE_WIDTH, height);
    ctx.restore();
  }
}
