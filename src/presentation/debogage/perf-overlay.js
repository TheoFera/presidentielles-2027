/**
 * Mesures de fluidité à l'écran, pour les téléphones : ajouter `?perf` à l'adresse du jeu.
 * Rien n'est chargé ni mesuré sans ce paramètre. Toutes les 0,5 s, sur les 5 dernières secondes :
 * images par seconde, pire écart entre deux images, images de plus de 33 et 50 ms, puis temps moyen et
 * maximal par image de la simulation, de l'ordinateur (IA) et du dessin, et la mémoire JavaScript.
 * Les pas de simulation et les décisions de l'ordinateur sont mesurés, jamais modifiés.
 */
import { GameSimulation } from '../../simulation/game-simulation.js';
import { AIController } from '../../simulation/controllers.js';

const WINDOW_MS = 5000;

export { perfWanted } from './perf-wanted.js';

/** Mesure le temps passé dans `object[name]` et l'ajoute au compteur de l'image en cours. */
function timeMethod(object, name, counters, key) {
  const original = object[name];
  object[name] = function (...args) {
    const start = performance.now();
    try { return original.apply(this, args); } finally { counters[key] += performance.now() - start; }
  };
}

/** Résumé lisible des images des cinq dernières secondes (exporté pour les tests). */
export function perfSummary(frames, memoryMiB = null) {
  if (!frames.length) return 'Mesures en cours…';
  const span = Math.max(1, frames.at(-1).time - frames[0].time);
  const gaps = frames.map(f => f.gap);
  const stat = key => {
    let sum = 0, max = 0;
    for (const f of frames) { sum += f[key]; if (f[key] > max) max = f[key]; }
    return `${(sum / frames.length).toFixed(1)}/${max.toFixed(1)}`;
  };
  return [
    `${Math.round(frames.length * 1000 / span)} i/s · pire ${Math.round(Math.max(...gaps))} ms · >33 ms : ${gaps.filter(g => g > 33.4).length} · >50 ms : ${gaps.filter(g => g > 50).length}`,
    `pas ${stat('step')} · IA ${stat('ai')} · dessin ${stat('draw')} ms (moy./max)`,
    memoryMiB == null ? '' : `mémoire JS ${Math.round(memoryMiB)} Mio`,
  ].filter(Boolean).join('\n');
}

export function installPerfOverlay(renderer) {
  const counters = { step: 0, ai: 0, draw: 0 };
  timeMethod(GameSimulation.prototype, 'step', counters, 'step');
  timeMethod(AIController.prototype, 'commands', counters, 'ai');
  const panel = document.createElement('pre');
  panel.id = 'perf-overlay';
  Object.assign(panel.style, { position: 'fixed', left: '50%', top: '4px', transform: 'translateX(-50%)', zIndex: 99, margin: 0, padding: '3px 6px',
    font: '11px/1.35 ui-monospace, monospace', color: '#fff', background: '#000a', borderRadius: '4px', pointerEvents: 'none', whiteSpace: 'pre' });
  document.body.append(panel);
  // Une entrée par image réellement dessinée (sur téléphone, une image sur deux à 120 Hz) : simulation et
  // ordinateur joués depuis l'image précédente, puis le dessin.
  const frames = [];
  let last = null, shown = 0;
  const draw = renderer.draw;
  renderer.draw = function (...args) {
    const start = performance.now();
    try { return draw.apply(this, args); } finally {
      const now = performance.now();
      if (last != null) frames.push({ time: now, gap: start - last, step: counters.step, ai: counters.ai, draw: now - start });
      counters.step = 0; counters.ai = 0;
      last = start;
      while (frames.length && now - frames[0].time > WINDOW_MS) frames.shift();
      if (now - shown > 500) {
        shown = now;
        panel.textContent = perfSummary(frames, performance.memory ? performance.memory.usedJSHeapSize / 1048576 : null);
      }
    }
  };
}
