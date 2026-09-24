import test from 'node:test';
import assert from 'node:assert/strict';
import { VisualAssets, neighboringSubzones } from '../src/presentation/visual-assets.js';
import { characterAssetId, characterAnimation, npcVariantCounts } from '../src/presentation/illustrated-characters.js';
import { sceneryProjection, sceneryParallax, sceneryImageHeight, worldAssetIds, preloadWorld } from '../src/presentation/illustrated-world.js';
import { buildingGeometry, buildingAssetId } from '../src/presentation/illustrated-buildings.js';
import { GameSimulation } from '../src/simulation/game-simulation.js';
import { campaignConfig } from '../scripts/validate-campaign.mjs';
import { visualManifest } from '../src/presentation/visual-manifest.js';
import { access } from 'node:fs/promises';

test('Chaque biome possède ses sept façades, ses trois habitants et ses trois décors', async () => {
  for (const biome of ['bobo','banlieue','periurbain','campagne','retraites','riches']) {
    for (const family of ['campaign_local','financement','communication','security_admin_slot','imprimerie','meeting_hall','polling_institute']) {
      const id = `building-${family}-${biome}`;
      assert.ok(visualManifest[id], id); await access(new URL(visualManifest[id].file));
    }
    for (let i = 0; i < npcVariantCounts[biome]; i++) assert.ok(visualManifest[`npc-${biome}-${i}`]);
    for (const id of [`background-strip-${biome}`,`distant-${biome}`,`street-${biome}`,`landscape-${biome}`]) { assert.ok(visualManifest[id],id); await access(new URL(visualManifest[id].file)); }
  }
  for (let i = 0; i < 18; i++) { assert.ok(visualManifest[`background-${i}`]); await access(new URL(visualManifest[`background-${i}`].file)); }
  for (const id of ['character-melenchon','character-le_pen','character-philippe','security-0','security-1','crs-0','crs-1','journalist-0','journalist-1','journalist-2']) assert.ok(visualManifest[id], id);
});

test('Les plans défilent à des vitesses distinctes et bouclent sans saut de coordonnées', () => {
  const project=(camera,speed)=>sceneryProjection(camera,36,432,40,480,speed);
  assert.ok(sceneryParallax.distant < sceneryParallax.middle);
  assert.ok(sceneryParallax.middle < sceneryParallax.street);
  for (const speed of Object.values(sceneryParallax)) {
    assert.ok(Math.abs(project(11,speed)-project(10,speed)+40*speed)<1e-9);
    assert.equal(project(0,speed),project(432,speed));
    assert.ok(Math.abs(project(431.99,speed)-project(0,speed))<1);
  }
});

test('Les décors et les façades conservent leurs proportions natives', () => {
  for(const [naturalWidth,naturalHeight] of [[1536,512],[730,640],[380,640]]) {
    const image={naturalWidth,naturalHeight};
    assert.equal(750/sceneryImageHeight(image,750),naturalWidth/naturalHeight);
    const box=buildingGeometry({metrics:{characterHeight:81,groundY:502},width:960},{type:'imprimerie'},image);
    assert.ok(Math.abs(box.w/box.h-naturalWidth/naturalHeight)<1e-12);
    assert.equal(box.top+box.h,502);
  }
});

test('Le cache partage un chargement, protège les voisins et évince les anciens décors', async () => {
  const images = [];
  const cache = new VisualAssets({a:{file:'a'},b:{file:'b'},c:{file:'c'}}, {limit:2, createImage:()=>{const image={};images.push(image);return image;}});
  const a=cache.load('a'); assert.equal(cache.load('a'),a); assert.equal(images.length,1); assert.equal(cache.get('a'),null);
  images[0].onload(); await a;
  const b=cache.keep(['b']); images[1].onload(); await b;
  const c=cache.load('c'); images[2].onload(); await c;
  assert.equal(cache.get('a'),null); assert.ok(cache.get('b')); assert.ok(cache.get('c'));
  assert.equal(cache.status().pending,0); assert.equal(cache.cache.size,2);
});

test('Un export absent ne bloque pas une scène et une erreur ne provoque pas de boucle réseau', async () => {
  const images=[]; const cache=new VisualAssets({bad:{file:'bad'}},{createImage:()=>{const image={};images.push(image);return image;}});
  assert.equal(await cache.load('absent'),null);
  const pending=cache.load('bad'); images[0].onerror(); assert.equal(await pending,null);
  assert.equal(await cache.load('bad'),null); assert.equal(images.length,1); assert.deepEqual(cache.status().failed,['bad']);
});

test('Le démarrage refuse une image absente et Réessayer relance uniquement les échecs', async () => {
  const images = [], progress = [];
  const cache = new VisualAssets({ good: { file: 'good' }, bad: { file: 'bad' } }, {
    createImage: () => { const image = {}; images.push(image); return image; },
  });
  const first = cache.loadRequired(['good', 'bad'], ratio => progress.push(ratio));
  const rejected = assert.rejects(first, /images/);
  await images[0].onload(); images[1].onerror(); await rejected;
  assert.deepEqual(progress, [.5]);
  assert.equal(await cache.load('bad'), null, 'Le dessin ne relance pas une image en échec');
  const retry = cache.loadRequired(['good', 'bad']);
  assert.equal(images.length, 3, 'L’image réussie reste réutilisée');
  await images[2].onload(); await retry;
  assert.deepEqual(cache.status().failed, []);
  await assert.rejects(cache.loadRequired(['non-déclarée']), /images/);
});

test('Le chargement complet et les changements de zone conservent tous les sprites de la carte', async () => {
  const state = new GameSimulation(campaignConfig()).getState();
  let created = 0;
  const assets = new VisualAssets(visualManifest, { limit: 4, createImage: () => {
    created++;
    const image = { set src(value) { queueMicrotask(() => image.onload()); } };
    return image;
  } });
  const renderer = { assets }, ids = worldAssetIds(visualManifest, state);
  for (const building of state.buildings) assert.ok(ids.includes(buildingAssetId(building, state.world)));
  for (const id of Object.keys(visualManifest).filter(id => /^(character-|ultimate-)/.test(id))) assert.ok(ids.includes(id), id);
  assert.ok(!ids.some(id => /^background-(strip-|\d)/.test(id)), 'Les anciens panoramas inutilisés ne prennent pas de mémoire');
  preloadWorld(renderer, state, state.world.subzones[0]);
  await assets.loadRequired(ids);
  assert.equal(created, ids.length);
  for (const zone of [...state.world.subzones, ...state.world.subzones.toReversed()]) {
    preloadWorld(renderer, state, zone);
    for (const id of ids) assert.ok(assets.get(id), `${id} reste disponible en zone ${zone.index}`);
    assert.equal(assets.status().pending, 0);
  }
  assert.equal(created, ids.length, 'Aucun sprite recréé aux changements de zone');
});

test('Le préchargement relie les deux extrémités de la boucle', () => {
  const zones=[{index:0},{index:1},{index:2},{index:3}];
  assert.deepEqual(neighboringSubzones(zones,0),[zones[3],zones[0],zones[1]]);
  assert.deepEqual(neighboringSubzones(zones,3),[zones[2],zones[3],zones[0]]);
  assert.deepEqual(neighboringSubzones([],0),[]);
});

test('Une image chargée à la demande reste disponible lorsque les images protégées dépassent la capacité', async () => {
  const images = [];
  const manifest = Object.fromEntries(Array.from({ length: 12 }, (_, i) => [`image-${i}`, { file: `${i}` }]));
  const cache = new VisualAssets(manifest, { limit: 4, createImage: () => { const image = {}; images.push(image); return image; } });
  const protectedIds = Object.keys(manifest).slice(0, 6);
  cache.protectedIds = new Set(protectedIds);
  for (const id of Object.keys(manifest)) {
    const loading = cache.load(id); images.at(-1).onload(); await loading;
  }
  for (const id of protectedIds) assert.ok(cache.get(id));
  assert.ok(cache.get('image-11'));
  assert.equal(cache.cache.size, 7, 'La réserve reste bornée');
  assert.equal(await cache.load('image-11'), images.at(-1));
  assert.equal(images.length, 12, 'Aucun rechargement de la dernière image');
});

test('Le chargement attend le décodage et la préparation sans dépasser la concurrence prévue', async () => {
  const images = [];
  let finishDecode, finishPreparation;
  const decoding = new Promise(resolve => { finishDecode = resolve; });
  const preparation = new Promise(resolve => { finishPreparation = resolve; });
  const cache = new VisualAssets({ a: { file: 'a' }, b: { file: 'b' }, c: { file: 'c' } }, {
    concurrency: 1,
    createImage: () => { const image = { decode: () => decoding }; images.push(image); return image; },
    prepareImage: () => preparation,
  });
  const pending = cache.preload(['a', 'b', 'c', 'a']);
  assert.equal(images.length, 1);
  const loaded = images[0].onload();
  assert.equal(cache.get('a'), null);
  finishDecode(); await Promise.resolve();
  assert.equal(cache.get('a'), null);
  assert.equal(images.length, 1);
  finishPreparation(); await loaded;
  assert.ok(cache.get('a')); assert.equal(images.length, 2);
  images[1].onerror();
  assert.equal(images.length, 3, 'Une erreur libère la file');
  await images[2].onload();
  assert.deepEqual(await pending, [images[0], null, images[2]]);
  assert.equal(cache.status().pending, 0);
});

test('Un navigateur refusant decode conserve une image chargée et le rendu de secours de préparation', async () => {
  const image = { decode: async () => { throw new Error('Décodage indisponible'); } };
  const cache = new VisualAssets({ a: { file: 'a' } }, {
    createImage: () => image,
    prepareImage: async () => { throw new Error('Préparation indisponible'); },
  });
  const loading = cache.load('a'); await image.onload();
  assert.equal(await loading, image);
  assert.equal(cache.get('a'), image);
});

test('Le visage du PNJ reste stable après déplacement et conversion ; les journalistes ont leur propre sprite', () => {
  const state={world:{subzones:[{id:'origine',biome_id:'banlieue'}]}};
  const entity={id:'citoyen-12',origin_subzone_id:'origine',role:'NEUTRE',x:3};
  const before=characterAssetId(entity,state);
  assert.equal(characterAssetId({...entity,role:'MILITANT',faction_id:'philippe',x:300},state),before);
  assert.match(characterAssetId({id:'journaliste-1',role:'CANDIDAT',faction_id:'melenchon',presentation_name:'Journaliste'},{}),/^journalist-/);
});

test('Les animations respectent la priorité KO, impact et action sans modifier la simulation', () => {
  const entity=Object.freeze({id:'c',moving:true,combat:Object.freeze({stun_ticks:3,knockback_velocity:2})});
  const state=Object.freeze({tick:40,attacks:Object.freeze([{owner_id:'c',strong:true}])});
  assert.equal(characterAnimation(entity,state),'knockback');
  assert.equal(characterAnimation({...entity,is_ko:true},state),'ko');
  assert.equal(characterAnimation({...entity,combat:{}},state),'attack_heavy');
});
