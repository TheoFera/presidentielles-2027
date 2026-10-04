// Gabarits de la carte plate (sans parallaxe) : une image de 1 920 × 1 080 px par sous-zone.
// Ils tracent le sol, les portes et panneaux des bâtiments interactifs, la place de meeting,
// l'échelle des personnages et les zones de coupe, pour guider la peinture de la fresque.
// Usage : node scripts/fresque-plate-gabarits.mjs [dossier de sortie]
import { createRequire } from 'node:module';
import { mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);
const PLAYWRIGHT = 'C:/Users/ferat/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright';

export const TILE = { width: 1920, height: 1080, unit: 80 };
export const GROUND_Y = 1004, DOOR = { w: 96, h: 184 }, SIGN = { top: 764, bottom: 808, w: 258 };
export const SHOP_TOP = GROUND_Y - 256, FLOOR = 168, SKY_BAND = 64, SEAM = 128, CHARACTER = 162;
export const MEETING = { left: 672, right: 1248, stageLeft: 852, stageRight: 1068 };

const NAMES = {
  paris_a: 'Paris A', paris_b: 'Paris B', paris_c: 'Paris C', banlieue_a: 'Banlieue A', banlieue_b: 'Banlieue B', banlieue_c: 'Banlieue C',
  periurbain_a: 'Périurbain A', periurbain_b: 'Périurbain B', periurbain_c: 'Périurbain C', campagne_a: 'Campagne A', campagne_b: 'Campagne B',
  campagne_c: 'Campagne C', retraites_a: 'Retraités A', retraites_b: 'Retraités B', retraites_c: 'Retraités C', riches_a: 'Riches A',
  riches_b: 'Riches B', riches_c: 'Riches C',
};
const QG = { paris_a: 'Glucksmann', paris_c: 'Roussel', periurbain_a: 'Arthaud', periurbain_c: 'Dupont-Aignan', retraites_a: 'Retailleau', retraites_c: 'Attal' };
const TYPES = { permanence: 'Permanence', garage_velo: 'Garage à vélo', garage_scooter: 'Garage à scooter', tour_communication: 'Rédaction',
  institut_sondage: 'Institut de sondage', faction: 'Local du service d’ordre' };

/** Liste ordonnée des 18 tuiles, avec leurs bâtiments interactifs en pixels de tuile. */
export function plateTiles(layout) {
  const zones = layout.biomes.flatMap(biome => biome.subzones.map(zone => ({ id: zone.id, biome: biome.display_name })));
  const slots = layout.strategic_site_generation.slots;
  return zones.map((zone, index) => ({
    ...zone, index, number: String(index + 1).padStart(2, '0'), name: NAMES[zone.id] || zone.id,
    file: `tuile-${String(index + 1).padStart(2, '0')}-${zone.id.replace('_', '-')}.png`,
    masterLeft: index * TILE.width,
    meeting: slots.some(s => s.subzone_id === zone.id && s.type === 'meeting'),
    buildings: slots.filter(s => s.subzone_id === zone.id && s.type !== 'meeting').map(s => ({
      x: Math.round(s.x_ratio * TILE.width), ratio: s.x_ratio,
      label: s.type === 'faction' && zone.id === 'riches_c' ? 'Cabinet' : `${TYPES[s.type] || s.type}${s.type === 'permanence' && QG[zone.id] ? ` (QG ${QG[zone.id]})` : ''}`,
    })),
  }));
}

const fmt = n => n.toLocaleString('fr-FR');
const text = (x, y, s, size = 22, extra = '') => `<text x="${x}" y="${y}" font-size="${size}" stroke="#fff" stroke-width="4" paint-order="stroke" ${extra}>${s}</text>`;
const person = x => `<g fill="#3b3f46" opacity=".85"><circle cx="${x}" cy="${GROUND_Y - CHARACTER + 20}" r="20"/>`
  + `<rect x="${x - 24}" y="${GROUND_Y - CHARACTER + 42}" width="48" height="74" rx="16"/>`
  + `<rect x="${x - 20}" y="${GROUND_Y - 50}" width="16" height="50" rx="6"/><rect x="${x + 4}" y="${GROUND_Y - 50}" width="16" height="50" rx="6"/></g>`
  + `<line x1="${x + 36}" y1="${GROUND_Y - CHARACTER}" x2="${x + 36}" y2="${GROUND_Y}" stroke="#3b3f46" stroke-width="2"/>`
  + text(x + 42, GROUND_Y - CHARACTER + 16, 'personnage 162 px', 16, 'fill="#3b3f46"');

function tileSvg(tile, tiles) {
  const prev = tiles[(tile.index + 17) % 18], next = tiles[(tile.index + 1) % 18];
  const { width: W, height: H } = TILE, parts = [];
  parts.push(`<rect width="${W}" height="${H}" fill="#fff"/>`);
  parts.push(`<rect width="${W}" height="${SKY_BAND}" fill="#9FCFEE"/>`, text(W / 2, 42, 'Ciel uni #9FCFEE sur 64 px, puis dégradé jusqu’à #E4F1F6 à l’horizon', 24, 'text-anchor="middle" fill="#123"'));
  // Étages de référence
  for (const [y, label] of [[GROUND_Y - DOOR.h, 'haut de porte (184 px)'], [SHOP_TOP, 'haut du rez-de-chaussée commerçant (256 px)'],
    [SHOP_TOP - FLOOR, 'étage courant (+168 px)'], [SHOP_TOP - 2 * FLOOR, 'étage courant (+168 px)'], [SHOP_TOP - 3 * FLOOR, 'étage courant (+168 px)']])
    parts.push(`<line x1="0" x2="${W}" y1="${y}" y2="${y}" stroke="#9aa3ad" stroke-dasharray="6 10"/>`, text(W - 150, y - 6, label, 15, 'text-anchor="end" fill="#6b747d"'));
  // Zones de coupe
  parts.push(`<rect x="0" y="${SKY_BAND}" width="${SEAM}" height="${GROUND_Y - SKY_BAND}" fill="url(#hatch)"/>`,
    `<rect x="${W - SEAM}" y="${SKY_BAND}" width="${SEAM}" height="${GROUND_Y - SKY_BAND}" fill="url(#hatch)"/>`,
    text(SEAM / 2, 300, 'COUPE', 20, `text-anchor="middle" fill="#b85c00" font-weight="700" transform="rotate(-90 ${SEAM / 2} 300)"`),
    text(W - SEAM / 2, 300, 'COUPE', 20, `text-anchor="middle" fill="#b85c00" font-weight="700" transform="rotate(-90 ${W - SEAM / 2} 300)"`));
  // Place de meeting
  if (tile.meeting) parts.push(`<rect x="${MEETING.left}" y="${SKY_BAND}" width="${MEETING.right - MEETING.left}" height="${GROUND_Y - SKY_BAND}" fill="#2f9e5b" opacity=".12"/>`,
    `<rect x="${MEETING.left}" y="${SKY_BAND}" width="${MEETING.right - MEETING.left}" height="${GROUND_Y - SKY_BAND}" fill="none" stroke="#2f9e5b" stroke-width="3" stroke-dasharray="14 8"/>`,
    text(W / 2, 470, 'PLACE DE MEETING : rien de construit (x = 672 → 1 248)', 24, 'text-anchor="middle" fill="#1d6e3d" font-weight="700"'),
    text(W / 2, 502, 'paysage, monuments et fond en perspective autorisés au loin', 18, 'text-anchor="middle" fill="#1d6e3d"'),
    `<rect x="${MEETING.stageLeft}" y="${GROUND_Y - 64}" width="${MEETING.stageRight - MEETING.stageLeft}" height="64" fill="#c8a272" opacity=".5" stroke="#8a6a3e" stroke-width="2"/>`,
    text(W / 2, GROUND_Y - 26, 'estrade posée par le jeu (ne pas peindre)', 17, 'text-anchor="middle" fill="#5b4220"'));
  // Bâtiments interactifs
  const people = [];
  for (const b of tile.buildings) {
    const facade = 368;
    parts.push(`<rect x="${b.x - facade / 2}" y="${SHOP_TOP}" width="${facade}" height="${GROUND_Y - SHOP_TOP}" fill="none" stroke="#1f4e8c" stroke-width="2" stroke-dasharray="10 6"/>`,
      `<rect x="${b.x - SIGN.w / 2}" y="${SIGN.top}" width="${SIGN.w}" height="${SIGN.bottom - SIGN.top}" fill="#f3e4c5" stroke="#3a3a33" stroke-width="2"/>`,
      text(b.x, SIGN.top + 29, 'panneau crème vierge', 17, 'text-anchor="middle" fill="#3a3a33"'),
      `<rect x="${b.x - DOOR.w / 2}" y="${GROUND_Y - DOOR.h}" width="${DOOR.w}" height="${DOOR.h}" fill="#1f4e8c" opacity=".25" stroke="#1f4e8c" stroke-width="3"/>`,
      `<line x1="${b.x}" x2="${b.x}" y1="${SIGN.top - 70}" y2="${GROUND_Y}" stroke="#1f4e8c" stroke-width="1.5"/>`,
      text(b.x, SIGN.top - 78, `${b.label}`, 22, 'text-anchor="middle" fill="#1f4e8c" font-weight="700"'),
      text(b.x, SIGN.top - 52, `porte centrée à x = ${fmt(b.x)} px (${Math.round(b.ratio * 100)} %)`, 17, 'text-anchor="middle" fill="#1f4e8c"'));
    const free = x => x > SEAM + 40 && x < W - SEAM - 190 && !(tile.meeting && x > MEETING.left - 40 && x < MEETING.right + 40);
    const right = b.x + facade / 2 + 60, left = b.x - facade / 2 - 60;
    if (free(right)) people.push(right); else if (free(left)) people.push(left);
  }
  if (!people.length) people.push(tile.meeting ? 420 : 520);
  people.forEach(x => parts.push(person(x)));
  // Sol, trottoir et règle des unités
  parts.push(`<rect x="0" y="${GROUND_Y}" width="${W}" height="${H - GROUND_Y}" fill="#e7e2d8"/>`,
    `<line x1="0" x2="${W}" y1="${GROUND_Y}" y2="${GROUND_Y}" stroke="#d1242f" stroke-width="4"/>`,
    text(SEAM + 12, GROUND_Y + 66, 'LIGNE DE SOL y = 1 004 px (pieds des personnages et des façades)', 18, 'fill="#d1242f" font-weight="700"'),
    text(W - SEAM - 12, H - 10, 'trottoir et chaussée (76 px)', 17, 'text-anchor="end" fill="#6b6253"'));
  for (let u = 0; u <= 24; u++) {
    const x = u * TILE.unit, big = u % 4 === 0;
    parts.push(`<line x1="${x}" x2="${x}" y1="${GROUND_Y}" y2="${GROUND_Y + (big ? 26 : 12)}" stroke="#6b6253" stroke-width="${big ? 3 : 1.5}"/>`);
    if (big && u > 0 && u < 24) parts.push(text(x, GROUND_Y + 46, `${u} u`, 15, 'text-anchor="middle" fill="#6b6253"'));
  }
  // En-tête et voisins
  const header = `Tuile ${tile.number} / 18 — ${tile.name} (${tile.biome}) · fresque maître x = ${fmt(tile.masterLeft)} → ${fmt(tile.masterLeft + W)} px`;
  parts.push(`<rect x="${SEAM + 10}" y="${SKY_BAND + 12}" width="${W - 2 * SEAM - 20}" height="76" rx="8" fill="#fff" opacity=".92" stroke="#22262a"/>`,
    text(W / 2, SKY_BAND + 44, header, 26, 'text-anchor="middle" font-weight="700" fill="#22262a"'),
    text(W / 2, SKY_BAND + 74, `← se raccorde à la tuile ${prev.number} (${prev.name}) · se raccorde à la tuile ${next.number} (${next.name}) →`, 18, 'text-anchor="middle" fill="#444"'));
  if (tile.index % 3 === 2) parts.push(text(W - SEAM - 12, SKY_BAND + 116, `transition progressive vers ${next.biome} : elle commence dans cette tuile →`, 18, 'text-anchor="end" fill="#8a4b00" font-weight="700"'));
  if (tile.index % 3 === 0) parts.push(text(SEAM + 12, SKY_BAND + 116, `← fin de la transition depuis ${prev.biome}`, 18, 'fill="#8a4b00" font-weight="700"'));
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="Segoe UI, Arial, sans-serif">`
    + `<defs><pattern id="hatch" width="16" height="16" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="16" height="16" fill="#fff3e0"/><line x1="0" y1="0" x2="0" y2="16" stroke="#f0a050" stroke-width="5"/></pattern></defs>`
    + parts.join('') + '</svg>';
}

function overviewSvg(tiles) {
  const k = 0.1, W = 18 * TILE.width * k, H = 190, ground = 130;
  const parts = [`<rect width="${W}" height="${H}" fill="#fff"/>`, `<line x1="0" x2="${W}" y1="${ground}" y2="${ground}" stroke="#d1242f" stroke-width="2"/>`];
  tiles.forEach((t, i) => {
    const x = i * TILE.width * k;
    parts.push(`<line x1="${x}" x2="${x}" y1="20" y2="${H}" stroke="${i % 3 ? '#9aa3ad' : '#22262a'}" stroke-width="${i % 3 ? 1 : 3}"/>`,
      text(x + 96, 44, `${t.number} ${t.name}`, 15, 'text-anchor="middle" font-weight="700" fill="#22262a"'));
    if (t.meeting) parts.push(`<rect x="${x + MEETING.left * k}" y="60" width="${(MEETING.right - MEETING.left) * k}" height="${ground - 60}" fill="#2f9e5b" opacity=".25"/>`);
    t.buildings.forEach(b => parts.push(`<rect x="${x + b.x * k - 5}" y="${ground - 18}" width="10" height="18" fill="#1f4e8c"/>`));
  });
  parts.push(text(8, 16, 'Vue d’ensemble de la fresque maître (34 560 px, réduite à 10 %) : bleu = porte d’un bâtiment interactif, vert = place de meeting, rouge = sol', 14, 'fill="#22262a"'),
    text(8, H - 12, 'La boucle se ferme : le bord droit de la tuile 18 se raccorde au bord gauche de la tuile 01.', 14, 'fill="#8a4b00"'));
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="Segoe UI, Arial, sans-serif">${parts.join('')}</svg>`;
}

async function main() {
  const out = path.resolve(process.argv[2] || 'docs/production/decor-v3/carte-plate/gabarits');
  mkdirSync(out, { recursive: true });
  const layout = JSON.parse(readFileSync('Présidentielles 2027/world_layout.json', 'utf8'));
  const tiles = plateTiles(layout);
  const { chromium } = require(PLAYWRIGHT);
  const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  try {
    const page = await browser.newPage();
    const shoot = async (svg, w, h, file) => {
      await page.setViewportSize({ width: Math.round(w), height: h });
      await page.setContent(`<html><body style="margin:0">${svg}</body></html>`);
      await page.screenshot({ path: path.join(out, file), clip: { x: 0, y: 0, width: Math.round(w), height: h } });
    };
    for (const tile of tiles) await shoot(tileSvg(tile, tiles), TILE.width, TILE.height, tile.file);
    await shoot(overviewSvg(tiles), 18 * TILE.width * 0.1, 190, '00-vue-ensemble.png');
  } finally { await browser.close(); }
  console.log(`${tiles.length} gabarits et une vue d’ensemble enregistrés dans ${out}.`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) main().catch(error => { console.error(error); process.exitCode = 1; });
