// Fournisseurs de connexion côté jeu (AuthProvider). Chacun ne fait qu'une chose :
// obtenir un jeton d'identité signé par Google ou Apple, lié à un nonce délivré par
// notre serveur. Le serveur vérifie ce jeton puis crée la session PartageTonJeu.
//   - Navigateur : bouton officiel Google (Google Identity Services), Apple JS.
//   - Appli Android : pont natif (Credential Manager), car Google refuse les connexions
//     dans une WebView. iOS : le même pont (window.PTJNativeAuth) sera fourni par l'appli.
import { APP_BUILD } from '../app-build.js';
import { GOOGLE_WEB_CLIENT_ID, APPLE_SERVICES_ID, APPLE_REDIRECT_URI } from './account-config.js';

export class AuthCancelled extends Error { constructor() { super('Connexion annulée.'); } }

// ---- Pont natif (Android aujourd'hui, iOS demain) --------------------------------
// Contrat : PTJNativeAuth.providers() → '["google"]' ;
// PTJNativeAuth.signIn(fournisseur, nonce, clientId, requête) puis l'appli appelle
// window.PTJNativeAuthResult(requête, '{"id_token":…}' | '{"error":…, "cancelled":true}').
const bridge = () => globalThis.PTJNativeAuth;
export function nativeProviders() {
  try { const list = JSON.parse(bridge()?.providers?.() || '[]'); return Array.isArray(list) ? list : []; } catch { return []; }
}
const pending = new Map();
let serial = 0;
globalThis.PTJNativeAuthResult = (id, text) => {
  const waiter = pending.get(String(id));
  if (!waiter) return;
  pending.delete(String(id));
  let result;
  try { result = typeof text === 'string' ? JSON.parse(text) : text; } catch { result = { error: 'Réponse de connexion illisible.' }; }
  if (result?.id_token) waiter.resolve(result);
  else if (result?.cancelled) waiter.reject(new AuthCancelled());
  else waiter.reject(new Error(result?.error || 'La connexion a échoué.'));
};
function nativeSignIn(provider, nonce, clientId) {
  const id = String(++serial);
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    try { bridge().signIn(provider, nonce, clientId || '', id); } catch (error) { pending.delete(id); reject(error); }
  });
}

/** Nouvelle autorisation native (ex. code Apple exigé pour révoquer à la suppression du compte). */
export const nativeReauthorize = (provider, nonce) => nativeSignIn(provider, nonce, '');

// ---- Scripts des fournisseurs (navigateur seulement) ------------------------------
const scripts = new Map();
function loadScript(src) {
  if (!scripts.has(src)) scripts.set(src, new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src; script.async = true;
    script.onload = resolve; script.onerror = () => { scripts.delete(src); reject(new Error('Service de connexion injoignable. Vérifiez la connexion Internet.')); };
    document.head.append(script);
  }));
  return scripts.get(src);
}
const inBrowser = () => !APP_BUILD && !bridge();

function ownButton(provider, label) {
  const button = document.createElement('button');
  button.type = 'button'; button.className = `auth-button auth-${provider}`; button.dataset.provider = provider;
  button.innerHTML = `<span class="auth-logo" aria-hidden="true"></span><span>${label}</span>`;
  return button;
}
/** Bouton natif : nonce demandé au clic, puis connexion par l'appli. */
function nativeMount(provider, label, clientId) {
  return (container, { nonce, done, fail }) => {
    const button = ownButton(provider, label);
    button.onclick = async () => {
      button.disabled = true;
      try { const n = await nonce(); const result = await nativeSignIn(provider, n, clientId); done({ id_token: result.id_token, authorization_code: result.authorization_code, nonce: n }); }
      catch (error) { if (!(error instanceof AuthCancelled)) fail(error); }
      finally { button.disabled = false; }
    };
    container.append(button);
  };
}

/**
 * mount(conteneur, { nonce, done, fail, purpose }) affiche le bouton du fournisseur.
 * nonce() → nonce du serveur ; done(preuve) → à envoyer au serveur ; fail(erreur).
 */
export const AUTH_PROVIDERS = [
  {
    id: 'apple', label: 'Continuer avec Apple',
    available: () => nativeProviders().includes('apple') || inBrowser() && !!APPLE_SERVICES_ID && !!APPLE_REDIRECT_URI,
    async mount(container, options) {
      if (nativeProviders().includes('apple')) return nativeMount('apple', this.label, '')(container, options);
      const button = ownButton('apple', this.label);
      container.append(button);
      // Nonce et script préparés avant le clic : la fenêtre Apple doit s'ouvrir aussitôt.
      button.disabled = true;
      await loadScript('https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1/fr_FR/appleid.auth.js');
      const n = await options.nonce();
      globalThis.AppleID.auth.init({ clientId: APPLE_SERVICES_ID, scope: 'email', redirectURI: APPLE_REDIRECT_URI, usePopup: true, nonce: n });
      button.disabled = false;
      button.onclick = async () => {
        try {
          const { authorization } = await globalThis.AppleID.auth.signIn();
          options.done({ id_token: authorization.id_token, authorization_code: authorization.code, nonce: n });
        } catch (error) { if (error?.error !== 'popup_closed_by_user') options.fail(new Error('La connexion Apple a échoué.')); }
      };
    },
  },
  {
    id: 'google', label: 'Continuer avec Google',
    available: () => !!GOOGLE_WEB_CLIENT_ID && (nativeProviders().includes('google') || inBrowser()),
    async mount(container, options) {
      if (nativeProviders().includes('google')) return nativeMount('google', this.label, GOOGLE_WEB_CLIENT_ID)(container, options);
      // Navigateur : bouton officiel de Google, initialisé avec notre nonce.
      const slot = document.createElement('div'); slot.className = 'auth-google-slot';
      container.append(slot);
      await loadScript('https://accounts.google.com/gsi/client');
      const n = await options.nonce();
      globalThis.google.accounts.id.initialize({ client_id: GOOGLE_WEB_CLIENT_ID, nonce: n, ux_mode: 'popup', auto_select: false, itp_support: true,
        callback: response => response?.credential ? options.done({ id_token: response.credential, nonce: n }) : options.fail(new Error('La connexion Google a échoué.')) });
      globalThis.google.accounts.id.renderButton(slot, { type: 'standard', theme: 'filled_black', size: 'large', text: 'continue_with', shape: 'rectangular', locale: 'fr', width: 300 });
    },
  },
];

/** Fournisseurs utilisables ici (ordre d'affichage : Apple d'abord, comme le demande Apple sur iOS). */
export const availableProviders = (serverProviders = null) => AUTH_PROVIDERS.filter(p => p.available() && (!serverProviders || serverProviders.includes(p.id)));
/** Les comptes sont actifs dans cette version : au moins un moyen de connexion est configuré. */
export const accountsConfigured = () => AUTH_PROVIDERS.some(p => p.available());
