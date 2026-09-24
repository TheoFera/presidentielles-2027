import fs from 'node:fs';
const jobs=JSON.parse(fs.readFileSync('docs/ultimate-animation-prompts.json','utf8').replace(/^\uFEFF/,''));
const measured=JSON.parse(fs.readFileSync('artifacts/ultimate-measurements.json','utf8'));
const registryPath='visual_codex/generated_asset_registry.json';
const registry=JSON.parse(fs.readFileSync(registryPath,'utf8'));
let manifest=fs.readFileSync('src/presentation/visual-manifest.js','utf8');
const atlases={};
for(const job of jobs) {
  const key=job.id.replace('ultimate-','').replace('-v1',''),m=measured[key];
  if(!m)continue;
  const frames=m.bounds.map(([x,y,right,bottom],i)=>{
    let pivot=x+(right-x)/2;
    if(key==='scarf'&&i<4)pivot=[176,550,930,1375][i];
    if(key==='wave'&&i<4)pivot=[189,565,930,1354][i];
    if(key==='fire'&&i<4)pivot=[180,600,965,1362][i];
    if(key==='bardella')pivot=[155,465,780,1080,150,440,780,1065,140,402,770,1060,155,440,805,1092][i];
    if(key==='europe'&&i<12)pivot=[160,477,775,1110,160,465,770,1065,156,425,785,1080][i];
    // Keep the fist, omit the short cloth already painted after it; the long
    // animated fabric attaches here without duplicating the gold tassel.
    if(key==='scarf'&&i===2)right=1148;
    const left=Math.max(0,x-2),top=Math.max(0,y-2);
    return [left,top,Math.min(m.size[0],right+2)-left,Math.min(m.size[1],bottom+2)-top,Math.round(pivot),bottom-1];
  });
  const referenceHeight=Math.max(...m.bounds.slice(0,4).map(b=>b[3]-b[1]))*(key==='surge'?1.12:1);
  atlases[key]={sprite:job.id,referenceHeight,frames};
  if(Object.keys(m.clips||{}).length)atlases[key].clips=m.clips;
  const entry={id:job.id,key:job.id,asset_id:job.id,file:job.file,transparent:true,prompt:job.prompt,source_reference:job.refs[0],date:'2026-09-23',status:'validated'};
  const index=registry.assets.findIndex(a=>a.id===job.id);
  if(index<0)registry.assets.push(entry);else registry.assets[index]=entry;
  if(!manifest.includes("'"+job.id+"'"))manifest=manifest.replace('export const visualManifest = {',`export const visualManifest = {\n  '${job.id}': { file: new URL('../../${job.file}', import.meta.url).href },`);
}
fs.writeFileSync('src/presentation/ultimate-sprite-data.js','// Generated from alpha measurements; see scripts/register-ultimate-atlases.mjs.\nexport const ultimateAtlases = '+JSON.stringify(atlases)+';\n');
fs.writeFileSync(registryPath,JSON.stringify(registry,null,2)+'\n');
fs.writeFileSync('src/presentation/visual-manifest.js',manifest);
console.log(Object.keys(atlases).length+' planches d’ultimes enregistrées.');
