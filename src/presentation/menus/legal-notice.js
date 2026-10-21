import { syncOrientation } from '../interface/landscape.js';
import { avatarImage } from './player-card.js';
import { DEBATE_CANDIDATES, selectionCloseup } from '../debat/debate-selection.js';
import { ALL_CANDIDATE_IDS } from '../../simulation/unlock-catalog.js';

// Images de fond des écrans du menu (fichiers CSS) : gardées ici pour rester en mémoire.
// D'abord le choix du candidat (les portraits sont dessinés dans l'image), puis le fond des résultats.
// Doit suivre l'image de game-menu.css : sinon l'écran des candidats reste vide sur un réseau lent.
const MENU_IMAGES = [
  new URL('../../../assets/images/menus/candidats-philippe-centre-v2.png', import.meta.url).href,
  new URL('../../../assets/images/menus/candidats.png', import.meta.url).href,
];
const warmedMenuImages = [];

/** Avertissement affiché à chaque allumage, sur fond noir, avant le menu : le jeu est une parodie.
 * Le texte est dans index.html pour apparaître dès le premier affichage, avant le chargement du jeu.
 * Tant qu'il est ouvert, syncOrientation garde le menu inaccessible derrière lui. */
export function showLegalNotice() {
  const notice = document.getElementById('legal-notice');
  if (!notice || notice.hidden) return;
  syncOrientation();
  const button = notice.querySelector('#legal-notice-accept');
  button.disabled = false;
  button.focus({ preventScroll: true });
  button.addEventListener('click', () => {
    notice.classList.add('closing');
    syncOrientation();
    const menu = document.getElementById('start-menu');
    (menu.querySelector('h1') || menu.querySelector('button'))?.focus({ preventScroll: true });
    // Durée des deux fondus de fermeture (texte, puis fond noir) définis dans start-menu.css.
    setTimeout(() => { notice.hidden = true; }, 900);
  }, { once: true });
}

/** Pendant la lecture de l'avertissement, le menu et la campagne se chargent en arrière-plan. */
export function warmUpBehindNotice(assets, ids) {
  for (const src of MENU_IMAGES) {
    const image = new Image(); image.decoding = 'async'; image.src = src;
    warmedMenuImages.push(image);
  }
  // Gros plans du débat et avatars (profil, lobby) avant les grandes planches de la campagne : sinon, sur un réseau lent,
  // ils attendent derrière plusieurs Mo d'images et les cases restent vides. Au plus 4 s d'attente.
  const avatars = Promise.allSettled([...DEBATE_CANDIDATES.map(({ id }) => selectionCloseup(id)), ...ALL_CANDIDATE_IDS.map(id => avatarImage(id))]);
  void Promise.race([avatars, new Promise(resolve => setTimeout(resolve, 4000))]).then(() => assets.warmUp(ids));
}
