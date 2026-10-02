// Client de l'API des comptes PartageTonJeu (serveur-en-ligne/api).
// La session est un jeton propre au jeu (jamais le jeton Google/Apple), gardé dans le
// stockage de l'appareil : dans l'appli Android, ce stockage est privé à l'application.
// Sans Internet, la session est conservée : seules les actions en ligne échouent.
import { accountApiBase } from './account-config.js';

const SESSION_KEY = 'partagetonjeu:session:v1';
// Copie du dernier profil reçu, pour afficher le compte sans attendre (ou hors ligne).
const CACHE_KEY = 'partagetonjeu:compte:v1';

export class AccountError extends Error {
  constructor(message, { code = 'error', status = 0, offline = false } = {}) { super(message); Object.assign(this, { code, status, offline }); }
}

function read(storage, key) { try { return JSON.parse(storage?.getItem(key) || 'null'); } catch { return null; } }
function write(storage, key, value) { try { if (value == null) storage?.removeItem(key); else storage?.setItem(key, JSON.stringify(value)); } catch { /* Stockage indisponible : gardé pour cette session. */ } }

export class AccountClient {
  constructor({ base = accountApiBase(), storage = globalThis.localStorage, fetcher = globalThis.fetch?.bind(globalThis), platform = 'web' } = {}) {
    Object.assign(this, { base, storage, fetcher, platform, listeners: new Set() });
    this.session = read(storage, SESSION_KEY);
    this.me = this.session ? read(storage, CACHE_KEY) : null;
  }
  get signedIn() { return !!this.session?.token; }
  /** Connecté ET pseudo choisi : multijoueur et classement accessibles. */
  get ready() { return this.signedIn && this.me?.user?.status === 'active'; }
  get username() { return this.ready ? this.me.user.username : null; }
  onChange(listener) { this.listeners.add(listener); return () => this.listeners.delete(listener); }
  emit() { for (const listener of this.listeners) { try { listener(this); } catch (error) { console.error(error); } } }

  setMe(me) { this.me = me; write(this.storage, CACHE_KEY, me); this.emit(); return me; }
  setSession(token, expiresAt) { this.session = { token, expires_at: expiresAt }; write(this.storage, SESSION_KEY, this.session); }
  /** Oublie la session sur cet appareil (sans appeler le serveur). */
  forget() { this.session = null; this.me = null; write(this.storage, SESSION_KEY, null); write(this.storage, CACHE_KEY, null); this.emit(); }

  async request(method, path, body, { auth = true, timeout = 10000 } = {}) {
    if (!this.base) throw new AccountError('Les comptes en ligne ne sont pas disponibles dans cette version du jeu.', { code: 'not_configured' });
    const headers = { Accept: 'application/json' };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (auth && this.session?.token) headers.Authorization = `Bearer ${this.session.token}`;
    let response;
    try {
      response = await this.fetcher(`${this.base}/${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(timeout) });
    } catch {
      throw new AccountError('Pas de connexion Internet ou serveur injoignable. Vous pouvez continuer à jouer en solo.', { code: 'offline', offline: true });
    }
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const code = data?.error?.code || 'error';
      // Session expirée ou révoquée : on l'oublie. Une simple panne ne déconnecte jamais.
      if (response.status === 401 && auth && ['session_expired', 'session_invalid'].includes(code)) this.forget();
      throw new AccountError(data?.error?.message || 'Erreur du serveur. Réessayez dans un instant.', { code, status: response.status, offline: response.status >= 500 });
    }
    return data;
  }

  config() { return this.configPromise ??= this.request('GET', 'config', undefined, { auth: false }).catch(error => { this.configPromise = null; throw error; }); }
  async nonce(purpose = 'login') { return (await this.request('POST', 'auth/nonce', { purpose }, { auth: purpose !== 'login' })).nonce; }
  /** proof : { id_token, nonce } (Google/Apple) ou { dev_subject } (test). Le serveur vérifie tout. */
  async signIn(provider, proof) {
    const result = await this.request('POST', `auth/${provider}`, { ...proof, platform: this.platform }, { auth: false });
    this.setSession(result.token, result.expires_at);
    this.setMe(result.me);
    return result;
  }
  /** Met à jour le profil depuis le serveur ; hors ligne, garde la copie locale. */
  async refresh() {
    if (!this.signedIn) return null;
    try { return this.setMe(await this.request('GET', 'me')); }
    catch (error) { if (error.offline) return this.me; throw error; }
  }
  async updateProfile(patch) { return this.setMe(await this.request('PATCH', 'me', patch)); }
  checkUsername(username) { return this.request('GET', `usernames/check?username=${encodeURIComponent(username)}`); }
  async logout() {
    try { await this.request('POST', 'auth/logout', {}, { timeout: 5000 }); } catch { /* Hors ligne : la session sera effacée côté serveur à expiration. */ }
    this.forget();
  }
  async logoutAll() { await this.request('POST', 'auth/logout-all', {}); this.forget(); }
  async deleteAccount(extra = {}) { await this.request('DELETE', 'account', { confirm: 'SUPPRIMER', ...extra }); this.forget(); }
  async link(provider, proof) { return this.setMe(await this.request('POST', `account/link/${provider}`, proof)); }
  async unlink(provider) { return this.setMe(await this.request('DELETE', `account/link/${provider}`)); }

  leaderboard(ladder, limit = 50) { return this.request('GET', `leaderboard?ladder=${ladder}&limit=${limit}`); }
  myRank(ladder) { return this.request('GET', `leaderboard/me?ladder=${ladder}`); }

  startRun(faction) { return this.request('POST', 'runs', { mode: 'campaign', faction }); }
  async completeRun(runId, knockouts) {
    const result = await this.request('POST', `runs/${runId}/complete`, { knockouts });
    if (this.me) this.setMe({ ...this.me, unlocks: result.unlocks });
    return result;
  }
  createMatch(body) { return this.request('POST', 'matches', body); }
  joinMatch(id, body) { return this.request('POST', `matches/${id}/join`, body); }
  reportResult(id, body) { return this.request('POST', `matches/${id}/result`, body); }
  matchStatus(id) { return this.request('GET', `matches/${id}`); }
}
