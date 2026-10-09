// Réglages du multijoueur en ligne. Seules ces deux lignes sont à remplir.

/** Adresse du serveur de salons déployé sur Cloudflare (voir docs/multijoueur.md). Vide = mode en ligne désactivé. */
export const ONLINE_SERVER = 'https://presidentielles-2027-salons.partagetonjeu.workers.dev';

/** Adresse publique du jeu (GitHub Pages) : sert à fabriquer le lien d’invitation, y compris depuis l’application Android. */
export const ONLINE_GAME_URL = 'https://theofera.github.io/presidentielles-2027/';

/** Serveur utilisé. Ajoutez « ?serveur-local » à l’adresse du jeu pour tester avec « npx wrangler dev ». */
export function onlineServer(location = globalThis.location) {
  if (location?.search && new URLSearchParams(location.search).has('serveur-local')) return 'http://localhost:8787';
  return ONLINE_SERVER.replace(/\/+$/, '');
}

/** Lien à envoyer aux amis pour rejoindre un salon. */
export function onlineInviteLink(code, location = globalThis.location) {
  const link = new URL(ONLINE_GAME_URL || `${location.origin}${location.pathname}`);
  link.searchParams.set('en-ligne', code);
  return link.href;
}

// Code d’invitation : 6 caractères (0-9, A-F). On accepte aussi un lien collé, et
// la lettre O tapée à la place du chiffre 0.
export function normalizeRoomCode(text) {
  const value = String(text ?? '');
  const fromLink = /[?&]en-ligne=([0-9a-fA-F]{6})/.exec(value);
  return (fromLink ? fromLink[1] : value).toUpperCase().replace(/O/g, '0').replace(/[^0-9A-F]/g, '').slice(0, 6);
}
