// API des comptes PartageTonJeu, version 1 : toutes les routes commencent par /api/v1.
// Le Worker (worker.js) gère l'origine autorisée et le CORS, puis appelle handleApi().
import { ApiError, audit, json, nowSeconds, platformOf, randomToken, readJson, sha256Hex } from './util.js';
import { enabledProviders, providerFor } from './providers.js';
import { createSession, findSession, requireSession, revokeAllSessions, revokeSession } from './sessions.js';
import { deleteAccount, getMe, linkIdentity, NEWSLETTER_CONSENT_VERSION, signInWithIdentity, unlinkIdentity, updateProfile, usernameAvailable, USERNAME_MAX, USERNAME_MIN } from './accounts.js';
import { createMatch, joinMatch, matchStatus, reportResult, settleStaleMatches } from './matches.js';
import { completeRun, listUnlocks, startRun } from './progression.js';
import { LADDERS, leaderboard, myRank } from './ratings.js';
import { ipKey, rateLimit } from './rate-limit.js';
import { revokeAppleAuthorization } from './apple.js';
import { handleUnsubscribe } from './newsletter.js';

const NONCE_SECONDS = 600;

async function issueNonce(db, purpose, userId, now) {
  const nonce = randomToken(24);
  await db.prepare('INSERT INTO auth_nonces (nonce_hash, purpose, user_id, created_at, expires_at) VALUES (?, ?, ?, ?, ?)')
    .bind(await sha256Hex(nonce), purpose, userId ?? null, now, now + NONCE_SECONDS).run();
  return { nonce, expires_at: now + NONCE_SECONDS };
}
/** Consomme un nonce (usage unique) : un jeton intercepté ne peut pas être rejoué. */
async function consumeNonce(db, nonce, purpose, userId, now) {
  if (typeof nonce !== 'string' || nonce.length < 20 || nonce.length > 64) throw new ApiError(400, 'invalid_nonce', 'Demande de connexion expirée. Réessayez.');
  const row = await db.prepare(`DELETE FROM auth_nonces WHERE nonce_hash = ? AND purpose = ? AND expires_at > ? AND COALESCE(user_id, '') = ? RETURNING nonce_hash`)
    .bind(await sha256Hex(nonce), purpose, now, userId ?? '').first();
  if (!row) throw new ApiError(400, 'invalid_nonce', 'Demande de connexion expirée. Réessayez.');
}
/** Profil vérifié auprès du fournisseur (jamais les données envoyées telles quelles par le jeu). */
async function verifiedProfile(env, name, body, purpose, userId, now, fetcher) {
  const provider = providerFor(name, env);
  await consumeNonce(env.DB, body.nonce, purpose, userId, now);
  return provider.verify(body, env, { nonce: body.nonce, fetcher, now });
}

const ladderOf = url => {
  const ladder = url.searchParams.get('ladder') || 'campaign';
  if (!LADDERS.includes(ladder)) throw new ApiError(400, 'invalid_input', 'Classement inconnu.');
  return ladder;
};
const intParam = (url, name, fallback, min, max) => {
  const value = Number(url.searchParams.get(name) ?? fallback);
  return Number.isInteger(value) ? Math.min(max, Math.max(min, value)) : fallback;
};

// [méthode, motif, gestionnaire]. Les paramètres du motif arrivent dans `params`.
const ROUTES = [
  ['GET', /^config$/, async ({ env }) => json({ providers: enabledProviders(env), newsletter_consent_version: NEWSLETTER_CONSENT_VERSION, username: { min: USERNAME_MIN, max: USERNAME_MAX } })],

  ['POST', /^auth\/nonce$/, async ({ env, request, body, now }) => {
    const purpose = body.purpose || 'login';
    if (!['login', 'link', 'delete'].includes(purpose)) throw new ApiError(400, 'invalid_input', 'Demande invalide.');
    const session = purpose === 'login' ? null : await requireSession(request, env.DB);
    await rateLimit(env.DB, 'auth_ip', await ipKey(request), now);
    return json(await issueNonce(env.DB, purpose, session?.userId, now));
  }],

  ['POST', /^auth\/logout$/, async ({ env, request, now }) => {
    const session = await findSession(request, env.DB, now);
    if (session?.id) await revokeSession(env.DB, session.id, now).run();
    return json({ ok: true });
  }],
  ['POST', /^auth\/logout-all$/, async ({ env, request, now }) => {
    const session = await requireSession(request, env.DB);
    await env.DB.batch([revokeAllSessions(env.DB, session.userId, now), audit(env.DB, session.userId, 'logout_all')]);
    return json({ ok: true });
  }],
  ['POST', /^auth\/([a-z]+)$/, async ({ env, request, body, params, now, fetcher }) => {
    const ip = await ipKey(request);
    await rateLimit(env.DB, 'auth_ip', ip, now);
    const profile = await verifiedProfile(env, params[0], body, 'login', null, now, fetcher);
    const { userId, created } = await signInWithIdentity(env.DB, params[0], profile, { beforeCreate: () => rateLimit(env.DB, 'signup_ip', ip, now) }, now);
    const session = await createSession(env.DB, userId, platformOf(body.platform), now);
    return json({ token: session.token, expires_at: session.expires_at, created, me: await getMe(env.DB, userId) });
  }],

  ['GET', /^me$/, async ({ env, request }) => {
    const session = await requireSession(request, env.DB);
    return json(await getMe(env.DB, session.userId));
  }],
  ['PATCH', /^me$/, async ({ env, request, body, now }) => {
    const session = await requireSession(request, env.DB);
    if (body.username !== undefined) await rateLimit(env.DB, 'username_user', session.userId, now);
    await updateProfile(env.DB, env, session.userId, body, now);
    return json(await getMe(env.DB, session.userId));
  }],
  ['GET', /^usernames\/check$/, async ({ env, request, url, now }) => {
    const session = await requireSession(request, env.DB);
    await rateLimit(env.DB, 'username_user', session.userId, now);
    return json(await usernameAvailable(env.DB, url.searchParams.get('username'), env, session.userId));
  }],

  ['POST', /^account\/link\/([a-z]+)$/, async ({ env, request, body, params, now, fetcher }) => {
    const session = await requireSession(request, env.DB, { active: true });
    const profile = await verifiedProfile(env, params[0], body, 'link', session.userId, now, fetcher);
    await linkIdentity(env.DB, session.userId, params[0], profile, now);
    return json(await getMe(env.DB, session.userId));
  }],
  ['DELETE', /^account\/link\/([a-z]+)$/, async ({ env, request, params }) => {
    const session = await requireSession(request, env.DB, { active: true });
    await unlinkIdentity(env.DB, session.userId, params[0]);
    return json(await getMe(env.DB, session.userId));
  }],
  ['DELETE', /^account$/, async ({ env, request, body, now, fetcher }) => {
    const session = await requireSession(request, env.DB);
    if (body.confirm !== 'SUPPRIMER') throw new ApiError(400, 'confirmation_required', 'Confirmez en écrivant SUPPRIMER.');
    if (body.apple_authorization_code) await revokeAppleAuthorization(env, body.apple_authorization_code, { fetcher });
    await deleteAccount(env.DB, session.userId, now);
    return json({ ok: true });
  }],

  ['GET', /^progression$/, async ({ env, request }) => {
    const session = await requireSession(request, env.DB);
    return json({ unlocks: await listUnlocks(env.DB, session.userId) });
  }],
  ['POST', /^runs$/, async ({ env, request, body, now }) => {
    const session = await requireSession(request, env.DB, { active: true });
    await rateLimit(env.DB, 'run_user', session.userId, now);
    return json(await startRun(env.DB, session.userId, body, now));
  }],
  ['POST', /^runs\/([a-z0-9_]+)\/complete$/, async ({ env, request, body, params, now }) => {
    const session = await requireSession(request, env.DB, { active: true });
    return json(await completeRun(env.DB, session.userId, params[0], body, now));
  }],

  ['POST', /^matches$/, async ({ env, request, body, now }) => {
    const session = await requireSession(request, env.DB, { active: true });
    await rateLimit(env.DB, 'match_user', session.userId, now);
    return json(await createMatch(env.DB, session.userId, body, now));
  }],
  ['POST', /^matches\/([a-z0-9_]+)\/join$/, async ({ env, request, body, params, now }) => {
    const session = await requireSession(request, env.DB, { active: true });
    return json(await joinMatch(env.DB, session.userId, params[0], body, now));
  }],
  ['POST', /^matches\/([a-z0-9_]+)\/result$/, async ({ env, request, body, params, now }) => {
    const session = await requireSession(request, env.DB, { active: true });
    await rateLimit(env.DB, 'report_user', session.userId, now);
    return json(await reportResult(env.DB, session.userId, params[0], body, now));
  }],
  ['GET', /^matches\/([a-z0-9_]+)$/, async ({ env, request, params }) => {
    const session = await requireSession(request, env.DB, { active: true });
    return json(await matchStatus(env.DB, session.userId, params[0]));
  }],

  // Classement public (pseudos seulement) ; « is_me » si le joueur est connecté.
  ['GET', /^leaderboard$/, async ({ env, request, url }) => {
    const session = await findSession(request, env.DB);
    const board = await leaderboard(env.DB, ladderOf(url), { limit: intParam(url, 'limit', 50, 1, 100), offset: intParam(url, 'offset', 0, 0, 100000) });
    return json({ ...board, entries: board.entries.map(({ user_id, ...entry }) => ({ ...entry, is_me: user_id === session?.userId })) });
  }],
  ['GET', /^leaderboard\/me$/, async ({ env, request, url }) => {
    const session = await requireSession(request, env.DB);
    return json(await myRank(env.DB, session.userId, ladderOf(url)));
  }],
];

export async function handleApi(request, env, { fetcher = globalThis.fetch } = {}) {
  const url = new URL(request.url);
  const path = url.pathname.replace(/^\/api\/v1\/?/, '').replace(/\/+$/, '');
  try {
    if (!env.DB) throw new ApiError(503, 'not_configured', 'Les comptes ne sont pas encore configurés sur ce serveur.');
    if (path === 'newsletter/unsubscribe' && ['GET', 'POST'].includes(request.method)) {
      await rateLimit(env.DB, 'unsubscribe_ip', await ipKey(request));
      return await handleUnsubscribe(request, env, env.DB);
    }
    let allowed = false;
    for (const [method, pattern, handler] of ROUTES) {
      const match = pattern.exec(path);
      if (!match) continue;
      allowed = true;
      if (method !== request.method) continue;
      const body = await readJson(request);
      return await handler({ env, request, url, body, params: match.slice(1), now: nowSeconds(), fetcher });
    }
    throw allowed ? new ApiError(405, 'method_not_allowed', 'Méthode non autorisée.') : new ApiError(404, 'not_found', 'Adresse inconnue.');
  } catch (error) {
    if (error instanceof ApiError) return json({ error: { code: error.code, message: error.message, ...(error.extra || {}) } }, error.status);
    // Jamais de jeton ni de données personnelles dans les journaux : seulement la route et le type d'erreur.
    console.error(`API ${request.method} /${path} :`, error?.name, error?.message?.slice(0, 200));
    return json({ error: { code: 'server_error', message: 'Erreur du serveur. Réessayez dans un instant.' } }, 500);
  }
}

/** Tâche planifiée (cron) : règle les parties en attente, efface ce qui a expiré. */
export async function maintenance(env, now = nowSeconds()) {
  if (!env.DB) return;
  await settleStaleMatches(env.DB, now);
  await env.DB.batch([
    env.DB.prepare('DELETE FROM auth_nonces WHERE expires_at < ?').bind(now),
    env.DB.prepare('DELETE FROM rate_limits WHERE expires_at < ?').bind(now),
    // Sessions expirées ou révoquées depuis plus de 30 jours.
    env.DB.prepare('DELETE FROM sessions WHERE expires_at < ? OR revoked_at < ?').bind(now - 30 * 86400, now - 30 * 86400),
    // Campagnes solo jamais terminées (abandon) après 2 jours.
    env.DB.prepare('DELETE FROM game_runs WHERE status = \'playing\' AND created_at < ?').bind(now - 2 * 86400),
    // Journal d'enquête : conservé un an.
    env.DB.prepare('DELETE FROM audit_log WHERE created_at < ?').bind(now - 365 * 86400),
  ]);
}
