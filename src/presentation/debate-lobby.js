import { debateSetupError, debateStyleAvailable, debateStyles, multiplayerDebateSetup } from '../simulation/debate-mode.js';
import { candidatesReady } from '../network/lobby.js';
import { escape, rosterContent, fighterCardContent, stylesContent, hydrateSelectionPortraits, bindRosterKeyboard } from './debate-selection.js';

function hostOptions(config, session) {
  const options = session.debateOptions ||= { format: '1v1', map: config.balance.debate_mode.default_map };
  if (session.room.players.length === 3) options.format = '1v1v1';
  return options;
}
function optionsContent(config, session, invite) {
  const count = session.room.players.length;
  const code = !session.direct && count < 3 ? `<span class="debate-map-help">Code : <strong>${escape(session.code)}</strong></span>` : '';
  const inviteButton = session.direct && session.host && count < 3 && invite ? '<button class="debate-option" id="debate-invite">Inviter J3</button>' : '';
  if (!session.host) return `<div class="debate-options"><span class="menu-note">Plateau choisi par l’hôte</span>${code}</div>`;
  const { format, map } = hostOptions(config, session);
  const formats = count === 3 ? [['1v1v1', 'À trois']] : [['1v1', 'Duel'], ['1v1v1', 'À trois · + IA']];
  return `<div class="debate-options"><fieldset><legend>Format</legend>${formats.map(([id, name]) => `<button class="debate-option" data-format="${id}" aria-pressed="${id === format}">${name}</button>`).join('')}</fieldset>
    <fieldset><legend>Plateau</legend>${Object.entries(config.balance.debate_mode.maps).map(([id, m]) => `<button class="debate-option" data-map="${id}" aria-pressed="${id === map}" title="${escape(m.description || '')}">${escape(m.name)}</button>`).join('')}</fieldset>${inviteButton}${code}</div>`;
}
function statusText(session) {
  if (session.selectionError) return session.selectionError;
  const me = session.room.players.find(p => p.id === session.id);
  if (!me?.style) return 'À vous de choisir';
  if (!candidatesReady(session.room)) return 'En attente des autres joueurs…';
  return session.host ? 'Prêts pour le direct !' : 'En attente du lancement…';
}
export function showDebateLobby(menu, session, leave, invite = null) {
  const { config } = menu.debateMode;
  const profile = menu.account?.get() || {};
  menu.page('debate-lobby', 'Débat télé', '<div class="debate-setup select-screen" id="debate-lobby"></div>', leave);
  const root = menu.element.querySelector('#debate-lobby');
  const freeStyle = (faction, preferred) => {
    const usable = debateStyles(config, faction).filter(s => debateStyleAvailable(config, profile, faction, s.id)
      && !session.room.players.some(p => p.id !== session.id && p.faction === faction && p.style === s.id));
    return usable.find(s => s.id === preferred)?.id ?? usable[0]?.id ?? null;
  };
  const choose = async (faction, style) => {
    if (session.choosing || !style) return;
    session.choosing = true; session.selectionError = ''; render();
    try { await session.request('choose', { faction, style }); }
    catch (error) { session.selectionError = error.message; }
    finally { session.choosing = false; if (menu.screen === 'debate-lobby') render(); }
  };
  function render() {
    const element = document.activeElement;
    const focus = root.contains(element) ? ['data-format', 'data-map', 'data-faction', 'data-style', 'id'].map(a => element.getAttribute(a) && `[${a}="${element.getAttribute(a)}"]`).find(Boolean) : null;
    const players = [...session.room.players].sort((a, b) => a.slot - b.slot);
    const active = players.findIndex(p => p.id === session.id), me = players[active];
    const fighters = players.map(p => ({ ...p, badge: `J${p.slot}${p.id === session.id ? ' · Vous' : ''}` }));
    if (session.host && hostOptions(config, session).format === '1v1v1' && players.length === 2 && candidatesReady(session.room)) {
      fighters.push({ ...multiplayerDebateSetup(config, session.room, hostOptions(config, session)).fighters[2], badge: 'IA' });
    }
    root.innerHTML = `<div class="select-topline"><span>Sélection des candidats · Entre amis</span><span class="select-live">● En direct</span></div>
      <div class="select-stage" data-count="${fighters.length}">${fighters.map((p, i) => fighterCardContent(config, p, i, { active: p.id === session.id })).join('')}<span class="select-versus" aria-hidden="true">VS</span></div>
      <div class="select-console"><div class="select-roster-heading"><strong>J${me.slot} · Vous</strong><span>Choisissez votre candidat</span></div>
      ${rosterContent(config, fighters, active, { disabled: session.choosing, unavailable: faction => !freeStyle(faction, me?.faction === faction ? me.style : null) })}
      ${stylesContent(config, profile, me, { disabled: session.choosing, taken: style => players.some(p => p.id !== session.id && p.faction === me.faction && p.style === style) })}</div>
      ${optionsContent(config, session, invite)}<footer class="menu-footer select-footer"><p class="menu-note" id="room-message" role="status"></p>${session.host ? `<button id="debate-fight" class="menu-primary arcade-button" ${candidatesReady(session.room) ? '' : 'disabled'}>Combattre <span aria-hidden="true">➜</span></button>` : ''}</footer>`;
    root.querySelector('#room-message').textContent = statusText(session);
    hydrateSelectionPortraits(root); bindRosterKeyboard(root);
    root.querySelectorAll('[data-format]').forEach(b => b.onclick = () => { hostOptions(config, session).format = b.dataset.format; render(); });
    root.querySelectorAll('[data-map]').forEach(b => b.onclick = () => { hostOptions(config, session).map = b.dataset.map; render(); });
    root.querySelectorAll('[data-faction]').forEach(b => b.onclick = () => void choose(b.dataset.faction, freeStyle(b.dataset.faction, me?.faction === b.dataset.faction ? me.style : null)));
    root.querySelectorAll('[data-style]').forEach(b => b.onclick = () => void choose(me.faction, b.dataset.style));
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
export function updateDebateLobby(menu) { menu.debateLobbyUpdate?.(); }
