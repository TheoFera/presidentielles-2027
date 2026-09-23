import { randomBytes } from 'node:crypto';
import { chooseCandidate, candidatesReady } from '../src/network/lobby.js';

import { sanitizeCommands } from '../src/network/shared-commands.js';
export { sanitizeCommands } from '../src/network/shared-commands.js';

// Rooms live only in memory; no accounts or personal information are stored.
export function createMultiplayerHandler({ status = () => ({ available: true }) } = {}) {
  const rooms = new Map();
  const view = room => ({ code: room.code, phase: room.phase, paused: room.paused, players: room.players.map(p => ({ id: p.id, slot: p.slot, faction: p.faction, host: p.host, ready: p.ready })) });
  const writable = player => player.stream && !player.stream.destroyed && player.stream.writableLength < 2_000_000;
  const encodeEvent = (type, data) => `event: ${type}\ndata: ${JSON.stringify(data)}\n\n`;
  const send = (player, type, data) => { if (writable(player)) player.stream.write(encodeEvent(type, data)); };
  const broadcast = (room, type, data, guestsOnly = false) => {
    const players = room.players.filter(p => (!guestsOnly || !p.host) && writable(p));
    if (!players.length) return;
    const message = encodeEvent(type, data);
    for (const player of players) player.stream.write(message);
  };
  const changed = room => broadcast(room, 'room', view(room));
  const close = (room, message) => { broadcast(room, 'ended', { message }); rooms.delete(room.code); room.players.forEach(p => p.stream?.end()); };
  const sweep = setInterval(() => {
    for (const room of rooms.values()) {
      if (Date.now() - room.touched > 2 * 60 * 60 * 1000) close(room, 'Le salon a expiré. Créez une nouvelle partie.');
      else for (const p of room.players) {
        if (Date.now() - p.seen > 20000) { close(room, 'Un joueur s’est déconnecté. Retournez au salon pour créer une nouvelle partie.'); break; }
        send(p, 'ping', {});
      }
    }
  }, 5000);
  sweep.unref();
  async function handler(req, res) {
    const url = new URL(req.url, 'http://localhost');
    if (!url.pathname.startsWith('/api/multiplayer')) return false;
    const reply = (status, value) => { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(value)); };
    try {
      if (url.pathname === '/api/multiplayer/status' && req.method === 'GET') { reply(200, status(req)); return true; }
      if (req.headers.origin && req.headers.origin !== `http://${req.headers.host}` && req.headers.origin !== `https://${req.headers.host}`) throw new Error('Origine de connexion refusée.');
      if (url.pathname === '/api/multiplayer/events' && req.method === 'GET') {
        const room = rooms.get(url.searchParams.get('code'));
        const player = room?.players.find(p => p.token === url.searchParams.get('token'));
        if (!player) throw new Error('Salon introuvable ou connexion expirée.');
        player.stream?.end(); player.stream = res; player.seen = Date.now();
        res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
        res.write(': connecté\n\n'); send(player, 'room', view(room));
        return true;
      }
      if (req.method !== 'POST') { reply(405, { error: 'Méthode non autorisée.' }); return true; }
      const chunks = []; let size = 0;
      for await (const chunk of req) { size += chunk.length; if (size > 1_000_000) throw new Error('Message trop volumineux.'); chunks.push(chunk); }
      const data = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
      const action = url.pathname.split('/').at(-1);
      if (['create', 'join'].includes(action)) {
        let room;
        if (action === 'create') {
          if (rooms.size >= 32) throw new Error('Le serveur est plein. Réessayez plus tard.');
          let code; do { code = randomBytes(3).toString('hex').toUpperCase(); } while (rooms.has(code));
          room = { code, players: [], phase: 'lobby', paused: false, touched: Date.now() }; rooms.set(code, room);
        } else {
          room = rooms.get(String(data.code).trim().toUpperCase());
          if (!room) throw new Error('Ce code ne correspond à aucun salon.');
          if (room.phase !== 'lobby') throw new Error('La partie a déjà commencé.');
          if (room.players.length >= 3) throw new Error('Ce salon est complet.');
        }
        const player = { id: randomBytes(8).toString('hex'), slot: [1, 2, 3].find(s => !room.players.some(p => p.slot === s)), token: randomBytes(24).toString('hex'), host: action === 'create', faction: null, ready: false, seen: Date.now() };
        room.players.push(player); room.touched = Date.now(); changed(room);
        reply(200, { code: room.code, token: player.token, id: player.id, room: view(room) }); return true;
      }
      const room = rooms.get(data.code);
      const player = room?.players.find(p => p.token === data.token);
      if (!player) throw new Error('Salon introuvable ou connexion expirée.');
      player.seen = Date.now(); room.touched = Date.now();
      if (action === 'heartbeat') { /* Presence survives a paused or hidden tab. */ }
      else if (action === 'leave') {
        if (player.host || room.phase !== 'lobby') close(room, 'Un joueur a quitté la partie.');
        else { player.stream?.end(); room.players = room.players.filter(p => p !== player); changed(room); }
      } else if (action === 'choose') {
        chooseCandidate(room, player.id, data.faction); changed(room);
      } else if (action === 'start') {
        if (!player.host || room.phase !== 'lobby' || room.players.length !== 3) throw new Error('Il faut être l’hôte et réunir trois joueurs.');
        if (!candidatesReady(room)) throw new Error('Chaque joueur doit choisir son candidat.');
        room.phase = 'loading'; room.players.forEach(p => { p.ready = false; }); changed(room);
      } else if (action === 'ready') {
        if (room.phase !== 'loading') throw new Error('La préparation n’a pas commencé.');
        player.ready = true;
        if (room.players.every(p => p.ready)) room.phase = 'playing';
        changed(room);
      } else if (action === 'pause') {
        if (room.phase !== 'playing') throw new Error('La partie n’a pas commencé.');
        room.paused = data.paused === true; changed(room);
      } else if (action === 'commands') {
        if (room.phase !== 'playing') throw new Error('La partie n’a pas commencé.');
        send(room.players.find(p => p.host), 'commands', { playerId: player.id, commands: sanitizeCommands(data.commands, player.faction) });
      } else if (action === 'snapshot') {
        if (!player.host || room.phase !== 'playing') throw new Error('Seul l’hôte peut mettre à jour la partie.');
        if (!data.state || !Number.isInteger(data.state.tick) || !Array.isArray(data.state.candidates)) throw new Error('État invalide.');
        broadcast(room, 'snapshot', data.state, true);
      } else throw new Error('Action inconnue.');
      reply(200, { ok: true });
    } catch (error) { if (!res.headersSent) reply(400, { error: error.message }); else res.end(); }
    return true;
  }
  handler.close = () => { clearInterval(sweep); for (const room of rooms.values()) close(room, 'Le serveur a été arrêté.'); };
  return handler;
}
