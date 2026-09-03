import { loadConfig } from './config.js';
import { GameSimulation } from './simulation/game-simulation.js';
import { FixedClock } from './simulation/fixed-clock.js';
import { AIController, LocalHumanController, collectCommands } from './simulation/controllers.js';
import { zoneAt } from './simulation/world.js';
import { WorldRenderer } from './presentation/renderer.js';
import { BrowserInput } from './presentation/input.js';
import { DebugPanel } from './presentation/debug.js';

function showError(error) {
  console.error(error);
  const element = document.getElementById('error');
  element.hidden = false;
  element.textContent = `Le prototype n’a pas pu fonctionner : ${error.message}. Lance « Lancer le jeu.cmd » puis ouvre http://localhost:2027. Si le serveur est déjà lancé, consulte le terminal et recharge la page.`;
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
  const help = document.getElementById('help');
  const money = document.getElementById('money');
  const notice = document.getElementById('notice');
  const hint = document.getElementById('hint');
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
    currentDay = state.days_remaining;
    currentZone = zoneAt(state.world, state.candidates.find(c => c.id === state.local_candidate_id).x).id;
  };
  const debug = new DebugPanel(config, {
    state: () => state, queue, notify,
    paused: () => paused, speed: () => simulationSpeed,
    togglePause: () => togglePause(!paused, false),
    toggleSpeed: () => { simulationSpeed = simulationSpeed === 1 ? config.balance.debug.acceleration_multiplier : 1; canvas.focus(); },
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
      simulation = new GameSimulation(config, seed); resetPresentation(); simulationSpeed = 1;
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
  durationText.textContent = `Permanence : ${config.balance.buildings.permanence.required_local_sympathisants} Sympathisants locaux, ${format(config.balance.buildings.permanence.build_cost)} k €. Financement : ${config.balance.buildings.financement.required_local_sympathisants} locaux, ${format(config.balance.buildings.financement.build_cost)} k €. Un tract : ${format(config.balance.buildings.imprimerie.tract_cost_by_level[0])} k €. Mélenchon convainc en ${format(config.balance.persuasion.candidate_base_seconds * config.balance.persuasion.melenchon_personal_time_multiplier)} s ; les autres en ${format(config.balance.persuasion.candidate_base_seconds)} s, les Militants en ${format(config.balance.persuasion.militant_base_seconds)} s, hors bonus de Permanence.`;
  const currency = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: config.balance.display.currency_precision_decimals });
  notify(`J-${state.days_remaining}`, config.prototype.presentation.day_flash_seconds);
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
          if (changedCamera) { previous = state; renderer.resetCamera(); input.clear(); }
        });
        hintRemaining -= elapsed;
        noticeRemaining -= elapsed;
      }
      const candidate = state.candidates.find(c => c.id === state.local_candidate_id);
      const zone = zoneAt(state.world, candidate.x);
      if (zone.id !== currentZone) { currentZone = zone.id; notify(`${zone.biome_name}\n${zone.concept}`); }
      if (state.days_remaining !== currentDay) {
        currentDay = state.days_remaining;
        if (config.balance.display.show_day_change_flash) notify(`J-${currentDay}`, config.prototype.presentation.day_flash_seconds);
      }
      money.textContent = `${currency.format(candidate.money)} ${config.balance.display.currency_label}`;
      if (noticeRemaining <= 0) notice.textContent = '';
      hint.style.opacity = hintRemaining > 0 ? '1' : '0';
      hint.hidden = hintRemaining < -0.5;
      renderer.draw(state, paused ? state : previous, paused ? 1 : clock.alpha, Math.min(elapsed, config.prototype.presentation.max_presentation_frame_seconds), debug.visible);
      debugElapsed += elapsed;
      if (debugElapsed >= config.prototype.debug.refresh_seconds) { debug.update(state, elapsed > 0 ? 1 / elapsed : 0); debugElapsed = 0; }
      requestAnimationFrame(frame);
    } catch (error) { showError(error); }
  }
  requestAnimationFrame(frame);
}

start().catch(showError);
