import { visualManifest } from './visual-manifest.js';

export const CANDIDATES = [
  { id: 'melenchon', name: 'Jean-Luc Mélenchon', short: 'Mélenchon', description: 'Rassemblez vos soutiens.' },
  { id: 'philippe', name: 'Édouard Philippe', short: 'Philippe', description: 'Développez votre implantation.' },
  { id: 'le_pen', name: 'Marine Le Pen', short: 'Le Pen', description: 'Mobilisez votre camp.' },
];
export const portrait = candidate => visualManifest[`character-${candidate.id}`].file;

export function homeContent() {
  return `<div class="menu-home"><h1 class="visually-hidden" tabindex="-1">Présidentielles 2027</h1><div class="mode-grid"><button class="mode-card arcade-button" id="campaign"><span aria-hidden="true">★</span><strong>Campagne</strong><span aria-hidden="true">★</span></button><button class="mode-card arcade-button" id="debate"><span aria-hidden="true">⚔</span><strong>Débat télé</strong><span aria-hidden="true">⚔</span></button></div></div>`;
}
/** Deuxième écran : le même choix « Avec qui ? » pour la campagne et le débat. */
export function playersContent(mode) {
  const friends = mode === 'debate' ? '2 ou 3 appareils' : '3 appareils';
  return `<div class="menu-home"><h1 class="visually-hidden" tabindex="-1">${mode === 'debate' ? 'Débat télé' : 'Campagne'} : avec qui jouer ?</h1><p class="players-mode" data-mode="${mode}" aria-hidden="true">${mode === 'debate' ? '⚔ Débat télé' : '★ Campagne'}</p><div class="mode-grid"><button class="mode-card arcade-button" id="solo"><span aria-hidden="true">★</span><strong>Solo<small>Contre l’IA</small></strong><span aria-hidden="true">★</span></button><button class="mode-card arcade-button" id="multiplayer"><span aria-hidden="true">♟</span><strong>Entre amis<small>${friends} · même Wi-Fi</small></strong><span aria-hidden="true">♟</span></button></div></div>`;
}
export function candidatesContent(selected = null) {
  return `<div class="candidate-grid">${CANDIDATES.map(c => `<button class="candidate-card" data-candidate="${c.id}" aria-label="${c.name}" aria-pressed="${c.id === selected}"><span class="candidate-badge" aria-hidden="true">♛ J1</span><strong class="visually-hidden">${c.short}</strong></button>`).join('')}</div><footer class="menu-footer"><button id="prepare-game" class="menu-primary arcade-button" ${selected ? '' : 'disabled'}>Valider <span aria-hidden="true">➜</span></button></footer>`;
}
export function tutorialContent(candidate, combat) {
  return `<div class="loading-scene"><div class="loading-candidate"><img src="${portrait(candidate)}" alt="${candidate.name}"></div><div class="loading-guide"><h2>À vous de jouer !</h2><div class="loading-tips"><p><span aria-hidden="true">✦</span><strong>Convainquez</strong><small>En vous plaçant près des passants</small></p><p><span aria-hidden="true">⚑</span><strong>Étendez-vous</strong><small>Des soutiens dans le quartier, puis restez devant le bâtiment.</small></p><p><span aria-hidden="true">⚔</span><strong>Combattez</strong><small class="keyboard-guide">← → Marcher · ↑ Sauter · Espace Frapper</small><small class="touch-guide">Utilisez les boutons à l’écran.</small></p></div></div></div><div class="loading-strip"><div class="loading-caption"><p id="loading-status" role="status">Chargement…</p><span id="loading-percent" aria-hidden="true">0 %</span></div><progress class="menu-loading" max="1" value="0" aria-label="Chargement de la campagne"></progress></div><footer class="menu-footer"><button id="start-campaign" class="menu-primary arcade-button" disabled>Chargement…</button></footer>`;
}
