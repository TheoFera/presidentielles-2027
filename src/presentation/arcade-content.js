import { visualManifest } from './visual-manifest.js';

export const CANDIDATES = [
  { id: 'melenchon', name: 'Jean-Luc Mélenchon', short: 'Mélenchon', description: 'Rassemblez vos soutiens.' },
  { id: 'le_pen', name: 'Marine Le Pen', short: 'Le Pen', description: 'Mobilisez votre camp.' },
  { id: 'philippe', name: 'Édouard Philippe', short: 'Philippe', description: 'Développez votre implantation.' },
];
export const portrait = candidate => visualManifest[`character-${candidate.id}`].file;

export function homeContent() {
  return `<div class="menu-home"><h1 class="visually-hidden" tabindex="-1">Présidentielles 2027</h1><div class="mode-grid"><button class="mode-card arcade-button" id="solo"><span aria-hidden="true">★</span><strong>Solo</strong><span aria-hidden="true">★</span></button><button class="mode-card arcade-button" id="multiplayer"><span aria-hidden="true">♟</span><strong>Multijoueur</strong><span aria-hidden="true">♟</span></button></div></div>`;
}
export function candidatesContent(selected) {
  return `<div class="candidate-grid">${CANDIDATES.map(c => `<button class="candidate-card" data-candidate="${c.id}" aria-label="${c.name}" aria-pressed="${c.id === selected}"><span class="candidate-badge" aria-hidden="true">♛ J1</span><strong class="visually-hidden">${c.short}</strong></button>`).join('')}</div><footer class="menu-footer"><button id="prepare-game" class="menu-primary arcade-button">Valider <span aria-hidden="true">➜</span></button></footer>`;
}
export function tutorialContent(candidate, combat) {
  return `<div class="loading-scene"><div class="loading-candidate"><img src="${portrait(candidate)}" alt="${candidate.name}"><span class="eyebrow">SOLO · ${candidate.short}</span></div><div class="loading-guide"><h2>À vous de jouer !</h2><div class="loading-tips"><p><span aria-hidden="true">✦</span><strong>Convainquez</strong><small>Arrêtez-vous près des passants.</small></p><p><span aria-hidden="true">⚑</span><strong>Construisez</strong><small>Restez devant les bâtiments.</small></p><p><span aria-hidden="true">⚔</span><strong>Combattez</strong><small class="keyboard-guide">← → Marcher · ↑ Sauter · Espace Frapper</small><small class="touch-guide">Utilisez les boutons à l’écran.</small></p></div><p class="landscape-reminder"><span aria-hidden="true">▱ ↻</span> Sur téléphone, jouez en paysage.</p></div></div><div class="loading-strip"><div class="loading-caption"><p id="loading-status" role="status">Chargement…</p><span id="loading-percent" aria-hidden="true">0 %</span></div><progress class="menu-loading" max="1" value="0" aria-label="Chargement de la campagne"></progress></div><footer class="menu-footer"><span class="menu-note">L’aide reste accessible dans Pause.</span><button id="start-campaign" class="menu-primary arcade-button" disabled>Chargement…</button></footer>`;
}
