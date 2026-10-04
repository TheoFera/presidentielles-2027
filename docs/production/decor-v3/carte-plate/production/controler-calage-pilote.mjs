import fs from 'node:fs';
import path from 'node:path';
import {readPng} from '../../../../../scripts/lib/png.mjs';
const base=path.resolve('docs/production/decor-v3/carte-plate'),r=path.join(base,'production/retouches'),a=readPng(path.join(base,'production/fresque-en-cours.png'));
const ids=['paris-a-rdc-calage','paris-b-atelier-calage','paris-c-qg-calage','paris-c-institut-calage','banlieue-a-composition-equilibree'];
const checks=[];
for(const id of ids){
 const meta=JSON.parse(fs.readFileSync(path.join(r,id+'.json'))),cal=JSON.parse(fs.readFileSync(path.join(r,id+'-calibrage.json'))),im=readPng(path.join(r,id+'-calibree.png'));
 for(const c of cal.cellules.filter(c=>['porte','panneau'].includes(c.role))){
  const v=c.cible,x=meta.x+v.x-meta.context,y=meta.y+v.y;
  const expected=c.role==='porte'?{w:96,h:184,y:820}:{w:258,h:44,y:764};
  if(v.w!==expected.w||v.h!==expected.h||y!==expected.y)throw new Error('Rectangle hors gabarit : '+id);
  for(let j=0;j<v.h;j++){
   const masterRow=a.data.subarray(((y+j)*a.width+x)*4,((y+j)*a.width+x+v.w)*4);
   const sourceRow=im.data.subarray(((v.y+j)*im.width+v.x)*4,((v.y+j)*im.width+v.x+v.w)*4);
   if(!masterRow.equals(sourceRow))throw new Error('Rectangle calé modifié après intégration : '+id+' '+c.role);
  }
  checks.push({id,role:c.role,xDansFresque:x,y,w:v.w,h:v.h,pixelsIdentiquesALaSourceCalee:true});
 }
}
const report={date:new Date().toISOString(),rectangles:checks,limite:'Vérifie les rectangles des quatre portes du pilote, de la porte de Banlieue A et des trois panneaux recalés. Ne certifie pas toutes les façades, les panneaux de Paris C, ni la carte entière.'};
fs.writeFileSync(path.join(base,'production/controle-geometrie/rapport-calage.json'),JSON.stringify(report,null,2));
console.log(checks.length+' rectangles calés conservés pixel pour pixel dans la fresque : cinq portes, trois panneaux.');
