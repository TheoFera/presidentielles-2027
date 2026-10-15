import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { campaignConfig } from '../scripts/validate-campaign.mjs';
import { GameSimulation } from '../src/simulation/game-simulation.js';
import { ElectoralDisplay, territoryColors } from '../src/presentation/carte/electoral.js';
import { MapWheel, mapNeutralColor } from '../src/presentation/interface/map-wheel.js';
import { mapWheelAtlas, mapWheelIcons } from '../src/presentation/interface/map-wheel-icons.js';
import { interpolatedPlayerX } from '../src/presentation/rendu/player-position.js';

const config = campaignConfig();
function documentFor(t) {
  class Element {
    children = []; attributes = {}; style = {}; hidden = false; textContent = '';
    classes = new Set();
    classList = { toggle: (name, active) => active ? this.classes.add(name) : this.classes.delete(name) };
    constructor(tag) { this.tag = tag; }
    setAttribute(name, value) { this.attributes[name] = String(value); }
    append(...children) { this.children.push(...children); }
    replaceChildren(...children) { this.children = children; }
  }
  const old = globalThis.document;
  const nodes = new Map();
  globalThis.document = {
    createElement: tag => new Element(tag), createElementNS: (_, tag) => new Element(tag),
    getElementById: id => { if (!nodes.has(id)) nodes.set(id, new Element('div')); return nodes.get(id); },
  };
  t.after(() => { if (old === undefined) delete globalThis.document; else globalThis.document = old; });
  return id => document.getElementById(id);
}
const descendants = node => [node, ...(node.children || []).flatMap(descendants)];
const stateFor = () => new GameSimulation(config, 42).state;

test('La planche validée est conservée sans retouche et les découpes restent dans son image', async () => {
  const source = await readFile(mapWheelAtlas.file);
  assert.equal(createHash('sha256').update(source).digest('hex'), 'e34a227cfaf9ea263f2827621e7104ef28ebfe97453570e1182c5f863f69a5de');
  assert.equal(source.readUInt32BE(16), mapWheelAtlas.width);
  assert.equal(source.readUInt32BE(20), mapWheelAtlas.height);
  for (const [x, y, width, height] of Object.values(mapWheelIcons)) {
    assert.ok(x >= 0 && y >= 0 && width > 0 && height > 0);
    assert.ok(x + width <= mapWheelAtlas.width && y + height <= mapWheelAtlas.height);
  }
});

test('Carte complète sans sondage : 18 dessins, 6 biomes et géométrie conservée', t => {
  const node = documentFor(t), state = stateFor();
  const display = new ElectoralDisplay(config), candidate = state.candidates[0];
  display.update(state, candidate);
  assert.equal(node('electoral-circle').hidden, false);
  assert.equal(node('poll-scores').hidden, true);
  assert.equal(display.wheel.sectors.size, 18);
  assert.deepEqual([...display.wheel.sectors.keys()], state.world.subzones.map(z => z.id));
  for (const sector of display.wheel.sectors.values()) assert.equal(sector.attributes.fill, mapNeutralColor);
  const all = descendants(display.wheel.svg);
  assert.equal(all.filter(n => n.attributes?.class === 'map-biome-divider').length, 6);
  assert.equal(all.filter(n => n.attributes?.class === 'map-zone-divider').length, 12);
  assert.equal(all.filter(n => n.attributes?.['data-biome']).length, 6);
  const icons = all.filter(n => n.attributes?.['data-icon']);
  assert.equal(icons.length, 18);
  assert.equal(new Set(Object.values(mapWheelIcons).map(JSON.stringify)).size, 18);
  icons.forEach((icon, i) => {
    assert.ok(mapWheelIcons[state.world.subzones[i].id]);
    const images = descendants(icon).filter(n => n.tag === 'image');
    assert.equal(images.length, 1);
    assert.equal(images[0].attributes.href, mapWheelAtlas.file.href);
    assert.equal(images[0].attributes['data-crop'], mapWheelIcons[state.world.subzones[i].id].join(' '));
    const angle = Number(icon.attributes.transform.match(/rotate\(([^)]+)\)/)[1]);
    assert.ok(Math.abs(angle - (i + 0.5) * 20) < 1e-8);
    // Le vecteur du bas du dessin (+y local) pointe vers le centre de la roue.
    const radians = angle * Math.PI / 180;
    const position = icon.attributes.transform.match(/translate\(([^ ]+) ([^)]+)\)/);
    const inward = [160 - Number(position[1]), 160 - Number(position[2])];
    assert.ok(-Math.sin(radians) * inward[0] + Math.cos(radians) * inward[1] > 0);
  });
  const svg = display.wheel.svg, rotor = display.wheel.rotor;
  candidate.x += 1;
  display.update(structuredClone(state), candidate);
  assert.equal(display.wheel.svg, svg);
  assert.equal(display.wheel.rotor, rotor);
  assert.match(svg.attributes['aria-label'], /Position du joueur en haut/);
});

test('Rotation continue à droite, à gauche et au raccord du monde', t => {
  const node = documentFor(t), state = stateFor();
  const wheel = new MapWheel(node('wheel')); wheel.build(state.world);
  const angle = x => { wheel.updatePosition(state.world, x); return wheel.lastRotation; };
  const length = state.world.length;
  assert.equal(angle(length / 4), -90);
  assert.equal(angle(length / 2), -180);
  assert.equal(angle(length / 4), -90);
  const before = angle(length - 1), after = angle(1);
  assert.ok(Math.abs((after - before) - (360 - 720 / length)) < 1e-8);
  assert.equal(angle(-length / 4), -270);
});

test('Seul le sondage acheté colore les secteurs, par identifiant', t => {
  const node = documentFor(t), state = stateFor(), candidate = state.candidates[0];
  const display = new ElectoralDisplay(config);
  state.electorate.forEach(z => { z.controller = 'le_pen'; });
  display.update(state, candidate);
  assert.ok([...display.wheel.sectors.values()].every(s => s.attributes.fill === mapNeutralColor));
  const poll = state.polls[candidate.faction_id];
  poll.active = true;
  poll.lastPollSnapshot = {
    measured_tick: 0, national_support: { melenchon: 30, le_pen: 20, philippe: 10, neutral: 35, pending: 5 },
    zones: state.world.subzones.map((z, i) => ({ subzone_id: z.id, controller: i === 0 ? 'melenchon' : null })).reverse(),
  };
  display.update(state, candidate);
  const first = display.wheel.sectors.get(state.world.subzones[0].id);
  assert.equal(first.attributes.fill, territoryColors.melenchon);
  assert.equal(node('poll-scores').children.length, 5);
  poll.active = false; display.update(state, candidate);
  assert.equal(first.attributes.fill, territoryColors.melenchon);
  assert.ok(node('electoral-display').classes.has('poll-stale'));
  assert.ok(node('poll-scores').classes.has('poll-stale'));
  poll.active = true;
  poll.lastPollSnapshot.zones.at(-1).controller = 'philippe';
  poll.lastPollSnapshot.measured_tick = 1;
  display.update(state, candidate);
  assert.equal(first.attributes.fill, territoryColors.philippe);
  // Le spectateur suit un autre candidat et donc son information de sondage.
  display.update(state, state.candidates[1]);
  assert.equal(first.attributes.fill, mapNeutralColor);
  // Rejouer avec la même graine doit aussi effacer les anciennes couleurs.
  const fresh = stateFor(); display.update(fresh, fresh.candidates[0]);
  assert.equal(first.attributes.fill, mapNeutralColor);
});

test('Compteur et visibilité en campagne, studio, débat et second tour', t => {
  const node = documentFor(t), state = stateFor(), candidate = state.candidates[0];
  const display = new ElectoralDisplay(config);
  display.update(state, candidate);
  assert.equal(node('day').textContent, `J-${state.days_remaining}`);
  assert.ok(node('game').classes.has('has-map-wheel'));
  state.campaign_events.push({ status: 'ACTIVE', debate: {}, participants: [candidate.id] });
  display.update(state, candidate);
  assert.equal(node('electoral-circle').hidden, true);
  assert.equal(node('electoral-display').hidden, false);
  assert.ok(node('electoral-display').classes.has('map-clock-only'));
  state.campaign_events = [];
  for (const phase of ['FIRST_ROUND_DEBATE', 'RESULTS']) {
    state.phase = phase; display.update(state, candidate);
    assert.equal(node('electoral-display').hidden, true);
    assert.equal(node('poll-scores').hidden, true);
    assert.equal(node('game').classes.has('has-map-wheel'), false);
  }
  state.phase = 'SECOND_ROUND_SPRINT'; state.sprint_remaining_ticks = 2.5 * display.hz;
  display.update(state, candidate);
  assert.equal(node('day').textContent, '3');
  assert.equal(node('electoral-circle').hidden, false);
});

test('Une image inchangée ne réécrit pas la carte et un sondage modifié au même tick reste visible', t => {
  const node = documentFor(t), state = stateFor(), candidate = state.candidates[0];
  const display = new ElectoralDisplay(config), poll = state.polls[candidate.faction_id];
  poll.lastPollSnapshot = { measured_tick: 5, national_support: { melenchon: 30, le_pen: 20, philippe: 10, neutral: 35, pending: 5 },
    zones: state.world.subzones.map(zone => ({ subzone_id: zone.id, controller: null })) };
  display.update(state, candidate);
  const nodes = [...node('poll-scores').children];
  let writes = 0;
  for (const element of [node('day'), node('electoral-display'), node('game'), node('poll-scores')]) {
    const setAttribute = element.setAttribute.bind(element), toggle = element.classList.toggle;
    element.setAttribute = (...args) => { writes++; return setAttribute(...args); };
    element.classList.toggle = (...args) => { writes++; return toggle(...args); };
  }
  t.mock.method(JSON, 'stringify', () => { throw new Error('La carte stable ne doit pas être sérialisée à chaque image.'); });
  display.update(structuredClone(state), candidate);
  assert.equal(writes, 0);
  assert.deepEqual(node('poll-scores').children, nodes);
  poll.lastPollSnapshot.zones[0].controller = 'le_pen';
  poll.lastPollSnapshot.national_support.le_pen = 21;
  poll.lastPollSnapshot.national_support.neutral = 34;
  display.update(state, candidate);
  assert.equal(display.wheel.sectors.get(state.world.subzones[0].id).attributes.fill, territoryColors.le_pen);
  assert.match(node('poll-scores').children[1].children[1], /21/);
});

test('Position partagée : interpolation réseau, pause, téléportation et redémarrage', () => {
  const state = stateFor(), candidate = state.candidates[0], length = state.world.length;
  candidate.x = length - 2;
  const previous = structuredClone(state);
  candidate.x = 2; state.tick++;
  assert.equal(interpolatedPlayerX(state, previous, candidate, .5), 0);
  assert.equal(interpolatedPlayerX(state, state, candidate, 1), 2);
  candidate.x = length / 2;
  state.events.push({ id: 'teleport-test', type: 'CandidateTeleported', candidate_id: candidate.id, tick: previous.tick });
  assert.equal(interpolatedPlayerX(state, previous, candidate, .2), candidate.x);
  state.events = []; state.seed++;
  assert.equal(interpolatedPlayerX(state, previous, candidate, .2), candidate.x);
  state.seed = previous.seed; state.tick = -1;
  assert.equal(interpolatedPlayerX(state, previous, candidate, .2), candidate.x);
});
