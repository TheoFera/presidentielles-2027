import { sanitizeCommands } from './shared-commands.js';
import { encodePresentationState, encodeStateDelta, applyStateDelta } from './state-stream.js';
import { chooseCandidate, candidatesReady } from './lobby.js';

const factions = ['melenchon', 'le_pen', 'philippe'];
const id = () => Array.from(crypto.getRandomValues(new Uint8Array(8)), x => x.toString(16).padStart(2, '0')).join('');
export function encodeInvitation(value) {
  const bytes = new TextEncoder().encode(JSON.stringify({ version: 3, ...value }));
  return 'P27:' + btoa(Array.from(bytes, b => String.fromCharCode(b)).join(''));
}
export function decodeInvitation(text, type) {
  try {
    const value = String(text).trim();
    if (!value.startsWith('P27:') || value.length > 30000) throw new Error();
    const data = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(value.slice(4)), c => c.charCodeAt(0))));
    if (data.version !== 3 || data.type !== type || typeof data.id !== 'string' || data.id.length > 40 || typeof data.description?.sdp !== 'string' || data.description.type !== type) throw new Error();
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
  get candidateId() { return `candidate:${this.room?.players.find(p => p.id === this.id)?.faction}`; }
  async connect(action, data) {
    if (typeof RTCPeerConnection !== 'function') throw new Error('Ce navigateur ne permet pas la connexion directe. Essayez un navigateur à jour.');
    this.isHost = action === 'create';
    if (this.host) {
      this.code = id().slice(0, 6).toUpperCase();
      this.room = { code: this.code, phase: 'lobby', paused: false, players: [{ id: this.id, slot: 1, faction: null, host: true, ready: false }] };
    } else {
      const offer = decodeInvitation(data.code, 'offer');
      this.checkFingerprint(offer);
      if (!/^[A-F0-9]{6}$/.test(offer.code)) throw new Error('Le code du salon est invalide. Demandez une nouvelle invitation.');
      if (![2, 3].includes(offer.slot) || !Array.isArray(offer.players) || offer.players.length < 1 || offer.players.length > 2 || offer.players.some(p => p.faction !== null && !factions.includes(p.faction) || typeof p.id !== 'string')) throw new Error('Invitation invalide.');
      this.id = offer.id; this.code = offer.code;
      this.room = { code: this.code, phase: 'pairing', players: [...offer.players, { id: this.id, slot: offer.slot, faction: null, host: false, ready: false }] };
      const peer = this.makePeer('host');
      peer.connection.ondatachannel = event => this.bindChannel(peer, event.channel);
      await peer.connection.setRemoteDescription(offer.description);
      await peer.connection.addIceCandidate(null);
      await peer.connection.setLocalDescription(await peer.connection.createAnswer());
      await gather(peer.connection);
      this.answer = encodeInvitation({ type: 'answer', id: this.id, fingerprint: this.fingerprint, description: peer.connection.localDescription.toJSON() });
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
    peer.outbox = [];
    channel.bufferedAmountLowThreshold = 16000;
    channel.onbufferedamountlow = () => this.pump(peer);
    channel.onopen = () => {
      if (this.closed || peer.cancelled) return;
      peer.connected = true; peer.seen = Date.now(); clearTimeout(peer.timeout);
      if (this.host) {
        this.room.players.push({ id: peer.id, slot: peer.slot, faction: null, host: false, ready: false });
        this.publishRoom();
      }
    };
    channel.onmessage = event => {
      if (this.closed) return;
      try {
        if (typeof event.data !== 'string' || event.data.length > 50000) throw new Error();
        const part = JSON.parse(event.data);
        if (!Number.isInteger(part.n) || part.n < 0 || part.n > 249 || !Number.isInteger(part.total) || part.total < 1 || part.total > 250 || typeof part.data !== 'string' || part.data.length > 8000) throw new Error();
        if (part.n === 0) { peer.sequence = part.id; peer.next = 0; peer.total = part.total; peer.buffer = ''; }
        if (peer.sequence !== part.id || part.total !== peer.total || part.n !== peer.next++) throw new Error();
        peer.buffer += part.data;
        if (peer.buffer.length > 2_000_000) throw new Error();
        if (part.n === part.total - 1) { const packet = JSON.parse(peer.buffer); peer.buffer = ''; peer.seen = Date.now(); this.receive(peer, packet); }
      } catch { this.fail('Un message réseau est invalide. Recréez la partie.'); }
    };
    channel.onclose = () => { if (!this.closed && !peer.cancelled && peer.connected) this.fail('Un joueur a quitté la partie ou perdu la connexion.'); };
    channel.onerror = () => { if (!this.closed && !peer.cancelled) this.fail('La connexion entre les téléphones a été interrompue.'); };
  }
  canSend(peer, type) {
    if (peer.channel?.readyState !== 'open') return false;
    // Skip stale frames before encoding. Never accumulate snapshots on a slow link.
    if (type === 'snapshot' && (peer.outbox.length || peer.channel.bufferedAmount > 32000)) return false;
    return true;
  }
  send(peer, type, data) {
    if (!this.canSend(peer, type)) return false;
    const encoded = type === 'snapshot' ? encodePresentationState(data) : null;
    const json = encoded
      ? `{"type":"snapshot","data":${encodeStateDelta(encoded, peer.baseline)}}`
      : JSON.stringify({ type, data });
    return this.enqueue(peer, json, encoded);
  }
  enqueue(peer, json, baseline = null) {
    if (json.length > 2_000_000) throw new Error('La partie est trop volumineuse pour la connexion.');
    if (peer.outbox.length >= 100) throw new Error('La connexion ne répond plus. Reconnectez les joueurs.');
    const serial = ++this.serial, total = Math.ceil(json.length / 8000);
    peer.outbox.push({ json, serial, total, n: 0 });
    if (baseline) peer.baseline = baseline;
    this.pump(peer);
    return true;
  }
  pump(peer) {
    if (this.closed || peer.cancelled || peer.channel?.readyState !== 'open') return;
    clearTimeout(peer.retry);
    try {
      // Yield between small bursts; one snapshot must not flood SCTP's send queue.
      let sent = 0;
      while (peer.outbox.length && peer.channel.bufferedAmount < 32000 && sent < 4) {
        const item = peer.outbox[0], n = item.n;
        peer.channel.send(JSON.stringify({ id: item.serial, n, total: item.total, data: item.json.slice(n * 8000, (n + 1) * 8000) }));
        item.n++; sent++;
        if (item.n === item.total) peer.outbox.shift();
      }
    } catch (error) {
      if (error.name !== 'OperationError') { this.fail('L’envoi des données a échoué. Reconnectez les joueurs.'); return; }
      // A full browser queue is temporary: retry the same fragment, in order.
    }
    if (peer.outbox.length) peer.retry = setTimeout(() => this.pump(peer), 16);
  }
  broadcast(type, data) {
    if (type !== 'snapshot') {
      for (const peer of this.peers.values()) if (peer.connected) this.send(peer, type, data);
      return;
    }
    const peers = [...this.peers.values()].filter(peer => peer.connected && this.canSend(peer, type));
    if (!peers.length) return;
    const encoded = encodePresentationState(data), packets = new Map();
    for (const peer of peers) {
      // Guests that received the same last frame share both the field encoding
      // and the final packet. A slow guest keeps its own baseline until enqueue.
      if (!this.canSend(peer, type)) continue;
      if (!packets.has(peer.baseline)) packets.set(peer.baseline, `{"type":"snapshot","data":${encodeStateDelta(encoded, peer.baseline)}}`);
      this.enqueue(peer, packets.get(peer.baseline), encoded);
    }
  }
  publishRoom() { this.broadcast('room', this.room); this.callbacks.room(this.room); }
  receive(peer, packet) {
    if (packet.type === 'ping') return;
    if (packet.type === 'leave') { this.fail('Un joueur a quitté la partie.'); return; }
    if (this.host) {
      const player = this.room.players.find(p => p.id === peer.id);
      if (!player) return;
      if (packet.type === 'choose') {
        try { chooseCandidate(this.room, player.id, packet.data.faction); this.publishRoom(); }
        catch (error) { this.send(peer, 'selectionError', { message: error.message }); }
        return;
      }
      if (packet.type === 'commands' && this.room.phase === 'playing') this.callbacks.commands({ playerId: player.id, commands: sanitizeCommands(packet.data.commands, player.faction) });
      else if (packet.type === 'ready' && this.room.phase === 'loading') this.setReady(player);
      else if (packet.type === 'pause' && this.room.phase === 'playing') { this.room.paused = packet.data.paused === true; this.publishRoom(); }
    } else {
      if (packet.type === 'room') { this.room = packet.data; this.selectionError = ''; this.callbacks.room(this.room); }
      else if (packet.type === 'selectionError') { this.selectionError = String(packet.data.message); this.callbacks.room(this.room); }
      else if (packet.type === 'snapshot' && this.room.phase === 'playing') {
        peer.snapshot = applyStateDelta(peer.snapshot, packet.data);
        this.callbacks.snapshot(peer.snapshot);
      }
      else if (packet.type === 'ended') this.fail(String(packet.data.message));
    }
  }
  async invite(slot = [2, 3].find(s => !this.room.players.some(p => p.slot === s))) {
    if (!this.host || this.room.phase !== 'lobby' || this.room.players.length >= 3) throw new Error('Le salon ne peut plus accueillir de joueur.');
    if (![2, 3].includes(slot) || this.room.players.some(p => p.slot === slot)) throw new Error('Cette place est déjà occupée.');
    const existing = [...this.peers.values()].find(p => p.slot === slot && !p.cancelled);
    if (existing) return existing.invitation;
    const peer = this.makePeer(id()); peer.slot = slot;
    peer.invitation = this.prepareInvitation(peer);
    try { return await peer.invitation; } catch (error) { this.cancelInvite(peer.id); throw error; }
  }
  async prepareInvitation(peer) {
    this.bindChannel(peer, peer.connection.createDataChannel('campagne'));
    await peer.connection.setLocalDescription(await peer.connection.createOffer());
    await gather(peer.connection);
    if (!peer.connection.localDescription.sdp.includes('a=candidate:')) throw new Error('Aucun accès au Wi-Fi détecté. Autorisez le réseau local dans le navigateur.');
    return encodeInvitation({ type: 'offer', id: peer.id, slot: peer.slot, code: this.code, fingerprint: this.fingerprint, players: this.room.players, description: peer.connection.localDescription.toJSON() });
  }
  async accept(text) {
    const answer = decodeInvitation(text, 'answer'); this.checkFingerprint(answer);
    const peer = this.peers.get(answer.id);
    if (!this.host || this.room.phase !== 'lobby' || !peer || peer.cancelled) throw new Error('Cette réponse appartient à une autre invitation.');
    if (peer.connected || peer.accepting) return;
    peer.accepting = true;
    try {
      await peer.connection.setRemoteDescription(answer.description);
      await peer.connection.addIceCandidate(null);
    } catch (error) { peer.accepting = false; throw error; }
    peer.timeout = setTimeout(() => { if (!peer.connected && !peer.cancelled) this.fail('Les appareils ne se trouvent pas. Vérifiez le même Wi-Fi et son autorisation dans le navigateur.'); }, 25000);
  }
  cancelInvite(peerId = null) {
    for (const peer of this.peers.values()) if (!peer.connected && (!peerId || peer.id === peerId)) {
      peer.cancelled = true; clearTimeout(peer.timeout); clearTimeout(peer.retry); peer.connection.close(); this.peers.delete(peer.id);
    }
  }
  setReady(player) { player.ready = true; if (this.room.players.every(p => p.ready)) this.room.phase = 'playing'; this.publishRoom(); }
  async request(action, data = {}) {
    if (this.closed) throw new Error('La connexion est fermée.');
    if (!this.host) {
      if (!['commands', 'ready', 'pause', 'choose'].includes(action) || !this.send(this.peers.get('host'), action, data)) throw new Error('La connexion à l’hôte n’est pas prête.');
    } else if (action === 'choose') {
      chooseCandidate(this.room, this.id, data.faction); this.publishRoom();
    } else if (action === 'start') {
      if (this.room.players.length !== 3 || this.room.phase !== 'lobby') throw new Error('Il faut trois joueurs connectés.');
      if (!candidatesReady(this.room)) throw new Error('Chaque joueur doit choisir son candidat.');
      this.cancelInvite(); this.room.phase = 'loading'; this.room.players.forEach(p => { p.ready = false; }); this.publishRoom();
    } else if (action === 'ready' && this.room.phase === 'loading') this.setReady(this.room.players[0]);
    else if (action === 'pause' && this.room.phase === 'playing') { this.room.paused = data.paused === true; this.publishRoom(); }
    else if (action === 'snapshot' && this.room.phase === 'playing') this.broadcast('snapshot', data.state);
    else throw new Error('Cette action n’est pas disponible à cette étape.');
    return { ok: true };
  }
  fail(message) { if (this.closed || this.closing) return; this.close(); this.callbacks.ended(message); }
  close() {
    if (this.closed || this.closing) return;
    this.closing = true;
    clearInterval(this.heartbeat);
    for (const peer of this.peers.values()) {
      try { this.send(peer, this.host ? 'ended' : 'leave', { message: 'L’hôte a fermé la partie.' }); } catch { /* The link may already be gone. */ }
    }
    this.closed = true;
    for (const peer of this.peers.values()) {
      peer.cancelled = true; clearTimeout(peer.timeout); clearTimeout(peer.retry); peer.connection.close();
    }
    this.peers.clear();
  }
}
