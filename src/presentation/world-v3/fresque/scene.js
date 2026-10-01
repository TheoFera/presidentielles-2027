import { envelope, fbm, massifPeaks, noise1, ridged } from './paysage.js';

/**
 * Composition de la fresque : toute la carte d'un seul tenant, en coordonnées du monde (unités de jeu ;
 * sous-zones de 24 unités, 0 = Paris A … 432 = retour à Paris A). Tout est dessiné par le code, dans un seul style.
 *
 * Fil sociologique, d'ouest en est : Paris dense et commerçant → porte de Paris et périphérique → cités dortoirs
 * sur leurs pelouses → pavillons fatigués et sortie de ville → lotissements, voitures et zones commerciales →
 * vallée industrielle au pied des Alpes → campagne agricole qui se vide → pavillons de retraités et front de mer →
 * banlieue bourgeoise → bois → beaux quartiers → start-up → retour au Paris bobo.
 *
 * Plans (`parallax` = vitesse relative ; `base` = hauteur de leur sol au-dessus des pieds ; `top` = hauteur utile ;
 * `scale` = taille apparente des objets ; `haze` = brume de perspective atmosphérique).
 */
export const PLANES = Object.freeze({
  horizon: { parallax: 0.2, base: 118, top: 340, scale: 1, haze: 0 },
  far: { parallax: 0.3, base: 92, top: 340, scale: 0.45, haze: 0.34 },
  mid: { parallax: 0.5, base: 58, top: 370, scale: 0.58, haze: 0.2 },
  back: { parallax: 0.72, base: 30, top: 390, scale: 0.7, haze: 0.1 },
  street: { parallax: 1, base: 12, top: 408, scale: 1, haze: 0 },
});
export const PLANE_ORDER = ['horizon', 'far', 'mid', 'back', 'street'];
export const HAZE = '#c9dae6';

/* ---------- Bâtiments du jeu ---------- */

/** Corps de bâtiment de chaque site (la devanture dépend du type de bâtiment du jeu). Largeur en unités. */
export const SITE_STYLES = {
  'site:paris_a': { style: 'haussmann', w: 5.3, floors: 2 },
  'site:paris_b': { style: 'faubourg', w: 4.6, floors: 2, color: '#e6d3b3' },
  'site:paris_c': { style: 'haussmann', w: 4.8, floors: 2, color: '#e8d6b4' },
  'site:paris_c:institut_sondage': { style: 'banlieue', w: 6.6, floors: 3, color: '#e4dccb', accent: '#8fb3c9' },
  'site:banlieue_a': { style: 'tour', w: 5.4, floors: 13, accent: '#c9826a' },
  'site:banlieue_b': { style: 'faubourg', w: 5, floors: 3, color: '#dccbad' },
  'site:banlieue_c': { style: 'brique', w: 4.4, floors: 1, roof: 'plat' },
  'site:periurbain_a': { style: 'crepi', w: 4.2 },
  'site:periurbain_b': { style: 'brique', w: 4.6, floors: 0, roof: 'plat' },
  'site:periurbain_c': { style: 'village', w: 4.4, floors: 1, color: '#e3d2b0' },
  'site:campagne_a': { style: 'grange', w: 4.8 },
  'site:campagne_b': { style: 'village', w: 4.2, floors: 1 },
  'site:campagne_c': { style: 'village', w: 3.8, floors: 0, color: '#d6c29a' },
  'site:retraites_a': { style: 'blanc', w: 4.4 },
  'site:retraites_b': { style: 'residence', w: 5, floors: 3 },
  'site:retraites_b:institut_sondage': { style: 'residence', w: 4.2, floors: 2, color: '#f3efe4' },
  'site:retraites_c': { style: 'meuliere', w: 4.6 },
  'site:riches_a': { style: 'rotonde', w: 5.4 },
  'site:riches_b': { style: 'cossu', w: 4.6, floors: 3 },
  'site:riches_c': { style: 'cossu', w: 4.6, floors: 2 },
  'site:riches_c:institut_sondage': { style: 'cossu', w: 4.2, floors: 3, color: '#efe4cc' },
};

/* ---------- Rue jouable ---------- */

/**
 * [début, fin, peintre, paramètres] ; fin = début pour un objet ponctuel (fontaine, voiture…, largeur propre).
 * Les bâtiments du jeu sont placés à part, à leur position réelle.
 */
const STREET = [
  // Paris A — la butte bobo : rue qui monte vers le Sacré-Cœur, café et concept store, grand escalier (rue de Crimée).
  [-0.3, 4, 'ruePerspective', { kind: 'montmartre' }],
  [4, 9.8, 'haussmann', { floors: 2, shops: ['cafe', 'concept'] }],
  [9.8, 13.5, 'ruePerspective', { kind: 'escalier' }],
  [18.85, 24.2, 'faubourg', { floors: 2, shops: ['librairie', 'epicerie'], color: '#e4c7a2' }],
  // Paris B — fromagerie, garage à vélos, place du marché sous la butte Montmartre, boulangerie et boucherie.
  [24.2, 27.25, 'faubourg', { floors: 2, shops: ['fromagerie'], color: '#efd9b5', shutter: '#4f6f5a' }],
  [31.85, 40.2, 'place', { paving: 'paves' }],
  [33.2, 38.8, 'marche', { seed: 3 }],
  [32.55, 32.55, 'fontaineWallace', {}],
  [40.2, 46.6, 'haussmann', { floors: 2, shops: ['boulangerie', 'boucherie'] }],
  // Canal : le quai ; l'eau, la passerelle des écluses et le métro aérien sont juste derrière.
  [46.6, 51.3, 'quai', {}],
  // Paris C — quartier mixte vers le périphérique : kebab et tabac, institut, immeuble moderne.
  [56.15, 62.3, 'faubourg', { floors: 3, shops: ['kebab', 'tabac'], color: '#d9c7a4' }],
  [69.15, 74.4, 'immeubleBanlieue', { floors: 3, shops: ['pharmacie'], color: '#d9c3a8', accent: '#c96f4a' }],
  // Banlieue A — cité dortoir : tours isolées sur leurs pelouses.
  [74.4, 78.3, 'pelouseCite', { path: 18 }],
  [76.3, 76.3, 'abribus', {}],
  [83.75, 86.2, 'pelouseCite', { bush: false }],
  [86.2, 91, 'tourCite', { floors: 14, accent: '#7fa3bf', stairAt: 0.3 }],
  [91, 93.7, 'pelouseCite', { path: 0 }],
  // Banlieue B — vieille rue commerçante de Saint-Denis, marché populaire devant la basilique.
  [93.7, 98.78, 'faubourg', { floors: 3, shops: ['boulangerie', 'primeur'], color: '#e3d3b6', shutter: '#8c9aa0' }],
  [103.78, 112.4, 'place', { paving: 'dalles', bancs: false }],
  [104.9, 111.1, 'marche', { seed: 7 }],
  [112.4, 116.4, 'faubourg', { floors: 4, shops: ['kebab', 'tabac'], color: '#d8c8ae', shutter: null }],
  [116.4, 120.6, 'ruePerspective', { kind: 'saintdenis' }],
  // Banlieue C — pavillons serrés et fatigués, local du service d'ordre, le kebab du coin.
  [120.6, 124.6, 'pavillonModeste', { floors: 1 }],
  [124.6, 128.2, 'pavillonModeste', { floors: 0, doorAt: 0.7 }],
  [132.7, 136.2, 'snackQuartier', {}],
  [136.2, 139.6, 'pavillonModeste', { floors: 1, doorAt: 0.25 }],
  // Sortie de ville — terrain vague, panneau publicitaire, camp de caravanes.
  [139.6, 141.6, 'terrainVague', {}],
  [140.6, 140.6, 'panneau4x3', {}],
  [141.6, 147.4, 'caravanes', {}],
  // Périurbain A — lotissement : maisons identiques en retrait de leur pelouse, jardin au barbecue, entrepôt géant derrière.
  [147.4, 153.5, 'maisonLotissement', {}],
  [153.5, 155.6, 'jardinLotissement', { items: [{ t: 'barbecue', at: 0.5 }] }],
  [159.9, 166, 'maisonLotissement', {}],
  // Périurbain B — maisons de brique, rond-point au premier plan, supermarché.
  [166, 170.5, 'maisonsBrique', { count: 2 }],
  [175.1, 184.4, 'rondPoint', {}],
  [184.4, 191, 'grandeSurface', { color: '#2f7fbf', logo: 'feuille' }],
  // Périurbain C — usine de vallée, prés et montbéliardes au pied des Alpes.
  [191, 196, 'usine', {}],
  [196, 201.4, 'pre', { cows: 2 }],
  [205.95, 214.5, 'pre', { cows: 3, bales: 0.86 }],
  // Campagne A — bocage, hangar, serres, grange-garage à scooters à l'entrée de la ferme.
  [214.5, 216.8, 'haieBocage', {}],
  [216.8, 223.8, 'hangar', {}],
  [223.8, 231.9, 'serres', {}],
  [236.85, 238.8, 'champ', {}],
  // Campagne B — le village : maison de pierre, place et monument aux morts, mairie, bar-tabac.
  [238.8, 243.18, 'maisonVillage', { vine: true, bench: true, seed: 4 }],
  [247.38, 256.6, 'place', { paving: 'gravier' }],
  [249.3, 249.3, 'monumentMorts', {}],
  [256.6, 262.1, 'mairie', {}],
  [262.1, 266.3, 'barTabac', {}],
  // Campagne C — presque rien : les blés, un calvaire, les poteaux, la haie ; le local du service d'ordre.
  [266.3, 270.7, 'champ', { calvaire: 0.5 }],
  [274.55, 283, 'champ', {}],
  [277.5, 277.5, 'poteauBois', {}],
  [281.8, 281.8, 'poteauBois', {}],
  [283, 285.4, 'haieBocage', {}],
  [285.4, 288.4, 'champ', {}],
  // Retraités A — pavillon impeccable, garage du quartier, boulodrome.
  [288.4, 293.4, 'pavillonImpeccable', { gnome: true }],
  [293.4, 297.8, 'garageQuartier', {}],
  [297.8, 301.45, 'boulodrome', {}],
  [305.95, 310.4, 'pavillonImpeccable', { floors: 1, doorAt: 0.35 }],
  // Retraités B — station balnéaire : villas, résidence, promenade ouverte sur la mer, glacier.
  [310.4, 314.15, 'villaBalneaire', { hortensias: false }],
  [319.2, 328.8, 'promenade', {}],
  [320.6, 320.6, 'glacier', {}],
  [328.8, 329.1, 'promenade', {}],
  [333.3, 337.65, 'jardinVilla', { h: 170, seed: 13 }],
  // Retraités C — banlieue bourgeoise : villas toutes différentes, en retrait dans des jardins arborés.
  [337.65, 338.9, 'jardinVilla', { h: 200, seed: 2 }],
  [338.9, 344.3, 'villaBourgeoise', { variant: 'tourelle', seed: 3 }],
  [344.3, 346.1, 'jardinVilla', { h: 260, seed: 5 }],
  [346.1, 349.6, 'villaBourgeoise', { variant: 'brique', seed: 7 }],
  [354.25, 359.4, 'villaBourgeoise', { variant: 'normande', seed: 9, gateAt: 0.3 }],
  // Bois → Riches A — lisière du bois, avenue cossue, rotonde de la radio nationale, hôtel particulier.
  [359.4, 366, 'lisiereBois', {}],
  [366, 370.3, 'haussmannCossu', { floors: 3 }],
  [375.8, 382.4, 'hotelParticulier', {}],
  // Riches B — boutiques de luxe, place du kiosque face à la tour Eiffel.
  [382.4, 386.98, 'haussmannCossu', { floors: 3, boutiques: ['mode'] }],
  [391.58, 400.4, 'place', { paving: 'dalles' }],
  [392.9, 392.9, 'kiosque', {}],
  [400.4, 405.4, 'haussmannCossu', { floors: 3, boutiques: ['bijoux', 'mode'] }],
  [405.4, 411.1, 'haussmannCossu', { floors: 3 }],
  // Riches C — Paris classique et start-up ; avenue qui file vers La Défense ; concept store vers Paris A.
  [415.75, 419.45, 'haussmannStartup', { floors: 3 }],
  [423.7, 428, 'ruePerspective', { kind: 'defense' }],
  [428, 431.7, 'faubourg', { floors: 2, shops: ['concept'], color: '#eac9b0' }],
];

/** Arbres de la rue : [x, essence, hauteur px]. Jamais devant une devanture du jeu ni devant une rue en perspective. */
const STREET_TREES = [
  [33.9, 'platane', 215], [39.9, 'platane', 205], [76.1, 'tilleul', 190], [85, 'tilleul', 200], [92.3, 'tilleul', 185],
  [140.4, 'peuplier', 200], [198.8, 'chene', 200], [209.2, 'chene', 215], [213.2, 'peuplier', 230], [215.6, 'chene', 205],
  [248, 'tilleul', 190], [255.8, 'tilleul', 185], [268.2, 'chene', 220], [284.3, 'chene', 210],
  [311.2, 'pin', 210], [336.9, 'pin', 200], [360.6, 'chene', 240], [363.3, 'chene', 250], [365.6, 'chene', 230], [399.9, 'platane', 215],
];

/* ---------- Plans du fond ---------- */

/**
 * [plan, peintre, x (monde), largeur (monde) ou null, paramètres]. Un élément lointain reste visible longtemps
 * (il défile lentement) : tours, montagnes et monuments sont placés pour n'apparaître que dans leur territoire.
 */
const BACKDROP = [
  // Fond proche : rue de derrière et monuments vus par les trouées
  ['back', 'faubourg', -4, 6, { floors: 3, rdc: 'none', rdcH: 110 }],
  ['back', 'haussmann', 3, 7, { floors: 3, rdc: 'none', rdcH: 110 }],
  ['back', 'faubourg', 10.5, 7, { floors: 2, rdc: 'none', rdcH: 110, color: '#e2c3a0' }],
  ['back', 'haussmann', 18, 7, { floors: 3, rdc: 'none', rdcH: 110 }],
  ['back', 'faubourg', 25.5, 6, { floors: 2, rdc: 'none', rdcH: 110, color: '#dcc9a8' }],
  ['back', 'lisiere', 36, 12, { h: 120, color: '#5f8a48', z: -1 }],
  ['back', 'faubourg', 43, 5, { floors: 2, rdc: 'none', rdcH: 110, color: '#e8c9a2' }],
  ['back', 'eau', 49.5, 12, { h: 16, quai: true, z: -3 }],
  ['back', 'passerelle', 48.2, 5, { h: 84, z: -1 }],
  ['back', 'metroAerien', 52, 22, { h: 170, train: true, trainX: -60 }],
  ['back', 'faubourg', 58, 7, { floors: 3, rdc: 'none', rdcH: 110, color: '#d6c6a8' }],
  ['back', 'periph', 74.5, 20, { h: 44 }],
  ['back', 'barre', 91, 9, { floors: 4 }],
  ['back', 'lisiere', 101, 5, { h: 110, color: '#5f8a48', z: -1 }],
  ['back', 'basilique', 108, null, { scale: 2.3 }],
  ['back', 'lisiere', 115, 5, { h: 100, color: '#5f8a48', z: -1 }],
  ['back', 'mosquee', 131, null, { scale: 2.5 }],
  ['back', 'entrepotGeant', 161, 28, { h: 160 }],
  ['back', 'zoneActivite', 182, 22, { seed: 5 }],
  ['back', 'lisiere', 203, 22, { h: 110, color: '#5a8a48' }],
  ['back', 'ferme', 229, 8, {}],
  ['back', 'maisonVillage', 240, 5, { seed: 21, closed: true }],
  ['back', 'eglise', 252, null, { z: 2 }],
  ['back', 'maisonVillage', 262, 5, { seed: 23 }],
  ['back', 'silo', 279, null, {}],
  ['back', 'pavillonImpeccable', 292, 5.5, { seed: 31, front: false }],
  ['back', 'pavillonImpeccable', 300, 5.5, { seed: 32, front: false, volets: '#6f9a7a' }],
  ['back', 'plage', 324, 34, { z: -3 }],
  ['back', 'lisiere', 348, 16, { h: 190, color: '#476f3a' }],
  ['back', 'eau', 362, 10, { h: 14, z: -3 }],
  ['back', 'lisiere', 362, 12, { h: 170, color: '#4f7a45', z: -2 }],
  ['back', 'haussmannCossu', 372, 7, { floors: 4 }],
  ['back', 'haussmannCossu', 380, 7, { floors: 4, seed: 7 }],
  ['back', 'haussmannCossu', 386.5, 6, { floors: 4, seed: 8 }],
  ['back', 'haussmannCossu', 405, 7, { floors: 4, seed: 9 }],
  ['back', 'haussmannCossu', 413, 7, { floors: 4, seed: 10 }],
  ['back', 'haussmann', 419, 6, { floors: 4, rdc: 'none', rdcH: 110 }],
  ['back', 'faubourg', 430, 5, { floors: 3, rdc: 'none', rdcH: 110, color: '#e8cdb0' }],
  // Plan intermédiaire
  ['mid', 'toitsParis', 6, 40, { seed: 2 }],
  ['mid', 'toitsParis', 56, 24, { seed: 6 }],
  ['mid', 'cite', 82, 20, { seed: 3 }],
  ['mid', 'cite', 127, 22, { seed: 4, low: true }],
  ['mid', 'chateauDeau', 150, null, {}],
  ['mid', 'lotissementLointain', 158, 24, { seed: 7 }],
  ['mid', 'villeUsines', 207, 16, { color: '#b3a79a' }],
  ['mid', 'lisiere', 226, 24, { h: 90, color: '#6a9150' }],
  ['mid', 'villagePerche', 258, 18, { h: 170 }],
  ['mid', 'lisiere', 280, 16, { h: 80, color: '#6a9150', cypress: true }],
  ['mid', 'lotissementLointain', 296, 22, { seed: 9, tuile: true }],
  ['mid', 'lisiere', 350, 18, { h: 170, color: '#557f45', cypress: true }],
  ['mid', 'lisiere', 366, 26, { h: 190, color: '#4a7a42' }],
  ['mid', 'toitsParis', 404, 64, { seed: 5 }],
  // Lointain
  ['far', 'toitsParis', 14, 110, { seed: 8 }],
  ['far', 'butteMontmartre', 34, 50, { h: 420 }],
  ['far', 'grandsMoulins', 70, null, { scale: 0.9 }],
  ['far', 'cite', 94, 34, { seed: 12 }],
  ['far', 'zoneActivite', 158, 30, { seed: 14 }],
  ['far', 'lignesHT', 176, 64, {}],
  ['far', 'villeUsines', 204, 20, { color: '#a99d90' }],
  ['far', 'villagePerche', 234, 16, { h: 200, hill: '#8fae68' }],
  ['far', 'eoliennes', 272, 14, { count: 4, h: 260 }],
  ['far', 'villagePerche', 288, 14, { h: 160, hill: '#98b270' }],
  ['far', 'phare', 330, null, { scale: 1.3 }],
  ['far', 'voilier', 317, null, { scale: 1.2, color: '#e8622c', dy: -18 }],
  ['far', 'voilier', 324.5, null, { scale: 1, color: '#3f7fbf', dy: -34 }],
  ['far', 'voilier', 337, null, { scale: 1.1, color: '#f2c14b', dy: -8 }],
  ['far', 'toitsParis', 400, 80, { seed: 15 }],
  ['far', 'grandPalais', 389, null, { scale: 1 }],
  ['far', 'tourEiffel', 396, null, { h: 520, color: '#7a6a58' }],
  ['far', 'domeDore', 405, null, { scale: 1.2 }],
  ['far', 'laDefense', 421, null, { w: 420, archeX: 30, z: -3 }],
];

/* ---------- Reliefs continus ---------- */

/** Horizon : collines bleutées partout, contreforts des Alpes, mer ouverte à Retraités B. */
export function horizonHeight(x) {
  const w = ((x % 432) + 432) % 432, sea = envelope(w, 296, 306, 346, 356);
  return (18 + 30 * fbm(w * 0.12, 3)) * (1 - sea) - sea * 260;
}
/** Hauts sommets : Mont-Blanc (dôme enneigé, le plus haut du jeu) flanqué d'aiguilles de granite. */
const spike = (w, c, h, half) => h * Math.max(0, 1 - Math.abs(w - c) / half) ** 1.4;
export function hautesAlpes(x) {
  const w = ((x % 432) + 432) % 432, e = envelope(w, 178, 196, 214, 236);
  const blanc = 110 * Math.exp(-(((w - 204) / 7) ** 2)) + 22 * Math.exp(-(((w - 204) / 2.6) ** 2)); // dôme large du Mont-Blanc
  return e * (105 + 70 * ridged(w * 0.075, 3, 3)) + blanc + spike(w, 198.6, 42, 2.4) + spike(w, 209.8, 46, 2) + spike(w, 212.6, 30, 2.2);
}
export function moyennesAlpes(x) {
  const w = ((x % 432) + 432) % 432; return envelope(w, 168, 186, 226, 248) * (70 + 58 * ridged(w * 0.1, 11, 3));
}
export function prealpes(x) {
  const w = ((x % 432) + 432) % 432; return envelope(w, 152, 172, 240, 264) * (30 + 34 * fbm(w * 0.16, 17, 3) + 10 * ridged(w * 0.2, 19, 2));
}

/** Sol du plan lointain : plat en ville, vallonné à la campagne, ouvert sur la mer. */
export function farHills(x) {
  const w = ((x % 432) + 432) % 432, sea = envelope(w, 300, 307, 341, 348), rural = envelope(w, 186, 214, 280, 298);
  return ((6 + 10 * noise1(w * 0.2, 13)) * (1 - rural) + rural * (34 + 64 * fbm(w * 0.16, 13))) * (1 - sea) - sea * 200;
}
function midHills(x) {
  const w = ((x % 432) + 432) % 432, sea = envelope(w, 302, 308, 340, 346), rural = envelope(w, 192, 212, 282, 296);
  return (4 + rural * (18 + 40 * fbm(w * 0.28, 21))) * (1 - sea) - sea * 200;
}
const SEA_HORIZON = 24;

/* ---------- Construction ---------- */

const cache = new WeakMap();
export function fresqueScene(world, buildings) {
  if (cache.has(world)) return cache.get(world);
  const planes = Object.fromEntries(PLANE_ORDER.map(id => [id, []]));
  const add = (plane, element) => planes[plane].push({ z: 0, ...element });
  const OPEN = ['place', 'pelouseCite', 'champ', 'pre', 'quai', 'promenade', 'lisiereBois', 'terrainVague', 'haie', 'haieBocage', 'jardinVilla'];
  STREET.forEach(([x0, x1, kind, p], i) => add('street', { kind, x: (x0 + x1) / 2, w: x1 > x0 ? x1 - x0 : null, p: { seed: i + 1, ...p }, z: OPEN.includes(kind) ? -1 : x1 > x0 ? 0 : 1 }));
  const sites = {};
  for (const building of buildings) {
    const style = SITE_STYLES[building.site_id];
    if (!style) continue;
    sites[building.site_id] = { x: building.x, ...style, type: building.type };
    add('street', { kind: 'site', x: building.x, w: style.w, p: { seed: Math.round(building.x * 7), ...style, type: building.type }, z: 0.5 });
  }
  BACKDROP.forEach(([plane, kind, x, w, p], i) => add(plane, { kind, x, w, p: { seed: 100 + i, ...p }, z: p.z ?? 0 }));
  add('horizon', { kind: 'sea', x: 326, w: 150, p: { horizon: SEA_HORIZON, x0: 251, x1: 401 }, z: -10 });
  add('horizon', { kind: 'terrain', x: 216, w: 440, p: { x0: -4, x1: 436, height: horizonHeight, color: '#a9bccb', top: '#9fb3c4', lineWidth: 0.8, ink: '#8aa0b2' }, z: -8.8 });
  // Massif alpin : trois chaînes, du fond (hauts sommets) vers l'avant (préalpes boisées).
  add('horizon', { kind: 'massif', x: 206, w: 150, p: { peaks: massifPeaks(206) }, z: -9.5 });
  add('horizon', { kind: 'chaine', x: 207, w: 112, p: { x0: 151, x1: 263, height: prealpes, color: '#93a99a', top: '#9fb3a4', dark: '#80978a', forest: '#6f8a79', ink: '#6f877a' }, z: -9 });
  add('far', { kind: 'terrain', x: 216, w: 440, p: { x0: -4, x1: 436, height: farHills, color: '#8aa58a', top: '#98b294', line: false, texture: 'champs', fields: ['#a9b87a', '#b9b27a', '#98b27a', '#c2b77f'] }, z: -9 });
  add('mid', { kind: 'terrain', x: 216, w: 440, p: { x0: -4, x1: 436, height: midHills, color: '#86a36e', line: false }, z: -9 });
  add('mid', { kind: 'terrain', x: 240, w: 110, p: { x0: 186, x1: 296, height: x => midHills(x) + 4, color: '#8fae5f', texture: 'bocage', line: false }, z: -8 });
  add('back', { kind: 'terrain', x: 216, w: 440, p: { x0: -4, x1: 436, height: x => (envelope(((x % 432) + 432) % 432, 303, 308, 340, 345) > 0 ? -200 : 4), color: '#8aa866', line: false }, z: -9 });
  add('back', { kind: 'terrain', x: 276, w: 24, p: { x0: 265, x1: 289, height: x => 12 + 3 * noise1(x, 6), color: '#d8bf62', texture: 'champs', fields: ['#e2c86a', '#d4b44f', '#e8d488', '#c9a94a'], line: false }, z: -4 });
  add('back', { kind: 'terrain', x: 225, w: 28, p: { x0: 211, x1: 239, height: x => 10 + 4 * noise1(x, 2), color: '#9cb25f', texture: 'champs', line: false }, z: -4 });
  for (const plane of PLANE_ORDER) planes[plane].sort((a, b) => a.z - b.z);
  const barbecues = planes.street.filter(e => e.kind === 'jardinLotissement').flatMap(e => (e.p.items || []).filter(i => i.t === 'barbecue').map(i => e.x - e.w / 2 + i.at * e.w));
  const trees = STREET_TREES.filter(([x]) => buildings.every(b => b.type === 'meeting' || Math.abs(b.x - x) >= 3.8)).map(([x, kind, h], i) => ({ x, kind, h, seed: i * 7 + 3 }));
  const scene = { planes, sites, trees, barbecues, length: world.length };
  cache.set(world, scene); return scene;
}

/** Matière du trottoir et de la chaussée selon la position (transitions douces aux frontières). */
export const GROUND_KEYS = [
  [0, 'paris'], [70, 'paris'], [76, 'banlieue'], [140, 'banlieue'], [146, 'periurbain'], [212, 'periurbain'], [218, 'campagne'],
  [283, 'campagne'], [289, 'retraites'], [312.5, 'retraites'], [314, 'mer'], [335.5, 'mer'], [337, 'retraites'], [357, 'retraites'], [363, 'riches'], [426, 'riches'], [432, 'paris'],
];
