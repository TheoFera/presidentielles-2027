import { DamageFeedbackDisplay } from './presentation/damage-feedback.js';
import { CampaignStylesDisplay } from './presentation/campaign-styles.js';
import { ultimateBlockedReason } from './simulation/combat.js';
import { loadCampaignProfile, saveCampaignProfile } from './presentation/campaign-profile.js';
import { CampaignDisplay } from './presentation/campaign.js';
import { loadConfig } from './config.js';
import { applyDecorPreview } from './presentation/fixed-world.js';
import { decorForProfile, setMapDecor } from './presentation/map-decor.js';
import { formatCarriedMoney } from './presentation/money.js';
import { MoneyCounter } from './presentation/money-counter.js';
import { GameAudio, SoundDirector } from './presentation/audio.js';
import { CombatPoseTracker } from './presentation/melenchon-combat.js';
import { recordMatchResult } from './presentation/player-profile.js';
import { GameSimulation } from './simulation/game-simulation.js';
import { FixedClock } from './simulation/fixed-clock.js';
import { AIController, LocalHumanController, collectCommands } from './simulation/controllers.js';
import { zoneAt, ringDelta, wrap } from './simulation/world.js';
import { WorldRenderer } from './presentation/renderer.js';
import { BrowserInput } from './presentation/input.js';
import { DebugPanel } from './presentation/debug.js';
import { ElectoralDisplay } from './presentation/electoral.js';
import { interpolatedPlayerX } from './presentation/player-position.js';
import { MatchDisplay } from './presentation/match.js';
import { StartMenu } from './presentation/start-menu.js';
import { showLegalNotice, warmUpBehindNotice } from './presentation/legal-notice.js';
import { worldAssetIds } from './presentation/illustrated-world.js';
import { installLandscape } from './presentation/landscape.js';
import { MultiplayerSession, showMultiplayerSetup, updateLobby, showPeerAnswer } from './presentation/multiplayer.js';
import { PeerSession } from './network/peer-session.js';
import { OnlineSession } from './network/online-session.js';
import { outgoingCommands } from './network/shared-commands.js';
import { SnapshotBuffer } from './network/snapshot-buffer.js';
import { DebateMatch, debateModeAICommands, debateFighterIds } from './simulation/debate-mode.js';
import { DebateModeDisplay, debateAssetIds, drawDebateMode } from './presentation/debate-mode.js';

function setText(element, text) {
  if (element.textContent !== text) element.textContent = text;
}

function showError(error, duringGame = false) {
  console.error(error);
  const element = document.getElementById('error');
  element.hidden = false;
  element.textContent = duringGame
    ? `La partie a été interrompue par une erreur. Recharge la page pour relancer le jeu. Détail technique : ${error.message}`
    : `Le jeu n’a pas pu démarrer : ${error.message}. Recharge la page. Si tu joues depuis les fichiers de ton ordinateur, utilise « Lancer le jeu.cmd ».`;
}

async function start() {
  showLegalNotice();
  const config = applyDecorPreview(await loadConfig());
  const chargeDuration = `${config.balance.candidate_combat.charge_ready_seconds.toLocaleString('fr-FR')} s`;
  document.querySelectorAll('[data-charge-duration]').forEach(element => { element.textContent = chargeDuration; });
  const profile = loadCampaignProfile();
  try { saveCampaignProfile(profile); } catch { console.warn('Le profil ne peut pas être enregistré dans ce navigateur.'); }
  // Le profil reste le même objet : les simulations et l'écran des styles gardent leur référence.
  const account = {
    get: () => profile,
    save: patch => { Object.assign(profile, patch); try { Object.assign(profile, saveCampaignProfile(profile)); } catch { /* Stockage indisponible : gardé pour cette session. */ } },
  };
  const audio = new GameAudio();
  // Le navigateur n'autorise le son qu'après un geste de l'utilisateur.
  for (const type of ['pointerdown', 'keydown', 'touchend']) document.addEventListener(type, () => audio.unlock(), { capture: true, passive: true });
  document.addEventListener('click', event => { if (event.target.closest?.('#start-menu button, #help button, #results button, #campaign-styles button')) audio.play('ui'); }, true);
  const sounds = new SoundDirector(audio, config.balance.simulation_architecture.fixed_tick_hz);
  // Même détection que la garde dessinée à l'écran, pour passer à la musique de combat.
  const combatMusic = new CombatPoseTracker();
  let resultRecorded = false;
  let simulation = new GameSimulation(config, config.prototype.seed, 'candidate:melenchon', profile);
  let state = simulation.getState();
  let previous = state;
  const clock = new FixedClock(config.balance.simulation_architecture.fixed_tick_hz);
  const human = new LocalHumanController();
  const ai = new AIController(config);
  const canvas = document.getElementById('world');
  const renderer = new WorldRenderer(canvas, config);
  // Pendant l'avertissement, les images de la campagne se chargent déjà en arrière-plan.
  setMapDecor(decorForProfile(profile));
  warmUpBehindNotice(renderer.assets, worldAssetIds(renderer.assets.manifest, { buildings: [] }));
  const damageFeedback = new DamageFeedbackDisplay(config);
  const campaignDisplay = new CampaignDisplay(config);
  const electoralDisplay = new ElectoralDisplay(config);
  const matchDisplay = new MatchDisplay(config, {
    isHost: () => !session || session.host, isMultiplayer: () => !!session,
    continue: () => {
      if (session && !session.host) return;
      input.clear(); pending = []; remote.clear(); clock.reset();
      simulation.applyCommand({ type: 'ContinueToSecondRound' });
      state = simulation.getState(); previous = state; renderer.resetCamera(); canvas.focus();
    },
    follow: () => { renderer.resetCamera(); canvas.focus(); },
    replay: () => { if (session) returnHome(); else { menu.selected = state.local_candidate_id.split(':')[1]; void menu.loading(); } }, return: () => returnHome(),
  });
  const help = document.getElementById('help');
  const money = document.getElementById('money');
  const funds = document.getElementById('funds');
  const moneyCounter = new MoneyCounter(money, formatCarriedMoney);
  document.getElementById('budget-help').textContent = `Plafond de dépenses : ${config.balance.money.campaign_spending_limit.toLocaleString('fr-FR')} k€ par candidat sur toute la partie. Les remboursements ne rétablissent pas ce budget.`;
  const notice = document.getElementById('notice');
  let pending = [];
  let paused = true;
  let wakeLock = null;
  let wakePending = false;
  // In multiplayer the screen stays on in the lobby and the help panel too:
  // a sleeping phone suspends its page and drops the connection for everybody.
  const screenIdle = () => document.hidden || (!session && (paused || menu?.active));
  async function keepScreenAwake() {
    if (screenIdle()) { try { await wakeLock?.release(); } catch { /* Already released by the browser. */ } wakeLock = null; return; }
    if (!navigator.wakeLock || wakeLock && !wakeLock.released || wakePending) return;
    wakePending = true;
    try {
      const lock = await navigator.wakeLock.request('screen');
      if (screenIdle()) await lock.release(); else wakeLock = lock;
    } catch { /* The browser may refuse in battery-saving mode. */ }
    finally { wakePending = false; }
  }
  let menu;
  let session = null;
  let roomPhase = null;
  let remote = new Map();
  let networkElapsed = 0;
  let networkBusy = false;
  let sentAxis = 0;
  // Invité : les états de l’hôte passent par un tampon pour un affichage fluide malgré la 4G.
  const snapshots = new SnapshotBuffer(1 / config.balance.simulation_architecture.fixed_tick_hz);
  let guestAlpha = 1;
  let simulationSpeed = 1;
  let wasHidden = false;
  let noticeRemaining = 0;
  let previousTime = performance.now();
  let debugElapsed = 0;
  let currentZone = zoneAt(state.world, state.candidates[0].x).id;
  let currentDay = state.days_remaining;
  // Mode Débat : combat autonome, sans monde de campagne.
  let debateMatch = null, debateState = null, debatePrevious = null, debatePending = [], debateSetup = null;
  // Débat multijoueur : combattants pilotés par un autre appareil (l’hôte simule, les invités affichent).
  let debateRemoteIds = new Set();
  const debateFighterOf = (setup, playerId) => debateFighterIds(setup.fighters)[setup.fighters.findIndex(f => f.player === playerId)];
  const debateDisplay = new DebateModeDisplay(config, {
    rematch: () => {
      // Multijoueur : on vote ; le combat repart quand tous les joueurs ont voté.
      if (session) {
        debateDisplay.setRematch({ voted: true });
        session.request('rematch').catch(error => debateDisplay.setRematch({ voted: false, closed: error.transient ? '' : 'Revanche impossible' }));
        return;
      }
      if (debateSetup) void menu.debateLoading(debateSetup);
    },
    setup: () => {
      // Multijoueur : tout le salon revient à la sélection, connexion conservée.
      if (session) { session.request('lobby').catch(() => debateDisplay.setRematch({ closed: 'Indisponible' })); return; }
      returnHome(); menu.debate();
    },
    home: () => returnHome(),
  });

  const notify = (text, seconds = config.prototype.presentation.zone_flash_seconds) => { notice.textContent = text; noticeRemaining = seconds; };
  const queue = command => { pending.push(command); canvas.focus(); };
  const resetPresentation = () => {
    state = simulation.getState(); previous = state; pending = []; clock.reset(); input.clear(); renderer.resetCamera();
    matchDisplay.reset(); moneyCounter.reset(); sounds.reset(); combatMusic.clear();
    // Une partie importée déjà terminée ne compte pas dans les statistiques du profil.
    resultRecorded = state.phase === 'RESULTS';
    currentDay = state.days_remaining;
    currentZone = zoneAt(state.world, state.candidates.find(c => c.id === state.local_candidate_id).x).id;
  };
  function restartMatch(home = false, seed = config.prototype.seed) {
    simulation = new GameSimulation(config, seed, state.local_candidate_id, profile);
    resetPresentation(); simulationSpeed = 1; noticeRemaining = 0;
    debug.toggle(false); paused = home; help.hidden = true; input.clear(); clock.reset(); canvas.focus();
  }
  const debug = new DebugPanel(config, {
    state: () => state, queue, notify,
    speed: () => simulationSpeed,
    toggleSpeed: () => { const speeds = config.balance.debug.acceleration_multipliers; simulationSpeed = speeds[(speeds.indexOf(simulationSpeed) + 1) % speeds.length]; canvas.focus(); },
    speedFive: () => { simulationSpeed = 5; canvas.focus(); },
    saveTelemetry: () => {
      const url = URL.createObjectURL(new Blob([JSON.stringify(state.telemetry, null, 2)], { type: 'application/json' }));
      const link = document.createElement('a'); link.href = url; link.download = `resume-partie-${state.seed}.json`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    },
    save: () => {
      const blob = new Blob([simulation.exportSnapshot()], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a'); link.href = url; link.download = `presidentielles-${state.seed}-tick-${state.tick}.json`;
      link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
      notify('État de la partie exporté.');
    },
    load: async file => {
      try {
        const json = await file.text(); simulation.importSnapshot(json); resetPresentation();
        debug.seed.value = state.seed; canvas.focus(); notify('État restauré : positions, origines et timers conservés.');
      } catch (error) { notify(error.message, config.prototype.presentation.hint_seconds); }
    },
    restart: seed => {
      restartMatch(false, seed);
      notify(`Nouvelle partie · graine ${seed}`);
    },
  });
  function toggleHelp() {
    if (menu?.active || state.campaign_style_selection) return;
    help.hidden = !help.hidden; input.clear();
    if (help.hidden) canvas.focus();
    else { document.getElementById('resume').focus({ preventScroll: true }); help.scrollTop = 0; }
  }
  const input = new BrowserInput(canvas, human, async key => {
    if (menu?.active) return;
    if (!help.hidden) { if (['h', 'escape'].includes(key)) toggleHelp(); return; }
    if (!debateMatch && (state.campaign_style_selection || ['FIRST_ROUND_RESULTS', 'RESULTS'].includes(state.phase))) return;
    if (key === 'attack-cancel') { human.cancelAttack(); }
    else if (key === 'attack-press') { if (!paused) human.pressAttack(); }
    else if (key === 'attack-release') { if (!paused) human.releaseAttack(); }
    else if (key === 'arrowup') { if (!paused) human.jump(); }
    else if ([' ', 'j', 'attack'].includes(key)) { if (!paused) human.attack(); }
    else if (['ultimate', config.balance.special_charge.ultimate_key].includes(key)) {
      if (!paused) {
        const view = debateMatch ? debateState : state.phase === 'FIRST_ROUND_DEBATE' ? state.debate : state.campaign_events.find(e => e.debate && e.status === 'ACTIVE' && e.participants.includes(state.local_candidate_id))?.debate || state;
        const localId = debateMatch ? debateState.local_candidate_id : state.local_candidate_id;
        const reason = ultimateBlockedReason({ state: view, config }, view.candidates.find(c => c.id === localId));
        if (reason) notify(reason, 4); else human.ultimate();
      }
    }
    else if (key === 'dash-left' || key === 'dash-right') { if (!paused) human.dash(key === 'dash-left' ? -1 : 1); }
    else if (key === 'h') toggleHelp();
    else if (key === 'f3') { if (!session && !debateMatch) debug.toggle(); }
    else if (key === 'f') {
      try {
        if (document.fullscreenElement) await document.exitFullscreen();
        else await document.documentElement.requestFullscreen();
      } catch { notify('Le plein écran est indisponible dans ce navigateur.'); }
    } else if (!session && !debateMatch) debug.action(key);
  }, config.layout.visual_layout.camera_anchor_x_ratio, config.prototype.presentation.touch_pause_radius_ratio, config.balance.dash.double_tap_window_ms);
  const stylesDisplay = new CampaignStylesDisplay(config, profile, command => {
    if (menu?.active) return;
    if (paused && command.type === 'HoldCampaignStyle' && command.active) return;
    if (session && !session.host) { pending.push(command); return; }
    simulation.applyCommand(command); state = simulation.getState();
  }, () => { input.clear(); pending = []; clock.reset(); });
  document.getElementById('resume').addEventListener('click', toggleHelp);
  document.getElementById('help-home').addEventListener('click', () => returnHome());
  document.querySelectorAll('[data-help-tab]').forEach(button => button.addEventListener('click', () => {
    document.querySelectorAll('[data-help-tab]').forEach(tab => tab.setAttribute('aria-selected', String(tab === button)));
    document.querySelectorAll('[data-help-page]').forEach(page => { page.hidden = page.dataset.helpPage !== button.dataset.helpTab; });
  }));
  document.addEventListener('visibilitychange', () => {
    // A hidden local tab pauses the session clock, not off-camera entities.
    // The simulation itself has no document/window/camera dependency.
    wasHidden = true; input.clear(); clock.reset();
    if (!document.hidden) { previousTime = performance.now(); session?.resume?.(); }
    // The browser releases the wake lock with a hidden page: take it back on return.
    void keepScreenAwake();
  });
  // Closing the tab or leaving the page warns the other phones at once instead of
  // letting them wait for a time-out.
  window.addEventListener('pagehide', event => { if (!event.persisted && session) stopSession(); });
  // Help values follow the configuration too.
  const durationText = document.getElementById('balance-help');
  const format = number => number.toLocaleString('fr-FR', { maximumFractionDigits: 2 });
  document.getElementById('poll-help').textContent = `Sondage : restez devant un Institut et payez ${format(config.balance.buildings.institut_sondage.poll_cost)} k€. Il ne s’actualise pas tout seul.`;
  durationText.textContent = `Premier QG : ${format(config.balance.buildings.permanence.first_headquarters_capture_cost)} k€ et ${config.balance.buildings.permanence.required_presence_N1} soutiens présents. Financement : ${format(config.balance.buildings.financement.capture_cost)} k€. Un tract coûte ${format(config.balance.buildings.imprimerie.tract_cost_by_level[0])} k€. Au KO, ${format(config.balance.candidate_combat.ko_money_drop_ratio * 100)} % de l’argent en poche tombe au sol.`;
  function stopSession() {
    const oldSession = session; session = null; oldSession?.close(); remote.clear(); roomPhase = null; networkBusy = false; snapshots.reset();
    void keepScreenAwake();
  }
  function stopDebate() {
    debateMatch = null; debateState = null; debatePrevious = null; debatePending = []; debateRemoteIds = new Set();
    debateDisplay.hide(); document.body.classList.remove('debate-mode'); renderer.resetCamera(); sounds.reset();
  }
  /** Prépare un combat de débat : simulation, puis images des combattants choisis.
   * En multijoueur, chaque appareil prépare la même débat ; seul l’hôte la fait avancer. */
  async function prepareDebate(setup, onProgress = () => {}, multiplayer = null) {
    if (!multiplayer) stopSession();
    stopDebate();
    paused = true; help.hidden = true; input.clear(); human.reset(); debug.toggle(false); clock.reset();
    debateSetup = setup;
    debateMatch = new DebateMatch(config, { ...setup, seed: Math.floor(Math.random() * 2 ** 31) || 1 }, multiplayer ? null : profile);
    if (multiplayer) {
      debateMatch.state.local_candidate_id = multiplayer.localId;
      debateRemoteIds = new Set(debateFighterIds(setup.fighters).filter((id, i) => setup.fighters[i].player && id !== multiplayer.localId));
    }
    debateState = debateMatch.getState(); debatePrevious = debateState; debateDisplay.reset(); debateDisplay.multiplayer = !!multiplayer;
    const wanted = debateAssetIds(renderer.assets.manifest, setup);
    onProgress(0);
    let done = 0;
    await Promise.all(wanted.map(id => renderer.assets.load(id).then(() => onProgress(++done / wanted.length * 0.9))));
    // Un premier dessin révèle les dernières images utiles (poses, décor).
    drawDebateMode(renderer, debateState, debateState, 1, 0);
    await Promise.all([...renderer.assets.cache].filter(([, entry]) => !entry.ready).map(([id]) => renderer.assets.load(id)));
    drawDebateMode(renderer, debateState, debateState, 1, 0);
    onProgress(1);
  }
  function playDebate() {
    document.body.classList.add('debate-mode');
    play();
  }
  function returnHome() {
    stopDebate();
    paused = true; input.clear(); pending = []; clock.reset(); debug.toggle(false); help.hidden = true;
    void keepScreenAwake();
    matchDisplay.reset();
    stylesDisplay.state = null; stylesDisplay.dialog.close();
    menu.home();
  }
  async function prepare(candidateId, onProgress = () => {}) {
    stopDebate();
    paused = true; help.hidden = true; input.clear(); debug.toggle(false);
    stylesDisplay.profile = profile;
    // Décor de la carte : « biomes » pour tous ; le profil betatest peut en choisir un autre dans son profil.
    setMapDecor(decorForProfile(profile));
    simulation = new GameSimulation(config, config.prototype.seed, candidateId, profile);
    if (session) simulation.state.human_candidate_ids = session.room.players.map(p => `candidate:${p.faction}`);
    resetPresentation(); simulationSpeed = 1; noticeRemaining = 0;
    renderer.artZone = null;
    renderer.draw(state, state, 1, 0);
    const ids = [...renderer.assets.protectedIds];
    let timeout, finished = false, restartTimeout;
    onProgress(0);
    try {
      await Promise.race([
        new Promise((_, reject) => {
          restartTimeout = () => {
            clearTimeout(timeout);
            timeout = setTimeout(() => reject(new Error('Le chargement ne progresse plus. Vérifiez votre connexion et réessayez.')), 30000);
          };
          restartTimeout();
        }),
        renderer.assets.loadRequired(ids, ratio => {
          if (finished) return;
          restartTimeout(); onProgress(ratio * .95);
        }),
      ]);
      // Prepare the first complete frame behind the loading screen. In
      // particular, texture uploads must not become simulation catch-up time.
      // Chaque image est envoyée une fois à la carte graphique derrière l’écran de chargement :
      // sinon ce transfert se fait au premier affichage, en pleine partie (à-coups).
      const ready = [...renderer.assets.cache.values()].filter(entry => entry.ready).map(entry => entry.image);
      for (let i = 0; i < ready.length; i += 6) {
        renderer.ctx.save(); renderer.ctx.setTransform(1, 0, 0, 1, 0, 0);
        for (const image of ready.slice(i, i + 6)) renderer.ctx.drawImage(image, 0, 0, 1, 1);
        renderer.ctx.restore();
        await new Promise(resolve => requestAnimationFrame(resolve));
      }
      renderer.draw(state, state, 1, 0);
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      onProgress(1);
    } finally { finished = true; clearTimeout(timeout); }
  }
  function play() { snapshots.reset(); paused = false; help.hidden = true; clock.reset(); input.clear(); previousTime = performance.now(); canvas.focus(); void keepScreenAwake(); }
  function roomChanged(room) {
    if (!session) return;
    if (room.phase === 'pairing') {
      showPeerAnswer(menu, session, returnHome);
    } else if (room.phase === 'lobby') {
      // Retour à la sélection après un débat : on quitte le plateau, le salon reste connecté.
      if (roomPhase === 'playing' || roomPhase === 'loading') { stopDebate(); paused = true; input.clear(); }
      updateLobby(menu, session, returnHome);
    } else if (room.phase === 'loading' && roomPhase !== 'loading') {
      if (room.mode === 'debate') {
        void menu.debateLoading(room.debate, { multiplayer: { localId: debateFighterOf(room.debate, session.id), ready: () => session.request('ready') } });
      } else {
        menu.selected = session.candidateId.split(':')[1];
        void menu.loading({ multiplayer: true, ready: () => session.request('ready') });
      }
    } else if (room.phase === 'playing') {
      if (roomPhase !== 'playing') { menu.close(); if (debateMatch) playDebate(); else play(); }
      if (debateMatch) {
        const votes = room.rematch || [];
        debateDisplay.setRematch({ voted: votes.includes(session.id) || debateDisplay.rematch.voted, waiting: votes.filter(id => id !== session.id).length });
      }
      const changed = paused !== room.paused;
      paused = room.paused;
      void keepScreenAwake();
      if (changed) { input.clear(); clock.reset(); remote.clear(); pending = []; canvas.focus(); }
    }
    roomPhase = room.phase;
  }
  async function connectRoom(action, data) {
    const generation = menu.generation;
    const Session = data.transport === 'direct' ? PeerSession : data.transport === 'online' ? OnlineSession : MultiplayerSession;
    const nextSession = new Session({
      room: roomChanged,
      commands: packet => {
        if (!session?.host || paused) return;
        const player = session.room.players.find(p => p.id === packet.playerId);
        if (!player) return;
        const id = debateMatch ? debateFighterOf(session.room.debate, player.id) : `candidate:${player.faction}`;
        const controller = remote.get(id) || { axis: 0, actions: [], seen: 0 };
        controller.seen = performance.now();
        for (const command of packet.commands) {
          if (command.type === 'Move') controller.axis = command.axis;
          else if (!['SetCampaignActive', 'InteractionPresence'].includes(command.type)) controller.actions.push({ ...command, candidateId: id });
        }
        controller.actions = controller.actions.slice(-30); remote.set(id, controller);
      },
      snapshot: snapshot => {
        if (!session || session.host || menu.active) return;
        const now = performance.now() / 1000;
        if (debateMatch) { snapshots.push({ ...snapshot, local_candidate_id: debateState.local_candidate_id }, now); return; }
        if (snapshot.multiplayer_profile) stylesDisplay.profile = snapshot.multiplayer_profile;
        const latest = snapshots.latest;
        // Changement de phase : l’ancien état ne doit pas se mélanger au nouveau.
        if (latest && latest.phase !== snapshot.phase) { snapshots.reset(); input.clear(); renderer.resetCamera(); }
        snapshots.push({ ...snapshot, local_candidate_id: session.candidateId }, now);
      },
      ended: message => {
        // Combat de débat terminé : on garde l’écran des résultats, la connexion n’est plus utile.
        if (debateState?.phase === 'OVER') { stopSession(); debateDisplay.setRematch({ closed: 'Adversaire parti' }); return; }
        returnHome(); menu.page('disconnected', 'La partie a été interrompue.', '<p id="disconnect-message" class="menu-intro" role="alert"></p><button id="back-to-home" class="menu-primary">Retour à l’accueil</button>');
        menu.element.querySelector('#disconnect-message').textContent = message;
        menu.element.querySelector('#back-to-home').onclick = () => menu.home();
      },
    }, state.config_fingerprint);
    try { await nextSession.connect(action, data); } catch (error) { nextSession.close(); throw error; }
    if (menu.generation !== generation || data.signal?.aborted) { nextSession.close(); return; }
    session = nextSession; roomChanged(session.room); void keepScreenAwake();
  }
  menu = new StartMenu({ prepare, play, audio, account, combat: config.balance.candidate_combat, multiplayer: (current, mode) => showMultiplayerSetup(current, connectRoom, mode),
    debate: { config, prepare: prepareDebate, play: playDebate } });
  menu.leave = stopSession;
  window.matchMedia('(any-pointer: coarse) and (max-width: 600px) and (orientation: portrait)').addEventListener('change', () => input.clear());
  if (['salon', 'en-ligne'].some(key => new URLSearchParams(location.search).has(key))) void showMultiplayerSetup(menu, connectRoom);

  function matchCommands() {
    if (['FIRST_ROUND_RESULTS', 'RESULTS'].includes(state.phase)) return [];
    if (!session) return collectCommands(state, human, ai);
    return state.candidates.filter(c => !c.eliminated).flatMap(candidate => {
      if (candidate.id === state.local_candidate_id) return human.commands(state, candidate.id);
      if (!state.human_candidate_ids.includes(candidate.id)) return ai.commands(state, candidate.id);
      const controller = remote.get(candidate.id);
      const recent = controller && performance.now() - controller.seen < 1000;
      const commands = [{ type: 'Move', candidateId: candidate.id, axis: recent ? controller.axis : 0 }, { type: 'InteractionPresence', candidateId: candidate.id, active: true }, { type: 'SetCampaignActive', candidateId: candidate.id, active: true }, ...(recent ? controller.actions.splice(0) : [])];
      if (!recent) commands.push({ type: 'CancelAttack', candidateId: candidate.id }, { type: 'HoldCampaignStyle', candidateId: candidate.id, active: false });
      return commands;
    });
  }

  function networkFrame(elapsed) {
    if (!session || menu.active || session.room.phase !== 'playing') return;
    networkElapsed += elapsed;
    if (networkBusy) return;
    const activeSession = session;
    const send = (action, data) => {
      networkBusy = true;
      // A single lost frame is not fatal: heartbeats and connection states decide.
      session.request(action, data).catch(error => { if (!error.transient) activeSession.fail(error.message); }).finally(() => { networkBusy = false; });
    };
    if (session.host) {
      // Débat : 20 états par seconde (combat rapide, état léger) ; campagne : 15.
      if (networkElapsed < (debateMatch ? 0.05 : 1 / 15)) return;
      networkElapsed = 0;
      send('snapshot', { state: debateMatch ? debateState : { ...state, multiplayer_profile: profile } });
      return;
    }
    if (paused) return;
    // Invité : les commandes partent dès qu’une touche change (moins de délai), et seulement
    // un signe de vie 4 fois par seconde quand rien ne bouge (moins de données).
    const commands = outgoingCommands(debateMatch ? [...human.commands(debateState, debateState.local_candidate_id), ...debatePending.splice(0)] : [...human.commands(state, session.candidateId), ...pending.splice(0)]);
    const axis = commands.find(c => c.type === 'Move')?.axis ?? 0;
    if (axis === sentAxis && networkElapsed < 0.25 && !commands.some(c => c.type !== 'Move')) return;
    networkElapsed = 0; sentAxis = axis;
    send('commands', { commands });
  }

  /** Boutons tactiles de combat : jauge d’ultime et charge du coup. */
  function updateCombatButtons(combatView, fighter) {
    const ultimateButton = document.getElementById('ultimate-touch');
    const ratio = Math.max(0, Math.min(1, fighter.special_charge / config.balance.special_charge.required_points));
    ultimateButton.hidden = ratio <= 0; ultimateButton.disabled = !!ultimateBlockedReason({ state: combatView, config }, fighter);
    const heldTicks = fighter.combat.press_tick == null ? 0 : combatView.tick - fighter.combat.press_tick;
    const chargeRatio = fighter.combat.charge_active ? Math.min(1, heldTicks / (config.balance.candidate_combat.charge_ready_seconds * config.balance.simulation_architecture.fixed_tick_hz)) : 0;
    const attackButton = document.getElementById('attack-touch');
    attackButton.classList.toggle('charging', chargeRatio > 0);
    attackButton.style.setProperty('--focus', `${chargeRatio * 100}%`);
    setText(attackButton, chargeRatio >= 1 ? 'Prête !' : chargeRatio > 0 ? 'Charge…' : 'Frapper');
    ultimateButton.classList.toggle('ready', ratio >= 1);
    ultimateButton.style.setProperty('--charge', `${ratio * 100}%`);
    ultimateButton.setAttribute('aria-label', `Ultime : ${Math.round(ratio * 100)} %${ratio >= 1 ? ', prêt' : ''}`);
    document.getElementById('bardella-armed').hidden = !fighter.bardella_guardian_armed;
  }

  /** Commandes d’un joueur distant en débat ; sans nouvelles depuis 1 s, son combattant s’arrête. */
  function remoteDebateCommands(id) {
    const controller = remote.get(id);
    const recent = controller && performance.now() - controller.seen < 1000;
    return [{ type: 'SetCampaignActive', candidateId: id, active: true }, { type: 'Move', candidateId: id, axis: recent ? controller.axis : 0 },
      ...(recent ? controller.actions.splice(0) : [{ type: 'CancelAttack', candidateId: id }])];
  }

  /** Invité : l’état affiché est pris dans le tampon, avec un léger retard constant. */
  function guestView() {
    const now = performance.now() / 1000;
    const fresh = snapshots.sample(now, { fresh: true }), view = snapshots.sample(now);
    if (!view) return;
    const alpha = Math.max(0, Math.min(1, view.alpha));
    let shown = view.state, before = view.previous;
    // Son propre personnage vient de la tête de lecture la plus récente : ses gestes
    // s’affichent plus tôt. Les autres restent sur l’affichage tamponné, bien fluide.
    const id = shown.local_candidate_id, mine = fresh && fresh.state.candidates.find(c => c.id === id);
    if (mine && shown.candidates.some(c => c.id === id)) {
      const old = fresh.previous.candidates.find(c => c.id === id) || mine, t = Math.max(0, Math.min(1, fresh.alpha));
      const lerp = (a, b) => a + (b - a) * t;
      // Campagne : le monde est circulaire, on passe par le plus court chemin.
      const length = shown.world?.length, x = debateMatch || !length ? lerp(old.x, mine.x) : wrap(old.x + ringDelta(old.x, mine.x, length) * t, length);
      const local = { ...mine, x, combat: mine.combat && { ...mine.combat, height: lerp(old.combat?.height ?? 0, mine.combat.height ?? 0) } };
      // Même objet avant et après : l’interpolation de l’affichage le laisse en place.
      const swap = list => list.map(c => c.id === id ? local : c);
      shown = { ...shown, candidates: swap(shown.candidates) };
      before = { ...before, candidates: swap(before.candidates) };
    }
    if (debateMatch) { debateState = shown; debatePrevious = before; } else { state = shown; previous = before; }
    guestAlpha = alpha;
  }

  /** Une image du mode Débat : simulation à pas fixe, puis affichage. */
  function debateFrame(elapsed, now) {
    const halted = paused || !help.hidden || document.hidden;
    // Un invité ne simule pas : il affiche les états envoyés par l’hôte.
    const guest = session && !session.host;
    if (guest) guestView();
    if (!halted && !guest) {
      clock.advance(Math.min(elapsed, config.prototype.presentation.max_presentation_frame_seconds), () => {
        debatePrevious = debateState;
        const localId = debateState.local_candidate_id;
        const commands = debateState.candidates.flatMap(c => c.id === localId ? human.commands(debateState, c.id) : debateRemoteIds.has(c.id) ? remoteDebateCommands(c.id) : debateModeAICommands(debateState, config, c.id));
        debateMatch.step([...commands, ...debatePending.splice(0)]);
        debateState = debateMatch.getState();
      });
    }
    networkFrame(elapsed);
    const fighter = debateState.candidates.find(c => c.id === debateState.local_candidate_id);
    const alpha = halted ? 1 : guest ? guestAlpha : clock.alpha;
    debateDisplay.update(debateState, halted ? 0 : elapsed);
    damageFeedback.update(debateState, fighter, alpha, halted || debateState.phase === 'OVER');
    updateCombatButtons(debateState, fighter);
    const controls = document.getElementById('touch-controls');
    controls.hidden = halted || debateState.phase === 'OVER' || fighter.is_ko;
    sounds.update(debateState, { paused: halted });
    setText(notice, ''); notice.hidden = true;
    drawDebateMode(renderer, debateState, halted ? debateState : debatePrevious, alpha, halted ? 0 : Math.min(elapsed, config.prototype.presentation.max_presentation_frame_seconds));
  }

  function frame(now) {
    try {
      let elapsed = Math.max(0, (now - previousTime) / 1000);
      previousTime = now;
      if (wasHidden) { elapsed = 0; wasHidden = false; }
      if (menu.active) { sounds.update(state, { menu: true }); requestAnimationFrame(frame); return; }
      if (debateMatch) { debateFrame(elapsed, now); requestAnimationFrame(frame); return; }
      if (session && !session.host) guestView();
      if (!paused && !document.hidden && (!session || session.host)) {
        const frameStart = state;
        let changedCamera = false;
        // Après un ralentissement, on rattrape au plus max_presentation_frame_seconds :
        // un appareil lent ne s’enfonce pas dans une avalanche de ticks.
        clock.advance(Math.min(elapsed, config.prototype.presentation.max_presentation_frame_seconds) * simulationSpeed, () => {
          // Plusieurs ticks dans la même image : seuls les deux derniers états sont copiés
          // pour l’affichage. Entre-temps, les contrôleurs lisent l’état vivant sans le modifier.
          const lastTick = clock.accumulator + 1e-10 < 2 * clock.dt;
          const commands = [...matchCommands(), ...pending];
          changedCamera ||= pending.some(c => ['DebugSelectCandidate', 'DebugTeleport', 'DebugTeleportTarget'].includes(c.type));
          pending = [];
          if (lastTick) previous = state === simulation.state ? simulation.getState({ presentation: true }) : state;
          simulation.step(commands);
          state = lastTick ? simulation.getState({ presentation: true }) : simulation.state;
        });
        if (state !== frameStart) {
          const rejected = state.events.findLast(e => e.type === 'CampaignEventRejected' && e.tick >= frameStart.tick);
          if (rejected && !frameStart.events.some(e => e.id === rejected.id)) notify(rejected.reason, 4);
          if (state.phase !== frameStart.phase) { previous = state; renderer.resetCamera(); input.clear(); noticeRemaining = 0; }
          if (changedCamera) { previous = state; renderer.resetCamera(); input.clear(); }
        }
      }
      if (!paused && !document.hidden) { noticeRemaining -= elapsed; }
      networkFrame(elapsed);
      matchDisplay.update(state);
      campaignDisplay.update(state);
      stylesDisplay.update(state);
      const waiting = session && state.campaign_style_selection && state.campaign_style_selection.candidate_id !== state.local_candidate_id;
      const networkStatus = document.getElementById('network-status'); networkStatus.hidden = !waiting;
      if (waiting) networkStatus.textContent = 'Un autre joueur choisit son style. La campagne reprendra dès qu’il aura terminé.';
      document.body.classList.toggle('campaign-studio', state.campaign_events.some(e => e.status === 'ACTIVE' && e.debate && e.participants.includes(state.local_candidate_id)));
      const candidate = matchDisplay.viewedCandidate(state);
      const combatView = state.phase === 'FIRST_ROUND_DEBATE' ? state.debate : state.campaign_events.find(e => e.debate && e.status === 'ACTIVE' && e.participants.includes(state.local_candidate_id))?.debate || state;
      const fighter = combatView.candidates.find(c => c.id === state.local_candidate_id);
      damageFeedback.update(combatView, fighter, paused ? 1 : clock.alpha, paused || !!state.campaign_style_selection || ['FIRST_ROUND_RESULTS', 'RESULTS'].includes(state.phase) || state.candidates.find(c => c.id === state.local_candidate_id).eliminated);
      updateCombatButtons(combatView, fighter);
      const zone = zoneAt(state.world, candidate.x);
      if (zone.id !== currentZone) { currentZone = zone.id; notify(`${zone.biome_name}\n${zone.concept}`); }
      if (state.days_remaining !== currentDay) {
        currentDay = state.days_remaining;
        if (config.balance.display.show_day_change_flash) notify(`J-${currentDay}`, config.prototype.presentation.day_flash_seconds);
      }
      moneyCounter.update(candidate.money, candidate.id, elapsed);
      const local = state.candidates.find(c => c.id === state.local_candidate_id);
      const inCombat = state.phase === 'CAMPAIGN' && !!local && !local.eliminated && combatMusic.active(local, state, config);
      sounds.update(state, { paused: paused || !help.hidden, combat: inCombat });
      if (state.phase === 'RESULTS' && !resultRecorded) {
        resultRecorded = true;
        account.save(recordMatchResult(profile, state, { multiplayer: !!session }));
      }
      funds.hidden = !['CAMPAIGN', 'SECOND_ROUND_SPRINT'].includes(state.phase) || state.candidates.find(c => c.id === state.local_candidate_id).eliminated;
      document.getElementById('touch-controls').hidden = paused || !!state.campaign_style_selection || ['FIRST_ROUND_RESULTS', 'RESULTS'].includes(state.phase) || state.candidates.find(c => c.id === state.local_candidate_id).eliminated;
      if (noticeRemaining <= 0) setText(notice, '');
      notice.hidden = ['FIRST_ROUND_RESULTS', 'RESULTS'].includes(state.phase);
      const viewState = candidate.id === state.local_candidate_id ? state : { ...state, local_candidate_id: candidate.id };
      const renderAlpha = session && !session.host ? guestAlpha : clock.alpha;
      electoralDisplay.update(state, candidate, interpolatedPlayerX(viewState, paused ? viewState : previous, candidate, paused ? 1 : renderAlpha));
      renderer.draw(viewState, paused ? viewState : previous, paused ? 1 : renderAlpha, Math.min(elapsed, config.prototype.presentation.max_presentation_frame_seconds), debug.visible);
      debugElapsed += elapsed;
      if (debugElapsed >= config.prototype.debug.refresh_seconds) { debug.update(state, elapsed > 0 ? 1 / elapsed : 0); debugElapsed = 0; }
      requestAnimationFrame(frame);
    } catch (error) { showError(error, true); }
  }
  requestAnimationFrame(frame);
}

installLandscape();
start().catch(showError);
