import { CANDIDATES, homeContent, playersContent, candidatesContent, tutorialContent } from './arcade-content.js';
import { enterLandscape, syncOrientation, toggleFullscreen } from './landscape.js';
import { profileButton, profileContent, cleanNickname, collectionCardContent } from './player-profile.js';
import { hydrateMedallions, playerCard, rememberTitle } from './player-card.js';
import { isBetatestProfile } from '../simulation/campaign-styles.js';
import { showDebateSetup, defaultDebateSetup, emptyDebateSetup } from './debate-menu.js';
import { APP_BUILD } from '../app-build.js';
const SOUND_ON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9h4l5-4v14l-5-4H4z"/><path class="wave" d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12"/></svg>';
const SOUND_OFF = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9h4l5-4v14l-5-4H4z"/><path class="wave" d="M16.5 9.5l5 5m0-5l-5 5"/></svg>';
export { CANDIDATES } from './arcade-content.js';
// L'application Android est déjà en plein écran et en paysage.
const mobileLandscape = () => { if (!APP_BUILD && window.matchMedia('(any-pointer: coarse)').matches) void enterLandscape(); };

export class StartMenu {
  constructor({ prepare, play, multiplayer, combat, audio = null, account = null, ads = null, debate = null }) {
    Object.assign(this, { prepare, play, multiplayer, combat, audio, account, ads, debateMode: debate, selected: null, generation: 0 });
    this.element = document.getElementById('start-menu');
    this.game = document.getElementById('game');
    const resize = () => {
      const height = window.visualViewport?.height || window.innerHeight;
      document.documentElement.style.setProperty('--menu-height', `${height}px`);
      const field = document.activeElement?.tagName === 'INPUT' && !document.activeElement.readOnly ? document.activeElement : null;
      const typing = !!field && height < window.innerHeight * .78;
      // Le bloc qui contient le champ reste affiché : masqué, il perdrait le focus et refermerait le clavier.
      const block = typing ? field.closest('.menu-shell > *') : null;
      this.element.querySelectorAll('.keyboard-field').forEach(element => element !== block && element.classList.remove('keyboard-field'));
      block?.classList.add('keyboard-field');
      document.body.classList.toggle('menu-keyboard', typing);
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
    this.element.innerHTML = `<div class="menu-shell"><header class="menu-header">${left}<span class="menu-tools">${sound}${APP_BUILD ? '' : '<button id="menu-fullscreen" aria-label="Passer en plein écran" title="Plein écran">⛶</button>'}</span></header>${title ? `<h1 ${screen === 'candidates' ? 'class="visually-hidden"' : ''} tabindex="-1">${title}</h1>` : ''}${content}</div>`;
    this.element.querySelector('#menu-back')?.addEventListener('click', back);
    this.element.querySelector('#menu-profile')?.addEventListener('click', () => this.profile());
    const fullscreenButton = this.element.querySelector('#menu-fullscreen');
    if (fullscreenButton) fullscreenButton.onclick = async () => {
      if (await toggleFullscreen()) return;
      this.element.querySelector('.menu-toast')?.remove();
      const toast = document.createElement('p'); toast.className = 'menu-toast'; toast.setAttribute('role', 'status');
      toast.textContent = 'Plein écran indisponible dans ce navigateur. Sur iPhone : Partager → « Sur l’écran d’accueil », puis ouvrez le jeu depuis l’icône.';
      this.element.append(toast); setTimeout(() => toast.remove(), 6000);
    };
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
    hydrateMedallions(this.element);
    syncOrientation();
    (this.element.querySelector('h1') || this.element.querySelector('button'))?.focus({ preventScroll: true });
    this.element.scrollTop = 0;
  }
  home() {
    this.leave?.();
    this.page('home', '', homeContent());
    this.element.querySelector('#campaign').onclick = () => { mobileLandscape(); this.players('campaign'); };
    this.element.querySelector('#debate').onclick = () => { mobileLandscape(); this.players('debate'); };
    // Appli en Europe : le joueur peut revoir ses choix de consentement aux pubs (obligation RGPD).
    if (this.ads?.privacyRequired()) {
      const privacy = document.createElement('button');
      privacy.id = 'menu-ad-privacy'; privacy.textContent = 'Pubs';
      privacy.title = privacy.ariaLabel = 'Choix de confidentialité des publicités';
      privacy.onclick = () => this.ads.openPrivacy();
      this.element.querySelector('.menu-tools')?.prepend(privacy);
    }
  }
  /** « Avec qui ? » : seul contre l’IA, ou entre amis, pour la campagne comme pour le débat. */
  players(mode) {
    this.page('players', '', playersContent(mode));
    this.element.querySelector('#solo').onclick = () => { mobileLandscape(); if (mode === 'debate') this.debate(emptyDebateSetup(this.debateMode.config)); else this.candidates(); };
    this.element.querySelector('#multiplayer').onclick = () => { mobileLandscape(); this.multiplayer(this, mode); };
  }
  /** Mode Débat : réglages du combat. Le dernier réglage est gardé pour la revanche. */
  debate(setup = this.debateSetup) {
    const { config } = this.debateMode;
    this.debateSetup = setup || defaultDebateSetup(config, this.account?.get() || {}, this.selected || 'melenchon');
    showDebateSetup(this, { config, profile: this.account?.get() || {}, setup: this.debateSetup, start: chosen => void this.debateLoading(chosen), back: () => this.players('debate') });
  }
  /** Chargement du combat. En multijoueur, l’appareil confirme seul qu’il est prêt, puis attend les autres. */
  async debateLoading(setup, { multiplayer = null } = {}) {
    this.page('debate-loading', 'Direction le plateau !', '<div class="debate-loading"><p id="loading-status" role="status">Préparation du combat…</p><progress class="menu-loading" max="1" value="0" aria-label="Chargement du combat"></progress><span id="loading-percent" aria-hidden="true">0 %</span></div><footer class="menu-footer"><span></span><button id="start-campaign" class="menu-primary arcade-button" disabled>Chargement…</button></footer>', () => multiplayer ? this.home() : this.debate());
    const generation = this.generation;
    const button = this.element.querySelector('#start-campaign');
    try {
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      if (generation !== this.generation) return;
      await this.debateMode.prepare(setup, ratio => {
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
      this.close(); this.debateMode.play();
    } catch (error) {
      if (generation !== this.generation) return;
      this.element.querySelector('#loading-status').textContent = error.message || 'Chargement interrompu.';
      button.disabled = false; button.textContent = 'Réessayer';
      button.onclick = () => void this.debateLoading(setup, { multiplayer });
    }
  }
  profile(tab = this.profileTab || 'collection') {
    this.profileTab = tab;
    // Meilleur titre atteint sur cet appareil : gardé même si de nouveaux candidats arrivent.
    this.account.save(rememberTitle(this.account.get()));
    this.page('profile', 'Mon profil', profileContent(this.account.get(), { tab }));
    this.onProfile?.(this);
    const tabs = [...this.element.querySelectorAll('[data-profile-tab]')];
    tabs.forEach(button => button.onclick = () => {
      this.profileTab = button.dataset.profileTab;
      tabs.forEach(b => b.setAttribute('aria-selected', String(b === button)));
      this.element.querySelectorAll('.profile-panel').forEach(panel => { panel.hidden = panel.id !== `profile-panel-${this.profileTab}`; });
    });
    // Collection : une carte par candidat. Losanges : montrer un autre de ses styles (sur place).
    // Portrait : un style débloqué devient l'avatar ; un style verrouillé montre comment le gagner.
    const grid = this.element.querySelector('.collection-groups');
    grid?.addEventListener('click', event => {
      const card = event.target.closest('.collection-card');
      if (!card) return;
      const pip = event.target.closest('[data-show]');
      if (pip) {
        const shown = pip.dataset.show, focus = `[data-show="${shown}"]`;
        card.outerHTML = collectionCardContent(playerCard(this.account.get()), card.dataset.candidate, shown);
        const next = grid.querySelector(`[data-candidate="${card.dataset.candidate}"]`);
        hydrateMedallions(next); next.querySelector(focus)?.focus({ preventScroll: true });
        return;
      }
      if (!event.target.closest('.collection-pick')) return;
      if (card.hasAttribute('data-locked')) {
        grid.querySelectorAll('.collection-card.show-hint').forEach(other => other !== card && other.classList.remove('show-hint'));
        card.classList.toggle('show-hint');
        return;
      }
      if (card.classList.contains('is-avatar')) return;
      void Promise.resolve(this.onAvatar?.(card.dataset.style)).finally(() => { if (this.screen === 'profile') this.profile(); });
    });
    const input = this.element.querySelector('#profile-nickname');
    this.element.querySelectorAll('input[name="map-decor"]').forEach(radio => radio.addEventListener('change', () => { if (radio.checked) this.account.save({ map_decor: radio.value }); }));
    // Connecté à un compte : le pseudo se change dans « Mon compte ».
    if (!input) return;
    const save = () => { const nickname = cleanNickname(input.value); this.account.save({ nickname }); return nickname; };
    const betatest = isBetatestProfile(this.account.get());
    input.addEventListener('input', save);
    // Le choix du décor n'apparaît (ou ne disparaît) qu'une fois le pseudo validé, pour ne pas couper la saisie.
    input.addEventListener('change', () => { input.value = save(); if (isBetatestProfile(this.account.get()) !== betatest) this.profile(); });
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
    this.page('loading', "Plus qu'un an avant le premier tour de l'élection présidentielle", tutorialContent(candidate, this.combat), () => multiplayer ? this.home() : this.candidates());
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
