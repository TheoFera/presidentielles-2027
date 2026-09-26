import { test } from 'node:test';
import assert from 'node:assert/strict';
import { campaignConfig } from '../scripts/validate-campaign.mjs';
import { GameSimulation } from '../src/simulation/game-simulation.js';
import { CampaignEventDirector, resolveCampaignEvent } from '../src/simulation/campaign-events.js';
import { captureSite } from '../src/simulation/strategic-sites.js';
import { CampaignDisplay } from '../src/presentation/campaign.js';

function installDocument(t) {
  class Element {
    children = []; dataset = {}; style = { setProperty() {} };
    classList = { toggle() {} };
    setAttribute() {}
    append(...children) { this.children.push(...children); }
    replaceChildren(...children) { this.children = children; }
    remove() {}
  }
  const previous = globalThis.document;
  globalThis.document = { createElement: () => new Element(), getElementById: () => new Element() };
  t.after(() => {
    if (previous === undefined) delete globalThis.document;
    else globalThis.document = previous;
  });
}

function startVariant(config, variant) {
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

test('Toutes les variantes du catalogue s’affichent au déclenchement et à la fin', t => {
  installDocument(t);
  const config = campaignConfig();
  for (const variant of config.campaignCatalog) {
    const { sim, event } = startVariant(config, variant);
    const display = new CampaignDisplay(sim.config);
    assert.doesNotThrow(() => display.update(sim.state), variant.event_id);
    assert.ok(textOf(display, event).includes(variant.title));
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

test('Les cartes conservent leurs éléments lorsque seul le compte à rebours change', t => {
  installDocument(t);
  const config = campaignConfig();
  const { sim, event } = startVariant(config, config.campaignCatalog.find(v => v.family === 'CANDIDAT_FRAGILISE'));
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
