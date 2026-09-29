import { CANDIDATES, portrait } from './arcade-content.js';
import { campaignStyles } from '../simulation/campaign-styles.js';
import { ARENA_FORMATS, arenaSetupError, arenaStyleAvailable, isBetatestProfile } from '../simulation/arena-mode.js';

const escape = text => String(text).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const FORMAT_NAMES = { '1v1': '1 contre 1', '1v1v1': '1 contre 1 contre 1' };
/** Les réglages gardent 3 combattants ; seuls les premiers entrent dans l’arène. */
const chosenSetup = setup => ({ ...setup, fighters: setup.fighters.slice(0, ARENA_FORMATS[setup.format]).map(f => ({ ...f })) });

/** Préparation par défaut : le joueur, puis les autres candidats contrôlés par l’IA. */
export function defaultArenaSetup(config, profile, faction = 'melenchon') {
  const order = [faction, ...CANDIDATES.map(c => c.id).filter(id => id !== faction)];
  const fighters = order.map((f, i) => ({ faction: f, style: campaignStyles(config, f).find(s => i > 0 || arenaStyleAvailable(config, profile, f, s.id))?.id }));
  return { format: '1v1', map: config.balance.arena_mode.default_map, fighters };
}

/** Choisit un style libre pour ce combattant (pas deux fois le même candidat avec le même style). */
function freeStyle(config, profile, setup, index, faction, preferred = null) {
  const taken = setup.fighters.filter((f, i) => i !== index && i < ARENA_FORMATS[setup.format] && f.faction === faction).map(f => f.style);
  const usable = campaignStyles(config, faction).filter(s => !taken.includes(s.id) && (index > 0 || arenaStyleAvailable(config, profile, faction, s.id)));
  return usable.find(s => s.id === preferred)?.id ?? usable[0]?.id ?? null;
}

function slotContent(config, profile, setup, index) {
  const fighter = setup.fighters[index];
  const candidate = CANDIDATES.find(c => c.id === fighter.faction);
  const taken = setup.fighters.filter((f, i) => i !== index && i < ARENA_FORMATS[setup.format] && f.faction === fighter.faction).map(f => f.style);
  const styles = campaignStyles(config, fighter.faction).map(s => {
    const locked = index === 0 && !arenaStyleAvailable(config, profile, fighter.faction, s.id);
    const used = taken.includes(s.id);
    const title = locked ? 'À débloquer en campagne' : used ? 'Déjà choisi pour ce candidat' : `Ultime : ${s.ultimate.name}`;
    return `<button class="arena-style" data-slot="${index}" data-style="${s.id}" aria-pressed="${s.id === fighter.style}" ${locked || used ? 'disabled' : ''} title="${escape(title)}" style="--style-color:${s.skin.accent}">${locked ? '<span aria-hidden="true">🔒</span>' : ''}${escape(s.name.split(' · ')[0])}</button>`;
  }).join('');
  const style = campaignStyles(config, fighter.faction).find(s => s.id === fighter.style);
  return `<article class="arena-slot" data-slot="${index}" style="--slot-color:${config.prototype.presentation.factions[fighter.faction].color}">
    <header><span class="arena-slot-badge">${index === 0 ? 'Vous' : `IA ${index}`}</span><strong>${escape(candidate.short)}</strong></header>
    <img src="${portrait(candidate)}" alt="${escape(candidate.name)}">
    <div class="arena-slot-choices">
      <p class="arena-label">Candidat</p>
      <div class="arena-candidates" role="group" aria-label="Candidat">${CANDIDATES.map(c => `<button class="arena-candidate" data-slot="${index}" data-faction="${c.id}" aria-pressed="${c.id === fighter.faction}">${escape(c.short)}</button>`).join('')}</div>
      <p class="arena-label">Style</p>
      <div class="arena-styles" role="group" aria-label="Style">${styles}</div>
      <p class="arena-ultimate">${style ? `Ultime : <strong>${escape(style.ultimate.name)}</strong><br><small>${escape(style.summary)}</small>` : 'Aucun style disponible'}</p>
    </div>
  </article>`;
}

function setupContent(config, profile, setup) {
  const maps = config.balance.arena_mode.maps;
  const count = ARENA_FORMATS[setup.format];
  const error = arenaSetupError(config, chosenSetup(setup), profile);
  return `<div class="arena-setup">
    <div class="arena-options">
      <fieldset><legend>Format</legend>${Object.keys(ARENA_FORMATS).map(f => `<button class="arena-option" data-format="${f}" aria-pressed="${f === setup.format}">${FORMAT_NAMES[f]}</button>`).join('')}</fieldset>
      <fieldset><legend>Carte</legend>${Object.entries(maps).map(([id, map]) => `<button class="arena-option" data-map="${id}" aria-pressed="${id === setup.map}" title="${escape(map.description || '')}">${escape(map.name)}</button>`).join('')}</fieldset>
      <p class="arena-map-help">${escape(maps[setup.map].description || '')}</p>
    </div>
    <div class="arena-slots" data-count="${count}">${Array.from({ length: count }, (_, i) => slotContent(config, profile, setup, i)).join('')}</div>
    <footer class="menu-footer"><p class="menu-note" id="arena-setup-note" role="status">${escape(error || (isBetatestProfile(profile) ? 'Profil betatest : tous les styles sont débloqués.' : 'Dernier debout gagne. Même candidat possible avec un autre style.'))}</p><button id="arena-fight" class="menu-primary arcade-button" ${error ? 'disabled' : ''}>Combattre <span aria-hidden="true">➜</span></button></footer>
  </div>`;
}

/** Écran de préparation du mode Arène, dans le menu d’accueil. */
export function showArenaSetup(menu, { config, profile, setup, start }) {
  const current = setup;
  const render = focus => {
    menu.page('arena', 'Arène', setupContent(config, profile, current));
    const root = menu.element;
    root.querySelectorAll('[data-format]').forEach(b => b.onclick = () => {
      current.format = b.dataset.format;
      for (let i = 0; i < ARENA_FORMATS[current.format]; i++) current.fighters[i].style = freeStyle(config, profile, current, i, current.fighters[i].faction, current.fighters[i].style);
      render(`[data-format="${b.dataset.format}"]`);
    });
    root.querySelectorAll('[data-map]').forEach(b => b.onclick = () => { current.map = b.dataset.map; render(`[data-map="${b.dataset.map}"]`); });
    root.querySelectorAll('[data-faction]').forEach(b => b.onclick = () => {
      const index = Number(b.dataset.slot);
      current.fighters[index] = { faction: b.dataset.faction, style: null };
      current.fighters[index].style = freeStyle(config, profile, current, index, b.dataset.faction);
      render(`[data-slot="${index}"][data-faction="${b.dataset.faction}"]`);
    });
    root.querySelectorAll('[data-style]').forEach(b => b.onclick = () => {
      current.fighters[Number(b.dataset.slot)].style = b.dataset.style;
      render(`[data-style="${b.dataset.style}"][data-slot="${b.dataset.slot}"]`);
    });
    root.querySelector('#arena-fight').onclick = () => {
      if (arenaSetupError(config, chosenSetup(current), profile)) return;
      start(chosenSetup(current));
    };
    if (focus) root.querySelector(focus)?.focus({ preventScroll: true });
  };
  render();
}
