import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { guardGameZoom } from '../src/presentation/interface/zoom-guard.js';

const element = (selectors) => ({ closest: selector => selector.split(', ').some(s => selectors.includes(s)) ? {} : null });
const touch = (type, target, touches = 1) => {
  const event = new Event(type, { cancelable: true }); Object.assign(event, { touches: { length: touches } });
  Object.defineProperty(event, 'target', { value: target }); return event;
};

test('Safari iOS : pas de zoom en avançant et en frappant', () => {
  const doc = new EventTarget(); let time = 0;
  guardGameZoom(doc, { now: () => time });
  const arrow = element(['#game', '#touch-controls button']), menuButton = element(['button:not(#touch-controls button)']);
  const send = event => { doc.dispatchEvent(event); return event.defaultPrevented; };
  assert.equal(send(touch('touchend', arrow)), false, 'Un appui seul reste normal');
  time = 200; assert.equal(send(touch('touchend', arrow)), true, 'Le second appui rapproché ne zoome pas');
  time = 1000; assert.equal(send(touch('touchend', arrow)), false);
  assert.equal(send(touch('touchmove', arrow, 2)), true, 'Pas de pincement à deux pouces');
  assert.equal(send(touch('gesturestart', arrow)), true);
  time = 1100; assert.equal(send(touch('touchend', menuButton)), false, 'Les menus gardent leurs clics');
  time = 1200; assert.equal(send(touch('touchend', element(['#game', 'button:not(#touch-controls button)']))), false, 'Les boutons du jeu hors commandes aussi');
});

test('La page interdit le zoom et les commandes tactiles bloquent les gestes', () => {
  assert.match(readFileSync('index.html', 'utf8'), /name="viewport" content="[^"]*maximum-scale=1, user-scalable=no/);
  assert.match(readFileSync('src/style.css', 'utf8'), /#touch-controls \{ touch-action: none;/);
});
