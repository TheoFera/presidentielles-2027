import test from 'node:test';
import assert from 'node:assert/strict';
import { BrowserInput } from '../src/presentation/input.js';
import { CampaignStylesDisplay } from '../src/presentation/campaign-styles.js';
import { normalizeCampaignProfile } from '../src/simulation/campaign-styles.js';
import { config } from '../scripts/game-config.mjs';
import { GameSimulation } from '../src/simulation/game-simulation.js';
import { captureSite } from '../src/simulation/strategic-sites.js';

test('Neuf cartes, trois par candidat : choix obligatoire et deux cadenas', t => {
  class Node extends EventTarget {
    children = []; dataset = {}; style = { setProperty() {} }; classes = new Set(); open = false;
    classList = { toggle: (name, enabled) => enabled ? this.classes.add(name) : this.classes.delete(name) };
    append(...nodes) { this.children.push(...nodes); }
    replaceChildren(...nodes) { this.children = nodes; }
    setAttribute() {}
    getContext() { return {}; }
    showModal() { this.open = true; }
    close() { this.open = false; }
    focus() {}
    querySelector() { return this.children.find(n => !n.disabled); }
  }
  const previous = { document: globalThis.document, window: globalThis.window, Image: globalThis.Image };
  const doc = new Node(); doc.createElement = () => new Node(); doc.body = new Node(); doc.getElementById = () => null;
  globalThis.document = doc; globalThis.window = new Node(); globalThis.Image = class {};
  t.after(() => { for (const [key, value] of Object.entries(previous)) { if (value === undefined) delete globalThis[key]; else globalThis[key] = value; } });
  const ids = new Set();
  for (const faction of ['melenchon', 'le_pen', 'philippe']) {
    const sim = new GameSimulation(config, 42, `candidate:${faction}`), c = sim.state.candidates.find(c => c.faction_id === faction);
    const hq = sim.state.buildings.find(b => b.type === 'permanence'); captureSite(sim, hq, c); c.x = hq.x;
    const display = new CampaignStylesDisplay(config, normalizeCampaignProfile(), command => sim.applyCommand(command), () => {});
    display.update(sim.state);
    assert.equal(display.dialog.open, true);
    assert.equal(display.dialog.children.length, 3, 'Aucun bouton Annuler au premier choix');
    const choices = display.dialog.children[2].children;
    assert.equal(choices.length, 3); assert.equal(choices.filter(c => c.disabled).length, 2);
    for (const choice of choices) { assert.ok(choice.children[2].textContent); assert.ok(choice.children[5].textContent); ids.add(faction + ':' + choice.children[2].textContent); }
    choices[0].dispatchEvent(new Event('click')); display.update(sim.state); assert.equal(display.dialog.open, false);
    assert.ok(c.current_campaign_style);
  }
  assert.equal(ids.size, 9);
});

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
  assert.deepEqual(actions, ['attack-press', 'attack-release']);
  get('move-right').send('pointerup', { pointerId: 1 });
  assert.equal(human.axis, 0);
});

test('Frapper au clavier : maintien sans répétition et un seul relâchement pour Espace/J', t => {
  const { win, actions } = setup(t);
  win.send('keydown', { key: ' ', repeat: false });
  win.send('keydown', { key: ' ', repeat: true });
  win.send('keydown', { key: 'j', repeat: false });
  win.send('keyup', { key: ' ' });
  assert.deepEqual(actions, ['attack-press']);
  win.send('keyup', { key: 'j' });
  assert.deepEqual(actions, ['attack-press', 'attack-release']);
});

test('Annulation tactile et perte de focus : aucun relâchement ne déclenche une frappe', t => {
  const { get, win, actions } = setup(t);
  get('attack-touch').send('pointerdown'); get('attack-touch').send('pointercancel'); get('attack-touch').send('pointerup');
  assert.deepEqual(actions, ['attack-press', 'attack-cancel']);
  win.send('keydown', { key: ' ', repeat: false }); win.send('blur'); win.send('keyup', { key: ' ' });
  assert.equal(actions.at(-1), 'attack-press');
});

test('Flèche haut : commande de saut distincte, sans répétition automatique', t => {
  const { win, actions, human } = setup(t);
  win.send('keydown', { key: 'ArrowUp', repeat: false }); win.send('keydown', { key: 'ArrowUp', repeat: true });
  assert.deepEqual(actions, ['arrowup']); assert.equal(human.axis, 0);
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

test('Double appui directionnel : relâchement obligatoire, maintien et répétitions ignorés', t => {
  const { get, actions, win } = setup(t);
  get('move-left').send('pointerdown'); get('move-left').send('pointerdown');
  assert.deepEqual(actions, []);
  get('move-left').send('pointerup'); get('move-left').send('lostpointercapture'); get('move-left').send('pointerdown');
  assert.deepEqual(actions, ['dash-left']);
  get('move-left').send('pointerdown'); assert.equal(actions.length, 1);
  win.send('blur');
  win.send('keydown', { key:'d', repeat:false }); win.send('keydown', { key:'d', repeat:true }); assert.equal(actions.length,1);
  win.send('keyup',{key:'d'}); win.send('keydown',{key:'d',repeat:false}); assert.deepEqual(actions,['dash-left','dash-right']);
});
test('Deux directions différentes ou annulation tactile ne déclenchent pas de dash', t => {
  const { get, actions } = setup(t);
  get('move-left').send('pointerdown'); get('move-left').send('pointerup');
  get('move-right').send('pointerdown'); get('move-right').send('pointercancel'); get('move-right').send('pointerdown');
  assert.deepEqual(actions, []);
});
