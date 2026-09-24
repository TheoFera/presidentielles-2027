import { CANDIDATES, homeContent, candidatesContent, tutorialContent } from './arcade-content.js';
import { enterLandscape, syncOrientation } from './landscape.js';
export { CANDIDATES } from './arcade-content.js';

export class StartMenu {
  constructor({ prepare, play, multiplayer, combat }) {
    Object.assign(this, { prepare, play, multiplayer, combat, selected: null, generation: 0 });
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
    this.cleanup?.(); this.cleanup = null;
    this.back = back;
    this.screen = screen; this.generation++; this.element.dataset.screen = screen;
    this.element.hidden = false; this.game.inert = true;
    this.element.innerHTML = `<div class="menu-shell"><header class="menu-header">${screen !== 'home' ? '<button id="menu-back">← Retour</button>' : '<span></span>'}<button id="menu-fullscreen" aria-label="Passer en plein écran" title="Plein écran">⛶</button></header>${title ? `<h1 ${screen === 'candidates' ? 'class="visually-hidden"' : ''} tabindex="-1">${title}</h1>` : ''}${content}</div>`;
    this.element.querySelector('#menu-back')?.addEventListener('click', back);
    this.element.querySelector('#menu-fullscreen').onclick = () => void enterLandscape();
    syncOrientation();
    (this.element.querySelector('h1') || this.element.querySelector('button'))?.focus({ preventScroll: true });
    this.element.scrollTop = 0;
  }
  home() {
    this.leave?.();
    this.page('home', '', homeContent());
    const mobileLandscape = () => { if (window.matchMedia('(any-pointer: coarse)').matches) void enterLandscape(); };
    this.element.querySelector('#solo').onclick = () => { mobileLandscape(); this.candidates(); };
    this.element.querySelector('#multiplayer').onclick = () => { mobileLandscape(); this.multiplayer(this); };
  }
  candidates() {
    this.selected = null;
    this.page('candidates', 'Choisissez votre candidat', candidatesContent(this.selected));
    this.element.querySelectorAll('[data-candidate]').forEach(button => {
      button.onclick = () => {
        this.selected = button.dataset.candidate;
        this.element.querySelector('#prepare-game').disabled = false;
        this.element.querySelectorAll('[data-candidate]').forEach(card => {
          const selected = card.dataset.candidate === this.selected;
          card.setAttribute('aria-pressed', String(selected));
        });
      };
    });
    this.element.querySelector('#prepare-game').onclick = () => { if (this.selected) void this.loading(); };
  }
  async loading({ multiplayer = false, ready = null } = {}) {
    const candidate = CANDIDATES.find(c => c.id === this.selected);
    this.page('loading', 'En route vers l’Élysée', tutorialContent(candidate, this.combat), () => multiplayer ? this.home() : this.candidates());
    if (multiplayer) {
      this.element.querySelector('.eyebrow').textContent = `MULTIJOUEUR · ${candidate.short}`;
      this.element.querySelector('.menu-footer .menu-note').textContent = 'Départ quand tous sont prêts.';
    }
    const generation = this.generation;
    try {
      // Let the loading screen paint before constructing the world.
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      if (generation !== this.generation) return;
      await this.prepare(`candidate:${this.selected}`, ratio => {
        if (generation !== this.generation) return;
        this.element.querySelector('progress').value = ratio;
        this.element.querySelector('#loading-percent').textContent = `${Math.round(ratio * 100)} %`;
      });
      if (generation !== this.generation) return;
      const progress = this.element.querySelector('progress'); progress.max = 1; progress.value = 1;
      this.element.querySelector('#loading-percent').textContent = '100 %';
      this.element.querySelector('#loading-status').textContent = 'Prêt !';
      const button = this.element.querySelector('#start-campaign'); button.disabled = false; button.textContent = 'Jouer ➜';
      button.onclick = async () => {
        if (!ready) { this.close(); this.play(); return; }
        button.disabled = true; button.textContent = 'En attente…';
        try { await ready(); } catch (error) {
          if (generation !== this.generation) return;
          button.disabled = false; button.textContent = 'Réessayer'; this.element.querySelector('#loading-status').textContent = error.message;
        }
      };
      if (multiplayer) button.textContent = 'Je suis prêt →';
    } catch (error) {
      if (generation !== this.generation) return;
      this.element.querySelector('#loading-status').textContent = error.message || 'Chargement interrompu.';
      const button = this.element.querySelector('#start-campaign'); button.disabled = false; button.textContent = 'Réessayer';
      button.onclick = () => void this.loading({ multiplayer, ready });
    }
  }
  close() { this.cleanup?.(); this.cleanup = null; this.generation++; this.element.hidden = true; syncOrientation(); }
}
