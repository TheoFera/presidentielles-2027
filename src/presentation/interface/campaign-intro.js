// Affichage de la scène d'ouverture de la Campagne (règles : simulation/campaign-intro.js).
//
// Rien de neuf à charger : les journalistes sont les trois duos du jeu, le public et l'estrade sont
// ceux de la carte. Le bandeau, les bandes noires, le flash blanc et les consignes sont des éléments
// HTML dont seules la position et l'opacité changent (calcul fait par la carte graphique). Les éclats
// des flashs viennent d'une seule petite image préparée une fois.
//
// Deux premières parties (`tutorial`) : grand dossier « carte + objectifs », puis consignes
// « ← → » et « Frapper ». Ensuite : la scène seule, qu'un coup écourte.
import { CANDIDATES } from '../menus/arcade-content.js';
import { ringDelta, wrap } from '../../simulation/world.js';

// Après le coup, les journalistes sortent par le bas de l'écran, comme une équipe de reportage qui
// s'en va en jeu ; chacun part un tout petit peu après son voisin.
const FLEE_STAGGER = 0.07;
// Durée d'un éclat de flash à l'objectif d'une caméra.
const FLASH_SECONDS = 0.16;
// Brèves du bandeau défilant, sous le titre du flash info.
const TICKER = ['Premier tour dans 365 jours', 'Les instituts de sondage déjà sur le pied de guerre',
  'D’autres candidats sur la ligne de départ', 'La presse se bouscule devant l’estrade'];

/** Consignes clavier et tactile : seule celle de l'appareil s'affiche (CSS). */
const PROMPTS = {
  move: '<span class="intro-keys"><kbd>←</kbd><kbd>→</kbd></span><span class="intro-key-text">pour se déplacer</span>',
  strike: '<span class="intro-keys keyboard-only"><kbd class="wide">Espace</kbd></span><span class="intro-keys touch-only"><kbd class="wide">Frapper</kbd></span><span class="intro-key-text">pour frapper</span>',
  waiting: '<span class="intro-key-text">En attente des autres candidats…</span>',
  idle: '<span class="intro-key-text">Frapper pour lancer la campagne</span>',
  dossier: '<span class="intro-key-text keyboard-only">Appuyez sur une touche pour continuer</span><span class="intro-key-text touch-only">Touchez l’écran pour continuer</span>',
};
// Noms des six quartiers autour de la grande roue du dossier (dans l'ordre du tour de la carte).
const BIOME_NAMES = { paris_19e: 'Péricentre', banlieue: 'Banlieue', periurbain_usine: 'Périurbains', campagne: 'Campagne',
  retraites: 'Littoral', quartiers_riches: 'Beaux-quartiers' };

export class CampaignIntroScene {
  constructor(game, config, { renderer = null, wheel = () => null, play = () => {}, ended = () => {} } = {}) {
    this.game = game; this.config = config; this.settings = config.prototype.campaign_intro; this.renderer = renderer;
    this.hz = config.balance.simulation_architecture.fixed_tick_hz; this.wheel = wheel; this.play = play; this.ended = ended;
    // Le dossier reste affiché jusqu'à une touche ou un appui sur l'écran.
    this.listen = () => { this.closeRequested = this.t >= this.settings.dossier_min_seconds; };
    this.root = document.createElement('div'); this.root.id = 'campaign-intro'; this.root.hidden = true;
    this.root.innerHTML = '<div class="intro-fade"></div><div class="intro-band intro-band-top"></div><div class="intro-band intro-band-bottom"></div><div class="intro-flash"></div>'
      + '<div class="intro-news" role="status"><div class="intro-news-head"><span class="intro-news-flash">Flash info</span><p class="intro-news-title"></p></div>'
      + '<div class="intro-news-ticker"><span class="intro-news-live"><i></i>Direct</span><div class="intro-news-scroll"><span class="intro-news-track"></span></div></div></div>'
      + '<p class="intro-prompt" role="status"></p>';
    this.banner = this.root.querySelector('.intro-news'); this.prompt = this.root.querySelector('.intro-prompt');
    this.whiteFlash = this.root.querySelector('.intro-flash');
    // Le texte défile en boucle : deux copies côte à côte, décalées d'une moitié (transformation seulement).
    this.root.querySelector('.intro-news-track').textContent = `${TICKER.join('   •   ')}   •   `.repeat(2);
    game.append(this.root);
    this.stop();
  }

  /** Nouvelle partie lancée depuis le menu. `tutorial` : une des deux premières parties du joueur. */
  start({ tutorial }) {
    this.stop();
    this.active = true; this.tutorial = tutorial;
    this.setClass('campaign-intro', true); this.setClass('intro-tutorial', tutorial);
  }
  /**
   * Ouverture, une fois la partie à l'écran (pas derrière l'écran de chargement) : un fondu au noir
   * s'ouvre sur la scène pendant que les bandes de cinéma glissent en place.
   */
  open() {
    this.opened = true; this.root.hidden = false;
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const timing = { duration: 700, easing: 'cubic-bezier(.3, .8, .3, 1)' };
    this.root.querySelector('.intro-fade').animate([{ opacity: 1 }, { opacity: 0 }], { duration: 900, easing: 'ease-in-out' });
    this.root.querySelector('.intro-band-top').animate([{ transform: 'translateY(-101%)' }, { transform: 'none' }], timing);
    this.root.querySelector('.intro-band-bottom').animate([{ transform: 'translateY(101%)' }, { transform: 'none' }], timing);
  }
  stop() {
    this.active = false; this.opened = false; this.tutorial = false; this.t = 0; this.endedAt = null; this.strikes = new Map(); this.stages = null;
    this.moved = 0; this.step = null; this.flashesDone = 0; this.bannerShown = false; this.dossier = false; this.promptKey = null;
    this.dossierClosedAt = null; this.closeRequested = false; this.namesShown = false; this.waitForInput(false);
    this.root.hidden = true; this.banner.classList.remove('shown'); this.root.classList.remove('bands-out');
    for (const name of ['campaign-intro', 'intro-tutorial', 'intro-dossier', 'intro-tuto-move', 'intro-tuto-strike']) this.setClass(name, false);
    this.showPrompt(null);
    if (this.renderer) this.renderer.zoomBoost = 1;
  }

  /** Plan rapproché sur l'estrade, puis retour au cadrage du jeu après le coup (ou la fin de la scène). */
  updateZoom(release) {
    if (!this.renderer) return;
    const k = release == null ? 0 : matchMedia('(prefers-reduced-motion: reduce)').matches ? 1
      : Math.min(1, Math.max(0, (this.t - release) / this.settings.zoom_release_seconds));
    this.renderer.zoomBoost = 1 + (this.settings.camera_zoom - 1) * (1 - k * k * (3 - 2 * k));
  }
  setClass(name, on) { if (this.game.classList.contains(name) !== on) this.game.classList.toggle(name, on); }
  waitForInput(on) {
    for (const type of ['keydown', 'pointerdown']) globalThis[on ? 'addEventListener' : 'removeEventListener'](type, this.listen, true);
  }

  /** Le discours commence après le dossier (deux premières parties), sinon presque tout de suite. */
  get bannerStart() {
    if (!this.tutorial) return this.settings.short_banner_start_seconds;
    return this.dossierClosedAt === null ? Infinity : this.dossierClosedAt + this.settings.banner_delay_seconds;
  }
  get bannerEnd() { return this.bannerStart + this.settings.banner_hold_seconds; }

  /** Le coup du joueur est-il encore retenu (consignes pas encore affichées) ? */
  blocksAttack(state) {
    if (!state.campaign_intro || !this.active) return false;
    return this.tutorial && this.step !== 'strike';
  }

  /** Une image : horloge de la scène, chorégraphie de l'interface, sons. */
  update(state, elapsed) {
    if (!this.active) return;
    const intro = state.campaign_intro, local = state.candidates.find(c => c.id === state.local_candidate_id);
    if (intro && !this.opened) this.open();
    if (intro) {
      this.t = intro.tick / this.hz;
      this.stages ??= intro.stages;
      for (const [id, tick] of Object.entries(intro.strikes)) if (!this.strikes.has(id)) this.strikes.set(id, tick / this.hz);
    } else {
      // Fin de la scène : les journalistes finissent leur sortie, la caméra recule, puis tout disparaît.
      if (this.endedAt === null) { this.endedAt = this.t; this.finish(); }
      this.t += elapsed;
      this.updateZoom(this.strikes.get(state.local_candidate_id) ?? this.endedAt);
      const done = this.config.balance.press_team.exit_seconds + 6 * FLEE_STAGGER;
      if (this.t - this.endedAt > Math.max(done, this.settings.zoom_release_seconds)) this.stop();
      return;
    }
    const mine = this.strikes.get(state.local_candidate_id);
    const s = this.settings, t = this.t;
    this.updateZoom(mine);
    // Dossier de campagne : grande carte (noms des quartiers autour) et objectifs, le temps qu'il faut
    // au joueur ; une touche ou un appui, et chacun glisse à sa place.
    if (this.closeRequested && this.dossierClosedAt === null) { this.dossierClosedAt = t; this.waitForInput(false); }
    const dossier = this.tutorial && mine == null && this.dossierClosedAt === null;
    if (dossier !== this.dossier) {
      this.dossier = dossier;
      if (dossier) { this.measureDossier(); this.waitForInput(true); }
      this.setClass('intro-dossier', dossier);
    }
    if (dossier && !this.namesShown) this.namesShown = this.wheel()?.showBiomeNames(BIOME_NAMES) === true;
    // Flash info du journal télévisé pendant le discours : « À un an de la présidentielle, X annonce sa candidature ».
    const banner = mine == null && t >= this.bannerStart && t < this.bannerEnd;
    if (banner !== this.bannerShown) {
      this.bannerShown = banner;
      if (banner) {
        const name = document.createElement('strong');
        name.textContent = CANDIDATES.find(c => c.id === local.faction_id)?.name ?? local.faction_id;
        this.banner.querySelector('.intro-news-title').replaceChildren('À un an de la présidentielle, ', name, ' annonce sa candidature');
        this.play('news');
      }
      this.banner.classList.toggle('shown', banner);
    }
    const offsets = s.flash_offsets_seconds;
    while (mine == null && this.flashesDone < offsets.length && t >= this.bannerStart + offsets[this.flashesDone]) {
      this.flashesDone++; this.play('shutter'); this.flashScreen();
    }
    // Consignes (deux premières parties), puis attente des autres joueurs.
    // Une direction tenue suffit, même contre le bord de l'estrade.
    if ((local?.moving || local?.axis) && this.step === 'move') this.moved += elapsed;
    let step = null;
    if (mine == null && this.tutorial && t >= this.bannerEnd) step = this.moved >= s.move_seconds_before_strike ? 'strike' : 'move';
    if (step !== this.step) { this.step = step; this.setClass('intro-tuto-move', step === 'move'); this.setClass('intro-tuto-strike', step === 'strike'); }
    // Les bandes noires laissent la place aux boutons pendant les consignes, et partent au coup.
    this.root.classList.toggle('bands-out', mine != null || !!step);
    const waiting = mine != null && t - mine > 0.6;
    const idle = !this.tutorial && mine == null && t >= s.idle_hint_seconds;
    const reading = dossier && t >= s.dossier_min_seconds;
    this.showPrompt(step || (reading ? 'dossier' : waiting ? 'waiting' : idle ? 'idle' : null));
  }

  finish() {
    this.waitForInput(false);
    this.banner.classList.remove('shown'); this.showPrompt(null); this.root.classList.add('bands-out');
    for (const name of ['campaign-intro', 'intro-tutorial', 'intro-dossier', 'intro-tuto-move', 'intro-tuto-strike']) this.setClass(name, false);
    this.ended({ tutorial: this.tutorial });
  }

  showPrompt(key) {
    if (key === this.promptKey) return;
    this.promptKey = key;
    this.prompt.innerHTML = key ? PROMPTS[key] : '';
    this.prompt.dataset.step = key || '';
    this.prompt.classList.toggle('shown', !!key);
  }

  flashScreen() {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    this.whiteFlash.animate([{ opacity: 0.38 }, { opacity: 0 }], { duration: 220, easing: 'ease-out' });
  }

  /**
   * Position de départ du dossier, mesurée une fois : la carte au centre de la moitié droite,
   * le post-it des objectifs au centre de la moitié gauche, agrandis. Ils reviennent ensuite à
   * leur place par une simple transition de transformation.
   */
  measureDossier() {
    const game = this.game.getBoundingClientRect();
    const place = (selector, x, y, fit) => {
      const element = this.game.querySelector(selector);
      if (!element) return;
      element.style.removeProperty('--dossier');
      const box = element.getBoundingClientRect();
      if (!box.width || !box.height) return;
      const scale = Math.max(1, Math.min(fit(box), 2.4));
      const dx = game.left + game.width * x - (box.left + box.width / 2), dy = game.top + game.height * y - (box.top + box.height / 2);
      element.style.setProperty('--dossier', `translate(${dx.toFixed(1)}px, ${dy.toFixed(1)}px) scale(${scale.toFixed(3)})`);
    };
    place('#electoral-display', 0.73, 0.47, box => game.height * 0.62 / box.height);
    place('#campaign-objectives', 0.29, 0.47, box => Math.min(game.width * 0.34 / box.width, game.height * 0.56 / box.height));
  }

  /** Journalistes du décor : trois duos autour de chaque estrade, tournés vers l'orateur. */
  pressUnits(state) {
    if (!this.stages) return [];
    const units = [], length = state.world.length, exit = this.config.balance.press_team.exit_seconds;
    for (const [candidateId, stageId] of Object.entries(this.stages)) {
      const stage = state.buildings.find(b => b.id === stageId);
      if (!stage) continue;
      // Sans coup de ce candidat (ordinateur, joueur en retard), sa presse part avec le début de la campagne.
      const struck = this.strikes.get(candidateId) ?? this.endedAt;
      const since = struck == null ? -1 : this.t - struck;
      this.settings.press_offsets_units.forEach((offsets, duo) => offsets.forEach((offset, member) => {
        const leave = since < 0 ? null : Math.max(0, Math.min(1, (since - (duo * 2 + member) * FLEE_STAGGER) / exit));
        if (leave === 1) return;
        const camera = member === 1;
        units.push({ id: `intro-press:${stageId}:${duo}:${member}`, role: camera ? 'PRESS_CAMERA' : 'PRESS_REPORTER', faction_id: 'press',
          // Tournés vers l'orateur, puis vers l'extérieur pour partir.
          variant: duo, x: wrap(stage.x + offset, length), facing: (leave === null ? -1 : 1) * Math.sign(offset), moving: leave !== null, leave_progress: leave,
          filming: camera && leave === null, aim_ticks: 0, press_ready: false, combat: { height: 0, stun_ticks: 0, attack_id: null } });
      }));
    }
    return units;
  }

  /** État à dessiner : le temps de la scène anime les personnages, le public écoute, l'orateur parle. */
  view(state) {
    if (!this.active) return state;
    const press = this.pressUnits(state);
    const intro = state.campaign_intro;
    if (!intro) return press.length ? { ...state, temporary_units: [...state.temporary_units, ...press] } : state;
    const crowd = new Set(intro.crowd_ids), stageOf = new Map();
    for (const [id, stage] of Object.entries(intro.stages)) stageOf.set(id, stage);
    const speaking = this.t >= this.bannerStart && this.t < this.bannerEnd;
    // Public : la pose d'écoute des meetings, sur l'estrade la plus proche.
    const stageIds = [...stageOf.values()], stages = state.buildings.filter(b => stageIds.includes(b.id));
    const nearestStage = npc => stages.reduce((best, b) => Math.abs(ringDelta(npc.x, b.x, state.world.length)) < Math.abs(ringDelta(npc.x, best.x, state.world.length)) ? b : best, stages[0]);
    return {
      ...state, tick: intro.tick,
      npcs: state.npcs.map(npc => crowd.has(npc.id) && stages.length ? { ...npc, meeting_target_id: nearestStage(npc).id } : npc),
      candidates: state.candidates.map(c => speaking && stageOf.has(c.id) && !c.moving && !c.combat.attack_id && !this.strikes.has(c.id)
        ? { ...c, persuasion_target_ids: ['intro'] } : c),
      temporary_units: [...state.temporary_units, ...press],
    };
  }
  /** État précédent, avec la même horloge (lissage des mouvements entre deux pas). */
  previous(previous, state) {
    if (!this.active || !state.campaign_intro) return previous;
    return { ...previous, tick: Math.max(0, state.campaign_intro.tick - 1) };
  }

  /** Éclats des flashs, devant les objectifs des caméras (après le dessin du monde). */
  drawOverlay(renderer, view) {
    if (!this.active || !view.campaign_intro || this.strikes.has(view.local_candidate_id)) return;
    const offsets = this.settings.flash_offsets_seconds;
    const cameras = view.temporary_units.filter(u => u.role === 'PRESS_CAMERA' && String(u.id).startsWith('intro-press:'));
    if (!cameras.length) return;
    const { ctx, metrics: m } = renderer, sprite = flashSprite();
    offsets.forEach((offset, index) => {
      const age = this.t - (this.bannerStart + offset);
      if (age < 0 || age > FLASH_SECONDS) return;
      // Chaque déclic vient d'une des trois caméras, à tour de rôle.
      for (const camera of cameras.filter(u => u.variant === index % 3)) {
        const x = renderer.screenX(camera.x) + camera.facing * m.characterHeight * 0.13;
        if (x < -40 || x > renderer.width + 40) continue;
        const y = m.groundY + m.characterHeight * ((m.groundOffsetRatio ?? 0.06) - this.config.balance.press_team.camera_height * 0.92);
        const size = m.characterHeight * (0.55 + 0.35 * (1 - age / FLASH_SECONDS));
        ctx.save(); ctx.globalAlpha = 1 - age / FLASH_SECONDS; ctx.globalCompositeOperation = 'lighter';
        ctx.drawImage(sprite, x - size / 2, y - size / 2, size, size);
        ctx.restore();
      }
    });
  }
}

let sprite = null;
/** Éclat de flash (halo blanc et étoile), dessiné une seule fois. */
function flashSprite() {
  if (sprite) return sprite;
  sprite = document.createElement('canvas'); sprite.width = sprite.height = 96;
  const ctx = sprite.getContext('2d'), c = 48;
  const halo = ctx.createRadialGradient(c, c, 0, c, c, c);
  halo.addColorStop(0, '#ffffffff'); halo.addColorStop(0.18, '#fffbe8e0'); halo.addColorStop(0.5, '#fff3c040'); halo.addColorStop(1, '#fff3c000');
  ctx.fillStyle = halo; ctx.fillRect(0, 0, 96, 96);
  ctx.fillStyle = '#ffffffd0';
  ctx.fillRect(c - 44, c - 1.5, 88, 3); ctx.fillRect(c - 1.5, c - 44, 3, 88);
  return sprite;
}
