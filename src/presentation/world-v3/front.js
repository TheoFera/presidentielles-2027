import { ringDelta } from '../../simulation/world.js';
import { seasonAt } from '../../simulation/campaign-events.js';
import { LAYERS } from './spec.js';

/**
 * Avant-plan : quelques objets bas ou fins (lampadaires, bornes, buissons) qui défilent plus vite que la rue,
 * devant les personnages, pour renforcer la profondeur. Ils évitent les portes, les places de meeting et les financiers.
 */
const INK = '#262b29';
const PROPS = {
  paris_19e: ['lampadaire_paris', 'borne', 'colonne_morris'],
  banlieue: ['lampadaire', 'borne_beton', 'poubelle'],
  periurbain_usine: ['panneau', 'borne_beton', 'buisson'],
  campagne: ['poteau', 'buisson', 'poteau'],
  retraites: ['lampadaire_blanc', 'buisson', 'jardiniere'],
  quartiers_riches: ['lampadaire_orne', 'borne', 'buisson'],
};

const hash = (a, b = 0) => { const s = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453; return s - Math.floor(s); };

/** Emplacements monde des objets d'avant-plan, calculés une fois par carte. */
const cache = new WeakMap();
export function frontPropPlacements(state) {
  if (cache.has(state.world)) return cache.get(state.world);
  const blocked = [
    ...state.buildings.map(b => [b.x, b.type === 'meeting' ? 4 : 1.8]),
    ...(state.funding_encounters || []).map(e => [e.x, 1.6]),
  ];
  const free = x => blocked.every(([bx, r]) => Math.abs(ringDelta(x, bx, state.world.length)) > r);
  const placements = [];
  for (const zone of state.world.subzones) {
    const kinds = PROPS[zone.biome_id] || PROPS.banlieue;
    [0.18, 0.46, 0.82].forEach((ratio, i) => {
      for (const shift of [0, 0.08, -0.08, 0.15, -0.15]) {
        const x = zone.start + zone.width * (ratio + shift);
        if (!free(x)) continue;
        placements.push({ x, kind: kinds[(zone.index + i) % kinds.length], seed: zone.index * 3 + i });
        break;
      }
    });
  }
  cache.set(state.world, placements); return placements;
}

function stroke(ctx, width = 2) { ctx.lineWidth = width; ctx.strokeStyle = INK; ctx.stroke(); }

function drawProp(ctx, kind, x, bottom, H, seed, season) {
  const u = H / 540;
  ctx.save(); ctx.translate(x, bottom); ctx.scale(u, u);
  const post = (color, height, width = 7) => { ctx.fillStyle = color; ctx.fillRect(-width / 2, -height, width, height); ctx.strokeRect(-width / 2, -height, width, height); };
  ctx.strokeStyle = INK; ctx.lineWidth = 2;
  switch (kind) {
    case 'lampadaire_paris': case 'lampadaire_orne': case 'lampadaire': case 'lampadaire_blanc': {
      const color = { lampadaire_paris: '#2f4a3f', lampadaire_orne: '#26282a', lampadaire: '#6f7478', lampadaire_blanc: '#ecebe4' }[kind];
      post(color, 330, kind === 'lampadaire' ? 6 : 8);
      ctx.fillStyle = color; ctx.fillRect(-12, -40, 24, 40); ctx.strokeRect(-12, -40, 24, 40);
      ctx.beginPath(); ctx.moveTo(-16, -330); ctx.lineTo(16, -330); ctx.lineTo(10, -372); ctx.lineTo(-10, -372); ctx.closePath();
      ctx.fillStyle = '#f6e7a8'; ctx.fill(); stroke(ctx);
      ctx.beginPath(); ctx.moveTo(-12, -372); ctx.lineTo(0, -386); ctx.lineTo(12, -372); ctx.closePath(); ctx.fillStyle = color; ctx.fill(); stroke(ctx);
      if (kind === 'lampadaire_orne') { ctx.fillStyle = '#c9a441'; ctx.fillRect(-6, -200, 12, 8); }
      break;
    }
    case 'colonne_morris':
      ctx.fillStyle = '#2f4a3f'; ctx.fillRect(-26, -150, 52, 150); ctx.strokeRect(-26, -150, 52, 150);
      ctx.fillStyle = '#e9dcc0'; ctx.fillRect(-20, -135, 40, 100); ctx.strokeRect(-20, -135, 40, 100);
      ctx.fillStyle = '#c8553d'; ctx.fillRect(-20, -120, 18, 30); ctx.fillStyle = '#3f6fa5'; ctx.fillRect(2, -95, 18, 40);
      ctx.beginPath(); ctx.ellipse(0, -150, 30, 18, 0, Math.PI, 0); ctx.fillStyle = '#2f4a3f'; ctx.fill(); stroke(ctx);
      break;
    case 'borne': post('#2f4a3f', 46, 12); ctx.beginPath(); ctx.arc(0, -46, 7, Math.PI, 0); ctx.fillStyle = '#2f4a3f'; ctx.fill(); stroke(ctx); break;
    case 'borne_beton': ctx.fillStyle = '#b9b5ab'; ctx.fillRect(-12, -40, 24, 40); ctx.strokeRect(-12, -40, 24, 40); break;
    case 'poubelle': ctx.fillStyle = '#4f7a4a'; ctx.fillRect(-16, -58, 32, 58); ctx.strokeRect(-16, -58, 32, 58); post('#6f7478', 70, 5); break;
    case 'panneau':
      post('#8b9194', 170, 6);
      ctx.beginPath(); ctx.arc(0, -176, 17, 0, Math.PI * 2); ctx.fillStyle = '#ffffff'; ctx.fill(); ctx.lineWidth = 8; ctx.strokeStyle = '#c8322b'; ctx.stroke(); stroke(ctx, 2);
      break;
    case 'poteau': post('#8a6a45', 90, 9); ctx.fillStyle = '#8a6a45'; ctx.fillRect(-60, -70, 120, 5); break;
    case 'jardiniere': ctx.fillStyle = '#b8744a'; ctx.fillRect(-34, -40, 68, 40); ctx.strokeRect(-34, -40, 68, 40); // puis le buisson
    // falls through
    case 'buisson': {
      const colors = ['#5f8f45', '#b96f2e', '#8b8a78', '#7fae52'], leaf = colors[season.index];
      ctx.beginPath();
      for (let i = 0; i <= 12; i++) { const a = Math.PI + i / 12 * Math.PI, r = 28 + hash(seed, i) * 9; ctx.lineTo(Math.cos(a) * r * 1.3, (kind === 'jardiniere' ? -40 : 0) + Math.sin(a) * r); }
      ctx.closePath(); ctx.fillStyle = leaf; ctx.fill(); stroke(ctx);
      break;
    }
  }
  ctx.restore();
}

/** Dessiné après les personnages. */
export function drawFrontProps(renderer, state) {
  const { ctx, metrics: m } = renderer, H = renderer.height;
  const parallax = LAYERS.front.parallax, ppu = m.pixelsPerUnit;
  const season = seasonAt(state.campaign_progress_01 || 0);
  const bottom = H + 6;
  const view = renderer.visibleWorld || { left: 0, right: renderer.width };
  ctx.save();
  for (const prop of frontPropPlacements(state)) {
    const x = m.anchorX + ringDelta(renderer.cameraX, prop.x, state.world.length) * ppu * parallax;
    if (x < view.left - 120 || x > view.right + 120) continue;
    drawProp(ctx, prop.kind, x, bottom, H, prop.seed, season);
  }
  ctx.restore();
}
