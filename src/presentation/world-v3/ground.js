import { ringDelta } from '../../simulation/world.js';
import { seasonAt } from '../../simulation/campaign-events.js';

/**
 * Trottoir, bordure et chaussée dessinés par le code, ancrés dans le monde (ils défilent avec les façades).
 * Chaque biome a sa matière ; la saison ajoute neige, feuilles mortes ou fleurs.
 */
const INK = '#2f3632';
export const GROUND_STYLES = {
  paris_19e: { walk: '#d8ccb0', joint: '#b5a788', slab: 1.2, curb: '#a39f95', road: '#8d8880', stones: '#a29c92', pattern: 'paves' },
  banlieue: { walk: '#cbc7bd', joint: '#a9a59b', slab: 1.6, curb: '#aaa79f', road: '#6b6e70', stones: '#7b7e80', pattern: 'asphalte', line: 'dash' },
  periurbain_usine: { walk: '#c7c1b0', joint: '#a8a28f', slab: 2.2, curb: '#8fae5e', road: '#72767a', stones: '#81858a', pattern: 'asphalte', line: 'solid', verge: true },
  campagne: { walk: '#c9ad7c', joint: null, slab: 0, curb: '#86a75a', road: '#9b937f', stones: '#b3aa94', pattern: 'gravier', verge: true },
  retraites: { walk: '#e8dcc0', joint: '#cbbd9c', slab: 1, curb: '#c3b9a3', road: '#7e7f7b', stones: '#8e8f8a', pattern: 'asphalte', line: 'dash' },
  quartiers_riches: { walk: '#e3d9c5', joint: '#c4b9a2', slab: 2.4, curb: '#a9a59b', road: '#5f6365', stones: '#6e7275', pattern: 'asphalte' },
};

const hash = (a, b = 0) => { const s = Math.sin(a * 91.37 + b * 47.11) * 24634.6345; return s - Math.floor(s); };

/** Quantités saisonnières lissées (0 à 1). */
export function seasonalGround(progress) {
  const { index, blend } = seasonAt(progress || 0);
  const snow = index === 1 ? Math.max(0, blend - 0.65) / 0.35 : index === 2 ? 1 - Math.max(0, blend - 0.75) / 0.25 : 0;
  const leaves = index === 0 ? Math.max(0, blend - 0.7) / 0.3 : index === 1 ? 1 - Math.max(0, blend - 0.8) / 0.2 : 0;
  const flowers = index === 3 ? Math.sin(Math.min(1, blend) * Math.PI) * 0.6 + 0.4 : index === 0 ? 1 - blend : 0;
  return { snow, leaves, flowers };
}

/**
 * `zones` : sous-zones visibles avec leur bord gauche à l'écran et un booléen `layered`
 * (les façades v3 reposent un peu en arrière des pieds ; les panoramas v2, directement sur la ligne de marche).
 */
export function drawStreetGround(renderer, state, zones) {
  const { ctx, metrics: m } = renderer, H = renderer.height, ppu = m.pixelsPerUnit;
  const curbY = m.groundY + H * 0.014, curbH = Math.max(3, H * 0.009), bottom = H + 4;
  const season = seasonalGround(state.campaign_progress_01);
  ctx.save();
  for (const { zone, left, layered, backY } of zones) {
    const style = GROUND_STYLES[zone.biome_id] || GROUND_STYLES.banlieue;
    const width = zone.width * ppu, right = left + width;
    const top = layered ? backY : m.groundY;
    const worldX = u => left + (u - zone.start) * ppu;
    // Trottoir (derrière et devant les pieds), puis bordure et chaussée.
    ctx.fillStyle = style.walk; ctx.fillRect(left, top, width + 1, curbY - top);
    if (layered) { ctx.fillStyle = 'rgba(40,40,30,0.18)'; ctx.fillRect(left, top, width + 1, Math.max(2, H * 0.005)); }
    if (style.joint && style.slab) {
      ctx.strokeStyle = style.joint; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(left, (top + curbY) / 2); ctx.lineTo(right, (top + curbY) / 2);
      for (let u = Math.ceil(zone.start / style.slab) * style.slab; u < zone.end; u += style.slab) {
        const x = worldX(u); ctx.moveTo(x, top); ctx.lineTo(x - (curbY - top) * 0.25, curbY);
      }
      ctx.stroke();
    } else if (style.pattern === 'gravier') {
      ctx.fillStyle = '#b3955f';
      for (let u = zone.start; u < zone.end; u += 0.23) ctx.fillRect(worldX(u + hash(u) * 0.2), top + (curbY - top) * hash(u, 1), 2, 2);
    }
    ctx.fillStyle = style.curb; ctx.fillRect(left, curbY, width + 1, curbH);
    ctx.fillStyle = style.road; ctx.fillRect(left, curbY + curbH, width + 1, bottom - curbY - curbH);
    ctx.strokeStyle = INK; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(left, curbY); ctx.lineTo(right, curbY);
    ctx.moveTo(left, curbY + curbH); ctx.lineTo(right, curbY + curbH); ctx.stroke();
    if (style.verge) {
      ctx.fillStyle = '#6f9146';
      for (let u = zone.start; u < zone.end; u += 0.18) ctx.fillRect(worldX(u), curbY - 2 - hash(u, 2) * 4, 2, 4 + hash(u, 2) * 4);
    }
    const roadTop = curbY + curbH;
    if (style.pattern === 'paves') {
      ctx.fillStyle = style.stones;
      for (let row = 0; row < 3; row++) for (let u = zone.start + (row % 2) * 0.17; u < zone.end; u += 0.34)
        ctx.fillRect(worldX(u), roadTop + 4 + row * 9, ppu * 0.26, 5);
    } else {
      ctx.fillStyle = style.stones;
      for (let u = zone.start; u < zone.end; u += 0.41) ctx.fillRect(worldX(u + hash(u, 3) * 0.3), roadTop + 3 + hash(u, 4) * (bottom - roadTop - 6), 2, 2);
    }
    if (style.line) {
      ctx.fillStyle = '#ecebe2';
      const y = roadTop + Math.min(22, (bottom - roadTop) * 0.55);
      if (style.line === 'solid') ctx.fillRect(left, y, width + 1, 3);
      else for (let u = Math.ceil(zone.start / 3) * 3; u < zone.end; u += 3) ctx.fillRect(worldX(u), y, ppu * 1.5, 3);
    }
    // Saisons : feuilles mortes, neige tassée au bord, fleurs dans l'herbe.
    if (season.leaves > 0.02) {
      const palette = ['#c9772f', '#a4552a', '#d9a441'];
      for (let u = zone.start; u < zone.end; u += 0.37) if (hash(u, 5) < season.leaves * 0.8) {
        ctx.fillStyle = palette[Math.floor(hash(u, 6) * 3)];
        ctx.beginPath(); ctx.ellipse(worldX(u), top + 3 + hash(u, 7) * (curbY - top), 3, 1.6, hash(u, 8) * 3, 0, Math.PI * 2); ctx.fill();
      }
    }
    if (season.snow > 0.02) {
      ctx.globalAlpha = Math.min(1, season.snow);
      ctx.fillStyle = '#f4f7f8';
      ctx.fillRect(left, curbY - 2, width + 1, curbH * 0.6);
      for (let u = zone.start; u < zone.end; u += 0.55) {
        const w = ppu * (0.4 + hash(u, 9) * 0.9);
        ctx.beginPath(); ctx.ellipse(worldX(u), top + (curbY - top) * (0.2 + hash(u, 10) * 0.6), w / 2, (curbY - top) * 0.22, 0, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
    if (season.flowers > 0.05 && style.verge) {
      for (let u = zone.start; u < zone.end; u += 0.29) if (hash(u, 11) < season.flowers * 0.5) {
        ctx.fillStyle = ['#f2e36b', '#f7f4ef', '#d8505a'][Math.floor(hash(u, 12) * 3)];
        ctx.beginPath(); ctx.arc(worldX(u), curbY - 4 - hash(u, 13) * 3, 1.8, 0, Math.PI * 2); ctx.fill();
      }
    }
  }
  ctx.restore();
}

/** Position écran du bord gauche d'une sous-zone, continue autour de la caméra (raccord de la boucle compris). */
export function zoneScreenLeft(renderer, world, zone) {
  return renderer.metrics.anchorX + (ringDelta(renderer.cameraX, zone.center, world.length) - zone.width / 2) * renderer.metrics.pixelsPerUnit;
}
