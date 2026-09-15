import { CANDIDATES } from './start-menu.js';

export class MultiplayerSession {
  constructor(callbacks) { this.callbacks = callbacks; this.room = null; this.source = null; this.closed = false; }
  get host() { return this.room?.players.find(p => p.id === this.id)?.host === true; }
  get candidateId() { return `candidate:${this.room.players.find(p => p.id === this.id).faction}`; }
  async request(action, data = {}) {
    const response = await fetch(`/api/multiplayer/${action}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: this.code, token: this.token, ...data }), signal: AbortSignal.timeout(10000) });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Connexion impossible.');
    return result;
  }
  async connect(action, data) {
    Object.assign(this, await this.request(action, data));
    this.source = new EventSource(`/api/multiplayer/events?code=${this.code}&token=${this.token}`);
    this.source.addEventListener('room', event => { this.room = JSON.parse(event.data); this.callbacks.room(this.room); });
    this.source.addEventListener('commands', event => this.callbacks.commands(JSON.parse(event.data)));
    this.source.addEventListener('snapshot', event => this.callbacks.snapshot(JSON.parse(event.data)));
    this.source.addEventListener('ended', event => this.fail(JSON.parse(event.data).message));
    this.source.onerror = () => this.fail('Connexion au salon interrompue. Vérifiez votre réseau, puis créez ou rejoignez un nouveau salon.');
    this.heartbeat = setInterval(() => this.request('heartbeat').catch(() => this.fail('Le serveur ne répond plus.')), 4000);
  }
  fail(message) { if (this.closed) return; this.close(); this.callbacks.ended(message); }
  close() { this.closed = true; clearInterval(this.heartbeat); this.source?.close(); if (this.token) this.request('leave').catch(() => {}); }
}

export async function showMultiplayerSetup(menu, connect) {
  menu.page('multiplayer', 'La campagne à plusieurs.', `<span class="eyebrow">MULTIJOUEUR · 2 À 3 JOUEURS</span><p class="menu-intro">Un appareil par joueur, un candidat par personne. À deux, le troisième candidat est joué par l’ordinateur.</p><div class="tutorial-card"><p id="server-status" role="status">Vérification de la connexion au serveur…</p><form id="room-form" hidden><label for="multiplayer-candidate">Votre candidat</label><select id="multiplayer-candidate">${CANDIDATES.map(c => `<option value="${c.id}">${c.name}</option>`).join('')}</select><div class="mode-grid"><div><h2>Créer une partie</h2><p>Invitez vos amis avec le code du salon.</p><button type="button" class="menu-primary" id="create-room">Créer un salon</button></div><div><h2>Rejoindre une partie</h2><label for="room-code">Code du salon</label><input id="room-code" placeholder="Ex. A1B2C3" maxlength="6" autocomplete="off" autocapitalize="characters" pattern="[A-Fa-f0-9]{6}" required><button class="menu-primary" type="submit">Rejoindre</button></div></div></form><p id="room-error" role="alert"></p></div><p class="menu-note">Tous les joueurs doivent ouvrir la même adresse du jeu. L’hôte doit garder sa page ouverte pendant la partie.</p>`);
  const generation = menu.generation;
  try {
    const response = await fetch('/api/multiplayer/status', { signal: AbortSignal.timeout(5000) });
    if (!response.ok || !(await response.json()).available) throw new Error();
    if (generation !== menu.generation) return;
    menu.element.querySelector('#server-status').textContent = 'Serveur disponible. Créez un salon ou entrez le code d’un ami.';
    menu.element.querySelector('#room-form').hidden = false;
  } catch {
    if (generation === menu.generation) menu.element.querySelector('#server-status').textContent = 'Le multijoueur nécessite un serveur de parties. Cette adresse héberge uniquement le jeu solo. Ouvrez l’adresse du jeu fournie par la personne qui héberge le serveur multijoueur. Sur un même Wi-Fi, l’hôte peut lancer « Lancer le multijoueur.cmd » sur son ordinateur.';
    return;
  }
  async function submit(action) {
    const buttons = menu.element.querySelectorAll('#room-form button'); buttons.forEach(b => { b.disabled = true; });
    try { await connect(action, { faction: menu.element.querySelector('#multiplayer-candidate').value, code: menu.element.querySelector('#room-code').value.trim().toUpperCase() }); }
    catch (error) { if (generation === menu.generation) menu.element.querySelector('#room-error').textContent = error.message; }
    finally { buttons.forEach(b => { b.disabled = false; }); }
  }
  menu.element.querySelector('#create-room').onclick = () => submit('create');
  menu.element.querySelector('#room-form').onsubmit = event => { event.preventDefault(); submit('join'); };
}

export function showLobby(menu, session, leave) {
  menu.page('lobby', 'Votre salon de campagne.', `<span class="eyebrow">CODE DU SALON</span><p class="room-code">${session.code}</p><p class="menu-intro">Partagez l’adresse de cette page et ce code avec vos amis.</p><div id="room-players" class="tutorial-card"></div><p id="room-message" role="status"></p><footer class="menu-footer"><span class="menu-note">Deux joueurs minimum · Trois joueurs maximum</span><button id="launch-room" class="menu-primary" ${session.host ? '' : 'hidden'}>Préparer la partie →</button></footer>`, leave);
  menu.element.querySelector('#launch-room').onclick = () => session.request('start').catch(error => { menu.element.querySelector('#room-message').textContent = error.message; });
  updateLobby(menu, session);
}

export function updateLobby(menu, session) {
  if (menu.screen !== 'lobby') return;
  menu.element.querySelector('#room-players').replaceChildren(...session.room.players.map(p => {
    const line = document.createElement('p'); line.textContent = `${CANDIDATES.find(c => c.id === p.faction).name} · ${p.host ? 'Hôte' : 'Invité'}${p.id === session.id ? ' · Vous' : ''}`; return line;
  }));
  menu.element.querySelector('#launch-room').disabled = session.room.players.length < 2;
  menu.element.querySelector('#room-message').textContent = session.room.players.length < 2 ? 'En attente d’un autre joueur…' : session.host ? 'Vos invités sont là. Vous pouvez préparer la partie.' : 'En attente du lancement par l’hôte…';
}
