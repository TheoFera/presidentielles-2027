// Restauration de pixels peints déjà présents dans les sauvegardes natives.
// Les régions sont disjointes : aucune couche, aucun alpha, aucun mélange.
import fs from 'node:fs';
import path from 'node:path';
import {readPng,writePng} from '../../../../../scripts/lib/png.mjs';
const base=path.resolve('docs/production/decor-v3/carte-plate'),dir=path.join(base,'production/retouches');
const id=process.argv[2],m=JSON.parse(fs.readFileSync(path.join(dir,id+'.json')));
const file=path.join(base,'production/fresque-en-cours.png'),a=readPng(file),old=Buffer.from(a.data),b=readPng(path.join(dir,id+'-avant.png'));
const protect=[];
for(const f of fs.readdirSync(dir).filter(f=>f.endsWith('.json')&&!f.includes('calibrage')&&!f.includes('profil'))){
 const p=JSON.parse(fs.readFileSync(path.join(dir,f)));
 if(p.appliquee!==true)continue;
 if(!fs.existsSync(path.join(dir,p.id+'-calibrage.json'))&&!['periurbain-b-scooter-interieur','campagne-a-scooter-interieur','periurbain-a-zone-commerciale','campagne-b-ecole-cour','riches-b-trace-vitrine'].includes(p.id))continue;
 protect.push({id:p.id,x:p.x+(p.replaceLeft||0),y:p.y+(p.replaceTop||0),w:p.replaceWidth||p.w,h:p.replaceHeight||p.h});
}
const x0=m.x-m.context,oldCrop=Buffer.alloc(b.width*b.height*4);let count=0,kept=0;
for(let y=0;y<b.height;y++)for(let x=0;x<b.width;x++){
 const xx=(x0+x+a.width)%a.width,yy=m.y+y;
 old.copy(oldCrop,(y*b.width+x)*4,(yy*a.width+xx)*4,(yy*a.width+xx+1)*4);
 if(protect.some(p=>xx>=p.x&&xx<p.x+p.w&&yy>=p.y&&yy<p.y+p.h)){kept++;continue;}
 const dst=(yy*a.width+xx)*4,src=(y*b.width+x)*4;
 if(b.data[src+3]!==255)throw new Error('Source non opaque.');
 if(!old.subarray(dst,dst+4).equals(b.data.subarray(src,src+4)))count++;
 b.data.copy(a.data,dst,src,src+4);
}
writePng(path.join(dir,id+'-avant-restauration-contexte.png'),{width:b.width,height:b.height,data:oldCrop});
const temp=path.join(dir,id+'-restauration-contexte-maitre.png');writePng(temp,a);fs.renameSync(temp,file);
fs.writeFileSync(path.join(dir,id+'-restauration-contexte.json'),JSON.stringify({id,x:x0,y:m.y,w:b.width,h:b.height,source:id+'-avant.png',methode:'Restauration native du dessin antérieur et de son contexte ; ouvertures et dernières retouches protégées.',pixelsRestaures:count,pixelsProteges:kept,protections:protect,fondu:false,superposition:false,date:new Date().toISOString()},null,2));
console.log(id+': '+count+' pixels restaurés, '+kept+' pixels protégés.');
