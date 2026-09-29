import { test } from 'node:test';
import assert from 'node:assert/strict';
import { config as base } from '../scripts/game-config.mjs';
import { GameSimulation } from '../src/simulation/game-simulation.js';
import { aiFinancierTarget, updateFundingEncounters, visibleFinancier } from '../src/simulation/funding-encounters.js';
import { CANVAS, FARS, MEETINGS, MIDDLES, STREETS, STREET_BASELINE, allDecorImages, blockoutSiteTargets, signRect } from '../src/presentation/world-v3/spec.js';
import { decorPrompt } from '../src/presentation/world-v3/prompts.js';
import { layerFrame, streetFrame, worldBiomes } from '../src/presentation/fixed-world.js';
import { cleanPixels, findCreamSigns, measureBaseline } from '../scripts/world-v3-calibrate-lib.mjs';

const make = () => { const config = structuredClone(base); config.balance.campaign_events.event_enabled = false; const sim = new GameSimulation(config, 42); sim.state.ai_enabled = false; return sim; };
const alone = (sim, candidate, x) => { sim.state.candidates.forEach(c => { c.x = (c === candidate ? x : x + 200) % sim.state.world.length; }); candidate.money = 0; };

test('Financiers : seuls les candidats autorisés, fauchés et seuls les voient', () => {
  const sim = make(), niel = sim.state.funding_encounters.find(e => e.kind === 'tech');
  const lePen = sim.state.candidates.find(c => c.faction_id === 'le_pen'), melenchon = sim.state.candidates.find(c => c.faction_id === 'melenchon');
  alone(sim, lePen, niel.x + 1); updateFundingEncounters(sim);
  assert.equal(niel.candidate_id, null, 'Le Pen ne peut pas signer avec l’entrepreneur du numérique');
  alone(sim, melenchon, niel.x + 1); melenchon.money = 2; updateFundingEncounters(sim);
  assert.equal(niel.candidate_id, null, 'au-dessus de 1 000 €, il ne vient pas');
  melenchon.money = 0.5; updateFundingEncounters(sim);
  assert.equal(niel.candidate_id, melenchon.id); assert.equal(visibleFinancier(sim.state, melenchon.id), niel);
  assert.equal(visibleFinancier(sim.state, lePen.id), null);
  lePen.x = niel.x + 5; updateFundingEncounters(sim);
  assert.equal(niel.candidate_id, null, 'un témoin le fait disparaître');
});

test('Financiers : 20 000 € après 3 s immobile, un seul contrat pour toute la partie', () => {
  const sim = make(), medias = sim.state.funding_encounters.find(e => e.kind === 'medias');
  const philippe = sim.state.candidates.find(c => c.faction_id === 'philippe'), lePen = sim.state.candidates.find(c => c.faction_id === 'le_pen');
  alone(sim, philippe, medias.x); philippe.axis = 0; philippe.moving = false;
  for (let i = 0; i < sim.secondsToTicks(sim.config.balance.funding_encounters.sign_seconds) + 2; i++) updateFundingEncounters(sim);
  assert.equal(philippe.money, sim.config.balance.funding_encounters.amount_eur / 1000);
  assert.equal(sim.config.balance.funding_encounters.amount_eur, 20000);
  assert.equal(medias.signed_candidate_id, philippe.id);
  alone(sim, lePen, medias.x); sim.state.tick += sim.secondsToTicks(60);
  for (let i = 0; i < 400; i++) updateFundingEncounters(sim);
  assert.equal(medias.candidate_id, null, 'une fois signé, il n’apparaît plus pour personne'); assert.equal(lePen.money, 0);
  const restored = make(); restored.importSnapshot(sim.exportSnapshot());
  assert.equal(restored.state.funding_encounters.find(e => e.kind === 'medias').signed_candidate_id, philippe.id);
});

test('IA : un financier seulement pour rattraper un humain nettement dominant', () => {
  const sim = make(), russe = sim.state.funding_encounters.find(e => e.kind === 'russe');
  const lePen = sim.state.candidates.find(c => c.faction_id === 'le_pen'), philippe = sim.state.candidates.find(c => c.faction_id === 'philippe');
  alone(sim, lePen, russe.x - 20);
  assert.equal(aiFinancierTarget(sim.state, sim.config, lePen, { boost: 0.3 }), null, 'l’IA qui n’est pas distancée ne va pas le chercher');
  assert.equal(aiFinancierTarget(sim.state, sim.config, lePen, { boost: 1 }), russe);
  philippe.money = 0; assert.notEqual(aiFinancierTarget(sim.state, sim.config, philippe, { boost: 1 })?.kind, 'russe', 'Philippe ne signe pas avec l’intermédiaire russe');
  lePen.money = 5; assert.equal(aiFinancierTarget(sim.state, sim.config, lePen, { boost: 1 }), null, 'pas quand elle a de l’argent');
  lePen.money = 0; russe.signed_candidate_id = philippe.id; assert.equal(aiFinancierTarget(sim.state, sim.config, lePen, { boost: 1 }), null, 'contrat déjà signé');
});

test('Maquette : chaque bâtiment du tableau a sa porte et son enseigne, les meetings sont au centre', () => {
  const targets = blockoutSiteTargets();
  for (const slot of base.layout.strategic_site_generation.slots) {
    if (slot.type === 'meeting') { assert.ok(MEETINGS.includes(slot.subzone_id)); continue; }
    assert.ok(targets[slot.site_id], `porte manquante : ${slot.site_id}`); assert.equal(targets[slot.site_id].subzone, slot.subzone_id);
  }
  for (const [id, spec] of Object.entries(STREETS)) {
    for (const element of spec.elements.filter(e => e.t === 'site')) {
      const [x, y, w, h] = signRect(element);
      assert.ok(x > 0 && y > 0 && x + w < CANVAS.width && y + h < STREET_BASELINE, `enseigne hors cadre : ${element.site}`);
      if (MEETINGS.includes(id)) assert.ok(Math.abs(element.x - CANVAS.width / 2) > 250, `porte sur la place de meeting : ${element.site}`);
    }
    if (MEETINGS.includes(id)) {
      const square = spec.elements.find(e => e.t === 'place' || e.kind === 'rondpoint');
      assert.ok(square && square.x < CANVAS.width / 2 - 120 && square.x + square.w > CANVAS.width / 2 + 120, `place centrale absente : ${id}`);
    }
    // Les bords restent bas : l'arbre de jonction du jeu masque la couture.
    for (const element of spec.elements.filter(e => e.w && e.t !== 'place' && e.t !== 'tour'))
      if (element.x < 60 || element.x + element.w > CANVAS.width - 60) assert.ok(element.h <= 140, `bord trop haut dans ${id} (${element.desc})`);
  }
  for (const npc of base.layout.funding_npcs) assert.equal(STREETS[npc.subzone_id].financier, Math.round(npc.x_ratio * CANVAS.width), npc.id);
});

test('Maquette : le tableau est respecté (Haussmann seulement à Paris, deux tours, rond-point devant, mer, montagne)', () => {
  const haussmann = Object.entries(STREETS).filter(([, s]) => s.elements.some(e => e.mat === 'haussmann')).map(([id]) => id);
  assert.ok(haussmann.every(id => id.startsWith('paris_') || id.startsWith('riches_')), haussmann.join());
  assert.equal(STREETS.banlieue_a.elements.filter(e => e.t === 'tour').length, 2);
  assert.ok(STREETS.banlieue_b.elements.some(e => e.mat === 'beton' && e.floors >= 3));
  assert.ok(STREETS.periurbain_b.elements.some(e => e.kind === 'rondpoint'));
  assert.ok(FARS.retraites.elements.some(e => e.kind === 'mer'));
  const peaks = Object.values(FARS).map(f => Math.min(...f.elements.filter(e => e.t === 'relief').flatMap(e => e.points.map(p => p[1]))));
  assert.equal(Math.min(...peaks), Math.min(...FARS.periurbain_usine.elements.filter(e => e.t === 'relief').flatMap(e => e.points.map(p => p[1]))), 'le Mont-Blanc est le plus haut fond du jeu');
  assert.ok(FARS.quartiers_riches.elements.some(e => e.kind === 'tour_eiffel') && FARS.quartiers_riches.elements.some(e => e.kind === 'defense'));
  assert.ok(MIDDLES.banlieue.elements.some(e => e.kind === 'basilique_st_denis'));
  assert.ok(STREETS.banlieue_c.elements.some(e => e.t === 'site') && STREETS.campagne_c.elements.find(e => e.t === 'bat' && e.desc.includes('SECURITY')).h >= 500, 'le local SO est un vrai bâtiment');
  assert.equal(allDecorImages().length, 30);
  for (const image of allDecorImages()) { const prompt = decorPrompt(image); assert.ok(prompt.includes('1536 × 1024') && prompt.length > 900, image.file); }
});

test('Fonds : chaque relief redescend au sol avant les bords, sans coupure verticale', () => {
  for (const [name, specs] of [['lointain', FARS], ['intermédiaire', MIDDLES]]) for (const [id, spec] of Object.entries(specs)) {
    assert.match(spec.ground, /^#[0-9a-f]{6}$/);
    for (const element of spec.elements) {
      if (element.t === 'relief') {
        for (const [x, y] of element.points) if (x <= 40 || x >= CANVAS.width - 40) assert.ok(y >= 985, `${name} ${id} : relief coupé au bord (x=${x}, y=${y})`);
        element.points.forEach(([x, y], i) => { const [nx, ny] = element.points[(i + 1) % element.points.length];
          assert.ok(!(x === nx && Math.min(y, ny) < 985), `${name} ${id} : côté vertical à x=${x}`); });
      } else assert.ok(element.x >= 40 && element.x + element.w <= CANVAS.width - 40, `${name} ${id} : ${element.kind || element.mat} touche le bord`);
    }
  }
});

test('Couches : aucune déformation, rues et plans jointifs, boucle de la carte continue', () => {
  const sim = make(), world = sim.state.world, metrics = { groundY: 502, anchorX: 480, pixelsPerUnit: 26 };
  const source = { image: { width: 1536, height: 1024 }, baseline: 990 };
  for (const zone of world.subzones) {
    const frame = streetFrame(metrics, 540, 100, zone, source);
    assert.ok(Math.abs(frame.width / frame.height - 1.5) < 1e-12);
  }
  for (const camera of [0, 13.7, 200, world.length - 0.01]) for (const layer of ['far', 'middle']) {
    const frames = worldBiomes(world).map(biome => layerFrame(metrics, 540, camera, world, biome, layer, { image: { width: 1536, height: 1024 }, baseline: 1000 }))
      .sort((a, b) => a.left - b.left);
    for (let i = 1; i < frames.length; i++) {
      const gap = frames[i].left - (frames[i - 1].left + frames[i - 1].width);
      assert.ok(Math.abs(gap) < 1e-6, `${layer} : trou de ${gap} px à la caméra ${camera}`);
    }
  }
  const at = camera => worldBiomes(world).map(biome => layerFrame(metrics, 540, camera, world, biome, 'middle', { image: { width: 1536, height: 1024 }, baseline: 1000 }).left);
  assert.deepEqual(at(3), at(3 + world.length));
});

test('Calage : fond magenta retiré, ligne de sol et enseigne crème retrouvées', () => {
  const width = 400, height = 300, data = Buffer.alloc(width * height * 4);
  for (let i = 0; i < width * height; i++) data.set([255, 0, 255, 255], i * 4);
  const fill = (x0, y0, w, h, color) => { for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) data.set(color, (y * width + x) * 4); };
  fill(40, 100, 320, 180, [120, 110, 100, 255]); fill(150, 130, 120, 40, [243, 228, 197, 255]);
  const image = { width, height, data };
  cleanPixels(image);
  assert.equal(data[3], 0); assert.equal(data[(150 * width + 60) * 4 + 3], 255);
  assert.equal(measureBaseline(image, 0.5), 280);
  assert.deepEqual(findCreamSigns(image), [[150, 130, 120, 40]]);
});
