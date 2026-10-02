// Comptes PartageTonJeu : création à la première connexion, pseudo, identités liées,
// consentement aux actualités, consultation et suppression.
import { ApiError, audit, nowSeconds, randomId, list } from './util.js';
import { DEFAULT_UNLOCKED } from '../../src/simulation/unlock-catalog.js';
import { revokeAllSessions } from './sessions.js';

// ---- Pseudo ---------------------------------------------------------------
// 3 à 16 caractères : lettres (accents compris), chiffres, « _ », « - » et « . ».
// Pas d'espace (évite les pseudos qui se ressemblent). Au moins une lettre.
export const USERNAME_MIN = 3;
export const USERNAME_MAX = 16;
const USERNAME_PATTERN = /^[A-Za-zÀ-ÖØ-öø-ÿ0-9][A-Za-zÀ-ÖØ-öø-ÿ0-9_.-]*$/u;
// Noms qui pourraient tromper les joueurs, et « betatest » (profil de test qui débloque tout).
const RESERVED = ['partagetonjeu', 'ptj', 'admin', 'administrateur', 'moderateur', 'moderation', 'support', 'staff', 'equipe',
  'officiel', 'systeme', 'system', 'root', 'betatest', 'joueur', 'anonyme', 'supprime', 'null', 'undefined'];
const RESERVED_PARTS = ['partagetonjeu', 'admin', 'moderat'];

/** Forme comparée : minuscules, sans accents (« Élodie » et « elodie » sont le même pseudo). */
export const usernameKey = name => name.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

/** Valide un pseudo. Renvoie { username, key } ou lève une erreur compréhensible. */
export function validateUsername(raw, env = {}) {
  const username = String(raw ?? '').normalize('NFC').trim();
  if (!username) throw new ApiError(400, 'username_empty', 'Choisissez un pseudo.');
  if (username.length < USERNAME_MIN || username.length > USERNAME_MAX) throw new ApiError(400, 'username_length', `Le pseudo doit faire entre ${USERNAME_MIN} et ${USERNAME_MAX} caractères.`);
  if (!USERNAME_PATTERN.test(username)) throw new ApiError(400, 'username_chars', 'Utilisez seulement des lettres, des chiffres, « _ », « - » ou « . » (sans espace), en commençant par une lettre ou un chiffre.');
  if (!/\p{L}/u.test(username)) throw new ApiError(400, 'username_chars', 'Le pseudo doit contenir au moins une lettre.');
  const key = usernameKey(username);
  if (RESERVED.includes(key) || RESERVED_PARTS.some(part => key.includes(part))) throw new ApiError(409, 'username_reserved', 'Ce pseudo est réservé. Choisissez-en un autre.');
  // Point d'entrée de la modération : termes interdits ajoutés sans redéployer le code (variable BLOCKED_USERNAME_TERMS).
  if (list(env.BLOCKED_USERNAME_TERMS).some(term => key.includes(usernameKey(term)))) throw new ApiError(409, 'username_refused', 'Ce pseudo n’est pas autorisé. Choisissez-en un autre.');
  return { username, key };
}

export async function usernameAvailable(db, raw, env, userId = null) {
  try {
    const { key } = validateUsername(raw, env);
    const owner = await db.prepare('SELECT id FROM users WHERE username_key = ?').bind(key).first('id');
    return owner && owner !== userId ? { available: false, code: 'username_taken', message: 'Ce pseudo est déjà pris.' } : { available: true };
  } catch (error) {
    if (error instanceof ApiError) return { available: false, code: error.code, message: error.message };
    throw error;
  }
}

// ---- Consentement aux actualités -------------------------------------------
/** Version du texte affiché à côté de la case. À changer si le texte change (src/network/account-config.js aussi). */
// v1 : « Je souhaite recevoir par e-mail les actualités, nouveautés et nouveaux jeux de PartageTonJeu. »
// v2 : « J’accepte de recevoir des informations sur les prochaines créations de PartageTonJeu »
export const NEWSLETTER_CONSENT_VERSION = 'newsletter-2026-10-v2';

export const consentStatement = (db, userId, granted, source, now = nowSeconds()) =>
  db.prepare('INSERT INTO marketing_consents (user_id, granted, consent_version, source, created_at) VALUES (?, ?, ?, ?, ?)')
    .bind(userId, granted ? 1 : 0, NEWSLETTER_CONSENT_VERSION, source, now);

export async function newsletterStatus(db, userId) {
  const row = await db.prepare('SELECT newsletter_consent, newsletter_consent_date, newsletter_consent_version FROM newsletter_status WHERE user_id = ?').bind(userId).first();
  return row ? { granted: row.newsletter_consent === 1, date: row.newsletter_consent_date, version: row.newsletter_consent_version } : { granted: false, date: null, version: null };
}

// ---- Identités et comptes --------------------------------------------------
const identityStatement = (db, userId, provider, profile, now) =>
  db.prepare(`INSERT INTO auth_identities (id, user_id, provider, provider_subject, email, email_verified, email_is_private_relay, created_at, last_login_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(randomId('i'), userId, provider, profile.subject, profile.email ?? null,
    profile.email_verified ? 1 : 0, profile.email_is_private_relay ? 1 : 0, now, now);

export const findIdentity = (db, provider, subject) =>
  db.prepare('SELECT i.id, i.user_id, u.status FROM auth_identities i JOIN users u ON u.id = i.user_id WHERE i.provider = ? AND i.provider_subject = ?').bind(provider, subject).first();

/**
 * Connexion : retrouve le compte lié à cette identité, ou en crée un nouveau.
 * Jamais de rapprochement par e-mail : deux fournisseurs = deux comptes, sauf liaison explicite.
 */
export async function signInWithIdentity(db, provider, profile, { beforeCreate = async () => {} } = {}, now = nowSeconds()) {
  const existing = await findIdentity(db, provider, profile.subject);
  if (existing) {
    if (existing.status === 'deleted') throw new ApiError(410, 'account_deleted', 'Ce compte a été supprimé.');
    // L'e-mail n'est mis à jour que s'il est fourni (Apple ne le renvoie pas toujours).
    await db.prepare(`UPDATE auth_identities SET last_login_at = ?, email = COALESCE(?, email), email_verified = CASE WHEN ? IS NULL THEN email_verified ELSE ? END,
      email_is_private_relay = CASE WHEN ? IS NULL THEN email_is_private_relay ELSE ? END WHERE id = ?`)
      .bind(now, profile.email ?? null, profile.email ?? null, profile.email_verified ? 1 : 0, profile.email ?? null, profile.email_is_private_relay ? 1 : 0, existing.id).run();
    return { userId: existing.user_id, created: false };
  }
  await beforeCreate();
  const userId = randomId('u');
  await db.batch([
    db.prepare('INSERT INTO users (id, status, created_at, updated_at) VALUES (?, \'pending_profile\', ?, ?)').bind(userId, now, now),
    identityStatement(db, userId, provider, profile, now),
    // Candidats offerts à tout nouveau compte.
    ...DEFAULT_UNLOCKED.map(id => db.prepare('INSERT OR IGNORE INTO player_candidate_unlocks (user_id, candidate_id, unlock_method, unlocked_at) VALUES (?, ?, \'default\', ?)').bind(userId, id, now)),
    audit(db, userId, 'account_created', provider),
  ]);
  return { userId, created: true };
}

/** Liaison d'une identité supplémentaire à un compte déjà connecté (jamais de fusion automatique). */
export async function linkIdentity(db, userId, provider, profile, now = nowSeconds()) {
  const existing = await findIdentity(db, provider, profile.subject);
  if (existing?.user_id === userId) throw new ApiError(409, 'already_linked', 'Ce compte est déjà lié.');
  if (existing) throw new ApiError(409, 'identity_in_use', 'Cette identité est déjà utilisée par un autre compte PartageTonJeu. Supprimez cet autre compte avant de la lier ici.');
  const same = await db.prepare('SELECT id FROM auth_identities WHERE user_id = ? AND provider = ?').bind(userId, provider).first('id');
  if (same) throw new ApiError(409, 'provider_already_linked', 'Un compte de ce fournisseur est déjà lié. Déliez-le d’abord.');
  await db.batch([identityStatement(db, userId, provider, profile, now), audit(db, userId, 'identity_linked', provider)]);
}

export async function unlinkIdentity(db, userId, provider) {
  const count = await db.prepare('SELECT COUNT(*) AS n FROM auth_identities WHERE user_id = ?').bind(userId).first('n');
  if (count <= 1) throw new ApiError(409, 'last_identity', 'Impossible de délier votre seul moyen de connexion.');
  const result = await db.prepare('DELETE FROM auth_identities WHERE user_id = ? AND provider = ?').bind(userId, provider).run();
  if (!result.meta.changes) throw new ApiError(404, 'not_linked', 'Ce fournisseur n’est pas lié à votre compte.');
  await audit(db, userId, 'identity_unlinked', provider).run();
}

/** Modification du profil : pseudo (première fois ou changement) et choix des actualités. */
export async function updateProfile(db, env, userId, body, now = nowSeconds()) {
  const user = await db.prepare('SELECT id, username, username_key, status, username_changed_at FROM users WHERE id = ?').bind(userId).first();
  const statements = [];
  if (body.username !== undefined) {
    const { username, key } = validateUsername(body.username, env);
    if (username !== user.username) {
      // Après le premier choix : un changement par jour au plus.
      if (user.status === 'active' && key !== user.username_key && user.username_changed_at && now - user.username_changed_at < 86400) {
        throw new ApiError(429, 'username_cooldown', 'Vous avez déjà changé de pseudo aujourd’hui. Réessayez demain.');
      }
      const owner = await db.prepare('SELECT id FROM users WHERE username_key = ?').bind(key).first('id');
      if (owner && owner !== userId) throw new ApiError(409, 'username_taken', 'Ce pseudo est déjà pris.');
      statements.push(db.prepare(`UPDATE users SET username = ?, username_key = ?, username_changed_at = ?, updated_at = ?,
        status = CASE WHEN status = 'pending_profile' THEN 'active' ELSE status END WHERE id = ?`).bind(username, key, now, now, userId));
    }
  } else if (user.status === 'pending_profile') throw new ApiError(400, 'username_empty', 'Choisissez un pseudo.');
  if (body.newsletter !== undefined) {
    if (typeof body.newsletter !== 'boolean') throw new ApiError(400, 'invalid_input', 'Choix des actualités invalide.');
    const current = await newsletterStatus(db, userId);
    // Le premier choix (même un refus) est gardé ; ensuite, seulement les changements.
    if (current.date === null || current.granted !== body.newsletter) statements.push(consentStatement(db, userId, body.newsletter, user.status === 'pending_profile' ? 'onboarding' : 'settings', now));
  }
  if (!statements.length) return;
  try { await db.batch(statements); }
  catch (error) {
    if (/UNIQUE/i.test(error.message)) throw new ApiError(409, 'username_taken', 'Ce pseudo est déjà pris.');
    throw error;
  }
}

/** Données du joueur connecté (consultation du profil). */
export async function getMe(db, userId) {
  const [user, identities, unlocks, ratings, newsletter] = await Promise.all([
    db.prepare('SELECT id, username, status, created_at FROM users WHERE id = ?').bind(userId).first(),
    db.prepare('SELECT provider, email, email_is_private_relay, created_at, last_login_at FROM auth_identities WHERE user_id = ? ORDER BY created_at').bind(userId).all(),
    db.prepare('SELECT candidate_id, unlock_method, unlocked_at FROM player_candidate_unlocks WHERE user_id = ? ORDER BY unlocked_at, candidate_id').bind(userId).all(),
    db.prepare('SELECT ladder, rating, games, wins, losses FROM player_ratings WHERE user_id = ? AND season = \'global\'').bind(userId).all(),
    newsletterStatus(db, userId),
  ]);
  const unlocked = [...new Set([...DEFAULT_UNLOCKED, ...unlocks.results.map(u => u.candidate_id)])];
  return {
    user: { id: user.id, username: user.username, status: user.status, created_at: user.created_at },
    identities: identities.results.map(i => ({ provider: i.provider, email: i.email, email_is_private_relay: i.email_is_private_relay === 1, linked_at: i.created_at, last_login_at: i.last_login_at })),
    newsletter,
    unlocks: unlocked,
    stats: Object.fromEntries(ratings.results.map(r => [r.ladder, { rating: Math.round(r.rating), games: r.games, wins: r.wins, losses: r.losses }])),
  };
}

/**
 * Suppression du compte : les données personnelles (e-mails, identités, pseudo,
 * consentements, progression, classement, sessions) sont effacées. Il reste une
 * ligne « users » anonyme (statut deleted, sans pseudo) pour que les parties
 * passées des AUTRES joueurs restent cohérentes ; elle ne permet de retrouver personne.
 */
export async function deleteAccount(db, userId, now = nowSeconds()) {
  await db.batch([
    revokeAllSessions(db, userId, now),
    db.prepare('DELETE FROM sessions WHERE user_id = ?').bind(userId),
    db.prepare('DELETE FROM auth_identities WHERE user_id = ?').bind(userId),
    db.prepare('DELETE FROM auth_nonces WHERE user_id = ?').bind(userId),
    db.prepare('DELETE FROM marketing_consents WHERE user_id = ?').bind(userId),
    db.prepare('DELETE FROM player_candidate_unlocks WHERE user_id = ?').bind(userId),
    db.prepare('DELETE FROM player_ratings WHERE user_id = ?').bind(userId),
    db.prepare('DELETE FROM rating_events WHERE user_id = ?').bind(userId),
    db.prepare('DELETE FROM game_runs WHERE user_id = ?').bind(userId),
    db.prepare(`UPDATE users SET username = NULL, username_key = NULL, status = 'deleted', deleted_at = ?, updated_at = ? WHERE id = ?`).bind(now, now, userId),
    audit(db, userId, 'account_deleted'),
  ]);
}
