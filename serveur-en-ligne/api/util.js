// Outils communs de l'API des comptes : réponses JSON, erreurs, aléa et empreintes.
// Uniquement WebCrypto (disponible dans les Workers Cloudflare comme dans Node) : aucun algorithme maison.

/** Erreur destinée au joueur : code stable pour le jeu, message en français. */
export class ApiError extends Error {
  constructor(status, code, message, extra = null) { super(message); Object.assign(this, { status, code, extra }); }
}

export const nowSeconds = () => Math.floor(Date.now() / 1000);

export function json(value, status = 200, headers = {}) {
  return new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers } });
}

/** Corps JSON d'une requête : taille limitée, objet obligatoire. */
export async function readJson(request, maxBytes = 16384) {
  if (!['POST', 'PATCH', 'DELETE', 'PUT'].includes(request.method)) return {};
  const text = await request.text();
  if (!text) return {};
  if (text.length > maxBytes) throw new ApiError(413, 'too_large', 'Requête trop volumineuse.');
  let value;
  try { value = JSON.parse(text); } catch { throw new ApiError(400, 'invalid_json', 'Requête illisible.'); }
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new ApiError(400, 'invalid_json', 'Requête illisible.');
  return value;
}

const hex = bytes => Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
export const randomHex = (bytes = 16) => hex(crypto.getRandomValues(new Uint8Array(bytes)));
/** Identifiant public non prédictible, par ex. « u_3f9c… ». */
export const randomId = (prefix, bytes = 16) => `${prefix}_${randomHex(bytes)}`;

export function base64url(bytes) {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
export function fromBase64url(text) {
  const base64 = String(text).replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(base64 + '='.repeat((4 - base64.length % 4) % 4));
  return Uint8Array.from(binary, c => c.charCodeAt(0));
}
export const randomToken = (bytes = 32) => base64url(crypto.getRandomValues(new Uint8Array(bytes)));

export async function sha256Hex(text) {
  return hex(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(text)))));
}
export async function hmacBase64url(secret, text) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return base64url(new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(text))));
}
export async function hmacVerify(secret, text, signature) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
  try { return await crypto.subtle.verify('HMAC', key, fromBase64url(signature), new TextEncoder().encode(text)); } catch { return false; }
}

export const list = value => String(value ?? '').split(',').map(s => s.trim()).filter(Boolean);
export const platformOf = value => ['android', 'ios', 'web'].includes(value) ? value : 'web';

/** Journal d'enquête : identifiant interne et action seulement, jamais d'e-mail, de jeton ni d'IP. */
export function audit(db, userId, action, target = null, detail = null) {
  return db.prepare('INSERT INTO audit_log (created_at, user_id, action, target, detail) VALUES (?, ?, ?, ?, ?)')
    .bind(nowSeconds(), userId ?? null, action, target ?? null, detail == null ? null : String(detail).slice(0, 300));
}
