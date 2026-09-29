import { ringDelta } from '../simulation/world.js';
import { buildingLabel } from '../simulation/building-rules.js';
import { seasonAt } from '../simulation/campaign-events.js';
import { formatEuros } from './money.js';
import { fixedWorldArt, PANORAMA_SCALE, V2_FACADES } from './fixed-world-data.js';
import { BIOME_ART, CANVAS, FARS, LAYERS, LAYER_BASELINE, MIDDLES, STREETS, STREET_BASELINE, blockoutSiteTargets, signRect } from './world-v3/spec.js';
import { drawLayerBlockout, drawStreetBlockout } from './world-v3/blockout.js';
import { CALIBRATION } from './world-v3/calibration.js';
import { drawStreetGround, zoneScreenLeft } from './world-v3/ground.js';
import { drawFrontProps } from './world-v3/front.js';
import { distantJoin, drawIllustratedSky, landscapeJoin, scenerySeasonFilter } from './illustrated-world.js';
import { drawSeasonalTree } from './illustrated-vegetation.js';

/**
 * Décor de la carte fixe.
 * - Décor v3 en couches (lointain, intermédiaire, rue, avant-plan), sans aucun fondu : un biome l'utilise
 *   dès que ses trois rues sont calibrées, ou partout avec `?decor=maquette` (maquettes dessinées par le code).
 * - Sinon, panoramas v2 provisoires, coupés net à la limite du biome.
 */
export const DECOR_PREVIEW = typeof location !== 'undefined' && new URLSearchParams(location.search).get('decor') === 'maquette';
export const fixedPanoramaId = biome => `panorama-${fixedWorldArt[biome].art}`;

/** Avec `?decor=maquette`, les portes jouables suivent celles des maquettes (aperçu local uniquement). */
export function applyDecorPreview(config) {
  if (!DECOR_PREVIEW) return config;
  const targets = blockoutSiteTargets();
  for (const slot of config.layout.strategic_site_generation.slots) if (targets[slot.site_id]) slot.x_ratio = targets[slot.site_id].x_ratio;
  return config;
}
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

/** Préparation au chargement (appelée par le moteur de rendu). */
export function preparePanorama(image, id = '') {
  if (/^(v3|financier|minor)-/.test(id)) cleanGeneratedImage(image);
}

const snowCaps = new WeakMap();
/** Neige sur les arêtes supérieures (toits, auvents, murets), calculée une seule fois par image. */
function snowCap(image) {
  if (snowCaps.has(image)) return snowCaps.get(image);
  const w = imageWidth(image), h = imageHeight(image);
  const source = document.createElement('canvas'); source.width = w; source.height = h;
  const sctx = source.getContext('2d', { willReadFrequently: true }); sctx.drawImage(image, 0, 0);
  const alpha = sctx.getImageData(0, 0, w, h).data;
  const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d'); ctx.fillStyle = '#f5f8fa';
  const depth = Math.max(4, Math.round(h / 160));
  for (let x = 0; x < w; x += 2) for (let y = 1; y < h; y++) {
    if (alpha[(y * w + x) * 4 + 3] > 150 && alpha[((y - 1) * w + x) * 4 + 3] < 40) ctx.fillRect(x, y, 2, depth + ((x * 7) % 3));
  }
  snowCaps.set(image, canvas); return canvas;
}
function winterAmount(progress) {
  const { index, blend } = seasonAt(progress || 0);
  return index === 1 ? Math.max(0, blend - 0.7) / 0.3 : index === 2 ? 1 - Math.max(0, blend - 0.8) / 0.2 : 0;
}

/* ---------- Sources des couches ---------- */

const blockouts = new Map();
function blockoutCanvas(layer, id) {
  const key = `${layer}:${id}`;
  if (!blockouts.has(key)) {
    const canvas = document.createElement('canvas'); canvas.width = CANVAS.width; canvas.height = CANVAS.height;
    const ctx = canvas.getContext('2d');
    if (layer === 'street') drawStreetBlockout(ctx, STREETS[id]); else drawLayerBlockout(ctx, (layer === 'far' ? FARS : MIDDLES)[id], layer);
    blockouts.set(key, canvas);
  }
  return blockouts.get(key);
}
const specSigns = subzone => Object.fromEntries(STREETS[subzone].elements.filter(e => e.t === 'site').map(e => [e.site, signRect(e)]));

export function streetSource(renderer, subzoneId) {
  if (DECOR_PREVIEW) return { image: blockoutCanvas('street', subzoneId), baseline: STREET_BASELINE, signs: specSigns(subzoneId), topBand: STREETS[subzoneId].extendsAbove ? 120 : 0 };
  const entry = CALIBRATION.street[subzoneId], image = entry && renderer.assets.get(`v3-street-${subzoneId}`);
  return image ? { image: cleanGeneratedImage(image), baseline: entry.baseline, signs: entry.signs, topBand: entry.top_band || 0 } : null;
}
function layerSource(renderer, layer, biomeId) {
  if (DECOR_PREVIEW) return { image: blockoutCanvas(layer, biomeId), baseline: LAYER_BASELINE };
  const entry = CALIBRATION[layer][biomeId], image = entry && renderer.assets.get(`v3-${layer}-${biomeId}`);
  if (image) return { image: cleanGeneratedImage(image), baseline: entry.baseline };
  // Repli : anciens fonds de parallaxe (même style, contenu jusqu'en bas de l'image).
  const legacy = renderer.assets.get(`${layer === 'far' ? 'distant' : 'landscape'}-${BIOME_ART[biomeId]}`);
  return legacy ? { image: legacy, baseline: imageHeight(legacy) - 2, legacy: true } : null;
}

/** Biomes dont les trois rues v3 sont disponibles. */
export function layeredBiomes(renderer, world) {
  const ids = new Set();
  for (const biome of new Set(world.subzones.map(z => z.biome_id)))
    if (world.subzones.filter(z => z.biome_id === biome).every(z => streetSource(renderer, z.id))) ids.add(biome);
  return ids;
}

/** Identifiants d'images à garder chargées pour le décor v3. */
export function v3AssetIds() {
  if (DECOR_PREVIEW) return [];
  const ids = [];
  for (const [layer, entries] of Object.entries(CALIBRATION)) for (const id of Object.keys(entries)) ids.push(`v3-${layer}-${id}`);
  const calibratedBiomes = new Set(Object.keys(CALIBRATION.street).map(id => STREETS[id]?.biome));
  if (calibratedBiomes.size) for (const [biome, art] of Object.entries(BIOME_ART)) {
    if (!CALIBRATION.far[biome]) ids.push(`distant-${art}`);
    if (!CALIBRATION.middle[biome]) ids.push(`landscape-${art}`);
  }
  return ids;
}

/* ---------- Géométrie (fonctions pures, testées) ---------- */

/** Cadre écran d'une rue : largeur = sous-zone, même échelle en largeur et en hauteur. */
export function streetFrame(metrics, screenHeight, left, zone, source) {
  const width = zone.width * metrics.pixelsPerUnit, k = width / imageWidth(source.image);
  const baseY = metrics.groundY - LAYERS.street.base * screenHeight;
  return { left, width, k, baseY, top: baseY - source.baseline * k, height: imageHeight(source.image) * k };
}

/** Cadre écran d'un plan de parallaxe : un biome entier, centré selon la vitesse du plan. */
export function layerFrame(metrics, screenHeight, cameraX, world, biome, layer, source) {
  const speed = LAYERS[layer].parallax, width = biome.width * metrics.pixelsPerUnit * speed, k = width / imageWidth(source.image);
  const center = metrics.anchorX + ringDelta(cameraX, biome.center, world.length) * metrics.pixelsPerUnit * speed;
  const baseY = metrics.groundY - LAYERS[layer].base * screenHeight;
  return { left: center - width / 2, width, k, baseY, top: baseY - source.baseline * k, height: imageHeight(source.image) * k, center };
}

const biomeCache = new WeakMap();
export function worldBiomes(world) {
  if (biomeCache.has(world)) return biomeCache.get(world);
  const biomes = [...new Set(world.subzones.map(z => z.biome_id))].map(id => {
    const zones = world.subzones.filter(z => z.biome_id === id);
    const width = zones.reduce((sum, z) => sum + z.width, 0);
    return { id, zones, start: zones[0].start, width, center: zones[0].start + width / 2 };
  });
  biomeCache.set(world, biomes); return biomes;
}

/** Panoramas v2 : une seule échelle pour les deux axes, quelle que soit la résolution de l'écran. */
export function panoramaFrame(renderer, world, biomeId, image = null) {
  const zone = world.subzones.find(z => z.biome_id === biomeId);
  const art = fixedWorldArt[biomeId];
  const span = world.subzones.filter(z => z.biome_id === biomeId).reduce((sum, z) => sum + z.width, 0);
  const nominalWidth = span * renderer.metrics.pixelsPerUnit;
  const width = nominalWidth * PANORAMA_SCALE;
  const height = image ? width * image.naturalHeight / image.naturalWidth : width / art.aspect;
  const center = renderer.metrics.anchorX + ringDelta(renderer.cameraX, zone.start + span / 2, world.length) * renderer.metrics.pixelsPerUnit;
  return { left: center - width / 2, top: renderer.metrics.groundY - height * art.baseline,
    width, height, center, nominalWidth, biomeId };
}

/* ---------- Dessin ---------- */

function seasonFilter(progress, strength) {
  const full = scenerySeasonFilter(progress);
  if (strength >= 1) return full;
  // Filtre atténué pour la rue : même saison, couleurs moins altérées.
  return full.replace(/(saturate|sepia|brightness)\(([\d.]+)\)/g, (_, name, value) => {
    const neutral = name === 'sepia' ? 0 : 1; return `${name}(${(neutral + (Number(value) - neutral) * strength).toFixed(3)})`;
  });
}

const mixColor = (a, b) => '#' + [1, 3, 5].map(i => Math.round((parseInt(a.slice(i, i + 2), 16) + parseInt(b.slice(i, i + 2), 16)) / 2).toString(16).padStart(2, '0')).join('');

/**
 * Plan de parallaxe : sol dessiné par le jeu (continu, sa couleur évolue d'un biome à l'autre comme un terrain),
 * puis les images, dont les reliefs redescendent au sol avant leurs bords : aucune coupure verticale.
 */
function drawParallaxLayer(renderer, state, layer) {
  const { ctx, metrics: m } = renderer, view = renderer.visibleWorld || { left: 0, right: renderer.width };
  const progress = state.campaign_progress_01, snow = winterAmount(progress);
  const biomes = worldBiomes(state.world), specs = layer === 'far' ? FARS : MIDDLES;
  ctx.save(); ctx.filter = seasonFilter(progress, layer === 'far' ? 1 : 0.8);
  const frames = biomes.map((biome, index) => {
    const source = layerSource(renderer, layer, biome.id);
    return source && { biome, index, source, ...layerFrame(m, renderer.height, renderer.cameraX, state.world, biome, layer, source) };
  }).filter(frame => frame && frame.left < view.right + 2 && frame.left + frame.width > view.left - 2);
  for (const frame of frames) {
    const own = specs[frame.biome.id].ground, count = biomes.length;
    const previous = specs[biomes[(frame.index + count - 1) % count].id].ground, next = specs[biomes[(frame.index + 1) % count].id].ground;
    const gradient = ctx.createLinearGradient(frame.left, 0, frame.left + frame.width, 0);
    gradient.addColorStop(0, mixColor(previous, own)); gradient.addColorStop(0.15, own); gradient.addColorStop(0.85, own); gradient.addColorStop(1, mixColor(own, next));
    ctx.fillStyle = gradient; ctx.fillRect(frame.left - 0.5, frame.baseY - 1, frame.width + 1, m.groundY - frame.baseY + 2);
  }
  for (const frame of frames) {
    const { source } = frame, iw = imageWidth(source.image);
    if (source.legacy) {
      // Anciens fonds : contour découpé en feuillage, qui s'emboîte avec le voisin (léger chevauchement opaque).
      const joined = layer === 'far' ? distantJoin(source.image) : landscapeJoin(source.image), overlap = layer === 'far' ? 18 : 40;
      const k = (frame.width + overlap * 2) / iw; // même échelle sur les deux axes
      ctx.drawImage(joined, 0, 0, iw, source.baseline, frame.left - overlap, frame.baseY - source.baseline * k, frame.width + overlap * 2, source.baseline * k);
      continue;
    }
    ctx.drawImage(source.image, 0, 0, iw, source.baseline, frame.left, frame.top, frame.width, source.baseline * frame.k);
    if (snow > 0.02) { ctx.globalAlpha = snow; ctx.drawImage(snowCap(source.image), 0, 0, iw, source.baseline, frame.left, frame.top, frame.width, source.baseline * frame.k); ctx.globalAlpha = 1; }
  }
  ctx.restore();
}

function visibleZones(renderer, world) {
  const view = renderer.visibleWorld || { left: 0, right: renderer.width };
  return world.subzones.map(zone => ({ zone, left: zoneScreenLeft(renderer, world, zone) }))
    .filter(({ zone, left }) => left < view.right + 4 && left + zone.width * renderer.metrics.pixelsPerUnit > view.left - 4);
}

function drawStreets(renderer, state, zones) {
  const { ctx, metrics: m } = renderer, progress = state.campaign_progress_01, snow = winterAmount(progress);
  const viewTop = renderer.metrics.groundY - renderer.metrics.groundY / (renderer.config.balance.camera.framing_zoom ?? 1) - 4;
  ctx.save(); ctx.filter = seasonFilter(progress, 0.45);
  for (const item of zones) {
    const frame = streetFrame(m, renderer.height, item.left, item.zone, item.source), image = item.source.image;
    const iw = imageWidth(image), ih = imageHeight(image);
    // Les tours géantes sortent du cadre : leur bande supérieure se répète jusqu'au haut de l'écran.
    if (item.source.topBand) {
      const bandH = item.source.topBand * frame.k;
      for (let y = frame.top - bandH; y + bandH > viewTop; y -= bandH) ctx.drawImage(image, 0, 0, iw, item.source.topBand, frame.left, y, frame.width, bandH + 1);
    }
    ctx.drawImage(image, 0, 0, iw, Math.min(ih, item.source.baseline + 2), frame.left, frame.top, frame.width, Math.min(ih, item.source.baseline + 2) * frame.k);
    if (snow > 0.02) { ctx.globalAlpha = snow; ctx.drawImage(snowCap(image), 0, 0, iw, item.source.baseline, frame.left, frame.top, frame.width, item.source.baseline * frame.k); ctx.globalAlpha = 1; }
  }
  ctx.restore();
}

/** Arbres saisonniers de la rue (positions de la maquette) et bosquet à chaque limite de sous-zone. */
function drawStreetTrees(renderer, state, zones) {
  const { ctx, metrics: m } = renderer, progress = state.campaign_progress_01;
  const baseY = m.groundY - LAYERS.street.base * renderer.height;
  const tree = (x, height, shape, seed) => {
    const canopy = renderer.assets.get(`vegetation-${shape}`) || renderer.assets.get('vegetation-0');
    drawSeasonalTree(ctx, x, baseY + 2, height, shape, progress, seed, canopy);
  };
  for (const { zone, left } of zones) {
    const k = zone.width * m.pixelsPerUnit / CANVAS.width;
    for (const element of STREETS[zone.id].elements) if (element.t === 'arbre') tree(left + element.x * k, element.h * k * 1.15, element.shape, zone.index * 13 + element.x);
    tree(left - 4, 150 * k, zone.biome_id === 'campagne' ? 3 : 2, zone.index + 31);
    tree(left + 26 * k, 70 * k, 4, zone.index + 47);
  }
}

function drawV2Panoramas(renderer, state, biomes) {
  const { ctx, metrics: m } = renderer, view = renderer.visibleWorld || { left: 0, right: renderer.width };
  for (const biome of biomes) {
    const image = renderer.assets.get(fixedPanoramaId(biome.id));
    const frame = panoramaFrame(renderer, state.world, biome.id, image);
    const clipLeft = frame.center - frame.nominalWidth / 2;
    if (clipLeft > view.right || clipLeft + frame.nominalWidth < view.left) continue;
    // Coupe nette à la limite du biome : chaque biome garde toute sa largeur, sans fondu.
    ctx.save(); ctx.beginPath(); ctx.rect(clipLeft, -renderer.height, frame.nominalWidth, m.groundY + renderer.height + 1); ctx.clip();
    ctx.drawImage(image, frame.left, frame.top, frame.width, frame.height);
    ctx.restore();
  }
}

export function drawFixedWorld(renderer, state) {
  const world = state.world, biomes = worldBiomes(world);
  const layered = DECOR_PREVIEW ? new Set(biomes.map(b => b.id)) : layeredBiomes(renderer, world);
  const flat = biomes.filter(b => !layered.has(b.id));
  if (flat.some(b => !renderer.assets.get(fixedPanoramaId(b.id)))) return false;
  const { ctx } = renderer;
  renderer.fixedWorldLayered = layered; renderer.fixedWorldState = state;
  ctx.save(); ctx.imageSmoothingEnabled = true;
  drawIllustratedSky(renderer, state);
  const zones = visibleZones(renderer, world);
  const layeredZones = zones.filter(z => layered.has(z.zone.biome_id)).map(z => ({ ...z, source: streetSource(renderer, z.zone.id) }));
  if (layeredZones.length) { drawParallaxLayer(renderer, state, 'far'); drawParallaxLayer(renderer, state, 'middle'); }
  drawV2Panoramas(renderer, state, flat);
  drawStreets(renderer, state, layeredZones);
  const backY = renderer.metrics.groundY - LAYERS.street.base * renderer.height;
  drawStreetGround(renderer, state, zones.map(z => ({ ...z, layered: layered.has(z.zone.biome_id), backY })));
  drawStreetTrees(renderer, state, layeredZones);
  ctx.restore(); return true;
}

/** Avant-plan : appelé après les personnages. */
export function drawFixedWorldFront(renderer, state) {
  if (renderer.fixedWorldActive && renderer.fixedWorldLayered?.size) drawFrontProps(renderer, state);
}

/* ---------- Enseignes des bâtiments intégrés ---------- */

/** Rectangle écran de l'enseigne peinte d'un bâtiment, ou null. */
export function buildingSignFrame(renderer, building) {
  const state = renderer.fixedWorldState;
  if (!renderer.fixedWorldActive || !state) return null;
  const zone = state.world.subzones.find(z => z.id === building.subzone_id);
  if (renderer.fixedWorldLayered?.has(zone.biome_id)) {
    const source = streetSource(renderer, zone.id), rect = source?.signs[building.site_id];
    if (!rect) return null;
    const frame = streetFrame(renderer.metrics, renderer.height, zoneScreenLeft(renderer, state.world, zone), zone, source);
    const [x, y, w, h] = rect;
    return { x: frame.left + (x + w / 2) * frame.k, y: frame.top + (y + h / 2) * frame.k, w: w * frame.k, h: h * frame.k };
  }
  const facade = V2_FACADES[building.site_id], image = renderer.assets.get(fixedPanoramaId(zone.biome_id));
  if (!facade || !image) return null;
  const frame = panoramaFrame(renderer, state.world, zone.biome_id, image);
  const [, sx, sy, sw, sh] = facade;
  return { x: frame.left + sx * frame.width, y: frame.top + sy * frame.height, w: sw * frame.width, h: sh * frame.height };
}

export function integratedBuildingGeometry(renderer, building) {
  const sign = buildingSignFrame(renderer, building);
  return sign && { w: sign.w, h: renderer.metrics.groundY - sign.y + sign.h / 2, top: sign.y - sign.h / 2 };
}

/** La façade est peinte dans le décor. Seuls l'enseigne et le fanion sont dynamiques. */
export function drawIntegratedBuilding(renderer, state, building) {
  const sign = buildingSignFrame(renderer, building);
  if (!sign) return false;
  const { ctx } = renderer, { x, y, w, h } = sign;
  if (x + w < 0 || x - w > renderer.width) return true;
  const faction = renderer.p.factions[building.owner_id];
  ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const label = building.headquarters ? 'QG · PERMANENCE' : buildingLabel(building).toUpperCase();
  ctx.fillStyle = '#f3e4c5'; ctx.fillRect(x - w / 2, y - h / 2, w, h);
  ctx.strokeStyle = '#3a3a33'; ctx.lineWidth = 1.5; ctx.strokeRect(x - w / 2, y - h / 2, w, h);
  ctx.fillStyle = '#303c40'; ctx.font = `800 ${Math.max(8, Math.min(13, h * 0.5))}px system-ui`;
  ctx.fillText(label, x, y, w - 8);
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
