/**
 * Cadence de l'application : 60 images par seconde au plus, à intervalles égaux.
 *
 * Mesuré le 09/10/2026 sur un Redmi Note 13 Pro 5G : dans l'application, la carte graphique de la WebView
 * met environ 8,4 ms à dessiner une image du jeu. Sur un écran à 120 Hz (8,3 ms par image), c'est intenable :
 * 234 retards en 45 s. Chrome est fluide parce que le téléphone le met à 60 Hz (16,7 ms par image).
 *
 * La règle ne devine rien : une image n'est pas dessinée si la précédente date de moins de 10,5 ms.
 * 120 Hz → une image sur deux (60 par seconde) ; 60 ou 90 Hz → toutes ; 144 Hz → 72 par seconde.
 * Elle suit immédiatement les changements de fréquence de l'écran (l'ancien régulateur, qui estimait la
 * fréquence sur 40 images, réagissait trop tard et faisait tomber le jeu à 30 images par seconde).
 */
export const MIN_FRAME_INTERVAL_MS = 10.5;

/** Vrai si l'appel de requestAnimationFrame à l'instant now doit dessiner une image. */
export const shouldDrawFrame = (now, lastDrawn) => now - lastDrawn >= MIN_FRAME_INTERVAL_MS;
