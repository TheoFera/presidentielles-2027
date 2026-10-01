import { syncOrientation } from './landscape.js';

// Images de fond des écrans du menu (fichiers CSS) : gardées ici pour rester en mémoire.
const MENU_IMAGES = [
  new URL('../../assets/generated/menus/candidats.png', import.meta.url).href,
  new URL('../../assets/generated/menus/candidats-philippe-centre.png', import.meta.url).href,
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
  assets.warmUp(ids);
}
