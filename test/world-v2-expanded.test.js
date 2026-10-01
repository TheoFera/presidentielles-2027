import {test} from 'node:test';
import assert from 'node:assert/strict';
import {config} from '../scripts/game-config.mjs';
import {GameSimulation} from '../src/simulation/game-simulation.js';
import {expandedSiteFrame,expandedProjection,expandedScene} from '../src/presentation/world-v2-expanded.js';
import {EXPANDED_SITES,EXPANDED_ATLASES,expandedWorldAssetIds} from '../src/presentation/world-v2-expanded-data.js';
import {worldAssetIds} from '../src/presentation/illustrated-world.js';
import {visualManifest} from '../src/presentation/visual-manifest.js';
import {setMapDecor} from '../src/presentation/map-decor.js';
import {marketBackgroundX,marketStreetFrame,MARKET_CALIBRATION} from '../src/presentation/world-v2-market.js';

test('World-v2 : toutes les portes suivent les sites réels, à échelle humaine et sans déformation',()=>{
  const {world,buildings}=new GameSimulation(structuredClone(config),42).state;
  for(const building of buildings.filter(b=>b.type!=='meeting')) {
    const entry=EXPANDED_SITES[building.site_id];assert.ok(entry,building.site_id);
    const [atlas,index]=entry,[top,bottom,edges]=EXPANDED_ATLASES[atlas][Math.floor(index/4)],left=edges[index%4];
    for(const factor of [1,2])for(const [characterHeight,pixelsPerUnit] of [[81,40],[140,40],[81,70]]) {
      const metrics={characterHeight,pixelsPerUnit,anchorX:480,groundY:500};
      const cell={left,top,factor,w:(edges[index%4+1]-left)*factor,h:(bottom-top)*factor};
      const frame=expandedSiteFrame(metrics,world,building.x,entry,cell,building.x);
      assert.equal(frame.doorScreen,metrics.anchorX);
      assert.ok(Math.abs(frame.doorHeight/characterHeight-1.15)<1e-12);
      assert.ok(Math.abs(frame.width/frame.height-cell.w/cell.h)<1e-12);
      const loop=expandedSiteFrame(metrics,world,building.x+world.length,entry,cell,building.x);
      assert.ok(Math.abs(loop.left-frame.left)<1e-9);
    }
  }
});
test('World-v2 : six paysages traversent les frontières et la parallaxe reste bornée',()=>{
  const state=new GameSimulation(structuredClone(config),42).state,scene=expandedScene(state.world,state.buildings);
  const transitions=scene.planes.back.filter(item=>item.transition);assert.equal(transitions.length,6);
  for(const item of transitions)assert.equal(item.x,item.zone.start);
  const m={anchorX:480,pixelsPerUnit:40};
  const a=expandedProjection(1,12,state.world.length,m,.2,24);
  assert.equal(a,expandedProjection(1+state.world.length,12,state.world.length,m,.2,24));
  assert.ok(Math.abs(a-(480+11*40))<=24*.14*40);
  assert.equal(scene.sites.length,21);
});
test('World-v2 : les nouveaux compléments sont tous préchargés, sans anciens panoramas agrandis',()=>{
  const state=new GameSimulation(structuredClone(config),42).state;
  setMapDecor('panoramas');
  try{const ids=worldAssetIds(visualManifest,state);for(const id of expandedWorldAssetIds())assert.ok(ids.includes(id)&&visualManifest[id],id);assert.ok(!ids.some(id=>id.startsWith('panorama-')));}
  finally{setMapDecor('biomes');}
});

test('Marché de Saint-Denis : le fond conserve sa vitesse au centre, aux bords et au bouclage',()=>{
  const world=new GameSimulation(structuredClone(config),42).state.world;
  const zone=world.subzones.find(z=>z.id==='banlieue_b'),m={anchorX:480,pixelsPerUnit:40};
  for(const offset of [-24,-12,0,12,24]){
    const a=marketBackgroundX(m,zone.center+offset,zone,world.length);
    const b=marketBackgroundX(m,zone.center+offset+1,zone,world.length);
    assert.ok(Math.abs(b-a+40*.35)<1e-10);
    assert.ok(Math.abs(a-marketBackgroundX(m,zone.center+offset+world.length,zone,world.length))<1e-10);
  }
});

test('Marché de Saint-Denis : la porte et le panneau suivent le site, sans changer ses coordonnées',()=>{
  const state=new GameSimulation(structuredClone(config),42).state;
  const site=state.buildings.find(b=>b.site_id==='site:banlieue_b'),initialX=site.x;
  for(const characterHeight of [50,81,140])for(const factor of [1,2]){
    const m={anchorX:480,groundY:500,pixelsPerUnit:40,characterHeight};
    const image={naturalWidth:MARKET_CALIBRATION.width*factor,naturalHeight:MARKET_CALIBRATION.height*factor};
    const frame=marketStreetFrame(m,site.x,state.world,site,image);
    assert.equal(frame.doorX,480);
    assert.ok(Math.abs(frame.doorHeight/characterHeight-1.15)<1e-12);
    assert.ok(Math.abs(frame.width/frame.height-image.naturalWidth/image.naturalHeight)<1e-12);
    assert.ok(frame.sign.w>0 && frame.sign.h>0);
    assert.equal(site.x,initialX);
  }
});
