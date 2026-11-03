import test from 'node:test';
import assert from 'node:assert/strict';
import { perfWanted } from '../src/presentation/debogage/perf-wanted.js';
import { perfSummary } from '../src/presentation/debogage/perf-overlay.js';

test('Mesures de fluidité affichées seulement avec ?perf', () => {
  assert.equal(perfWanted(''), false);
  assert.equal(perfWanted('?perf'), true);
  assert.equal(perfWanted('?salon=AB12&perf=1'), true);
});

test('Résumé des mesures : cadence, images lentes et temps par poste', () => {
  const frames = Array.from({ length: 60 }, (_, i) => ({ time: i * 16.7, gap: i === 30 ? 70 : 16.7, step: i % 2 ? 2 : 0, ai: 1, draw: 3 }));
  const text = perfSummary(frames, 21.4);
  assert.match(text, /^\d+ i\/s · pire 70 ms · >33 ms : 1 · >50 ms : 1/);
  assert.match(text, /pas 1\.0\/2\.0 · IA 1\.0\/1\.0 · dessin 3\.0\/3\.0 ms/);
  assert.match(text, /mémoire JS 21 Mio/);
  assert.equal(perfSummary([]), 'Mesures en cours…');
});
