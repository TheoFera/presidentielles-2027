import { PeerSession, decodeInvitation } from './peer-session.js';
import { onlineServer } from './online-config.js';
import { cleanName, joinable } from './lobby.js';
import { cleanPlayerCard } from '../simulation/player-titles.js';

// Multijoueur en ligne : la même connexion directe WebRTC que le mode Wi-Fi, mais
// les invitations passent automatiquement par le serveur de salons au lieu des QR.
// L’hôte simule toujours la partie ; le serveur ne voit jamais l’état du jeu.

const STUN_ONLY = [{ urls: ['stun:stun.cloudflare.com:3478', 'stun:stun.l.google.com:19302'] }];
const ONLINE_ADVICE = 'Connexion impossible avec ce joueur : un des réseaux bloque les connexions directes. Réessayez sur un autre réseau (4G ou autre Wi-Fi).';
const OFFER_TIMEOUT_MS = 30000;
const LINK_TIMEOUT_MS = 45000;

/** Adresses STUN/TURN données par le serveur. En cas de panne, STUN seul (souvent suffisant). */
export async function onlineIceServers(server, fetcher = globalThis.fetch) {
  try {
    const response = await fetcher(`${server}/ice`, { signal: AbortSignal.timeout(6000) });
    const data = response.ok ? await response.json() : null;
    const servers = Array.isArray(data?.iceServers) ? data.iceServers.filter(s => s && (typeof s.urls === 'string' || Array.isArray(s.urls))) : [];
    if (servers.length) return servers;
  } catch { /* Serveur injoignable : on tente quand même. */ }
  return STUN_ONLY;
}

const timeout = (promise, ms, message) => {
  let timer;
  return Promise.race([promise, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(message)), ms); })]).finally(() => clearTimeout(timer));
};

export class OnlineSession extends PeerSession {
  constructor(callbacks, fingerprint, { server = onlineServer(), WebSocketClass = globalThis.WebSocket, fetcher = globalThis.fetch?.bind(globalThis) } = {}) {
    super(callbacks, fingerprint);
    // direct = false : le salon affiche un code à partager au lieu des QR.
    Object.assign(this, { online: true, direct: false, server, WebSocketClass, fetcher, guests: new Map(), waiters: [] });
  }

  async connect(action, data) {
    if (!this.server) throw new Error('Le jeu en ligne n’est pas encore configuré : renseignez l’adresse du serveur dans src/network/online-config.js.');
    if (typeof this.WebSocketClass !== 'function' || typeof RTCPeerConnection !== 'function') throw new Error('Ce navigateur ne permet pas le jeu en ligne. Essayez un navigateur à jour.');
    this.name = cleanName(data.name);
    this.card = cleanPlayerCard(data.card);
    this.iceServers = await onlineIceServers(this.server, this.fetcher);
    if (action === 'create') {
      await super.connect('create', data);
      const created = await this.openSignal({ action: 'create' }, 'created');
      this.code = this.room.code = created.code; this.key = created.key;
      return;
    }
    const code = String(data.code ?? '').trim().toUpperCase();
    if (!/^[A-F0-9]{6}$/.test(code)) throw new Error('Le code du salon fait 6 caractères : chiffres de 0 à 9 et lettres de A à F.');
    const offer = this.wait('offer');
    await this.openSignal({ action: 'join', code }, 'joined');
    const { invitation } = await timeout(offer, OFFER_TIMEOUT_MS, 'L’hôte ne répond pas. Vérifiez le code et demandez-lui de garder le jeu ouvert.');
    // Pendant la mise en relation, le jeu n’a pas encore cette session : on attend
    // nous-mêmes le premier salon envoyé par l’hôte (ou l’échec).
    const callbacks = this.callbacks;
    const linked = new Promise((resolve, reject) => {
      this.callbacks = { ...callbacks, room: resolve, ended: message => reject(new Error(message)) };
      this.waiters.push({ type: 'linked', resolve, reject });
    });
    try {
      await super.connect('join', { code: invitation });
      this.signal({ type: 'to-host', data: { type: 'answer', answer: this.answer } });
      await timeout(linked, LINK_TIMEOUT_MS, ONLINE_ADVICE);
    } finally { this.callbacks = callbacks; this.waiters = this.waiters.filter(w => w.type !== 'linked'); }
    // Relié à l’hôte : le serveur de salons ne sert plus.
    this.closeSignal();
  }

  // --- Connexion au serveur de salons -------------------------------------
  openSignal(params, expected) {
    const url = new URL('/salon', this.server.replace(/^http/, 'ws'));
    for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
    const socket = new this.WebSocketClass(url.href);
    this.socket = socket;
    const ready = this.wait(expected);
    socket.onmessage = event => {
      let message;
      try { message = JSON.parse(event.data); } catch { return; }
      if (socket === this.socket) this.signalMessage(message);
    };
    socket.onclose = () => { if (socket === this.socket) this.signalLost(); };
    socket.onerror = () => {};
    clearInterval(this.signalPing);
    this.signalPing = setInterval(() => this.signal({ type: 'ping' }), 25000);
    return timeout(ready, 10000, 'Le serveur de salons ne répond pas. Vérifiez la connexion internet.');
  }
  signal(message) { if (this.socket?.readyState === 1) this.socket.send(JSON.stringify(message)); }
  closeSignal() {
    clearInterval(this.signalPing); clearTimeout(this.resumeTimer);
    const socket = this.socket; this.socket = null;
    try { socket?.close(); } catch { /* Déjà fermée. */ }
  }
  wait(type) {
    const promise = new Promise((resolve, reject) => this.waiters.push({ type, resolve, reject }));
    promise.catch(() => {}); // L’erreur est lue par celui qui attend ; jamais « non gérée ».
    return promise;
  }
  settle(type, value) {
    const waiter = this.waiters.find(w => w.type === type);
    if (!waiter) return false;
    this.waiters = this.waiters.filter(w => w !== waiter); waiter.resolve(value); return true;
  }
  rejectWaiters(message) { const waiters = this.waiters.splice(0); waiters.forEach(w => w.reject(new Error(message))); return waiters.length > 0; }

  signalMessage(message) {
    if (message.type === 'error') { this.signalError = String(message.message); if (!this.rejectWaiters(this.signalError) && !this.host) this.fail(this.signalError); return; }
    if (['created', 'joined', 'resumed'].includes(message.type)) { this.settle(message.type, message); return; }
    if (this.host) { void this.hostMessage(message); return; }
    if (message.type === 'from-host' && message.data?.type === 'offer' && typeof message.data.invitation === 'string') this.settle('offer', message.data);
    else if (message.type === 'from-host' && message.data?.type === 'refused') this.rejectWaiters(String(message.data.message || 'L’hôte a refusé la connexion.'));
  }
  signalLost() {
    clearInterval(this.signalPing);
    this.socket = null;
    if (this.rejectWaiters(this.signalError || 'Connexion au serveur de salons perdue.')) return;
    // L’hôte, encore dans le salon, se reconnecte pour accueillir les joueurs suivants.
    if (this.host && !this.closed && this.room?.phase === 'lobby' && this.key) this.resumeSignal(Date.now());
  }
  resumeSignal(since) {
    this.resumeTimer = setTimeout(async () => {
      if (this.closed || this.room?.phase !== 'lobby') return;
      try { await this.openSignal({ action: 'resume', code: this.code, key: this.key }, 'resumed'); }
      catch (error) {
        // Le salon a disparu : on garde les joueurs déjà reliés, mais plus personne ne peut entrer.
        if (Date.now() - since < 55000 && !/expiré/.test(error.message)) { this.resumeSignal(since); return; }
        if (this.room.players.length <= 1) this.fail('Connexion au serveur de salons perdue. Créez un nouveau salon.');
        else { this.notice = 'Le code du salon n’est plus valable : plus personne ne peut rejoindre.'; this.callbacks.room?.(this.room); }
      }
    }, 2000);
  }

  // --- Côté hôte : accueillir les invités ---------------------------------
  async hostMessage(message) {
    if (message.type === 'guest') await this.welcome(message.guest);
    else if (message.type === 'from' && message.data?.type === 'answer') {
      const peerId = this.guests.get(message.guest);
      try {
        const answer = String(message.data.answer ?? '');
        if (!peerId || decodeInvitation(answer, 'answer').id !== peerId) throw new Error('Cette réponse appartient à une autre invitation.');
        await this.accept(answer);
      } catch (error) { this.refuse(message.guest, error.message); }
    } else if (message.type === 'gone') {
      const peerId = this.guests.get(message.guest);
      this.guests.delete(message.guest);
      if (peerId && this.hasInvite(peerId) && !this.peers.get(peerId).connected) this.cancelInvite(peerId);
    }
  }
  async welcome(guest) {
    try {
      if (this.room.phase !== 'lobby') throw new Error('La partie a déjà commencé.');
      const slot = joinable(this.room) && this.freeSlot();
      if (!slot) throw new Error('Ce salon est complet.');
      const pending = this.invite(slot);
      this.guests.set(guest, this.inviteId(slot));
      const invitation = await pending;
      this.signal({ type: 'to', guest, data: { type: 'offer', invitation } });
    } catch (error) { this.guests.delete(guest); this.refuse(guest, error.message); }
  }
  refuse(guest, message) { this.signal({ type: 'to', guest, data: { type: 'refused', message } }); }
  failureMessage() { return ONLINE_ADVICE; }
  publishRoom() {
    super.publishRoom();
    // Partie lancée : le salon se ferme, plus personne ne peut entrer.
    if (this.room.phase !== 'lobby' && this.socket) { this.signal({ type: 'end' }); this.closeSignal(); }
  }
  close() {
    if (this.host && this.socket) this.signal({ type: 'end' });
    this.closeSignal();
    this.rejectWaiters('Connexion fermée.');
    super.close();
  }
}
