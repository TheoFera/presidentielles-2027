// Ajoute uniquement des colonnes de contexte opaque : la peinture existante garde ses coordonnées.
import fs from 'node:fs';
import {createRequire} from 'node:module';
import {readPng,writePng} from '../../../../../scripts/lib/png.mjs';
const sharp=createRequire(import.meta.url)('C:/Users/ferat/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp/dist/index.cjs');
const [id,source,widthText]=process.argv.slice(2),width=Number(widthText),base='docs/production/decor-v3/carte-plate/production/retouches/';
const m=JSON.parse(fs.readFileSync(base+id+'.json')),guide=readPng(m.guide),raw=base+id+'-generation.png',norm=base+id+'-auteur-normalisee.png';
fs.copyFileSync(source,raw);await sharp(raw).resize(width,m.canvasHeight,{fit:'cover',position:'centre'}).ensureAlpha().png().toFile(norm);
const a=readPng(norm);if(width>guide.width||a.height!==guide.height)throw new Error('Dimensions de contexte incompatibles.');
for(let y=0;y<a.height;y++)a.data.copy(guide.data,y*guide.width*4,y*a.width*4,(y+1)*a.width*4);
for(let p=3;p<guide.data.length;p+=4)if(guide.data[p]!==255)throw new Error('Transparence interdite.');
writePng(base+id+'-contexte-adapte.png',guide);
fs.writeFileSync(base+id+'-contexte-adapte.json',JSON.stringify({sourceOriginale:source,largeurPeinture:width,largeurAvecContexte:guide.width,peintureConserveeSansRedimensionnementSupplementaire:true,colonnesSupplementairesDeContexte:guide.width-width},null,2));
console.log('Contexte élargi sans déplacer ou étirer la peinture.');
