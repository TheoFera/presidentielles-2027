// Pause : toucher la carte (ou Échap, P) met le jeu en pause. La carte s'ouvre en grand, comme au début
// du tutoriel, avec à gauche le post-it des objectifs et leurs explications ; une fois le tutoriel
// terminé, un mémo des habitants et des bâtiments prend sa place.
// En multijoueur, la pause vaut pour tout le monde, et seul le joueur qui l'a lancée peut la lever.
import { BIOME_NAMES } from './campaign-intro.js';
import { placeDossier } from './dossier-layout.js';

// Mémo de la pause : les mêmes explications que celles des objectifs, rangées par sujet.
const MEMO = [
  ['Les habitants', [
    ['Neutre', 'Ne soutient personne. Arrêtez-vous à côté de lui pour le convaincre.'],
    ['Sympathisant', 'Une voix pour son candidat le jour du vote. Il dépose des dons au QG. Mis K.-O., il redevient neutre.'],
    ['Militant', 'Un sympathisant qui a pris un tract à la permanence : il convainc les habitants et se bat tout seul.'],
    ['Service d’ordre', 'Les gros bras d’un local : ils gardent les zones voisines, ou partent en raid fermer les bâtiments adverses.'],
  ]],
  ['Les bâtiments', [
    ['Permanence', 'La première est votre QG : dons à ramasser, tracts pour recruter des militants. Chaque permanence contrôle sa zone.'],
    ['Local du camp', 'Service d’ordre et raids pour Mélenchon et Le Pen ; cabinet administratif pour Philippe, qui paie pour fermer un bâtiment adverse.'],
    ['Institut de sondage', 'Payez pour voir les intentions de vote : l’anneau de la carte montre qui mène et qui tient chaque zone.'],
    ['Estrade de meeting', 'Payez et restez jusqu’au bout : les neutres de la zone vous rejoignent.'],
    ['Garage', 'Restez devant pour partir à vélo ou en scooter, bien plus vite qu’à pied.'],
  ]],
  ['L’argent', [
    ['Billets', 'Ramassez-les par terre et au QG. Un candidat mis K.-O. lâche une partie des siens.'],
  ]],
];
// Un appui qui ouvre la pause ne doit pas la refermer aussitôt (second doigt, rebond).
const REOPEN_GUARD_MS = 300;

export class MapPause {
  /**
   * `objectives` : le post-it (campaign-objectives.js) ; `wheel()` : la roue de la carte ;
   * `request(paused)` : demande la pause ou sa fin (solo : tout de suite ; multijoueur : au salon).
   */
  constructor(game, { objectives, wheel = () => null, request = () => {} } = {}) {
    this.game = game; this.objectives = objectives; this.wheel = wheel; this.request = request;
    this.root = document.createElement('div'); this.root.id = 'map-pause'; this.root.hidden = true;
    this.root.innerHTML = '<div class="pause-veil"></div><p class="pause-title" role="status"><span class="pause-icon" aria-hidden="true"></span>Pause</p>'
      + '<aside class="pause-memo" aria-label="Mémo" hidden></aside><p class="pause-prompt"></p>';
    this.memo = this.root.querySelector('.pause-memo'); this.prompt = this.root.querySelector('.pause-prompt');
    this.memo.innerHTML = '<h2>Mémo</h2>' + MEMO.map(([title, items]) => `<section><h3>${title}</h3><dl>${items.map(([name, text]) => `<dt>${name}</dt><dd>${text}</dd>`).join('')}</dl></section>`).join('');
    game.append(this.root);
    this.open = false; this.mine = false; this.openedAt = 0;
    // Pendant la pause, tout appui sur l'écran est pour elle (et ne fait pas marcher le candidat).
    game.addEventListener('pointerdown', event => {
      // Le mémo se fait défiler du doigt sans lever la pause.
      if (!this.open || this.memo.contains(event.target)) return;
      event.preventDefault(); event.stopPropagation();
      if (performance.now() - this.openedAt > REOPEN_GUARD_MS) this.resumeRequested();
    }, true);
    // La carte est un bouton pendant la partie (voir `armed`).
    this.map = game.querySelector('#electoral-display');
    this.map?.addEventListener('pointerdown', event => {
      if (this.open || !this.game.classList.contains('map-pausable')) return;
      event.preventDefault(); event.stopPropagation();
      this.request(true);
    });
  }

  /** La carte accepte-t-elle d'ouvrir la pause (partie en cours, rien d'autre à l'écran) ? */
  arm(on) { if (this.game.classList.contains('map-pausable') !== on) this.game.classList.toggle('map-pausable', on); }

  /** Touche du clavier : Échap ou P ouvrent ; pendant la pause, Échap, P, Espace ou Entrée la lèvent. Rend vrai si la touche est prise. */
  key(key, allowed) {
    if (this.open) { if (['escape', 'p', ' ', 'enter', 'attack-press'].includes(key)) this.resumeRequested(); return true; }
    if (allowed && ['escape', 'p'].includes(key)) { this.request(true); return true; }
    return false;
  }

  resumeRequested() { if (this.open && this.mine) this.request(false); }

  /** Affiche la pause. `mine` : ce joueur l'a lancée (lui seul la lève) ; sinon `by` nomme celui qui l'a lancée. */
  show({ mine = true, by = '' } = {}) {
    this.mine = mine;
    const touch = matchMedia('(any-pointer: coarse)').matches;
    this.prompt.textContent = mine ? (touch ? 'Touchez l’écran pour reprendre' : 'Cliquez ou appuyez sur Échap pour reprendre')
      : `Pause demandée par ${by || 'un autre joueur'}`;
    if (this.open) return;
    this.open = true; this.openedAt = performance.now();
    clearTimeout(this.closing); this.game.classList.remove('map-pause-closing');
    const postit = !!this.objectives?.active && this.objectives.visible;
    this.memo.hidden = postit;
    this.root.hidden = false;
    if (postit) this.objectives.setExplain(true);
    this.namesShown = this.wheel()?.showBiomeNames(BIOME_NAMES) === true;
    // Mesure après l'ajout des explications (la page est mise en place à la lecture des tailles).
    placeDossier(this.game, { objectives: postit });
    this.game.classList.add('map-pause');
  }

  /** Fin de la pause : la carte et le post-it regagnent leur place, puis les explications se replient. */
  hide() {
    if (!this.open) return;
    this.open = false; this.root.hidden = true;
    this.game.classList.remove('map-pause'); this.game.classList.add('map-pause-closing');
    clearTimeout(this.closing);
    this.closing = setTimeout(() => {
      this.game.classList.remove('map-pause-closing');
      if (!this.game.classList.contains('intro-dossier')) this.objectives?.setExplain(false);
      if (this.namesShown && !this.game.classList.contains('intro-dossier')) this.wheel()?.hideBiomeNames();
      this.namesShown = false;
    }, 650);
  }

  /** Nouvelle partie, retour au menu : plus de pause. */
  reset() { this.hide(); this.arm(false); }
}
