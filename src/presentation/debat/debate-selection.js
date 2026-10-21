import { framePortrait } from '../menus/portrait-framing.js';
import { CANDIDATES, portrait } from '../menus/arcade-content.js';
import { MINOR_FACTIONS } from '../../simulation/world.js';
import { debateStyles, debateStyleAvailable } from '../../simulation/debate-mode.js';
import { minorStandingAtlases, MINOR_ANIMATION_FILES } from '../personnages/minor-animation-sprites.js';
import { MINOR_SPRITES } from '../personnages/minor-sprites.js';
import { prepareMinorFrames, preparedMinorFrames, prepareAtlasFrames } from '../personnages/minor-sprite-images.js';

const MINOR_NAMES = [
  ['Raphaël Glucksmann', 'Glucksmann'], ['Fabien Roussel', 'Roussel'], ['Nathalie Arthaud', 'Arthaud'],
  ['Nicolas Dupont-Aignan', 'Dupont-Aignan'], ['Bruno Retailleau', 'Retailleau'], ['Gabriel Attal', 'Attal'],
];
export const DEBATE_CANDIDATES = [...CANDIDATES, ...MINOR_FACTIONS.map((id, i) => ({ id, name: MINOR_NAMES[i][0], short: MINOR_NAMES[i][1], minor: true }))];
export const escape = text => String(text).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const portraits = new Map();
// Visage de la référence v6 conservé sur une pose immobile dédiée aux menus.
const ndaPortrait = new URL('../../../assets/images/candidats/dupont-aignan/dupont-aignan-portrait-repos-v1.png', import.meta.url).href;
const ndaPortraitAtlas = { frames: [[223, 64, 531, 1487]] };

/** Réutilise les silhouettes du jeu ; une seule découpe est conservée par candidat. */
export function selectionPortrait(faction) {
  if (!MINOR_FACTIONS.includes(faction)) return Promise.resolve(portrait({ id: faction }));
  if (!portraits.has(faction)) portraits.set(faction, (async () => {
    // En partie, la découpe est déjà prête (chargement) : sinon, une seule découpe pour ce portrait.
    // L'encodage en image se fait hors du fil du jeu (toBlob) : pas de gel quand un portrait apparaît.
    const standing = minorStandingAtlases[faction];
    const frame = faction === 'dupont_aignan'
      ? prepareAtlasFrames(await loadImage(ndaPortrait), ndaPortraitAtlas)[0]
      : standing
      ? prepareAtlasFrames(await loadImage(new URL(`../../../${MINOR_ANIMATION_FILES[faction].actions}`, import.meta.url).href), standing)[0]
      : (preparedMinorFrames(faction) || prepareMinorFrames(await loadImage(new URL(`../../../${MINOR_SPRITES[faction]}`, import.meta.url).href), faction))[0];
    // Les poses préparées peuvent déjà être des ImageBitmap, sans méthode toBlob.
    const canvas = document.createElement('canvas'); canvas.width = frame.width; canvas.height = frame.height;
    canvas.getContext('2d').drawImage(frame, 0, 0);
    const blob = await new Promise((resolve, reject) => canvas.toBlob(result => result ? resolve(result) : reject(new Error('Portrait indisponible.')), 'image/png'));
    return URL.createObjectURL(blob);
  })());
  return portraits.get(faction);
}
function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}
export function portraitContent(faction) {
  const candidate = DEBATE_CANDIDATES.find(c => c.id === faction);
  return candidate ? `<span class="select-portrait" data-portrait="${faction}">${candidate.minor ? '' : `<img src="${portrait(candidate)}" alt="">`}</span>` : '<span class="select-empty" aria-hidden="true">?</span>';
}
/** Gros plan d'une case (sélection, bandeau du débat), préparé une seule fois par candidat. */
export const selectionCloseup = faction => selectionPortrait(faction).then(src => framePortrait(src, faction));
export function hydrateSelectionPortraits(root) {
  root.querySelectorAll('[data-portrait]').forEach(element => {
    const closeup = Boolean(element.closest('.select-tile, .debate-fighter, .debate-ranking'));
    if (element.dataset.portraitReady || (!closeup && element.querySelector('img'))) return;
    element.dataset.portraitReady = 'true';
    if (closeup) element.dataset.closeup = '';
    void (closeup ? selectionCloseup(element.dataset.portrait) : selectionPortrait(element.dataset.portrait)).then(src => {
      const image = document.createElement('img'); image.src = src; image.alt = ''; element.replaceChildren(image);
    }).catch(() => { element.textContent = '?'; });
  });
}

/** La même grille de neuf portraits en solo et sur chaque appareil multijoueur. */
export function rosterContent(config, fighters, active, { disabled = false, unavailable = () => false } = {}) {
  return `<div class="select-roster" role="group" aria-label="Choix du candidat">${DEBATE_CANDIDATES.map(c => {
    const selected = fighters[active]?.faction === c.id;
    const markers = fighters.map((f, i) => f.faction === c.id ? `<span class="select-marker" style="--player-color:${PLAYER_COLORS[i]}">${f.badge || (i ? `IA ${i}` : 'J1')}</span>` : '').join('');
    // Candidat mineur verrouillé : il se débloque en le mettant K.-O. en campagne, puis en gagnant l’élection.
    const locked = c.minor && !disabled && unavailable(c.id);
    return `<button class="select-tile" data-faction="${c.id}" aria-label="${escape(c.name)}${locked ? ' · verrouillé' : ''}" ${locked ? 'title="Mettre KO en campagne et gagner l’élection pour débloquer"' : ''} aria-pressed="${selected}" ${disabled || unavailable(c.id) ? 'disabled' : ''} ${locked ? 'data-locked' : ''} style="--candidate-color:${config.prototype.presentation.factions[c.id].color}">${portraitContent(c.id)}<span class="select-markers" aria-hidden="true">${markers}</span>${locked ? '<span class="collection-lock" aria-hidden="true">🔒</span>' : ''}<strong>${escape(c.short)}</strong></button>`;
  }).join('')}</div>`;
}
export const PLAYER_COLORS = ['#69dcff', '#ff6685', '#f5d369'];
/** `styles` : sélecteur de style incrusté dans la carte, pour ne pas changer la hauteur de la console. */
export function fighterCardContent(config, fighter, index, { active = false, editable = false, styles = '' } = {}) {
  const candidate = DEBATE_CANDIDATES.find(c => c.id === fighter?.faction);
  const style = candidate && debateStyles(config, candidate.id).find(s => s.id === fighter.style);
  const label = fighter.label || fighter.badge || (index ? `IA ${index}` : 'J1 · Vous');
  return `<article class="select-fighter ${active ? 'active' : ''}" style="--player-color:${PLAYER_COLORS[index]};--candidate-color:${candidate ? config.prototype.presentation.factions[candidate.id].color : '#56708f'}">
    ${editable ? `<button class="select-slot" data-slot="${index}" aria-pressed="${active}" aria-label="Choisir le candidat de ${escape(label)}">${escape(label)}</button>` : `<span class="select-slot">${escape(label)}</span>`}
    ${portraitContent(candidate?.id)}<div class="select-name"><small>${candidate ? escape(candidate.name) : 'Sélection en cours'}</small><strong>${candidate ? escape(candidate.short) : '…'}</strong>${styles || (style?.ultimate ? `<span>${escape(style.name.split(' · ')[0])}</span>` : '')}</div>
  </article>`;
}
export function stylesContent(config, profile, fighter, { ai = false, disabled = false, taken = () => false } = {}) {
  if (!fighter?.faction || MINOR_FACTIONS.includes(fighter.faction)) return '';
  return `<div class="select-styles" role="group" aria-label="Style du candidat">${debateStyles(config, fighter.faction).map(s => {
    const locked = !ai && !debateStyleAvailable(config, profile, fighter.faction, s.id), used = taken(s.id);
    return `<button class="debate-style" data-style="${s.id}" aria-pressed="${fighter.style === s.id}" ${locked || used || disabled ? 'disabled' : ''} title="${escape(locked ? 'Mettre KO en campagne et gagner l’élection pour débloquer' : used ? 'Déjà sélectionné' : s.ultimate.name)}" style="--style-color:${s.skin.accent}">${locked ? '<span aria-hidden="true">🔒</span> ' : ''}${escape(s.name.split(' · ')[0])}</button>`;
  }).join('')}</div>`;
}

/** Flèches entre portraits ; Entrée et Espace restent les actions natives des boutons. */
export function bindRosterKeyboard(root) {
  const tiles = [...root.querySelectorAll('.select-tile')];
  tiles.forEach((tile, index) => tile.onkeydown = event => {
    const columns = getComputedStyle(tile.parentElement).gridTemplateColumns.split(' ').length;
    const delta = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -columns, ArrowDown: columns }[event.key];
    if (!delta) return;
    event.preventDefault();
    let next = (index + delta + tiles.length) % tiles.length;
    for (let i = 0; i < tiles.length && tiles[next].disabled; i++) next = (next + delta + tiles.length) % tiles.length;
    tiles[next].focus({ preventScroll: true });
  });
}
