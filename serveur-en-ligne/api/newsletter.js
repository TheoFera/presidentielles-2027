// Désinscription des e-mails d'actualité depuis un lien présent dans chaque e-mail.
// Lien signé (HMAC) : impossible de désinscrire quelqu'un d'autre en devinant un lien.
// Secret nécessaire : NEWSLETTER_UNSUBSCRIBE_SECRET (wrangler secret put).
// - GET  : petite page de confirmation (les robots qui ouvrent les liens ne désinscrivent personne) ;
// - POST : désinscription immédiate, compatible « List-Unsubscribe-Post: List-Unsubscribe=One-Click ».
import { ApiError, audit, hmacBase64url, hmacVerify, nowSeconds } from './util.js';
import { consentStatement, newsletterStatus } from './accounts.js';

const message = text => `uns:${text}`;

/** Lien à mettre dans chaque e-mail (et dans l'en-tête List-Unsubscribe). */
export async function unsubscribeLink(env, origin, userId) {
  if (!env.NEWSLETTER_UNSUBSCRIBE_SECRET) throw new ApiError(503, 'not_configured', 'Désinscription non configurée.');
  const url = new URL('/api/v1/newsletter/unsubscribe', origin);
  url.searchParams.set('u', userId);
  url.searchParams.set('t', await hmacBase64url(env.NEWSLETTER_UNSUBSCRIBE_SECRET, message(userId)));
  return url.href;
}

const page = (title, body, form = '') => new Response(`<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title>
<body style="font-family:system-ui,sans-serif;background:#0e1630;color:#f2f5ff;display:grid;place-items:center;min-height:100vh;margin:0;padding:16px;text-align:center"><main style="max-width:30em"><h1 style="color:#ffe275">${title}</h1><p>${body}</p>${form}</main></body></html>`,
  { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'" } });

export async function handleUnsubscribe(request, env, db) {
  const url = new URL(request.url);
  const userId = url.searchParams.get('u') || '', token = url.searchParams.get('t') || '';
  const valid = !!env.NEWSLETTER_UNSUBSCRIBE_SECRET && /^u_[a-f0-9]{32}$/.test(userId) && await hmacVerify(env.NEWSLETTER_UNSUBSCRIBE_SECRET, message(userId), token);
  if (!valid) return page('Lien invalide', 'Ce lien de désinscription est invalide ou incomplet.');
  if (request.method === 'GET') {
    const action = `?u=${encodeURIComponent(userId)}&t=${encodeURIComponent(token)}`;
    return page('Se désinscrire', 'Ne plus recevoir d’informations sur les prochaines créations de PartageTonJeu ?',
      `<form method="post" action="${action}"><button style="font:inherit;font-weight:800;padding:10px 18px;background:#ffe275;border:0;cursor:pointer">Me désinscrire</button></form>`);
  }
  const user = await db.prepare('SELECT status FROM users WHERE id = ?').bind(userId).first('status');
  if (user && user !== 'deleted' && (await newsletterStatus(db, userId)).granted) {
    await db.batch([consentStatement(db, userId, false, 'email_unsubscribe', nowSeconds()), audit(db, userId, 'newsletter_unsubscribed')]);
  }
  return page('C’est fait', 'Vous ne recevrez plus nos e-mails d’information. Votre compte et vos parties ne changent pas.');
}
