// Campagne : quand le joueur met K.-O. un candidat (ou un style) qu'il n'a pas encore,
// la carte du candidat descend en haut de l'écran (rayons dorés, confettis) puis repart.
// Elle ne bloque jamais le jeu (aucun clic capté) et plusieurs K.-O. s'enchaînent dans l'ordre.
// Elle s'affiche dès le K.-O., par-dessus les bandeaux d'évènement, le sondage et les messages ;
// seuls un menu ouvert (pause) ou l'écran de choix de fin de partie la font patienter.
import { DEBATE_CANDIDATES } from '../debat/debate-selection.js';
import { CAMPAIGN_STYLES } from '../../simulation/campaign-styles.js';
import { avatarFaction, hydrateMedallions, portraitFace } from '../menus/player-card.js';

const DURATION_MS = 2800;
const CONFETTI_COLORS = ['#ffd75e', '#e5333b', '#2b55c9', '#f2f5ff', '#5dcaa5'];
const queue = [];
let showing = false;
/** Un menu (pause) ou l'écran de choix couvre le jeu : la carte attend qu'il se ferme. */
const otherPopupVisible = () => !!document.querySelector('dialog[open], .unlock-choice:not([hidden])');

/** Nom court du candidat et, pour un style, son nom (« Zemmouriste »). Sert aussi à l'écran de choix de fin de partie. */
export function unlockLabel(id) {
  const faction = avatarFaction(id);
  const candidate = DEBATE_CANDIDATES.find(c => c.id === faction);
  const style = CAMPAIGN_STYLES[faction]?.find(s => s.id === id);
  return { name: candidate?.short ?? id, style: style ? style.name.split(' · ')[0] : '' };
}

/** Nouvelle partie : les cartes encore en attente de la partie précédente sont oubliées. */
export function clearKnockoutReveals() { queue.length = 0; }

export function showKnockoutReveal(id, { sound = null } = {}) {
  queue.push({ id, sound });
  if (!showing) next();
}

function next() {
  if (!queue.length) { showing = false; return; }
  showing = true;
  if (otherPopupVisible()) { setTimeout(next, 300); return; }
  const item = queue.shift();
  const { name, style } = unlockLabel(item.id);
  const root = document.createElement('div');
  root.className = 'ko-reveal';
  root.setAttribute('role', 'status');
  root.innerHTML = `<span class="ko-reveal-rays" aria-hidden="true"></span>
    <div class="ko-reveal-card">${portraitFace(item.id)}
      <strong class="ko-reveal-title"></strong>${style ? '<small class="ko-reveal-style"></small>' : ''}
      <span class="ko-reveal-hint">Gagne l’élection pour pouvoir le choisir</span></div>`;
  // Textes posés sans HTML (noms venant du catalogue).
  root.querySelector('.ko-reveal-title').textContent = `${name} K.-O. !`;
  if (style) root.querySelector('.ko-reveal-style').textContent = style;
  for (let i = 0; i < 28; i++) {
    const piece = document.createElement('i');
    piece.className = 'ko-reveal-confetti';
    piece.setAttribute('aria-hidden', 'true');
    piece.style.left = `${Math.round(Math.random() * 100)}%`;
    piece.style.background = CONFETTI_COLORS[i % CONFETTI_COLORS.length];
    piece.style.animationDelay = `${(0.25 + Math.random() * 0.6).toFixed(2)}s`;
    piece.style.setProperty('--drift', `${Math.round(Math.random() * 80 - 40)}px`);
    root.append(piece);
  }
  document.body.append(root);
  hydrateMedallions(root);
  item.sound?.();
  setTimeout(() => { root.remove(); next(); }, DURATION_MS);
}
