import { test } from 'node:test';
import assert from 'node:assert/strict';
import { config as base } from '../scripts/game-config.mjs';
import { GameSimulation } from '../src/simulation/game-simulation.js';
import { CampaignEventDirector, resolveCampaignEvent, seasonAt } from '../src/simulation/campaign-events.js';
import { completePopulation } from '../src/simulation/spawns.js';
import { convertNeutral } from '../src/simulation/npc-votes.js';
import { refreshElectoralState } from '../src/simulation/electoral-state.js';
import { ringDelta, zoneAt } from '../src/simulation/world.js';

const make=seed=>{const sim=new GameSimulation(structuredClone(base),seed||42);sim.state.ai_enabled=false;sim.state.candidates.forEach(c=>{c.campaign_active=false;c.interaction_active=false;});completePopulation(sim);return sim;};
const start=sim=>CampaignEventDirector.start(sim,{family:'RASSEMBLEMENT',biomeId:'banlieue'});
const advance=(sim,n)=>{for(let i=0;i<n;i++)sim.step();};
test('Seul le rassemblement est disponible, avec une variante par biome',()=>{
  assert.equal(base.campaignCatalog.length,6);assert.ok(base.campaignCatalog.every(e=>e.family==='RASSEMBLEMENT'));
  const sim=make();assert.equal(CampaignEventDirector.start(sim,{family:'PIEGE_MEDIATIQUE'}),null);assert.ok(start(sim));assert.equal(start(sim),null);
  assert.deepEqual([0,.25,.5,.75].map(p=>seasonAt(p).name),['Été','Automne','Hiver','Printemps']);
});
test('Presque tous les PNJ du biome rejoignent le cortège sans téléportation',()=>{
  const sim=make(),e=start(sim),initial=sim.state.npcs.filter(n=>zoneAt(sim.state.world,n.x).biome_id==='banlieue');
  assert.ok(e.march.participant_ids.length>=initial.length*.9);assert.ok(e.march.participant_ids.every(id=>initial.some(n=>n.id===id)));
  const before=new Map(sim.state.npcs.map(n=>[n.id,n.x]));sim.step();
  for(const n of sim.state.npcs)assert.ok(Math.abs(ringDelta(before.get(n.id),n.x,sim.state.world.length))<=e.parameters.gather_speed/sim.hz*1.1);
  assert.equal(e.march.phase,'GATHERING');
});

test('Un rassemblement libère les conversations et les pressions avant une sauvegarde immédiate', () => {
  const sim = make(), candidate = sim.state.candidates[0]; candidate.campaign_active = true;
  for (const npc of sim.state.npcs.filter(n => n.origin_biome_id === 'banlieue')) npc.x = candidate.x;
  sim.updatePersuasion(); assert.ok(candidate.persuasion_target_ids.length);
  const event = start(sim); assert.ok(event.march.participant_ids.length);
  assert.ok(candidate.persuasion_target_ids.every(id => !event.march.participant_ids.includes(id)));
  const restored = make(); restored.importSnapshot(sim.exportSnapshot());
  assert.deepEqual(restored.state, sim.state);
  const invalid = JSON.parse(sim.exportSnapshot()); invalid.campaign_events[0].march.end_x += 1;
  assert.throws(() => restored.importSnapshot(invalid), /itinéraire du cortège/);
});
test('Marche dans les deux sens entre centres extrêmes, puis retour près du spawn',()=>{
  const directions=new Set();
  for(const seed of [1,17,42,51]){
    const sim=make(seed),e=start(sim),m=e.march;directions.add(m.direction);
    const ends=sim.state.world.subzones.filter(z=>z.biome_id==='banlieue'&&z.local_index!==1).map(z=>z.center);
    assert.deepEqual([m.start_x,m.end_x].sort((a,b)=>a-b),ends);
    advance(sim,sim.secondsToTicks(80));assert.equal(e.status,'RESOLVED');
    for(const id of m.participant_ids){const n=sim.state.npcs.find(n=>n.id===id);assert.equal(n.rally_event_id,null);assert.equal(n.rally_return_x,null);assert.equal(zoneAt(sim.state.world,n.x).id,n.origin_subzone_id);}
  }
  assert.equal(directions.size,2);
});
test('Conversion en marchant des neutres et sympathisants adverses, jamais des militants',()=>{
  const sim=make(),e=start(sim),c=sim.state.candidates[0];c.campaign_active=true;c.axis=1;
  const [neutral,rival,militant]=e.march.participant_ids.slice(0,3).map(id=>sim.state.npcs.find(n=>n.id===id));
  convertNeutral(sim,rival,'le_pen');convertNeutral(sim,militant,'le_pen');militant.role='MILITANT';militant.next_donation_tick=null;
  for(let i=0;i<sim.secondsToTicks(.3);i++){for(const n of [neutral,rival,militant])n.x=c.x+.2;sim.step();}
  assert.equal(neutral.faction_id,c.faction_id);assert.equal(rival.faction_id,c.faction_id);assert.equal(militant.faction_id,'le_pen');
});
test('La fin du cortège arrête les conversions adverses',()=>{
  const sim=make(),e=start(sim),c=sim.state.candidates[0],n=sim.state.npcs.find(n=>n.id===e.march.participant_ids[0]);
  convertNeutral(sim,n,'le_pen');resolveCampaignEvent(sim,e);c.campaign_active=true;
  for(let i=0;i<30;i++){c.x=n.x;sim.step();}assert.equal(n.faction_id,'le_pen');
});
test('Reprise déterministe pendant le rassemblement, la marche et la dispersion',()=>{
  const a=make();start(a);
  for(const ticks of [60,420,600]){advance(a,ticks);refreshElectoralState(a.state);const b=make();b.importSnapshot(a.exportSnapshot());advance(a,20);advance(b,20);assert.deepEqual(a.state,b.state);}
});
test('Désactivation et premier tour libèrent tous les participants',()=>{
  const sim=make(),e=start(sim);sim.config.balance.campaign_events.event_enabled=false;sim.step();assert.equal(e.status,'EXPIRED');assert.ok(sim.state.npcs.every(n=>!n.rally_event_id));
  const other=make();start(other);other.applyCommand({type:'DebugForceJ0'});assert.ok(other.state.npcs.every(n=>!n.rally_event_id));
});
