import { DamageFeedbackDisplay } from './presentation/effets/damage-feedback.js';
import { CampaignStylesDisplay } from './presentation/interface/campaign-styles.js';
import { ultimateBlockedReason } from './simulation/combat.js';
import { pendingSatchel } from './simulation/minor-ultimate-catalog.js';
import { loadCampaignProfile, saveCampaignProfile } from './presentation/menus/campaign-profile.js';
import { CampaignDisplay } from './presentation/interface/campaign.js';
import { loadConfig } from './config.js';
import { formatCarriedMoney } from './presentation/carte/money.js';
import { warmNumberFormats } from './presentation/interface/number-format.js';
import { MoneyCounter } from './presentation/interface/money-counter.js';
import { GameAudio, SoundDirector } from './presentation/interface/audio.js';
import { InterstitialAds } from './presentation/menus/ads.js';
import { CombatPoseTracker } from './presentation/personnages/melenchon-combat.js';
import { recordMatchResult } from './presentation/menus/player-profile.js';
import { playerCard, rememberTitle, setCandidateColors } from './presentation/menus/player-card.js';
import { clearKnockoutReveals, showKnockoutReveal } from './presentation/interface/knockout-reveal.js';
import { RespawnCountdown } from './presentation/interface/respawn-countdown.js';
import { CampaignIntroScene } from './presentation/interface/campaign-intro.js';
import { CampaignObjectives } from './presentation/interface/campaign-objectives.js';
import { guardGameZoom } from './presentation/interface/zoom-guard.js';
import { titleName } from './simulation/player-titles.js';
import { GameSimulation } from './simulation/game-simulation.js';
import { warmUpSimulation } from './simulation/warm-up.js';
import { FixedClock, catchUpTicks } from './simulation/fixed-clock.js';
import { AIController, LocalHumanController, collectCommands, prepareAICommands } from './simulation/controllers.js';
import { withAIObservation } from './simulation/ai-observation.js';
import { zoneAt, ringDelta, wrap } from './simulation/world.js';
import { WorldRenderer } from './presentation/rendu/renderer.js';
import { setHidden, setClass, setStyle, setAttribute } from './presentation/interface/dom-updates.js';
import { ultimateGlow } from './presentation/interface/ultimate-pulse.js';
import { preparedDrawingSources } from './presentation/personnages/minor-sprite-images.js';
import { BrowserInput } from './presentation/interface/input.js';
import { DebugPanel } from './presentation/debogage/debug.js';
import { ElectoralDisplay } from './presentation/carte/electoral.js';
import { interpolatedPlayerX } from './presentation/rendu/player-position.js';
import { MatchDisplay } from './presentation/debat/match.js';
import { StartMenu } from './presentation/menus/start-menu.js';
import { showLegalNotice, warmUpBehindNotice } from './presentation/menus/legal-notice.js';
import { warmElectionPortraits } from './presentation/menus/election-results.js';
import { worldAssetIds } from './presentation/carte/illustrated-world.js';
import { installLandscape } from './presentation/interface/landscape.js';
import { SceneTransitions, campaignScene } from './presentation/interface/transitions.js';
import { MultiplayerSession, showMultiplayerSetup, updateLobby, showPeerAnswer } from './presentation/multijoueur/multiplayer.js';
import { PeerSession } from './network/peer-session.js';
import { OnlineSession } from './network/online-session.js';
import { outgoingCommands } from './network/shared-commands.js';
import { SnapshotBuffer } from './network/snapshot-buffer.js';
import { DebatePrediction, DebateHost } from './network/debate-prediction.js';
import { InputSender, InputTimeline } from './network/input-timeline.js';
import { CampaignPrediction } from './network/campaign-prediction.js';
import { DebateMatch, debateModeAICommands, debateFighterIds } from './simulation/debate-mode.js';
import { DebateModeDisplay, debateAssetIds, drawDebateMode } from './presentation/debat/debate-mode.js';
import { APP_BUILD } from './app-build.js';
import { shouldDrawFrame } from './presentation/rendu/frame-cadence.js';
import { AccountClient } from './network/account-api.js';
import { accountsConfigured } from './network/auth-providers.js';
import { RankedMatches, campaignPlacements, campaignKnockouts, debatePlacements } from './network/ranked-match.js';
import { requireAccount, showAccountToast, decorateProfile } from './presentation/comptes/account-screens.js';
import { applyAccountProgress, addDeviceUnlocks, unlockNames } from './presentation/comptes/account-progress.js';
import { campaignMinSeconds, earnedUnlocks, profileUnlockIds, unlockOffer, unlocksToProfile } from './simulation/unlock-catalog.js';
import { openUnlockChoice } from './presentation/menus/unlock-choice.js';

// L'horloge du jeu démarre un peu avant celle du serveur (temps de la requête) : marge avant de proposer une pub.
const RUN_CLOCK_MARGIN_SECONDS = 10;

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
  const config = await loadConfig();
  const profile = loadCampaignProfile();
  try { saveCampaignProfile(profile); } catch { console.warn('Le profil ne peut pas être enregistré dans ce navigateur.'); }
  // Le profil reste le même objet : les simulations et l'écran des styles gardent leur référence.
  const account = {
    get: () => profile,
    save: patch => { Object.assign(profile, patch); try { Object.assign(profile, saveCampaignProfile(profile)); } catch { /* Stockage indisponible : gardé pour cette session. */ } },
  };
  // Compte PartageTonJeu (facultatif) : jamais demandé au lancement ni pour le solo.
  const accounts = new AccountClient({ platform: globalThis.PTJNativeAuth?.platform?.() || (APP_BUILD ? 'android' : 'web') });
  const syncProgress = () => { applyAccountProgress(profile, accounts); account.save({}); };
  accounts.onChange(syncProgress); syncProgress();
  // Session retrouvée : le profil du compte se met à jour en arrière-plan (hors ligne, la copie locale sert).
  void accounts.refresh().catch(() => {});
  const ranked = new RankedMatches(accounts, { notify: showAccountToast });
  // Campagne solo d'un joueur connecté, déclarée au serveur pour valider les déblocages en fin de partie.
  let soloRun = null;
  // Écran « Choisis ton candidat » de la fin de campagne solo, tant qu'il n'est pas refermé.
  let unlockChoice = null;
  const audio = new GameAudio();
  // Le navigateur n'autorise le son qu'après un geste de l'utilisateur.
  for (const type of ['pointerdown', 'keydown', 'touchend']) document.addEventListener(type, () => audio.unlock(), { capture: true, passive: true });
  guardGameZoom();
  document.addEventListener('click', event => { if (event.target.closest?.('#start-menu button, #results button, #campaign-styles button, .unlock-choice button')) audio.play('ui'); }, true);
  const sounds = new SoundDirector(audio, config.balance.simulation_architecture.fixed_tick_hz);
  // Pub plein écran au clic de fin de partie, en solo seulement (voir docs/publicites.md).
  const ads = new InterstitialAds({ audio });
  // Même détection que la garde dessinée à l'écran, pour passer à la musique de combat.
  const combatMusic = new CombatPoseTracker();
  let resultRecorded = false;
  // K.-O. déjà annoncés pendant cette partie (un seul message par candidat).
  let knockoutsSeen = 0; const announcedKnockouts = new Set();
  let simulation = new GameSimulation(config, config.prototype.seed, 'candidate:melenchon', profile);
  let state = simulation.getState();
  let previous = state;
  const clock = new FixedClock(config.balance.simulation_architecture.fixed_tick_hz);
  const human = new LocalHumanController();
  human.onInput = () => pullTick();
  const ai = new AIController(config);
  const canvas = document.getElementById('world');
  const renderer = new WorldRenderer(canvas, config);
  // Pendant l'avertissement, les images de la campagne se chargent déjà en arrière-plan.
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
    // Choix du candidat à débloquer : étape du parcours entre les résultats et le bilan.
    beforeSummary: openSummary => {
      if (!unlockChoice) return false;
      unlockChoice.reveal();
      unlockChoice.next = openSummary;
      return true;
    },
    replay: () => {
      if (session) { returnHome(); return; }
      if (unlockChoice) { unlockChoice.reveal(); return; }
      void ads.afterGame('campaign', () => { menu.selected = state.local_candidate_id.split(':')[1]; void menu.loading(); });
    },
    // Quitter après le 1er tour est un abandon : pas de pub.
    return: () => {
      if (session || state.phase !== 'RESULTS') returnHome();
      else if (unlockChoice) unlockChoice.reveal();
      else void ads.afterGame('campaign', returnHome);
    },
  });
  const money = document.getElementById('money');
  const funds = document.getElementById('funds');
  const moneyCounter = new MoneyCounter(money, formatCarriedMoney);
  const notice = document.getElementById('notice');
  let pending = [];
  let paused = true;
  let wakeLock = null;
  let wakePending = false;
  // In multiplayer the screen stays on in the lobby too:
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
  // Hôte en campagne : ligne du temps des pas de chaque invité (voir input-timeline.js).
  let remote = new Map(), campaignFrame = 0;
  let networkElapsed = 0;
  let networkBusy = false;
  let sentTick = null;
  // Invité : les états de l’hôte passent par un tampon pour un affichage fluide malgré la 4G.
  const snapshots = new SnapshotBuffer(1 / config.balance.simulation_architecture.fixed_tick_hz);
  let guestAlpha = 1;
  let simulationSpeed = 1;
  let wasHidden = false;
  let noticeRemaining = 0;
  let previousTime = performance.now();
  let lastDrawnTime = -Infinity;
  let stepped = false; // un pas de simulation joué pendant cette image
  let debugElapsed = 0;
  // Transitions de la campagne : rideau entre carte et débats, « Place au vote… » avant les résultats.
  const transitionSettings = config.prototype.presentation.transitions;
  const transitions = new SceneTransitions(transitionSettings);
  const curtain = document.getElementById('phase-fade'), voteInterlude = document.getElementById('vote-interlude');
  // K.-O. en campagne : monde en gris et décompte avant la réapparition.
  const respawnCountdown = new RespawnCountdown(document.getElementById('game'), canvas, config.balance.simulation_architecture.fixed_tick_hz);
  // Scène d'ouverture de la Campagne, puis post-it des objectifs (deux premières parties du joueur).
  const introSettings = config.prototype.campaign_intro;
  const objectives = new CampaignObjectives(document.getElementById('game'), { farewellSeconds: introSettings.objectives_farewell_seconds });
  const introScene = new CampaignIntroScene(document.getElementById('game'), config, {
    renderer, wheel: () => electoralDisplay.wheel, play: cue => audio.play(cue),
    ended: () => {
      // Une partie de plus avec la scène : consignes et objectifs ne reviennent qu'aux deux premières.
      account.save({ campaign_intro_seen: (profile.campaign_intro_seen || 0) + 1 });
      // L'horloge des animations repasse au temps de la campagne : les suivis de poses repartent de zéro.
      renderer.resetCamera();
      enterHud();
    },
  });
  voteInterlude.style.setProperty('--vote', `${transitionSettings.vote_seconds}s`);
  sounds.resultsLead = transitionSettings.vote_seconds;
  const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
  const reducedMotion = () => motionPreference.matches;
  // sceneFreeze : le décor change (solo) ; arrivalRemaining : le menu s'efface encore (solo).
  let sceneFreeze = false, arrivalRemaining = 0;
  let currentZone = zoneAt(state.world, state.candidates[0].x).id;
  let currentDay = state.days_remaining;
  // Mode Débat : combat autonome, sans monde de campagne.
  let debateMatch = null, debateState = null, debatePrevious = null, debatePending = [], debateSetup = null;
  // Invité en débat : son téléphone fait avancer le combat sans attendre l’hôte (voir debate-prediction.js).
  let prediction = null;
  // Hôte d'un débat multijoueur : pas numérotés des invités et retours en arrière.
  let debateHost = null, hostFrameSeen = 0;
  // Invité : n'envoie ses pas que s'ils changent, plus un signe de vie 5 fois par seconde.
  const inputSender = new InputSender();
  // Invité en campagne : son candidat se déplace dès l'appui (voir campaign-prediction.js).
  let campaignPrediction = null;
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
      void ads.afterGame('debate', () => { if (debateSetup) void menu.debateLoading(debateSetup); });
    },
    setup: () => {
      // Multijoueur : tout le salon revient à la sélection, connexion conservée.
      if (session) { session.request('lobby').catch(() => debateDisplay.setRematch({ closed: 'Indisponible' })); return; }
      void ads.afterGame('debate', () => { returnHome(); menu.debate(); });
    },
    home: () => { if (session) returnHome(); else void ads.afterGame('debate', returnHome); },
  });

  const notify = (text, seconds = config.prototype.presentation.zone_flash_seconds) => { notice.textContent = text; noticeRemaining = seconds; };
  const queue = command => { pending.push(command); canvas.focus(); };
  const resetPresentation = () => {
    state = simulation.getState(); previous = state; pending = []; clock.reset(); input.clear(); renderer.resetCamera();
    transitions.reset(); sceneFreeze = false; curtain.style.opacity = 0; voteInterlude.hidden = true; matchDisplay.resultsHeld = false;
    matchDisplay.reset(); moneyCounter.reset(); sounds.reset(); combatMusic.clear();
    // Une partie importée déjà terminée ne compte pas dans les statistiques du profil.
    resultRecorded = state.phase === 'RESULTS';
    knockoutsSeen = state.knockouts?.length ?? 0; announcedKnockouts.clear(); clearKnockoutReveals();
    introScene.stop(); objectives.reset(false);
    currentDay = state.days_remaining;
    currentZone = zoneAt(state.world, state.candidates.find(c => c.id === state.local_candidate_id).x).id;
  };
  function restartMatch(home = false, seed = config.prototype.seed) {
    simulation = new GameSimulation(config, seed, state.local_candidate_id, profile);
    resetPresentation(); simulationSpeed = 1; noticeRemaining = 0;
    debug.toggle(false); paused = home; input.clear(); clock.reset(); canvas.focus();
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
      const link = document.createElement('a'); link.href = url; link.download = `presidentielle-${state.seed}-tick-${state.tick}.json`;
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
  const input = new BrowserInput(canvas, human, async key => {
    if (menu?.active) return;
    if (!debateMatch && (state.campaign_style_selection || ['FIRST_ROUND_RESULTS', 'RESULTS'].includes(state.phase))) return;
    // Scène d'ouverture (deux premières parties) : le coup attend la consigne « Frapper ».
    if (!debateMatch && ['attack-press', 'attack-release', ' ', 'j', 'attack'].includes(key) && introScene.blocksAttack(state)) return;
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
    else if (key === 'f3') {
      if (!session && !debateMatch) debug.toggle();
      // Outils de débogage (accélération, triche) : cette partie ne débloquera rien sur le compte.
      if (debug.visible && soloRun) soloRun.tainted = true;
    }
    else if (key === 'f') {
      try {
        if (document.fullscreenElement) await document.exitFullscreen();
        else await document.documentElement.requestFullscreen();
      } catch { notify('Le plein écran est indisponible dans ce navigateur.'); }
    } else if (!session && !debateMatch) debug.action(key);
  }, config.layout.visual_layout.camera_anchor_x_ratio, config.prototype.presentation.touch_pause_radius_ratio, { keyboard: config.balance.dash.double_tap_window_ms,
    touch: config.balance.dash.touch_double_tap_window_ms, maxHold: config.balance.dash.double_tap_max_hold_ms });
  const stylesDisplay = new CampaignStylesDisplay(config, profile, command => {
    if (menu?.active) return;
    if (paused && command.type === 'HoldCampaignStyle' && command.active) return;
    if (session && !session.host) { pending.push(command); return; }
    simulation.applyCommand(command); state = simulation.getState();
  }, () => { input.clear(); pending = []; clock.reset(); });
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
  function stopSession() {
    const oldSession = session; session = null; oldSession?.close(); remote.clear(); roomPhase = null; networkBusy = false; snapshots.reset(); campaignPrediction = null;
    void keepScreenAwake();
  }
  function stopDebate() {
    debateMatch = null; debateState = null; debatePrevious = null; debatePending = []; debateRemoteIds = new Set(); prediction = null; debateHost = null;
    debateDisplay.hide(); document.body.classList.remove('debate-mode'); renderer.resetCamera(); sounds.reset();
  }
  /** Prépare un combat de débat : simulation, puis images des combattants choisis.
   * En multijoueur, chaque appareil prépare la même débat ; seul l’hôte la fait avancer. */
  async function prepareDebate(setup, onProgress = () => {}, multiplayer = null) {
    if (!multiplayer) stopSession();
    stopDebate();
    paused = true; input.clear(); human.reset(); debug.toggle(false); clock.reset();
    debateSetup = setup;
    debateMatch = new DebateMatch(config, { ...setup, seed: Math.floor(Math.random() * 2 ** 31) || 1 }, multiplayer ? null : profile);
    if (multiplayer) {
      debateMatch.state.local_candidate_id = multiplayer.localId;
      debateRemoteIds = new Set(debateFighterIds(setup.fighters).filter((id, i) => setup.fighters[i].player && id !== multiplayer.localId));
      if (session && !session.host) prediction = new DebatePrediction(debateMatch, multiplayer.localId);
      else debateHost = new DebateHost(debateMatch, { localId: multiplayer.localId, remoteIds: debateRemoteIds });
      inputSender.reset(); campaignPrediction = null; hostFrameSeen = 0;
      // Revanche : les pas numérotés repartent de 1, les files de l’hôte aussi.
      remote.clear();
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
    paused = true; input.clear(); pending = []; clock.reset(); debug.toggle(false);
    void keepScreenAwake();
    matchDisplay.reset(); introScene.stop(); objectives.reset(false);
    stylesDisplay.state = null; stylesDisplay.dialog.close();
    menu.home();
  }
  async function prepare(candidateId, onProgress = () => {}) {
    stopDebate();
    paused = true; input.clear(); debug.toggle(false);
    stylesDisplay.profile = profile;
    simulation = new GameSimulation(config, config.prototype.seed, candidateId, profile, { campaignIntro: true });
    if (session) {
      simulation.state.human_candidate_ids = session.room.players.map(p => `candidate:${p.faction}`);
      campaignPrediction = session.host ? null : new CampaignPrediction(config, session.candidateId);
      remote.clear(); campaignFrame = 0; inputSender.reset();
      // Chaque joueur choisit parmi SES styles débloqués (carte envoyée au salon), pas ceux de l’hôte.
      simulation.profiles = Object.fromEntries(session.room.players.map(p => [`candidate:${p.faction}`,
        p.id === session.id ? profile : { ...unlocksToProfile(p.card?.unlocks || []), nickname: '' }]));
    }
    startSoloRun(candidateId);
    resetPresentation(); simulationSpeed = 1; noticeRemaining = 0;
    // `?tutoriel` dans l'adresse : revoir les consignes et les objectifs des deux premières parties.
    const tutorial = (profile.campaign_intro_seen || 0) < introSettings.tutorial_games || new URLSearchParams(location.search).has('tutoriel');
    introScene.start({ tutorial }); objectives.reset(tutorial);
    renderer.artZone = null;
    // Premier dessin avec la scène d'ouverture (journalistes et public) : rien à charger en pleine scène.
    renderer.draw(introScene.view(state), state, 1, 0);
    const ids = [...renderer.assets.protectedIds];
    let timeout, finished = false, restartTimeout;
    onProgress(0);
    // Partie d'essai jetable (simulation/warm-up.js), jouée par petites tranches pendant que les images arrivent :
    // le code de l'ordinateur, de la persuasion, du QG, du rassemblement et des coups est prêt avant la vraie
    // partie, qui reste identique, sans allonger le chargement.
    const warming = warmUpSimulation(config, { yieldEvery: 5 });
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
          // Les images déjà en mémoire arrivent d’un coup : cette étape n’occupe que 60 % de la barre.
          restartTimeout(); onProgress(ratio * .6, 'images');
        }),
      ]);
      // Prepare the first complete frame behind the loading screen. In
      // particular, texture uploads must not become simulation catch-up time.
      // Chaque image est envoyée une fois à la carte graphique derrière l’écran de chargement :
      // sinon ce transfert se fait au premier affichage, en pleine partie (à-coups).
      const ready = [...new Set([...renderer.assets.cache.values()].filter(entry => entry.ready)
        .flatMap(entry => [...preparedDrawingSources(entry.image)]))];
      // Cette étape est souvent la plus longue : elle fait avancer la barre de 60 à 98 %.
      onProgress(.6, 'gpu');
      for (let i = 0; i < ready.length; i += 6) {
        renderer.ctx.save(); renderer.ctx.setTransform(1, 0, 0, 1, 0, 0);
        for (const image of ready.slice(i, i + 6)) renderer.ctx.drawImage(image, 0, 0, 1, 1);
        renderer.ctx.restore();
        onProgress(.6 + .38 * Math.min(1, (i + 6) / ready.length), 'gpu');
        await new Promise(resolve => requestAnimationFrame(resolve));
      }
      await warming;
      // Derrière l'écran de chargement, d'abord la campagne déjà lancée (panneaux d'achat, étiquettes « soutiens »,
      // textes des gains), puis la scène d'ouverture : formatage des nombres, polices et étiquettes sont prêts
      // avant le début, au lieu d'être préparés au premier coup (à-coups mesurés de 35 à 50 ms sur téléphone).
      warmNumberFormats();
      renderer.draw({ ...state, campaign_intro: null }, state, 1, 0);
      renderer.ctx.save();
      for (const font of ['bold 14px system-ui', '700 10px system-ui', 'bold 13px sans-serif']) { renderer.ctx.font = font; renderer.ctx.fillText('Don : +0123456789,5 k€ soutiens', 0, 20); }
      renderer.ctx.restore();
      renderer.draw(introScene.view(state), state, 1, 0);
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      onProgress(1);
      // Les portraits de la soirée électorale arrivent pendant la campagne, sans retarder son lancement.
      setTimeout(warmElectionPortraits, 3000);
    } finally { finished = true; clearTimeout(timeout); }
  }
  function startSoloRun(candidateId) {
    soloRun = null;
    if (session || !accounts.ready) return;
    const run = soloRun = { id: null, tainted: false, startedAt: Date.now() };
    accounts.startRun(candidateId.split(':')[1]).then(result => { run.id = result.run_id; }).catch(() => { /* Hors ligne : partie jouable, déblocage non enregistré. */ });
  }
  /** K.-O. d'un candidat pas encore débloqué : félicitations, et rappel qu'il faut gagner l'élection. */
  function announceKnockouts() {
    const list = state.knockouts || [];
    if (list.length < knockoutsSeen) knockoutsSeen = 0;
    if (list.length === knockoutsSeen) return;
    const faction = state.local_candidate_id.split(':')[1], owned = profileUnlockIds(profile);
    for (const k of list.slice(knockoutsSeen)) {
      if (k.by_faction !== faction || owned.includes(k.candidate_id) || announcedKnockouts.has(k.candidate_id)) continue;
      announcedKnockouts.add(k.candidate_id);
      showKnockoutReveal(k.candidate_id, { sound: () => audio.play('reveal') });
    }
    knockoutsSeen = list.length;
  }
  /**
   * Fin normale de la campagne : les candidats mis K.-O. se débloquent maintenant (jamais avant).
   * Solo : le joueur en CHOISIT un s'il a gagné, un de plus avec une pub récompensée, ou un seul
   * avec une pub s'il a perdu (« seconde chance »). Multijoueur : le vainqueur garde tous ses K.-O.
   */
  function finishProgress() {
    const faction = state.local_candidate_id.split(':')[1];
    let titleBefore = playerCard(profile).title;
    // shown : l'écran de choix montre déjà les candidats débloqués (pas de message en double).
    const announce = (ids, shown = false) => {
      if (!ids.length) return;
      if (!shown) showAccountToast(`Débloqué : ${unlockNames(ids)} !`, 'ok');
      // Nouveau titre gagné grâce à ce déblocage : annoncé juste après.
      const title = playerCard(profile).title;
      if (title > titleBefore) setTimeout(() => showAccountToast(`Nouveau titre : ${titleName(title)} !`, 'knockout'), 3500);
      titleBefore = Math.max(titleBefore, title);
    };
    const offer = unlockOffer(state, faction, profileUnlockIds(profile));
    const lost = () => { if (offer && !offer.won) showAccountToast(`Élection perdue : ${unlockNames(offer.choices)} ${offer.choices.length > 1 ? 'restent' : 'reste'} à débloquer.`, 'error'); };
    if (session) {
      lost();
      if (session.room?.match) { ranked.report(session, { placements: campaignPlacements(session.room, state), knockouts: campaignKnockouts(session.room, state) }); return; }
      const won = earnedUnlocks(state, faction);
      if (!accounts.signedIn) { announce(addDeviceUnlocks(profile, won)); account.save(rememberTitle(profile)); }
      else if (won.length) showAccountToast('Partie non classée : aucun déblocage enregistré sur le compte.');
      return;
    }
    const run = soloRun; soloRun = null;
    const signedIn = accounts.signedIn;
    // Partie que le serveur refuserait (hors ligne au lancement, accélérée, trop courte) : ni choix ni pub,
    // pour ne jamais faire regarder une pub qui ne rapporterait rien.
    const tooShort = run && (Date.now() - run.startedAt) / 1000 < campaignMinSeconds(config.balance.time) + RUN_CLOCK_MARGIN_SECONDS;
    if (signedIn && (!run?.id || run.tainted || tooShort)) {
      if (offer?.won) showAccountToast('Déblocage impossible pour cette partie : hors ligne, accélérée ou trop courte.'); else lost();
      return;
    }
    const record = ids => {
      // Rien à débloquer : rien à envoyer (pas de message d'erreur sans objet en fin de partie).
      if (!ids.length) return;
      if (!signedIn) { announce(addDeviceUnlocks(profile, ids)); account.save(rememberTitle(profile)); return; }
      accounts.completeRun(run.id, ids).then(result => announce(result.unlocked))
        .catch(error => showAccountToast(error.offline ? 'Pas de connexion : déblocage non enregistré sur le compte.' : error.message, 'error'));
    };
    // Depuis l'écran de choix : l'écran affiche lui-même la réussite (tampon) ou l'échec (message, nouvel essai).
    const save = async ids => {
      if (!signedIn) { announce(addDeviceUnlocks(profile, ids), true); account.save(rememberTitle(profile)); return; }
      try { announce((await accounts.completeRun(run.id, ids)).unlocked, true); }
      catch (error) { throw { message: error.offline ? 'Pas de connexion : déblocage non enregistré.' : error.message, retry: !!error.offline }; }
    };
    // Rien à choisir (aucun K.-O. nouveau, ou un seul candidat gagné sans bonus possible) : comme avant.
    if (!offer || (offer.free === offer.choices.length && !offer.rewarded)) { record(offer?.choices ?? []); return; }
    const game = simulation;
    // Hors ligne et connecté : une pub déjà chargée pourrait passer, mais le choix ne serait pas enregistré.
    const none = { available: false, show: async () => false };
    const getAd = () => signedIn && navigator.onLine === false ? Promise.resolve(none) : ads.rewarded('campaign');
    const open = ad => {
      // Pas d'ouverture automatique : le joueur lit les résultats, l'écran s'ouvre au clic sur « Voir le bilan ».
      const choice = unlockChoice = openUnlockChoice({ offer, getAd, ad, save, sound: () => audio.play('reveal'),
        onBack: () => document.querySelector('#results [data-action="summary"]')?.focus({ preventScroll: true }) });
      void choice.done.then(() => {
        if (unlockChoice !== choice) return;
        unlockChoice = null;
        if (simulation === game && state.phase === 'RESULTS') choice.next?.();
      });
    };
    if (offer.won) { open(null); return; }
    // Seconde chance : proposée seulement si une pub récompensée est prête, et si le joueur est encore sur les résultats.
    void getAd().catch(() => null).then(ad => {
      if (ad?.available && simulation === game && state.phase === 'RESULTS') open(ad);
      else { lost(); record([]); }
    });
  }

  function play() {
    snapshots.reset(); sentTick = null; paused = false; clock.reset(); input.clear(); previousTime = performance.now(); canvas.focus(); void keepScreenAwake();
    // Arrivée dans la campagne : la partie attend que le menu soit effacé, l'interface glisse à sa place.
    if (debateMatch || reducedMotion()) return;
    arrivalRemaining = session ? 0 : transitionSettings.arrival_seconds;
    // Avec la scène d'ouverture, l'interface n'arrive qu'au début de la campagne (introScene.ended).
    if (!introScene.active) enterHud();
  }
  /** L'interface (argent, carte, boutons) glisse à sa place. */
  function enterHud() {
    if (reducedMotion()) return;
    const game = document.getElementById('game');
    game.classList.remove('hud-entering'); void game.offsetWidth; game.classList.add('hud-entering');
    setTimeout(() => game.classList.remove('hud-entering'), (transitionSettings.arrival_seconds + 0.9) * 1000);
  }
  function roomChanged(room) {
    if (!session) return;
    if (room.phase === 'pairing') {
      showPeerAnswer(menu, session, returnHome);
    } else if (room.phase === 'lobby') {
      // Retour à la sélection après un débat : on quitte le plateau, le salon reste connecté.
      if (roomPhase === 'playing' || roomPhase === 'loading') { stopDebate(); paused = true; input.clear(); }
      updateLobby(menu, session, returnHome);
    } else if (room.phase === 'loading' && roomPhase !== 'loading') {
      // Partie en ligne d'un joueur connecté : déclarée au serveur pour le classement.
      ranked.declare(session);
      if (room.mode === 'debate') {
        void menu.debateLoading(room.debate, { multiplayer: { localId: debateFighterOf(room.debate, session.id), ready: () => session.request('ready') } });
      } else {
        menu.selected = session.candidateId.split(':')[1];
        void menu.loading({ multiplayer: true, ready: () => session.request('ready') });
      }
    } else if (room.phase === 'playing') {
      if (roomPhase !== 'playing') { menu.close({ fade: debateMatch ? 0 : transitionSettings.arrival_seconds }); if (debateMatch) playDebate(); else play(); }
      if (debateMatch) {
        const votes = room.rematch || [];
        debateDisplay.setRematch({ voted: votes.includes(session.id) || debateDisplay.rematch.voted, waiting: votes.filter(id => id !== session.id).length });
      }
      const changed = paused !== room.paused;
      paused = room.paused;
      void keepScreenAwake();
      if (changed) { input.clear(); clock.reset(); remote.clear(); pending = []; canvas.focus(); }
    }
    ranked.join(session);
    roomPhase = room.phase;
  }
  async function connectRoom(action, data) {
    if (accountsConfigured() && !accounts.ready) throw new Error('Connectez-vous à votre compte PartageTonJeu pour jouer en multijoueur.');
    const generation = menu.generation;
    const Session = data.transport === 'direct' ? PeerSession : data.transport === 'online' ? OnlineSession : MultiplayerSession;
    const nextSession = new Session({
      room: roomChanged,
      commands: packet => {
        if (!session?.host || paused) return;
        const player = session.room.players.find(p => p.id === packet.playerId);
        if (!player) return;
        const id = debateMatch ? debateFighterOf(session.room.debate, player.id) : `candidate:${player.faction}`;
        if (packet.seq == null) return;
        // Pas numérotés de l’invité : rangés sur la ligne du temps de l’hôte (Débat : avec retours en arrière).
        if (debateHost) { debateHost.receive(id, packet.seq, packet.commands, packet.seen); return; }
        if (debateMatch) return;
        if (!remote.has(id)) remote.set(id, new InputTimeline());
        remote.get(id).receive(packet.seq, packet.commands, campaignFrame);
      },
      snapshot: snapshot => {
        if (!session || session.host || menu.active) return;
        const now = performance.now() / 1000;
        if (debateMatch) {
          snapshots.push({ ...snapshot, local_candidate_id: debateState.local_candidate_id }, now);
          // Dernier pas de l'hôte reçu : renvoyé avec nos messages, l'hôte attend les joueurs en retard.
          if (Number.isInteger(snapshot.host_frame)) hostFrameSeen = snapshot.host_frame;
          prediction?.authoritative(snapshot);
          return;
        }
        const latest = snapshots.latest;
        // Changement de phase : l’ancien état ne doit pas se mélanger au nouveau.
        if (latest && latest.phase !== snapshot.phase) { snapshots.reset(); input.clear(); renderer.resetCamera(); }
        snapshots.push({ ...snapshot, local_candidate_id: session.candidateId }, now);
        campaignPrediction?.authoritative(snapshot);
      },
      ended: message => {
        // Combat de débat terminé : on garde l’écran des résultats, la connexion n’est plus utile.
        if (debateState?.phase === 'OVER') { stopSession(); debateDisplay.setRematch({ closed: 'Adversaire parti' }); return; }
        returnHome(); menu.page('disconnected', 'La partie a été interrompue.', '<p id="disconnect-message" class="menu-intro" role="alert"></p><button id="back-to-home" class="menu-primary">Retour à l’accueil</button>');
        menu.element.querySelector('#disconnect-message').textContent = message;
        menu.element.querySelector('#back-to-home').onclick = () => menu.home();
      },
    }, state.config_fingerprint);
    // Le pseudo du compte (ou du profil local) s’affiche dans le salon des autres joueurs.
    try { await nextSession.connect(action, { ...data, name: accounts.username || profile.nickname || null, card: playerCard(profile) }); } catch (error) { nextSession.close(); throw error; }
    if (menu.generation !== generation || data.signal?.aborted) { nextSession.close(); return; }
    session = nextSession; roomChanged(session.room); void keepScreenAwake();
  }
  // Multijoueur : compte obligatoire. Une fois connecté, l'action voulue reprend toute seule.
  const multiplayerGate = (current, mode) => requireAccount(current, accounts, { resume: () => showMultiplayerSetup(current, connectRoom, mode), back: () => current.players(mode), suggestion: profile.nickname });
  setCandidateColors(config.prototype.presentation.factions);
  menu = new StartMenu({ prepare, play, audio, account, ads, combat: config.balance.candidate_combat, multiplayer: multiplayerGate, arrivalSeconds: transitionSettings.arrival_seconds,
    debate: { config, prepare: prepareDebate, play: playDebate } });
  menu.leave = stopSession;
  menu.onProfile = current => decorateProfile(current, accounts);
  // Avatar choisi dans la collection : sur le compte si connecté, sinon sur l'appareil.
  menu.onAvatar = async avatar => {
    // Gardé aussi sur l'appareil : affiché tout de suite, même hors ligne ou si le serveur ne le connaît pas encore.
    account.save({ avatar });
    if (profile.account) profile.account.avatar = avatar;
    if (!accounts.ready) return;
    try { await accounts.updateProfile({ avatar }); }
    catch (error) { showAccountToast(error.offline ? 'Pas de connexion : avatar non enregistré.' : error.message, 'error'); }
  };
  window.matchMedia('(any-pointer: coarse) and (max-width: 600px) and (orientation: portrait)').addEventListener('change', () => input.clear());
  if (['salon', 'en-ligne'].some(key => new URLSearchParams(location.search).has(key))) {
    void requireAccount(menu, accounts, { resume: () => showMultiplayerSetup(menu, connectRoom), back: () => menu.home(), suggestion: profile.nickname });
  }

  // Décisions de l'ordinateur préparées pendant l'image précédente, sans pas de simulation (voir la fin de frame) :
  // valables seulement pour ce même état, donc identiques à celles calculées au moment du pas.
  let preparedAI = null;
  function matchCommands() {
    if (['FIRST_ROUND_RESULTS', 'RESULTS'].includes(state.phase)) return [];
    if (!session) return collectCommands(state, human, ai, preparedAI?.state === state ? preparedAI.commands : null);
    const frame = ++campaignFrame;
    return withAIObservation(state, () => state.candidates.filter(c => !c.eliminated).flatMap(candidate => {
      if (candidate.id === state.local_candidate_id) return human.commands(state, candidate.id);
      if (!state.human_candidate_ids.includes(candidate.id)) return ai.commands(state, candidate.id);
      const id = candidate.id, presence = [{ type: 'InteractionPresence', candidateId: id, active: true }, { type: 'SetCampaignActive', candidateId: id, active: true }];
      const commands = remote.get(id)?.commandsFor(frame);
      // Sans nouvelles depuis 1 s : son candidat s’arrête.
      if (!commands) return [{ type: 'Move', candidateId: id, axis: 0 }, ...presence, { type: 'CancelAttack', candidateId: id }, { type: 'HoldCampaignStyle', candidateId: id, active: false }];
      const [move, ...actions] = commands.map(command => ({ ...command, candidateId: id }));
      return [move, ...presence, ...actions];
    }));
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
      // Débat : un état à chaque pas de simulation (30 par seconde, environ 3 Ko/s) :
      // combat rapide et état léger, chaque pas compte. Campagne : 15 par seconde.
      if (debateMatch) {
        // Un état par pas de l'hôte, ou après un retour en arrière.
        if (debateHost.version === sentTick) return;
        sentTick = debateHost.version;
        // Dernier pas appliqué de chaque invité : sa prédiction repart de là. `ai_seed` : graine du
        // hasard de l'ordinateur, pour que l'invité prédise ses décisions à l'identique.
        // `host_frame` : numéro du pas de l'hôte, renvoyé par les invités ; `sync_wait` : combat en attente d'un joueur.
        send('snapshot', { state: { ...debateState, input_acks: debateHost.acks(), ai_seed: debateState.rng_state, host_frame: debateHost.frame, sync_wait: debateHost.waiting } });
        return;
      }
      if (networkElapsed < 1 / 15) return;
      networkElapsed = 0;
      const acks = {};
      for (const [id, timeline] of remote) if (timeline.ack != null) acks[id] = timeline.ack;
      send('snapshot', { state: { ...state, input_acks: acks } });
    }
    // Invité : ses pas numérotés partent depuis la boucle de jeu (voir sendGuestFrame).
  }

  let ultimateReadySince = null;
  /** Boutons tactiles de combat : jauge d’ultime et charge du coup. */
  function updateCombatButtons(combatView, fighter) {
    const ultimateButton = document.getElementById('ultimate-touch');
    const ratio = Math.max(0, Math.min(1, fighter.special_charge / config.balance.special_charge.required_points));
    const satchel = pendingSatchel(combatView, fighter);
    setHidden(ultimateButton, ratio <= 0 && !satchel);
    const disabled = !!ultimateBlockedReason({ state: combatView, config }, fighter);
    if (ultimateButton.disabled !== disabled) ultimateButton.disabled = disabled;
    const heldTicks = fighter.combat.press_tick == null ? 0 : combatView.tick - fighter.combat.press_tick;
    const chargeRatio = fighter.combat.charge_active ? Math.min(1, heldTicks / (config.balance.candidate_combat.charge_ready_seconds * config.balance.simulation_architecture.fixed_tick_hz)) : 0;
    const attackButton = document.getElementById('attack-touch');
    setClass(attackButton, 'charging', chargeRatio > 0);
    setStyle(attackButton, '--focus', `${chargeRatio * 100}%`);
    setText(attackButton, chargeRatio >= 1 ? 'Prête !' : chargeRatio > 0 ? 'Charge…' : 'Frapper');
    setText(ultimateButton, satchel ? 'Faire éclater' : 'Ultime');
    const ready = !!satchel?.launched || ratio >= 1;
    setClass(ultimateButton, 'ready', ready);
    // Lueur qui pulse : avancée ici, à chaque image dessinée, plutôt que par une animation CSS (voir ultimate-pulse.js).
    if (!ready) ultimateReadySince = null; else ultimateReadySince ??= performance.now();
    setStyle(ultimateButton, '--glow', ready && !reducedMotion() ? ultimateGlow((performance.now() - ultimateReadySince) / 1000).toFixed(3) : '0');
    setStyle(ultimateButton, '--charge', `${ratio * 100}%`);
    setAttribute(ultimateButton, 'aria-label', satchel ? 'Faire éclater le cartable' : `Ultime : ${Math.round(ratio * 100)} %${ratio >= 1 ? ', prêt' : ''}`);
    setHidden(document.getElementById('bardella-armed'), !fighter.bardella_guardian_armed);
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
    // Campagne : notre candidat vient de la prédiction (présent), le reste du tampon (léger retard).
    if (!debateMatch && campaignPrediction?.active) ({ shown, previous: before } = campaignPrediction.apply(shown, before, clock.alpha));
    if (debateMatch) { debateState = shown; debatePrevious = before; } else { state = shown; previous = before; }
    guestAlpha = alpha;
  }

  /** Une image du mode Débat : simulation à pas fixe, puis affichage. */
  function debateFrame(elapsed, now) {
    const halted = paused || document.hidden;
    // Un invité ne décide de rien : l’hôte arbitre. Mais pendant le combat, son téléphone
    // joue ses gestes tout de suite (prédiction), puis se recale sur chaque état de l’hôte.
    const guest = session && !session.host;
    if (guest && prediction) {
      if (!halted) clock.advance(Math.min(elapsed, config.prototype.presentation.max_presentation_frame_seconds), guestDebateTick);
      prediction.decay(halted ? 0 : elapsed);
    }
    if (guest && prediction?.active) {
      const view = prediction.view();
      debateState = view.state; debatePrevious = view.previous; guestAlpha = clock.alpha;
    } else if (guest) guestView();
    if (!halted && !guest) clock.advance(Math.min(elapsed, config.prototype.presentation.max_presentation_frame_seconds), hostDebateTick);
    if (debateHost) {
      // Un pas d'invité arrivé en retard a été rejoué : l'affichage relit l'état recalculé.
      if (debateHost.consumeRollback()) { debateState = debateMatch.getState(); debatePrevious = debateHost.history.get(debateHost.frame - 1) ?? debateState; }
      debateHost.decay(halted ? 0 : elapsed);
    }
    networkFrame(elapsed);
    const fighter = debateState.candidates.find(c => c.id === debateState.local_candidate_id);
    const alpha = halted ? 1 : guest ? guestAlpha : clock.alpha;
    // Hôte : le bandeau annonce aussi l'attente d'un joueur (les invités la reçoivent avec l'état).
    debateDisplay.update(debateHost?.waiting ? { ...debateState, sync_wait: true } : debateState, halted ? 0 : elapsed);
    // Débat en ligne terminé : chaque joueur envoie l'ordre d'arrivée qu'il a vu.
    const match = debateState.phase === 'OVER' && session?.room?.match;
    if (match && !ranked.reported.has(match.id)) ranked.report(session, { placements: debatePlacements(session.room, debateState), knockouts: [] });
    damageFeedback.update(debateState, fighter, alpha, halted || debateState.phase === 'OVER');
    updateCombatButtons(debateState, fighter);
    const controls = document.getElementById('touch-controls');
    controls.hidden = halted || debateState.phase === 'OVER' || fighter.is_ko;
    sounds.update(debateState, { paused: halted });
    setText(notice, ''); notice.hidden = true;
    // Hôte : les combattants recalés par un retour en arrière glissent au lieu de sauter.
    const shown = debateHost ? debateHost.display(debateState) : debateState, shownPrevious = debateHost ? debateHost.display(debatePrevious) : debatePrevious;
    drawDebateMode(renderer, shown, halted ? shown : shownPrevious, alpha, halted ? 0 : Math.min(elapsed, config.prototype.presentation.max_presentation_frame_seconds));
  }

  let pingElapsed = 0, lowLatency = false;
  /** Multijoueur : ping en coin d'écran, et lissage des corrections adapté à la régularité du réseau. */
  function updateNetworkPing(elapsed) {
    // Appli Android : Wi-Fi gardé éveillé pendant une partie multijoueur (moins de pointes de ping).
    const playing = elapsed !== null && session?.room?.phase === 'playing';
    if (playing !== lowLatency) { lowLatency = playing; try { globalThis.PTJNativeNetwork?.setLowLatency(playing); } catch { /* Pont absent : navigateur. */ } }
    const badge = document.getElementById('network-ping');
    const stats = elapsed !== null && session?.room?.phase === 'playing' ? session.networkStats?.() || [] : [];
    if (!stats.length) { setHidden(badge, true); return; }
    if ((pingElapsed += elapsed) < 0.5 && !badge.hidden) return;
    pingElapsed = 0;
    const worst = stats.reduce((a, b) => b.ping > a.ping ? b : a), ping = Math.round(worst.ping);
    setHidden(badge, false);
    setText(badge, `Ping ${ping} ms${worst.jitter > 40 ? ' · irrégulier' : ''}`);
    badge.dataset.quality = ping < 60 ? 'bon' : ping < 150 ? 'moyen' : 'mauvais';
    // Réseau irrégulier : corrections plus douces (moins de petits sauts) ; stable : plus vives.
    const smooth = Math.max(0.06, Math.min(0.2, 0.06 + worst.jitter / 1000 * 0.5));
    for (const target of [prediction, campaignPrediction, debateHost]) if (target) target.smooth = smooth;
  }

  /** Un pas du débat chez l'invité : joué tout de suite (prédiction) et envoyé à l'hôte. */
  function guestDebateTick() {
    const commands = human.commands(prediction.state, prediction.localId);
    sendGuestFrame(prediction.step(commands), commands);
    if (prediction.active) sounds.predicted(prediction.newEvents, { local_candidate_id: prediction.localId, candidates: prediction.state.candidates });
  }
  /** Un pas du débat chez l'hôte (ou en solo). */
  function hostDebateTick() {
    debatePrevious = debateState;
    const localId = debateState.local_candidate_id;
    if (debateHost) debateHost.step(human.commands(debateState, localId));
    else debateMatch.step([...debateState.candidates.flatMap(c => c.id === localId ? human.commands(debateState, c.id) : debateModeAICommands(debateState, config, c.id)), ...debatePending.splice(0)]);
    debateState = debateMatch.getState();
  }
  /** Un pas de la campagne chez l'invité : son candidat avance tout de suite, le pas part vers l'hôte. */
  function guestCampaignTick() {
    const commands = [...human.commands(state, session.candidateId), ...pending.splice(0)];
    sendGuestFrame(campaignPrediction.step(commands), commands);
  }
  /**
   * Multijoueur : une touche pressée joue le pas suivant aussitôt, au lieu d'attendre jusqu'à
   * 33 ms. L'hôte en campagne n'est pas concerné (ses gestes sont déjà locaux, et son pas complet
   * de campagne est plus lourd).
   */
  function pullTick() {
    if (!session || paused || document.hidden || menu.active || session.room?.phase !== 'playing') return;
    if (debateMatch) clock.pull(session.host ? hostDebateTick : prediction ? guestDebateTick : () => {});
    else if (!session.host && campaignPrediction) clock.pull(guestCampaignTick);
  }

  /** Invité : un pas numéroté part vers l'hôte s'il apporte du neuf (ou comme signe de vie). */
  function sendGuestFrame(seq, commands) {
    const outgoing = outgoingCommands(commands);
    if (!inputSender.shouldSend(seq, outgoing)) return;
    const activeSession = session;
    // Message non parti (connexion pas prête) : le pas suivant renverra tout.
    activeSession.request('commands', { commands: outgoing, seq, ...(debateMatch && hostFrameSeen ? { seen: hostFrameSeen } : {}) }).catch(error => { inputSender.reset(); if (!error.transient) activeSession.fail(error.message); });
  }

  function frame(now) {
    try {
      // Téléphones web et application : évite de surcharger les écrans à 120 Hz.
      if (renderer.mobileRendering) {
        if (!shouldDrawFrame(now, lastDrawnTime)) { requestAnimationFrame(frame); return; }
        lastDrawnTime = now;
      }
      let elapsed = Math.max(0, (now - previousTime) / 1000);
      previousTime = now;
      if (wasHidden) { elapsed = 0; wasHidden = false; }
      updateNetworkPing(menu.active ? null : elapsed);
      if (menu.active || debateMatch) respawnCountdown.update(state, null, true);
      if (menu.active) { sounds.update(state, { menu: true }); requestAnimationFrame(frame); return; }
      if (debateMatch) { debateFrame(elapsed, now); requestAnimationFrame(frame); return; }
      if (session && !session.host) {
        // Invité : ses pas sont comptés et envoyés ; son candidat se déplace tout de suite.
        if (campaignPrediction && !paused && !document.hidden) clock.advance(Math.min(elapsed, config.prototype.presentation.max_presentation_frame_seconds), guestCampaignTick);
        campaignPrediction?.decay(paused ? 0 : elapsed);
        guestView();
      }
      stepped = false;
      if (arrivalRemaining > 0) arrivalRemaining -= elapsed;
      if (!paused && !document.hidden && (!session || session.host) && !sceneFreeze && arrivalRemaining <= 0) {
        const frameStart = state;
        let changedCamera = false;
        // Après un ralentissement, on rattrape au plus max_presentation_frame_seconds :
        // un appareil lent ne s’enfonce pas dans une avalanche de ticks.
        // Ce retard est réparti sur les images suivantes (catchUpTicks) au lieu d'être joué d'un coup.
        const frameSeconds = Math.min(elapsed, config.prototype.presentation.max_presentation_frame_seconds) * simulationSpeed;
        clock.advance(frameSeconds, lastTick => {
          // Rien n’est recopié : avant le dernier pas de l’image, on retient seulement les positions
          // (lissage des mouvements) ; l’image lit ensuite l’état vivant, sans le modifier.
          const commands = [...matchCommands(), ...pending];
          changedCamera ||= pending.some(c => ['DebugSelectCandidate', 'DebugTeleport', 'DebugTeleportTarget'].includes(c.type));
          pending = [];
          if (lastTick) previous = simulation.motionSnapshot();
          simulation.step(commands); stepped = true;
          // Vue à jour après chaque pas : l’IA du pas suivant lit le bon numéro de pas et la bonne phase.
          state = simulation.presentationView();
        }, { maxTicks: catchUpTicks(clock, frameSeconds, simulationSpeed),
          maxBacklog: simulationSpeed > 1 ? Infinity : config.prototype.presentation.max_presentation_frame_seconds });
        if (state !== frameStart) {
          const rejected = state.events.findLast(e => e.type === 'CampaignEventRejected' && e.tick >= frameStart.tick);
          if (rejected && !frameStart.events.some(e => e.id === rejected.id)) notify(rejected.reason, 4);
          if (state.phase !== frameStart.phase) { previous = state; renderer.resetCamera(); input.clear(); noticeRemaining = 0; }
          if (changedCamera) { previous = state; renderer.resetCamera(); input.clear(); }
        }
      }
      if (!paused && !document.hidden) { noticeRemaining -= elapsed; }
      networkFrame(elapsed);
      // Pas limité à 0,1 s : après un à-coup, le fondu reprend au lieu d'être sauté.
      const scene = transitions.update(campaignScene(state), Math.min(elapsed, 0.1), { solo: !session, instant: reducedMotion() });
      sceneFreeze = scene.freeze;
      if (scene.swap) { previous = state; renderer.resetCamera(); }
      const curtainOpacity = String(Math.round(scene.curtain * 100) / 100);
      if (curtain.style.opacity !== curtainOpacity) curtain.style.opacity = curtainOpacity;
      if (voteInterlude.hidden === scene.vote) voteInterlude.hidden = !scene.vote;
      matchDisplay.resultsHeld = !scene.results;
      matchDisplay.update(state);
      campaignDisplay.update(state);
      stylesDisplay.update(state);
      const waiting = session && state.campaign_style_selection && state.campaign_style_selection.candidate_id !== state.local_candidate_id;
      const networkStatus = document.getElementById('network-status'); setHidden(networkStatus, !waiting);
      if (waiting) networkStatus.textContent = 'Un autre joueur choisit son style. La campagne reprendra dès qu’il aura terminé.';
      setClass(document.body, 'campaign-studio', state.campaign_events.some(e => e.status === 'ACTIVE' && e.debate && e.participants.includes(state.local_candidate_id)));
      // Post-it d'abord : la scène mesure sa place pour le dossier de départ.
      objectives.update(state, paused ? 0 : elapsed, document.body.classList.contains('campaign-studio') || !!state.candidates.find(c => c.id === state.local_candidate_id)?.eliminated);
      introScene.update(state, paused ? 0 : elapsed);
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
      respawnCountdown.update(state, local, paused || !!state.campaign_style_selection || !scene.draw);
      const inCombat = state.phase === 'CAMPAIGN' && !state.campaign_intro && !!local && !local.eliminated && combatMusic.active(local, state, config);
      sounds.update(state, { paused, combat: inCombat });
      if (state.phase === 'RESULTS' && !resultRecorded) {
        resultRecorded = true;
        account.save(recordMatchResult(profile, state, { multiplayer: !!session }));
        finishProgress();
      }
      announceKnockouts();
      setHidden(funds, !['CAMPAIGN', 'SECOND_ROUND_SPRINT'].includes(state.phase) || state.candidates.find(c => c.id === state.local_candidate_id).eliminated);
      setHidden(document.getElementById('touch-controls'), paused || !!state.campaign_style_selection || ['FIRST_ROUND_RESULTS', 'RESULTS'].includes(state.phase) || state.candidates.find(c => c.id === state.local_candidate_id).eliminated);
      if (noticeRemaining <= 0) setText(notice, '');
      setHidden(notice, ['FIRST_ROUND_RESULTS', 'RESULTS'].includes(state.phase));
      const viewState = candidate.id === state.local_candidate_id ? state : { ...state, local_candidate_id: candidate.id };
      const renderAlpha = session && !session.host ? guestAlpha : clock.alpha;
      electoralDisplay.update(state, candidate, interpolatedPlayerX(viewState, paused ? viewState : previous, candidate, paused ? 1 : renderAlpha));
      // Rideau en train de se fermer (image figée) ou résultats à l'écran (carte cachée) : rien à redessiner.
      if (scene.draw) {
        // Scène d'ouverture : journalistes du décor, public à l'écoute, horloge de la scène pour les animations.
        const drawn = introScene.view(viewState);
        renderer.draw(drawn, paused ? drawn : introScene.previous(previous, viewState), paused ? 1 : renderAlpha, Math.min(elapsed, config.prototype.presentation.max_presentation_frame_seconds), debug.visible);
        introScene.drawOverlay(renderer, drawn);
      }
      debugElapsed += elapsed;
      if (debugElapsed >= config.prototype.debug.refresh_seconds) { debug.update(state, elapsed > 0 ? 1 / elapsed : 0); debugElapsed = 0; }
      // À 60 images par seconde, un pas de simulation (30 par seconde) tombe une image sur deux. L'image sans pas
      // prépare les décisions de l'ordinateur du pas suivant : le travail est réparti sur les deux images.
      if (!session && !stepped && !paused && !document.hidden && preparedAI?.state !== state && ['CAMPAIGN', 'SECOND_ROUND_SPRINT'].includes(state.phase))
        preparedAI = { state, commands: prepareAICommands(state, ai) };
      requestAnimationFrame(frame);
    } catch (error) { showError(error, true); }
  }
  requestAnimationFrame(frame);
}

installLandscape();
start().catch(showError);
