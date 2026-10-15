// Mesures seules : les dessins et leurs pixels restent intacts.
import { writeFileSync } from 'node:fs';
import { readPng } from '../lib/png.mjs';
import { measureMinorSprites } from './measure-minor-sprites.mjs';

const files = {
  attal: 'assets/images/candidats/attal/attal-garde-v7.png',
  dupont_aignan: 'assets/images/candidats/dupont-aignan/dupont_aignan-garde-v7.png',
  glucksmann: 'assets/images/candidats/glucksmann/glucksmann-garde-v6.png',
};

const data = {};
for (const [faction, file] of Object.entries(files)) {
  const image = readPng(file), atlas = measureMinorSprites(image, { count: 12, columns: 4, koFrames: [] });
  // Prendre les deux chaussures dans une bande basse, pas seulement la semelle la plus basse.
  // Toutes les figures conservent le même coefficient : les genoux pliés ne font pas grossir la tête.
  for(const frame of atlas.frames){
    const [sx,sy,width,height]=frame;let left=image.width,right=0;
    for(let y=sy+height-Math.ceil(atlas.referenceHeight*.05);y<sy+height;y++)for(let x=sx;x<sx+width;x++)if(image.data[(y*image.width+x)*4+3]>=90){left=Math.min(left,x);right=Math.max(right,x);}
    frame[4]=(left+right)/2;
  }
  data[faction] = atlas;
  console.log(faction, atlas.frames.map((frame,i)=>({frame:i,height:+(frame[3]/atlas.referenceHeight*146.729).toFixed(2)})));
}
if (!process.argv.includes('--measure-only')) writeFileSync('src/presentation/personnages/minor-locomotion-data.js', '// Mesures natives : silhouettes, ancrages et correction uniforme de l’échelle des dessins.\nexport const MINOR_LOCOMOTION_DATA = ' + JSON.stringify(data, null, 2) + ';\n');
