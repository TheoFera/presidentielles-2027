import fs from 'node:fs';
import {spawnSync} from 'node:child_process';
import {plateTiles} from '../../../../../scripts/fresque-plate-gabarits.mjs';
const [id,number,entry='1',top='600',width='600']=process.argv.slice(2),tiles=plateTiles(JSON.parse(fs.readFileSync('Présidentielles 2027/world_layout.json','utf8'))),t=tiles[Number(number)-1],b=t?.buildings[Number(entry)-1];
if(!b)throw new Error('Entrée absente du gabarit.');
const existing='docs/production/decor-v3/carte-plate/production/retouches/'+id+'.json';
if(fs.existsSync(existing)&&JSON.parse(fs.readFileSync(existing)).appliquee===true)throw new Error('Retouche déjà appliquée : conserver son avant.');
const result=spawnSync(process.execPath,['docs/production/decor-v3/carte-plate/finition.mjs','preparer',id,String(t.masterLeft+b.x-Number(width)/2),top,width,String(1080-Number(top)),'256'],{encoding:'utf8'});
process.stdout.write(result.stdout||'');process.stderr.write(result.stderr||'');if(result.status!==0)process.exit(result.status||1);
