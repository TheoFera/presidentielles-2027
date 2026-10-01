import { test } from 'node:test';
import assert from 'node:assert/strict';
import { config as base } from '../scripts/game-config.mjs';
import { GameSimulation } from '../src/simulation/game-simulation.js';
import { DEFAULT_MAP_DECOR, MAP_DECORS, decorForProfile, setMapDecor, currentMapDecor } from '../src/presentation/map-decor.js';
import { profileContent } from '../src/presentation/player-profile.js';
import { normalizeCampaignProfile } from '../src/simulation/campaign-styles.js';

test('Décor de la carte : « biomes » par défaut, seul le profil betatest peut en choisir un autre', () => {
  assert.equal(DEFAULT_MAP_DECOR, 'biomes');
  assert.deepEqual(MAP_DECORS.map(d => d.id), ['biomes', 'panoramas', 'fresque', 'france_peinte']);
  assert.equal(decorForProfile({}), 'biomes');
  assert.equal(decorForProfile({ nickname: 'Joueur', map_decor: 'fresque' }), 'biomes', 'un profil ordinaire ignore un choix enregistré');
  assert.equal(decorForProfile({ nickname: 'betatest' }), 'biomes');
  assert.equal(decorForProfile({ nickname: ' BetaTest ', map_decor: 'panoramas' }), 'panoramas');
  assert.equal(decorForProfile({ nickname: 'betatest', map_decor: 'inconnu' }), 'biomes');
  assert.equal(normalizeCampaignProfile({ nickname: 'betatest', map_decor: 'fresque' }).map_decor, 'fresque', 'le choix est conservé dans le profil');
  assert.equal(setMapDecor('fresque'), 'fresque'); assert.equal(currentMapDecor(), 'fresque');
  assert.equal(setMapDecor('nimporte'), 'biomes');
});

test('Décor de la carte : le sélecteur n’apparaît que dans le profil betatest', () => {
  const stats = profile => normalizeCampaignProfile(profile);
  assert.ok(!profileContent(stats({ nickname: 'Joueur' })).includes('map-decor'));
  const html = profileContent(stats({ nickname: 'betatest', map_decor: 'panoramas' }));
  for (const decor of MAP_DECORS) assert.ok(html.includes(`value="${decor.id}"`), decor.id);
  assert.ok(/value="panoramas" checked/.test(html));
});

test('Décor de la carte : même zoom pour tous les décors, une sous-zone vaut 1,25 écran', () => {
  const { camera } = base.balance, width = base.prototype.world.units_per_screen;
  assert.equal(camera.default_zoom, 1);
  assert.equal(camera.framing_zoom, 1.25);
  const { world } = new GameSimulation(structuredClone(base), 1).state;
  for (const zone of world.subzones) assert.equal(zone.width / width * camera.framing_zoom * camera.default_zoom, 1.25, zone.id);
});
