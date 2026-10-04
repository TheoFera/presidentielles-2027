// Réglages des comptes PartageTonJeu côté jeu. Aucun secret ici : les identifiants
// client OAuth sont publics par nature (ils figurent dans toute appli ou page web).
// Voir docs/comptes-partagetonjeu.md, « Ce qu'il reste à configurer ».
import { onlineServer } from './online-config.js';

/** Identifiant client OAuth Google de type « Application Web » (Google Cloud → Identifiants).
 *  Sert au bouton Google du site ET à l'appli Android (qui demande un jeton pour ce client). Vide = Google masqué. */
export const GOOGLE_WEB_CLIENT_ID = '314104215391-7r3vl4pjmlg9049kniu6fklq5mog5rta.apps.googleusercontent.com';
/** Sign in with Apple sur le web : Services ID (ex. « fr.partagetonjeu.web ») et adresse de retour déclarée chez Apple. Vides = Apple masqué sur le web. */
export const APPLE_SERVICES_ID = '';
export const APPLE_REDIRECT_URI = '';

/** Texte exact de la case des actualités et sa version (même version dans serveur-en-ligne/api/accounts.js). */
export const NEWSLETTER_TEXT = 'J’accepte de recevoir des informations sur les prochaines créations de PartageTonJeu';
export const NEWSLETTER_NOTE = 'Désinscription en un clic.';
export const ACCOUNT_NEWSLETTER_VERSION = 'newsletter-2026-10-v2';

/** Adresse de l'API des comptes : le même Worker Cloudflare (et la même base) que les salons en ligne,
 *  y compris quand le jeu est lancé sur localhost. */
export function accountApiBase(location = globalThis.location) {
  const server = onlineServer(location);
  return server ? `${server}/api/v1` : '';
}
