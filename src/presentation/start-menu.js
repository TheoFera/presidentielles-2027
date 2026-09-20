import { CANDIDATES, homeContent, candidatesContent, tutorialContent } from './arcade-content.js';
export { CANDIDATES } from './arcade-content.js';

export class StartMenu {
  constructor({ prepare, play, multiplayer }) {
    Object.assign(this, { prepare, play, multiplayer, selected: 'melenchon', generation: 0 });
    this.element = document.getElementById('start-menu');
    this.game = document.getElementById('game');
    const resize = () => {
      const height = window.visualViewport?.height || window.innerHeight;
      document.documentElement.style.setProperty('--menu-height', `${height}px`);
      document.body.classList.toggle('menu-keyboard', height < window.innerHeight * .78 && document.activeElement?.tagName === 'INPUT' && !document.activeElement.readOnly);
    };
    window.visualViewport?.addEventListener('resize', resize); window.addEventListener('resize', resize);
    this.element.addEventListener('focusin', resize); this.element.addEventListener('focusout', () => setTimeout(resize, 0)); resize();
    this.element.addEventListener('keydown', event => {
      if (event.key === 'Escape' && this.screen !== 'home') { event.preventDefault(); this.back(); }
      event.stopPropagation();
    });
    this.home();
  }
  get active() { return !this.element.hidden; }
  page(screen, title, content, back = () => this.home()) {
    this.back = back;
    this.screen = screen; this.generation++; this.element.dataset.screen = screen;
    this.element.hidden = false; this.game.inert = true;
    this.element.innerHTML = `<div class="menu-shell"><header class="menu-header"><span class="menu-brand">Présidentielles 2027</span>${screen !== 'home' ? '<button id="menu-back">← Retour</button>' : '<span class="menu-brand">ÉDITION ARCADE</span>'}</header>${title ? `<h1 tabindex="-1">${title}</h1>` : ''}${content}</div>`;
    this.element.querySelector('#menu-back')?.addEventListener('click', back);
    (this.element.querySelector('h1') || this.element.querySelector('button'))?.focus({ preventScroll: true });
    this.element.scrollTop = 0;
  }
  home() {
    this.leave?.();
    this.page('home', '', homeContent());
    this.element.querySelector('#solo').onclick = () => this.candidates();
    this.element.querySelector('#multiplayer').onclick = () => this.multiplayer(this);
  }
  candidates() {
    this.page('candidates', 'Choisissez votre candidat', candidatesContent(this.selected));
    this.element.querySelectorAll('[data-candidate]').forEach(button => {
      button.onclick = () => {
        this.selected = button.dataset.candidate;
        this.element.querySelectorAll('[data-candidate]').forEach(card => {
          const selected = card.dataset.candidate === this.selected;
          card.setAttribute('aria-pressed', String(selected)); card.querySelector('.candidate-badge').textContent = selected ? 'Votre candidat' : 'Sélectionner';
        });
      };
    });
    this.element.querySelector('#prepare-game').onclick = () => this.loading();
  }
  async loading({ multiplayer = false, ready = null } = {}) {
    const candidate = CANDIDATES.find(c => c.id === this.selected);
    this.page('loading', 'Prêt pour la campagne ?', tutorialContent(candidate), () => multiplayer ? this.home() : this.candidates());
    if (multiplayer) {
      this.element.querySelector('.eyebrow').textContent = `MULTIJOUEUR · ${candidate.name}`;
      this.element.querySelector('.menu-footer .menu-note').textContent = 'Départ quand tous sont prêts · Styles de l’hôte.';
    }
    const generation = this.generation;
    try {
      await Promise.all([this.prepare(`candidate:${this.selected}`), new Promise(resolve => setTimeout(resolve, 1800))]);
      if (generation !== this.generation) return;
      const progress = this.element.querySelector('progress'); progress.max = 1; progress.value = 1;
      this.element.querySelector('#loading-status').textContent = 'Chargement terminé. À vous de jouer !';
      const button = this.element.querySelector('#start-campaign'); button.disabled = false; button.textContent = 'C’est parti !';
      button.onclick = async () => {
        if (!ready) { this.close(); this.play(); return; }
        button.disabled = true; button.textContent = 'En attente…';
        try { await ready(); } catch (error) {
          if (generation !== this.generation) return;
          button.disabled = false; button.textContent = 'Réessayer'; this.element.querySelector('#loading-status').textContent = error.message;
        }
      };
      if (multiplayer) button.textContent = 'Je suis prêt →';
    } catch {
      if (generation === this.generation) this.element.querySelector('#loading-status').textContent = 'La préparation a échoué. Revenez à la sélection pour réessayer.';
    }
  }
  close() { this.generation++; this.element.hidden = true; this.game.inert = false; }
}
