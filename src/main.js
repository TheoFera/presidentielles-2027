import { DamageFeedbackDisplay } from './presentation/damage-feedback.js';
import { CampaignStylesDisplay } from './presentation/campaign-styles.js';
import { ultimateBlockedReason } from './simulation/combat.js';
import { loadCampaignProfile, saveCampaignProfile } from './presentation/campaign-profile.js';
import { CampaignDisplay } from './presentation/campaign.js';
import { loadConfig } from './config.js';
import { incomePerSecond } from './simulation/territory.js';
import { remainingCampaignBudget } from './simulation/campaign-budget.js';
import { GameSimulation } from './simulation/game-simulation.js';
import { FixedClock } from './simulation/fixed-clock.js';
import { AIController, LocalHumanController, collectCommands } from './simulation/controllers.js';
import { zoneAt } from './simulation/world.js';
import { WorldRenderer } from './presentation/renderer.js';
import { BrowserInput } from './presentation/input.js';
import { DebugPanel } from './presentation/debug.js';
import { ElectoralDisplay } from './presentation/electoral.js';
import { MatchDisplay } from './presentation/match.js';
import { StartMenu } from './presentation/start-menu.js';
import { installLandscape, portraitPhone } from './presentation/landscape.js';
import { MultiplayerSession, showMultiplayerSetup, updateLobby, showPeerAnswer } from './presentation/multiplayer.js';
import { PeerSession } from './network/peer-session.js';
import { outgoingCommands } from './network/shared-commands.js';

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
  const config = await loadConfig();
  const chargeDuration = `${config.balance.candidate_combat.charge_ready_seconds.toLocaleString('fr-FR')} s`;
  document.querySelectorAll('[data-charge-duration]').forEach(element => { element.textContent = chargeDuration; });
  const profile = loadCampaignProfile();
  try { saveCampaignProfile(profile); } catch { console.warn('Le profil ne peut pas être enregistré dans ce navigateur.'); }
  let simulation = new GameSimulation(config, config.prototype.seed, 'candidate:melenchon', profile);
  let state = simulation.getState();
  let previous = state;
  const clock = new FixedClock(config.balance.simulation_architecture.fixed_tick_hz);
  const human = new LocalHumanController();
  const ai = new AIController(config);
  const canvas = document.getElementById('world');
  const renderer = new WorldRenderer(canvas, config);
  const damageFeedback = new DamageFeedbackDisplay(config);
  const campaignDisplay = new CampaignDisplay(config);
  const electoralDisplay = new ElectoralDisplay(config);
  const matchDisplay = new MatchDisplay(config, {
    follow: () => { renderer.resetCamera(); canvas.focus(); },
    replay: () => { if (session) returnHome(); else { menu.selected = state.local_candidate_id.split(':')[1]; void menu.loading(); } }, return: () => returnHome(),
  });
  const help = document.getElementById('help');
  const money = document.getElementById('money');
  const funds = document.getElementById('funds');
  const campaignBudget = document.getElementById('campaign-budget');
  document.getElementById('budget-help').textContent = `Plafond de dépenses : ${config.balance.money.campaign_spending_limit.toLocaleString('fr-FR')} k€ par candidat sur toute la partie. Les remboursements ne rétablissent pas ce budget.`;
  const notice = document.getElementById('notice');
  const hint = document.getElementById('hint');
  if (window.matchMedia('(any-pointer: coarse)').matches) hint.textContent = `Flèches : marcher · Frapper : relâcher ou maintenir ${chargeDuration} · Sauter · Pause : aide`;
  let pending = [];
  let paused = true;
  let wakeLock = null;
  let wakePending = false;
  async function keepScreenAwake() {
    if (paused || menu?.active || document.hidden) { try { await wakeLock?.release(); } catch { /* Already released by the browser. */ } wakeLock = null; return; }
    if (!navigator.wakeLock || wakeLock && !wakeLock.released || wakePending) return;
    wakePending = true;
    try {
      const lock = await navigator.wakeLock.request('screen');
      if (paused || menu?.active || document.hidden) await lock.release(); else wakeLock = lock;
    } catch { /* The browser may refuse in battery-saving mode. */ }
    finally { wakePending = false; }
  }
  let menu;
  let session = null;
  let roomPhase = null;
  let remote = new Map();
  let networkElapsed = 0;
  let networkBusy = false;
  let snapshotReceivedAt = 0;
  let snapshotInterval = 100;
  let simulationSpeed = 1;
  let wasHidden = false;
  let noticeRemaining = 0;
  let hintRemaining = config.prototype.presentation.hint_seconds;
  let previousTime = performance.now();
  let debugElapsed = 0;
  let currentZone = zoneAt(state.world, state.candidates[0].x).id;
  let currentDay = state.days_remaining;

  const notify = (text, seconds = config.prototype.presentation.zone_flash_seconds) => { notice.textContent = text; noticeRemaining = seconds; };
  const queue = command => { pending.push(command); canvas.focus(); };
  const resetPresentation = () => {
    state = simulation.getState(); previous = state; pending = []; clock.reset(); input.clear(); renderer.resetCamera();
    matchDisplay.reset();
    currentDay = state.days_remaining;
    currentZone = zoneAt(state.world, state.candidates.find(c => c.id === state.local_candidate_id).x).id;
  };
  function restartMatch(home = false, seed = config.prototype.seed) {
    simulation = new GameSimulation(config, seed, state.local_candidate_id, profile);
    resetPresentation(); simulationSpeed = 1; noticeRemaining = 0; hintRemaining = config.prototype.presentation.hint_seconds;
    debug.toggle(false); togglePause(home); document.getElementById('resume').textContent = home ? 'Commencer la campagne' : 'Reprendre';
  }
  const debug = new DebugPanel(config, {
    state: () => state, queue, notify,
    paused: () => paused, speed: () => simulationSpeed,
    togglePause: () => togglePause(!paused, false),
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
  function togglePause(force = !paused, showHelp = true) {
    if (menu?.active) return;
    if (state.campaign_style_selection) return;
    if (session) { session.request('pause', { paused: force }).catch(error => session?.fail(error.message)); return; }
    paused = force; help.hidden = !paused || !showHelp; input.clear(); clock.reset();
    void keepScreenAwake();
    simulation.applyCommand({ type: 'HoldCampaignStyle', candidateId: state.local_candidate_id, active: false });
    if (!paused || !showHelp) canvas.focus();
    else { document.getElementById('resume').focus({ preventScroll: true }); document.getElementById('help').scrollTop = 0; }
  }
  const input = new BrowserInput(canvas, human, async key => {
    if (menu?.active) return;
    if (state.campaign_style_selection) return;
    if (key === 'attack-cancel') { human.cancelAttack(); }
    else if (key === 'attack-press') { if (!paused) human.pressAttack(); }
    else if (key === 'attack-release') { if (!paused) human.releaseAttack(); }
    else if (key === 'arrowup') { if (!paused) human.jump(); }
    else if ([' ', 'j', 'attack'].includes(key)) { if (!paused) human.attack(); }
    else if (['ultimate', config.balance.special_charge.ultimate_key].includes(key)) {
      if (!paused) {
        const view = state.phase === 'FIRST_ROUND_ARENA' ? state.arena : state.campaign_events.find(e => e.arena && e.status === 'ACTIVE' && e.participants.includes(state.local_candidate_id))?.arena || state;
        const reason = ultimateBlockedReason({ state: view, config }, view.candidates.find(c => c.id === state.local_candidate_id));
        if (reason) notify(reason, 4); else human.ultimate();
      }
    }
    else if (key === 'dash-left' || key === 'dash-right') { if (!paused) human.dash(key === 'dash-left' ? -1 : 1); }
    else if (['h', 'escape', 'p'].includes(key)) togglePause();
    else if (key === 'f3') { if (!session) debug.toggle(); }
    else if (key === 'f') {
      try {
        if (document.fullscreenElement) await document.exitFullscreen();
        else await document.documentElement.requestFullscreen();
      } catch { notify('Le plein écran est indisponible dans ce navigateur.'); }
    } else if (!session) debug.action(key);
  }, config.layout.visual_layout.camera_anchor_x_ratio, config.prototype.presentation.touch_pause_radius_ratio, config.balance.dash.double_tap_window_ms);
  const stylesDisplay = new CampaignStylesDisplay(config, profile, command => {
    if (menu?.active) return;
    if (paused && command.type === 'HoldCampaignStyle' && command.active) return;
    if (session && !session.host) { pending.push(command); return; }
    simulation.applyCommand(command); state = simulation.getState();
  }, () => { input.clear(); pending = []; clock.reset(); });
  document.getElementById('resume').addEventListener('click', () => togglePause(false));
  document.getElementById('pause-home').addEventListener('click', () => returnHome());
  document.querySelectorAll('[data-help-tab]').forEach(button => button.addEventListener('click', () => {
    document.querySelectorAll('[data-help-tab]').forEach(tab => tab.setAttribute('aria-selected', String(tab === button)));
    document.querySelectorAll('[data-help-page]').forEach(page => { page.hidden = page.dataset.helpPage !== button.dataset.helpTab; });
  }));
  document.addEventListener('visibilitychange', () => {
    // A hidden local tab pauses the session clock, not off-camera entities.
    // The simulation itself has no document/window/camera dependency.
    wasHidden = true; input.clear(); clock.reset();
    if (session?.room.phase === 'playing' && document.hidden) session.request('pause', { paused: true }).catch(error => session?.fail(error.message));
    if (!document.hidden) previousTime = performance.now();
  });
  // Help values follow the configuration too.
  const durationText = document.getElementById('balance-help');
  const format = number => number.toLocaleString('fr-FR', { maximumFractionDigits: 2 });
  document.getElementById('poll-help').textContent = `Sondage : restez devant un Institut et payez ${format(config.balance.buildings.institut_sondage.poll_cost)} k€. Il ne s’actualise pas tout seul.`;
  durationText.textContent = `Local : ${format(config.balance.buildings.permanence.capture_cost)} k€ et ${config.balance.buildings.permanence.required_presence_N1} soutiens présents. Un tract coûte ${format(config.balance.buildings.imprimerie.tract_cost_by_level[0])} k€.`;
  const currency = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: config.balance.display.currency_precision_decimals });
  const incomeFormat = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 });
  function stopSession() {
    const oldSession = session; session = null; oldSession?.close(); remote.clear(); roomPhase = null; networkBusy = false;
  }
  function returnHome() {
    paused = true; input.clear(); pending = []; clock.reset(); debug.toggle(false); help.hidden = true;
    void keepScreenAwake();
    stylesDisplay.state = null; stylesDisplay.dialog.close();
    menu.home();
  }
  async function prepare(candidateId, onProgress = () => {}) {
    paused = true; help.hidden = true; input.clear(); debug.toggle(false);
    stylesDisplay.profile = profile;
    simulation = new GameSimulation(config, config.prototype.seed, candidateId, profile);
    if (session) simulation.state.human_candidate_ids = session.room.players.map(p => `candidate:${p.faction}`);
    resetPresentation(); simulationSpeed = 1; noticeRemaining = 0; hintRemaining = config.prototype.presentation.hint_seconds;
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
      renderer.draw(state, state, 1, 0);
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      onProgress(1);
    } finally { finished = true; clearTimeout(timeout); }
  }
  function play() { paused = false; help.hidden = true; clock.reset(); input.clear(); previousTime = performance.now(); canvas.focus(); if (portraitPhone()) togglePause(true); void keepScreenAwake(); }
  function roomChanged(room) {
    if (!session) return;
    if (room.phase === 'pairing') {
      showPeerAnswer(menu, session, returnHome);
    } else if (room.phase === 'lobby') {
      updateLobby(menu, session, returnHome);
    } else if (room.phase === 'loading' && roomPhase !== 'loading') {
      menu.selected = session.candidateId.split(':')[1];
      void menu.loading({ multiplayer: true, ready: () => session.request('ready') });
    } else if (room.phase === 'playing') {
      if (roomPhase !== 'playing') { menu.close(); play(); }
      const changed = paused !== room.paused;
      paused = room.paused; help.hidden = !paused;
      void keepScreenAwake();
      if (changed) { input.clear(); clock.reset(); remote.clear(); pending = []; if (paused) document.getElementById('resume').focus(); else canvas.focus(); }
    }
    roomPhase = room.phase;
  }
  async function connectRoom(action, data) {
    const generation = menu.generation;
    const Session = data.transport === 'direct' ? PeerSession : MultiplayerSession;
    const nextSession = new Session({
      room: roomChanged,
      commands: packet => {
        if (!session?.host || paused) return;
        const player = session.room.players.find(p => p.id === packet.playerId);
        if (!player) return;
        const id = `candidate:${player.faction}`;
        const controller = remote.get(id) || { axis: 0, actions: [], seen: 0 };
        controller.seen = performance.now();
        for (const command of packet.commands) {
          if (command.type === 'Move') controller.axis = command.axis;
          else if (!['SetCampaignActive', 'InteractionPresence'].includes(command.type)) controller.actions.push(command);
        }
        controller.actions = controller.actions.slice(-30); remote.set(id, controller);
      },
      snapshot: snapshot => {
        if (!session || session.host || menu.active) return;
        const now = performance.now();
        snapshotInterval = snapshotReceivedAt ? Math.max(50, Math.min(250, now - snapshotReceivedAt)) : 100;
        snapshotReceivedAt = now;
        if (snapshot.multiplayer_profile) stylesDisplay.profile = snapshot.multiplayer_profile;
        previous = state; state = { ...snapshot, local_candidate_id: session.candidateId };
        if (previous.phase !== state.phase) { previous = state; input.clear(); renderer.resetCamera(); }
      },
      ended: message => {
        returnHome(); menu.page('disconnected', 'La partie a été interrompue.', '<p id="disconnect-message" class="menu-intro" role="alert"></p><button id="back-to-home" class="menu-primary">Retour à l’accueil</button>');
        menu.element.querySelector('#disconnect-message').textContent = message;
        menu.element.querySelector('#back-to-home').onclick = () => menu.home();
      },
    }, state.config_fingerprint);
    try { await nextSession.connect(action, data); } catch (error) { nextSession.close(); throw error; }
    if (menu.generation !== generation || data.signal?.aborted) { nextSession.close(); return; }
    session = nextSession; roomChanged(session.room);
  }
  menu = new StartMenu({ prepare, play, combat: config.balance.candidate_combat, multiplayer: current => showMultiplayerSetup(current, connectRoom) });
  menu.leave = stopSession;
  window.matchMedia('(any-pointer: coarse) and (max-width: 600px) and (orientation: portrait)').addEventListener('change', () => {
    input.clear();
    if (portraitPhone() && !menu.active && !paused) togglePause(true);
  });
  if (new URLSearchParams(location.search).has('salon')) void showMultiplayerSetup(menu, connectRoom);

  function matchCommands() {
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
    if (networkBusy || networkElapsed < (session.host ? 0.1 : 0.05)) return;
    networkElapsed = 0;
    const activeSession = session;
    if (!session.host && paused) return;
    const action = session.host ? 'snapshot' : 'commands';
    const data = session.host ? { state: { ...state, multiplayer_profile: profile } } : { commands: outgoingCommands([...human.commands(state, session.candidateId), ...pending.splice(0)]) };
    networkBusy = true;
    session.request(action, data).catch(error => activeSession.fail(error.message)).finally(() => { networkBusy = false; });
  }

  function frame(now) {
    try {
      let elapsed = Math.max(0, (now - previousTime) / 1000);
      previousTime = now;
      if (wasHidden) { elapsed = 0; wasHidden = false; }
      if (menu.active) { requestAnimationFrame(frame); return; }
      if (!paused && !document.hidden && (!session || session.host)) {
        clock.advance(elapsed * simulationSpeed, () => {
          previous = state;
          const commands = [...matchCommands(), ...pending];
          const changedCamera = pending.some(c => ['DebugSelectCandidate', 'DebugTeleport', 'DebugTeleportTarget'].includes(c.type));
          pending = [];
          simulation.step(commands);
          state = simulation.getState({ presentation: true });
          const rejected = state.events.findLast(e => e.type === 'CampaignEventRejected' && e.tick >= previous.tick);
          if (rejected && !previous.events.some(e => e.id === rejected.id)) notify(rejected.reason, 4);
          if (state.phase !== previous.phase) { previous = state; renderer.resetCamera(); input.clear(); noticeRemaining = 0; }
          if (changedCamera) { previous = state; renderer.resetCamera(); input.clear(); }
        });
      }
      if (!paused && !document.hidden) { hintRemaining -= elapsed; noticeRemaining -= elapsed; }
      networkFrame(elapsed);
      matchDisplay.update(state);
      document.getElementById('replay').hidden = !!session;
      campaignDisplay.update(state);
      stylesDisplay.update(state);
      const waiting = session && state.campaign_style_selection && state.campaign_style_selection.candidate_id !== state.local_candidate_id;
      const networkStatus = document.getElementById('network-status'); networkStatus.hidden = !waiting;
      if (waiting) networkStatus.textContent = 'Un autre joueur choisit son style. La campagne reprendra dès qu’il aura terminé.';
      document.body.classList.toggle('campaign-studio', state.campaign_events.some(e => e.status === 'ACTIVE' && e.arena && e.participants.includes(state.local_candidate_id)));
      const candidate = matchDisplay.viewedCandidate(state);
      const combatView = state.phase === 'FIRST_ROUND_ARENA' ? state.arena : state.campaign_events.find(e => e.arena && e.status === 'ACTIVE' && e.participants.includes(state.local_candidate_id))?.arena || state;
      const fighter = combatView.candidates.find(c => c.id === state.local_candidate_id);
      damageFeedback.update(combatView, fighter, paused ? 1 : clock.alpha, paused || !!state.campaign_style_selection || state.phase === 'RESULTS' || state.candidates.find(c => c.id === state.local_candidate_id).eliminated);
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
      const zone = zoneAt(state.world, candidate.x);
      if (zone.id !== currentZone) { currentZone = zone.id; notify(`${zone.biome_name}\n${zone.concept}`); }
      if (state.days_remaining !== currentDay) {
        currentDay = state.days_remaining;
        if (config.balance.display.show_day_change_flash) notify(`J-${currentDay}`, config.prototype.presentation.day_flash_seconds);
      }
      const income = incomeFormat.format(incomePerSecond(state, config, candidate.faction_id));
      setText(money, `${currency.format(candidate.money)} ${config.balance.display.currency_label}\n+${income} ${config.balance.display.currency_label}/s`);
      setText(campaignBudget, `Plafond restant : ${currency.format(remainingCampaignBudget(candidate, config))} ${config.balance.display.currency_label}`);
      funds.hidden = !['CAMPAIGN', 'SECOND_ROUND_SPRINT'].includes(state.phase) || state.candidates.find(c => c.id === state.local_candidate_id).eliminated;
      document.getElementById('touch-controls').hidden = paused || !!state.campaign_style_selection || state.phase === 'RESULTS' || state.candidates.find(c => c.id === state.local_candidate_id).eliminated;
      document.getElementById('game-menu').hidden = paused || !!state.campaign_style_selection || state.phase === 'RESULTS';
      electoralDisplay.update(state, candidate.faction_id);
      if (noticeRemaining <= 0) setText(notice, '');
      hint.style.opacity = hintRemaining > 0 ? '1' : '0';
      hint.hidden = hintRemaining < -0.5 || state.phase !== 'CAMPAIGN';
      notice.hidden = state.phase === 'RESULTS';
      const viewState = candidate.id === state.local_candidate_id ? state : { ...state, local_candidate_id: candidate.id };
      const renderAlpha = session && !session.host ? Math.min(1, (now - snapshotReceivedAt) / snapshotInterval) : clock.alpha;
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
