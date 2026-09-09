import test from 'node:test';
import assert from 'node:assert/strict';
import { VisualAssets, neighboringSubzones } from '../src/presentation/visual-assets.js';
import { characterAssetId, characterAnimation, npcVariantCounts } from '../src/presentation/illustrated-characters.js';
import { sceneryProjection, sceneryParallax, sceneryImageHeight } from '../src/presentation/illustrated-world.js';
import { buildingGeometry } from '../src/presentation/illustrated-buildings.js';
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

test('Le préchargement relie les deux extrémités de la boucle', () => {
  const zones=[{index:0},{index:1},{index:2},{index:3}];
  assert.deepEqual(neighboringSubzones(zones,0),[zones[3],zones[0],zones[1]]);
  assert.deepEqual(neighboringSubzones(zones,3),[zones[2],zones[3],zones[0]]);
  assert.deepEqual(neighboringSubzones([],0),[]);
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
