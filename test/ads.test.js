import test from 'node:test';
import assert from 'node:assert/strict';
import { adBlocker, adProvider, countFinishedGame, InterstitialAds, ADS_STATS_KEY } from '../src/presentation/ads.js';
import { AD_RULES } from '../src/network/ads-config.js';

const MIN = 60_000;
const memory = () => { const data = new Map(); return { getItem: k => data.get(k) ?? null, setItem: (k, v) => data.set(k, String(v)), data }; };
const stats = (games, debatesSinceAd = 0, lastAdAt = 0) => ({ games, debatesSinceAd, lastAdAt });

test('pub dès la fin de la première campagne', () => {
  assert.equal(AD_RULES.freeGames, 0);
  assert.equal(adBlocker(countFinishedGame(stats(0), 'campaign'), 'campaign', 100 * MIN), null);
  // Réglage possible : des parties offertes avant la première pub.
  const rules = { ...AD_RULES, freeGames: 2 };
  assert.ok(adBlocker(stats(2), 'campaign', 100 * MIN, rules));
  assert.equal(adBlocker(stats(3), 'campaign', 100 * MIN, rules), null);
});

test('au moins 3 minutes entre deux pubs', () => {
  assert.ok(adBlocker(stats(10, 5, 100 * MIN), 'campaign', 102 * MIN));
  assert.equal(adBlocker(stats(10, 5, 100 * MIN), 'campaign', 103 * MIN), null);
});

test('débat : une pub tous les 3 débats et 4 minutes après la précédente', () => {
  assert.ok(adBlocker(stats(10, 2, 0), 'debate', 100 * MIN));
  assert.equal(adBlocker(stats(10, 3, 0), 'debate', 100 * MIN), null);
  assert.ok(adBlocker(stats(10, 3, 100 * MIN), 'debate', 103.5 * MIN));
  assert.equal(adBlocker(stats(10, 3, 100 * MIN), 'debate', 104 * MIN), null);
});

test('le compteur de débats ne bouge pas en campagne', () => {
  assert.deepEqual(countFinishedGame(stats(1, 1), 'campaign'), stats(2, 1));
  assert.deepEqual(countFinishedGame(stats(1, 1), 'debate'), stats(2, 2));
});

test('régie : appli, simulation, site AdSense, sinon aucune', () => {
  const https = { protocol: 'https:', hostname: 'jeu.example.fr', search: '' };
  assert.equal(adProvider({ location: https, native: { show() {} } }), 'android');
  assert.equal(adProvider({ location: { ...https, search: '?pub=simulation' }, native: undefined }), 'simulation');
  assert.equal(adProvider({ location: https, native: undefined, client: 'ca-pub-1', appBuild: false }), 'adsense');
  assert.equal(adProvider({ location: https, native: undefined, client: '', appBuild: false }), null);
  // Jamais AdSense dans l'appli ni en local.
  assert.equal(adProvider({ location: https, native: undefined, client: 'ca-pub-1', appBuild: true }), null);
  assert.equal(adProvider({ location: { protocol: 'http:', hostname: 'localhost', search: '' }, native: undefined, client: 'ca-pub-1', appBuild: false }), null);
});

function nativeAds({ ready = true, now = 100 * MIN } = {}) {
  const shown = [];
  const native = { show: id => { shown.push(id); if (ready) queueMicrotask(() => globalThis.PTJNativeAdsResult(id, 'viewed')); return ready; } };
  const audio = { holds: [], hold(on) { this.holds.push(on); } };
  const storage = memory();
  const ads = new InterstitialAds({ audio, storage, native, provider: 'android', now: () => now });
  return { ads, shown, audio, storage };
}

test('appli : pub à la première partie puis 3 min de répit, son coupé puis rétabli', async () => {
  const { ads, shown, audio, storage } = nativeAds();
  const next = [];
  for (let i = 0; i < 3; i++) await ads.afterGame('campaign', () => next.push(i));
  assert.deepEqual(next, [0, 1, 2]);
  assert.equal(shown.length, 1);
  assert.deepEqual(audio.holds, [true, false]);
  assert.equal(JSON.parse(storage.getItem(ADS_STATS_KEY)).lastAdAt, 100 * MIN);
});

test('pub non chargée : le jeu continue sans attendre et sans compter de pub', async () => {
  const { ads, storage } = nativeAds({ ready: false });
  storage.setItem(ADS_STATS_KEY, JSON.stringify(stats(5)));
  let continued = false;
  await ads.afterGame('campaign', () => { continued = true; });
  assert.ok(continued);
  assert.equal(JSON.parse(storage.getItem(ADS_STATS_KEY)).lastAdAt, 0);
});

test('un second clic pendant la pub est ignoré', async () => {
  const { ads, shown, storage } = nativeAds();
  storage.setItem(ADS_STATS_KEY, JSON.stringify(stats(5)));
  const next = [];
  await Promise.all([ads.afterGame('campaign', () => next.push('a')), ads.afterGame('campaign', () => next.push('b'))]);
  assert.deepEqual(next, ['a']);
  assert.equal(shown.length, 1);
});

test('simulation : une pub à chaque fin de débat', async () => {
  const ads = new InterstitialAds({ storage: memory(), provider: 'simulation', native: undefined, now: () => 100 * MIN });
  const shown = [];
  ads.show = async placement => { shown.push(placement); return 'viewed'; };
  for (let i = 0; i < 3; i++) await ads.afterGame('debate', () => {});
  assert.deepEqual(shown, ['debate', 'debate', 'debate']);
});

test('sans régie, aucune pub mais la partie continue', async () => {
  const ads = new InterstitialAds({ storage: memory(), provider: null, native: undefined });
  let continued = false;
  await ads.afterGame('debate', () => { continued = true; });
  assert.ok(continued);
});
