// Carte et post-it des objectifs « en grand » : dossier du départ (campaign-intro.js) et pause (map-pause.js).
// La position est mesurée une fois puis appliquée par une transformation (--dossier) depuis leur place
// habituelle : la carte graphique fait glisser les deux éléments sans redessiner la page.

/** Boîte d'un élément dans le cadre du jeu, sans ses transformations (place habituelle). */
function layoutBox(element, game) {
  let left = 0, top = 0;
  for (let node = element; node && node !== game; node = node.offsetParent) { left += node.offsetLeft; top += node.offsetTop; }
  return { left, top, width: element.offsetWidth, height: element.offsetHeight };
}

/**
 * Carte au centre de la moitié droite et post-it au centre de la moitié gauche, agrandis.
 * Sans post-it (`objectives` faux), la moitié gauche reste libre (mémo de la pause).
 */
export function placeDossier(game, { objectives = true } = {}) {
  const width = game.clientWidth, height = game.clientHeight;
  const place = (selector, x, y, fit) => {
    const element = game.querySelector(selector);
    if (!element) return;
    const box = layoutBox(element, game);
    if (!box.width || !box.height) return;
    const scale = Math.max(1, Math.min(fit(box), 2.4));
    const dx = width * x - (box.left + box.width / 2), dy = height * y - (box.top + box.height / 2);
    element.style.setProperty('--dossier', `translate(${dx.toFixed(1)}px, ${dy.toFixed(1)}px) scale(${scale.toFixed(3)})`);
  };
  place('#electoral-display', 0.73, 0.47, box => height * 0.62 / box.height);
  if (objectives) place('#campaign-objectives', 0.29, 0.47, box => Math.min(width * 0.34 / box.width, height * 0.56 / box.height));
}
