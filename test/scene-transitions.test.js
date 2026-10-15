import test from 'node:test';
import assert from 'node:assert/strict';
import { SceneTransitions, campaignScene } from '../src/presentation/interface/transitions.js';

const settings = { arrival_seconds: 0.6, debate_hold_seconds: 0.6, cover_seconds: 0.3, reveal_seconds: 0.45, vote_seconds: 2.2 };
const run = (t, scene, seconds, options) => { let out; for (let i = 0; i < Math.round(seconds / 0.05); i++) out = t.update(scene, 0.05, options); return out; };

test('la scène suit la phase et le débat de campagne du joueur', () => {
  const base = { phase: 'CAMPAIGN', local_candidate_id: 'candidate:a', campaign_events: [] };
  assert.equal(campaignScene(base), 'map');
  assert.equal(campaignScene({ ...base, campaign_events: [{ id: 'e1', status: 'ACTIVE', debate: {}, participants: ['candidate:a'] }] }), 'debate:e1');
  assert.equal(campaignScene({ ...base, campaign_events: [{ id: 'e1', status: 'ACTIVE', debate: {}, participants: ['candidate:b'] }] }), 'map');
  assert.equal(campaignScene({ ...base, phase: 'RESULTS' }), 'results');
});

test('la première scène s’affiche sans rideau', () => {
  const out = new SceneTransitions(settings).update('map', 0.016);
  assert.deepEqual([out.draw, out.freeze, out.curtain], [true, false, 0]);
});

test('fin de débat en solo : image figée, rideau fermé, décor changé, puis rideau ouvert', () => {
  const t = new SceneTransitions(settings);
  t.update('debate:e1', 0.016);
  let out = t.update('map', 0.016);
  assert.deepEqual([out.draw, out.freeze, out.curtain], [false, true, 0]);
  out = run(t, 'map', 0.6 + 0.25);
  assert.ok(out.curtain > 0.5 && !out.draw && out.freeze);
  out = run(t, 'map', 0.1);
  assert.ok(out.draw && !out.freeze && out.curtain > 0.8);
  out = run(t, 'map', 0.5);
  assert.deepEqual([out.draw, out.curtain], [true, 0]);
});

test('en multijoueur la partie ne s’arrête jamais et il n’y a pas d’image figée', () => {
  const t = new SceneTransitions(settings);
  t.update('debate:e1', 0.016, { solo: false });
  const out = t.update('map', 0.2, { solo: false });
  assert.equal(out.freeze, false);
  assert.ok(out.curtain > 0.5);
});

test('« Place au vote… » précède les résultats, puis la carte n’est plus redessinée', () => {
  const t = new SceneTransitions(settings);
  t.update('map', 0.016);
  let out = run(t, 'results', 1);
  assert.deepEqual([out.vote, out.results, out.draw], [true, false, false]);
  out = run(t, 'results', 1.3);
  assert.deepEqual([out.vote, out.results, out.draw], [false, true, false]);
  // Retour à la carte (second tour) : le rideau part fermé et s’ouvre.
  out = t.update('map', 0.016);
  assert.ok(out.swap && out.draw && out.curtain > 0.9);
});

test('mouvement réduit : changement immédiat', () => {
  const t = new SceneTransitions(settings);
  t.update('debate:e1', 0.016);
  const out = t.update('map', 0.016, { instant: true });
  assert.deepEqual([out.swap, out.draw, out.curtain], [true, true, 0]);
});
