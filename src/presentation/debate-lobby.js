import { CANDIDATES, portrait } from './arcade-content.js';
import { campaignStyles } from '../simulation/campaign-styles.js';
import { debateSetupError, debateStyleAvailable, multiplayerDebateSetup } from '../simulation/debate-mode.js';
import { candidatesReady } from '../network/lobby.js';

const escape = text => String(text).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const styleName = style => style.name.split(' · ')[0];

/** Réglages de l’hôte : à 3 joueurs, seul le 1 contre 1 contre 1 est possible. */
function hostOptions(config, session) {
  const options = session.debateOptions ||= { format: '1v1', map: config.balance.debate_mode.default_map };
  if (session.room.players.length === 3) options.format = '1v1v1';
  return options;
}

function optionsContent(config, session, invite) {
  const count = session.room.players.length;
  const code = !session.direct && count < 3 ? `<p class="debate-map-help">Un 3e joueur peut encore rejoindre avec le code <strong>${escape(session.code)}</strong>.</p>` : '';
  const inviteButton = session.direct && session.host && count < 3 && invite ? '<button class="debate-option" id="debate-invite">Inviter un 3e joueur</button>' : '';
  if (!session.host) return `<div class="debate-options"><p class="debate-map-help">L’hôte choisit la carte et le format.</p>${code}</div>`;
  const { format, map } = hostOptions(config, session);
  const maps = config.balance.debate_mode.maps;
  const formats = count === 3 ? [['1v1v1', '1 contre 1 contre 1']] : [['1v1', '1 contre 1'], ['1v1v1', '1 contre 1 contre 1 (+ IA)']];
  return `<div class="debate-options">
    <fieldset><legend>Format</legend>${formats.map(([id, name]) => `<button class="debate-option" data-format="${id}" aria-pressed="${id === format}">${name}</button>`).join('')}</fieldset>
    <fieldset><legend>Carte</legend>${Object.entries(maps).map(([id, m]) => `<button class="debate-option" data-map="${id}" aria-pressed="${id === map}" title="${escape(m.description || '')}">${escape(m.name)}</button>`).join('')}</fieldset>
    ${inviteButton}${code}
  </div>`;
}

function playerContent(config, profile, session, player) {
  const mine = player.id === session.id;
  const candidate = CANDIDATES.find(c => c.id === player.faction);
  const style = candidate && campaignStyles(config, player.faction).find(s => s.id === player.style);
  const color = candidate ? config.prototype.presentation.factions[player.faction].color : '#85c5f8';
  const badge = `J${player.slot}${mine ? ' · Vous' : ''}`;
  if (!mine) {
    return `<article class="debate-slot" style="--slot-color:${color}"><header><span class="debate-slot-badge">${badge}</span><strong>${candidate ? escape(candidate.short) : 'Choisit…'}</strong></header>
      ${candidate ? `<img src="${portrait(candidate)}" alt="${escape(candidate.name)}">` : '<span></span>'}
      <p class="debate-ultimate">${style ? `Style : <strong>${escape(styleName(style))}</strong>` : 'En train de choisir son combattant.'}</p></article>`;
  }
  const taken = (faction, styleId) => session.room.players.some(p => p.id !== player.id && p.faction === faction && p.style === styleId);
  const styles = candidate ? campaignStyles(config, player.faction).map(s => {
    const locked = !debateStyleAvailable(config, profile, player.faction, s.id), used = taken(player.faction, s.id);
    const title = locked ? 'À débloquer en campagne' : used ? 'Déjà choisi par un autre joueur' : `Ultime : ${s.ultimate.name}`;
    return `<button class="debate-style" data-style="${s.id}" aria-pressed="${s.id === player.style}" ${locked || used || session.choosing ? 'disabled' : ''} title="${escape(title)}" style="--style-color:${s.skin.accent}">${locked ? '<span aria-hidden="true">🔒</span>' : ''}${escape(styleName(s))}</button>`;
  }).join('') : '';
  return `<article class="debate-slot" style="--slot-color:${color}"><header><span class="debate-slot-badge">${badge}</span><strong>${candidate ? escape(candidate.short) : 'Votre candidat'}</strong></header>
    ${candidate ? `<img src="${portrait(candidate)}" alt="${escape(candidate.name)}">` : '<span></span>'}
    <div class="debate-slot-choices">
      <p class="debate-label">Candidat</p>
      <div class="debate-candidates" role="group" aria-label="Candidat">${CANDIDATES.map(c => `<button class="debate-candidate" data-faction="${c.id}" aria-pressed="${c.id === player.faction}" ${session.choosing ? 'disabled' : ''}>${escape(c.short)}</button>`).join('')}</div>
      ${candidate ? `<p class="debate-label">Style</p><div class="debate-styles" role="group" aria-label="Style">${styles}</div>` : ''}
      <p class="debate-ultimate">${style ? `Ultime : <strong>${escape(style.ultimate.name)}</strong><br><small>${escape(style.summary)}</small>` : 'Choisissez un candidat, puis un style.'}</p>
    </div></article>`;
}

function statusText(session) {
  if (session.selectionError) return session.selectionError;
  const me = session.room.players.find(p => p.id === session.id);
  if (!me?.style) return 'Choisissez votre candidat et votre style.';
  if (!candidatesReady(session.room)) return 'En attente du choix des autres joueurs…';
  return session.host ? 'Tout le monde est prêt. Lancez le combat !' : 'En attente du lancement par l’hôte…';
}

/** Salon du débat : dès deux joueurs connectés. */
export function showDebateLobby(menu, session, leave, invite = null) {
  const { config } = menu.debateMode;
  const profile = menu.account?.get() || {};
  menu.page('debate-lobby', 'Débat entre amis', '<div class="debate-setup" id="debate-lobby"></div>', leave);
  const root = menu.element.querySelector('#debate-lobby');
  const choose = async (faction, style) => {
    if (session.choosing || !style) return;
    session.choosing = true; session.selectionError = ''; render();
    try { await session.request('choose', { faction, style }); }
    catch (error) { session.selectionError = error.message; }
    finally { session.choosing = false; if (menu.screen === 'debate-lobby') render(); }
  };
  // Premier style disponible pour ce candidat : débloqué et pas déjà pris par un autre joueur.
  const freeStyle = (faction, preferred) => {
    const usable = campaignStyles(config, faction).filter(s => debateStyleAvailable(config, profile, faction, s.id)
      && !session.room.players.some(p => p.id !== session.id && p.faction === faction && p.style === s.id));
    return usable.find(s => s.id === preferred)?.id ?? usable[0]?.id ?? null;
  };
  function render() {
    const active = document.activeElement;
    const focus = root.contains(active) ? ['data-format', 'data-map', 'data-faction', 'data-style', 'id'].map(a => active.getAttribute(a) && `[${a}="${active.getAttribute(a)}"]`).find(Boolean) : null;
    const players = [...session.room.players].sort((a, b) => a.slot - b.slot);
    root.innerHTML = `${optionsContent(config, session, invite)}
      <div class="debate-slots" data-count="${players.length}">${players.map(p => playerContent(config, profile, session, p)).join('')}</div>
      <footer class="menu-footer"><p class="menu-note" id="room-message" role="status"></p>${session.host ? `<button id="debate-fight" class="menu-primary arcade-button" ${candidatesReady(session.room) ? '' : 'disabled'}>Combattre <span aria-hidden="true">➜</span></button>` : ''}</footer>`;
    root.querySelector('#room-message').textContent = statusText(session);
    root.querySelectorAll('[data-format]').forEach(b => b.onclick = () => { hostOptions(config, session).format = b.dataset.format; render(); });
    root.querySelectorAll('[data-map]').forEach(b => b.onclick = () => { hostOptions(config, session).map = b.dataset.map; render(); });
    root.querySelectorAll('[data-faction]').forEach(b => b.onclick = () => {
      const me = session.room.players.find(p => p.id === session.id);
      const style = freeStyle(b.dataset.faction, me?.faction === b.dataset.faction ? me.style : null);
      if (!style) { session.selectionError = 'Aucun style libre pour ce candidat.'; render(); return; }
      void choose(b.dataset.faction, style);
    });
    root.querySelectorAll('[data-style]').forEach(b => b.onclick = () => {
      void choose(session.room.players.find(p => p.id === session.id).faction, b.dataset.style);
    });
    const inviteButton = root.querySelector('#debate-invite');
    if (inviteButton) inviteButton.onclick = invite;
    const fight = root.querySelector('#debate-fight');
    if (fight) fight.onclick = () => {
      const setup = multiplayerDebateSetup(config, session.room, hostOptions(config, session));
      const error = debateSetupError(config, setup);
      if (error) { session.selectionError = error; render(); return; }
      fight.disabled = true;
      session.request('start', { setup }).catch(err => { session.selectionError = err.message; if (menu.screen === 'debate-lobby') render(); });
    };
    if (focus) root.querySelector(focus)?.focus({ preventScroll: true });
  }
  menu.debateLobbyUpdate = render;
  menu.cleanup = () => { menu.debateLobbyUpdate = null; };
  render();
}

export function updateDebateLobby(menu) {
  menu.debateLobbyUpdate?.();
}
