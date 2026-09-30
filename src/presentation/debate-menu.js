import { DEBATE_FORMATS, debateSetupError, debateStyleAvailable, debateStyles } from '../simulation/debate-mode.js';
import { DEBATE_CANDIDATES, escape, rosterContent, fighterCardContent, stylesContent, hydrateSelectionPortraits, bindRosterKeyboard } from './debate-selection.js';

const FORMAT_NAMES = { '1v1': 'Duel', '1v1v1': 'À trois' };
const chosenSetup = setup => ({ ...setup, fighters: setup.fighters.slice(0, DEBATE_FORMATS[setup.format]).map(f => ({ ...f })) });

export function defaultDebateSetup(config, profile, faction = 'melenchon') {
  const order = [faction, ...DEBATE_CANDIDATES.map(c => c.id).filter(id => id !== faction)].slice(0, 3);
  const fighters = order.map((f, i) => ({ faction: f, style: debateStyles(config, f).find(s => i > 0 || debateStyleAvailable(config, profile, f, s.id))?.id }));
  return { format: '1v1', map: config.balance.debate_mode.default_map, fighters };
}

function freeStyle(config, profile, setup, index, faction, preferred = null) {
  const taken = setup.fighters.filter((f, i) => i !== index && i < DEBATE_FORMATS[setup.format] && f.faction === faction).map(f => f.style);
  const usable = debateStyles(config, faction).filter(s => !taken.includes(s.id) && (index > 0 || debateStyleAvailable(config, profile, faction, s.id)));
  return usable.find(s => s.id === preferred)?.id ?? usable[0]?.id ?? null;
}

export function showDebateSetup(menu, { config, profile, setup, start, back }) {
  let active = 0;
  while (setup.fighters.length < 3) setup.fighters.push(defaultDebateSetup(config, profile).fighters[setup.fighters.length]);
  const render = focus => {
    const fighters = setup.fighters.slice(0, DEBATE_FORMATS[setup.format]);
    const error = debateSetupError(config, chosenSetup(setup), profile);
    const current = fighters[active];
    menu.page('debate', 'Débat télé', `<div class="debate-setup select-screen">
      <div class="select-topline"><span>Sélection des candidats</span><span class="select-live">● En direct</span></div>
      <div class="select-stage" data-count="${fighters.length}">${fighters.map((f, i) => fighterCardContent(config, f, i, { active: i === active, editable: true, styles: i === active ? stylesContent(config, profile, current, { ai: active > 0, taken: id => fighters.some((f, i) => i !== active && f.faction === current.faction && f.style === id) }) : '' })).join('')}<span class="select-versus" aria-hidden="true">VS</span></div>
      <div class="select-console"><div class="select-roster-heading"><strong>${active ? `IA ${active}` : 'J1 · Vous'}</strong><span>Choisissez votre candidat</span></div>
      ${rosterContent(config, fighters, active, { unavailable: faction => !freeStyle(config, profile, setup, active, faction, current.faction === faction ? current.style : null) })}</div>
      <div class="debate-options"><fieldset><legend>Format</legend>${Object.keys(DEBATE_FORMATS).map(f => `<button class="debate-option" data-format="${f}" aria-pressed="${f === setup.format}">${FORMAT_NAMES[f]}</button>`).join('')}</fieldset>
      <fieldset><legend>Plateau</legend>${Object.entries(config.balance.debate_mode.maps).map(([id, m]) => `<button class="debate-option" data-map="${id}" aria-pressed="${id === setup.map}" title="${escape(m.description || '')}">${escape(m.name)}</button>`).join('')}</fieldset></div>
      <footer class="menu-footer select-footer"><p class="menu-note" role="status">${escape(error || 'Prêts pour le direct ?')}</p><button id="debate-fight" class="menu-primary arcade-button" ${error ? 'disabled' : ''}>Combattre <span aria-hidden="true">➜</span></button></footer>
    </div>`, back);
    const root = menu.element;
    hydrateSelectionPortraits(root); bindRosterKeyboard(root);
    root.querySelectorAll('[data-slot]').forEach(b => b.onclick = () => { active = Number(b.dataset.slot); render(`[data-slot="${active}"]`); });
    root.querySelectorAll('[data-format]').forEach(b => b.onclick = () => {
      const previousCount = DEBATE_FORMATS[setup.format];
      setup.format = b.dataset.format; active = Math.min(active, DEBATE_FORMATS[setup.format] - 1);
      if (DEBATE_FORMATS[setup.format] > previousCount) {
        const index = previousCount, saved = setup.fighters[index];
        const faction = freeStyle(config, profile, setup, index, saved.faction, saved.style) ? saved.faction
          : DEBATE_CANDIDATES.find(c => freeStyle(config, profile, setup, index, c.id))?.id;
        setup.fighters[index] = { faction, style: freeStyle(config, profile, setup, index, faction, saved.style) };
      }
      for (let i = 0; i < DEBATE_FORMATS[setup.format]; i++) setup.fighters[i].style = freeStyle(config, profile, setup, i, setup.fighters[i].faction, setup.fighters[i].style);
      render(`[data-format="${b.dataset.format}"]`);
    });
    root.querySelectorAll('[data-map]').forEach(b => b.onclick = () => { setup.map = b.dataset.map; render(`[data-map="${b.dataset.map}"]`); });
    root.querySelectorAll('[data-faction]').forEach(b => b.onclick = () => {
      const style = freeStyle(config, profile, setup, active, b.dataset.faction, current.faction === b.dataset.faction ? current.style : null);
      if (!style) return;
      setup.fighters[active] = { faction: b.dataset.faction, style };
      render(`[data-faction="${b.dataset.faction}"]`);
    });
    root.querySelectorAll('[data-style]').forEach(b => b.onclick = () => { setup.fighters[active].style = b.dataset.style; render(`[data-style="${b.dataset.style}"]`); });
    root.querySelector('#debate-fight').onclick = () => { if (!debateSetupError(config, chosenSetup(setup), profile)) start(chosenSetup(setup)); };
    if (focus) root.querySelector(focus)?.focus({ preventScroll: true });
  };
  render();
}
