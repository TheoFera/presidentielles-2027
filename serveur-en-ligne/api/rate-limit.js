// Limitation de débit simple (fenêtres fixes) stockée dans D1. Utilisée seulement sur
// les routes sensibles (connexion, création de compte, pseudo, parties) : quelques
// écritures, largement dans l'offre gratuite. Les adresses IP ne sont jamais stockées :
// seule une empreinte tronquée sert de clé, effacée à la fin de la fenêtre.
import { ApiError, nowSeconds, sha256Hex } from './util.js';

export const LIMITS = {
  auth_ip: [30, 600],            // 30 connexions / 10 min par adresse
  signup_ip: [8, 86400],         // 8 nouveaux comptes / jour par adresse
  username_user: [30, 3600],     // vérifications et changements de pseudo
  match_user: [40, 3600],        // parties multijoueur créées
  run_user: [40, 86400],         // campagnes solo déclarées
  report_user: [60, 3600],       // résultats envoyés
  unsubscribe_ip: [30, 3600],
};

export async function ipKey(request) {
  const ip = request.headers.get('CF-Connecting-IP') || 'local';
  return (await sha256Hex(`ptj-rl:${ip}`)).slice(0, 24);
}

/** Compte une action ; refuse au-delà de la limite. */
export async function rateLimit(db, name, subject, now = nowSeconds()) {
  const [limit, window] = LIMITS[name];
  const start = Math.floor(now / window) * window;
  const row = await db.prepare(`INSERT INTO rate_limits (key, count, expires_at) VALUES (?, 1, ?)
    ON CONFLICT(key) DO UPDATE SET count = count + 1 RETURNING count`).bind(`${name}:${subject}:${start}`, start + window).first();
  if ((row?.count ?? 0) > limit) {
    throw new ApiError(429, 'rate_limited', 'Trop de tentatives. Patientez un peu avant de réessayer.', { retry_after: start + window - now });
  }
}
