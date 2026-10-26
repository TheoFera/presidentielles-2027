/** Safari iOS ignore `user-scalable=no` et applique mal `touch-action` quand deux doigts tapent en même temps :
 *  avancer d’un pouce et frapper de l’autre finit en double appui ou en pincement, et la page zoome.
 *  On bloque ces gestes dans l’écran de jeu ; les menus gardent leurs clics (Android n’émet pas `gesture*`). */
const INTERACTIVE = 'a, input, select, textarea, label, summary, dialog, [role="button"], button:not(#touch-controls button)';

export function guardGameZoom(doc = document, { doubleTapMs = 350, now = () => performance.now() } = {}) {
  const inGame = target => target?.closest?.('#game') && !target.closest(INTERACTIVE);
  const block = event => event.preventDefault();
  // Pincement : événements propres à WebKit.
  for (const type of ['gesturestart', 'gesturechange', 'gestureend']) doc.addEventListener(type, block, { passive: false });
  doc.addEventListener('touchmove', event => {
    if (event.touches?.length > 1 && inGame(event.target)) event.preventDefault();
  }, { passive: false });
  // Double appui : le second `touchend` rapproché déclencherait le zoom. Les commandes tactiles passent
  // par les événements pointeur, qui ont déjà été envoyés et ne sont donc pas annulés.
  let lastEnd = -Infinity;
  doc.addEventListener('touchend', event => {
    if (!inGame(event.target)) return;
    const time = now();
    if (time - lastEnd <= doubleTapMs) event.preventDefault();
    lastEnd = time;
  }, { passive: false });
  doc.addEventListener('dblclick', event => { if (inGame(event.target)) event.preventDefault(); }, { passive: false });
}
