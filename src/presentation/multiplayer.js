import { CANDIDATES, candidatesContent } from './arcade-content.js';
import { scanQr } from './qr-camera.js';
import { copySignal } from './copy-signal.js';
import { showQrInvitations, showQrAnswer } from './qr-pairing.js';
import { decodeInvitation } from '../network/peer-session.js';
import { onlineServer, onlineInviteLink, normalizeRoomCode } from '../network/online-config.js';
import { candidatesReady, selectionOpen, playerName } from '../network/lobby.js';
import { escape } from './debate-selection.js';
import { showDebateLobby, updateDebateLobby } from './debate-lobby.js';
import { hydrateMedallions, medallionContent, titleContent } from './player-card.js';
import { titleName } from '../simulation/player-titles.js';

// Phones lose the link for a few seconds all the time (screen lock, app switch,
// Wi-Fi power saving). The browser reconnects the event stream by itself: only a
// definitive refusal from the server, or a long silence, ends the session.
const SERVER_GRACE_MS = { lobby: 60000, loading: 60000, playing: 30000 };
export class MultiplayerSession {
  constructor(callbacks) { this.callbacks = callbacks; this.room = null; this.source = null; this.closed = false; this.contact = Date.now(); }
  get host() { return this.room?.players.find(p => p.id === this.id)?.host === true; }
  get candidateId() { return `candidate:${this.room.players.find(p => p.id === this.id).faction}`; }
  async request(action, data = {}, options = {}) {
    let response;
    try {
      response = await fetch(`/api/multiplayer/${action}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: this.code, token: this.token, ...data }), signal: AbortSignal.timeout(10000), ...options });
    } catch {
      // Lost packet, timeout or Wi-Fi hiccup: the heartbeat's grace delay decides.
      const error = new Error('Connexion au serveur momentanément perdue.'); error.transient = true; throw error;
    }
    const result = await response.json().catch(() => ({}));
    if (!response.ok) { const error = new Error(result.error || 'Connexion impossible.'); error.refused = response.status === 400; error.transient = response.status >= 500; throw error; }
    this.contact = Date.now();
    return result;
  }
  get grace() { return SERVER_GRACE_MS[this.room?.phase] ?? 60000; }
  async connect(action, data) {
    Object.assign(this, await this.request(action, data));
    this.source = new EventSource(`/api/multiplayer/events?code=${this.code}&token=${this.token}`);
    const seen = () => { this.contact = Date.now(); };
    this.source.onopen = seen;
    this.source.addEventListener('ping', seen);
    this.source.addEventListener('room', event => { seen(); this.room = JSON.parse(event.data); this.callbacks.room(this.room); });
    this.source.addEventListener('commands', event => { seen(); this.callbacks.commands(JSON.parse(event.data)); });
    this.source.addEventListener('snapshot', event => { seen(); this.callbacks.snapshot(JSON.parse(event.data)); });
    this.source.addEventListener('ended', event => this.fail(JSON.parse(event.data).message));
    // CONNECTING means the browser is already retrying; CLOSED means the server
    // refused the stream (room closed or player removed).
    this.source.onerror = () => {
      if (this.source.readyState === EventSource.CLOSED) this.fail('Connexion au salon interrompue. Le salon a été fermé ou vous en avez été retiré.');
    };
    this.heartbeat = setInterval(() => this.beat(), 4000);
  }
  beat() {
    if (this.closed) return;
    if (Date.now() - this.contact > this.grace) { this.fail('Le serveur ne répond plus. Vérifiez le Wi-Fi, puis créez ou rejoignez un nouveau salon.'); return; }
    if (this.beating) return;
    this.beating = true;
    this.request('heartbeat')
      .catch(error => { if (!error.transient) this.fail(error.message); })
      .finally(() => { this.beating = false; });
  }
  // After the page comes back from the background, the silence was ours: restart the grace delay.
  resume() { if (this.closed) return; this.contact = Date.now(); this.beat(); }
  fail(message) { if (this.closed) return; this.close(); this.callbacks.ended(message); }
  close() { this.closed = true; clearInterval(this.heartbeat); this.source?.close(); if (this.token) this.request('leave', {}, { keepalive: true }).catch(() => {}); }
}

/** Entre amis : créer une partie (on reçoit un code) ou rejoindre avec un code. */
export async function showMultiplayerSetup(menu, connect, mode = 'campaign') {
  if (!onlineServer() || new URLSearchParams(location.search).has('salon')) return showLocalSetup(menu, connect, mode);
  const debate = mode === 'debate', friends = debate ? '1 ou 2 amis' : '2 amis';
  const invited = normalizeRoomCode(new URLSearchParams(location.search).get('en-ligne'));
  menu.page('multiplayer', debate ? 'Débat télé multijoueur' : 'Campagne multijoueur', `<p class="menu-intro">Jouez avec ${friends}, à côté ou à distance.</p><div class="mode-grid network-modes online-modes"><div class="tutorial-card"><h2>Créer une partie</h2><p>Vous recevez un code à envoyer à ${friends}.</p><button type="button" class="menu-primary arcade-button" id="create-room">Créer</button></div><form id="room-form" class="tutorial-card"><h2>Rejoindre</h2><label for="room-code">Code reçu</label><input id="room-code" class="code-input" placeholder="A1B2C3" maxlength="200" autocomplete="off" autocapitalize="characters" spellcheck="false" enterkeyhint="go" required><button class="menu-primary arcade-button" type="submit" id="join-room">Rejoindre</button></form></div><p id="room-error" class="menu-status" role="alert"></p><button type="button" id="offline-mode" class="menu-link">Pas d’Internet ? Jouez sur le même Wi-Fi avec des QR codes</button>`);
  menu.back = () => menu.players(mode);
  const generation = menu.generation, root = menu.element;
  const input = root.querySelector('#room-code'), error = root.querySelector('#room-error');
  const buttons = () => root.querySelectorAll('#create-room, #join-room, #offline-mode');
  input.oninput = () => { const code = normalizeRoomCode(input.value); if (input.value !== code) input.value = code; error.textContent = ''; };
  if (invited) { input.value = invited; root.querySelector('#join-room').focus(); }
  root.querySelector('#offline-mode').onclick = () => showLocalSetup(menu, connect, mode);
  async function submit(action) {
    const code = normalizeRoomCode(input.value);
    if (action === 'join' && code.length !== 6) { error.textContent = 'Le code fait 6 caractères, par exemple A1B2C3.'; input.focus(); return; }
    buttons().forEach(b => { b.disabled = true; });
    error.textContent = action === 'create' ? 'Création de la partie…' : 'Connexion à la partie…';
    try { await connect(action, { transport: 'online', mode, code }); }
    catch (failure) {
      if (generation !== menu.generation) return;
      error.textContent = /ne répond pas|injoignable|perdue/.test(failure.message) ? `${failure.message} Sans Internet, utilisez les QR codes ci-dessous.` : failure.message;
    } finally { if (generation === menu.generation) buttons().forEach(b => { b.disabled = false; }); }
  }
  root.querySelector('#create-room').onclick = () => submit('create');
  root.querySelector('#room-form').onsubmit = event => { event.preventDefault(); void submit('join'); };
}

// Secours sans Internet : connexion directe par QR (même Wi-Fi) ou serveur de l’ordinateur.
async function showLocalSetup(menu, connect, mode = 'campaign') {
  const debate = mode === 'debate';
  menu.page('multiplayer-local', 'Sans Internet · même Wi-Fi', `<p class="menu-intro">${debate ? '2 ou 3 appareils' : '3 appareils'} sur le même Wi-Fi. L’un crée la partie.</p><form id="room-form" class="multiplayer-form"><div class="setup-fields"><label>Connexion<select id="network-method"><option value="direct">Entre téléphones · Wi-Fi</option><option value="server">Avec un serveur local</option></select></label></div><p id="server-status" class="menu-status" role="status"></p><div class="mode-grid network-modes"><div class="tutorial-card"><h2>Héberger</h2><p>Affichez les deux QR pour vos amis.</p><button type="button" class="menu-primary" id="create-room">Créer un salon</button></div><div class="tutorial-card"><h2>Rejoindre</h2><label id="room-code-label" for="room-code">Invitation reçue</label><input id="room-code" placeholder="Collez l’invitation P27:…" autocomplete="off" autocapitalize="off" spellcheck="false" enterkeyhint="go" required><button class="menu-primary" type="submit">Rejoindre</button></div></div><p id="room-error" class="menu-status" role="alert"></p></form><p class="menu-note">Gardez le jeu ouvert. Autorisez le réseau local si le navigateur le demande.</p>`);
  menu.back = () => onlineServer() ? showMultiplayerSetup(menu, connect, mode) : menu.players(mode);
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
    if (action === 'create' && method.value === 'direct') menu.element.querySelector('#server-status').textContent = 'Autorisez la caméra : elle sert à scanner les réponses et aide le téléphone à trouver son Wi-Fi local.';
    try { await connect(action, { transport: method.value, mode, code: menu.element.querySelector('#room-code').value.trim() }); }
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
  // Débat à deux : « Jouer à deux » ferme le salon, et la sélection s’ouvre pour tout le monde.
  const playTwo = () => session.request('close').catch(error => { session.notice = error.message; menu.roomUpdate?.(); });
  const back = () => { if (selectionOpen(session.room)) showLobby(menu, session); else menu.home(); };
  showQrInvitations(menu, session, back, () => showTextInvite(menu, session), playTwo);
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
export function showLobby(menu, session, leave = () => menu.home()) {
  // Tant que le salon n’est pas prêt, tout le monde reste dans la salle d’attente.
  if (!selectionOpen(session.room)) {
    if (session.direct && session.host) { showPeerInvite(menu, session); return; }
    showWaitingRoom(menu, session, leave);
    updateLobby(menu, session, leave);
    return;
  }
  if (session.room.mode === 'debate') { showDebateLobby(menu, session, leave); return; }
  menu.page('candidates', 'Choisissez votre candidat', candidatesContent(), leave);
  menu.element.dataset.multiplayer = 'true';
  menu.cleanup = () => { delete menu.element.dataset.multiplayer; };
  const status = document.createElement('p'); status.id = 'room-message'; status.className = 'menu-status'; status.setAttribute('role', 'status');
  menu.element.querySelector('.menu-footer').prepend(status);
  const launch = menu.element.querySelector('#prepare-game'); launch.hidden = !session.host;
  launch.onclick = () => session.request('start').catch(error => {
    if (menu.screen === 'candidates') { session.selectionError = error.message; updateLobby(menu, session, leave); }
  });
  menu.element.querySelectorAll('[data-candidate]').forEach(card => {
    card.onclick = async () => {
      if (session.choosing) return;
      session.choosing = true; session.selectionError = '';
      updateLobby(menu, session, leave);
      try { await session.request('choose', { faction: card.dataset.candidate }); }
      catch (error) { session.selectionError = error.message; }
      finally { session.choosing = false; if (menu.screen === 'candidates') updateLobby(menu, session, leave); }
    };
  });
  updateLobby(menu, session, leave);
}
// Lien d’invitation : celui du jeu en ligne, ou l’adresse du serveur de l’ordinateur.
function invitationLink(menu, session) {
  if (session.online) return onlineInviteLink(session.code);
  const link = new URL(location.pathname, menu.connection?.join_urls?.[0] || location.origin);
  link.searchParams.set('salon', session.code);
  return link.href;
}
/**
 * Salle d’attente : le code à partager (en ligne) et les trois places, avec le pseudo
 * de chaque joueur. En débat, l’hôte peut commencer à deux sans attendre le 3e.
 */
function showWaitingRoom(menu, session, leave) {
  const code = !session.direct;
  const debate = session.room.mode === 'debate';
  menu.page('waiting', code ? 'Invitez vos amis' : 'Salon', `<div class="waiting-room" data-code="${code}">${code ? `<section class="tutorial-card waiting-code"><span class="eyebrow">Code de la partie</span><strong class="room-code"></strong><p>${debate ? '1 ou 2 amis' : 'Vos 2 amis'} touchent « Rejoindre » et tapent ce code, ou ouvrent le lien.</p><div class="waiting-actions"><button id="share-room" class="menu-primary waiting-button"><span aria-hidden="true">✉</span> Envoyer l’invitation</button><button id="copy-link" class="waiting-button"><span aria-hidden="true">⧉</span> Copier le lien</button></div></section>` : ''}<section class="tutorial-card waiting-players"><header><h2>Joueurs</h2><span class="waiting-count"></span></header><ol class="lobby-slots" aria-label="Joueurs"></ol><button id="play-two" class="menu-primary waiting-button" hidden>Commencer à deux <span aria-hidden="true">➜</span></button></section></div><p id="room-message" class="menu-status" role="status"></p>`, leave);
  const root = menu.element, status = root.querySelector('#room-message');
  root.querySelector('#play-two').onclick = event => {
    event.currentTarget.disabled = true;
    session.request('close').catch(error => { session.notice = error.message; updateLobby(menu, session, leave); });
  };
  if (!code) return;
  const link = invitationLink(menu, session);
  root.querySelector('.room-code').textContent = session.code;
  const share = root.querySelector('#share-room'), copy = root.querySelector('#copy-link');
  // Sans partage natif (ordinateur), copier le lien devient le bouton principal.
  share.hidden = typeof navigator.share !== 'function';
  copy.classList.toggle('menu-primary', share.hidden);
  share.onclick = () => navigator.share({ title: 'Présidentielle 2027 : Le Jeu', text: `Rejoins ma partie de Présidentielle 2027 : Le Jeu ! Code : ${session.code}`, url: link }).catch(() => {});
  copy.onclick = () => copySignal(link, status);
}
/** Une place : numéro, médaillon (ou initiale), pseudo, titre et rôle (hôte, vous). */
function slotContent(session, slot) {
  const player = session.room.players.find(p => p.slot === slot);
  if (!player) {
    const optional = slot === 3 && session.room.mode === 'debate';
    return `<li data-ready="false"><span class="slot-number">J${slot}</span><span class="slot-avatar" aria-hidden="true">?</span><span class="slot-name">En attente…</span>${optional ? '<span class="slot-tags"><em>Facultatif</em></span>' : ''}</li>`;
  }
  const name = playerName(player), self = player.id === session.id;
  const tags = [player.host && 'Hôte', self && 'Vous'].filter(Boolean).map(t => `<em>${t}</em>`).join('');
  const avatar = player.card ? medallionContent(player.card, { size: 'md' }) : `<span class="slot-avatar" aria-hidden="true">${escape([...name][0].toUpperCase())}</span>`;
  return `<li data-ready="true" data-self="${self}"><span class="slot-number">J${slot}</span>${avatar}<span class="slot-name">${escape(name)}${titleContent(player.card)}</span><span class="slot-tags">${tags}</span></li>`;
}
function updateWaitingRoom(menu, session) {
  const root = menu.element, room = session.room, count = room.players.length;
  const list = root.querySelector('.lobby-slots');
  if (!list) return;
  list.innerHTML = [1, 2, 3].map(slot => slotContent(session, slot)).join('');
  hydrateMedallions(list);
  root.querySelector('.waiting-count').textContent = `${count}/3`;
  const debate = room.mode === 'debate';
  const playTwo = root.querySelector('#play-two');
  playTwo.hidden = !(debate && count === 2 && session.host); playTwo.disabled = false;
  const next = !debate ? 'La sélection s’ouvrira quand les trois joueurs seront connectés.'
    : count < 2 ? 'Envoyez le code à 1 ou 2 amis.'
    : session.host ? 'Attendez un 3e joueur, ou commencez à deux.' : 'L’hôte attend un 3e joueur ou lance le débat à deux.';
  root.querySelector('#room-message').textContent = (session.notice ? `${session.notice} ` : '') + next;
}
export function updateLobby(menu, session, leave = () => menu.home()) {
  // L’hôte reste sur ses QR tant que la sélection n’est pas ouverte.
  if (!selectionOpen(session.room)) {
    if (menu.screen === 'qr-invite') { menu.roomUpdate?.(); return; }
    if (menu.screen !== 'waiting') { showLobby(menu, session, leave); return; }
    updateWaitingRoom(menu, session);
    return;
  }
  if (session.room.mode === 'debate') {
    if (menu.screen !== 'debate-lobby') showLobby(menu, session, leave); else updateDebateLobby(menu);
    return;
  }
  if (menu.screen !== 'candidates' || menu.element.dataset.multiplayer !== 'true') { showLobby(menu, session, leave); return; }
  const me = session.room.players.find(p => p.id === session.id);
  menu.element.querySelectorAll('[data-candidate]').forEach(card => {
    const candidate = CANDIDATES.find(c => c.id === card.dataset.candidate);
    const player = session.room.players.find(p => p.faction === candidate.id);
    card.setAttribute('aria-pressed', String(player?.id === session.id));
    card.disabled = !!session.choosing || !!player && player.id !== session.id;
    card.dataset.occupied = String(!!player);
    card.querySelector('.candidate-badge').textContent = player ? `♛ J${player.slot} · ${playerName(player)}${titleName(player.card?.title) ? ` · ${titleName(player.card.title)}` : ''}` : '';
    card.setAttribute('aria-label', `${candidate.name}${player ? ` · ${playerName(player)}${player.id === session.id ? ' · Vous' : ''}` : ' · Disponible'}`);
  });
  menu.element.querySelector('#prepare-game').disabled = !candidatesReady(session.room);
  menu.element.querySelector('#room-message').textContent = session.selectionError || (!me?.faction ? `${playerName(me)} (J${me?.slot}) · Choisissez votre candidat.` : !candidatesReady(session.room) ? 'En attente du choix des autres joueurs…' : session.host ? 'Tout le monde a choisi. Vous pouvez valider.' : 'En attente du lancement par l’hôte…');
}
