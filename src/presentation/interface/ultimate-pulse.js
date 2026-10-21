/**
 * Lueur du bouton d'ultime prêt (--glow, de 0 à 1), avancée par la boucle du jeu.
 *
 * Avant, une animation CSS changeait l'ombre floue et la bordure du bouton : le navigateur repeignait ce flou
 * et recomposait tout l'écran à chaque rafraîchissement (120 fois par seconde sur un téléphone à 120 Hz),
 * alors que le jeu ne dessine que 60 images par seconde. Dès que l'ultime était prêt, la carte graphique
 * composait donc deux fois plus d'images. Mesuré le 21/10/2026 dans Chrome : 72 → 144 images composées par seconde.
 *
 * Même rythme et même courbe qu'avant : le bouton surgit (0,6 s), puis la lueur pulse toutes les 1,1 s,
 * avec la courbe CSS « ease-in-out » sur chaque moitié du battement.
 */
const DELAY_SECONDS = 0.6, PERIOD_SECONDS = 1.1;

const bezier = (u, p1, p2) => 3 * (1 - u) ** 2 * u * p1 + 3 * (1 - u) * u ** 2 * p2 + u ** 3;
/** Courbe CSS « ease-in-out », cubic-bezier(.42, 0, .58, 1). */
export function easeInOut(t) {
  let low = 0, high = 1;
  for (let i = 0; i < 24; i++) { const u = (low + high) / 2; if (bezier(u, 0.42, 0.58) < t) low = u; else high = u; }
  return bezier((low + high) / 2, 0, 1);
}

/** Intensité de la lueur, `seconds` après que le bouton est devenu prêt. */
export function ultimateGlow(seconds) {
  if (!(seconds >= DELAY_SECONDS)) return 0;
  const phase = ((seconds - DELAY_SECONDS) % PERIOD_SECONDS) / PERIOD_SECONDS;
  return phase < 0.5 ? easeInOut(phase * 2) : 1 - easeInOut((phase - 0.5) * 2);
}
