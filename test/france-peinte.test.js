import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { config } from '../scripts/game-config.mjs';
import { GameSimulation } from '../src/simulation/game-simulation.js';
import { paintedScene, paintedAssetIds, PAINTED_ZONES, PAINTED_PLANES } from '../src/presentation/france-peinte-data.js';
import { paintedProjection } from '../src/presentation/france-peinte.js';
import { decorForProfile } from '../src/presentation/map-decor.js';
import { worldAssetIds } from '../src/presentation/illustrated-world.js';
import { setMapDecor } from '../src/presentation/map-decor.js';
import { visualManifest } from '../src/presentation/visual-manifest.js';
import { COMPLETE_CALIBRATION } from '../src/presentation/france-peinte-calibration.js';
import { completeStreetFrame, completeHorizonScale } from '../src/presentation/france-peinte-complete.js';
import { completePaintedAssetIds, COMPLETE_ZONES, completePaintedAssets } from '../src/presentation/france-peinte-complete-data.js';

const { world, buildings, ...rest }=new GameSimulation(structuredClone(config),42).state;
const scene=paintedScene(world,buildings);

test('Configuration du premier essai : 18 sous-zones et 21 sites aux positions du jeu',()=>{
  assert.deepEqual(Object.keys(PAINTED_ZONES),world.subzones.map(z=>z.id));
  assert.equal(Object.keys(scene.sites).length,21);
  for(const b of buildings.filter(b=>b.type!=='meeting')) {
    assert.equal(scene.sites[b.site_id].x,b.x);
    const z=scene.sites[b.site_id].zone, ratio=(b.x-z.start)/z.width;
    assert.ok(ratio>=.15 && ratio<=.85,b.site_id);
    if(z.local_index===1) assert.ok(ratio<=.35 || ratio>=.65,b.site_id);
  }
  assert.equal(buildings.filter(b=>b.type==='meeting').length,6);
});

test('France peinte : aucun décor solide sur une place de meeting ou une devanture',()=>{
  for(const e of scene.planes.street.filter(e=>!e.building)) for(const b of buildings) {
    const width=b.type==='meeting'?7.2:scene.sites[b.site_id].w;
    assert.ok(Math.abs(e.x-b.x)>=(e.w+width)/2,`${e.zone.id} devant ${b.site_id}`);
  }
  for(const e of scene.planes.back.filter(e=>e.tree)) for(const b of buildings)
    assert.ok(Math.abs(e.x-b.x)>= (b.type==='meeting'?5:3.5));
});

test('France peinte : cinq plans, repères dans leur territoire et boucle de projection',()=>{
  const speeds=Object.values(PAINTED_PLANES).map(p=>p.speed);
  assert.deepEqual(speeds,[.2,.3,.5,.72,1]);
  const all=Object.values(scene.planes).flat();
  for(const e of all) {
    assert.ok(e.x>=e.zone.start && e.x<=e.zone.end);
    assert.ok(paintedAssetIds().includes(`peint-${e.atlas}`));
    assert.ok(Math.abs(paintedProjection(0,e,world.length,40,480,.3)-paintedProjection(world.length,e,world.length,40,480,.3))<1e-8);
  }
  assert.ok(scene.planes.horizon.some(e=>e.zone.id==='periurbain_c' && e.h>=265));
  assert.ok(all.some(e=>e.atlas==='basilique' && e.zone.id==='banlieue_b'));
  assert.ok(all.some(e=>e.atlas==='riches' && e.cell===9 && e.zone.id==='riches_b'));
  assert.ok(all.some(e=>e.atlas==='riches' && e.cell===10 && e.zone.id==='riches_c'));
  assert.ok(all.some(e=>e.atlas==='retraites' && e.cell===6 && e.zone.id==='retraites_b'),'pharmacie');
});

test('France peinte : sélection du profil et préchargement sans anciens bâtiments',()=>{
  assert.equal(decorForProfile({nickname:'betatest',map_decor:'france_peinte'}),'france_peinte');
  setMapDecor('france_peinte');
  try {
    const ids=worldAssetIds(visualManifest,{world,buildings,...rest});
    for(const id of paintedAssetIds()) assert.ok(ids.includes(id));
    for(const id of completePaintedAssetIds()) assert.ok(ids.includes(id));
    assert.ok(!ids.some(id=>id.startsWith('panorama-') || id.startsWith('street-')));
    assert.ok(!ids.some(id=>id.startsWith('building-') && !id.startsWith('building-meeting_stage-')));
  } finally { setMapDecor('biomes'); }
});

test('Quartiers peints : les panneaux suivent les sites du jeu, sans déformation',()=>{
  const metrics={pixelsPerUnit:40,characterHeight:81,groundY:484,anchorX:480};
  const entries=Object.values(COMPLETE_CALIBRATION.street);
  assert.equal(entries.length,COMPLETE_ZONES.size*2);
  const paintedSites=entries.filter(e=>e.site).map(e=>e.site).sort();
  const expectedSites=buildings.filter(b=>b.type!=='meeting' && COMPLETE_ZONES.has(b.subzone_id)).map(b=>b.site_id).sort();
  assert.deepEqual(paintedSites,expectedSites);
  for(const entry of entries) {
    const building=entry.site && buildings.find(b=>b.site_id===entry.site);
    const frame=completeStreetFrame(metrics,world,36,entry,building);
    assert.ok(Math.abs(frame.width/frame.height-entry.width/entry.height)<1e-12);
    assert.ok(Math.abs(frame.top+entry.baseline*frame.scale-(metrics.groundY-12))<1e-8);
    if(building) {
      const signX=frame.left+(entry.sign[0]+entry.sign[2]/2)*frame.scale;
      assert.ok(Math.abs(signX-(metrics.anchorX+(building.x-36)*metrics.pixelsPerUnit))<1e-8);
      const afterLoop=completeStreetFrame(metrics,world,36+world.length,entry,building);
      assert.ok(Math.abs(frame.left-afterLoop.left)<1e-8);
    }
  }
});

test('Paris et banlieue en hiver : les variantes gardent les portes, les panneaux et le cadrage',()=>{
  for(const [name,entry] of Object.entries(COMPLETE_CALIBRATION.street)) {
    if(!entry.zone.startsWith('paris_') && !entry.zone.startsWith('banlieue_')) continue;
    assert.ok(entry.winter,`${name} : variante d'hiver manquante`);
    assert.equal(entry.winter.width,entry.width,name);
    assert.equal(entry.winter.height,entry.height,name);
    // Quelques pixels de neige recouvrent le bord du trottoir ; le bâti reste calé.
    assert.ok(Math.abs(entry.winter.baseline-entry.baseline)<=4,name);
    if(entry.sign) for(let i=0;i<4;i++) assert.ok(Math.abs(entry.winter.sign[i]-entry.sign[i])<=2,`${name} : panneau déplacé`);
  }
});

test('Quartiers peints : chaque image déclarée existe dans les sources',()=>{
  for(const [id,asset] of Object.entries(completePaintedAssets)) assert.ok(existsSync(new URL(asset.file)),id);
});

test('Massif : le sommet reste entier après le cadrage dans les trois formats',()=>{
  const entry=COMPLETE_CALIBRATION.layers['periurbain-massif'];
  assert.ok(entry.top>0 && entry.top<entry.baseline);
  for(const width of [720,960,1170]) {
    const metrics={groundY:484,characterHeight:81,pixelsPerUnit:width/24};
    const scale=completeHorizonScale(metrics,entry,58,20,1.25);
    const peak=metrics.groundY-20-(entry.baseline-entry.top)*scale;
    const visiblePeak=metrics.groundY+(peak-metrics.groundY)*1.25;
    assert.ok(visiblePeak>=14.99,`${width} : sommet coupé`);
    assert.ok(scale<=58*metrics.pixelsPerUnit/entry.width);
  }
});
