import test from 'node:test';
import assert from 'node:assert/strict';
import { createMemoryD1 } from './d1-memory.js';
import { handleApi, maintenance } from '../serveur-en-ligne/api/router.js';
import { eloChanges } from '../serveur-en-ligne/api/ratings.js';
import { REPORT_WINDOW_SECONDS } from '../serveur-en-ligne/api/matches.js';
import { SOLO_CAMPAIGN_MIN_SECONDS } from '../serveur-en-ligne/api/progression.js';
import { NEWSLETTER_CONSENT_VERSION } from '../serveur-en-ligne/api/accounts.js';
import { unsubscribeLink } from '../serveur-en-ligne/api/newsletter.js';
import { appleClientSecret, revokeAppleAuthorization } from '../serveur-en-ligne/api/apple.js';
import { DEFAULT_UNLOCKED, STYLE_UNLOCKS, MINOR_UNLOCKS, UNLOCKABLE_IDS, earnedUnlocks, recordKnockout } from '../src/simulation/unlock-catalog.js';
import { CAMPAIGN_STYLES, DEFAULT_UNLOCKS } from '../src/simulation/campaign-styles.js';
import { MINOR_FACTIONS } from '../src/simulation/world.js';
import { ACCOUNT_NEWSLETTER_VERSION } from '../src/network/account-config.js';
import worker from '../serveur-en-ligne/worker.js';

// ---- Faux Google / Apple : vraies signatures RS256 avec une clé de test ----------
const GOOGLE = 'web-client.apps.googleusercontent.com', APPLE = 'fr.presidentielles2027.jeu';
const keys = await crypto.subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign', 'verify']);
const otherKeys = await crypto.subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign', 'verify']);
const jwk = { ...await crypto.subtle.exportKey('jwk', keys.publicKey), kid: 'test-key', alg: 'RS256', use: 'sig' };
const b64 = value => Buffer.from(typeof value === 'string' ? value : JSON.stringify(value)).toString('base64url');
async function idToken(claims, { key = keys.privateKey, kid = 'test-key' } = {}) {
  const unsigned = `${b64({ alg: 'RS256', kid, typ: 'JWT' })}.${b64(claims)}`;
  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(unsigned));
  return `${unsigned}.${Buffer.from(signature).toString('base64url')}`;
}
const fetcher = async () => new Response(JSON.stringify({ keys: [jwk] }));
const now = () => Math.floor(Date.now() / 1000);
const hex16 = () => Array.from(crypto.getRandomValues(new Uint8Array(8)), b => b.toString(16).padStart(2, '0')).join('');
const ip = () => `10.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`;

function makeApi(extraEnv = {}) {
  const DB = createMemoryD1();
  const env = { DB, GOOGLE_CLIENT_IDS: GOOGLE, APPLE_CLIENT_IDS: APPLE, NEWSLETTER_UNSUBSCRIBE_SECRET: 'secret-de-test-assez-long', ...extraEnv };
  async function call(method, path, { token, body, address = ip(), headers = {} } = {}) {
    const response = await handleApi(new Request(`https://api.test/api/v1/${path}`, {
      method, headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': address, ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers },
      body: body === undefined ? undefined : JSON.stringify(body),
    }), env, { fetcher });
    return { status: response.status, body: response.headers.get('Content-Type')?.includes('json') ? await response.json() : await response.text() };
  }
  const sql = (query, ...params) => DB.raw.prepare(query).all(...params).map(row => ({ ...row }));
  return { env, DB, call, sql };
}

async function providerLogin(api, provider, sub, { email = `${sub}@gmail.com`, claims = {}, address, purpose = 'login', token: session } = {}) {
  const { body: { nonce } } = await api.call('POST', 'auth/nonce', { body: { purpose }, token: session, address });
  const t = now();
  const id_token = await idToken({ iss: provider === 'apple' ? 'https://appleid.apple.com' : 'https://accounts.google.com', aud: provider === 'apple' ? APPLE : GOOGLE,
    sub, email, email_verified: true, nonce, iat: t, exp: t + 600, ...claims });
  return { nonce, id_token };
}
async function login(api, provider, sub, options = {}) {
  const proof = await providerLogin(api, provider, sub, options);
  return api.call('POST', `auth/${provider}`, { body: { ...proof, platform: 'android' }, address: options.address });
}
/** Nouveau joueur avec pseudo choisi : renvoie son jeton de session. */
async function player(api, sub, username = sub.slice(0, 16), newsletter = false) {
  const { body } = await login(api, 'google', sub);
  const done = await api.call('PATCH', 'me', { token: body.token, body: { username, newsletter } });
  assert.equal(done.status, 200, JSON.stringify(done.body));
  return body.token;
}
const ageMatch = (api, id, seconds) => api.sql('UPDATE multiplayer_matches SET started_at = started_at - ? WHERE id = ?', seconds, id);
const ageRun = (api, id, seconds) => api.sql('UPDATE game_runs SET created_at = created_at - ? WHERE id = ?', seconds, id);

// ---- Catalogue des candidats -----------------------------------------------------
test('Catalogue : suit les styles et les candidats mineurs du jeu', () => {
  assert.deepEqual(STYLE_UNLOCKS, Object.fromEntries(Object.entries(CAMPAIGN_STYLES).map(([f, styles]) => [f, styles.map(s => s.id)])));
  assert.deepEqual(MINOR_UNLOCKS, MINOR_FACTIONS);
  assert.deepEqual(DEFAULT_UNLOCKED, Object.values(DEFAULT_UNLOCKS).flat());
  assert.deepEqual(DEFAULT_UNLOCKED, ['melenchon_universaliste', 'le_pen_souverainiste', 'philippe_gestionnaire']);
  assert.equal(UNLOCKABLE_IDS.length, 12);
  assert.equal(NEWSLETTER_CONSENT_VERSION, ACCOUNT_NEWSLETTER_VERSION, 'Le texte de la case et sa version doivent changer ensemble.');
});

test('K.-O. : noté pendant la partie, gagné seulement à la fin normale', () => {
  const state = { tick: 10, phase: 'CAMPAIGN' };
  const player = { faction_id: 'melenchon' };
  recordKnockout(state, player, { role: 'CANDIDAT', minor: true, faction_id: 'roussel' });
  recordKnockout(state, { faction_id: 'melenchon' }, { role: 'CANDIDAT', minor: false, faction_id: 'le_pen', current_campaign_style: 'le_pen_zemmouriste' });
  recordKnockout(state, player, { role: 'CANDIDAT', minor: false, faction_id: 'philippe', current_campaign_style: 'philippe_gestionnaire' }); // style de départ
  recordKnockout(state, { faction_id: 'le_pen' }, { role: 'CANDIDAT', minor: true, faction_id: 'attal' });
  recordKnockout(state, player, { role: 'CANDIDAT', minor: true, faction_id: 'roussel' });
  // Abandon : la partie n'est pas terminée → rien.
  assert.deepEqual(earnedUnlocks(state, 'melenchon'), []);
  state.phase = 'RESULTS'; state.result = { winner: 'melenchon', second: 'le_pen' };
  assert.deepEqual(earnedUnlocks(state, 'melenchon'), ['roussel', 'le_pen_zemmouriste']);
  // Pas de victoire, pas de déblocage : le K.-O. d'Attal par Le Pen ne compte pas.
  assert.deepEqual(earnedUnlocks(state, 'le_pen'), []);
  state.result = { winner: 'le_pen', second: 'melenchon' };
  assert.deepEqual(earnedUnlocks(state, 'le_pen'), ['attal']);
  assert.deepEqual(earnedUnlocks(state, 'melenchon'), [], 'élection perdue');
});

test('Elo : classique à 2, somme nulle à 3, provisoire puis stable', () => {
  const duel = eloChanges([{ id: 'a', rating: 1000, games: 0, placement: 1 }, { id: 'b', rating: 1000, games: 0, placement: 2 }]);
  assert.equal(duel.get('a'), 20); assert.equal(duel.get('b'), -20);
  const trio = eloChanges([{ id: 'a', rating: 1000, games: 20, placement: 1 }, { id: 'b', rating: 1100, games: 20, placement: 2 }, { id: 'c', rating: 900, games: 20, placement: 3 }]);
  assert.ok(Math.abs([...trio.values()].reduce((s, v) => s + v, 0)) < 1e-9);
  assert.ok(trio.get('a') > 0 && trio.get('c') < 0);
  const upset = eloChanges([{ id: 'a', rating: 800, games: 20, placement: 1 }, { id: 'b', rating: 1200, games: 20, placement: 2 }]);
  assert.ok(upset.get('a') > 20, 'Battre un joueur bien plus fort rapporte plus.');
});

// ---- Authentification ------------------------------------------------------------
test('Auth Google : création du compte, session persistante, déconnexion', async () => {
  const api = makeApi();
  const first = await login(api, 'google', 'g-111');
  assert.equal(first.status, 200, JSON.stringify(first.body));
  assert.equal(first.body.created, true);
  assert.match(first.body.token, /^ptj_/);
  assert.equal(first.body.me.user.status, 'pending_profile');
  assert.match(first.body.me.user.id, /^u_[a-f0-9]{32}$/);
  // Nouveau compte : uniquement les trois candidats de départ.
  assert.deepEqual(first.body.me.unlocks.sort(), [...DEFAULT_UNLOCKED].sort());
  // Session retrouvée (jeu relancé).
  const me = await api.call('GET', 'me', { token: first.body.token });
  assert.equal(me.status, 200); assert.equal(me.body.user.id, first.body.me.user.id);
  // Le jeton n'est jamais stocké en clair.
  assert.equal(api.sql('SELECT * FROM sessions WHERE token_hash = ?', first.body.token).length, 0);
  // Même compte Google sur un autre appareil → même compte PartageTonJeu.
  const again = await login(api, 'google', 'g-111');
  assert.equal(again.body.created, false); assert.equal(again.body.me.user.id, first.body.me.user.id);
  // Déconnexion : ce jeton ne sert plus, l'autre appareil reste connecté.
  assert.equal((await api.call('POST', 'auth/logout', { token: first.body.token })).status, 200);
  assert.equal((await api.call('GET', 'me', { token: first.body.token })).body.error.code, 'session_invalid');
  assert.equal((await api.call('GET', 'me', { token: again.body.token })).status, 200);
  // Tout déconnecter.
  await api.call('POST', 'auth/logout-all', { token: again.body.token });
  assert.equal((await api.call('GET', 'me', { token: again.body.token })).status, 401);
});

test('Auth : jetons invalides, nonce rejoué, session expirée', async () => {
  const api = makeApi();
  const t = now();
  const base = { iss: 'https://accounts.google.com', aud: GOOGLE, sub: 'g-x', iat: t, exp: t + 600 };
  const attempt = async (claims, options) => {
    const { body: { nonce } } = await api.call('POST', 'auth/nonce');
    return api.call('POST', 'auth/google', { body: { id_token: await idToken({ ...base, nonce, ...claims }, options), nonce } });
  };
  assert.equal((await attempt({}, { key: otherKeys.privateKey })).body.error.code, 'invalid_token', 'mauvaise signature');
  assert.equal((await attempt({ aud: 'autre-jeu' })).body.error.code, 'invalid_token', 'mauvais destinataire');
  assert.equal((await attempt({ iss: 'https://pirate.example' })).body.error.code, 'invalid_token', 'mauvais émetteur');
  assert.equal((await attempt({ exp: t - 3600, iat: t - 7200 })).body.error.code, 'invalid_token', 'expiré');
  assert.equal((await attempt({ nonce: 'un-autre-nonce-quelconque' })).body.error.code, 'invalid_token', 'nonce différent');
  // Jeton forgé « à la main » : pas de signature.
  assert.equal((await api.call('POST', 'auth/google', { body: { id_token: `${b64({ alg: 'none' })}.${b64(base)}.`, nonce: 'x'.repeat(32) } })).status, 400);
  // Rejeu : un nonce ne sert qu'une fois.
  const proof = await providerLogin(api, 'google', 'g-replay');
  assert.equal((await api.call('POST', 'auth/google', { body: proof })).status, 200);
  assert.equal((await api.call('POST', 'auth/google', { body: proof })).body.error.code, 'invalid_nonce');
  // Le client ne peut pas imposer son identité : un simple « userId » est ignoré.
  assert.equal((await api.call('POST', 'auth/google', { body: { userId: 'u_1', email: 'x@gmail.com' } })).status, 400);
  // Aucune connexion sans Google ou Apple (pas de « connexion de test »), ni fournisseur inconnu.
  assert.equal((await api.call('POST', 'auth/dev', { body: { dev_subject: 'test1' } })).body.error.code, 'provider_disabled');
  assert.equal((await makeApi({ GOOGLE_CLIENT_IDS: '' }).call('POST', 'auth/google', { body: proof })).body.error.code, 'provider_disabled', 'Google non configuré');
  // Session expirée.
  const { body } = await login(api, 'google', 'g-exp');
  api.sql('UPDATE sessions SET expires_at = ?', now() - 1);
  assert.equal((await api.call('GET', 'me', { token: body.token })).body.error.code, 'session_expired');
  assert.equal((await api.call('GET', 'me', { token: 'ptj_' + 'a'.repeat(43) })).body.error.code, 'session_invalid');
});

test('Auth : limitation des tentatives et des créations de comptes par adresse', async () => {
  const api = makeApi();
  const address = '203.0.113.9';
  let refused = null;
  for (let i = 0; i < 12 && !refused; i++) {
    const result = await login(api, 'google', `g-mass-${i}`, { address });
    if (result.status === 429) refused = i;
  }
  assert.ok(refused !== null && refused <= 9, 'création massive de comptes bloquée');
  assert.equal(api.sql('SELECT COUNT(*) AS n FROM users')[0].n, 8);
  assert.equal(api.sql("SELECT COUNT(*) AS n FROM rate_limits WHERE key LIKE '%203.0.113.9%'")[0].n, 0, 'aucune adresse IP stockée');
});

// ---- Pseudo, profil et actualités -----------------------------------------------
test('Pseudo : règles, unicité insensible à la casse et aux accents', async () => {
  const api = makeApi();
  const a = (await login(api, 'google', 'g-a')).body.token, b = (await login(api, 'google', 'g-b')).body.token;
  for (const [username, code] of [['', 'username_empty'], ['   ', 'username_empty'], ['ab', 'username_length'], ['x'.repeat(17), 'username_length'],
    ['mon pseudo', 'username_chars'], ['<script>', 'username_chars'], ['1234', 'username_chars'], ['BetaTest', 'username_reserved'], ['PartageTonJeu_', 'username_reserved']]) {
    assert.equal((await api.call('PATCH', 'me', { token: a, body: { username } })).body.error.code, code, username);
  }
  // Sans pseudo, pas de multijoueur.
  assert.equal((await api.call('POST', 'runs', { token: a, body: { mode: 'campaign', faction: 'melenchon' } })).body.error.code, 'profile_required');
  const ok = await api.call('PATCH', 'me', { token: a, body: { username: '  Élodie_75  ', newsletter: false } });
  assert.equal(ok.status, 200); assert.equal(ok.body.user.username, 'Élodie_75'); assert.equal(ok.body.user.status, 'active');
  assert.deepEqual(await api.call('GET', 'usernames/check?username=elodie_75', { token: b }).then(r => r.body), { available: false, code: 'username_taken', message: 'Ce pseudo est déjà pris.' });
  assert.equal((await api.call('PATCH', 'me', { token: b, body: { username: 'ELODIE_75' } })).body.error.code, 'username_taken');
  assert.equal((await api.call('PATCH', 'me', { token: b, body: { username: 'Marius' } })).status, 200);
  // Le joueur ne peut modifier que les champs autorisés, et seulement les siens.
  const sneaky = await api.call('PATCH', 'me', { token: b, body: { status: 'admin', id: 'u_autre', rating: 9999 } });
  assert.equal(sneaky.status, 200); assert.equal(sneaky.body.user.status, 'active'); assert.equal(sneaky.body.user.username, 'Marius');
  // Changement de pseudo : un par jour.
  assert.equal((await api.call('PATCH', 'me', { token: b, body: { username: 'Marius2' } })).body.error.code, 'username_cooldown');
});

test('Actualités : case refusée par défaut, consentement tracé, e-mail du compte distinct', async () => {
  const api = makeApi();
  const refuse = (await login(api, 'google', 'g-no')).body;
  const accept = (await login(api, 'apple', 'a-yes', { email: 'abc123@privaterelay.appleid.com', claims: { is_private_email: 'true' } })).body;
  // Se connecter n'est pas consentir.
  assert.equal(api.sql('SELECT COUNT(*) AS n FROM marketing_consents')[0].n, 0);
  assert.equal(refuse.me.newsletter.granted, false);
  // Refus : compte créé normalement, multijoueur accessible.
  const r = await api.call('PATCH', 'me', { token: refuse.token, body: { username: 'Refuse', newsletter: false } });
  assert.equal(r.body.user.status, 'active'); assert.equal(r.body.newsletter.granted, false);
  assert.equal((await api.call('POST', 'runs', { token: refuse.token, body: { mode: 'campaign', faction: 'le_pen' } })).status, 200);
  // Acceptation (adresse relais Apple : aucune autre adresse demandée).
  const y = await api.call('PATCH', 'me', { token: accept.token, body: { username: 'Accepte', newsletter: true } });
  assert.equal(y.body.newsletter.granted, true); assert.equal(y.body.newsletter.version, NEWSLETTER_CONSENT_VERSION);
  assert.deepEqual(y.body.identities.map(i => [i.provider, i.email, i.email_is_private_relay]), [['apple', 'abc123@privaterelay.appleid.com', true]]);
  assert.deepEqual(api.sql('SELECT username, email FROM newsletter_subscribers'), [{ username: 'Accepte', email: 'abc123@privaterelay.appleid.com' }]);
  // Historique : on ajoute, on n'écrase pas.
  await api.call('PATCH', 'me', { token: accept.token, body: { newsletter: false } });
  assert.deepEqual(api.sql('SELECT granted, source FROM marketing_consents WHERE user_id = ? ORDER BY id', y.body.user.id).map(r => [r.granted, r.source]), [[1, 'onboarding'], [0, 'settings']]);
  assert.equal(api.sql('SELECT COUNT(*) AS n FROM newsletter_subscribers')[0].n, 0);
  // Désinscription depuis l'e-mail (lien signé).
  await api.call('PATCH', 'me', { token: accept.token, body: { newsletter: true } });
  const link = new URL(await unsubscribeLink(api.env, 'https://api.test', y.body.user.id));
  const path = `newsletter/unsubscribe${link.search}`;
  assert.match((await api.call('GET', path)).body, /Me désinscrire/);
  assert.equal(api.sql('SELECT COUNT(*) AS n FROM newsletter_subscribers')[0].n, 1, 'ouvrir le lien ne désinscrit pas');
  assert.match((await api.call('POST', path)).body, /C’est fait/);
  assert.equal(api.sql('SELECT COUNT(*) AS n FROM newsletter_subscribers')[0].n, 0);
  assert.match((await api.call('POST', `newsletter/unsubscribe?u=${y.body.user.id}&t=faux`)).body, /invalide/);
});

test('Apple : adresse relais, e-mail absent aux connexions suivantes', async () => {
  const api = makeApi({ APPLE_RELAY_DOMAINS: 'privaterelay.appleid.com,relay.example.apple' });
  const first = (await login(api, 'apple', 'a-1', { email: 'zz@relay.example.apple' })).body;
  assert.equal(first.me.identities[0].email_is_private_relay, true);
  const next = (await login(api, 'apple', 'a-1', { claims: { email: undefined } })).body;
  assert.equal(next.me.identities[0].email, 'zz@relay.example.apple');
});

// ---- Liaison et suppression -------------------------------------------------------
test('Liaison Google + Apple, sans fusion automatique par e-mail', async () => {
  const api = makeApi();
  const g = await player(api, 'g-link', 'Liant');
  // Même e-mail chez Apple : un AUTRE compte, jamais fusionné.
  const separate = await login(api, 'apple', 'a-other', { email: 'g-link@gmail.com' });
  assert.equal(separate.body.created, true);
  // Liaison explicite depuis le compte connecté.
  const proof = await providerLogin(api, 'apple', 'a-link', { purpose: 'link', token: g, email: 'r@privaterelay.appleid.com' });
  const linked = await api.call('POST', 'account/link/apple', { token: g, body: proof });
  assert.equal(linked.status, 200); assert.deepEqual(linked.body.identities.map(i => i.provider), ['google', 'apple']);
  // Se connecter avec Apple ouvre le même compte.
  assert.equal((await login(api, 'apple', 'a-link')).body.me.user.username, 'Liant');
  // Une identité déjà utilisée ailleurs n'est pas volée.
  const steal = await providerLogin(api, 'apple', 'a-other', { purpose: 'link', token: g });
  assert.equal((await api.call('POST', 'account/link/google', { token: g, body: steal })).body.error.code, 'invalid_token');
  const g2 = await player(api, 'g-second', 'Second');
  const proof2 = await providerLogin(api, 'apple', 'a-other', { purpose: 'link', token: g2 });
  assert.equal((await api.call('POST', 'account/link/apple', { token: g2, body: proof2 })).body.error.code, 'identity_in_use');
  // Un nonce de connexion ne sert pas à lier (et inversement).
  const wrong = await providerLogin(api, 'apple', 'a-zzz', { purpose: 'login' });
  assert.equal((await api.call('POST', 'account/link/apple', { token: g2, body: wrong })).body.error.code, 'invalid_nonce');
  // Adresse des actualités : par défaut la dernière utilisée (Apple), sinon celle choisie parmi les comptes liés.
  api.sql("UPDATE auth_identities SET last_login_at = last_login_at - 60 WHERE provider = 'google' AND provider_subject = 'g-link'");
  const subscribed = await api.call('PATCH', 'me', { token: g, body: { newsletter: true } });
  assert.equal(subscribed.body.newsletter.provider, 'apple');
  assert.equal(api.sql("SELECT email FROM newsletter_subscribers WHERE username = 'Liant'")[0].email, 'a-link@gmail.com');
  assert.equal((await api.call('PATCH', 'me', { token: g, body: { newsletter_provider: 'google' } })).body.newsletter.provider, 'google');
  assert.equal(api.sql("SELECT email FROM newsletter_subscribers WHERE username = 'Liant'")[0].email, 'g-link@gmail.com');
  assert.equal((await api.call('PATCH', 'me', { token: g, body: { newsletter_provider: 'facebook' } })).body.error.code, 'invalid_input', 'jamais une adresse non liée');
  // Délier : jamais le dernier moyen de connexion.
  assert.equal((await api.call('DELETE', 'account/link/apple', { token: g })).body.identities.length, 1);
  assert.equal((await api.call('DELETE', 'account/link/google', { token: g })).body.error.code, 'last_identity');
});

test('Suppression du compte : données personnelles effacées, sessions révoquées', async () => {
  const api = makeApi();
  const token = await player(api, 'g-del', 'Partant', true);
  const other = await player(api, 'g-stay', 'Restant');
  const { body: me } = await api.call('GET', 'me', { token });
  assert.equal((await api.call('DELETE', 'account', { token, body: {} })).body.error.code, 'confirmation_required');
  assert.equal((await api.call('DELETE', 'account', { token: other, body: { confirm: 'SUPPRIMER', user_id: me.user.id } })).status, 200, 'supprime le compte de la session, pas un autre');
  assert.equal((await api.call('GET', 'me', { token })).status, 200, 'le premier compte existe toujours');
  assert.equal((await api.call('DELETE', 'account', { token, body: { confirm: 'SUPPRIMER' } })).status, 200);
  assert.equal((await api.call('GET', 'me', { token })).status, 401);
  const id = me.user.id;
  for (const table of ['auth_identities', 'sessions', 'marketing_consents', 'player_candidate_unlocks', 'player_ratings']) {
    assert.equal(api.sql(`SELECT COUNT(*) AS n FROM ${table} WHERE user_id = ?`, id)[0].n, 0, table);
  }
  assert.deepEqual(api.sql('SELECT username, username_key, status FROM users WHERE id = ?', id), [{ username: null, username_key: null, status: 'deleted' }]);
  // Le pseudo est libéré, et se reconnecter crée un compte neuf.
  const again = await login(api, 'google', 'g-del');
  assert.equal(again.body.created, true); assert.notEqual(again.body.me.user.id, id);
  assert.equal((await api.call('PATCH', 'me', { token: again.body.token, body: { username: 'Partant' } })).status, 200);
});

test('Apple : révocation à la suppression avec un code d’autorisation', async () => {
  const { privateKey } = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign']);
  const pem = `-----BEGIN PRIVATE KEY-----\n${Buffer.from(await crypto.subtle.exportKey('pkcs8', privateKey)).toString('base64')}\n-----END PRIVATE KEY-----`;
  const env = { APPLE_TEAM_ID: 'TEAMID1234', APPLE_KEY_ID: 'KEYID12345', APPLE_PRIVATE_KEY: pem, APPLE_CLIENT_IDS: APPLE };
  const secret = await appleClientSecret(env, APPLE);
  assert.equal(JSON.parse(Buffer.from(secret.split('.')[1], 'base64url')).iss, 'TEAMID1234');
  const calls = [];
  const fakeApple = async (url, init) => { calls.push([url, new URLSearchParams(init.body).get('grant_type') || new URLSearchParams(init.body).get('token_type_hint')]); return new Response(url.endsWith('/token') ? JSON.stringify({ refresh_token: 'r' }) : '', { status: 200 }); };
  assert.equal(await revokeAppleAuthorization(env, 'code-apple', { fetcher: fakeApple }), true);
  assert.deepEqual(calls, [['https://appleid.apple.com/auth/token', 'authorization_code'], ['https://appleid.apple.com/auth/revoke', 'refresh_token']]);
  assert.equal(await revokeAppleAuthorization({}, 'code'), false, 'non configuré : rien à faire');
});

// ---- Progression (candidats débloqués) -----------------------------------------
test('Progression solo : abandon, fin normale, durée, rejeu et requête forgée', async () => {
  const api = makeApi();
  const token = await player(api, 'g-prog', 'Joueuse');
  const start = () => api.call('POST', 'runs', { token, body: { mode: 'campaign', faction: 'melenchon' } }).then(r => r.body.run_id);
  // K.-O. puis abandon : la partie n'est jamais terminée → toujours verrouillé.
  await start();
  assert.deepEqual((await api.call('GET', 'progression', { token })).body.unlocks.sort(), [...DEFAULT_UNLOCKED].sort());
  // Fin envoyée trop tôt : refusée.
  const early = await start();
  assert.equal((await api.call('POST', `runs/${early}/complete`, { token, body: { knockouts: ['roussel'] } })).body.error.code, 'implausible_run');
  // Fin normale avec plusieurs K.-O. : tous débloqués.
  const run = await start();
  ageRun(api, run, SOLO_CAMPAIGN_MIN_SECONDS + 5);
  const done = await api.call('POST', `runs/${run}/complete`, { token, body: { knockouts: ['roussel', 'le_pen_zemmouriste', 'roussel'] } });
  assert.equal(done.status, 200); assert.deepEqual(done.body.unlocked, ['roussel', 'le_pen_zemmouriste']);
  // Rejeu de la même fin : refusé, pas de doublon.
  assert.equal((await api.call('POST', `runs/${run}/complete`, { token, body: { knockouts: ['attal'] } })).body.error.code, 'run_closed');
  // Déjà débloqué : pas d'erreur, pas de doublon.
  const run2 = await start(); ageRun(api, run2, SOLO_CAMPAIGN_MIN_SECONDS + 5);
  assert.deepEqual((await api.call('POST', `runs/${run2}/complete`, { token, body: { knockouts: ['roussel'] } })).body.unlocked, []);
  assert.equal(api.sql("SELECT COUNT(*) AS n FROM player_candidate_unlocks WHERE candidate_id = 'roussel'")[0].n, 1);
  // Requêtes forgées : identifiant inconnu, candidat de départ, partie d'un autre, route directe.
  const run3 = await start(); ageRun(api, run3, SOLO_CAMPAIGN_MIN_SECONDS + 5);
  assert.equal((await api.call('POST', `runs/${run3}/complete`, { token, body: { knockouts: ['candidat_secret'] } })).status, 400);
  const thief = await player(api, 'g-thief', 'Voleur');
  assert.equal((await api.call('POST', `runs/${run3}/complete`, { token: thief, body: { knockouts: ['attal'] } })).status, 404);
  assert.equal((await api.call('POST', 'progression', { token: thief, body: { candidate_id: 'attal' } })).status, 405);
  assert.equal((await api.call('POST', 'unlocks', { token: thief, body: { candidate_id: 'attal' } })).status, 404);
  assert.equal((await api.call('POST', `runs/r_${'0'.repeat(32)}/complete`, { token: thief, body: { knockouts: ['attal'] } })).status, 404);
  assert.deepEqual((await api.call('GET', 'progression', { token: thief })).body.unlocks.sort(), [...DEFAULT_UNLOCKED].sort());
  // Redémarrage du jeu / autre appareil : même compte, mêmes déblocages.
  const otherDevice = (await login(api, 'google', 'g-prog')).body;
  assert.ok(otherDevice.me.unlocks.includes('roussel') && otherDevice.me.unlocks.includes('le_pen_zemmouriste'));
});

// ---- Multijoueur et classement ---------------------------------------------------
async function campaignMatch(api, [host, b, c], { report = true, order } = {}) {
  const seats = [hex16(), hex16(), hex16()];
  const created = await api.call('POST', 'matches', { token: host, body: { mode: 'campaign', format: 'trio', host_seat: seats[0],
    seats: [{ seat: seats[0], slot: 1, faction: 'melenchon' }, { seat: seats[1], slot: 2, faction: 'le_pen' }, { seat: seats[2], slot: 3, faction: 'philippe' }] } });
  assert.equal(created.status, 200, JSON.stringify(created.body));
  const { match_id, join_key } = created.body;
  assert.equal((await api.call('POST', `matches/${match_id}/join`, { token: b, body: { join_key, seat: seats[1] } })).status, 200);
  assert.equal((await api.call('POST', `matches/${match_id}/join`, { token: c, body: { join_key, seat: seats[2] } })).status, 200);
  ageMatch(api, match_id, 1000);
  const result = { placements: order ? order.map(i => seats[i]) : seats, knockouts: [{ seat: seats[0], candidate_id: 'glucksmann' }] };
  if (report) for (const t of [host, b, c]) assert.equal((await api.call('POST', `matches/${match_id}/result`, { token: t, body: result })).status, 200);
  return { match_id, join_key, seats, result };
}

test('Multijoueur : accès protégé, places, résultat unique, classement', async () => {
  const api = makeApi();
  const [a, b, c, d] = [await player(api, 'g-m1', 'Alpha'), await player(api, 'g-m2', 'Bravo'), await player(api, 'g-m3', 'Charlie'), await player(api, 'g-m4', 'Delta')];
  assert.equal((await api.call('POST', 'matches', { body: { mode: 'campaign' } })).status, 401, 'sans compte : refusé');
  const seats = [hex16(), hex16(), hex16()];
  const { body: { match_id, join_key } } = await api.call('POST', 'matches', { token: a, body: { mode: 'campaign', format: 'trio', host_seat: seats[0],
    seats: [{ seat: seats[0], slot: 1, faction: 'melenchon' }, { seat: seats[1], slot: 2, faction: 'le_pen' }, { seat: seats[2], slot: 3, faction: 'philippe' }] } });
  assert.equal((await api.call('POST', `matches/${match_id}/join`, { token: b, body: { join_key: 'mauvaise-cle', seat: seats[1] } })).status, 403);
  assert.equal((await api.call('POST', `matches/${match_id}/join`, { token: b, body: { join_key, seat: seats[1] } })).status, 200);
  assert.equal((await api.call('POST', `matches/${match_id}/join`, { token: b, body: { join_key, seat: seats[2] } })).body.error.code, 'already_seated');
  assert.equal((await api.call('POST', `matches/${match_id}/join`, { token: c, body: { join_key, seat: seats[2] } })).status, 200);
  // Association correcte compte ↔ place.
  const users = Object.fromEntries(api.sql('SELECT seat, u.username FROM match_players p JOIN users u ON u.id = p.user_id WHERE match_id = ?', match_id).map(r => [r.seat, r.username]));
  assert.deepEqual(users, { [seats[0]]: 'Alpha', [seats[1]]: 'Bravo', [seats[2]]: 'Charlie' });
  const result = { placements: [seats[1], seats[0], seats[2]], knockouts: [{ seat: seats[1], candidate_id: 'attal' }] };
  // Résultat envoyé trop tôt (partie de campagne < 10 min) : refusé.
  assert.equal((await api.call('POST', `matches/${match_id}/result`, { token: a, body: result })).body.error.code, 'too_early');
  ageMatch(api, match_id, 1000);
  // Un étranger à la partie ne peut rien envoyer.
  assert.equal((await api.call('POST', `matches/${match_id}/result`, { token: d, body: result })).body.error.code, 'not_in_match');
  // Le client ne peut pas imposer un Elo ou un score : champs ignorés, valeurs calculées par le serveur.
  const first = await api.call('POST', `matches/${match_id}/result`, { token: a, body: { ...result, rating: 99999, score: 99999999 } });
  assert.equal(first.body.status, 'playing', 'attend les autres joueurs');
  assert.equal((await api.call('POST', `matches/${match_id}/result`, { token: a, body: result })).status, 200, 'même envoi : sans effet');
  assert.equal((await api.call('POST', `matches/${match_id}/result`, { token: a, body: { ...result, placements: [seats[0], seats[1], seats[2]] } })).body.error.code, 'already_reported');
  await api.call('POST', `matches/${match_id}/result`, { token: b, body: result });
  const last = await api.call('POST', `matches/${match_id}/result`, { token: c, body: result });
  assert.equal(last.body.status, 'completed'); assert.equal(last.body.ranked, true);
  assert.equal(last.body.me.placement, 3); assert.equal(last.body.me.result, 'loss'); assert.ok(last.body.me.rating_after < 1000);
  // Une seule application, même si on renvoie.
  await api.call('POST', `matches/${match_id}/result`, { token: b, body: result });
  assert.equal(api.sql('SELECT COUNT(*) AS n FROM rating_events WHERE match_id = ?', match_id)[0].n, 3);
  const winner = await api.call('GET', 'leaderboard/me?ladder=campaign', { token: b });
  assert.deepEqual([winner.body.rank, winner.body.wins, winner.body.losses, winner.body.games, winner.body.win_rate], [1, 1, 0, 1, 100]);
  assert.ok(winner.body.rating > 1000);
  const loser = await api.call('GET', 'leaderboard/me?ladder=campaign', { token: c });
  assert.deepEqual([loser.body.rank, loser.body.wins, loser.body.losses], [3, 0, 1]);
  // Classement global (public, pseudos seulement).
  const board = await api.call('GET', 'leaderboard?ladder=campaign', { token: a });
  assert.deepEqual(board.body.entries.map(e => [e.rank, e.username, e.is_me]), [[1, 'Bravo', false], [2, 'Alpha', true], [3, 'Charlie', false]]);
  assert.ok(board.body.entries.every(e => !('user_id' in e)));
  assert.equal(board.body.total, 3);
  // Déblocage par la partie multijoueur, pour le bon joueur seulement.
  assert.ok((await api.call('GET', 'me', { token: b })).body.unlocks.includes('attal'));
  assert.ok(!(await api.call('GET', 'me', { token: a })).body.unlocks.includes('attal'));
  // Un joueur absent du classement débat n'y a pas de rang.
  assert.equal((await api.call('GET', 'leaderboard/me?ladder=debate', { token: d })).body.ranked, false);
  // Victoire suivante : le classement bouge.
  await campaignMatch(api, [a, b, c], { order: [2, 1, 0] });
  const after = await api.call('GET', 'leaderboard?ladder=campaign');
  assert.equal(after.body.entries.find(e => e.username === 'Charlie').wins, 1);
});

test('Multijoueur : résultats contradictoires, délai, place usurpée, débat à 2', async () => {
  const api = makeApi();
  const [a, b, c, d] = [await player(api, 'g-d1', 'Unique'), await player(api, 'g-d2', 'Deux'), await player(api, 'g-d3', 'Trois'), await player(api, 'g-d4', 'Quatre')];
  // Contestation : rien n'est appliqué.
  const disputed = await campaignMatch(api, [a, b, c], { report: false });
  await api.call('POST', `matches/${disputed.match_id}/result`, { token: a, body: disputed.result });
  const lie = await api.call('POST', `matches/${disputed.match_id}/result`, { token: b, body: { ...disputed.result, placements: [disputed.seats[1], disputed.seats[0], disputed.seats[2]] } });
  assert.equal(lie.body.status, 'disputed');
  assert.equal(api.sql('SELECT COUNT(*) AS n FROM player_ratings')[0].n, 0);
  assert.equal(api.sql("SELECT COUNT(*) AS n FROM audit_log WHERE action = 'match_disputed'")[0].n, 1);
  // Délai dépassé : un seul rapport qui se désigne vainqueur n'est pas cru…
  const selfish = await campaignMatch(api, [a, b, c], { report: false });
  await api.call('POST', `matches/${selfish.match_id}/result`, { token: a, body: selfish.result });
  api.sql('UPDATE match_reports SET created_at = created_at - ? WHERE match_id = ?', REPORT_WINDOW_SECONDS + 1, selfish.match_id);
  await maintenance(api.env);
  assert.equal(api.sql('SELECT status FROM multiplayer_matches WHERE id = ?', selfish.match_id)[0].status, 'void');
  // … mais deux rapports concordants le sont (le troisième joueur a quitté).
  const partial = await campaignMatch(api, [a, b, c], { report: false });
  await api.call('POST', `matches/${partial.match_id}/result`, { token: a, body: partial.result });
  await api.call('POST', `matches/${partial.match_id}/result`, { token: c, body: partial.result });
  api.sql('UPDATE match_reports SET created_at = created_at - ? WHERE match_id = ?', REPORT_WINDOW_SECONDS + 1, partial.match_id);
  await maintenance(api.env);
  assert.equal(api.sql('SELECT status FROM multiplayer_matches WHERE id = ?', partial.match_id)[0].status, 'completed');
  // Place déjà prise par un autre compte : partie non classée.
  const seats = [hex16(), hex16()];
  const { body: duel } = await api.call('POST', 'matches', { token: a, body: { mode: 'debate', format: '1v1', host_seat: seats[0],
    seats: [{ seat: seats[0], slot: 1, faction: 'melenchon', style: 'melenchon_universaliste' }, { seat: seats[1], slot: 2, faction: 'philippe', style: 'philippe_gestionnaire' }] } });
  assert.equal((await api.call('POST', `matches/${duel.match_id}/join`, { token: b, body: { join_key: duel.join_key, seat: seats[1] } })).status, 200);
  assert.equal((await api.call('POST', `matches/${duel.match_id}/join`, { token: d, body: { join_key: duel.join_key, seat: seats[1] } })).body.error.code, 'seat_taken');
  ageMatch(api, duel.match_id, 30);
  for (const t of [a, b]) await api.call('POST', `matches/${duel.match_id}/result`, { token: t, body: { placements: [seats[1], seats[0]] } });
  const status = await api.call('GET', `matches/${duel.match_id}`, { token: b });
  assert.deepEqual([status.body.status, status.body.ranked, status.body.me.result], ['completed', false, 'win']);
  // Débat avec un candidat verrouillé (client modifié) : non classé.
  const s2 = [hex16(), hex16()];
  const { body: cheat } = await api.call('POST', 'matches', { token: c, body: { mode: 'debate', format: '1v1', host_seat: s2[0],
    seats: [{ seat: s2[0], slot: 1, faction: 'attal', style: 'attal_standard' }, { seat: s2[1], slot: 2, faction: 'le_pen', style: 'le_pen_souverainiste' }] } });
  assert.ok(cheat.match_id, 'tenue de base d’un mineur acceptée');
  assert.equal(api.sql('SELECT ranked FROM multiplayer_matches WHERE id = ?', cheat.match_id)[0].ranked, 0);
  // Données invalides.
  assert.equal((await api.call('POST', 'matches', { token: a, body: { mode: 'campaign', format: 'trio', host_seat: 'x', seats: [] } })).status, 400);
  assert.equal((await api.call('POST', `matches/${disputed.match_id}/result`, { token: a, body: { placements: ['a', 'b', 'c'] } })).status, 400);
});

test('Routes protégées : toutes refusent sans session', async () => {
  const api = makeApi();
  for (const [method, path] of [['GET', 'me'], ['PATCH', 'me'], ['GET', 'usernames/check?username=abc'], ['POST', 'auth/logout-all'], ['POST', 'account/link/apple'],
    ['DELETE', 'account/link/apple'], ['DELETE', 'account'], ['GET', 'progression'], ['POST', 'runs'], [`POST`, `runs/r_${'0'.repeat(32)}/complete`],
    ['POST', 'matches'], ['POST', `matches/m_${'0'.repeat(32)}/join`], ['POST', `matches/m_${'0'.repeat(32)}/result`], ['GET', `matches/m_${'0'.repeat(32)}`],
    ['GET', 'leaderboard/me'], ['POST', 'auth/nonce']]) {
    const body = method === 'GET' ? undefined : path === 'auth/nonce' ? { purpose: 'link' } : {};
    assert.equal((await api.call(method, path, { body })).status, 401, `${method} ${path}`);
  }
  assert.equal((await api.call('GET', 'config')).body.providers.join(), 'google,apple');
});

test('Worker : CORS de l’API et base absente', async () => {
  const env = { ALLOWED_ORIGINS: 'https://theofera.github.io' };
  const preflight = await worker.fetch(new Request('https://w.test/api/v1/me', { method: 'OPTIONS', headers: { Origin: 'https://theofera.github.io' } }), env);
  assert.match(preflight.headers.get('Access-Control-Allow-Headers'), /Authorization/);
  assert.match(preflight.headers.get('Access-Control-Allow-Methods'), /PATCH/);
  const refused = await worker.fetch(new Request('https://w.test/api/v1/config', { headers: { Origin: 'https://pirate.example' } }), env);
  assert.equal(refused.status, 403);
  const missing = await worker.fetch(new Request('https://w.test/api/v1/config', { headers: { Origin: 'https://theofera.github.io' } }), env);
  assert.equal(missing.status, 503);
  assert.equal(missing.headers.get('Access-Control-Allow-Origin'), 'https://theofera.github.io');
});

// ---- Côté jeu ----------------------------------------------------------------------
import { campaignConfig } from '../scripts/validate-campaign.mjs';
import { GameSimulation } from '../src/simulation/game-simulation.js';
import { hit } from '../src/simulation/combat-state.js';
import { AccountClient } from '../src/network/account-api.js';
import { matchDeclaration, campaignPlacements, campaignKnockouts, debatePlacements } from '../src/network/ranked-match.js';
import { applyAccountProgress, addDeviceUnlocks } from '../src/presentation/account-progress.js';
import { isCampaignStyleUnlocked, isMinorCandidateUnlocked, isBetatestProfile } from '../src/simulation/campaign-styles.js';

test('Simulation : un K.-O. de mineur par le joueur est noté, débloqué seulement aux résultats', () => {
  const config = campaignConfig(); config.balance.campaign_events.event_enabled = false;
  const sim = new GameSimulation(config, 42, 'candidate:melenchon');
  const target = sim.state.candidates.find(c => c.faction_id === 'roussel');
  const attacker = sim.state.candidates.find(c => c.faction_id === 'melenchon'); attacker.x = target.x;
  for (let i = 0; i < 10 && !target.is_ko; i++) hit(sim, attacker, target, { damage: 40, electoral_damage: 0, knockback: 0 }, `test:ko:${i}`);
  assert.deepEqual(sim.state.knockouts.map(k => [k.by_faction, k.candidate_id]), [['melenchon', 'roussel']]);
  assert.deepEqual(earnedUnlocks(sim.state, 'melenchon'), [], 'partie pas terminée');
  assert.deepEqual(earnedUnlocks({ ...sim.state, phase: 'RESULTS', result: { winner: 'melenchon' } }, 'melenchon'), ['roussel']);
  assert.deepEqual(earnedUnlocks({ ...sim.state, phase: 'RESULTS', result: { winner: 'philippe' } }, 'melenchon'), [], 'élection perdue');
});

/** Le client du jeu branché directement sur l'API (sans réseau). */
function clientFor(api, storage = new Map()) {
  const store = { getItem: k => storage.get(k) ?? null, setItem: (k, v) => storage.set(k, v), removeItem: k => storage.delete(k) };
  let online = true;
  const fetcherLocal = async (url, init) => {
    if (!online) throw new TypeError('Failed to fetch');
    return handleApi(new Request(url, { ...init, headers: { ...init.headers, 'CF-Connecting-IP': ip() } }), api.env, { fetcher });
  };
  return { client: new AccountClient({ base: 'https://api.test/api/v1', storage: store, fetcher: fetcherLocal, platform: 'android' }), storage, setOnline: v => { online = v; } };
}

test('Client du jeu : connexion, session retrouvée au redémarrage, hors ligne, expiration', async () => {
  const api = makeApi();
  const { client, storage, setOnline } = clientFor(api);
  assert.equal(client.signedIn, false); assert.equal(client.ready, false);
  await client.signIn('google', await providerLogin(api, 'google', 'g-mobile1'));
  assert.equal(client.signedIn, true); assert.equal(client.ready, false, 'pseudo à choisir');
  await client.updateProfile({ username: 'Mobile', newsletter: false });
  assert.equal(client.ready, true); assert.equal(client.username, 'Mobile');
  // Jeu relancé : même stockage, session retrouvée sans reconnexion.
  const restarted = clientFor(api, storage);
  assert.equal(restarted.client.ready, true);
  assert.equal((await restarted.client.refresh()).user.username, 'Mobile');
  // Plus d'Internet : la session est gardée, l'erreur est compréhensible.
  restarted.setOnline(false);
  assert.equal((await restarted.client.refresh()).user.username, 'Mobile');
  await assert.rejects(restarted.client.leaderboard('campaign'), error => error.offline && /solo/.test(error.message));
  assert.equal(restarted.client.signedIn, true);
  // Session expirée côté serveur : oubliée sur l'appareil.
  restarted.setOnline(true);
  api.sql('UPDATE sessions SET expires_at = ?', now() - 1);
  await assert.rejects(restarted.client.refresh(), error => error.code === 'session_expired');
  assert.equal(restarted.client.signedIn, false);
  setOnline(true);
});

test('Progression affichée : compte connecté, puis retour à la progression de l’appareil', () => {
  const profile = { nickname: 'betatest' };
  addDeviceUnlocks(profile, ['attal', 'melenchon_populiste']);
  assert.ok(isMinorCandidateUnlocked(profile, 'attal'));
  const accounts = { signedIn: true, me: { user: { username: 'Compte', status: 'active' }, unlocks: [...DEFAULT_UNLOCKED, 'roussel'] } };
  applyAccountProgress(profile, accounts);
  // Connecté : seule la progression du compte compte (betatest compris).
  assert.equal(isBetatestProfile(profile), false);
  assert.ok(isMinorCandidateUnlocked(profile, 'roussel'));
  assert.ok(!isMinorCandidateUnlocked(profile, 'attal'));
  assert.ok(!isCampaignStyleUnlocked(profile, 'melenchon', 'melenchon_populiste'));
  assert.ok(isCampaignStyleUnlocked(profile, 'le_pen', 'le_pen_souverainiste'));
  // Déconnecté : la progression de l'appareil revient.
  applyAccountProgress(profile, { signedIn: false, me: null });
  assert.equal(isBetatestProfile(profile), true, 'profil de test retrouvé');
  profile.nickname = 'Joueur';
  assert.ok(isMinorCandidateUnlocked(profile, 'attal')); assert.ok(!isMinorCandidateUnlocked(profile, 'roussel'));
  assert.equal(profile.account, undefined);
});

test('Multijoueur : déclaration et ordre d’arrivée calculés depuis le salon existant', () => {
  const room = { mode: 'campaign', players: [{ id: 'aaaaaaaaaaaaaaaa', slot: 1, faction: 'melenchon' }, { id: 'bbbbbbbbbbbbbbbb', slot: 2, faction: 'le_pen' }, { id: 'cccccccccccccccc', slot: 3, faction: 'philippe' }] };
  assert.deepEqual(matchDeclaration(room, 'aaaaaaaaaaaaaaaa'), { mode: 'campaign', format: 'trio', host_seat: 'aaaaaaaaaaaaaaaa',
    seats: room.players.map(p => ({ seat: p.id, slot: p.slot, faction: p.faction, style: null })) });
  const state = { phase: 'RESULTS', result: { winner: 'philippe', second: 'melenchon' }, knockouts: [{ by_faction: 'le_pen', candidate_id: 'arthaud' }, { by_faction: 'philippe', candidate_id: 'roussel' }] };
  assert.deepEqual(campaignPlacements(room, state), ['cccccccccccccccc', 'aaaaaaaaaaaaaaaa', 'bbbbbbbbbbbbbbbb']);
  // Seul le vainqueur (Philippe) débloque : le K.-O. d'Arthaud par Le Pen ne compte pas.
  assert.deepEqual(campaignKnockouts(room, state), [{ seat: 'cccccccccccccccc', candidate_id: 'roussel' }]);
  assert.equal(campaignPlacements(room, { ...state, phase: 'CAMPAIGN' }), null, 'pas de résultat avant la fin');
  // Débat 1 contre 1 contre 1 avec une IA : l'IA est ignorée.
  const debate = { mode: 'debate', players: room.players.slice(0, 2), debate: { format: '1v1v1', fighters: [
    { faction: 'melenchon', style: 'melenchon_universaliste', player: 'aaaaaaaaaaaaaaaa' }, { faction: 'le_pen', style: 'le_pen_souverainiste', player: 'bbbbbbbbbbbbbbbb' }, { faction: 'attal', style: 'attal_standard', player: null }] } };
  assert.deepEqual(debatePlacements(debate, { phase: 'OVER', winner_id: 'candidate:attal', ko_order: ['candidate:le_pen', 'candidate:melenchon'] }), ['aaaaaaaaaaaaaaaa', 'bbbbbbbbbbbbbbbb']);
  // Débat en 3 rounds : le classement par rounds gagnés prime sur les K.-O. du dernier round.
  assert.deepEqual(debatePlacements(debate, { phase: 'OVER', winner_id: 'candidate:attal', ko_order: ['candidate:le_pen', 'candidate:melenchon'],
    standings: ['candidate:attal', 'candidate:melenchon', 'candidate:le_pen'] }), ['aaaaaaaaaaaaaaaa', 'bbbbbbbbbbbbbbbb']);
  assert.deepEqual(debatePlacements(debate, { phase: 'OVER', winner_id: 'candidate:attal', ko_order: [],
    standings: ['candidate:le_pen', 'candidate:attal', 'candidate:melenchon'] }), ['bbbbbbbbbbbbbbbb', 'aaaaaaaaaaaaaaaa']);
  assert.equal(matchDeclaration(debate, 'aaaaaaaaaaaaaaaa').format, '1v1v1');
});

test('Profil public : avatar débloqué seulement, meilleur titre gardé, classement avec médaillon', async () => {
  const api = makeApi();
  const token = await player(api, 'g-avatar', 'Avatar');
  // Un candidat pas encore débloqué ne peut pas servir d'avatar.
  assert.equal((await api.call('PATCH', 'me', { token, body: { avatar: 'roussel' } })).status, 400);
  assert.equal((await api.call('PATCH', 'me', { token, body: { avatar: 'le_pen_souverainiste' } })).body.user.avatar, 'le_pen_souverainiste');
  const run = (await api.call('POST', 'runs', { token, body: { mode: 'campaign', faction: 'melenchon' } })).body.run_id;
  ageRun(api, run, SOLO_CAMPAIGN_MIN_SECONDS + 5);
  await api.call('POST', `runs/${run}/complete`, { token, body: { knockouts: ['roussel', 'attal'] } });
  const me = (await api.call('PATCH', 'me', { token, body: { avatar: 'roussel' } })).body;
  assert.equal(me.user.avatar, 'roussel');
  assert.equal(me.user.title_rank, 2, '2 candidats gagnés : Militant');
  assert.equal(api.sql("SELECT title_rank FROM users WHERE username = 'Avatar'")[0].title_rank, 2);
});

test('Multijoueur : seul le vainqueur débloque les candidats qu’il a mis K.-O.', async () => {
  const api = makeApi();
  const players = [await player(api, 'g-w1', 'Premier'), await player(api, 'g-w2', 'Second'), await player(api, 'g-w3', 'Troisieme')];
  // Le joueur 1 a mis Glucksmann K.-O. mais finit 2e : rien.
  await campaignMatch(api, players, { order: [1, 0, 2] });
  assert.equal(api.sql("SELECT COUNT(*) AS n FROM player_candidate_unlocks WHERE candidate_id = 'glucksmann'")[0].n, 0);
  // Même K.-O., mais il gagne l'élection : débloqué, et son meilleur titre est retenu.
  await campaignMatch(api, players);
  assert.equal(api.sql("SELECT COUNT(*) AS n FROM player_candidate_unlocks WHERE candidate_id = 'glucksmann'")[0].n, 1);
  assert.equal(api.sql("SELECT title_rank FROM users WHERE username = 'Premier'")[0].title_rank, 1);
  const board = (await api.call('GET', 'leaderboard?ladder=campaign')).body.entries;
  assert.ok(board.every(e => 'avatar' in e && Number.isInteger(e.title_rank) && Number.isFinite(e.best_rating)));
});
