import { sanitizeCommands } from './shared-commands.js';
import { encodePresentationState, encodeStateDelta, applyStateDelta, cullDistantNpcs } from './state-stream.js';

// Compression des messages (deflate, intégrée aux navigateurs récents) : les états,
// très répétitifs, perdent 40 à 55 % de leur poids. Utilisée seulement si l’autre
// appareil a annoncé savoir décompresser ; sinon, le texte part tel quel.
const DEFLATE = typeof CompressionStream === 'function' && typeof DecompressionStream === 'function';
const COMPRESS_FROM = 200; // En dessous, le gain ne vaut pas l’effort.
// Un message compressé part d’un seul bloc : 16 Ko, taille acceptée par tous les navigateurs.
// Le premier état d’une partie (environ 100 Ko de texte) y tient une fois compressé.
const BINARY_MAX = 16000;
async function deflate(text) {
  const stream = new Blob([text]).stream().pipeThrough(new CompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}
async function inflate(bytes, limit = 2_000_000) {
  const reader = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw')).getReader();
  const parts = []; let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    // Garde-fou : un message trafiqué ne doit pas gonfler sans limite.
    if ((size += value.length) > limit) { void reader.cancel(); throw new Error('Message trop volumineux.'); }
    parts.push(value);
  }
  return new TextDecoder().decode(await new Blob(parts).arrayBuffer());
}
import { chooseCandidate, factions, roomMode, startRoom, voteRematch, returnToLobby, closeRoom, leaveRoom, joinable, cleanName } from './lobby.js';
import { cleanPlayerCard } from '../simulation/player-titles.js';

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

// Browsers only reveal a phone's other networks (the Wi-Fi it shares as a hotspot,
// for instance) to pages allowed to use the camera. The host needs the camera anyway
// to scan answers: asking before the invitations lets them list every local address.
async function openCamera() {
  try { return await globalThis.navigator?.mediaDevices?.getUserMedia?.({ audio: false, video: true }) ?? null; }
  catch { return null; }
}

// Diagnostic: which addresses a description offers to the other phone.
const privateIpv4 = /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/;
export function describeAddresses(sdp = '') {
  const found = { local: [], hidden: 0, ipv6: 0, mobile: 0, internet: 0 }, seen = new Set();
  for (const line of String(sdp).split(/\r?\n/)) {
    const match = /^a=candidate:\S+ \d+ \S+ \d+ (\S+) \d+ typ (\w+)/.exec(line);
    if (!match || seen.has(match[1])) continue;
    const [, address, type] = match; seen.add(address);
    if (type !== 'host') found.internet++;
    else if (address.endsWith('.local')) found.hidden++;
    else if (address.includes(':')) found.ipv6++;
    else if (privateIpv4.test(address)) found.local.push(address);
    else found.mobile++;
  }
  return found;
}
export function addressSummary(found) {
  if (!found) return 'inconnues';
  const parts = [];
  if (found.local.length) parts.push(`Wi-Fi local ${found.local.join(', ')}`);
  if (found.hidden) parts.push(`${found.hidden} masquée${found.hidden > 1 ? 's' : ''} par le navigateur`);
  if (found.ipv6) parts.push(`${found.ipv6} IPv6`);
  if (found.mobile) parts.push(`${found.mobile} réseau mobile`);
  if (found.internet) parts.push(`${found.internet} vue${found.internet > 1 ? 's' : ''} depuis internet`);
  return parts.join(' · ') || 'aucune';
}
// true: a visible address in the same local network; false: none; null: impossible to tell.
export function sameNetwork(a, b) {
  if (!a?.local.length || !b?.local.length) return null;
  const prefix = address => address.split('.').slice(0, 3).join('.');
  return a.local.some(x => b.local.some(y => prefix(x) === prefix(y)));
}
const ADVICE = 'Connexion impossible entre les téléphones. Mettez-les sur le même Wi-Fi : une box, ou un 3e appareil qui partage sa connexion. Le téléphone qui fait lui-même le partage de connexion est souvent injoignable pour le jeu. Évitez aussi les réseaux invités qui isolent les appareils.';
// Before the first link, a guest's checks may give up while the host is still
// scanning its answer; the host's own checks can then still revive the connection.
const PAIRING_GRACE_MS = 45000;

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
    this.name ??= cleanName(data?.name);
    // Carte du joueur (avatar, titre, palier, candidats débloqués) : montrée dans le salon, vérifiée par l’hôte.
    this.card ??= cleanPlayerCard(data?.card);
    if (this.host) {
      // En ligne, aucun QR n’est scanné : la caméra est inutile.
      if (!this.online) this.camera = await openCamera();
      this.cameraTimer = setTimeout(() => this.releaseCamera(), 15000);
      this.code = id().slice(0, 6).toUpperCase();
      this.room = { code: this.code, mode: roomMode(data.mode), phase: 'lobby', paused: false, debate: null, players: [{ id: this.id, slot: 1, name: this.name, card: this.card, faction: null, style: null, host: true, ready: false }] };
    } else {
      const offer = decodeInvitation(data.code, 'offer');
      this.checkFingerprint(offer);
      if (!/^[A-F0-9]{6}$/.test(offer.code)) throw new Error('Le code du salon est invalide. Demandez une nouvelle invitation.');
      if (![2, 3].includes(offer.slot) || !Array.isArray(offer.players) || offer.players.length < 1 || offer.players.length > 2 || offer.players.some(p => p.faction !== null && !factions.includes(p.faction) || typeof p.id !== 'string')) throw new Error('Invitation invalide.');
      this.id = offer.id; this.code = offer.code;
      this.room = { code: this.code, phase: 'pairing', players: [...offer.players, { id: this.id, slot: offer.slot, faction: null, style: null, host: false, ready: false }] };
      const peer = this.makePeer('host');
      peer.remoteAddresses = describeAddresses(offer.description.sdp);
      peer.connection.ondatachannel = event => this.bindChannel(peer, event.channel);
      await peer.connection.setRemoteDescription(offer.description);
      await peer.connection.addIceCandidate(null);
      await peer.connection.setLocalDescription(await peer.connection.createAnswer());
      await gather(peer.connection);
      this.addresses = describeAddresses(peer.connection.localDescription.sdp);
      this.answer = encodeInvitation({ type: 'answer', id: this.id, fingerprint: this.fingerprint, description: peer.connection.localDescription.toJSON() });
    }
    this.heartbeat = setInterval(() => {
      const now = Date.now();
      for (const peer of this.peers.values()) if (peer.connected) {
        // Phones throttle hidden tabs: the lobby waits longer than a running match.
        if (now - peer.seen > (this.room.phase === 'playing' ? 45000 : 120000)) { this.peerLost(peer, 'Un téléphone ne répond plus. Gardez le jeu ouvert et reconnectez les joueurs.'); if (this.closed) return; continue; }
        try { this.send(peer, 'ping', {}); } catch (error) { this.peerLost(peer, error.message); if (this.closed) return; }
      }
    }, 3000);
  }
  checkFingerprint(data) { if (data.fingerprint !== this.fingerprint) throw new Error('Les versions du jeu diffèrent. Rechargez la page sur tous les appareils.'); }
  makePeer(peerId) {
    const peer = { id: peerId, connection: new RTCPeerConnection({ iceServers: this.iceServers ?? [{ urls: 'stun:stun.l.google.com:19302' }] }), connected: false, seen: Date.now(), buffer: '', sequence: null, cancelled: false };
    this.peers.set(peerId, peer);
    // 'disconnected' is often transient on mobile Wi-Fi (power saving, roaming):
    // only a definitive 'failed' ends the link, and the heartbeat covers the rest.
    peer.connection.onconnectionstatechange = () => {
      if (this.closed || peer.cancelled || peer.connection.connectionState !== 'failed') return;
      if (peer.connected) { this.peerLost(peer, 'La connexion entre les téléphones a été perdue. Restez sur le même Wi-Fi, puis recréez la partie.'); return; }
      if (this.host) { this.peerLost(peer, this.failureMessage(peer)); return; }
      peer.timeout ??= setTimeout(() => { if (!peer.connected) this.peerLost(peer, this.failureMessage(peer)); }, PAIRING_GRACE_MS);
    };
    return peer;
  }
  failureMessage(peer) {
    const same = sameNetwork(this.addresses, peer.remoteAddresses);
    return `${ADVICE} Diagnostic · ce téléphone : ${addressSummary(this.addresses)} ; ${this.host ? 'l’invité' : 'l’hôte'} : ${addressSummary(peer.remoteAddresses)}.${same === false ? ' Les deux téléphones ne sont pas sur le même réseau local.' : ''}`;
  }
  releaseCamera() {
    clearTimeout(this.cameraTimer);
    this.camera?.getTracks().forEach(track => track.stop()); this.camera = null;
  }
  bindChannel(peer, channel) {
    peer.channel = channel;
    peer.outbox = []; peer.inbox = Promise.resolve(); peer.deflate = false;
    channel.binaryType = 'arraybuffer';
    channel.bufferedAmountLowThreshold = 16000;
    channel.onbufferedamountlow = () => this.pump(peer);
    channel.onopen = () => {
      if (this.closed || peer.cancelled) return;
      peer.connected = true; peer.seen = Date.now(); clearTimeout(peer.timeout);
      // Chacun annonce ce qu’il sait décoder ; l’autre adapte ses envois.
      if (DEFLATE) this.enqueue(peer, JSON.stringify({ type: 'caps', data: { deflate: true } }));
      if (this.host) {
        this.room.players.push({ id: peer.id, slot: peer.slot, name: null, card: null, faction: null, style: null, host: false, ready: false });
        this.publishRoom();
      } else if (this.name || this.card) this.enqueue(peer, JSON.stringify({ type: 'profile', data: { name: this.name, card: this.card } })); // Pseudo et carte, pour le salon.
    };
    // Les messages compressés se décodent en différé : tant qu’un décodage est en cours,
    // les suivants attendent dans une file pour garder l’ordre d’arrivée.
    const invalid = () => this.peerLost(peer, 'Un message réseau est invalide. Recréez la partie.');
    channel.onmessage = event => {
      if (this.closed) return;
      const data = event.data;
      if (typeof data === 'string' && !peer.decoding) { try { this.receiveText(peer, data); } catch { invalid(); } return; }
      peer.decoding = (peer.decoding || 0) + 1;
      peer.inbox = peer.inbox.then(async () => {
        if (this.closed || peer.cancelled) return;
        try {
          if (typeof data === 'string') { this.receiveText(peer, data); return; }
          const size = data?.byteLength ?? data?.size;
          if (!DEFLATE || !(data instanceof ArrayBuffer || ArrayBuffer.isView(data) || data instanceof Blob) || !(size <= 50000)) throw new Error();
          const text = await inflate(data);
          if (!this.closed && !peer.cancelled) this.receiveText(peer, text, true);
        } catch { invalid(); }
      }).finally(() => { peer.decoding--; });
    };
    channel.onclose = () => { if (!this.closed && !peer.cancelled && peer.connected) this.peerLost(peer, 'Un joueur a quitté la partie ou perdu la connexion.'); };
    // Mobile Safari reports errors on channels that recover or are about to close:
    // onclose and the connection state decide, never onerror alone.
    channel.onerror = () => {};
  }
  receiveText(peer, text, inflated = false) {
    if (text.length > (inflated ? 2_000_000 : 50000)) throw new Error();
    const part = JSON.parse(text);
    // Message court (ou décompressé) envoyé d’un seul tenant, sans enveloppe de découpage.
    if (typeof part.type === 'string' && part.n === undefined) {
      if (peer.next < peer.total) throw new Error();
      peer.seen = Date.now(); this.receive(peer, part); return;
    }
    if (inflated || !Number.isInteger(part.n) || part.n < 0 || part.n > 249 || !Number.isInteger(part.total) || part.total < 1 || part.total > 250 || typeof part.data !== 'string' || part.data.length > 8000) throw new Error();
    if (part.n === 0) { peer.sequence = part.id; peer.next = 0; peer.total = part.total; peer.buffer = ''; }
    if (peer.sequence !== part.id || part.total !== peer.total || part.n !== peer.next++) throw new Error();
    peer.buffer += part.data;
    if (peer.buffer.length > 2_000_000) throw new Error();
    if (part.n === part.total - 1) { const packet = JSON.parse(peer.buffer); peer.buffer = ''; peer.seen = Date.now(); this.receive(peer, packet); }
  }
  canSend(peer, type) {
    if (peer.channel?.readyState !== 'open') return false;
    // Skip stale frames before encoding. Never accumulate snapshots on a slow link.
    if (type === 'snapshot' && (peer.outbox.length || peer.channel.bufferedAmount > 32000)) return false;
    return true;
  }
  send(peer, type, data) {
    if (!this.canSend(peer, type)) return false;
    if (type === 'snapshot') {
      const encoded = this.lastEncoded = encodePresentationState(data, this.lastEncoded);
      return this.enqueueSnapshot(peer, encoded, this.snapshotRound = (this.snapshotRound || 0) + 1);
    }
    return this.enqueue(peer, JSON.stringify({ type, data }));
  }
  /** État pour un invité : les passants loin de son candidat ne sont pas renvoyés à chaque fois. */
  enqueueSnapshot(peer, encoded, round) {
    const faction = this.room?.players?.find(p => p.id === peer.id)?.faction;
    const own = faction && Array.isArray(encoded.candidates) ? encoded.candidates.find(c => c?.id === `candidate:${faction}`) : null;
    const view = own ? cullDistantNpcs(encoded, peer.baseline, own.x, round) : encoded;
    return this.enqueue(peer, `{"type":"snapshot","data":${encodeStateDelta(view, peer.baseline)}}`, view);
  }
  enqueue(peer, json, baseline = null) {
    if (json.length > 2_000_000) throw new Error('La partie est trop volumineuse pour la connexion.');
    if (peer.outbox.length >= 100) throw new Error('La connexion ne répond plus. Reconnectez les joueurs.');
    const serial = ++this.serial, total = Math.ceil(json.length / 8000);
    const item = { json, serial, total, n: 0 };
    peer.outbox.push(item);
    if (baseline) peer.baseline = baseline;
    if (peer.deflate && json.length >= COMPRESS_FROM) {
      // La compression est asynchrone : le message garde sa place dans la file.
      item.pending = true;
      deflate(json).then(bytes => { if (bytes.byteLength <= BINARY_MAX) { item.binary = bytes; item.total = 1; } })
        .catch(() => { /* Le texte part tel quel. */ })
        .finally(() => { item.pending = false; this.pump(peer); });
      return true;
    }
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
        if (item.pending) return;
        // Un message qui tient en un morceau part tel quel : l’enveloppe (et l’échappement
        // de tous ses guillemets) coûtait près d’un quart des données.
        peer.channel.send(item.binary ?? (item.total === 1 ? item.json : JSON.stringify({ id: item.serial, n, total: item.total, data: item.json.slice(n * 8000, (n + 1) * 8000) })));
        item.n++; sent++;
        if (item.n === item.total) peer.outbox.shift();
      }
    } catch (error) {
      if (error.name !== 'OperationError') { this.peerLost(peer, 'L’envoi des données a échoué. Reconnectez les joueurs.'); return; }
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
    const encoded = this.lastEncoded = encodePresentationState(data, this.lastEncoded);
    const round = this.snapshotRound = (this.snapshotRound || 0) + 1;
    // Chaque invité reçoit sa propre vue (passants proches de son candidat).
    // A slow guest keeps its own baseline until enqueue.
    for (const peer of peers) if (this.canSend(peer, type)) this.enqueueSnapshot(peer, encoded, round);
  }
  publishRoom() { this.broadcast('room', this.room); this.callbacks.room(this.room); }
  receive(peer, packet) {
    if (packet.type === 'ping') return;
    if (packet.type === 'caps') { peer.deflate = DEFLATE && packet.data?.deflate === true; return; }
    if (packet.type === 'leave') { this.peerLost(peer, 'Un joueur a quitté le salon.'); return; }
    if (this.host) {
      const player = this.room.players.find(p => p.id === peer.id);
      if (!player) return;
      if (packet.type === 'profile') {
        if (this.room.phase === 'lobby') { player.name = cleanName(packet.data?.name); player.card = cleanPlayerCard(packet.data?.card); this.publishRoom(); }
        return;
      }
      if (packet.type === 'choose') {
        try { chooseCandidate(this.room, player.id, packet.data.faction, packet.data.style); this.publishRoom(); }
        catch (error) { this.send(peer, 'selectionError', { message: error.message }); }
        return;
      }
      if (packet.type === 'commands' && this.room.phase === 'playing') this.callbacks.commands({ playerId: player.id, commands: sanitizeCommands(packet.data.commands, player.faction) });
      else if (packet.type === 'ready' && this.room.phase === 'loading') this.setReady(player);
      else if (packet.type === 'pause' && this.room.phase === 'playing') { this.room.paused = packet.data.paused === true; this.publishRoom(); }
      else if (packet.type === 'rematch' && this.room.phase === 'playing') { try { voteRematch(this.room, player.id); this.publishRoom(); } catch { /* Vote hors d’un débat : ignoré. */ } }
      else if (packet.type === 'lobby' && this.room.phase === 'playing') { try { returnToLobby(this.room); this.publishRoom(); } catch { /* Hors d’un débat : ignoré. */ } }
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
  // Première place ni occupée ni déjà promise à une invitation en cours.
  freeSlot() { return [2, 3].find(s => !this.room.players.some(p => p.slot === s) && !this.inviteId(s)) ?? null; }
  async invite(slot = [2, 3].find(s => !this.room.players.some(p => p.slot === s))) {
    if (!this.host || !joinable(this.room)) throw new Error('Le salon ne peut plus accueillir de joueur.');
    if (![2, 3].includes(slot) || this.room.players.some(p => p.slot === slot)) throw new Error('Cette place est déjà occupée.');
    const existing = [...this.peers.values()].find(p => p.slot === slot && !p.cancelled);
    if (existing) return existing.invitation;
    const peer = this.makePeer(id()); peer.slot = slot;
    peer.invitation = this.prepareInvitation(peer);
    try { return await peer.invitation; } catch (error) { this.cancelInvite(peer.id); throw error; }
  }
  async prepareInvitation(peer) {
    this.gathering = (this.gathering ?? 0) + 1;
    try {
      this.bindChannel(peer, peer.connection.createDataChannel('campagne'));
      await peer.connection.setLocalDescription(await peer.connection.createOffer());
      await gather(peer.connection);
    } finally { if (--this.gathering === 0) this.releaseCamera(); }
    if (!peer.connection.localDescription.sdp.includes('a=candidate:')) throw new Error('Aucun accès au Wi-Fi détecté. Autorisez le réseau local dans le navigateur.');
    this.addresses = describeAddresses(peer.connection.localDescription.sdp);
    return encodeInvitation({ type: 'offer', id: peer.id, slot: peer.slot, code: this.code, fingerprint: this.fingerprint, players: this.room.players, description: peer.connection.localDescription.toJSON() });
  }
  async accept(text) {
    const answer = decodeInvitation(text, 'answer'); this.checkFingerprint(answer);
    const peer = this.peers.get(answer.id);
    if (!this.host || this.room.phase !== 'lobby' || !peer || peer.cancelled) throw new Error('Cette réponse appartient à une autre invitation.');
    if (peer.connected || peer.accepting) return null;
    peer.accepting = true;
    peer.remoteAddresses = describeAddresses(answer.description.sdp);
    try {
      await peer.connection.setRemoteDescription(answer.description);
      await peer.connection.addIceCandidate(null);
    } catch (error) { peer.accepting = false; throw error; }
    peer.timeout = setTimeout(() => { if (!peer.connected && !peer.cancelled) this.peerLost(peer, `Un joueur n’a pas pu se connecter. ${this.failureMessage(peer)}${this.online ? '' : ' Faites-lui ensuite scanner le nouveau QR.'}`); }, 25000);
    return sameNetwork(this.addresses, peer.remoteAddresses);
  }
  cancelInvite(peerId = null) {
    for (const peer of this.peers.values()) if (!peer.connected && (!peerId || peer.id === peerId)) {
      peer.cancelled = true; clearTimeout(peer.timeout); clearTimeout(peer.retry); peer.connection.close(); this.peers.delete(peer.id);
    }
  }
  // Before the match, one guest's trouble only frees its place: the host and the
  // other guest stay in the lobby. The host's own link, or any loss once the match
  // is loading or running, still ends the session for everybody.
  peerLost(peer, message) {
    if (this.closed || this.closing || peer.cancelled) return;
    if (!this.host || this.room.phase !== 'lobby') { this.fail(message); return; }
    peer.cancelled = true; clearTimeout(peer.timeout); clearTimeout(peer.retry);
    try { peer.connection.close(); } catch { /* Already closed. */ }
    this.peers.delete(peer.id);
    const count = this.room.players.length;
    leaveRoom(this.room, peer.id);
    this.notice = message;
    if (this.room.players.length !== count) this.publishRoom(); else this.callbacks.room?.(this.room);
  }
  inviteId(slot) { return [...this.peers.values()].find(p => p.slot === slot && !p.cancelled)?.id ?? null; }
  hasInvite(peerId) { return this.peers.has(peerId) && !this.peers.get(peerId).cancelled; }
  setReady(player) { player.ready = true; if (this.room.players.every(p => p.ready)) this.room.phase = 'playing'; this.publishRoom(); }
  async request(action, data = {}) {
    if (this.closed) throw new Error('La connexion est fermée.');
    if (!this.host) {
      if (!['commands', 'ready', 'pause', 'choose', 'rematch', 'lobby'].includes(action)) throw new Error('Cette action n’est pas disponible à cette étape.');
      if (!this.send(this.peers.get('host'), action, data)) {
        // The channel is reopening or closing: onclose and the heartbeat decide.
        const error = new Error('La connexion à l’hôte n’est pas prête.'); error.transient = true; throw error;
      }
    } else if (action === 'choose') {
      chooseCandidate(this.room, this.id, data.faction, data.style); this.publishRoom();
    } else if (action === 'close') {
      // Débat à deux : plus d’invitation en attente, la sélection s’ouvre.
      closeRoom(this.room); this.cancelInvite(); this.publishRoom();
    } else if (action === 'start') {
      startRoom(this.room, data.setup);
      this.cancelInvite(); this.publishRoom();
    } else if (action === 'ready' && this.room.phase === 'loading') this.setReady(this.room.players[0]);
    else if (action === 'pause' && this.room.phase === 'playing') { this.room.paused = data.paused === true; this.publishRoom(); }
    else if (action === 'rematch') { voteRematch(this.room, this.id); this.publishRoom(); }
    else if (action === 'lobby') { returnToLobby(this.room); this.publishRoom(); }
    else if (action === 'snapshot' && this.room.phase === 'playing') this.broadcast('snapshot', data.state);
    else throw new Error('Cette action n’est pas disponible à cette étape.');
    return { ok: true };
  }
  // Back from the background: our own timers were frozen, so the other phones'
  // silence is not theirs. Restart their grace delay and ping them at once.
  resume() {
    if (this.closed) return;
    const now = Date.now();
    for (const peer of this.peers.values()) if (peer.connected) { peer.seen = now; try { this.send(peer, 'ping', {}); } catch { /* The heartbeat will decide. */ } }
  }
  fail(message) { if (this.closed || this.closing) return; this.close(); this.callbacks.ended(message); }
  close() {
    if (this.closed || this.closing) return;
    this.closing = true;
    clearInterval(this.heartbeat); this.releaseCamera();
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
