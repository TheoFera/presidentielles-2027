import test from 'node:test';
import assert from 'node:assert/strict';
import { shouldDrawFrame } from '../src/presentation/rendu/frame-cadence.js';

// Images dessinées pour une suite d'appels de requestAnimationFrame à la fréquence de l'écran.
const drawn = rates => {
  let now = 0, last = -Infinity; const gaps = [];
  for (const [hz, count] of rates) for (let i = 0; i < count; i++) {
    now += 1000 / hz;
    if (shouldDrawFrame(now, last)) { if (last > -Infinity) gaps.push(+(now - last).toFixed(2)); last = now; }
  }
  return gaps;
};

test('120 Hz : une image sur deux, toutes les 16,7 ms', () => {
  for (const gap of drawn([[120, 240]])) assert.equal(gap, 16.67);
});

test('60 et 90 Hz : toutes les images', () => {
  for (const gap of drawn([[60, 120]])) assert.equal(gap, 16.67);
  for (const gap of drawn([[90, 180]])) assert.equal(gap, 11.11);
});

test('Changement de fréquence de l’écran : au plus un léger à-coup, jamais 30 images par seconde', () => {
  // L'ancien régulateur tombait à 30 images par seconde pendant une demi-seconde après un passage de 120 à 60 Hz.
  const gaps = drawn([[120, 120], [60, 60], [120, 120], [60, 60]]);
  const late = gaps.filter(gap => gap > 17.5);
  assert.ok(late.length <= 3, `${late.length} images en retard`); // au plus une par changement
  assert.ok(late.every(gap => gap <= 25.01), late.join(', '));
});
