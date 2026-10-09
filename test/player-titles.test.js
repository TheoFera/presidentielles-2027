import test from 'node:test';
import assert from 'node:assert/strict';
import { TITLES, titleRank, titleName, nextTitle, titleThresholds, ratingTier, nextTier, bestRating, cleanPlayerCard, cleanAvatar } from '../src/simulation/player-titles.js';
import { DEFAULT_UNLOCKED, UNLOCKABLE_IDS, unlocksToProfile } from '../src/simulation/unlock-catalog.js';
import { campaignConfig } from '../scripts/validate-campaign.mjs';
import { GameSimulation } from '../src/simulation/game-simulation.js';
import { CampaignStyleSystem } from '../src/simulation/campaign-styles.js';

const gained = n => [...DEFAULT_UNLOCKED, ...UNLOCKABLE_IDS.slice(0, n)];

test('Titres : Sympathisant dès le 1er candidat gagné, seuils proportionnels au catalogue', () => {
  assert.equal(titleRank(DEFAULT_UNLOCKED), 0, 'candidats de départ seulement : pas de titre');
  assert.equal(titleName(titleRank(gained(1))), 'Sympathisant');
  // Avec 12 candidats à gagner : 1, 2, 3, 5, 7, 9, 11, 12.
  assert.deepEqual(titleThresholds(12), [1, 2, 3, 5, 7, 9, 11, 12]);
  assert.deepEqual(titleThresholds(20), [1, 3, 5, 8, 11, 14, 17, 20], 'nouveaux candidats : l’échelle suit');
  assert.equal(titleName(titleRank(gained(UNLOCKABLE_IDS.length))), 'Président de la République');
  assert.equal(TITLES.length, 8);
});

test('Titres : jamais perdus, sauf Président qui exige toute la collection actuelle', () => {
  assert.equal(titleRank(gained(2), 5), 5, 'Député gardé même avec moins de candidats (catalogue agrandi)');
  assert.equal(titleRank(gained(2), 8), 7, 'Président redescend à Premier ministre tant que la collection n’est pas complète');
  assert.deepEqual(nextTitle(gained(3)), { rank: 4, name: 'Maire', missing: 2 });
  assert.equal(nextTitle(gained(UNLOCKABLE_IDS.length)), null);
});

test('Paliers : couleur d’après l’Elo, jamais sans partie classée', () => {
  assert.equal(ratingTier(null), null);
  assert.equal(ratingTier(980), 'bronze');
  assert.equal(ratingTier(1000), 'silver');
  assert.equal(ratingTier(1184), 'gold');
  assert.equal(ratingTier(1300), 'elysee');
  assert.deepEqual(nextTier(1184), { id: 'elysee', missing: 116, from: 1300, previous: 1150 });
  assert.equal(nextTier(1400), null);
  assert.equal(bestRating({ campaign: { rating: 1050, games: 3 }, debate: { rating: 1210, games: 1 } }), 1210);
  assert.equal(bestRating({ debate: { rating: 1210, games: 0 } }), null);
});

test('Carte du joueur : seules des valeurs connues, avatar parmi ses candidats', () => {
  const card = cleanPlayerCard({ avatar: 'attal', title: 3, tier: 'gold', unlocks: ['attal', 'inconnu', 'attal'] });
  assert.deepEqual(card, { avatar: 'attal', title: 3, tier: 'gold', unlocks: ['attal'] });
  assert.equal(cleanPlayerCard({ avatar: 'attal', unlocks: [] }).avatar, DEFAULT_UNLOCKED[0], 'avatar non débloqué : remplacé');
  assert.equal(cleanPlayerCard({ title: 99, tier: 'diamant' }).title, 0);
  assert.equal(cleanPlayerCard(null), null);
  assert.equal(cleanAvatar('<script>'), DEFAULT_UNLOCKED[0]);
});

test('Campagne en multijoueur : chaque joueur choisit parmi SES styles débloqués', () => {
  const config = campaignConfig(); config.balance.campaign_events.event_enabled = false;
  const sim = new GameSimulation(config, 42, 'candidate:melenchon');
  // L’hôte (Mélenchon) n’a rien débloqué ; l’invité (Le Pen) a gagné le style « Zemmouriste ».
  sim.profiles = { 'candidate:melenchon': {}, 'candidate:le_pen': unlocksToProfile(['le_pen_zemmouriste']) };
  const lePen = sim.state.candidates.find(c => c.id === 'candidate:le_pen');
  const melenchon = sim.state.candidates.find(c => c.id === 'candidate:melenchon');
  CampaignStyleSystem.open(sim, lePen);
  assert.notEqual(CampaignStyleSystem.select(sim, lePen, 'le_pen_zemmouriste'), false);
  assert.equal(lePen.current_campaign_style, 'le_pen_zemmouriste');
  CampaignStyleSystem.open(sim, melenchon);
  assert.equal(CampaignStyleSystem.select(sim, melenchon, 'melenchon_populiste'), false, 'style que l’hôte n’a pas');
});

test('Titre affiché : jamais hérité de « betatest » ni de l’appareil quand on est connecté', async () => {
  const { playerCard, rememberTitle } = await import('../src/presentation/menus/player-card.js');
  assert.deepEqual(rememberTitle({ nickname: 'betatest' }), {}, 'betatest ne laisse aucun titre');
  assert.equal(playerCard({ best_title: { rank: 7, gained: 12 } }).title, 0, 'titre noté avec plus de candidats que l’appareil : ignoré');
  assert.equal(playerCard({ best_title: { rank: 7 }, account: { title_rank: 0 } }).title, 0, 'connecté : seul le compte compte');
  assert.deepEqual(rememberTitle({ unlocked_minor_candidates: ['roussel'] }), { best_title: { rank: 1, gained: 1 } });
  assert.equal(playerCard({ unlocked_minor_candidates: ['roussel'], best_title: { rank: 4, gained: 1 } }).title, 4, 'titre gagné gardé (catalogue agrandi)');
});

test('Collection : une carte par candidat, styles à l’intérieur, compteurs candidats et styles', async () => {
  const { profileContent, collectionCardContent, collectionCounts } = await import('../src/presentation/menus/player-profile.js');
  const { playerCard } = await import('../src/presentation/menus/player-card.js');
  const profile = { unlocked_minor_candidates: ['roussel'], unlocked_campaign_styles: { le_pen: ['le_pen_souverainiste', 'le_pen_zemmouriste'] } };
  const html = profileContent(profile);
  assert.equal(html.match(/class="collection-card/g).length, 9, 'une carte par candidat');
  assert.deepEqual(collectionCounts(playerCard(profile)), { candidates: 4, candidateTotal: 9, styles: 4, styleTotal: 9 });
  const locked = collectionCardContent(playerCard(profile), 'le_pen', 'le_pen_gouvernement');
  assert.match(locked, /data-locked/);
  assert.match(locked, /aria-label="2 styles débloqués sur 3"/);
  assert.equal(collectionCardContent(playerCard(profile), 'roussel').split('data-show=').length - 1, 1, 'un seul style : un seul losange');
});
