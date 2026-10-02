// Vérification des jetons d'identité OpenID Connect (Google, Apple) par le serveur.
// Le jeu ne transmet jamais « mon e-mail est … » : il transmet le jeton signé par
// Google ou Apple, et c'est ici qu'on vérifie la signature (clés publiques du
// fournisseur), l'émetteur, le destinataire (notre identifiant client), l'expiration
// et le nonce à usage unique délivré par notre serveur.
import { ApiError, fromBase64url, sha256Hex } from './util.js';

const decoder = new TextDecoder();
const invalid = (detail = '') => new ApiError(401, 'invalid_token', 'Connexion refusée : le jeton du fournisseur est invalide ou expiré.', detail ? { detail } : null);

// Clés publiques mises en cache (une heure) pour éviter un appel à chaque connexion.
const jwksCache = new Map();
async function signingKey(url, kid, fetcher, now) {
  for (let attempt = 0; attempt < 2; attempt++) {
    let entry = jwksCache.get(url);
    if (!entry || entry.expires < now || attempt === 1) {
      const response = await fetcher(url, { headers: { Accept: 'application/json' } });
      if (!response.ok) throw new ApiError(503, 'provider_unavailable', 'Le service de connexion ne répond pas. Réessayez dans un instant.');
      const data = await response.json();
      entry = { keys: Array.isArray(data?.keys) ? data.keys : [], expires: now + 3600 };
      jwksCache.set(url, entry);
    }
    const jwk = entry.keys.find(k => k.kid === kid && k.kty === 'RSA');
    if (jwk) return crypto.subtle.importKey('jwk', { kty: 'RSA', n: jwk.n, e: jwk.e, alg: 'RS256', ext: true }, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
  }
  throw invalid('clé inconnue');
}
export const clearJwksCache = () => jwksCache.clear();

/**
 * Vérifie un jeton d'identité RS256 et renvoie ses revendications (claims).
 * `nonce` : nonce brut délivré par notre serveur. Le jeton peut contenir ce nonce
 * tel quel (Google, Apple sur le web) ou son empreinte SHA-256 en hexadécimal
 * (convention d'Apple sur iOS natif) : les deux sont acceptés.
 */
export async function verifyIdToken(token, { jwksUrl, issuers, audiences, nonce, fetcher = globalThis.fetch, now = Math.floor(Date.now() / 1000), skew = 120, maxAge = 3600 }) {
  if (typeof token !== 'string' || token.length > 8192) throw invalid();
  const parts = token.split('.');
  if (parts.length !== 3) throw invalid();
  let header, claims;
  try { header = JSON.parse(decoder.decode(fromBase64url(parts[0]))); claims = JSON.parse(decoder.decode(fromBase64url(parts[1]))); }
  catch { throw invalid(); }
  if (header?.alg !== 'RS256' || typeof header.kid !== 'string') throw invalid('algorithme');
  const key = await signingKey(jwksUrl, header.kid, fetcher, now);
  let valid = false;
  try { valid = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, fromBase64url(parts[2]), new TextEncoder().encode(`${parts[0]}.${parts[1]}`)); }
  catch { valid = false; }
  if (!valid) throw invalid('signature');
  if (!issuers.includes(claims.iss)) throw invalid('émetteur');
  const aud = [].concat(claims.aud);
  if (!audiences.length || !aud.some(a => audiences.includes(a))) throw invalid('destinataire');
  if (typeof claims.exp !== 'number' || claims.exp + skew < now) throw invalid('expiré');
  if (typeof claims.iat === 'number' && (claims.iat - skew > now || now - claims.iat > maxAge + skew)) throw invalid('date');
  if (typeof claims.sub !== 'string' || !claims.sub || claims.sub.length > 255) throw invalid('sujet');
  if (nonce != null) {
    const expected = [nonce, await sha256Hex(nonce)];
    if (!expected.includes(claims.nonce)) throw invalid('nonce');
  }
  return claims;
}
