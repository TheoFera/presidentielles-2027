import test from 'node:test';
import assert from 'node:assert/strict';
import { BrowserInput } from '../src/presentation/input.js';

class Element extends EventTarget {
  tagName = 'BUTTON';
  setPointerCapture() {}
  focus() {}
  getBoundingClientRect() { return { left: 0, width: 1000 }; }
  send(type, values = {}) {
    const event = new Event(type, { cancelable: true });
    Object.assign(event, { pointerId: 1, pointerType: 'touch', button: 0, ...values });
    this.dispatchEvent(event);
  }
}

function setup(t) {
  const win = new Element();
  const doc = new Element();
  const elements = new Map(['attack-touch', 'move-left', 'move-right', 'pause-touch', 'fullscreen-touch'].map(id => [id, new Element()]));
  doc.getElementById = id => elements.get(id);
  const oldWindow = globalThis.window, oldDocument = globalThis.document;
  globalThis.window = win; globalThis.document = doc;
  t.after(() => {
    if (oldWindow === undefined) delete globalThis.window; else globalThis.window = oldWindow;
    if (oldDocument === undefined) delete globalThis.document; else globalThis.document = oldDocument;
  });
  const human = { axis: 0, setAxis(axis) { this.axis = axis; }, reset() { this.axis = 0; } };
  const actions = [];
  const canvas = new Element();
  const input = new BrowserInput(canvas, human, action => actions.push(action), 0.5, 0.05);
  return { win, doc, human, actions, canvas, input, get: id => elements.get(id) };
}

test('Deux pouces : marcher et frapper sans interrompre le déplacement', t => {
  const { get, human, actions } = setup(t);
  get('move-right').send('pointerdown', { pointerId: 1 });
  get('attack-touch').send('pointerdown', { pointerId: 2 });
  get('attack-touch').send('pointerup', { pointerId: 2 });
  assert.equal(human.axis, 1);
  assert.deepEqual(actions, ['attack']);
  get('move-right').send('pointerup', { pointerId: 1 });
  assert.equal(human.axis, 0);
});

test('Deux directions opposées et relâchement indépendant des doigts', t => {
  const { get, human } = setup(t);
  get('move-left').send('pointerdown', { pointerId: 1 });
  assert.equal(human.axis, -1);
  get('move-right').send('pointerdown', { pointerId: 2 });
  assert.equal(human.axis, 0);
  get('move-right').send('pointercancel', { pointerId: 2 });
  assert.equal(human.axis, -1);
  get('move-right').send('lostpointercapture', { pointerId: 2 });
  assert.equal(human.axis, -1);
  get('move-left').send('lostpointercapture', { pointerId: 1 });
  assert.equal(human.axis, 0);
});

test('Pause, changement d’onglet et perte de focus libèrent les commandes', t => {
  const { get, win, doc, input, human, actions } = setup(t);
  for (const clear of [() => input.clear(), () => win.send('blur'), () => { doc.hidden = true; doc.send('visibilitychange'); }]) {
    get('move-left').send('pointerdown');
    clear();
    assert.equal(human.axis, 0);
    assert.equal(input.pointers.size, 0);
  }
  get('pause-touch').send('click');
  get('fullscreen-touch').send('click');
  assert.deepEqual(actions, ['h', 'f']);
});

test('Le clavier et le déplacement tactile sur le monde restent disponibles', t => {
  const { canvas, win, human } = setup(t);
  win.send('keydown', { key: 'd' });
  assert.equal(human.axis, 1);
  win.send('keyup', { key: 'd' });
  assert.equal(human.axis, 0);
  canvas.send('pointerdown', { clientX: 100 });
  assert.equal(human.axis, -1);
  canvas.send('pointercancel');
  assert.equal(human.axis, 0);
});
