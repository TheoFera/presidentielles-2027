import { loadConfig } from '../../config.js';
import { GameSimulation } from '../../simulation/game-simulation.js';
import { captureSite } from '../../simulation/strategic-sites.js';
import { WorldRenderer } from '../rendu/renderer.js';
import { visualManifest } from '../rendu/visual-manifest.js';
import { framePortrait } from '../menus/portrait-framing.js';
import { plateFeatureFrame } from '../carte/carte-plate.js';
import { formatEuros } from '../carte/money.js';

const descriptions = {
  original: 'Avant : petit fanion, soulignement coloré et rectangle sombre sous l’enseigne.',
  enseigne: '1 · Toute l’enseigne prend la couleur du candidat. La cagnotte devient une petite étiquette au-dessus, sur la façade.',
  affiches: '2 · Enseigne crème et deux affiches collées aux vitrines ou aux murs, sans couvrir la porte. Petite cagnotte sur la façade.',
  combine: '3 · Toute l’enseigne est colorée et une affiche est collée à la façade, hors de la porte. Cagnotte compacte au-dessus de l’enseigne.',
};
const canvas = document.querySelector('canvas'), description = document.querySelector('#description');
let style = 'enseigne', sim, building, moving = false;
const keys = new Set(), portraits = new Map();
const config = await loadConfig(), renderer = new WorldRenderer(canvas, config);
// L’atelier visite toutes les façades à la suite : conserver les images déjà comparées.
renderer.assets.limit = 220;
const siteSelect = document.querySelector('#site');
const initial = new GameSimulation(config, 42, 'candidate:melenchon');
const districtNames = { paris: 'Paris', banlieue: 'Banlieue', periurbain: 'Périurbain', campagne: 'Campagne', retraites: 'Retraités', riches: 'Riches' };
for (const site of initial.state.buildings.filter(b => b.type === 'permanence')) {
  const [district, letter] = site.subzone_id.split('_');
  siteSelect.add(new Option(`${districtNames[district] || district} ${letter.toUpperCase()}`, site.site_id));
}

// Les portraits existants du jeu sont réutilisés, cadrés comme dans le profil.
await Promise.all(['melenchon', 'le_pen', 'philippe'].map(async id => {
  const src = await framePortrait(visualManifest[`character-${id}`].file, id);
  const image = new Image(); image.src = src; await image.decode(); portraits.set(id, image);
}));

function reset() {
  const id = document.querySelector('#candidate').value;
  sim = new GameSimulation(config, 42, `candidate:${id}`);
  building = sim.state.buildings.find(b => b.site_id === siteSelect.value);
  const candidate = sim.state.candidates.find(c => c.id === sim.state.local_candidate_id);
  building.owner_id = null; captureSite(sim, building, candidate);
  building.stored_money_cents = Number(document.querySelector('#money').value);
  candidate.x = building.x; candidate.axis = 0;
  // Une scène arrêtée permet de comparer exactement les mêmes positions.
  sim.state.tick = 180; renderer.cameraX = null;
  description.textContent = descriptions[style];
}

// Repères propres à chaque façade, en pixels des tuiles : les moulures et les portes restent libres.
// Les enseignes couvrent tout l’intérieur crème, et pas seulement la largeur du texte.
const FACADES = {
  'site:paris_a': { sign: [1165, 764, 258, 44], posters: [[1110, 853, 66, 94], [1371, 853, 59, 84]] },
  'site:paris_c': { sign: [329, 764, 258, 44], posters: [[343, 839, 52, 74], [523, 839, 49, 70]] },
  'site:banlieue_b': { sign: [284, 715, 267, 32], posters: [[300, 794, 54, 77], [489, 794, 45, 64]] },
  'site:periurbain_a': { sign: [973, 764, 256, 44], posters: [[971, 838, 53, 76], [1170, 838, 35, 50]] },
  'site:periurbain_c': { sign: [811, 764, 256, 44], posters: [[802, 836, 48, 69], [1032, 836, 47, 67]] },
  'site:campagne_b': { sign: [293, 764, 257, 46], posters: [[309, 834, 49, 70], [487, 834, 48, 69]] },
  'site:retraites_a': { sign: [1130, 764, 256, 44], posters: [[1146, 839, 48, 69], [1320, 839, 48, 69]] },
  'site:retraites_c': { sign: [1187, 750, 191, 38], posters: [[1187, 874, 35, 50], [1341, 874, 35, 50]] },
  'site:riches_b': { sign: [151, 614, 355, 52], posters: [[167, 749, 60, 86], [452, 749, 30, 43]] },
};
const feature = ([x, y, w, h]) => ({ x, y, w, h });

function poster(ctx, frame, faction, portrait) {
  const { left: x, top: y, w, h } = frame;
  // Papier collé : aucun pied, ombre au sol ou chevalet en dehors du bâtiment.
  ctx.fillStyle = '#fff0cf'; ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = '#a39172'; ctx.lineWidth = .6; ctx.strokeRect(x, y, w, h);
  const inset = w * .045;
  ctx.fillStyle = faction.color; ctx.fillRect(x + inset, y + inset, w - inset * 2, h * .72);
  ctx.drawImage(portrait, x + inset, y + inset, w - inset * 2, w - inset * 2);
  ctx.fillStyle = '#34352d'; ctx.font = `800 ${w * .17}px system-ui`;
  ctx.fillText(faction.name.toUpperCase(), x + w / 2, y + h * .83, w - inset * 2);
  ctx.fillStyle = faction.color; ctx.fillRect(x + inset, y + h * .93, w - inset * 2, h * .025);
}

renderer.buildingAppearancePreview = (r, state, b, originalSign, faction) => {
  if (style === 'original' || b.type !== 'permanence' || !faction) return false;
  const facade = FACADES[b.site_id];
  if (!facade) return false;
  const frame = plateFeatureFrame(r, b, feature(facade.sign));
  if (!frame) return false;
  const { ctx } = r, { left, top, w, h } = frame, x = left + w / 2, y = top + h / 2;
  ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const colored = style !== 'affiches';
  // Remplir exactement la surface peinte ; ne pas ajouter un second cadre devant ses moulures.
  ctx.fillStyle = colored ? faction.color : '#f3e4c5'; ctx.fillRect(left, top, w, h);
  // Même en jaune ou en bleu clair, le texte garde un contraste lisible.
  const rgb = faction.color.match(/[a-f\d]{2}/gi).map(part => parseInt(part, 16));
  const light = rgb[0] * .299 + rgb[1] * .587 + rgb[2] * .114 > 146;
  ctx.fillStyle = colored && !light ? '#fff9eb' : '#30352e';
  ctx.font = `800 ${Math.max(8, Math.min(13, h * .5))}px system-ui`;
  ctx.fillText(b.headquarters ? 'QG · PERMANENCE' : 'PERMANENCE', x, y, w - 8);
  if (style !== 'enseigne') {
    const spots = style === 'affiches' ? facade.posters : facade.posters.slice(0, 1);
    for (const spot of spots) poster(ctx, plateFeatureFrame(r, b, feature(spot)), faction, portraits.get(b.owner_id));
  }
  const candidate = state.candidates.find(c => c.id === state.local_candidate_id);
  if (b.owner_id === candidate.faction_id && Math.abs(candidate.x - b.x) < 3) {
    // Petite étiquette sur le bâtiment, juste au-dessus de l’enseigne et sous les commandes d’impression.
    const [sx, sy, sw] = facade.sign;
    const cash = plateFeatureFrame(r, b, { x: sx + sw / 2 - 76, y: sy - 27, w: 152, h: 23 });
    const cx = cash.left + cash.w / 2, cy = cash.top + cash.h / 2;
    ctx.fillStyle = style === 'affiches' ? '#fff3c8' : '#f3e4c5';
    ctx.fillRect(cash.left, cash.top, cash.w, cash.h);
    ctx.strokeStyle = '#827255'; ctx.lineWidth = .7;
    ctx.strokeRect(cash.left, cash.top, cash.w, cash.h);
    ctx.fillStyle = '#373b31'; ctx.font = `700 ${cash.h * .6}px system-ui`;
    ctx.fillText(`Cagnotte · ${formatEuros(b.stored_money_cents)}`, cx, cy, cash.w - 5);
  }
  ctx.restore(); return true;
};

document.querySelectorAll('[data-style]').forEach(button => button.addEventListener('click', () => {
  style = button.dataset.style;
  document.querySelectorAll('[data-style]').forEach(b => b.setAttribute('aria-pressed', String(b === button)));
  description.textContent = descriptions[style];
}));
for (const select of document.querySelectorAll('select')) select.addEventListener('change', reset);
document.querySelector('#move').addEventListener('click', () => { moving = !moving; document.querySelector('#move').textContent = moving ? 'Figer la scène' : 'Se déplacer dans la scène'; canvas.focus(); });
window.addEventListener('keydown', event => { if (event.target.matches('select,button')) return; if (['ArrowLeft', 'ArrowRight'].includes(event.key)) { event.preventDefault(); keys.add(event.key); } });
window.addEventListener('keyup', event => keys.delete(event.key));
window.addEventListener('blur', () => keys.clear());
reset();
let last = performance.now();
function draw(now) {
  const elapsed = Math.min(.05, (now - last) / 1000); last = now;
  const c = sim.state.candidates.find(c => c.id === sim.state.local_candidate_id);
  const axis = moving ? Number(keys.has('ArrowRight')) - Number(keys.has('ArrowLeft')) : 0;
  c.x = (c.x + axis * elapsed * 6 + sim.state.world.length) % sim.state.world.length;
  c.moving = !!axis; if (axis) c.facing = axis;
  renderer.draw(sim.state, sim.state, 1, elapsed);
  requestAnimationFrame(draw);
}
requestAnimationFrame(draw);
