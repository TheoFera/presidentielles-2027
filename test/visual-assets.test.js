import test from 'node:test';
import assert from 'node:assert/strict';
import { VisualAssets, neighboringSubzones } from '../src/presentation/visual-assets.js';
import { characterAssetId, characterAnimation, drawIllustratedCharacter, npcAppearanceAssetId, npcBiomeOrder, npcVariantCounts, npcVisualBiome } from '../src/presentation/illustrated-characters.js';
import { recolorTractPixels } from '../src/presentation/militant-sprites.js';
import { sceneryProjection, sceneryParallax, sceneryImageHeight, worldAssetIds, preloadWorld } from '../src/presentation/illustrated-world.js';
import { buildingGeometry, buildingAssetId } from '../src/presentation/illustrated-buildings.js';
import { GameSimulation } from '../src/simulation/game-simulation.js';
import { campaignConfig } from '../scripts/validate-campaign.mjs';
import { visualManifest } from '../src/presentation/visual-manifest.js';
import { access, readFile } from 'node:fs/promises';
import { inflateSync } from 'node:zlib';

function coloredTractRegions(png) {
  const width = png.readUInt32BE(16), height = png.readUInt32BE(20), stride = width * 4;
  const chunks = [];
  for (let offset = 8; offset < png.length;) {
    const length = png.readUInt32BE(offset), type = png.toString('ascii', offset + 4, offset + 8);
    if (type === 'IDAT') chunks.push(png.subarray(offset + 8, offset + 8 + length));
    offset += length + 12;
  }
  const raw = inflateSync(Buffer.concat(chunks));
  const colored = new Uint8Array(width * height);
  let previous = new Uint8Array(stride), offset = 0;
  const paeth = (left, up, corner) => {
    const prediction = left + up - corner;
    const a = Math.abs(prediction - left), b = Math.abs(prediction - up), c = Math.abs(prediction - corner);
    return a <= b && a <= c ? left : b <= c ? up : corner;
  };
  for (let y = 0; y < height; y++) {
    const filter = raw[offset++], row = new Uint8Array(stride);
    for (let i = 0; i < stride; i++) {
      const left = i >= 4 ? row[i - 4] : 0;
      const up = previous[i], corner = i >= 4 ? previous[i - 4] : 0;
      row[i] = (raw[offset++] + [0, left, up, (left + up) >> 1, paeth(left, up, corner)][filter]) & 255;
    }
    for (let x = 0; x < width; x++) {
      const i = x * 4, chroma = Math.min(row[i], row[i + 2]);
      colored[y * width + x] = row[i + 3] > 200 && chroma > 135 && row[i + 1] < chroma * .55 ? 1 : 0;
    }
    previous = row;
  }
  const queue = new Int32Array(width * height);
  const regions = [];
  for (let start = 0; start < colored.length; start++) {
    if (!colored[start]) continue;
    let head = 0, tail = 1; queue[0] = start; colored[start] = 0;
    let minX = width, maxX = 0, minY = height, maxY = 0;
    while (head < tail) {
      const pixel = queue[head++], x = pixel % width;
      const y = Math.floor(pixel / width);
      minX = Math.min(minX, x); maxX = Math.max(maxX, x);
      minY = Math.min(minY, y); maxY = Math.max(maxY, y);
      const neighbors = [];
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if ((dx || dy) && x + dx >= 0 && x + dx < width && y + dy >= 0 && y + dy < height) {
          neighbors.push(pixel + dy * width + dx);
        }
      }
      for (const neighbor of neighbors) {
        if (neighbor >= 0 && colored[neighbor]) { colored[neighbor] = 0; queue[tail++] = neighbor; }
      }
    }
    if (tail >= 12) regions.push({ size: tail, minX, maxX, minY, maxY });
  }
  // Un filet sombre peut séparer de quelques pixels le bord du même paquet.
  const merged = [];
  for (const region of regions) {
    const packet = merged.find((other) =>
      region.minX <= other.maxX + 2 && region.maxX >= other.minX - 2 &&
      region.minY <= other.maxY + 2 && region.maxY >= other.minY - 2);
    if (packet) {
      packet.size += region.size;
      packet.minX = Math.min(packet.minX, region.minX);
      packet.maxX = Math.max(packet.maxX, region.maxX);
      packet.minY = Math.min(packet.minY, region.minY);
      packet.maxY = Math.max(packet.maxY, region.maxY);
    } else merged.push({ ...region });
  }
  return merged;
}

test('Chaque biome possède ses sept façades, ses vingt habitants et ses trois décors', async () => {
  for (const biome of ['bobo','banlieue','periurbain','campagne','retraites','riches']) {
    for (const family of ['campaign_local','financement','communication','security_admin_slot','imprimerie','meeting_hall','meeting_stage','polling_institute']) {
      const id = `building-${family}-${biome}`;
      assert.ok(visualManifest[id], id); await access(new URL(visualManifest[id].file));
    }
    for (let i = 0; i < npcVariantCounts[biome]; i++) assert.ok(visualManifest[`npc-${biome}-${i}`]);
    for (const id of [`background-strip-${biome}`,`distant-${biome}`,`street-${biome}`,`landscape-${biome}`]) { assert.ok(visualManifest[id],id); await access(new URL(visualManifest[id].file)); }
  }
  for (let i = 0; i < 18; i++) { assert.ok(visualManifest[`background-${i}`]); await access(new URL(visualManifest[`background-${i}`].file)); }
  for (const id of ['character-melenchon','character-le_pen','character-philippe','security-0','security-1','crs-0','crs-1','journalist-0','journalist-1','journalist-2']) assert.ok(visualManifest[id], id);
});

test('Les 120 portraits militants ont une variante transparente à la taille du portrait neutre', async () => {
  for (const biome of npcBiomeOrder) for (let i = 0; i < npcVariantCounts[biome]; i++) {
    const neutral = `npc-${biome}-${i}`;
    const militant = `${neutral}-militant`;
    assert.ok(visualManifest[militant], militant);
    const [base, pose] = await Promise.all([
      readFile(new URL(visualManifest[neutral].file)), readFile(new URL(visualManifest[militant].file)),
    ]);
    assert.equal(pose.subarray(0, 8).toString('hex'), '89504e470d0a1a0a', militant);
    assert.equal(pose.readUInt32BE(16), base.readUInt32BE(16), militant);
    assert.equal(pose.readUInt32BE(20), base.readUInt32BE(20), militant);
    assert.equal(pose[25], 6, `Transparence RGBA : ${militant}`);
    const regions = coloredTractRegions(pose);
    assert.equal(regions.length, 1, `Un seul paquet de tracts : ${militant} ${JSON.stringify(regions)}`);
  }
  assert.match(visualManifest['npc-banlieue-9'].file, /npc-banlieue-9-fixed\.png/);
  assert.match(visualManifest['npc-riches-18'].file, /npc-riches-18-fixed\.png/);
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
  assert.equal(characterAssetId({...entity,role:'SYMPATHISANT',faction_id:'philippe',x:300},state),before);
  assert.equal(characterAssetId({...entity,role:'MILITANT',faction_id:'philippe',x:300},state),`${before}-militant`);
  assert.equal(characterAssetId({...entity,role:'NEUTRE',faction_id:null,x:300},state),before);
  assert.match(characterAssetId({id:'journaliste-1',role:'CANDIDAT',faction_id:'melenchon',presentation_name:'Journaliste'},{}),/^journalist-/);
});

test('Les trois couleurs de tract remplacent uniquement le repère magenta', () => {
  const base = [255, 0, 255, 255, 70, 90, 110, 255, 255, 0, 255, 0];
  for (const color of ['#bb4c51', '#426594', '#ba9450']) {
    const pixels = new Uint8ClampedArray(base);
    recolorTractPixels(pixels, color);
    assert.deepEqual([...pixels.slice(0, 3)], [1, 3, 5].map(index => Number.parseInt(color.slice(index, index + 2), 16)));
    assert.deepEqual([...pixels.slice(4)], base.slice(4));
  }
});

test('Le pin’s rond est sur le torse des sympathisants et militants, jamais sur un neutre', () => {
  const arcs = [], images = [];
  const ctx = new Proxy({}, { get: (_target, name) => (...args) => {
    if (name === 'arc') arcs.push(args);
    if (name === 'drawImage') images.push(args);
  }, set: () => true });
  const renderer = {
    ctx, metrics: { groundY: 200, characterHeight: 100 },
    p: { npc_height_multiplier: .92, factions: { le_pen: { color: '#426594' } } },
    config: { balance: { simulation_architecture: { fixed_tick_hz: 60 } } },
    assets: { get: () => ({ naturalWidth: 110, naturalHeight: 256 }) },
  };
  const npc = { id: 'npc:1', origin_subzone_id: 'zone', role: 'NEUTRE', faction_id: null,
    x: 4, facing: 1, combat: { height: 0 }, converted_tick: -1 };
  const state = { tick: 100, npcs: [npc], attacks: [], buildings: [], candidates: [],
    world: { subzones: [{ id: 'zone', biome_id: 'banlieue', start: 0, end: 10 }] } };
  for (const role of ['NEUTRE', 'SYMPATHISANT', 'MILITANT']) {
    arcs.length = 0;
    drawIllustratedCharacter(renderer, { ...npc, role, faction_id: role === 'NEUTRE' ? null : 'le_pen' }, 50, state);
    assert.equal(arcs.length, role === 'NEUTRE' ? 0 : 1, role);
    if (arcs.length) {
      assert.ok(arcs[0][0] > 0, 'pin’s à l’intérieur du torse, pas sur le bras');
      assert.ok(arcs[0][1] < -92 * .55 && arcs[0][1] > -92 * .68, 'pin’s sur le torse');
      assert.ok(arcs[0][2] >= 4, 'pin’s lisible');
    }
  }
  arcs.length = 0; images.length = 0;
  drawIllustratedCharacter(renderer, { ...npc, role: 'MILITANT', faction_id: 'le_pen', moving: true }, 50, state);
  assert.equal(images.length, 3, 'Le portrait militant conserve la marche animée');
  assert.equal(arcs.length, 1, 'Le pin’s suit le militant pendant la marche');
});

test('Un quart des PNJ emprunte une apparence aux deux biomes voisins', () => {
  for (let homeIndex = 0; homeIndex < npcBiomeOrder.length; homeIndex++) {
    const home = npcBiomeOrder[homeIndex];
    const previous = npcBiomeOrder[(homeIndex + npcBiomeOrder.length - 1) % npcBiomeOrder.length];
    const next = npcBiomeOrder[(homeIndex + 1) % npcBiomeOrder.length];
    const selected = Array.from({length:800}, (_, index) => npcVisualBiome({id:`npc:${index}`}, home));
    assert.ok(selected.every(biome => [home, previous, next].includes(biome)));
    const neighboringShare = selected.filter(biome => biome !== home).length / selected.length;
    assert.ok(neighboringShare >= 0.23 && neighboringShare <= 0.27, `${home}: ${neighboringShare}`);
  }
});

test('Une zone utilise ses vingt apparences avant d’autoriser un doublon', () => {
  const npcs = Array.from({length:21}, (_, index) => ({
    id:`npc:${index + 1}`, origin_subzone_id:'banlieue_a', role:'NEUTRE', x:index,
  }));
  const state={npcs,world:{subzones:[{id:'banlieue_a',biome_id:'banlieue',start:0,end:100,width:100}]}};
  const assets=npcs.map(npc => npcAppearanceAssetId(npc,state,'banlieue'));
  assert.equal(new Set(assets.slice(0,20)).size,20);
  assert.ok(assets.slice(0,20).includes(assets[20]));
  assert.equal(assets.slice(0,20).filter(id => id.startsWith('npc-banlieue-')).length,15);
  assert.equal(characterAssetId(npcs[20],state),assets[20]);
});

test('Les animations respectent la priorité KO, impact et action sans modifier la simulation', () => {
  const entity=Object.freeze({id:'c',moving:true,combat:Object.freeze({stun_ticks:3,knockback_velocity:2})});
  const state=Object.freeze({tick:40,attacks:Object.freeze([{owner_id:'c',strong:true}])});
  assert.equal(characterAnimation(entity,state),'knockback');
  assert.equal(characterAnimation({...entity,is_ko:true},state),'ko');
  assert.equal(characterAnimation({...entity,combat:{}},state),'attack_heavy');
});
