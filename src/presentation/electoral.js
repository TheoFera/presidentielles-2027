import { buildingAssetId } from './illustrated-buildings.js';
import { ringDelta } from '../simulation/world.js';
import { meetingWaveRadius } from '../simulation/electoral-buildings.js';
import { MapWheel } from './map-wheel.js';

const MEETING_UPPER_HEIGHT_SCALE = 1.45;
// L'estrade a été agrandie de 40 % (podium_half_width et podium_height aussi) ; le micro garde sa taille d'avant.
const MEETING_STAGE_SCALE = 1.4;
// Mesures de chaque PNG (fractions de la largeur ou de la hauteur) :
// bords du plancher, arrière du plancher (coupe), profondeur du dessus du plancher, dernière ligne opaque.
const MEETING_STAGE_GEOMETRY = {
  bobo: { platform: [0.006, 0.994], split: 943 / 1402, surface: 0.031, bottom: 0.874 },
  banlieue: { platform: [0.004, 0.996], split: 997 / 1402, surface: 0.044, bottom: 0.904 },
  periurbain: { platform: [0.010, 0.990], split: 979 / 1389, surface: 0.055, bottom: 0.913 },
  campagne: { platform: [0.040, 0.960], split: 962 / 1323, surface: 0.060, bottom: 0.912 },
  retraites: { platform: [0.005, 0.995], split: 1069 / 1402, surface: 0.052, bottom: 0.930 },
  riches: { platform: [0.015, 0.985], split: 1028 / 1402, surface: 0.039, bottom: 0.936 },
};
// Place du micro (découpé à part) dans le PNG d'origine de l'estrade, en pixels : gauche, haut, droite, bas.
const MEETING_MICRO_BOX = {
  bobo: [687, 556, 797, 983],
  banlieue: [728, 576, 840, 1034],
  periurbain: [794, 598, 902, 1039],
  campagne: [820, 610, 938, 1026],
  retraites: [730, 694, 830, 1099],
  riches: [730, 653, 851, 1073],
};
// Recul du bas de l'estrade derrière les pieds des personnages au sol, en hauteur de personnage.
const MEETING_BEHIND_FEET = 0.04;

export function isOnMeetingStage(entity, config, state) {
  if (entity.role !== 'CANDIDAT' || entity.combat.height < config.balance.buildings.meeting.podium_height) return false;
  if (entity.podium_site_id) return true;
  // Pendant le saut, le personnage passe derrière le premier plan dès qu'il atteint l'estrade.
  return entity.combat.jump_tick != null && !!state?.buildings.some(building => building.type === 'meeting'
    && building.state === 'ACTIVE' && Math.abs(ringDelta(entity.x, building.x, state.world.length))
      <= config.balance.buildings.meeting.podium_half_width);
}

export function meetingSpriteFrame(renderer, state, building) {
  // Estrade provisoire en bois (image du jeu) partout, y compris sur la carte fixe : jamais de scène en pierre.
  const id = buildingAssetId(building, state.world);
  const sprite = renderer.assets.get(id);
  if (!sprite) return null;
  const biome = id.replace('building-meeting_stage-', '');
  const { platform: [platformLeft, platformRight], split: deckSplit, surface, bottom } = MEETING_STAGE_GEOMETRY[biome];
  const m = renderer.metrics, settings = renderer.config.balance.buildings.meeting;
  const halfWidth = settings.podium_half_width * m.pixelsPerUnit;
  // La collision définit aussi la largeur dessinée, indépendamment de la résolution et du zoom.
  const width = halfWidth * 2 / (platformRight - platformLeft);
  const baseHeight = width * sprite.naturalHeight / sprite.naturalWidth;
  // Les pieds d'un candidat sur scène sont au milieu du dessus du plancher, et le bas de l'estrade
  // reste juste derrière les pieds des personnages au sol : le devant est tassé (k) pour tenir entre les deux.
  const feetY = m.groundY - settings.podium_height * m.characterHeight;
  const visibleBottom = m.groundY - m.characterHeight * MEETING_BEHIND_FEET;
  const k = (visibleBottom - feetY) / (baseHeight * (bottom - deckSplit - surface / 2));
  const deckY = feetY - baseHeight * surface / 2 * k;
  const upperHeight = baseHeight * deckSplit * MEETING_UPPER_HEIGHT_SCALE;
  const lowerHeight = baseHeight * (1 - deckSplit) * k;
  const left = renderer.screenX(building.x) - halfWidth - platformLeft * width;
  return { sprite, id, biome, width, height: upperHeight + lowerHeight, baseHeight, deckSplit, deckY, feetY, upperHeight, lowerHeight,
    lowerScale: k, platformLeft, platformRight, left, top: deckY - upperHeight };
}

export function drawMeetingStageSprite(ctx, frame) {
  const { sprite, left, top, width, deckSplit, deckY, upperHeight, lowerHeight } = frame;
  const cut = sprite.naturalHeight * deckSplit;
  ctx.drawImage(sprite, 0, 0, sprite.naturalWidth, cut, left, top, width, upperHeight);
  ctx.drawImage(sprite, 0, cut, sprite.naturalWidth, sprite.naturalHeight - cut,
    left, deckY, width, lowerHeight);
}

/** Micro posé sur le plancher, à la taille de l'ancienne estrade (avant l'agrandissement). */
export function drawMeetingMicro(renderer, frame) {
  const micro = renderer.assets.get(frame.id.replace('meeting_stage', 'meeting_micro'));
  if (!micro) { void renderer.assets.load?.(frame.id.replace('meeting_stage', 'meeting_micro')); return; }
  const { sprite, width, left, deckY, baseHeight, lowerScale, deckSplit } = frame;
  const [x0, y0, x1, y1] = MEETING_MICRO_BOX[frame.biome];
  const cut = sprite.naturalHeight * deckSplit;
  const scale = width / MEETING_STAGE_SCALE / sprite.naturalWidth;
  // Même place relative sur la grande estrade ; le socle reste à la même profondeur sur le plancher.
  const centerX = left + width / 2 + ((x0 + x1) / 2 - sprite.naturalWidth / 2) * width / sprite.naturalWidth;
  const baseY = deckY + (y1 - cut) * baseHeight / sprite.naturalHeight * lowerScale;
  const w = (x1 - x0) * scale;
  // Comme avant : la partie au-dessus du plancher est étirée comme les poteaux, le socle ne l'est pas.
  const h = (cut - y0) * scale * MEETING_UPPER_HEIGHT_SCALE + (y1 - cut) * scale;
  renderer.ctx.drawImage(micro, centerX - w / 2, baseY - h, w, h);
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
    const studio = state.campaign_events.some(e => e.status === 'ACTIVE' && e.debate && e.participants.includes(candidate.id));
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
    drawMeetingMicro(renderer, frame);
    progressY = frame.deckY - m.characterHeight * 1.35;
  } else {
    // Des marches en pierre prolongent la place peinte jusqu'au plan des personnages.
    ctx.strokeStyle = '#665e4d'; ctx.lineWidth = 1.2;
    const step = (m.groundY - top) / 3;
    for (let row = 2; row >= 0; row--) {
      const radius = halfWidth + row * 5, y = top + row * step;
      ctx.fillStyle = ['#c5b693', '#bbae92', '#ad9d80'][row];
      ctx.beginPath(); ctx.ellipse(x, y + step, radius, 5, 0, 0, Math.PI);
      ctx.lineTo(x - radius, y); ctx.ellipse(x, y, radius, 5, 0, Math.PI, Math.PI * 2); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#dfd1af'; ctx.beginPath(); ctx.ellipse(x, y, radius, 5, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      for (let joint = -2; joint <= 2; joint++) {
        const bx = x + (joint + (row % 2) * 0.5) * radius / 3;
        ctx.beginPath(); ctx.moveTo(bx, y + 4); ctx.lineTo(bx, y + step + 4); ctx.stroke();
      }
    }
    ctx.strokeStyle = '#34433e'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(x + halfWidth * 0.6, top); ctx.lineTo(x + halfWidth * 0.6, top - 28); ctx.lineTo(x + halfWidth * 0.6 - 10, top - 31); ctx.stroke();
    ctx.fillStyle = '#34433e'; ctx.beginPath(); ctx.ellipse(x + halfWidth * 0.6 - 11, top - 31, 5, 2.5, 0.25, 0, Math.PI * 2); ctx.fill();
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
    const { left, top, width, deckY, feetY } = frame;
    ctx.save();
    // Le dessus du plancher, entre son arrière et les pieds, reste derrière le candidat : ses pieds restent visibles.
    ctx.beginPath(); ctx.rect(left, top, width, deckY - top); ctx.rect(left, feetY + 2, width, renderer.metrics.groundY - feetY - 2); ctx.clip();
    drawMeetingStageSprite(ctx, frame);
    ctx.restore();
    drawMeetingMicro(renderer, frame);
  }
}
