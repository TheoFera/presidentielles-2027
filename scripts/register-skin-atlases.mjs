import fs from 'node:fs';
import path from 'node:path';
import {combatAtlases} from '../src/presentation/melenchon-combat.js';
import {additionalExtraAtlases} from '../src/presentation/candidate-extra-atlases.js';

const jobs=JSON.parse(fs.readFileSync('docs/skin-animation-prompts.json','utf8'));
const measurements=JSON.parse(fs.readFileSync('artifacts/skin-measurements.json','utf8'));
const skins={};
const registryPath='visual_codex/generated_asset_registry.json';
const registry=JSON.parse(fs.readFileSync(registryPath,'utf8'));
let manifest=fs.readFileSync('src/presentation/visual-manifest.js','utf8');
const median=a=>a.sort((x,y)=>x-y)[Math.floor(a.length/2)];
for(const job of jobs){
  const measured=measurements[path.basename(job.file)];
  if(!measured)continue;
  if(measured.count!==16||measured.columns.some(n=>n!==4))throw Error('Découpe à vérifier : '+job.file);
  const faction=job.id.startsWith('melenchon_')?'melenchon':job.id.startsWith('le_pen_')?'le_pen':'philippe';
  const source=job.kind==='combat'?combatAtlases[faction]:additionalExtraAtlases.philippe[job.kind];
  const frames=measured.bounds.map(([x,y,x2,y2],index)=>{
    const [sx,,sw,,px]=source.frames[index];
    const pivot=Math.round(x+(px-sx)/sw*(x2-x));
    // Two pixels of transparent margin preserve antialiased edges.
    const left=Math.max(0,x-2),top=Math.max(0,y-2),right=Math.min(measured.size[0],x2+2),bottom=Math.min(measured.size[1],y2+2);
    return [left,top,right-left,bottom-top,pivot,y2-2];
  });
  const upright=job.kind==='combat'?[0,2,3,4,5,6,7,9,11,14]:job.kind==='movement'?[0,1,2,3,4,5,6,7,11,12]:[0,1,4,5,6,7,8,9];
  const ratio=median(upright.map(i=>(measured.bounds[i][3]-measured.bounds[i][1])/source.frames[i][3]));
  const sprite='character-skin-'+job.slug+'-'+job.kind+'-v1';
  const atlas={sprite,referenceHeight:Math.round((source.referenceHeight||(job.kind==='combat'?340:360))*ratio),frames};
  if(Object.keys(measured.clips||{}).length)atlas.clips=measured.clips;
  skins[job.id]??={faction,extras:{}};
  if(job.kind==='combat')skins[job.id].combat=atlas;else skins[job.id].extras[job.kind]=atlas;
  const entry={id:sprite,key:sprite,asset_id:sprite,file:job.file,transparent:true,prompt:job.prompt,source_reference:job.refs[1],date:'2026-09-23',status:'validated'};
  const existing=registry.assets.findIndex(a=>a.id===sprite);
  if(existing<0)registry.assets.push(entry);else registry.assets[existing]=entry;
  if(!manifest.includes("'"+sprite+"'"))manifest=manifest.replace('export const visualManifest = {',`export const visualManifest = {\n  '${sprite}': { file: new URL('../../${job.file}', import.meta.url).href },`);
}
// Never enable an incomplete costume.
for(const id of Object.keys(skins))if(!skins[id].combat||!skins[id].extras.movement||!skins[id].extras.actions)delete skins[id];
fs.writeFileSync('src/presentation/skin-animation-data.js','// Generated: measured silhouettes and body pivots; edit the source PNGs or scripts, not this data.\nexport const skinAtlasData = '+JSON.stringify(skins)+';\n');
fs.writeFileSync(registryPath,JSON.stringify(registry,null,2)+'\n');
fs.writeFileSync('src/presentation/visual-manifest.js',manifest);
console.log(Object.keys(skins).length+' tenues complètes enregistrées.');
