// Révocation « Sign in with Apple » à la suppression du compte (exigée par Apple pour
// les applis iOS). Le jeu ne garde aucun jeton Apple : au moment de supprimer, il
// demande une nouvelle autorisation Apple et envoie le « code d'autorisation » reçu ;
// le serveur l'échange puis révoque aussitôt le jeton obtenu.
// Secrets nécessaires (wrangler secret put) : APPLE_TEAM_ID, APPLE_KEY_ID, APPLE_PRIVATE_KEY.
import { ApiError, base64url, list } from './util.js';

export const appleRevocationConfigured = env => !!(env.APPLE_TEAM_ID && env.APPLE_KEY_ID && env.APPLE_PRIVATE_KEY && list(env.APPLE_CLIENT_IDS).length);

function pemToDer(pem) {
  const body = String(pem).replace(/-----[^-]+-----/g, '').replace(/\\n/g, '').replace(/\s+/g, '');
  return Uint8Array.from(atob(body), c => c.charCodeAt(0));
}

/** « client_secret » d'Apple : un JWT ES256 signé avec la clé .p8 (WebCrypto, format standard). */
export async function appleClientSecret(env, clientId, now = Math.floor(Date.now() / 1000)) {
  const key = await crypto.subtle.importKey('pkcs8', pemToDer(env.APPLE_PRIVATE_KEY), { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const encode = value => base64url(new TextEncoder().encode(JSON.stringify(value)));
  const unsigned = `${encode({ alg: 'ES256', kid: env.APPLE_KEY_ID })}.${encode({ iss: env.APPLE_TEAM_ID, iat: now, exp: now + 300, aud: 'https://appleid.apple.com', sub: clientId })}`;
  const signature = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, new TextEncoder().encode(unsigned));
  return `${unsigned}.${base64url(new Uint8Array(signature))}`;
}

/** Échange le code d'autorisation puis révoque le jeton (rien n'est stocké). */
export async function revokeAppleAuthorization(env, code, { clientId = list(env.APPLE_CLIENT_IDS)[0], fetcher = globalThis.fetch } = {}) {
  if (!appleRevocationConfigured(env)) return false;
  if (typeof code !== 'string' || code.length > 2048) throw new ApiError(400, 'invalid_input', 'Autorisation Apple invalide.');
  const secret = await appleClientSecret(env, clientId);
  const form = values => ({ method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(values).toString() });
  const tokenResponse = await fetcher('https://appleid.apple.com/auth/token', form({ client_id: clientId, client_secret: secret, code, grant_type: 'authorization_code' }));
  const tokens = tokenResponse.ok ? await tokenResponse.json() : null;
  const token = tokens?.refresh_token || tokens?.access_token;
  if (!token) throw new ApiError(502, 'apple_revoke_failed', 'Apple n’a pas confirmé l’autorisation. Réessayez.');
  const revoke = await fetcher('https://appleid.apple.com/auth/revoke', form({ client_id: clientId, client_secret: secret, token, token_type_hint: tokens.refresh_token ? 'refresh_token' : 'access_token' }));
  if (!revoke.ok) throw new ApiError(502, 'apple_revoke_failed', 'Apple n’a pas confirmé la révocation. Réessayez.');
  return true;
}
