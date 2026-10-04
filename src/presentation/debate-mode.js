import { drawCombatEffects } from './combat-effects.js';
import { campaignStyles } from '../simulation/campaign-styles.js';
import { portraitContent, hydrateSelectionPortraits } from './debate-selection.js';
import { DEBATE_ARENAS, arenaSupportHeight, drawDebateArena } from './debate-arenas.js';
import { themeColor, themeIcon, themeName } from './debate-themes.js';

// Cadrage de chaque carte : hauteur du sol et taille des personnages.
const MAP_LOOK = { plateau: { ground: 0.79, scale: 1.45 }, studio: { ground: 0.84, scale: 1.2 } };
const CROWD_SEATS = 30;
const reducedMotion = () => !!globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
const hash = n => { let x = Math.imul(n + 1, 2654435761) >>> 0; x ^= x >>> 15; return (x >>> 0) / 4294967296; };

export const fighterStyle = (config, fighter) => campaignStyles(config, fighter.faction_id).find(s => s.id === fighter.current_campaign_style) || null;
export function fighterLabel(config, fighter) {
  const faction = config.prototype.presentation.factions[fighter.faction_id];
  const style = fighterStyle(config, fighter);
  return { name: faction.name, style: style?.name.split(' · ')[0] || '', color: style?.skin.accent || faction.color, faction: faction.color };
}

/** Pupitre le plus haut sous les pieds : le personnage et son ombre s’y posent. */
function supportHeight(state, x, height) {
  let support = 0;
  for (const p of state.platforms || []) if (Math.abs(x - p.x) <= p.half_width && p.height <= height + 1e-6) support = Math.max(support, p.height);
  return support;
}

function drawPlateau(renderer, state) {
  const { ctx, width, height, metrics: m } = renderer;
  ctx.fillStyle = '#242d3c'; ctx.fillRect(0, 0, width, height);
  const backdrop = renderer.assets.get('background-debate');
  if (backdrop) ctx.drawImage(backdrop, 0, 0, width, m.groundY / 0.95);
  else void renderer.assets.load('background-debate');
  ctx.fillStyle = '#c9ab7f'; ctx.fillRect(0, m.groundY, width, 5);
  ctx.fillStyle = '#4c3b30'; ctx.fillRect(0, m.groundY + 5, width, height - m.groundY);
  for (const edge of [state.debate_bounds.min, state.debate_bounds.max]) { ctx.fillStyle = '#d3d8c8'; ctx.fillRect(renderer.screenX(edge) - 3, m.groundY - 20, 6, 20); }
}

function drawStudio(renderer, state, time) {
  const { ctx, width: w, height: h, metrics: m } = renderer;
  const sky = ctx.createLinearGradient(0, 0, 0, m.groundY);
  sky.addColorStop(0, '#070b22'); sky.addColorStop(1, '#1b2150');
  ctx.fillStyle = sky; ctx.fillRect(0, 0, w, m.groundY);
  // Colonnes lumineuses et murs latéraux.
  for (const [x, color] of [[0.05, '#2f6bff'], [0.13, '#ffffff'], [0.87, '#ffffff'], [0.95, '#ff3b5c']]) {
    const glow = ctx.createLinearGradient(w * x - 14, 0, w * x + 14, 0);
    glow.addColorStop(0, `${color}00`); glow.addColorStop(0.5, `${color}55`); glow.addColorStop(1, `${color}00`);
    ctx.fillStyle = glow; ctx.fillRect(w * x - 14, h * 0.1, 28, m.groundY - h * 0.1);
    ctx.fillStyle = `${color}cc`; ctx.fillRect(w * x - 1.5, h * 0.1, 3, m.groundY - h * 0.1);
  }
  // Écran géant du fond.
  const sx = w * 0.2, sy = h * 0.13, sw = w * 0.6, sh = h * 0.34;
  ctx.fillStyle = '#05081a'; ctx.fillRect(sx - 6, sy - 6, sw + 12, sh + 12);
  const screen = ctx.createLinearGradient(sx, sy, sx + sw, sy + sh);
  screen.addColorStop(0, '#10307a'); screen.addColorStop(0.55, '#1a1f5c'); screen.addColorStop(1, '#4a1450');
  ctx.fillStyle = screen; ctx.fillRect(sx, sy, sw, sh);
  ctx.fillStyle = '#ffffff10';
  for (let y = sy; y < sy + sh; y += 4) ctx.fillRect(sx, y, sw, 1);
  const band = sh * 0.06;
  [['#2a55d8', 0], ['#f4f4f4', 1], ['#e2334e', 2]].forEach(([color, i]) => { ctx.fillStyle = color; ctx.fillRect(sx + sw * i / 3, sy + sh - band, sw / 3, band); });
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = `900 ${Math.round(sh * 0.22)}px Impact, 'Arial Black', sans-serif`;
  ctx.fillStyle = '#10163a'; ctx.fillText('LE GRAND DÉBAT', w / 2 + 3, sy + sh * 0.42 + 3);
  ctx.fillStyle = '#ffe36e'; ctx.fillText('LE GRAND DÉBAT', w / 2, sy + sh * 0.42);
  ctx.font = `800 ${Math.round(sh * 0.1)}px system-ui, sans-serif`; ctx.fillStyle = '#d9e4ff';
  ctx.fillText('PRÉSIDENTIELLE 2027', w / 2, sy + sh * 0.7);
  if (Math.floor(time * 1.4) % 2 === 0) { ctx.fillStyle = '#ff3355'; ctx.beginPath(); ctx.arc(sx + 18, sy + 16, 5, 0, Math.PI * 2); ctx.fill(); }
  ctx.font = '800 12px system-ui, sans-serif'; ctx.textAlign = 'left'; ctx.fillStyle = '#ffffff'; ctx.fillText('EN DIRECT', sx + 28, sy + 16);
  // Rampe de projecteurs.
  ctx.fillStyle = '#3a4160'; ctx.fillRect(0, h * 0.045, w, 7);
  ctx.strokeStyle = '#59607f'; ctx.lineWidth = 1.5; ctx.beginPath();
  for (let x = 0; x < w; x += 18) { ctx.moveTo(x, h * 0.045); ctx.lineTo(x + 9, h * 0.045 + 7); ctx.lineTo(x + 18, h * 0.045); }
  ctx.stroke();
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  const lights = [0.08, 0.27, 0.5, 0.73, 0.92];
  lights.forEach((x, i) => {
    const angle = Math.sin(time * 0.7 + i * 1.9) * 0.28;
    const ox = w * x, oy = h * 0.06 + 6, length = m.groundY - oy, spread = w * 0.07;
    const tx = ox + Math.tan(angle) * length;
    const color = i % 2 ? '120,170,255' : '255,245,220';
    const cone = ctx.createLinearGradient(ox, oy, tx, m.groundY);
    cone.addColorStop(0, `rgba(${color},0.22)`); cone.addColorStop(1, `rgba(${color},0)`);
    ctx.fillStyle = cone; ctx.beginPath(); ctx.moveTo(ox - 5, oy); ctx.lineTo(ox + 5, oy); ctx.lineTo(tx + spread, m.groundY); ctx.lineTo(tx - spread, m.groundY); ctx.closePath(); ctx.fill();
  });
  ctx.restore();
  lights.forEach(x => { ctx.fillStyle = '#1b1f33'; ctx.fillRect(w * x - 8, h * 0.052, 16, 12); ctx.fillStyle = '#fff6d8'; ctx.fillRect(w * x - 5, h * 0.052 + 10, 10, 3); });
  // Sol brillant de la scène.
  const floor = ctx.createLinearGradient(0, m.groundY, 0, h);
  floor.addColorStop(0, '#2c3470'); floor.addColorStop(1, '#0c0f26');
  ctx.fillStyle = floor; ctx.fillRect(0, m.groundY, w, h - m.groundY);
  ctx.strokeStyle = '#6f86ff55'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(w / 2, m.groundY + (h - m.groundY) * 0.32, w * 0.3, (h - m.groundY) * 0.22, 0, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = '#ffd35c'; ctx.fillRect(0, m.groundY - 2, w, 3);
}

/** Pupitres : plateau clair sur le dessus (on y tient debout), façade lumineuse. */
function drawPlatforms(renderer, state, time) {
  const { ctx, metrics: m } = renderer;
  for (const p of state.platforms) {
    const x = renderer.screenX(p.x), half = p.half_width * m.pixelsPerUnit, top = m.groundY - p.height * m.characterHeight;
    const central = p.height > 1.5;
    const body = ctx.createLinearGradient(0, top, 0, m.groundY);
    body.addColorStop(0, central ? '#243d8f' : '#1d3a78'); body.addColorStop(1, '#0c1433');
    ctx.fillStyle = body; ctx.beginPath();
    if (central) { ctx.moveTo(x - half * 0.92, top); ctx.lineTo(x + half * 0.92, top); ctx.lineTo(x + half * 0.72, m.groundY); ctx.lineTo(x - half * 0.72, m.groundY); }
    else { ctx.moveTo(x - half * 0.8, top); ctx.lineTo(x + half * 0.8, top); ctx.lineTo(x + half * 0.55, m.groundY); ctx.lineTo(x - half * 0.55, m.groundY); }
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#8fb2ff66'; ctx.lineWidth = 2; ctx.stroke();
    // Bandeau lumineux de la façade.
    const bandY = top + (m.groundY - top) * (central ? 0.28 : 0.35), bandW = half * (central ? 1.3 : 1.05);
    const pulse = 0.65 + 0.35 * Math.sin(time * 3 + p.x);
    ctx.fillStyle = `rgba(99, 237, 255, ${0.25 * pulse})`; ctx.fillRect(x - bandW / 2, bandY - 3, bandW, 16);
    ctx.fillStyle = '#e9f3ff'; ctx.font = `900 ${central ? 14 : 12}px Impact, 'Arial Black', sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(central ? 'DÉBAT 2027' : '2027', x, bandY + 5);
    // Plateau du dessus.
    ctx.fillStyle = '#0a0f25'; ctx.fillRect(x - half, top + 2, half * 2, 8);
    ctx.fillStyle = '#e9eef9'; ctx.fillRect(x - half, top - 4, half * 2, 7);
    ctx.fillStyle = '#ffd35c'; ctx.fillRect(x - half, top - 4, half * 2, 2);
    if (!central) { ctx.strokeStyle = '#c9d2e8'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x + half * 0.5, top - 4); ctx.lineTo(x + half * 0.35, top - 18); ctx.stroke(); ctx.fillStyle = '#1b1f33'; ctx.fillRect(x + half * 0.35 - 3, top - 22, 6, 7); }
  }
}

/** Public au premier plan : s’agite selon les coups, hue ou applaudit les KO. */
function updateCrowd(renderer, state, elapsed) {
  const crowd = renderer.debateCrowd ??= { excitement: 0.2, lastHit: null, lastEvent: null, shouts: [], match: null };
  if (crowd.match !== state.seed + state.map_id + state.candidates.map(c => c.id).join()) {
    Object.assign(crowd, { excitement: 0.2, shouts: [], match: state.seed + state.map_id + state.candidates.map(c => c.id).join(), lastHit: state.hit_results.at(-1)?.id ?? null, lastEvent: state.events.at(-1)?.id ?? null });
  }
  const newHits = crowd.lastHit == null ? state.hit_results : state.hit_results.slice(state.hit_results.findIndex(h => h.id === crowd.lastHit) + 1);
  for (const hit of newHits) {
    crowd.excitement = Math.min(1, crowd.excitement + (hit.strong ? 0.3 : 0.08));
    if (hit.strong && hit.score_damage && Math.random() < 0.4) crowd.shouts.push({ text: Math.random() < 0.5 ? 'OH !' : 'AÏE !', x: 0.15 + Math.random() * 0.7, age: 0 });
  }
  if (newHits.length) crowd.lastHit = state.hit_results.at(-1).id;
  const newEvents = crowd.lastEvent == null ? state.events : state.events.slice(state.events.findIndex(e => e.id === crowd.lastEvent) + 1);
  for (const event of newEvents) {
    if (event.type === 'DebateKnockout') { crowd.excitement = 1; crowd.shouts.push({ text: 'OUUUH !', x: 0.3, age: 0 }, { text: 'BRAVO !', x: 0.7, age: 0.1 }); }
    if (event.type === 'DebateFightStarted') { crowd.excitement = 0.8; crowd.shouts.push({ text: 'ALLEZ !', x: 0.5, age: 0 }); }
    if (event.type === 'UltimateActivated') { crowd.excitement = Math.min(1, crowd.excitement + 0.4); crowd.shouts.push({ text: 'WAOUH !', x: 0.2 + Math.random() * 0.6, age: 0 }); }
  }
  if (newEvents.length) crowd.lastEvent = state.events.at(-1).id;
  crowd.excitement = Math.max(state.phase === 'OVER' ? 0.7 : 0.12, crowd.excitement - elapsed * 0.35);
  for (const shout of crowd.shouts) shout.age += elapsed;
  crowd.shouts = crowd.shouts.filter(s => s.age < 1.6).slice(-5);
  return crowd;
}

function drawCrowd(renderer, state, time, crowd) {
  const { ctx, width: w, height: h, metrics: m } = renderer;
  const colors = state.candidates.map(c => fighterLabel(renderer.config, c).color);
  const size = Math.min(26, (h - m.groundY) * 0.46);
  // Deux rangs : celui du fond, plus petit et plus sombre, puis celui du devant.
  for (const row of [0, 1]) for (let i = 0; i < CROWD_SEATS; i++) {
    const seat = i + row * CROWD_SEATS, r = hash(seat), s = size * (row ? 1 : 0.82);
    const x = (i + 0.5 + row * 0.5) / CROWD_SEATS * w + (r - 0.5) * 12;
    const bounce = Math.max(0, Math.sin(time * (6 + r * 3) + r * 20)) * (1 + crowd.excitement * 7);
    const y = h - s * (row ? 1.05 : 1.75) - bounce;
    const body = row ? ['#262c5c', '#2d2552', '#1f3358'][seat % 3] : ['#1a1f45', '#211b40', '#172745'][seat % 3];
    const lit = row ? '#6f7fd0' : '#4d5aa0';
    // Bras levés et pancartes quand la salle s’enflamme.
    const cheering = crowd.excitement > 0.3 && r > 0.5;
    if (cheering) {
      const wave = Math.sin(time * 9 + seat) * 3;
      ctx.strokeStyle = body; ctx.lineWidth = s * 0.22; ctx.lineCap = 'round'; ctx.beginPath();
      ctx.moveTo(x - s * 0.4, y + s * 0.75); ctx.lineTo(x - s * 0.62 + wave, y - s * 0.35);
      ctx.moveTo(x + s * 0.4, y + s * 0.75); ctx.lineTo(x + s * 0.62 - wave, y - s * 0.35); ctx.stroke();
      if (r > 0.8 && colors.length) {
        ctx.fillStyle = '#c9b48a'; ctx.fillRect(x + s * 0.6 - wave - 1.5, y - s * 1.2, 3, s * 0.9);
        ctx.fillStyle = colors[seat % colors.length]; ctx.fillRect(x + s * 0.6 - wave - s * 0.65, y - s * 1.55, s * 1.3, s * 0.7);
        ctx.fillStyle = '#ffffffd0'; ctx.fillRect(x + s * 0.6 - wave - s * 0.4, y - s * 1.25, s * 0.8, 3);
      }
    }
    ctx.fillStyle = body;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x - s * 0.62, y + s * 0.55, s * 1.24, s * 1.5, s * 0.4);
    else ctx.rect(x - s * 0.62, y + s * 0.55, s * 1.24, s * 1.5);
    ctx.fill();
    ctx.beginPath(); ctx.arc(x, y + s * 0.2, s * 0.42, 0, Math.PI * 2); ctx.fill();
    // Contre-jour : la lumière de la scène souligne têtes et épaules.
    ctx.strokeStyle = lit; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(x, y + s * 0.2, s * 0.42, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x - s * 0.5, y + s * 0.6); ctx.lineTo(x + s * 0.5, y + s * 0.6); ctx.stroke();
  }
  ctx.lineCap = 'butt';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (const shout of crowd.shouts) {
    const x = shout.x * w, y = m.groundY + (h - m.groundY) * 0.1 - shout.age * 26;
    ctx.globalAlpha = Math.max(0, 1 - shout.age / 1.6);
    ctx.font = "900 18px Impact, 'Arial Black', sans-serif";
    ctx.fillStyle = '#10163a'; ctx.fillText(shout.text, x + 2, y + 2);
    ctx.fillStyle = '#ffe36e'; ctx.fillText(shout.text, x, y);
  }
  ctx.globalAlpha = 1;
}

function drawNameTag(renderer, state, fighter, x, y, width, text) {
  const { ctx, config } = renderer;
  const label = fighterLabel(config, fighter);
  const local = fighter.id === state.local_candidate_id;
  ctx.font = '800 12px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.globalAlpha = fighter.is_ko ? 0.45 : 1;
  ctx.fillStyle = local ? '#ffe275' : '#0b1030dd'; ctx.fillRect(x - width / 2, y - 9, width, 18);
  ctx.fillStyle = label.color; ctx.fillRect(x - width / 2, y + 7, width, 3);
  ctx.fillStyle = local ? '#14162e' : '#ffffff'; ctx.fillText(text, x, y);
  ctx.globalAlpha = 1;
}

/** Dessin complet d’un combat du mode Débat. */
export function drawDebateMode(renderer, state, previous, alpha, elapsed = 0) {
  const { ctx, canvas, width, height } = renderer;
  const original = renderer.metrics, originalScreenX = renderer.screenX;
  const arena = DEBATE_ARENAS[state.map_id];
  const look = arena ? { ground: renderer.config.balance.debate_mode.maps[state.map_id].ground_y_ratio ?? 0.73, scale: 1.2 } : MAP_LOOK[state.map_id] || MAP_LOOK.plateau;
  const debateWidth = renderer.config.balance.first_round_debate.width_units;
  renderer.metrics = { ...original, groundY: height * look.ground, groundOffsetRatio: arena ? 0 : 0.06, characterHeight: original.characterHeight * look.scale, pixelsPerUnit: width / debateWidth };
  renderer.screenX = x => x * width / debateWidth;
  const m = renderer.metrics, hz = renderer.config.balance.simulation_architecture.fixed_tick_hz;
  const time = (state.tick + alpha) / hz;
  ctx.setTransform(canvas.width / width, 0, 0, canvas.height / height, 0, 0); ctx.imageSmoothingEnabled = true;
  if (arena) drawDebateArena(renderer, state, time);
  else {
    if (state.map_id === 'studio') drawStudio(renderer, state, time); else drawPlateau(renderer, state);
    if (state.platforms?.length) drawPlatforms(renderer, state, time);
  }
  const olds = new Map([...(previous?.candidates || []), ...(previous?.temporary_units || [])].map(e => [e.id, e]));
  const entities = [...state.temporary_units, ...state.candidates].sort((a, b) => Number(!a.is_ko) - Number(!b.is_ko));
  const tags = [];
  for (const entity of entities) {
    if (entity.disappeared || entity.expired) continue;
    const old = olds.get(entity.id) || entity;
    const x = old.x + (entity.x - old.x) * alpha;
    const h = (old.combat?.height ?? 0) + ((entity.combat?.height ?? 0) - (old.combat?.height ?? 0)) * alpha;
    // Le pupitre sert de sol local : pieds et ombre se posent dessus.
    const support = arena ? arenaSupportHeight(state, x, h) ?? Math.min(0, h) : entity.role === 'CANDIDAT' ? supportHeight(state, x, h) : 0;
    renderer.metrics = { ...m, groundY: m.groundY - support * m.characterHeight };
    renderer.drawPerson({ ...entity, x, combat: entity.combat && { ...entity.combat, height: Math.max(0, h - support) } }, renderer.screenX(x), state);
    renderer.metrics = m;
    if (entity.role === 'CANDIDAT') tags.push([entity, renderer.screenX(x), m.groundY - h * m.characterHeight]);
  }
  // Étiquettes : quand deux combattants se collent, la seconde monte d’un cran.
  ctx.font = '800 12px system-ui, sans-serif';
  const placed = [];
  for (const [fighter, feetX, feetY] of tags.sort((a, b) => a[1] - b[1])) {
    const text = `${fighter.id === state.local_candidate_id ? 'VOUS' : fighter.remote_player ? 'JOUEUR' : 'IA'} · ${fighterLabel(renderer.config, fighter).name}`;
    const width = ctx.measureText(text).width + 14;
    const x = Math.max(width / 2 + 4, Math.min(renderer.width - width / 2 - 4, feetX));
    let y = feetY - m.characterHeight * 1.08;
    if (arena) for (const p of state.platforms) {
      const top = m.groundY - p.height * m.characterHeight;
      if (Math.abs(y - top) < 16 && Math.abs(x - renderer.screenX(p.x)) < p.half_width * m.pixelsPerUnit + width / 2) y = top - 20;
    }
    while (placed.some(p => Math.abs(p.x - x) < (p.width + width) / 2 + 2 && Math.abs(p.y - y) < 20)) y -= 21;
    placed.push({ x, y, width });
    drawNameTag(renderer, state, fighter, x, y, width, text);
  }
  drawCombatEffects(renderer, state, false);
  if (state.map_id === 'studio') drawCrowd(renderer, state, time, updateCrowd(renderer, state, elapsed));
  renderer.metrics = original; renderer.screenX = originalScreenX;
}

/** Images à charger avant le combat : planches des combattants choisis et ultimes. */
export function debateAssetIds(manifest, setup) {
  return Object.keys(manifest).filter(id => id.startsWith('ultimate-') || id.startsWith('character-ultimate-') || id.startsWith('crs-')
    || id === DEBATE_ARENAS[setup.map]?.asset
    || setup.map === 'plateau' && id === 'background-debate'
    || setup.fighters.some(f => {
      const faction = f.faction.replace(/_/g, '-');
      return id === `minor-${f.faction}` || id.startsWith(`character-minor-${f.faction}-`)
        || id === `character-${f.faction}` || id.startsWith(`character-${faction}-`) || id.includes(f.style.replace(/_/g, '-'));
    }));
}

/** Interface HTML du combat : jauges, compte à rebours, KO, écran de fin. */
export class DebateModeDisplay {
  constructor(config, actions) {
    this.config = config; this.actions = actions;
    const game = document.getElementById('game') || document.body;
    this.hud = document.createElement('div'); this.hud.id = 'debate-mode-hud'; this.hud.hidden = true;
    this.hud.setAttribute('aria-label', 'Jauges de vie du combat');
    this.banner = document.createElement('div'); this.banner.id = 'debate-mode-banner'; this.banner.hidden = true; this.banner.setAttribute('role', 'status');
    // Les 3 thèmes du débat, entre les jauges ; chaque round gagné prend la couleur de son vainqueur.
    this.rounds = document.createElement('div'); this.rounds.id = 'debate-mode-rounds'; this.rounds.hidden = true;
    this.rounds.setAttribute('role', 'list'); this.rounds.setAttribute('aria-label', 'Thèmes du débat');
    // Annonce du thème pendant le compte à rebours.
    this.theme = document.createElement('div'); this.theme.id = 'debate-mode-theme'; this.theme.hidden = true; this.theme.setAttribute('role', 'status');
    this.result = document.createElement('section'); this.result.id = 'debate-mode-result'; this.result.hidden = true; this.result.setAttribute('aria-label', 'Résultat du combat');
    // Calque propre au débat : sur tactile, #game perd son conteneur et les cqw suivraient tout l’écran.
    const layer = document.createElement('div'); layer.id = 'debate-mode-layer';
    layer.append(this.hud, this.rounds, this.theme, this.banner, this.result);
    game.insertBefore(layer, document.getElementById('help')?.parentElement === game ? document.getElementById('help') : null);
    this.result.addEventListener('click', event => {
      const action = event.target.closest('[data-debate-action]')?.dataset.debateAction;
      if (action) this.actions[action]?.();
    });
    this.reset();
  }
  reset() {
    this.signature = null; this.cards = new Map(); this.resultShown = false; this.bannerText = null; this.koSeen = 0; this.koUntil = 0; this.koRound = null;
    this.roundsKey = null; this.themeRound = null; this.themeShown = false; this.rematch = { voted: false, waiting: 0, closed: '' }; this.hide();
  }
  hide() { this.hud.hidden = true; this.banner.hidden = true; this.rounds.hidden = true; this.theme.hidden = true; this.theme.getAnimations().forEach(a => a.cancel()); this.result.hidden = true; this.result.replaceChildren(); this.resultShown = false; }
  build(state) {
    this.hud.replaceChildren(); this.cards.clear();
    this.hud.dataset.count = String(state.candidates.length);
    for (const fighter of state.candidates) {
      const label = fighterLabel(this.config, fighter);
      const card = document.createElement('div'); card.className = 'debate-fighter';
      card.style.setProperty('--fighter-color', label.color); card.style.setProperty('--camp-color', label.faction);
      const local = fighter.id === state.local_candidate_id;
      card.innerHTML = `${portraitContent(fighter.faction_id)}<div class="debate-fighter-name"><strong></strong><small></small></div><output></output><div class="debate-fighter-hp"><i class="lag"></i><i class="life"></i></div><div class="debate-fighter-ultimate" title="Ultime" ${fighter.minor ? 'hidden' : ''}><i></i></div>`;
      hydrateSelectionPortraits(card);
      card.querySelector('strong').textContent = `${label.name}${local ? ' · Vous' : ''}`;
      card.querySelector('small').textContent = label.style;
      card.classList.toggle('local', local);
      this.hud.append(card);
      this.cards.set(fighter.id, { card, value: card.querySelector('output'), life: card.querySelector('.life'), lag: card.querySelector('.lag'), ultimate: card.querySelector('.debate-fighter-ultimate i'), lagRatio: 1 });
    }
  }
  update(state, elapsed = 0) {
    const hz = this.config.balance.simulation_architecture.fixed_tick_hz, mode = this.config.balance.debate_mode;
    const signature = `${state.seed}:${state.map_id}:${state.candidates.map(c => c.id).join()}`;
    if (signature !== this.signature) { this.reset(); this.signature = signature; this.build(state); }
    this.hud.hidden = false;
    for (const fighter of state.candidates) {
      const card = this.cards.get(fighter.id);
      const ratio = Math.max(0, fighter.debate_hp / fighter.debate_initial_hp);
      card.life.style.width = `${ratio * 100}%`;
      // Barre retardée : on voit la vie perdue fondre, comme dans les jeux de combat.
      card.lagRatio = Math.max(ratio, card.lagRatio - elapsed * 0.45);
      card.lag.style.width = `${card.lagRatio * 100}%`;
      const value = String(Math.ceil(fighter.debate_hp));
      if (card.value.textContent !== value) card.value.textContent = value;
      card.value.setAttribute('aria-label', `${fighterLabel(this.config, fighter).name} : ${value} points de vie`);
      card.ultimate.style.width = `${Math.min(1, fighter.special_charge / this.config.balance.special_charge.required_points) * 100}%`;
      card.card.classList.toggle('ko', fighter.is_ko);
      card.card.classList.toggle('danger', !fighter.is_ko && ratio < 0.25);
    }
    this.updateRounds(state);
    this.updateTheme(state);
    // Bandeau central : le thème s’annonce seul, puis 3, 2, 1, DÉBATTEZ !, K.O. !
    let text = null, kind = '';
    if (state.phase === 'COUNTDOWN') {
      if (state.countdown_ticks <= (state.countdown_digit_ticks ?? Infinity)) { text = String(Math.max(1, Math.ceil(state.countdown_ticks / hz))); kind = 'count'; }
    } else if (state.fight_started_tick != null && state.tick - state.fight_started_tick < mode.fight_banner_seconds * hz) { text = 'DÉBATTEZ !'; kind = 'fight'; }
    // Pendant 3, 2, 1, le thème descend sous les pieds des combattants.
    if (this.themeShown) this.theme.dataset.step = kind === 'count' ? 'count' : 'intro';
    if (state.round_index !== this.koRound) { this.koRound = state.round_index; this.koSeen = state.ko_order.length; }
    if (state.ko_order.length > this.koSeen) { this.koSeen = state.ko_order.length; this.koUntil = state.tick + hz * 1.1; }
    if (!text && state.tick < this.koUntil) { text = state.candidates.find(c => c.id === state.ko_order.at(-1))?.ko_reason === 'FALL' ? 'CHUTE ! K.O. !' : 'K.O. !'; kind = 'ko'; }
    if (text !== this.bannerText) {
      this.bannerText = text; this.banner.hidden = !text;
      if (text) { this.banner.textContent = text; this.banner.dataset.kind = kind; this.banner.getAnimations().forEach(a => a.cancel()); this.banner.animate([{ transform: 'translate(-50%, -50%) scale(1.8)', opacity: 0 }, { transform: 'translate(-50%, -50%) scale(1)', opacity: 1 }], { duration: 260, easing: 'cubic-bezier(.2,1.4,.4,1)' }); }
    }
    if (state.phase === 'OVER' && !this.resultShown && state.tick - state.finished_tick >= mode.victory_delay_seconds * hz) this.showResult(state);
  }
  /** Pastilles des rounds : thème à venir, en cours, gagné (couleur du vainqueur) ou nul. */
  roundSlot(state, round, i, ended) {
    const slot = document.createElement('span'); slot.className = 'debate-round'; slot.setAttribute('role', 'listitem');
    const done = i < state.round_index || i === state.round_index && ended;
    const winner = done && round.winner_id ? state.candidates.find(c => c.id === round.winner_id) : null;
    slot.dataset.state = winner ? 'won' : done ? 'draw' : i === state.round_index ? 'current' : 'next';
    slot.style.setProperty('--theme-color', themeColor(round.theme));
    if (winner) slot.style.setProperty('--winner-color', fighterLabel(this.config, winner).color);
    const name = themeName(this.config, round.theme);
    slot.setAttribute('aria-label', winner ? `${name} : ${fighterLabel(this.config, winner).name}` : done ? `${name} : match nul` : name);
    slot.innerHTML = themeIcon(round.theme);
    return slot;
  }
  updateRounds(state) {
    const rounds = state.rounds || [];
    this.rounds.hidden = !rounds.length;
    const ended = ['ROUND_OVER', 'OVER'].includes(state.phase);
    const key = `${state.candidates.length}|${state.round_index}|${ended}|${rounds.map(r => `${r.theme}:${r.winner_id}`).join()}`;
    if (key === this.roundsKey) return;
    const animate = this.roundsKey !== null && !reducedMotion();
    const before = [...this.rounds.children].map(slot => slot.dataset.state);
    this.roundsKey = key; this.rounds.dataset.count = String(state.candidates.length);
    this.rounds.replaceChildren(...rounds.map((round, i) => this.roundSlot(state, round, i, ended)));
    // Un round qui vient de se terminer « tamponne » sa pastille.
    if (animate) [...this.rounds.children].forEach((slot, i) => {
      if (['won', 'draw'].includes(slot.dataset.state) && before[i] !== slot.dataset.state) slot.animate([{ transform: 'scale(1.9)' }, { transform: 'scale(1)' }], { duration: 420, easing: 'cubic-bezier(.2,1.4,.4,1)' });
    });
  }
  /** « THÈME 2 » + pictogramme + mot pendant le compte à rebours, puis le bloc file vers sa pastille. */
  updateTheme(state) {
    const round = state.rounds?.[state.round_index];
    const show = !!round && state.phase === 'COUNTDOWN';
    if (show && this.themeRound !== state.round_index) {
      this.themeRound = state.round_index; this.themeShown = true;
      this.theme.style.setProperty('--theme-color', themeColor(round.theme));
      this.theme.innerHTML = `<div class="debate-theme-plate"><span class="debate-theme-icon">${themeIcon(round.theme)}</span><span class="debate-theme-text"><span class="debate-theme-label"></span><span class="debate-theme-word"></span></span></div>`;
      this.theme.querySelector('.debate-theme-label').textContent = round.bonus ? 'Round bonus' : `Thème ${state.round_index + 1}`;
      this.theme.querySelector('.debate-theme-word').textContent = themeName(this.config, round.theme);
      this.theme.getAnimations().forEach(a => a.cancel());
      this.theme.dataset.step = 'intro'; this.theme.hidden = false;
      // La plaque glisse depuis la gauche, puis le pictogramme claque.
      if (!reducedMotion()) {
        this.theme.animate([{ transform: 'translateX(-100%)', opacity: 0 }, { transform: 'translateX(4%)', opacity: 1, offset: 0.7 }, { transform: 'none', opacity: 1 }], { duration: 360, easing: 'ease-out' });
        this.theme.querySelector('.debate-theme-icon svg').animate([{ transform: 'scale(0)' }, { transform: 'scale(1.35)', offset: 0.6 }, { transform: 'scale(1)' }], { duration: 320, delay: 220, easing: 'ease-out', fill: 'backwards' });
      }
    }
    if (show || !this.themeShown) return;
    this.themeShown = false;
    const slot = this.rounds.children[state.round_index];
    if (!slot || reducedMotion() || state.phase !== 'FIGHT') { this.theme.hidden = true; return; }
    const from = this.theme.getBoundingClientRect(), to = slot.getBoundingClientRect();
    // La plaque rétrécit depuis son bord haut (transform-origin) : son centre final est à 4 % de sa hauteur sous ce bord.
    const dx = to.left + to.width / 2 - (from.left + from.width / 2), dy = to.top + to.height / 2 - (from.top + from.height * 0.04);
    const current = getComputedStyle(this.theme).transform, start = current === 'none' ? '' : current;
    const flight = this.theme.animate([{ transform: start || 'none', opacity: 1 }, { transform: `translate(${dx}px, ${dy}px) ${start} scale(.08)`, opacity: 0.4 }], { duration: 340, easing: 'cubic-bezier(.55,0,.85,.35)', fill: 'forwards' });
    flight.onfinish = () => {
      if (this.themeShown) return;
      this.theme.hidden = true; flight.cancel();
      slot.animate([{ transform: 'scale(1.6)' }, { transform: 'scale(1)' }], { duration: 280, easing: 'cubic-bezier(.2,1.4,.4,1)' });
    };
  }
  /** Multijoueur : vote de revanche. voted = ce joueur a voté ; waiting = autres joueurs partants ; closed = raison si impossible. */
  setRematch(status) { Object.assign(this.rematch, status); this.renderRematch(); }
  renderRematch() {
    const button = this.multiplayer && this.result.querySelector('[data-debate-action="rematch"]');
    if (!button) return;
    const { voted, waiting, closed } = this.rematch;
    button.disabled = !!closed || voted;
    button.textContent = closed || (voted ? 'En attente de l’adversaire…' : waiting ? 'Revanche ! (adversaire partant)' : 'Revanche');
    const setup = this.result.querySelector('[data-debate-action="setup"]');
    if (setup) setup.disabled = !!closed;
  }
  showResult(state) {
    this.resultShown = true; this.banner.hidden = true;
    const winner = state.candidates.find(c => c.id === state.winner_id);
    const won = state.winner_id === state.local_candidate_id;
    const standings = (state.standings || []).map(id => state.candidates.find(c => c.id === id)).filter(Boolean);
    const order = standings.length ? standings : [winner, ...[...state.ko_order].reverse().map(id => state.candidates.find(c => c.id === id))].filter(Boolean);
    const label = winner ? fighterLabel(this.config, winner) : null;
    const panel = document.createElement('div'); panel.className = 'debate-result-panel';
    panel.innerHTML = `<p class="debate-result-eyebrow"></p><h2></h2><p class="debate-result-score"></p><div class="debate-result-rounds" role="list" aria-label="Thèmes du débat"></div><p class="debate-result-text"></p><ol class="debate-ranking"></ol><div class="debate-result-actions"><button class="debate-primary" data-debate-action="rematch">Revanche</button><button data-debate-action="setup">Changer de combattants</button><button data-debate-action="home">Menu</button></div>`;
    panel.querySelector('.debate-result-eyebrow').textContent = `${state.map_name} · ${state.format === '1v1' ? '1 contre 1' : '1 contre 1 contre 1'}`;
    panel.querySelector('h2').textContent = winner ? won ? 'Victoire !' : 'Défaite…' : 'Match nul';
    panel.querySelector('h2').dataset.won = String(won);
    panel.querySelector('.debate-result-text').textContent = label ? `${label.name}${label.style ? ` (${label.style})` : ''} remporte le Débat télé${won ? ' : bravo !' : '.'}` : 'Égalité parfaite : personne ne l’emporte.';
    // Score en rounds (2 – 1, 3 – 0…) et les thèmes aux couleurs de leurs vainqueurs.
    const score = panel.querySelector('.debate-result-score'), rounds = panel.querySelector('.debate-result-rounds');
    if (standings.length && state.rounds?.length) {
      score.textContent = standings.map(c => c.rounds_won).join(' – ');
      rounds.replaceChildren(...state.rounds.map((round, i) => this.roundSlot(state, round, i, true)));
    } else { score.hidden = true; rounds.hidden = true; }
    const list = panel.querySelector('ol');
    for (const fighter of order) {
      const item = document.createElement('li'); const l = fighterLabel(this.config, fighter);
      item.style.setProperty('--fighter-color', l.color);
      item.innerHTML = `${portraitContent(fighter.faction_id)}<span class="ranking-name"></span><small></small>`;
      hydrateSelectionPortraits(item);
      item.querySelector('.ranking-name').textContent = `${l.name}${l.style ? ` · ${l.style}` : ''}${fighter.id === state.local_candidate_id ? ' (vous)' : ''}`;
      item.querySelector('small').textContent = fighter.rounds_won != null
        ? `${fighter.rounds_won} round${fighter.rounds_won > 1 ? 's' : ''} · ${Math.round(fighter.damage_dealt)} dégâts`
        : `${Math.round(fighter.damage_dealt)} dégâts infligés`;
      list.append(item);
    }
    // En multijoueur, la revanche se vote à plusieurs ; changer de combattants ramène tout le salon à la sélection.
    this.result.replaceChildren(panel); this.result.hidden = false;
    this.renderRematch();
    panel.querySelector('button').focus({ preventScroll: true });
  }
}
