import test from 'node:test';
import assert from 'node:assert/strict';
import { FramePacer } from '../src/presentation/frame-pacing.js';

const drawn = (hz, frames = 240, jitter = 0) => {
  const pacer = new FramePacer(), times = [];
  for (let i = 0; i < frames; i++) {
    const now = i * 1000 / hz + (i % 2 ? jitter : -jitter);
    if (pacer.shouldDraw(now)) times.push(now);
  }
  // Après la mesure de l'écran (les premières images), écarts entre deux images dessinées.
  return times.slice(20).map((t, i, list) => i ? t - list[i - 1] : null).slice(1);
};

test('À 120 Hz, une image sur deux, à intervalles égaux de 16,7 ms', () => {
  for (const gap of drawn(120)) assert.ok(Math.abs(gap - 1000 / 60) < 0.01, gap);
  for (const gap of drawn(120, 240, 0.6)) assert.ok(Math.abs(gap - 1000 / 60) < 1.3, gap);
});

test('À 60 et 90 Hz, toutes les images sont dessinées', () => {
  for (const hz of [60, 90]) for (const gap of drawn(hz)) assert.ok(Math.abs(gap - 1000 / hz) < 0.01, `${hz} Hz : ${gap}`);
});

test('À 144 Hz, une image sur deux ; à 240 Hz, une sur quatre', () => {
  for (const gap of drawn(144)) assert.ok(Math.abs(gap - 2000 / 144) < 0.01, gap);
  for (const gap of drawn(240)) assert.ok(Math.abs(gap - 4000 / 240) < 0.01, gap);
});
