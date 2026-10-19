import test from 'node:test';
import assert from 'node:assert/strict';
import { respawnSecondsLeft } from '../src/presentation/interface/respawn-countdown.js';

const hz = 30;
const state = { phase: 'CAMPAIGN', tick: 300 };
const ko = { is_ko: true, respawn_tick: 300 + 4 * hz + 1 };

test('le décompte de réapparition arrondit à la seconde supérieure', () => {
  assert.equal(respawnSecondsLeft(state, ko, hz), 5);
  assert.equal(respawnSecondsLeft({ ...state, tick: ko.respawn_tick - 1 }, ko, hz), 1);
  // Le pas même de la réapparition affiche encore 1, jamais 0.
  assert.equal(respawnSecondsLeft({ ...state, tick: ko.respawn_tick }, ko, hz), 1);
});

test('aucun décompte hors K.-O. en campagne', () => {
  assert.equal(respawnSecondsLeft(state, { ...ko, is_ko: false }, hz), null);
  assert.equal(respawnSecondsLeft(state, { ...ko, minor: true }, hz), null);
  assert.equal(respawnSecondsLeft(state, { ...ko, eliminated: true }, hz), null);
  assert.equal(respawnSecondsLeft(state, { ...ko, campaign_debate_id: 'debat' }, hz), null);
  assert.equal(respawnSecondsLeft({ ...state, phase: 'RESULTS' }, ko, hz), null);
  assert.equal(respawnSecondsLeft(state, null, hz), null);
});
