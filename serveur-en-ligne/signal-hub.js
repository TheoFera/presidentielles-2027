// Standard des salons en ligne : il ne fait que transmettre les messages de mise
// en relation (invitation WebRTC, réponse) entre l’hôte et ses invités. Une fois
// les téléphones reliés, la partie passe directement de l’un à l’autre (ou par le
// relais TURN) : ce standard ne voit jamais l’état du jeu.
// Ce fichier ne dépend d’aucune plateforme : le Worker Cloudflare l’utilise, les tests aussi.

export const ROOM_CODE = /^[A-F0-9]{6}$/;
const MAX_MESSAGE = 64000;
const MAX_GUESTS = 6; // invités en attente ou reliés ; le jeu en accepte 2 au plus.
const MAX_QUEUE = 50;

const hex = bytes => Array.from(crypto.getRandomValues(new Uint8Array(bytes)), b => b.toString(16).padStart(2, '0')).join('');

export class SignalHub {
  constructor({ now = Date.now, setTimer = setTimeout, clearTimer = clearTimeout, maxRooms = 500, hostGraceMs = 60000, roomLifeMs = 2 * 60 * 60 * 1000 } = {}) {
    Object.assign(this, { now, setTimer, clearTimer, maxRooms, hostGraceMs, roomLifeMs, rooms: new Map(), clients: new Map() });
  }
  send(socket, value) { try { socket.send(JSON.stringify(value)); } catch { /* Socket déjà fermée. */ } }
  refuse(socket, message) { this.send(socket, { type: 'error', message }); try { socket.close(4000, 'refus'); } catch { /* Déjà fermée. */ } }

  /** Un téléphone ouvre une connexion : créer, reprendre (hôte) ou rejoindre (invité) un salon. */
  open(socket, params = {}) {
    try {
      if (params.action === 'create') {
        if (this.rooms.size >= this.maxRooms) throw new Error('Trop de salons ouverts en ce moment. Réessayez dans quelques minutes.');
        let code; do { code = hex(3).toUpperCase(); } while (this.rooms.has(code));
        const room = { code, key: hex(16), host: null, guests: new Map(), queue: [], created: this.now(), timer: null };
        this.rooms.set(code, room);
        this.attachHost(room, socket);
        this.send(socket, { type: 'created', code, key: room.key });
      } else if (params.action === 'resume') {
        const room = this.rooms.get(String(params.code));
        if (!room || room.key !== params.key) throw new Error('Ce salon a expiré. Créez-en un nouveau.');
        if (room.host) { this.clients.delete(room.host); try { room.host.close(4001, 'remplacé'); } catch { /* Déjà fermée. */ } }
        this.attachHost(room, socket);
        this.send(socket, { type: 'resumed', code: room.code });
        // Messages arrivés pendant la coupure de l’hôte.
        for (const message of room.queue.splice(0)) this.send(socket, message);
      } else if (params.action === 'join') {
        const room = this.rooms.get(String(params.code ?? '').trim().toUpperCase());
        if (!room) throw new Error('Ce code ne correspond à aucun salon.');
        if (room.guests.size >= MAX_GUESTS) throw new Error('Ce salon est complet.');
        const guest = hex(8);
        room.guests.set(guest, socket);
        this.clients.set(socket, { role: 'guest', room, guest });
        this.send(socket, { type: 'joined', code: room.code });
        this.toHost(room, { type: 'guest', guest });
      } else throw new Error('Action inconnue.');
    } catch (error) { this.refuse(socket, error.message); }
  }
  attachHost(room, socket) {
    this.clearTimer(room.timer); room.timer = null;
    room.host = socket;
    this.clients.set(socket, { role: 'host', room });
  }
  toHost(room, message) {
    if (room.host) this.send(room.host, message);
    else if (room.queue.length < MAX_QUEUE) room.queue.push(message);
  }

  message(socket, text) {
    const client = this.clients.get(socket);
    if (!client) return;
    let message;
    try {
      if (typeof text !== 'string' || text.length > MAX_MESSAGE) throw new Error();
      message = JSON.parse(text);
      if (!message || typeof message !== 'object' || typeof message.type !== 'string') throw new Error();
    } catch { this.refuse(socket, 'Message invalide.'); this.closed(socket); return; }
    if (message.type === 'ping') return;
    const { room } = client;
    const data = message.data && typeof message.data === 'object' ? message.data : null;
    if (client.role === 'host') {
      if (message.type === 'to' && data) {
        const guest = room.guests.get(message.guest);
        if (guest) this.send(guest, { type: 'from-host', data });
      } else if (message.type === 'end') this.end(room, 'La partie a commencé sans vous.');
    } else if (message.type === 'to-host' && data) this.toHost(room, { type: 'from', guest: client.guest, data });
  }

  /** Fin d’une connexion : l’hôte a un délai pour revenir, un invité libère sa place. */
  closed(socket) {
    const client = this.clients.get(socket);
    if (!client) return;
    this.clients.delete(socket);
    const { room } = client;
    if (!this.rooms.has(room.code)) return;
    if (client.role === 'host') {
      if (room.host !== socket) return;
      room.host = null;
      room.timer = this.setTimer(() => this.end(room, 'L’hôte a quitté le salon.'), this.hostGraceMs);
    } else {
      room.guests.delete(client.guest);
      this.toHost(room, { type: 'gone', guest: client.guest });
    }
  }
  end(room, message) {
    if (this.rooms.get(room.code) !== room) return;
    this.rooms.delete(room.code);
    this.clearTimer(room.timer);
    for (const socket of room.guests.values()) { this.clients.delete(socket); this.refuse(socket, message); }
    if (room.host) { this.clients.delete(room.host); try { room.host.close(1000, 'fin'); } catch { /* Déjà fermée. */ } }
    room.guests.clear();
  }
  /** À appeler régulièrement : ferme les salons trop anciens. */
  sweep() {
    for (const room of [...this.rooms.values()]) if (this.now() - room.created > this.roomLifeMs) this.end(room, 'Le salon a expiré. Créez une nouvelle partie.');
  }
}
