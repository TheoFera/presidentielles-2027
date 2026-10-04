import fs from 'node:fs';
const base='docs/production/decor-v3/carte-plate/production/',file=base+'revisions-composition.json',a=JSON.parse(fs.readFileSync(file));
const pilot=JSON.parse(fs.readFileSync(base+'revision-geometrie-pilote.json')),banlieue=JSON.parse(fs.readFileSync(base+'revision-banlieue-a.json')),seams=JSON.parse(fs.readFileSync(base+'revision-raccords-banlieue-a.json'));
for(const e of [...pilot.revisions,banlieue,...seams.retouches]){
 if(a.revisions.some(v=>v.id===e.id&&v.source===e.source))continue;
 a.revisions.push(e);
}
for(const e of pilot.rejets)if(!a.variantesNonAppliquees.some(v=>v.id===e.id&&v.source===e.source))a.variantesNonAppliquees.push(e);
const suite=JSON.parse(fs.readFileSync(base+'revision-geometrie-suite.json'));
for(const e of suite.generations){
 const entry={...e,source:e.sourceOriginale};
 if(!a.revisions.some(v=>v.id===entry.id&&v.source===entry.source))a.revisions.push(entry);
}
const direction=JSON.parse(fs.readFileSync(base+'revision-direction-artistique.json'));
for(const entry of direction.generations)if(!a.revisions.some(v=>v.id===entry.id&&v.source===entry.source))a.revisions.push(entry);
for(const entry of direction.variantesNonAppliquees)if(!a.variantesNonAppliquees.some(v=>v.id===entry.id&&v.source===entry.source))a.variantesNonAppliquees.push(entry);
a.restaurationsArtistiques=direction.restaurations;
a.etat='18 tuiles réexportées ; Maison de la Radio secondaire, tours rééquilibrées et intérieurs Riches C différents. Gabarits utilisés comme repères selon les dernières précisions. Petite promenade Retraités B restaurée ; portes naturelles de l’atelier et de la grange restaurées, scooters ajoutés à l’intérieur. Raccords visuels et détails de storyboard encore à finir.';
a.controles.geometrie='production/controle-geometrie/rapport-calage-carte.json';
a.actualiseLe=new Date().toISOString();
fs.writeFileSync(file,JSON.stringify(a,null,2));console.log('Historique des révisions et rejets actualisé sans effacer les générations antérieures.');
