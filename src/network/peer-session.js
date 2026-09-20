import { sanitizeCommands } from './shared-commands.js';

const factions = ['melenchon', 'le_pen', 'philippe'];
const id = () => Array.from(crypto.getRandomValues(new Uint8Array(8)), x => x.toString(16).padStart(2, '0')).join('');
export function encodeInvitation(value) {
  const bytes = new TextEncoder().encode(JSON.stringify({ version: 1, ...value }));
  return 'P27:' + btoa(Array.from(bytes, b => String.fromCharCode(b)).join(''));
}
export function decodeInvitation(text, type) {
  try {
    const value = String(text).trim();
    if (!value.startsWith('P27:') || value.length > 30000) throw new Error();
    const data = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(value.slice(4)), c => c.charCodeAt(0))));
    if (data.version !== 1 || data.type !== type || typeof data.id !== 'string' || data.id.length > 40 || typeof data.description?.sdp !== 'string' || data.description.type !== type) throw new Error();
    return data;
  } catch { throw new Error(type === 'offer' ? 'Invitation invalide. Collez le texte complet qui commence par P27:.' : 'Réponse invalide. Collez la réponse complète de votre ami.'); }
}
async function gather(connection) {
  if (connection.iceGatheringState === 'complete') return;
  await new Promise((resolve, reject) => {
    const finish = () => { if (connection.iceGatheringState === 'complete') { clearTimeout(timer); connection.removeEventListener('icegatheringstatechange', finish); resolve(); } };
    const timer = setTimeout(() => {
      connection.removeEventListener('icegatheringstatechange', finish);
      if (connection.localDescription?.sdp.includes('a=candidate:')) resolve();
      else reject(new Error('Réseau local introuvable. Vérifiez le Wi-Fi et autorisez son accès dans le navigateur.'));
    }, 5000);
    connection.addEventListener('icegatheringstatechange', finish); finish();
  });
}

// A star topology: the host simulates, guests send intentions. No signaling service,
// TURN, camera or microphone is used. STUN supplements local candidates when mDNS
// is unavailable; it never receives game state. Players exchange descriptions manually.
export class PeerSession {
  constructor(callbacks, fingerprint) {
    Object.assign(this, { callbacks, fingerprint, direct: true, closed: false, peers: new Map(), serial: 0, id: id() });
  }
  get host() { return this.isHost; }
  get candidateId() { return `candidate:${this.faction}`; }
  async connect(action, data) {
    if (typeof RTCPeerConnection !== 'function') throw new Error('Ce navigateur ne permet pas la connexion directe. Essayez un navigateur à jour.');
    if (!factions.includes(data.faction)) throw new Error('Choisissez un candidat.');
    this.faction = data.faction; this.isHost = action === 'create';
    if (this.host) {
      this.code = id().slice(0, 6).toUpperCase();
      this.room = { code: this.code, phase: 'lobby', paused: false, players: [{ id: this.id, faction: this.faction, host: true, ready: false }] };
    } else {
      const offer = decodeInvitation(data.code, 'offer');
      this.checkFingerprint(offer);
      if (!/^[A-F0-9]{6}$/.test(offer.code)) throw new Error('Le code du salon est invalide. Demandez une nouvelle invitation.');
      if (!Array.isArray(offer.players) || offer.players.length < 1 || offer.players.length > 2 || offer.players.some(p => !factions.includes(p.faction) || typeof p.id !== 'string')) throw new Error('Invitation invalide.');
      if (offer.players.some(p => p.faction === this.faction)) throw new Error('Ce candidat est déjà pris. Choisissez-en un autre.');
      this.id = offer.id; this.code = offer.code;
      this.room = { code: this.code, phase: 'pairing', players: [...offer.players, { id: this.id, faction: this.faction, host: false, ready: false }] };
      const peer = this.makePeer('host');
      peer.connection.ondatachannel = event => this.bindChannel(peer, event.channel);
      await peer.connection.setRemoteDescription(offer.description);
      await peer.connection.addIceCandidate(null);
      await peer.connection.setLocalDescription(await peer.connection.createAnswer());
      await gather(peer.connection);
      this.answer = encodeInvitation({ type: 'answer', id: this.id, fingerprint: this.fingerprint, faction: this.faction, description: peer.connection.localDescription.toJSON() });
    }
    this.heartbeat = setInterval(() => {
      const now = Date.now();
      for (const peer of this.peers.values()) if (peer.connected) {
        if (now - peer.seen > (this.room.phase === 'playing' ? 45000 : 180000)) { this.fail('Un téléphone ne répond plus. Gardez le jeu ouvert et reconnectez les joueurs.'); return; }
        try { this.send(peer, 'ping', {}); } catch (error) { this.fail(error.message); return; }
      }
    }, 3000);
  }
  checkFingerprint(data) { if (data.fingerprint !== this.fingerprint) throw new Error('Les versions du jeu diffèrent. Rechargez la page sur tous les appareils.'); }
  makePeer(peerId) {
    const peer = { id: peerId, connection: new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] }), connected: false, seen: Date.now(), buffer: '', sequence: null, cancelled: false };
    this.peers.set(peerId, peer);
    peer.connection.onconnectionstatechange = () => {
      if (!this.closed && !peer.cancelled && peer.connection.connectionState === 'failed') this.fail('Connexion impossible. Utilisez le même Wi-Fi, autorisez le réseau local et évitez un réseau invité qui isole les appareils.');
    };
    return peer;
  }
  bindChannel(peer, channel) {
    peer.channel = channel;
    channel.onopen = () => {
      if (this.closed || peer.cancelled) return;
      peer.connected = true; peer.seen = Date.now(); clearTimeout(peer.timeout);
      if (this.host) {
        this.room.players.push({ id: peer.id, faction: peer.faction, host: false, ready: false });
        if (this.pending === peer) this.pending = null;
        this.publishRoom();
      }
    };
    channel.onmessage = event => {
      if (this.closed) return;
      try {
        if (typeof event.data !== 'string' || event.data.length > 50000) throw new Error();
        const part = JSON.parse(event.data);
        if (!Number.isInteger(part.n) || part.n < 0 || part.n > 249 || !Number.isInteger(part.total) || part.total < 1 || part.total > 250 || typeof part.data !== 'string' || part.data.length > 8000) throw new Error();
        if (part.n === 0) { peer.sequence = part.id; peer.next = 0; peer.buffer = ''; }
        if (peer.sequence !== part.id || part.n !== peer.next++) throw new Error();
        peer.buffer += part.data;
        if (peer.buffer.length > 2_000_000) throw new Error();
        if (part.n === part.total - 1) { const packet = JSON.parse(peer.buffer); peer.buffer = ''; peer.seen = Date.now(); this.receive(peer, packet); }
      } catch { this.fail('Un message réseau est invalide. Recréez la partie.'); }
    };
    channel.onclose = () => { if (!this.closed && !peer.cancelled && peer.connected) this.fail('Un joueur a quitté la partie ou perdu la connexion.'); };
    channel.onerror = () => { if (!this.closed && !peer.cancelled) this.fail('La connexion entre les téléphones a été interrompue.'); };
  }
  send(peer, type, data) {
    if (peer.channel?.readyState !== 'open') return false;
    if (peer.channel.bufferedAmount > 1_000_000) {
      if (type === 'snapshot') return false;
      throw new Error('Connexion trop lente. Rapprochez-vous du point Wi-Fi.');
    }
    const json = JSON.stringify({ type, data });
    if (json.length > 2_000_000) throw new Error('La partie est trop volumineuse pour la connexion.');
    const serial = ++this.serial, total = Math.ceil(json.length / 8000);
    for (let n = 0; n < total; n++) peer.channel.send(JSON.stringify({ id: serial, n, total, data: json.slice(n * 8000, (n + 1) * 8000) }));
    return true;
  }
  broadcast(type, data) { for (const peer of this.peers.values()) if (peer.connected) this.send(peer, type, data); }
  publishRoom() { this.broadcast('room', this.room); this.callbacks.room(this.room); }
  receive(peer, packet) {
    if (packet.type === 'ping') return;
    if (packet.type === 'leave') { this.fail('Un joueur a quitté la partie.'); return; }
    if (this.host) {
      const player = this.room.players.find(p => p.id === peer.id);
      if (!player) return;
      if (packet.type === 'commands' && this.room.phase === 'playing') this.callbacks.commands({ playerId: player.id, commands: sanitizeCommands(packet.data.commands, player.faction) });
      else if (packet.type === 'ready' && this.room.phase === 'loading') this.setReady(player);
      else if (packet.type === 'pause' && this.room.phase === 'playing') { this.room.paused = packet.data.paused === true; this.publishRoom(); }
    } else {
      if (packet.type === 'room') { this.room = packet.data; this.callbacks.room(this.room); }
      else if (packet.type === 'snapshot' && this.room.phase === 'playing') this.callbacks.snapshot(packet.data);
      else if (packet.type === 'ended') this.fail(String(packet.data.message));
    }
  }
  async invite() {
    if (!this.host || this.room.phase !== 'lobby' || this.room.players.length >= 3) throw new Error('Le salon ne peut plus accueillir de joueur.');
    this.cancelInvite();
    const peer = this.makePeer(id()); this.pending = peer;
    this.bindChannel(peer, peer.connection.createDataChannel('campagne'));
    await peer.connection.setLocalDescription(await peer.connection.createOffer());
    await gather(peer.connection);
    if (!peer.connection.localDescription.sdp.includes('a=candidate:')) throw new Error('Aucun accès au Wi-Fi détecté. Autorisez le réseau local dans le navigateur.');
    return encodeInvitation({ type: 'offer', id: peer.id, code: this.code, fingerprint: this.fingerprint, players: this.room.players, description: peer.connection.localDescription.toJSON() });
  }
  async accept(text) {
    const answer = decodeInvitation(text, 'answer'); this.checkFingerprint(answer);
    const peer = this.pending;
    if (!peer || peer.id !== answer.id) throw new Error('Cette réponse appartient à une autre invitation.');
    if (!factions.includes(answer.faction) || this.room.players.some(p => p.faction === answer.faction)) throw new Error('Ce candidat est déjà pris. Votre ami doit choisir un autre candidat.');
    peer.faction = answer.faction;
    await peer.connection.setRemoteDescription(answer.description);
    await peer.connection.addIceCandidate(null);
    peer.timeout = setTimeout(() => { if (!peer.connected && !peer.cancelled) this.fail('Les appareils ne se trouvent pas. Vérifiez le même Wi-Fi et son autorisation dans le navigateur.'); }, 25000);
  }
  cancelInvite() {
    if (!this.pending) return;
    const peer = this.pending; peer.cancelled = true; clearTimeout(peer.timeout); peer.connection.close(); this.peers.delete(peer.id); this.pending = null;
  }
  setReady(player) { player.ready = true; if (this.room.players.every(p => p.ready)) this.room.phase = 'playing'; this.publishRoom(); }
  async request(action, data = {}) {
    if (this.closed) throw new Error('La connexion est fermée.');
    if (!this.host) {
      if (!['commands', 'ready', 'pause'].includes(action) || !this.send(this.peers.get('host'), action, data)) throw new Error('La connexion à l’hôte n’est pas prête.');
    } else if (action === 'start') {
      if (this.room.players.length < 2 || this.room.phase !== 'lobby') throw new Error('Il faut au moins deux joueurs connectés.');
      this.cancelInvite(); this.room.phase = 'loading'; this.room.players.forEach(p => { p.ready = false; }); this.publishRoom();
    } else if (action === 'ready' && this.room.phase === 'loading') this.setReady(this.room.players[0]);
    else if (action === 'pause' && this.room.phase === 'playing') { this.room.paused = data.paused === true; this.publishRoom(); }
    else if (action === 'snapshot' && this.room.phase === 'playing') this.broadcast('snapshot', data.state);
    else throw new Error('Cette action n’est pas disponible à cette étape.');
    return { ok: true };
  }
  fail(message) { if (this.closed) return; this.close(); this.callbacks.ended(message); }
  close() {
    if (this.closed) return;
    this.closed = true; clearInterval(this.heartbeat);
    for (const peer of this.peers.values()) {
      try { this.send(peer, this.host ? 'ended' : 'leave', { message: 'L’hôte a fermé la partie.' }); } catch { /* The link may already be gone. */ }
      peer.cancelled = true; clearTimeout(peer.timeout); peer.connection.close();
    }
    this.peers.clear();
  }
}
