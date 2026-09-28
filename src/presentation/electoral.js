import { buildingAssetId } from './illustrated-buildings.js';
import { ringDelta } from '../simulation/world.js';
import { meetingWaveRadius } from '../simulation/electoral-buildings.js';
import { MapWheel } from './map-wheel.js';

const MEETING_SPRITE_GROUND_ANCHOR = 0.88;
const MEETING_UPPER_HEIGHT_SCALE = 1.45;
// Bords du plancher dans chaque PNG (les marches et les marges transparentes sont exclues).
const MEETING_PLATFORM_BOUNDS = {
  'building-meeting_stage-bobo': [0.006, 0.994],
  'building-meeting_stage-banlieue': [0.004, 0.996],
  'building-meeting_stage-periurbain': [0.010, 0.990],
  'building-meeting_stage-campagne': [0.040, 0.960],
  'building-meeting_stage-retraites': [0.005, 0.995],
  'building-meeting_stage-riches': [0.015, 0.985],
};
// La coupe suit l'arrière du plancher : les poteaux montent, mais le plateau et ses bords ne bougent pas.
const MEETING_DECK_SPLIT = {
  'building-meeting_stage-bobo': 0.67,
  'building-meeting_stage-banlieue': 0.71,
  'building-meeting_stage-periurbain': 0.70,
  'building-meeting_stage-campagne': 0.72,
  'building-meeting_stage-retraites': 0.76,
  'building-meeting_stage-riches': 0.73,
};

export function isOnMeetingStage(entity, config, state) {
  if (entity.role !== 'CANDIDAT' || entity.combat.height < config.balance.buildings.meeting.podium_height) return false;
  if (entity.podium_site_id) return true;
  // Pendant le saut, le personnage passe derrière le premier plan dès qu'il atteint l'estrade.
  return entity.combat.jump_tick != null && !!state?.buildings.some(building => building.type === 'meeting'
    && building.state === 'ACTIVE' && Math.abs(ringDelta(entity.x, building.x, state.world.length))
      <= config.balance.buildings.meeting.podium_half_width);
}

export function meetingSpriteFrame(renderer, state, building) {
  const id = buildingAssetId(building, state.world);
  const sprite = renderer.assets.get(id);
  if (!sprite) return null;
  const [platformLeft, platformRight] = MEETING_PLATFORM_BOUNDS[id];
  const halfWidth = renderer.config.balance.buildings.meeting.podium_half_width * renderer.metrics.pixelsPerUnit;
  // La collision définit aussi la largeur dessinée, indépendamment de la résolution et du zoom.
  const width = halfWidth * 2 / (platformRight - platformLeft);
  const baseHeight = width * sprite.naturalHeight / sprite.naturalWidth;
  const deckSplit = MEETING_DECK_SPLIT[id];
  const deckY = renderer.metrics.groundY - baseHeight * (MEETING_SPRITE_GROUND_ANCHOR - deckSplit);
  const upperHeight = baseHeight * deckSplit * MEETING_UPPER_HEIGHT_SCALE;
  const lowerHeight = baseHeight * (1 - deckSplit);
  return { sprite, width, height: upperHeight + lowerHeight, baseHeight, deckSplit, deckY, upperHeight, lowerHeight,
    platformLeft, platformRight,
    left: renderer.screenX(building.x) - halfWidth - platformLeft * width,
    top: deckY - upperHeight };
}

export function drawMeetingStageSprite(ctx, frame) {
  const { sprite, left, top, width, deckSplit, deckY, upperHeight, lowerHeight } = frame;
  const cut = sprite.naturalHeight * deckSplit;
  ctx.drawImage(sprite, 0, 0, sprite.naturalWidth, cut, left, top, width, upperHeight);
  ctx.drawImage(sprite, 0, cut, sprite.naturalWidth, sprite.naturalHeight - cut,
    left, deckY, width, lowerHeight);
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
    this.wheel = new MapWheel(this.circle);
    this.signature = '';
  }
  update(state, candidate, playerX = candidate.x) {
    const faction = candidate.faction_id;
    const sprint = state.phase === 'SECOND_ROUND_SPRINT';
    const visible = ['CAMPAIGN', 'SECOND_ROUND_SPRINT'].includes(state.phase);
    const studio = state.campaign_events.some(e => e.status === 'ACTIVE' && e.arena && e.participants.includes(candidate.id));
    this.element.hidden = !visible;
    this.element.classList.toggle('map-clock-only', studio);
    document.getElementById('game').classList.toggle('has-map-wheel', visible && !studio);
    this.element.classList.toggle('sprint-clock', sprint);
    const dayText = sprint ? `${Math.ceil(state.sprint_remaining_ticks / this.hz)}` : `J-${state.days_remaining}`;
    if (this.day.textContent !== dayText) this.day.textContent = dayText;
    this.day.setAttribute('aria-label', sprint ? `${this.day.textContent} secondes avant le second tour` : `J-${state.days_remaining}`);
    const poll = state.polls[faction];
    const snapshot = poll.lastPollSnapshot;
    this.circle.hidden = studio;
    this.scores.hidden = !visible || studio || !snapshot;
    this.element.classList.toggle('poll-stale', !!snapshot && !poll.active);
    this.scores.classList.toggle('poll-stale', !!snapshot && !poll.active);
    this.wheel.build(state.world);
    this.wheel.updatePosition(state.world, playerX);
    const signature = `${this.wheel.layoutKey}:${faction}:${state.seed}:${poll.active}:${snapshot?.measured_tick}:${JSON.stringify(snapshot)}`;
    if (signature === this.signature) return;
    this.signature = signature;
    this.wheel.updatePoll(snapshot, territoryColors);
    this.scores.replaceChildren();
    if (!snapshot) return;
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
    drawMeetingStageSprite(ctx, frame);
    progressY = frame.deckY - m.characterHeight * 1.35;
  } else {
    ctx.fillStyle = '#69776b'; ctx.fillRect(x - halfWidth, top, halfWidth * 2, m.groundY - top);
    ctx.fillStyle = '#c2b58d'; ctx.fillRect(x - halfWidth - 3, top - 5, halfWidth * 2 + 6, 5);
    ctx.strokeStyle = '#4b5b4d'; ctx.strokeRect(x - halfWidth, top, halfWidth * 2, m.groundY - top);
    ctx.fillStyle = '#536a59'; ctx.fillRect(x - 4, top - 13, 8, 8);
  }
  if (building.meeting_candidate_id) drawApplauseMeter(ctx, x, progressY + 6, building, settings, config.balance.simulation_architecture.fixed_tick_hz, color, state.tick);
  ctx.restore();
}

/** Applaudimètre en papier, dans le style des billets : une barre par seconde de discours, de plus en plus haute. */
function drawApplauseMeter(ctx, x, bottom, building, settings, hz, color, tick) {
  const held = building.meeting_hold_ticks / hz;
  const paused = building.meeting_pause_ticks > 0;
  const bars = Math.max(1, Math.round(settings.hold_seconds));
  const w = 132, h = 40, left = x - w / 2, top = bottom - h;
  const ink = paused ? '#9b3b33' : '#4d6648';
  ctx.save();
  ctx.fillStyle = '#26313233'; ctx.beginPath(); ctx.roundRect(left + 2, top + 3, w, h, 6); ctx.fill();
  ctx.fillStyle = '#fff4d6'; ctx.strokeStyle = ink; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.roundRect(left, top, w, h, 6); ctx.fill(); ctx.stroke();
  ctx.fillStyle = color; ctx.fillRect(left + 1, top + 7, 4, h - 14);
  ctx.textBaseline = 'alphabetic';
  if (paused) {
    // Clignote pour signaler que le discours est suspendu.
    const remaining = Math.max(0, settings.pause_grace_seconds - building.meeting_pause_ticks / hz);
    ctx.globalAlpha = 0.65 + 0.35 * Math.sin(tick * 0.5);
    ctx.textAlign = 'left'; ctx.fillStyle = ink; ctx.font = '800 9px system-ui';
    ctx.fillText('REMONTEZ SUR SCÈNE !', left + 10, top + 12);
    ctx.textAlign = 'right'; ctx.font = 'bold 11px system-ui';
    ctx.fillText(`${remaining.toFixed(1).replace('.', ',')} s`, left + w - 8, top + 12);
    ctx.globalAlpha = 1;
  } else {
    ctx.textAlign = 'left'; ctx.fillStyle = '#6b5530'; ctx.font = '800 9px system-ui';
    ctx.fillText('APPLAUDIMÈTRE', left + 10, top + 12);
    ctx.textAlign = 'right'; ctx.fillStyle = ink; ctx.font = 'bold 11px system-ui';
    ctx.fillText(`${Math.max(0, Math.ceil(settings.hold_seconds - held))} s`, left + w - 8, top + 12);
  }
  const barsLeft = left + 10, barsWidth = w - 18, gap = 2, baseY = bottom - 5, maxHeight = 20;
  const barWidth = (barsWidth - gap * (bars - 1)) / bars;
  for (let i = 0; i < bars; i++) {
    const bx = barsLeft + i * (barWidth + gap);
    const barHeight = 5 + (maxHeight - 5) * i / Math.max(1, bars - 1);
    const fill = Math.max(0, Math.min(1, held - i));
    ctx.fillStyle = '#e6d8b5'; ctx.fillRect(bx, baseY - barHeight, barWidth, barHeight);
    if (!fill) continue;
    // La barre qui vient de se remplir « saute » brièvement, comme une salve d'applaudissements.
    const pop = fill >= 1 && held - i < 1.3 ? Math.sin(Math.min(1, (held - i - 1) / 0.3) * Math.PI) * 3 : 0;
    ctx.fillStyle = i >= bars - 3 ? '#e2ad32' : color;
    ctx.fillRect(bx, baseY - barHeight * fill - pop, barWidth, barHeight * fill + pop);
    ctx.fillStyle = '#ffffff55'; ctx.fillRect(bx, baseY - barHeight * fill - pop, barWidth, 2);
  }
  ctx.restore();
}

/**
 * Onde de fin de meeting : un halo circulaire et lumineux qui s'étend depuis la scène.
 * Son rayon est celui de la simulation : chaque PNJ bascule quand l'anneau le touche.
 */
export function drawMeetingWaves(renderer, state, alpha = 0) {
  const { ctx, config, metrics: m, width } = renderer;
  const settings = config.balance.buildings.meeting;
  const hz = config.balance.simulation_architecture.fixed_tick_hz;
  for (const building of state.buildings) {
    if (building.type !== 'meeting' || !building.meeting_wave_faction_id) continue;
    const elapsedTicks = state.tick - building.meeting_wave_tick + alpha;
    const duration = settings.wave_visual_seconds * hz;
    if (elapsedTicks < 0 || elapsedTicks > duration) continue;
    const x = renderer.screenX(building.x);
    const radius = meetingWaveRadius(state, config, building, elapsedTicks) * m.pixelsPerUnit;
    if (x + radius < 0 || x - radius > width) continue;
    const frame = meetingSpriteFrame(renderer, state, building);
    const cy = frame ? frame.deckY - m.characterHeight * 0.55 : m.groundY - m.characterHeight * 0.8;
    const color = config.prototype.presentation.factions[building.meeting_wave_faction_id]?.color || '#d9b24c';
    const progress = elapsedTicks / duration;
    const fade = 1 - Math.max(0, (progress - 0.65) / 0.35) ** 2;
    ctx.save();
    ctx.beginPath(); ctx.rect(0, 0, width, m.groundY + m.groundThickness); ctx.clip();
    // Lueur douce au départ, sur la scène : un souffle, pas une explosion.
    if (progress < 0.3) {
      const glow = ctx.createRadialGradient(x, cy, 0, x, cy, m.characterHeight * 1.2);
      glow.addColorStop(0, `rgba(255, 249, 225, ${0.55 * (1 - progress / 0.3)})`); glow.addColorStop(1, 'rgba(255, 249, 225, 0)');
      ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(x, cy, m.characterHeight * 1.2, 0, Math.PI * 2); ctx.fill();
    }
    if (radius > 4) {
      // Voile coloré qui ne s'allume qu'au bord du cercle.
      const veil = ctx.createRadialGradient(x, cy, radius * 0.5, x, cy, radius);
      veil.addColorStop(0, withAlpha(color, 0)); veil.addColorStop(0.9, withAlpha(color, 0.3 * fade)); veil.addColorStop(1, withAlpha(color, 0));
      ctx.fillStyle = veil; ctx.beginPath(); ctx.arc(x, cy, radius, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = fade;
    ctx.shadowColor = color; ctx.shadowBlur = 26;
    ctx.strokeStyle = withAlpha(color, 0.35); ctx.lineWidth = 16;
    ctx.beginPath(); ctx.arc(x, cy, radius, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = withAlpha(color, 0.9); ctx.lineWidth = 5;
    ctx.beginPath(); ctx.arc(x, cy, radius, 0, Math.PI * 2); ctx.stroke();
    ctx.shadowColor = '#ffe9a8'; ctx.shadowBlur = 10;
    ctx.strokeStyle = '#fff7d6'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(x, cy, radius, 0, Math.PI * 2); ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = withAlpha(color, 0.3); ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(x, cy, radius * 0.78, 0, Math.PI * 2); ctx.stroke();
    // Étincelles portées par l'anneau.
    ctx.fillStyle = '#fff6cf'; ctx.font = 'bold 13px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (let i = 0; i < 12; i++) {
      const angle = i / 12 * Math.PI * 2 + progress * 0.9;
      ctx.fillText('✦', x + Math.cos(angle) * radius, cy + Math.sin(angle) * radius);
    }
    ctx.restore();
  }
}

function withAlpha(hex, alpha) {
  const value = parseInt(hex.slice(1, 7), 16);
  return `rgba(${value >> 16 & 255}, ${value >> 8 & 255}, ${value & 255}, ${alpha})`;
}

/** L'intérieur des sprites est transparent : micro, banderoles, rambardes et bord passent devant les candidats sur scène. */
export function drawMeetingForeground(renderer, state) {
  const { ctx, config } = renderer;
  for (const building of state.buildings) {
    if (building.type !== 'meeting' || !state.candidates.some(candidate => isOnMeetingStage(candidate, config, state)
      && (candidate.podium_site_id === building.id || candidate.combat.jump_tick != null
        && Math.abs(ringDelta(candidate.x, building.x, state.world.length)) <= config.balance.buildings.meeting.podium_half_width))) continue;
    const frame = meetingSpriteFrame(renderer, state, building);
    if (!frame) continue;
    const { left, top, width } = frame;
    ctx.save();
    ctx.beginPath(); ctx.rect(left, top, width, renderer.metrics.groundY - top); ctx.clip();
    drawMeetingStageSprite(ctx, frame);
    ctx.restore();
  }
}
