import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { campaignConfig } from '../scripts/validate-campaign.mjs';
import { GameSimulation } from '../src/simulation/game-simulation.js';
import { ElectoralDisplay, campaignClock, formatRealClock, territoryColors } from '../src/presentation/carte/electoral.js';
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

test('La planche verticale possède un canal transparent, les découpes restent dans son image et l’original est conservé', async () => {
  const source = await readFile(mapWheelAtlas.file);
  const original = await readFile(new URL('../assets/images/interface/roue-quartiers-planche.png', import.meta.url));
  assert.equal(createHash('sha256').update(original).digest('hex'), 'e34a227cfaf9ea263f2827621e7104ef28ebfe97453570e1182c5f863f69a5de');
  assert.equal(source.readUInt32BE(16), mapWheelAtlas.width);
  assert.equal(source.readUInt32BE(20), mapWheelAtlas.height);
  assert.equal(source[25], 6, 'PNG RGBA : transparence native, sans filtre de détourage');
  for (const [x, y, width, height] of Object.values(mapWheelIcons)) {
    assert.ok(x >= 0 && y >= 0 && width > 0 && height > 0);
    assert.ok(x + width <= mapWheelAtlas.width && y + height <= mapWheelAtlas.height);
  }
});

test('Les dessins pointent vers le centre pendant toute la rotation, sans recréation ni filtre', t => {
  const node = documentFor(t), state = stateFor();
  const wheel = new MapWheel(node('wheel')); wheel.build(state.world);
  const icons = descendants(wheel.rotor).filter(n => n.attributes['data-icon']);
  const images = icons.flatMap(n => descendants(n).filter(n => n.tag === 'image'));
  for (const fraction of [0, 0.125, 0.25, 0.5, 0.75, 0.9999, 1, -0.25]) {
    wheel.updatePosition(state.world, state.world.length * fraction);
    wheel.build(structuredClone(state.world));
    const rotation = Number(wheel.disc.style.transform.match(/rotate\(([^)]+)deg\)/)[1]) * Math.PI / 180;
    icons.forEach(icon => {
      const [x, y] = icon.attributes.transform.match(/translate\(([^ ]+) ([^)]+)\)/).slice(1).map(Number);
      const angle = Number(icon.attributes.transform.match(/rotate\(([^)]+)\)/)[1]) * Math.PI / 180 + rotation;
      const dx = x - 160, dy = y - 160;
      const inwardX = -(dx * Math.cos(rotation) - dy * Math.sin(rotation));
      const inwardY = -(dx * Math.sin(rotation) + dy * Math.cos(rotation));
      const bottomX = -Math.sin(angle), bottomY = Math.cos(angle);
      assert.ok(bottomX * inwardX + bottomY * inwardY > 0, 'Le bas pointe vers le centre');
      assert.ok(Math.abs(bottomX * inwardY - bottomY * inwardX) < 1e-8, 'Alignement radial exact');
    });
    const currentImages = descendants(wheel.rotor).filter(n => n.tag === 'image');
    assert.equal(currentImages.length, images.length);
    currentImages.forEach((image, i) => assert.equal(image, images[i]));
  }
  assert.equal(descendants(wheel.disc).filter(n => n.tag === 'filter').length, 0);
  assert.ok(images.every(image => image.attributes.filter === undefined));
  assert.equal(new Set(images.map(image => image.attributes.href)).size, 1);
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
  const all = descendants(display.wheel.container);
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
  // Texte lisible : les 3 candidats (parmi les électeurs décidés) puis les indécis.
  assert.deepEqual(node('poll-scores').children.map(span => span.textContent),
    ['Mélenchon (vous) : 50 %', 'Le Pen : 33 %', 'Philippe : 17 %', 'Indécis : 40 %']);
  // Anneau : une part par candidat, la plus grande d'abord, et celle du joueur plus épaisse.
  const parts = display.wheel.ring.children.filter(n => n.attributes.class?.startsWith('map-poll-part'));
  assert.deepEqual(parts.map(p => p.attributes.stroke), [territoryColors.melenchon, territoryColors.le_pen, territoryColors.philippe]);
  assert.equal(parts.filter(p => p.attributes.class.includes('map-poll-player')).length, 1);
  assert.ok(display.wheel.ring.classes.has('map-poll-animate'));
  // Mini-classement : rang, nom et score, la ligne du joueur mise en avant.
  const rows = display.wheel.ranking.children;
  assert.deepEqual(rows.map(r => r.children.map(c => c.textContent).join(' ')), ['1. Mélenchon 50 %', '2. Le Pen 33 %', '3. Philippe 17 %']);
  assert.equal(rows.filter(r => r.className.includes('map-poll-row-player')).length, 1);
  // Les autres candidats de la partie figurent aussi dans le sondage affiché.
  const autres = state.candidates.filter(c => c.minor).map(c => c.faction_id);
  assert.equal(autres.length, 6);
  Object.assign(poll.lastPollSnapshot.national_support, Object.fromEntries(autres.map(id => [id, 1])));
  poll.lastPollSnapshot.measured_tick = 0.5;
  display.update(state, candidate);
  assert.equal(node('poll-scores').children.length, 4 + autres.length);
  assert.ok(node('poll-scores').children.some(span => span.title === config.prototype.presentation.factions[autres[0]].name));
  poll.active = false; display.update(state, candidate);
  assert.equal(first.attributes.fill, territoryColors.melenchon);
  assert.ok(node('electoral-display').classes.has('poll-stale'));
  assert.ok(node('poll-scores').classes.has('poll-stale'));
  // Un sondage qui vieillit pâlit sans se redessiner.
  assert.equal(display.wheel.ring.classes.has('map-poll-animate'), false);
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
  // Second tour : 7 jours plus longs que ceux du premier tour, et le temps réel restant en dessous.
  const sprintDay = config.balance.time.second_round_sprint_seconds / config.balance.time.second_round_days;
  state.phase = 'SECOND_ROUND_SPRINT'; state.sprint_remaining_ticks = (sprintDay * 5 + 1) * display.hz;
  display.update(state, candidate);
  assert.equal(node('day').textContent, 'J-6');
  assert.equal(node('real-clock').textContent, formatRealClock(sprintDay * 5 + 1));
  assert.equal(node('electoral-circle').hidden, false);
  // Égalité à la fin du chrono : la partie continue, sans annonce ; la date reste sur J-1.
  state.sprint_remaining_ticks = 0; state.extensions = 1;
  display.update(state, candidate);
  assert.equal(node('day').textContent, 'J-1');
  assert.equal(node('real-clock').textContent, '0:00');
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
  assert.equal(node('poll-scores').children[1].textContent, 'Le Pen : 35 %');
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

test('Mini-classement : tous les candidats au-dessus de 0 %, et toujours le joueur', t => {
  documentFor(t);
  const wheel = new MapWheel(document.getElementById('electoral-circle'));
  wheel.build(stateFor().world);
  const shares = [['le_pen', 35], ['philippe', 25], ['melenchon', 15], ['glucksmann', 8], ['retailleau', 6], ['roussel', 5], ['attal', 3], ['arthaud', 3], ['dupont_aignan', 0]];
  wheel.updatePollRing(shares, () => '#123456', 'arthaud', true, { le_pen: 'Le Pen', arthaud: 'Arthaud' });
  const labels = wheel.ranking.children.map(r => r.children[0].textContent);
  assert.deepEqual(labels, ['1. Le Pen', '2. philippe', '3. melenchon', '4. glucksmann', '5. retailleau', '6. roussel', '7. attal', '8. Arthaud']);
  assert.ok(wheel.ranking.children.at(-1).className.includes('map-poll-row-player'));
  // Le joueur garde sa ligne même à 0 %.
  wheel.updatePollRing(shares, () => '#123456', 'dupont_aignan', false, {});
  assert.equal(wheel.ranking.children.length, 9);
  assert.equal(wheel.ranking.classes.has('map-poll-animate'), false);
});

test('Temps réel restant avant le vote : premier tour, puis second tour en jours plus longs', () => {
  const time = config.balance.time, hz = config.balance.simulation_architecture.fixed_tick_hz;
  const dayTicks = Math.ceil(time.real_seconds_per_game_day * hz - 1e-9);
  const start = { phase: 'CAMPAIGN', days_remaining: time.starting_days_before_first_round, tick: 0 };
  assert.equal(campaignClock(start, time, hz).seconds, time.starting_days_before_first_round * dayTicks / hz);
  // Au milieu d'un jour, le temps réel continue de baisser alors que la date ne bouge pas.
  const later = campaignClock({ phase: 'CAMPAIGN', days_remaining: 10, tick: 5 * dayTicks + 3 }, time, hz);
  assert.equal(later.days, 10);
  assert.equal(later.seconds, (10 * dayTicks - 3) / hz);
  const sprint = campaignClock({ phase: 'SECOND_ROUND_SPRINT', sprint_remaining_ticks: time.second_round_sprint_seconds * hz, extensions: 0 }, time, hz);
  assert.deepEqual(sprint, { days: time.second_round_days, seconds: time.second_round_sprint_seconds });
  assert.equal(formatRealClock(730), '12:10');
  assert.equal(formatRealClock(59.2), '1:00');
});
