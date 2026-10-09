import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SnapshotBuffer } from '../src/network/snapshot-buffer.js';

const dt = 1 / 30;
// Position affichée : interpolée entre les deux états du tampon.
const shown = view => view.previous.x + (view.state.x - view.previous.x) * view.alpha;

test('Tampon invité : mouvement régulier malgré des paquets en grappes', () => {
  const buffer = new SnapshotBuffer(dt);
  // L'hôte envoie un état tous les 2 ticks ; un personnage avance d'une unité par tick.
  // Les paquets arrivent avec 40 à 160 ms de retard, parfois groupés.
  let seed = 7;
  const random = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const arrivals = [];
  // Canal ordonné : un paquet retardé retient ceux qui le suivent (arrivées groupées).
  for (let tick = 0, at = 0; tick <= 300; tick += 2) {
    at = Math.max(at, tick * dt + 0.04 + random() * 0.12);
    arrivals.push({ at, state: { tick, x: tick } });
  }
  let next = 0, last = null, maxStep = 0, backwards = 0;
  for (let now = 0.5; now < 9.5; now += 1 / 60) {
    while (next < arrivals.length && arrivals[next].at <= now) { buffer.push(arrivals[next].state, arrivals[next].at); next++; }
    const view = buffer.sample(now);
    if (!view) continue;
    const x = shown(view);
    if (last !== null) { maxStep = Math.max(maxStep, x - last); if (x < last - 1e-9) backwards++; }
    last = x;
  }
  // 60 images/s pour 30 unités/s : 0,5 unité par image. Aucun saut ni recul.
  assert.equal(backwards, 0);
  assert.ok(maxStep < 1.6, `saut de ${maxStep}`);
  assert.ok(buffer.delay <= 0.35);
});

test('Tampon invité : une nouvelle partie repart de zéro', () => {
  const buffer = new SnapshotBuffer(dt);
  buffer.push({ tick: 900, x: 1 }, 1); buffer.push({ tick: 902, x: 2 }, 1.07);
  buffer.push({ tick: 0, x: 9 }, 2);
  assert.equal(buffer.latest.x, 9);
  assert.equal(buffer.sample(2.1).state.x, 9);
});

test('Tampon invité : après une pause de l’hôte, le mouvement redevient fluide en moins de 2 s', () => {
  const buffer = new SnapshotBuffer(dt);
  // Un état par tick, 20 ms de réseau ; l’hôte s’arrête 5 s (pause, appli en arrière-plan).
  const arrivals = [];
  for (let tick = 0; tick <= 600; tick++) arrivals.push({ at: tick * dt + (tick > 150 ? 5 : 0) + 0.02, state: { tick, x: tick } });
  let next = 0, frozen = 0, frames = 0;
  for (let now = 0.5; now < arrivals.at(-1).at; now += 1 / 60) {
    while (next < arrivals.length && arrivals[next].at <= now) { buffer.push(arrivals[next].state, arrivals[next].at); next++; }
    const view = buffer.sample(now);
    // Compté à partir de 2 s après la reprise.
    if (now < 5 + 150 * dt + 2) continue;
    frames++;
    if (view.alpha === 1 && view.state === buffer.latest) frozen++;
  }
  // Avant la correction : figé sur le dernier état reçu presque tout le temps, pendant des minutes.
  assert.ok(frozen / frames < 0.05, `${frozen} images figées sur ${frames}`);
});
