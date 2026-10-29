// Pause : toucher la carte (ou Échap, P) met le jeu en pause. La carte s'ouvre en grand, comme au début
// du tutoriel, avec à gauche le post-it des objectifs et leurs explications ; une fois le tutoriel
// terminé, un mémo des habitants et des bâtiments (deux post-its) prend sa place.
// En multijoueur, la pause vaut pour tout le monde, et seul le joueur qui l'a lancée peut la lever.
import { BIOME_NAMES } from './campaign-intro.js';
import { placeDossier } from './dossier-layout.js';

// Mémo de la pause : deux post-its, les habitants et les bâtiments ; un onglet passe de l'un à l'autre.
const MEMO = [
  ['Les habitants', [
    ['Neutre', 'Ne soutient personne et votera blanc ou s’abstiendra. Arrêtez-vous à côté de lui pour le convaincre.'],
    ['Sympathisant', 'Il vaut une voix pour son candidat le jour du vote. Il dépose régulièrement des dons à la permanence de sa zone, ou les donne à son candidat quand il le voit. Mis K.-O., il redevient neutre.'],
    ['Militant', 'Un sympathisant qui a récupéré un tract imprimé à sa permanence : il convainc les habitants neutres de son quartier. Il peut aussi former un groupe de 3 et partir convertir ou attaquer d’autres quartiers.'],
    ['Service d’ordre', 'Défensifs, ils gardent les zones voisines.'],
    ['Raideurs', 'Quand un raid est déclenché, certains sympathisants deviennent raideurs. Un groupe de raideurs envoyé dans une direction peut faire fermer un bâtiment adverse.'],
  ]],
  ['Les bâtiments', [
    ['Permanence', 'Les sympathisants viennent y apporter leurs dons et constituent une cagnotte que vous pouvez venir collecter. C’est aussi le lieu où l’on imprime des tracts pour recruter des militants. Chaque permanence contrôle son quartier : vos partisans y sont plus résistants et les tentatives de conversion adverses y sont plus longues.'],
    ['Local du service d’ordre ou cabinet', 'Il renforce la défense de son territoire : utile pour tenir le quartier et fermer les bâtiments adverses.'],
    ['Institut de sondage', 'Payez pour voir les intentions de vote : la carte est mise à jour pour vous montrer qui mène et qui tient chaque quartier.'],
    ['Estrade de meeting', 'Payez pour lancer un meeting et restez jusqu’au bout pour le finaliser : les neutres du quartier vous rejoignent et les adversaires redeviennent neutres.'],
    ['Garage', 'Une fois acheté, ses véhicules sont utilisables sans limite. Restez devant pour partir à vélo ou en scooter : vous irez bien plus vite qu’à pied.'],
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
    this.memo.innerHTML = `<div class="memo-tabs" role="tablist">${MEMO.map(([title], i) => `<button type="button" role="tab" data-memo="${i}">${title}</button>`).join('')}</div>`
      + MEMO.map(([title, items], i) => `<section class="postit memo-note memo-note-${i}" role="tabpanel"><h2>${title}</h2><dl>${items.map(([name, text]) => `<dt>${name}</dt><dd>${text}</dd>`).join('')}</dl></section>`).join('');
    this.memo.addEventListener('click', event => { const tab = event.target.closest('[data-memo]'); if (tab) this.showMemo(Number(tab.dataset.memo)); });
    this.showMemo(0);
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

  /** Post-it du mémo affiché (0 : habitants, 1 : bâtiments). */
  showMemo(index) {
    this.memo.querySelectorAll('[data-memo]').forEach(tab => tab.setAttribute('aria-selected', String(Number(tab.dataset.memo) === index)));
    this.memo.querySelectorAll('.memo-note').forEach((note, i) => { note.hidden = i !== index; if (i === index) note.scrollTop = 0; });
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
