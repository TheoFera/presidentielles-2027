// Contrôle des rectangles réellement appliqués, et inventaire des entrées non calées.
import fs from 'node:fs';
import path from 'node:path';
import {readPng} from '../../../../../scripts/lib/png.mjs';
import {plateTiles} from '../../../../../scripts/fresque-plate-gabarits.mjs';
const base=path.resolve('docs/production/decor-v3/carte-plate'),r=path.join(base,'production/retouches'),a=readPng(path.join(base,'production/fresque-en-cours.png'));
const tiles=plateTiles(JSON.parse(fs.readFileSync('Présidentielles 2027/world_layout.json','utf8'))),slots=tiles.flatMap(t=>t.buildings.map(b=>({tuile:t.number,nom:t.name,centre:t.masterLeft+b.x})));
const checks=[];
for(const file of fs.readdirSync(r).filter(f=>f.endsWith('-calibrage.json'))){
 const cal=JSON.parse(fs.readFileSync(path.join(r,file)));cal.id??=file.slice(0,-'-calibrage.json'.length);
 const metaFile=path.join(r,cal.id+'.json');
 if(!fs.existsSync(metaFile))continue;
 const m=JSON.parse(fs.readFileSync(metaFile));if(m.appliquee!==true)continue;
 const im=readPng(path.join(r,cal.id+'-calibree.png'));
 const left=m.context+(m.replaceLeft||0),right=left+(m.replaceWidth||m.w),top=m.replaceTop||0,bottom=top+(m.replaceHeight||m.h);
 for(const c of cal.cellules.filter(c=>['porte','panneau'].includes(c.role))){
  const v=c.cible;if(v.x<left||v.x+v.w>right||v.y<top||v.y+v.h>bottom)continue;
  const x=m.x+v.x-m.context,y=m.y+v.y,centre=x+v.w/2,slot=slots.find(s=>s.centre===centre);
  if(!slot)throw new Error('Centre hors gabarit : '+cal.id+' '+centre);
  const expected=c.role==='porte'?{w:96,h:184,y:820}:{w:258,h:44,y:764};
  if(v.w!==expected.w||v.h!==expected.h||y!==expected.y)throw new Error('Dimensions hors gabarit : '+cal.id);
  for(let j=0;j<v.h;j++){
   const masterRow=a.data.subarray(((y+j)*a.width+x)*4,((y+j)*a.width+x+v.w)*4);
   const sourceRow=im.data.subarray(((v.y+j)*im.width+v.x)*4,((v.y+j)*im.width+v.x+v.w)*4);
   if(!masterRow.equals(sourceRow))throw new Error('Rectangle modifié après calage : '+cal.id+' '+c.role);
  }
  checks.push({id:cal.id,role:c.role,tuile:slot.tuile,xDansFresque:x,y,w:v.w,h:v.h,centreX:centre,pixelsIdentiquesALaSourceCalee:true});
 }
}
const missing=slots.flatMap(s=>['porte','panneau'].filter(role=>!checks.some(c=>c.centreX===s.centre&&c.role===role)).map(role=>({...s,role})));
const report={date:new Date().toISOString(),calageStrictObligatoire:false,directives:'DIRECTIVES-UTILISATEUR.md',rectangles:checks,rectanglesAttendus:slots.length*2,rectanglesNonCales:missing,limite:'Mesure les cellules ayant conservé le calage exact. Les gabarits sont désormais des repères ; une ouverture adaptée à l’architecture n’a pas à reproduire ce rectangle. Le style, le sol et les raccords exigent une inspection distincte.'};
fs.writeFileSync(path.join(base,'production/controle-geometrie/rapport-calage-carte.json'),JSON.stringify(report,null,2));
console.log(checks.length+' rectangles conservant le calage exact ; '+missing.length+' hors calage strict, avec gabarits indicatifs.');
