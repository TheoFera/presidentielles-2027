import path from 'node:path';
import {createRequire} from 'node:module';
const p=path.resolve('docs/production/decor-v3/carte-plate/production');
const sharp=createRequire(import.meta.url)('C:/Users/ferat/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp/dist/index.cjs');
const rows=[['periurbain','Périurbain B','recul-periurbain-guide-detail.png'],['retraites','Retraités B'],['riches-transition','Riches A → B'],['kiosque','Riches B — kiosque']];
const panels=[];
for(const [row,[id,label,before]] of rows.entries())for(let side=0;side<2;side++){
 const file=side?'recul-'+id+'-apres.png':before||'recul-'+id+'-avant.png';
 const input=await sharp(path.join(p,file)).resize(640,400,{fit:'contain',background:'#f4eddf'}).removeAlpha().png().toBuffer();
 const title=Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="640" height="32"><rect width="640" height="32" fill="#173444"/><text x="12" y="23" font-family="Arial" font-size="19" fill="white">${label} — ${side?'après':'avant'}</text></svg>`);
 panels.push({input:title,left:side*640,top:row*432},{input,left:side*640,top:row*432+32});
}
await sharp({create:{width:1280,height:1728,channels:3,background:'#f4eddf'}}).composite(panels).removeAlpha().png().toFile(path.join(p,'recul-obstacles-comparaison.png'));
