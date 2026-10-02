// Fournisseurs d'identité (AuthProvider). Ajouter un fournisseur = ajouter une entrée
// ici qui renvoie un « profil vérifié » { subject, email, email_verified, email_is_private_relay }.
// Le reste (comptes, sessions, liaison) ne dépend jamais du fournisseur.
import { verifyIdToken } from './oidc.js';
import { ApiError, list } from './util.js';

const yes = value => value === true || value === 'true';
/** Domaines des adresses relais d'Apple (« Masquer mon adresse e-mail »). Extensible par APPLE_RELAY_DOMAINS. */
export const relayDomains = env => list(env.APPLE_RELAY_DOMAINS || 'privaterelay.appleid.com');
export function isRelayEmail(email, env = {}) {
  const domain = String(email ?? '').toLowerCase().split('@')[1] || '';
  return relayDomains(env).some(d => domain === d || domain.endsWith(`.${d}`));
}
const cleanEmail = email => typeof email === 'string' && email.length <= 254 && /^[^\s@]+@[^\s@]+$/.test(email) ? email : null;

export const PROVIDERS = {
  google: {
    label: 'Google',
    // Identifiants client OAuth acceptés comme destinataires (web, Android, iOS), séparés par des virgules.
    audiences: env => list(env.GOOGLE_CLIENT_IDS),
    async verify(body, env, { nonce, fetcher, now }) {
      const claims = await verifyIdToken(body.id_token, {
        jwksUrl: 'https://www.googleapis.com/oauth2/v3/certs',
        issuers: ['https://accounts.google.com', 'accounts.google.com'],
        audiences: this.audiences(env), nonce, fetcher, now,
      });
      const verified = yes(claims.email_verified);
      return { subject: claims.sub, email: verified ? cleanEmail(claims.email) : null, email_verified: verified, email_is_private_relay: false };
    },
  },
  apple: {
    label: 'Apple',
    // Bundle ID de l'appli iOS et Services ID du web, séparés par des virgules.
    audiences: env => list(env.APPLE_CLIENT_IDS),
    async verify(body, env, { nonce, fetcher, now }) {
      const claims = await verifyIdToken(body.id_token, {
        jwksUrl: 'https://appleid.apple.com/auth/keys',
        issuers: ['https://appleid.apple.com'],
        audiences: this.audiences(env), nonce, fetcher, now,
      });
      // Apple n'envoie l'e-mail qu'à certaines connexions ; une adresse relais est une adresse normale pour nous.
      const email = cleanEmail(claims.email);
      return { subject: claims.sub, email, email_verified: !!email && claims.email_verified !== false && claims.email_verified !== 'false',
        email_is_private_relay: !!email && (yes(claims.is_private_email) || isRelayEmail(email, env)) };
    },
  },
};

export const isProviderEnabled = (name, env) => {
  const provider = Object.hasOwn(PROVIDERS, name) ? PROVIDERS[name] : null;
  return !!provider && provider.audiences(env).length > 0;
};
export const enabledProviders = env => Object.keys(PROVIDERS).filter(name => isProviderEnabled(name, env));

export function providerFor(name, env) {
  if (!isProviderEnabled(name, env)) throw new ApiError(404, 'provider_disabled', 'Ce mode de connexion n’est pas disponible.');
  return PROVIDERS[name];
}
