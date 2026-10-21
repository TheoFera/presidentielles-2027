import { test } from 'node:test';
import assert from 'node:assert/strict';
import { campaignConfig } from '../scripts/validate-campaign.mjs';
import { GameSimulation } from '../src/simulation/game-simulation.js';
import { CampaignEventDirector, resolveCampaignEvent } from '../src/simulation/campaign-events.js';
import { captureSite } from '../src/simulation/strategic-sites.js';
import { CampaignDisplay } from '../src/presentation/interface/campaign.js';
import { BIOME_NAMES } from '../src/presentation/interface/campaign-intro.js';
import { rallyPlacard } from '../src/presentation/personnages/rally-sprites.js';
import { completePopulation } from '../src/simulation/spawns.js';

function installDocument(t) {
  class Element {
    children = []; dataset = {}; style = { setProperty() {} }; textContent = ''; parentNode = null; attributes = {};
    classes = new Set();
    classList = { toggle: (name, on) => on ? this.classes.add(name) : this.classes.delete(name) };
    setAttribute(name, value) { this.attributes[name] = value; }
    append(...children) { for (const child of children) { child.remove(); child.parentNode = this; this.children.push(child); } }
    replaceChildren(...children) { [...this.children].forEach(child => child.remove()); this.append(...children); }
    remove() { if (this.parentNode) { this.parentNode.children = this.parentNode.children.filter(child => child !== this); this.parentNode = null; } }
  }
  const previous = globalThis.document;
  globalThis.document = { createElement: () => new Element(), getElementById: () => new Element() };
  t.after(() => {
    if (previous === undefined) delete globalThis.document;
    else globalThis.document = previous;
  });
}

function startVariant(config, variant) {
  config.balance.campaign_events.event_enabled = true;
  const sim = new GameSimulation({ ...config, campaignCatalog: [variant] }, 42);
  if (variant.family === 'FERMETURE_BATIMENT') {
    const candidate = sim.state.candidates.find(c => !variant.candidate_target || c.faction_id === variant.candidate_target);
    for (const site of sim.state.buildings.filter(b => b.type === 'financement')) captureSite(sim, site, candidate);
  }
  const event = CampaignEventDirector.start(sim, { family: variant.family });
  assert.ok(event, `Déclenchement de ${variant.event_id}`);
  return { sim, event };
}

const textOf = (display, event) => display.cards.get(event.id).children.map(child => child.textContent).join('\n');

test('Chaque biome conserve ses textes, ses dessins ou ses bouquets dans les deux sens', () => {
  const config = campaignConfig();
  const expected = {
    paris_19e: ['SOLIDARITÉ', 'ÉCOLOGIE'], banlieue: ['JUSTICE'], periurbain_usine: ['TRAVAIL'],
    campagne: ['COLÈRE'], retraites: [], quartiers_riches: ['Simplification'],
  };
  for (const variant of config.campaignCatalog.filter(v => v.family === 'RASSEMBLEMENT')) {
    const sim = new GameSimulation({ ...config, campaignCatalog: [variant] }, 42);
    completePopulation(sim);
    const event = CampaignEventDirector.start(sim, { family: 'RASSEMBLEMENT' });
    const participants = sim.state.npcs.filter(n => n.rally_event_id === event.id);
    const placards = () => participants.map(n => rallyPlacard(n, sim.state)).filter(Boolean);
    const before = placards();
    assert.deepEqual(before.filter(p => p.slogan).map(p => p.slogan).sort(), [...expected[event.target_biome_id]].sort(), variant.event_id);
    assert.ok(before.every(p => p.biome === event.target_biome_id));
    assert.ok(before.some(p => !p.slogan && p.variant !== 0));
    if (event.target_biome_id === 'retraites') {
      assert.equal(before.length, participants.length, 'Tous les participants portent des fleurs');
      assert.ok(before.every(p => p.variant === 2), 'Aucune pancarte dans la marche en hommage');
    }
    participants.forEach(n => { n.facing = -n.facing; });
    event.march.phase = 'MARCHING';
    sim.state.tick += sim.hz;
    assert.deepEqual(placards(), before, 'Le mouvement ne change pas le porteur du slogan');
    resolveCampaignEvent(sim, event, 'RESOLVED');
    assert.equal(placards().length, 0, 'Les pancartes disparaissent à la dispersion');
  }
});

test('Un petit cortège garde une pancarte texte et une pancarte dessin sans répéter le slogan', () => {
  for (const count of [2, 5, 6, 10, 11]) {
    const event = { id: 'manif', status: 'ACTIVE', target_biome_id: 'paris_19e', march: { participant_ids: Array.from({ length: count }, (_, i) => i) } };
    const signs = event.march.participant_ids.map(rally_index => rallyPlacard({ rally_event_id: event.id, rally_index }, { campaign_events: [event] })).filter(Boolean);
    assert.equal(signs.filter(p => p.slogan === 'SOLIDARITÉ').length, 1);
    assert.equal(signs.filter(p => p.slogan === 'ÉCOLOGIE').length, count > 10 ? 1 : 0);
    assert.ok(signs.some(p => !p.slogan));
  }
});

test('Toutes les variantes du catalogue s’affichent au déclenchement et à la fin', t => {
  installDocument(t);
  const config = campaignConfig();
  for (const variant of config.campaignCatalog) {
    const { sim, event } = startVariant(config, variant);
    const display = new CampaignDisplay(sim.config);
    assert.doesNotThrow(() => display.update(sim.state), variant.event_id);
    const headline = display.cards.get(event.id).children[1].textContent;
    assert.ok(variant.headlines ? variant.headlines.some(text => headline === `${BIOME_NAMES[event.target_biome_id]} : ${text}`) : textOf(display, event).includes(variant.title));
    assert.doesNotMatch(textOf(display, event), /undefined|NaN|Infinity/, variant.event_id);
    if (event.family === 'MEETING_DE_CRISE') {
      event.attempt = { candidate_id: sim.state.candidates[0].id, start_tick: sim.state.tick, hits: 0 };
      display.update(sim.state);
      assert.match(textOf(display, event), /Tenir le promontoire/);
    }
    resolveCampaignEvent(sim, event, 'RESOLVED', ['MEETING_DE_CRISE', 'DEBAT_THEMATIQUE'].includes(event.family) ? 'melenchon' : null);
    assert.doesNotThrow(() => display.update(sim.state), `${variant.event_id} terminé`);
    assert.doesNotMatch(textOf(display, event), /undefined|NaN|Infinity/, variant.event_id);
  }
});

test('Le flash complet devient seulement EN DIRECT et le nom court, puis disparaît à la fin', t => {
  installDocument(t);
  const config = campaignConfig();
  for (const variant of config.campaignCatalog) {
    const { sim, event } = startVariant(config, variant);
    const display = new CampaignDisplay(sim.config);
    display.update(sim.state);
    const card = display.cards.get(event.id), nodes = [...card.children];
    assert.equal(card.parentNode, display.flashes);
    assert.ok(variant.headlines.some(text => card.children[1].textContent === `${BIOME_NAMES[event.target_biome_id]} : ${text}`));
    assert.deepEqual(card.children.slice(2).map(node => node.textContent), ['', '', '']);
    display.seen.set(event.id, performance.now() - config.balance.campaign_events.notification_display_seconds * 1000 - 1);
    display.update(sim.state);
    assert.equal(card.parentNode, display.live);
    assert.ok(card.classes.has('compact'));
    assert.equal(textOf(display, event), `EN DIRECT\n${BIOME_NAMES[event.target_biome_id]} : ${variant.title}\n\n\n`);
    assert.deepEqual(card.children, nodes, 'Les éléments sont déplacés sans être recréés');
    resolveCampaignEvent(sim, event, 'RESOLVED');
    display.update(sim.state);
    assert.equal(display.cards.has(event.id), false);
    assert.equal(display.live.children.length, 0);
  }
});

test('Le même évènement garde son grand titre après reconnexion sans modifier le hasard du jeu', t => {
  installDocument(t);
  const config = campaignConfig();
  const { sim, event } = startVariant(config, config.campaignCatalog[0]);
  const before = sim.exportSnapshot(), first = new CampaignDisplay(sim.config), second = new CampaignDisplay(sim.config);
  first.update(sim.state);
  second.update(sim.state);
  assert.equal(textOf(first, event), textOf(second, event));
  assert.equal(sim.exportSnapshot(), before);
  first.seen.set(event.id, -Infinity);
  first.update(sim.state);
  sim.state.tick--;
  first.update(sim.state);
  assert.equal(first.live.children.length, 0, 'Un retour en arrière vide les rappels');
  assert.equal(first.flashes.children.length, 1);
});

test('Les cartes conservent leurs éléments lorsque seul le compte à rebours change', t => {
  installDocument(t);
  const config = campaignConfig();
  const { sim, event } = startVariant(config, config.campaignCatalog.find(v => v.family === 'RASSEMBLEMENT'));
  const display = new CampaignDisplay(sim.config);
  display.update(sim.state);
  const nodes = [...display.cards.get(event.id).children];
  const previousText = textOf(display, event);
  const createElement = document.createElement;
  let created = 0;
  document.createElement = (...args) => { created++; return createElement(...args); };
  display.update(sim.state);
  assert.equal(created, 0);
  assert.equal(textOf(display, event), previousText);
  sim.state.tick += sim.hz;
  display.update(sim.state);
  assert.equal(created, 0);
  display.cards.get(event.id).children.forEach((node, i) => assert.equal(node, nodes[i]));
});

test('Une notification stable évite les écritures répétées et sa jauge suit toujours le temps', t => {
  installDocument(t);
  const config = campaignConfig(), { sim, event } = startVariant(config, config.campaignCatalog.find(v => v.family === 'RASSEMBLEMENT'));
  const display = new CampaignDisplay(config); display.update(sim.state);
  const card = display.cards.get(event.id);
  let styles = 0, classes = 0;
  const toggle = card.classList.toggle;
  card.classList.toggle = (...args) => { classes++; return toggle(...args); };
  card.children[4].style.setProperty = () => { styles++; };
  display.update(sim.state);
  assert.equal(styles, 0); assert.equal(classes, 0);
  sim.state.tick += sim.hz;
  display.update(sim.state);
  assert.equal(styles, 1);
  assert.equal(classes, 0);
});
