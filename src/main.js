import { loadConfig } from './config.js';
import { incomePerSecond } from './simulation/territory.js';
import { GameSimulation } from './simulation/game-simulation.js';
import { FixedClock } from './simulation/fixed-clock.js';
import { AIController, LocalHumanController, collectCommands } from './simulation/controllers.js';
import { zoneAt } from './simulation/world.js';
import { WorldRenderer } from './presentation/renderer.js';
import { BrowserInput } from './presentation/input.js';
import { DebugPanel } from './presentation/debug.js';
import { ElectoralDisplay } from './presentation/electoral.js';
import { MatchDisplay } from './presentation/match.js';

function showError(error) {
  console.error(error);
  const element = document.getElementById('error');
  element.hidden = false;
  element.textContent = `Le jeu n’a pas pu démarrer : ${error.message}. Vérifie ta connexion et recharge la page. Si tu joues depuis les fichiers de ton ordinateur, utilise « Lancer le jeu.cmd ».`;
}

async function start() {
  const config = await loadConfig();
  let simulation = new GameSimulation(config);
  let state = simulation.getState();
  let previous = state;
  const clock = new FixedClock(config.balance.simulation_architecture.fixed_tick_hz);
  const human = new LocalHumanController();
  const ai = new AIController(config);
  const canvas = document.getElementById('world');
  const renderer = new WorldRenderer(canvas, config);
  const electoralDisplay = new ElectoralDisplay(config);
  const matchDisplay = new MatchDisplay(config, {
    follow: () => { renderer.resetCamera(); canvas.focus(); },
    replay: () => restartMatch(false), return: () => restartMatch(true),
  });
  const help = document.getElementById('help');
  const money = document.getElementById('money');
  const notice = document.getElementById('notice');
  const hint = document.getElementById('hint');
  if (window.matchMedia('(any-pointer: coarse)').matches) hint.textContent = 'Maintiens une flèche pour marcher · Frapper pour attaquer · Pause pour l’aide';
  let pending = [];
  let paused = false;
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
    simulation = new GameSimulation(config, seed, state.local_candidate_id);
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
    paused = force; help.hidden = !paused || !showHelp; input.clear(); clock.reset();
    if (!paused || !showHelp) canvas.focus();
    else document.getElementById('resume').focus();
  }
  const input = new BrowserInput(canvas, human, async key => {
    if ([' ', 'j', 'attack'].includes(key)) { if (!paused) human.attack(); }
    else if (['h', 'escape', 'p'].includes(key)) togglePause();
    else if (key === 'f3') debug.toggle();
    else if (key === 'f') {
      try {
        if (document.fullscreenElement) await document.exitFullscreen();
        else await document.documentElement.requestFullscreen();
      } catch { notify('Le plein écran est indisponible dans ce navigateur.'); }
    } else debug.action(key);
  }, config.layout.visual_layout.camera_anchor_x_ratio, config.prototype.presentation.touch_pause_radius_ratio);
  document.getElementById('resume').addEventListener('click', () => togglePause(false));
  document.addEventListener('visibilitychange', () => {
    // A hidden local tab pauses the session clock, not off-camera entities.
    // The simulation itself has no document/window/camera dependency.
    wasHidden = true; input.clear(); clock.reset();
    if (!document.hidden) previousTime = performance.now();
  });
  // Help values follow the configuration too.
  const durationText = document.getElementById('balance-help');
  const format = number => number.toLocaleString('fr-FR', { maximumFractionDigits: 2 });
  document.getElementById('poll-help').textContent = `La Tour renforce doucement l’influence dans le monde entier. L’Institut révèle le cercle et les scores : un nouveau sondage arrive toutes les ${format(config.balance.buildings.institut_sondage.poll_refresh_seconds)} secondes. Un Institut fermé conserve sa dernière mesure, qui devient grisée. Le cercle suit le monde dans le sens des aiguilles d’une montre, depuis Paris à midi.`;
  durationText.textContent = `Permanence : ${config.balance.buildings.permanence.required_local_sympathisants} Sympathisants locaux, ${format(config.balance.buildings.permanence.build_cost)} k €. Financement : ${config.balance.buildings.financement.required_local_sympathisants} locaux, ${format(config.balance.buildings.financement.build_cost)} k €. Un tract : ${format(config.balance.buildings.imprimerie.tract_cost_by_level[0])} k €. Mélenchon convainc en ${format(config.balance.persuasion.candidate_base_seconds * config.balance.persuasion.melenchon_personal_time_multiplier)} s ; les autres en ${format(config.balance.persuasion.candidate_base_seconds)} s, les Militants en ${format(config.balance.persuasion.militant_base_seconds)} s, hors bonus de Permanence.`;
  const currency = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: config.balance.display.currency_precision_decimals });
  canvas.focus();

  function frame(now) {
    try {
      let elapsed = Math.max(0, (now - previousTime) / 1000);
      previousTime = now;
      if (wasHidden) { elapsed = 0; wasHidden = false; }
      if (!paused && !document.hidden) {
        clock.advance(elapsed * simulationSpeed, () => {
          previous = state;
          const commands = [...collectCommands(state, human, ai), ...pending];
          const changedCamera = pending.some(c => ['DebugSelectCandidate', 'DebugTeleport', 'DebugTeleportTarget'].includes(c.type));
          pending = [];
          simulation.step(commands);
          state = simulation.getState();
          if (state.phase !== previous.phase) { previous = state; renderer.resetCamera(); input.clear(); noticeRemaining = 0; }
          if (changedCamera) { previous = state; renderer.resetCamera(); input.clear(); }
        });
        hintRemaining -= elapsed;
        noticeRemaining -= elapsed;
      }
      matchDisplay.update(state);
      const candidate = matchDisplay.viewedCandidate(state);
      const zone = zoneAt(state.world, candidate.x);
      if (zone.id !== currentZone) { currentZone = zone.id; notify(`${zone.biome_name}\n${zone.concept}`); }
      if (state.days_remaining !== currentDay) {
        currentDay = state.days_remaining;
        if (config.balance.display.show_day_change_flash) notify(`J-${currentDay}`, config.prototype.presentation.day_flash_seconds);
      }
      const income = incomePerSecond(state, config, candidate.faction_id).toLocaleString('fr-FR', { maximumFractionDigits: 2 });
      money.textContent = `${currency.format(candidate.money)} ${config.balance.display.currency_label}\n+${income} ${config.balance.display.currency_label}/s`;
      money.hidden = !['CAMPAIGN', 'SECOND_ROUND_SPRINT'].includes(state.phase) || state.candidates.find(c => c.id === state.local_candidate_id).eliminated;
      document.getElementById('touch-controls').hidden = paused || state.phase === 'RESULTS' || state.candidates.find(c => c.id === state.local_candidate_id).eliminated;
      document.getElementById('game-menu').hidden = paused || state.phase === 'RESULTS';
      electoralDisplay.update(state, candidate.faction_id);
      if (noticeRemaining <= 0) notice.textContent = '';
      hint.style.opacity = hintRemaining > 0 ? '1' : '0';
      hint.hidden = hintRemaining < -0.5 || state.phase !== 'CAMPAIGN';
      notice.hidden = state.phase === 'FIRST_ROUND_ARENA' || state.phase === 'RESULTS';
      const viewState = candidate.id === state.local_candidate_id ? state : { ...state, local_candidate_id: candidate.id };
      renderer.draw(viewState, paused ? viewState : previous, paused ? 1 : clock.alpha, Math.min(elapsed, config.prototype.presentation.max_presentation_frame_seconds), debug.visible);
      debugElapsed += elapsed;
      if (debugElapsed >= config.prototype.debug.refresh_seconds) { debug.update(state, elapsed > 0 ? 1 / elapsed : 0); debugElapsed = 0; }
      requestAnimationFrame(frame);
    } catch (error) { showError(error); }
  }
  requestAnimationFrame(frame);
}

start().catch(showError);
