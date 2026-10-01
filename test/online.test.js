import test from 'node:test';
import assert from 'node:assert/strict';
import { SignalHub } from '../serveur-en-ligne/signal-hub.js';
import { OnlineSession, onlineIceServers } from '../src/network/online-session.js';
import { onlineInviteLink, ONLINE_GAME_URL } from '../src/network/online-config.js';

// Socket factice côté serveur : garde les messages reçus.
const serverSocket = () => ({ messages: [], closed: false, send(text) { this.messages.push(JSON.parse(text)); }, close() { this.closed = true; } });
const tick = () => new Promise(resolve => setTimeout(resolve, 0));
async function until(check, label) {
  for (let i = 0; i < 200; i++) { if (check()) return; await tick(); }
  assert.fail(`Délai dépassé : ${label}`);
}

test('Standard des salons : création, arrivée d’un invité, relais des messages et départ', () => {
  const hub = new SignalHub();
  const host = serverSocket(), guest = serverSocket(), stranger = serverSocket();
  hub.open(host, { action: 'create' });
  const { code, key } = host.messages[0];
  assert.match(code, /^[A-F0-9]{6}$/); assert.equal(key.length, 32);
  hub.open(stranger, { action: 'join', code: 'ZZZZZZ' });
  assert.equal(stranger.messages[0].type, 'error'); assert.equal(stranger.closed, true);
  hub.open(guest, { action: 'join', code: code.toLowerCase() });
  assert.equal(guest.messages[0].type, 'joined');
  const { guest: guestId } = host.messages.at(-1);
  hub.message(host, JSON.stringify({ type: 'to', guest: guestId, data: { type: 'offer', invitation: 'P27:x' } }));
  assert.deepEqual(guest.messages.at(-1), { type: 'from-host', data: { type: 'offer', invitation: 'P27:x' } });
  hub.message(guest, JSON.stringify({ type: 'to-host', data: { type: 'answer', answer: 'P27:y' } }));
  assert.deepEqual(host.messages.at(-1), { type: 'from', guest: guestId, data: { type: 'answer', answer: 'P27:y' } });
  hub.message(guest, 'pas du JSON');
  assert.equal(guest.closed, true);
  assert.deepEqual(host.messages.at(-1), { type: 'gone', guest: guestId });
  hub.message(host, JSON.stringify({ type: 'end' }));
  assert.equal(hub.rooms.size, 0); assert.equal(hub.clients.size, 0);
});

test('Standard des salons : l’hôte coupé peut revenir avec sa clé, sinon le salon se ferme', () => {
  const timers = [];
  const hub = new SignalHub({ setTimer: (fn, ms) => { timers.push({ fn, ms }); return timers.length; }, clearTimer: id => { if (timers[id - 1]) timers[id - 1].fn = null; } });
  const host = serverSocket(), guest = serverSocket();
  hub.open(host, { action: 'create' });
  const { code, key } = host.messages[0];
  hub.closed(host);
  hub.open(guest, { action: 'join', code });
  const thief = serverSocket(); hub.open(thief, { action: 'resume', code, key: 'mauvaise' });
  assert.equal(thief.messages[0].type, 'error');
  const back = serverSocket(); hub.open(back, { action: 'resume', code, key });
  assert.equal(back.messages[0].type, 'resumed');
  assert.equal(back.messages[1].type, 'guest', 'les messages reçus pendant la coupure sont transmis');
  assert.equal(timers[0].fn, null, 'le délai de fermeture est annulé');
  hub.closed(back); timers.at(-1).fn();
  assert.equal(hub.rooms.size, 0);
  assert.equal(guest.messages.at(-1).message, 'L’hôte a quitté le salon.');
});

test('Les adresses TURN du serveur sont utilisées, STUN seul en cas de panne', async () => {
  const turn = [{ urls: ['turn:turn.example:3478'], username: 'u', credential: 'c' }];
  assert.deepEqual(await onlineIceServers('https://s', async () => ({ ok: true, json: async () => ({ iceServers: turn }) })), turn);
  const fallback = await onlineIceServers('https://s', async () => { throw new Error('hors ligne'); });
  assert.match(JSON.stringify(fallback), /stun:/);
  const base = ONLINE_GAME_URL || 'http://localhost:2027/';
  assert.equal(onlineInviteLink('A1B2C3', { origin: 'http://localhost:2027', pathname: '/' }), `${base}?en-ligne=A1B2C3`);
});

// --- Faux WebRTC et faux WebSocket pour un salon complet sans réseau ---------
class FakeChannel {
  readyState = 'connecting'; bufferedAmount = 0;
  send(text) { const other = this.other; setTimeout(() => other.onmessage?.({ data: text }), 0); }
  close() { this.readyState = 'closed'; }
}
class FakePeer {
  static all = new Map(); static count = 0;
  constructor(config) { this.config = config; this.id = ++FakePeer.count; this.iceGatheringState = 'complete'; this.connectionState = 'new'; }
  createDataChannel() { this.channel = new FakeChannel(); return this.channel; }
  description(type) { return { type, sdp: `v=0\r\na=fake:${this.id}\r\na=candidate:1 1 udp 1 203.0.113.${this.id} 5 typ srflx\r\n` }; }
  async createOffer() { return this.description('offer'); }
  async createAnswer() { return this.description('answer'); }
  async setLocalDescription(d) { this.localDescription = { ...d, toJSON: () => ({ type: d.type, sdp: d.sdp }) }; FakePeer.all.set(this.id, this); }
  async setRemoteDescription(d) {
    const remote = FakePeer.all.get(Number(/a=fake:(\d+)/.exec(d.sdp)[1]));
    if (d.type !== 'answer') return;
    const mine = this.channel, theirs = new FakeChannel(); mine.other = theirs; theirs.other = mine;
    remote.ondatachannel({ channel: theirs });
    setTimeout(() => { mine.readyState = theirs.readyState = 'open'; theirs.onopen(); mine.onopen(); }, 0);
  }
  async addIceCandidate() {}
  close() { this.connectionState = 'closed'; }
}
function socketClass(hub) {
  return class FakeWebSocket {
    constructor(url) {
      this.readyState = 0;
      this.server = { send: text => setTimeout(() => this.onmessage?.({ data: text }), 0), close: () => this.end() };
      const params = Object.fromEntries(new URL(url).searchParams);
      setTimeout(() => { this.readyState = 1; hub.open(this.server, params); }, 0);
    }
    send(text) { setTimeout(() => hub.message(this.server, text), 0); }
    // Comme un vrai WebSocket : les messages déjà envoyés partent avant la fermeture.
    close() { if (this.readyState < 2) this.readyState = 2; setTimeout(() => this.end(), 0); }
    end() { if (this.readyState === 3) return; this.readyState = 3; hub.closed(this.server); setTimeout(() => this.onclose?.(), 0); }
  };
}

test('Salon en ligne : un code suffit pour relier deux téléphones, puis le salon se ferme au lancement', async t => {
  const original = globalThis.RTCPeerConnection;
  globalThis.RTCPeerConnection = FakePeer;
  const hub = new SignalHub();
  const turn = [{ urls: ['turn:turn.example:3478'], username: 'u', credential: 'c' }];
  const options = { server: 'https://salons.example', WebSocketClass: socketClass(hub), fetcher: async () => ({ ok: true, json: async () => ({ iceServers: turn }) }) };
  const ended = [], hostRooms = [], guestRooms = [];
  const host = new OnlineSession({ room: room => hostRooms.push(structuredClone(room)), ended: m => ended.push(m) }, 'test', options);
  const guest = new OnlineSession({ room: room => guestRooms.push(structuredClone(room)), ended: m => ended.push(m) }, 'test', options);
  const lost = new OnlineSession({ room() {}, ended: m => ended.push(m) }, 'test', options);
  t.after(() => { host.close(); guest.close(); lost.close(); globalThis.RTCPeerConnection = original; });

  await host.connect('create', { mode: 'debate' });
  assert.match(host.code, /^[A-F0-9]{6}$/); assert.equal(host.room.code, host.code);
  await assert.rejects(lost.connect('join', { code: 'ABCDEF' }), /aucun salon/);
  await assert.rejects(lost.connect('join', { code: 'pas bon' }), /6 caractères/);

  await guest.connect('join', { code: host.code.toLowerCase() });
  assert.equal(guest.room.phase, 'lobby');
  assert.equal(guest.room.players.length, 2);
  assert.equal(guest.socket, null, 'l’invité relié quitte le serveur de salons');
  assert.deepEqual(FakePeer.all.get(1).config.iceServers, turn, 'les adresses TURN servent à la connexion');
  await until(() => hostRooms.at(-1)?.players.length === 2, 'salon de l’hôte à deux');

  await guest.request('choose', { faction: 'le_pen', style: 'classique' });
  await host.request('choose', { faction: 'melenchon', style: 'classique' });
  await until(() => host.room.players.every(p => p.faction), 'choix des candidats');
  await host.request('start', { setup: { format: '1v1', map: 'elysee', fighters: host.room.players.map(p => ({ faction: p.faction, style: p.style, player: p.id })) } });
  assert.equal(host.socket, null, 'le lancement ferme le salon en ligne');
  await until(() => hub.rooms.size === 0, 'fermeture du salon sur le serveur');
  await until(() => guestRooms.at(-1)?.phase === 'loading', 'préparation chez l’invité');
  assert.deepEqual(ended, []);
});

test('Le code saisi est nettoyé : minuscules, lettre O, espaces et lien collé', async () => {
  const { normalizeRoomCode } = await import('../src/network/online-config.js');
  assert.equal(normalizeRoomCode('a1b2c3'), 'A1B2C3');
  assert.equal(normalizeRoomCode('o0ab-cd 9'), '00ABCD');
  assert.equal(normalizeRoomCode('Rejoins-moi : https://exemple.fr/jeu/?en-ligne=e76aaf'), 'E76AAF');
  assert.equal(normalizeRoomCode('zzz'), '');
});
