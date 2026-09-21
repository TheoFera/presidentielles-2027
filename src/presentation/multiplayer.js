import { CANDIDATES, portrait } from './arcade-content.js';
import { scanQr } from './qr-camera.js';
import { showQrInvitations, showQrAnswer } from './qr-pairing.js';
import { decodeInvitation } from '../network/peer-session.js';
import { candidatesReady } from '../network/lobby.js';

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
  menu.page('multiplayer', 'Défiez vos amis', `<p class="menu-intro">2 ou 3 appareils sur le même Wi-Fi. L’un crée la partie.</p><form id="room-form" class="multiplayer-form"><div class="setup-fields"><label>Connexion<select id="network-method"><option value="direct">Entre téléphones · Wi-Fi</option><option value="server">Avec un serveur local</option></select></label></div><p id="server-status" class="menu-status" role="status"></p><div class="mode-grid network-modes"><div class="tutorial-card"><h2>Héberger</h2><p>Affichez les deux QR pour vos amis.</p><button type="button" class="menu-primary" id="create-room">Créer un salon</button></div><div class="tutorial-card"><h2>Rejoindre</h2><label id="room-code-label" for="room-code">Invitation reçue</label><input id="room-code" placeholder="Collez l’invitation P27:…" autocomplete="off" autocapitalize="off" spellcheck="false" enterkeyhint="go" required><button class="menu-primary" type="submit">Rejoindre</button></div></div><p id="room-error" class="menu-status" role="alert"></p></form><p class="menu-note">Gardez le jeu ouvert. Autorisez le réseau local si le navigateur le demande.</p>`);
  const generation = menu.generation;
  const joinCard = menu.element.querySelector('#room-code').closest('.tutorial-card');
  const scan = document.createElement('button'); scan.type = 'button'; scan.id = 'scan-invitation'; scan.className = 'menu-primary'; scan.textContent = 'Scanner un QR';
  joinCard.insertBefore(scan, joinCard.querySelector('label'));
  const textJoin = document.createElement('button'); textJoin.type = 'button'; textJoin.id = 'text-join'; textJoin.textContent = 'Mode texte';
  joinCard.append(textJoin);
  const manualFields = [joinCard.querySelector('label'), joinCard.querySelector('input'), joinCard.querySelector('button[type="submit"]')];
  function joinMode(manual) {
    joinCard.dataset.manual = String(manual);
    manualFields.forEach(field => { field.hidden = !manual; });
    scan.hidden = manual; textJoin.textContent = manual ? 'Utiliser le QR' : 'Mode texte';
  }
  textJoin.onclick = () => joinMode(!scan.hidden);
  menu.element.querySelector('.network-modes > :first-child p').textContent = 'Affichez les deux QR pour vos amis.';
  let stopScanner;
  menu.cleanup = () => stopScanner?.();
  scan.onclick = () => {
    stopScanner = scanQr({ title: 'Scannez une place chez l’hôte', accept: async (value, signal) => {
      decodeInvitation(value, 'offer');
      await connect('join', { transport: 'direct', code: value, signal });
    } });
  };
  let check = 0;
  const method = menu.element.querySelector('#network-method');
  const invitedRoom = new URLSearchParams(location.search).get('salon');
  if (invitedRoom) { method.value = 'server'; menu.element.querySelector('#room-code').value = invitedRoom.toUpperCase(); }
  async function updateMethod() {
    const requestId = ++check;
    const direct = method.value === 'direct';
    joinMode(!direct); textJoin.hidden = !direct;
    const status = menu.element.querySelector('#server-status'), input = menu.element.querySelector('#room-code');
    menu.element.querySelector('#room-code-label').textContent = direct ? 'Invitation reçue' : 'Code du salon';
    input.placeholder = direct ? 'Collez l’invitation P27:…' : 'Ex. A1B2C3';
    input.maxLength = direct ? 30000 : 6;
    menu.element.querySelectorAll('#room-form button').forEach(b => { b.disabled = false; });
    if (direct) { status.textContent = 'Sans ordinateur : scannez un QR, puis montrez votre réponse.'; return; }
    status.textContent = 'Recherche du serveur…';
    try {
      const response = await fetch('/api/multiplayer/status', { signal: AbortSignal.timeout(5000) });
      const info = response.ok ? await response.json() : null;
      if (!info?.available) throw new Error();
      if (generation !== menu.generation || requestId !== check) return;
      menu.connection = info;
      status.textContent = info.lan_enabled === false ? 'Serveur limité à cet ordinateur. Relancez le jeu avec le réseau local activé.' : 'Serveur disponible. Partagez l’adresse affichée dans le salon.';
    } catch {
      if (generation !== menu.generation || requestId !== check) return;
      status.textContent = 'Ce mode nécessite un serveur. Choisissez « Entre téléphones » pour jouer sans ordinateur.';
      menu.element.querySelectorAll('#room-form button').forEach(b => { b.disabled = true; });
    }
  }
  method.onchange = () => { menu.element.querySelector('#room-code').value = ''; void updateMethod(); };
  void updateMethod();
  async function submit(action) {
    const buttons = menu.element.querySelectorAll('#room-form button'); buttons.forEach(b => { b.disabled = true; });
    menu.element.querySelector('#room-error').textContent = '';
    try { await connect(action, { transport: method.value, code: menu.element.querySelector('#room-code').value.trim() }); }
    catch (error) { if (generation === menu.generation) menu.element.querySelector('#room-error').textContent = error.message; }
    finally { buttons.forEach(b => { b.disabled = false; }); }
  }
  menu.element.querySelector('#create-room').onclick = () => submit('create');
  menu.element.querySelector('#room-form').onsubmit = event => { event.preventDefault(); void submit('join'); };
}

async function copyCode(input, status) {
  try { await navigator.clipboard.writeText(input.value); status.textContent = 'Copié ! Envoyez ce texte à votre ami.'; }
  catch {
    input.focus(); input.select();
    status.textContent = document.execCommand('copy') ? 'Copié ! Envoyez ce texte à votre ami.' : 'Texte sélectionné : maintenez le champ pour le copier.';
  }
}
function signalOutput(label) {
  return `<label for="outgoing-code">${label}</label><div class="copy-row"><input id="outgoing-code" readonly spellcheck="false"><button id="copy-signal" type="button">Copier</button></div>`;
}
export function showPeerInvite(menu, session) {
  showQrInvitations(menu, session, () => showLobby(menu, session, () => menu.home()), () => showTextInvite(menu, session));
}
async function showTextInvite(menu, session) {
  menu.page('invite', 'Invitez un ami', `<div class="pairing-grid"><article class="tutorial-card"><h2>01 · Envoyez l’invitation</h2><p>Votre ami ouvre Multijoueur → Mode texte et colle cette invitation dans « Rejoindre ».</p>${signalOutput('Invitation à envoyer')}<p id="copy-status" class="menu-status" role="status">Préparation de l’invitation…</p></article><form id="answer-form" class="tutorial-card"><h2>02 · Collez sa réponse</h2><p>Votre ami vous renvoie une réponse. Collez-la ici pour le connecter.</p><label for="answer-code">Réponse de votre ami</label><input id="answer-code" placeholder="Collez la réponse P27:…" autocomplete="off" spellcheck="false" autocapitalize="off" required maxlength="30000"><button id="accept-peer" class="menu-primary">Connecter le joueur</button><p id="pair-error" class="menu-status" role="status"></p></form></div><p class="menu-note">Une invitation par ami. Revenez au jeu après avoir envoyé le texte.</p>`, () => { showLobby(menu, session, () => menu.home()); });
  const generation = menu.generation;
  const copy = menu.element.querySelector('#copy-signal'); copy.disabled = true;
  menu.element.querySelector('#answer-form').onsubmit = async event => {
    event.preventDefault();
    const button = menu.element.querySelector('#accept-peer'); button.disabled = true;
    try {
      await session.accept(menu.element.querySelector('#answer-code').value);
      if (menu.generation === generation) menu.element.querySelector('#pair-error').textContent = 'Connexion au joueur…';
    } catch (error) {
      if (menu.generation === generation) { menu.element.querySelector('#pair-error').textContent = error.message; button.disabled = false; }
    }
  };
  try {
    const code = await session.invite();
    if (menu.generation !== generation) return;
    menu.element.querySelector('#outgoing-code').value = code;
    menu.element.querySelector('#copy-status').textContent = 'Invitation prête. Copiez-la, puis envoyez-la.';
    copy.disabled = false; copy.onclick = () => copyCode(menu.element.querySelector('#outgoing-code'), menu.element.querySelector('#copy-status'));
  } catch (error) { if (menu.generation === generation) menu.element.querySelector('#copy-status').textContent = error.message; }
}
export function showPeerAnswer(menu, session, leave) {
  showQrAnswer(menu, session, leave, () => showTextAnswer(menu, session, leave));
}
function showTextAnswer(menu, session, leave) {
  menu.page('answer', 'Renvoyez votre réponse', `<article class="tutorial-card answer-card"><h2>Dernière étape</h2><p>Envoyez ce texte à l’hôte. Il le colle dans « Réponse de votre ami » puis touche « Connecter le joueur ».</p>${signalOutput('Votre réponse')}<p id="copy-status" class="menu-status" role="status">Gardez cette page ouverte après l’envoi.</p></article><p class="menu-note">Le salon s’ouvrira dès que l’hôte aura validé votre réponse.</p>`, leave);
  menu.element.querySelector('#outgoing-code').value = session.answer;
  menu.element.querySelector('#copy-signal').onclick = () => copyCode(menu.element.querySelector('#outgoing-code'), menu.element.querySelector('#copy-status'));
}
export function showLobby(menu, session, leave) {
  menu.page('lobby', 'Les challengers', `<div class="lobby-heading"><span class="eyebrow">${session.direct ? 'CONNEXION DIRECTE · MÊME WI-FI' : 'CODE DU SALON'}</span><span class="room-code">${session.code}</span></div><div id="room-players" class="lobby-players"></div>${session.direct ? '<p class="menu-note">L’hôte garde cette page ouverte pendant toute la partie.</p>' : '<label for="join-url">Adresse à ouvrir sur les autres appareils</label><div class="copy-row"><input id="join-url" readonly><button id="copy-link">Copier</button></div>'}<p id="room-message" class="menu-status" role="status"></p><footer class="menu-footer"><button id="invite-player" ${session.host && session.direct ? '' : 'hidden'}>Inviter mes amis</button><span class="menu-note" ${session.host ? 'hidden' : ''}>L’hôte lance la partie.</span><button id="launch-room" class="menu-primary" ${session.host ? '' : 'hidden'}>Préparer la partie →</button></footer>`, leave);
  menu.element.querySelector('#launch-room').onclick = () => session.request('start').catch(error => { if (menu.screen === 'lobby') menu.element.querySelector('#room-message').textContent = error.message; });
  menu.element.querySelector('#invite-player').onclick = () => showPeerInvite(menu, session);
  if (!session.direct) {
    const base = menu.connection?.join_urls?.[0] || location.origin;
    const link = new URL(location.pathname, base); link.searchParams.set('salon', session.code);
    const input = menu.element.querySelector('#join-url'); input.value = link.href;
    menu.element.querySelector('#copy-link').onclick = () => copyCode(input, menu.element.querySelector('#room-message'));
  }
  updateLobby(menu, session);
}
export function updateLobby(menu, session) {
  if (menu.screen !== 'lobby') return;
  const me = session.room.players.find(p => p.id === session.id);
  menu.element.querySelector('.eyebrow').textContent = `${session.room.players.length}/3 CONNECTÉS · VOUS : JOUEUR ${me?.slot || 1}`;
  menu.element.querySelector('#room-players').replaceChildren(...CANDIDATES.map(candidate => {
    const player = session.room.players.find(p => p.faction === candidate.id);
    const card = document.createElement('div'); card.className = 'lobby-player';
    card.classList.toggle('vacant', !player);
    const image = document.createElement('img'); image.src = portrait(candidate); image.alt = '';
    const name = document.createElement('strong'); name.textContent = candidate.short;
    const status = document.createElement('p'); status.textContent = player ? `Joueur ${player.slot}${player.id === session.id ? ' · Vous' : ''}` : 'Disponible';
    const choose = document.createElement('button'); choose.type = 'button'; choose.dataset.choose = candidate.id;
    choose.textContent = player?.id === session.id ? 'Votre candidat' : player ? 'Déjà choisi' : 'Choisir';
    choose.disabled = session.room.players.length < 2 || !!player;
    choose.onclick = () => {
      choose.disabled = true; session.selectionError = '';
      session.request('choose', { faction: candidate.id }).catch(error => {
        if (menu.screen === 'lobby') { session.selectionError = error.message; updateLobby(menu, session); }
      });
    };
    card.append(image, name, status, choose); return card;
  }));
  menu.element.querySelector('#launch-room').disabled = !candidatesReady(session.room);
  menu.element.querySelector('#invite-player').disabled = session.room.players.length >= 3;
  menu.element.querySelector('#room-message').textContent = session.selectionError || (session.room.players.length < 2 ? 'Connectez un ami, puis choisissez vos candidats.' : !candidatesReady(session.room) ? 'Choisissez chacun un candidat différent pour commencer.' : session.host ? `${session.room.players.length}/3 joueurs · Prêts à en découdre !` : 'En attente du lancement par l’hôte…');
}
