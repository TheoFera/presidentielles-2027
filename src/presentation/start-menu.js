import { CANDIDATES, homeContent, playersContent, candidatesContent, tutorialContent } from './arcade-content.js';
import { enterLandscape, syncOrientation } from './landscape.js';
import { profileButton, profileContent, cleanNickname } from './player-profile.js';
import { isBetatestProfile } from '../simulation/campaign-styles.js';
import { showArenaSetup, defaultArenaSetup } from './arena-menu.js';
const SOUND_ON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9h4l5-4v14l-5-4H4z"/><path class="wave" d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12"/></svg>';
const SOUND_OFF = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9h4l5-4v14l-5-4H4z"/><path class="wave" d="M16.5 9.5l5 5m0-5l-5 5"/></svg>';
export { CANDIDATES } from './arcade-content.js';
const mobileLandscape = () => { if (window.matchMedia('(any-pointer: coarse)').matches) void enterLandscape(); };

export class StartMenu {
  constructor({ prepare, play, multiplayer, combat, audio = null, account = null, arena = null }) {
    Object.assign(this, { prepare, play, multiplayer, combat, audio, account, arenaMode: arena, selected: null, generation: 0 });
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
    const left = screen !== 'home' ? '<button id="menu-back">← Retour</button>' : this.account ? profileButton(this.account.get()) : '<span></span>';
    const sound = this.audio ? '<button id="menu-sound" aria-pressed="false"></button>' : '';
    this.element.innerHTML = `<div class="menu-shell"><header class="menu-header">${left}<span class="menu-tools">${sound}<button id="menu-fullscreen" aria-label="Passer en plein écran" title="Plein écran">⛶</button></span></header>${title ? `<h1 ${screen === 'candidates' ? 'class="visually-hidden"' : ''} tabindex="-1">${title}</h1>` : ''}${content}</div>`;
    this.element.querySelector('#menu-back')?.addEventListener('click', back);
    this.element.querySelector('#menu-profile')?.addEventListener('click', () => this.profile());
    this.element.querySelector('#menu-fullscreen').onclick = () => void enterLandscape();
    const soundButton = this.element.querySelector('#menu-sound');
    if (soundButton) {
      const paint = () => {
        const muted = this.audio.muted;
        soundButton.innerHTML = muted ? SOUND_OFF : SOUND_ON;
        soundButton.setAttribute('aria-pressed', String(muted));
        soundButton.setAttribute('aria-label', muted ? 'Activer le son' : 'Couper le son');
        soundButton.title = muted ? 'Son coupé' : 'Son activé';
      };
      soundButton.onclick = () => { this.audio.unlock(); this.audio.toggle(); paint(); };
      paint();
    }
    syncOrientation();
    (this.element.querySelector('h1') || this.element.querySelector('button'))?.focus({ preventScroll: true });
    this.element.scrollTop = 0;
  }
  home() {
    this.leave?.();
    this.page('home', '', homeContent());
    this.element.querySelector('#campaign').onclick = () => { mobileLandscape(); this.players('campaign'); };
    this.element.querySelector('#arena').onclick = () => { mobileLandscape(); this.players('arena'); };
  }
  /** « Avec qui ? » : seul contre l’IA, ou entre amis, pour la campagne comme pour l’arène. */
  players(mode) {
    this.page('players', '', playersContent(mode));
    this.element.querySelector('#solo').onclick = () => { mobileLandscape(); if (mode === 'arena') this.arena(); else this.candidates(); };
    this.element.querySelector('#multiplayer').onclick = () => { mobileLandscape(); this.multiplayer(this, mode); };
  }
  /** Mode Arène : réglages du combat. Le dernier réglage est gardé pour la revanche. */
  arena(setup = this.arenaSetup) {
    const { config } = this.arenaMode;
    this.arenaSetup = setup || defaultArenaSetup(config, this.account?.get() || {}, this.selected || 'melenchon');
    showArenaSetup(this, { config, profile: this.account?.get() || {}, setup: this.arenaSetup, start: chosen => void this.arenaLoading(chosen), back: () => this.players('arena') });
  }
  /** Chargement du combat. En multijoueur, l’appareil confirme seul qu’il est prêt, puis attend les autres. */
  async arenaLoading(setup, { multiplayer = null } = {}) {
    this.page('arena-loading', 'Direction le plateau !', '<div class="arena-loading"><p id="loading-status" role="status">Préparation du combat…</p><progress class="menu-loading" max="1" value="0" aria-label="Chargement du combat"></progress><span id="loading-percent" aria-hidden="true">0 %</span></div><footer class="menu-footer"><span></span><button id="start-campaign" class="menu-primary arcade-button" disabled>Chargement…</button></footer>', () => multiplayer ? this.home() : this.arena());
    const generation = this.generation;
    const button = this.element.querySelector('#start-campaign');
    try {
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      if (generation !== this.generation) return;
      await this.arenaMode.prepare(setup, ratio => {
        if (generation !== this.generation) return;
        this.element.querySelector('progress').value = ratio;
        this.element.querySelector('#loading-percent').textContent = `${Math.round(ratio * 100)} %`;
      }, multiplayer);
      if (generation !== this.generation) return;
      if (multiplayer) {
        // La partie démarre quand l’hôte reçoit la confirmation de tous les appareils.
        this.element.querySelector('#loading-status').textContent = 'Prêt ! En attente des autres joueurs…';
        button.textContent = 'En attente…';
        await multiplayer.ready();
        return;
      }
      // Pas d'écran intermédiaire : le compte à rebours démarre aussitôt.
      this.close(); this.arenaMode.play();
    } catch (error) {
      if (generation !== this.generation) return;
      this.element.querySelector('#loading-status').textContent = error.message || 'Chargement interrompu.';
      button.disabled = false; button.textContent = 'Réessayer';
      button.onclick = () => void this.arenaLoading(setup, { multiplayer });
    }
  }
  profile() {
    this.page('profile', 'Mon profil', profileContent(this.account.get()));
    const input = this.element.querySelector('#profile-nickname');
    const save = () => { const nickname = cleanNickname(input.value); this.account.save({ nickname }); return nickname; };
    const betatest = isBetatestProfile(this.account.get());
    input.addEventListener('input', save);
    // Le choix du décor n'apparaît (ou ne disparaît) qu'une fois le pseudo validé, pour ne pas couper la saisie.
    input.addEventListener('change', () => { input.value = save(); if (isBetatestProfile(this.account.get()) !== betatest) this.profile(); });
    this.element.querySelectorAll('input[name="map-decor"]').forEach(radio => radio.addEventListener('change', () => { if (radio.checked) this.account.save({ map_decor: radio.value }); }));
    input.addEventListener('keydown', event => { if (event.key === 'Enter') input.blur(); });
  }
  candidates() {
    this.selected = null;
    this.page('candidates', 'Choisissez votre candidat', candidatesContent(this.selected), () => this.players('campaign'));
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
    this.page('loading', "Plus qu'1 an avant le premier tour de l'élection présidentielle", tutorialContent(candidate, this.combat), () => multiplayer ? this.home() : this.candidates());
    if (multiplayer) {
      const eyebrow = this.element.querySelector('.eyebrow'); if (eyebrow) eyebrow.textContent = `MULTIJOUEUR · ${candidate.short}`;
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
