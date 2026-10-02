// Sessions PartageTonJeu. Après vérification du jeton Google/Apple, le serveur crée
// SA propre session : un jeton aléatoire de 256 bits remis au jeu, dont seule
// l'empreinte SHA-256 est gardée en base (une fuite de la base ne donne aucune session).
//   - expiration glissante : 60 jours sans utilisation ;
//   - durée maximale : 180 jours, puis reconnexion obligatoire ;
//   - révocation : déconnexion, « déconnecter tous mes appareils », suppression du compte.
import { ApiError, nowSeconds, randomId, randomToken, sha256Hex } from './util.js';

export const SESSION_IDLE_SECONDS = 60 * 24 * 3600;
export const SESSION_MAX_SECONDS = 180 * 24 * 3600;
const TOUCH_EVERY_SECONDS = 12 * 3600; // limite les écritures en base
const TOKEN_PREFIX = 'ptj_';

export async function createSession(db, userId, platform, now = nowSeconds()) {
  const token = TOKEN_PREFIX + randomToken(32);
  const session = { id: randomId('s'), expires_at: now + SESSION_IDLE_SECONDS };
  await db.prepare('INSERT INTO sessions (id, token_hash, user_id, platform, created_at, last_seen_at, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .bind(session.id, await sha256Hex(token), userId, platform, now, now, session.expires_at).run();
  return { token, ...session };
}

function bearer(request) {
  const header = request.headers.get('Authorization') || '';
  const match = /^Bearer (ptj_[A-Za-z0-9_-]{43})$/.exec(header);
  return match ? match[1] : null;
}

/** Session de la requête, ou null. Prolonge l'expiration (sans dépasser la durée maximale). */
export async function findSession(request, db, now = nowSeconds()) {
  const token = bearer(request);
  if (!token) return null;
  const row = await db.prepare(`SELECT s.id, s.user_id, s.created_at, s.last_seen_at, s.expires_at, s.revoked_at, u.status, u.username
    FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ?`).bind(await sha256Hex(token)).first();
  if (!row) return { invalid: true };
  if (row.revoked_at || row.status === 'deleted') return { invalid: true };
  if (row.expires_at <= now || row.created_at + SESSION_MAX_SECONDS <= now) return { expired: true };
  if (now - row.last_seen_at >= TOUCH_EVERY_SECONDS) {
    row.expires_at = Math.min(now + SESSION_IDLE_SECONDS, row.created_at + SESSION_MAX_SECONDS);
    await db.prepare('UPDATE sessions SET last_seen_at = ?, expires_at = ? WHERE id = ?').bind(now, row.expires_at, row.id).run();
  }
  return { id: row.id, userId: row.user_id, status: row.status, username: row.username, expiresAt: row.expires_at };
}

/** Exige une session valide ; `active` exige en plus un pseudo choisi. */
export async function requireSession(request, db, { active = false } = {}) {
  const session = await findSession(request, db);
  if (!session) throw new ApiError(401, 'unauthenticated', 'Connectez-vous à votre compte PartageTonJeu.');
  if (session.expired) throw new ApiError(401, 'session_expired', 'Votre session a expiré. Reconnectez-vous.');
  if (session.invalid) throw new ApiError(401, 'session_invalid', 'Session invalide. Reconnectez-vous.');
  if (session.status === 'suspended') throw new ApiError(403, 'suspended', 'Ce compte est suspendu.');
  if (active && session.status !== 'active') throw new ApiError(403, 'profile_required', 'Choisissez d’abord votre pseudo.');
  return session;
}

export const revokeSession = (db, id, now = nowSeconds()) => db.prepare('UPDATE sessions SET revoked_at = ? WHERE id = ? AND revoked_at IS NULL').bind(now, id);
export const revokeAllSessions = (db, userId, now = nowSeconds()) => db.prepare('UPDATE sessions SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL').bind(now, userId);
