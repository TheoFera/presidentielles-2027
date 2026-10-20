import { visualManifest } from '../rendu/visual-manifest.js';

export const CANDIDATES = [
  { id: 'melenchon', name: 'Jean-Luc Mélenchon', short: 'Mélenchon', description: 'Rassemblez vos soutiens.' },
  { id: 'philippe', name: 'Édouard Philippe', short: 'Philippe', description: 'Développez votre implantation.' },
  { id: 'le_pen', name: 'Marine Le Pen', short: 'Le Pen', description: 'Mobilisez votre camp.' },
];
export const portrait = candidate => visualManifest[`character-${candidate.id}`].file;

export function homeContent() {
  return `<div class="menu-home"><h1 class="visually-hidden" tabindex="-1">Présidentielle 2027 : Le Jeu</h1><div class="mode-grid"><button class="mode-card arcade-button" id="campaign"><span aria-hidden="true">★</span><strong>Campagne</strong><span aria-hidden="true">★</span></button><button class="mode-card arcade-button" id="debate"><span aria-hidden="true">⚔</span><strong>Débat télé</strong><span aria-hidden="true">⚔</span></button></div></div>`;
}
/** Deuxième écran : le même choix « Avec qui ? » pour la campagne et le débat. */
export function playersContent(mode) {
  return `<div class="menu-home"><h1 class="visually-hidden" tabindex="-1">${mode === 'debate' ? 'Débat télé' : 'Campagne'} : avec qui jouer ?</h1><p class="players-mode" data-mode="${mode}" aria-hidden="true">${mode === 'debate' ? '⚔ Débat télé' : '★ Campagne'}</p><div class="mode-grid"><button class="mode-card arcade-button" id="solo"><span aria-hidden="true">★</span><strong>Solo</strong><span aria-hidden="true">★</span></button><button class="mode-card arcade-button" id="multiplayer"><span aria-hidden="true">♟</span><strong>Multijoueur</strong><span aria-hidden="true">♟</span></button></div></div>`;
}
export function candidatesContent(selected = null) {
  return `<div class="candidate-grid">${CANDIDATES.map(c => `<button class="candidate-card" data-candidate="${c.id}" aria-label="${c.name}" aria-pressed="${c.id === selected}"><span class="candidate-badge" aria-hidden="true">♛ J1</span><strong class="visually-hidden">${c.short}</strong></button>`).join('')}</div><footer class="menu-footer"><button id="prepare-game" class="menu-primary arcade-button" ${selected ? '' : 'disabled'}>Valider <span aria-hidden="true">➜</span></button></footer>`;
}
/** Astuces de l’écran de chargement : l’atout du candidat d’abord, puis des conseils de jeu. */
const CANDIDATE_HINTS = {
  melenchon: 'Votre atout : vous convainquez les passants plus vite que vos rivaux.',
  philippe: 'Votre atout : vous démarrez la campagne avec plus d’argent que vos rivaux.',
  le_pen: 'Votre atout : vos coups font 50 % de dégâts en plus aux sympathisants adverses.',
};
const GAME_HINTS = [
  'Pour convaincre un passant, arrêtez-vous à côté de lui : en marchant, on ne convainc personne.',
  'Votre première permanence devient votre QG : repassez-y pour récupérer les dons.',
  'Restez devant votre QG pour faire imprimer des tracts.',
  'Dans le quartier de votre style, vous convainquez 4 fois plus vite ; dans le quartier opposé, 2 fois moins.',
  'Dans vos quartiers, vos partisans résistent mieux et vos rivaux convainquent moins vite.',
  'Un bâtiment acquis reste à vous, même vide : seul un raid ou une fermeture peut vous le reprendre.',
  'Dès qu’ils sont trois, vos militants partent ensemble à la conquête de nouveaux électeurs.',
  'Achetez un garage : à vélo ou à scooter, vous traversez la France bien plus vite.',
  'Pour esquiver, appuyez deux fois vite sur une direction. Vos trois esquives se rechargent seules.',
  'Gardez la frappe enfoncée une seconde : coup chargé, et vous êtes protégé pendant sa préparation.',
  'Sautez pour éviter les coups bas, puis frappez en l’air pour retomber sur votre adversaire.',
  'Un candidat mis K.-O. perd 30 % de son argent : ramassez vite les billets tombés !',
  'Chaque coup qui touche remplit votre jauge d’ultime. Dorée, elle est prête : déclenchez-la !',
  'En tête des sondages, des journalistes vous filment : sortez du champ, la caméra vous ralentit.',
];
export const loadingHints = candidate => [CANDIDATE_HINTS[candidate.id], ...GAME_HINTS].filter(Boolean);
export function tutorialContent(candidate) {
  const card = (icon, title, text) => `<p><span aria-hidden="true">${icon}</span><strong>${title}</strong>${text}</p>`;
  return `<div class="loading-title"><p class="loading-flash"><span>J-365</span><span>Premier tour</span></p><h1 tabindex="-1">Plus qu’un an avant l’élection</h1></div>`
    + `<div class="loading-scene"><div class="loading-candidate"><div class="loading-stage"><img src="${portrait(candidate)}" alt=""></div><strong class="loading-name">${candidate.short}</strong></div>`
    + `<div class="loading-guide"><h2>À vous de jouer !</h2><div class="loading-tips">`
    + card('✦', 'Convainquez', '<small>Arrêtez-vous près d’un passant pour lui parler.</small>')
    + card('⚑', 'Étendez-vous', '<small>Restez devant un bâtiment pour l’acquérir.</small>')
    + card('⚔', 'Combattez', '<small class="keyboard-guide"><kbd>←</kbd><kbd>→</kbd> marcher · <kbd>↑</kbd> sauter · <kbd>Espace</kbd> frapper · <kbd>R</kbd> ultime</small><small class="touch-guide">Utilisez les boutons à l’écran.</small>')
    + `</div></div></div>`
    + `<div class="loading-strip"><p id="loading-status" role="status">Chargement…</p>`
    + `<div class="loading-action"><div class="loading-bar" role="progressbar" aria-label="Chargement de la campagne" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><span class="loading-fill"></span><span id="loading-percent" aria-hidden="true">0 %</span></div>`
    + `<button id="start-campaign" class="menu-primary arcade-button" disabled>Chargement…</button></div>`
    + `<p class="loading-hint"><strong>Astuce :</strong> <span id="loading-tip"></span></p></div>`;
}
