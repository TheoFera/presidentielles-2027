import { ringDelta } from '../../simulation/world.js';
import { buildingLabel } from '../../simulation/building-rules.js';
import { formatEuros } from './money.js';
import { drawPlateWorld, plateSignFrame } from './carte-plate.js';

/**
 * Décor de la carte : la « carte plate », une fresque peinte d'un seul plan en 18 tuiles (carte-plate.js).
 * Tant qu'une tuile visible n'est pas chargée, le moteur garde son rendu de secours dessiné par le code (renderer.js).
 */
const imageWidth = image => image.naturalWidth || image.width;
const imageHeight = image => image.naturalHeight || image.height;

/* ---------- Préparation des images ---------- */

const cleaned = new WeakMap();
/** Retire le halo sombre semi-transparent des images générées (alpha faible → transparent, bords nets). */
export function cleanGeneratedImage(image) {
  if (cleaned.has(image)) return cleaned.get(image);
  const canvas = document.createElement('canvas'); canvas.width = imageWidth(image); canvas.height = imageHeight(image);
  const ctx = canvas.getContext('2d', { willReadFrequently: true }); ctx.drawImage(image, 0, 0);
  const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height), data = pixels.data;
  for (let i = 3; i < data.length; i += 4) data[i] = data[i] < 90 ? 0 : data[i] > 200 ? 255 : Math.round((data[i] - 90) / 110 * 255);
  ctx.putImageData(pixels, 0, 0);
  cleaned.set(image, canvas); return canvas;
}

/** Préparation au chargement (appelée par le moteur de rendu) : sprites des candidats sans styles. */
export function prepareGeneratedImage(image, id = '') {
  if (id.startsWith('minor-')) cleanGeneratedImage(image);
}

/* ---------- Dessin ---------- */

// Pas d'effet de saison à l'écran pour l'instant (choix du 09/10/2026) : les tuiles gardent leurs couleurs d'origine.
export function drawFixedWorld(renderer, state) {
  renderer.fixedWorldState = state;
  return drawPlateWorld(renderer, state);
}

/* ---------- Enseignes des bâtiments intégrés ---------- */

/** Rectangle écran de l'enseigne peinte d'un bâtiment, ou null. */
export function buildingSignFrame(renderer, building) {
  if (!renderer.fixedWorldActive || !renderer.fixedWorldState) return null;
  return plateSignFrame(renderer, building);
}

export function integratedBuildingGeometry(renderer, building) {
  const sign = buildingSignFrame(renderer, building);
  return sign && { w: sign.w, h: renderer.metrics.groundY - sign.y + sign.h / 2, top: sign.y - sign.h / 2 };
}

// Texte des enseignes gardé en petite image, à la netteté de l'écran : régler ctx.font et dessiner
// du texte à chaque image coûte cher sur téléphone. Refait seulement si le texte ou la taille change.
const signLabels = new Map();
const MAX_SIGN_LABELS = 64;
function signLabel(text, size, maxWidth, scale) {
  const key = `${text}|${size}|${Math.round(maxWidth)}|${scale}`;
  let label = signLabels.get(key);
  if (!label) {
    const canvas = document.createElement('canvas'), c = canvas.getContext('2d'), font = `800 ${size}px system-ui`;
    c.font = font;
    const width = Math.min(c.measureText(text).width, maxWidth) + 4, height = Math.ceil(size * 1.6);
    canvas.width = Math.max(1, Math.ceil(width * scale)); canvas.height = Math.max(1, Math.ceil(height * scale));
    c.scale(scale, scale); c.font = font; c.fillStyle = '#303c40'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText(text, width / 2, height / 2, maxWidth);
    label = { canvas, width: canvas.width / scale, height: canvas.height / scale };
    signLabels.set(key, label);
    if (signLabels.size > MAX_SIGN_LABELS) signLabels.delete(signLabels.keys().next().value);
  }
  return label;
}

/** La façade est peinte dans le décor. Seuls l'enseigne et le fanion sont dynamiques. */
export function drawIntegratedBuilding(renderer, state, building) {
  // Bâtiment loin de l'écran : rien à calculer (son enseigne reste dans sa tuile, à moins d'une tuile de lui).
  const screen = renderer.screenX(building.x);
  if (renderer.fixedWorldActive && (screen < -renderer.width || screen > 2 * renderer.width)) return true;
  const sign = buildingSignFrame(renderer, building);
  if (!sign) return false;
  const { ctx } = renderer, { x, y, w, h } = sign;
  if (x + w < 0 || x - w > renderer.width) return true;
  const faction = renderer.p.factions[building.owner_id];
  ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const label = building.headquarters ? 'QG · PERMANENCE' : buildingLabel(building).toUpperCase();
  // Enseigne déjà peinte sur la devanture : seul le texte est ajouté.
  if (!sign.painted) {
    ctx.fillStyle = '#f3e4c5'; ctx.fillRect(x - w / 2, y - h / 2, w, h);
    ctx.strokeStyle = '#3a3a33'; ctx.lineWidth = 1.5; ctx.strokeRect(x - w / 2, y - h / 2, w, h);
  }
  // Image du texte calée sur les pixels de l'écran, pour rester aussi nette qu'un texte dessiné directement.
  const transform = ctx.getTransform(), scale = transform.a;
  const text = signLabel(label, Math.round(Math.max(8, Math.min(13, h * 0.5)) * 10) / 10, w - 8, scale);
  const snap = (value, offset) => (Math.round(value * scale + offset) - offset) / scale;
  ctx.drawImage(text.canvas, snap(x - text.width / 2, transform.e), snap(y - text.height / 2, transform.f), text.width, text.height);
  if (faction) {
    ctx.fillStyle = faction.color; ctx.fillRect(x - w / 2, y + h / 2 - 3, w, 3);
    if (building.controls_zone) {
      ctx.strokeStyle = '#343d3b'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x + w / 2 + 4, y + h); ctx.lineTo(x + w / 2 + 4, y - 30); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x + w / 2 + 5, y - 30); ctx.lineTo(x + w / 2 + 27, y - 27 + Math.sin(state.tick / 12) * 2);
      ctx.lineTo(x + w / 2 + 25, y - 14); ctx.lineTo(x + w / 2 + 5, y - 17); ctx.closePath(); ctx.fill(); ctx.stroke();
    }
  }
  const candidate = state.candidates.find(c => c.id === state.local_candidate_id);
  const nearby = candidate && Math.abs(ringDelta(candidate.x, building.x, state.world.length)) < 3;
  if (nearby && building.owner_id === candidate.faction_id && building.type === 'permanence') {
    ctx.fillStyle = '#263b35'; ctx.fillRect(x - w / 2, y + h / 2 + 5, w, 19);
    ctx.fillStyle = '#ffedba'; ctx.font = '700 10px system-ui'; ctx.fillText(`Cagnotte : ${formatEuros(building.stored_money_cents)}`, x, y + h / 2 + 15, w - 4);
  }
  ctx.restore(); return true;
}

export function drawRallyAccessories(renderer, entity, x, feetY, height, state) {
  if (!entity.rally_event_id || entity.rally_index % 5) return;
  const { ctx } = renderer;
  const event = state.campaign_events.find(e => e.id === entity.rally_event_id);
  const text = { paris_19e: 'ENSEMBLE', banlieue: 'JUSTICE', periurbain_usine: 'EMPLOIS', campagne: 'NOS FERMES', retraites: 'HOMMAGE', quartiers_riches: 'SOLIDARITÉ' }[event?.target_biome_id] || 'ENSEMBLE';
  const y = feetY - height * 1.2 + Math.sin(state.tick / 8 + entity.rally_index) * 2;
  ctx.save(); ctx.strokeStyle = '#60442a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x - 14, feetY - height * 0.5); ctx.lineTo(x - 14, y); ctx.stroke();
  ctx.fillStyle = '#ecd3a2'; ctx.strokeStyle = '#473e31'; ctx.fillRect(x - 46, y - 22, 64, 23); ctx.strokeRect(x - 46, y - 22, 64, 23);
  ctx.fillStyle = '#343b38'; ctx.font = '800 8px system-ui'; ctx.textAlign = 'center'; ctx.fillText(text, x - 14, y - 7, 59); ctx.restore();
}
