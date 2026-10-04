// Essai : découpe et ajout bord à bord, sans mélange de deux images.
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { readPng, writePng } from '../../../../../../scripts/lib/png.mjs';
import { seamScore } from '../../../../../../scripts/fresque-plate-raccords.mjs';
const [mode, input, output, extra, argWidth, argHeight] = process.argv.slice(2);
const crop = (a, x, w) => {
  const data = Buffer.alloc(w * a.height * 4);
  for (let y = 0; y < a.height; y++) a.data.copy(data, y*w*4, (y*a.width+x)*4, (y*a.width+x+w)*4);
  return { width:w, height:a.height, data };
};
if (mode === 'normaliser') {
  const sharp = createRequire(import.meta.url)(extra);
  // Mise à l'échelle uniforme, puis recadrage ; aucune déformation.
  await sharp(input).resize(Number(argWidth||1920),Number(argHeight||1080),{fit:'cover',position:'centre'}).ensureAlpha().png().toFile(output);
} else if (mode === 'preparer') {
  const a=readPng(input), guide=readPng(extra), tail=crop(a,a.width-256,256);
  const data=Buffer.alloc(1920*1080*4);
  for(let y=0;y<1080;y++) {
    tail.data.copy(data,y*1920*4,y*256*4,(y+1)*256*4);
    guide.data.copy(data,(y*1920+256)*4,y*guide.width*4,(y*guide.width+1664)*4);
  }
  writePng(output,{width:1920,height:1080,data});
} else if (mode === 'assembler') {
  const a=readPng(input), b=readPng(extra);
  if(a.height!==1080||b.width!==1920||b.height!==1080) throw new Error('Dimensions incorrectes.');
  const addition=crop(b,256,1664), width=a.width+addition.width, data=Buffer.alloc(width*1080*4);
  for(let y=0;y<1080;y++) {
    a.data.copy(data,y*width*4,y*a.width*4,(y+1)*a.width*4);
    addition.data.copy(data,(y*width+a.width)*4,y*1664*4,(y+1)*1664*4);
  }
  const result={width,height:1080,data}, preserved=crop(result,0,a.width);
  if(!preserved.data.equals(a.data)) throw new Error('Pixels originaux modifiés.');
  writePng(output,result);
  const report={pixels_originaux_identiques:true,sha256_origine:createHash('sha256').update(a.data).digest('hex'),raccord:seamScore(a,addition),largeur:width,hauteur:1080};
  writeFileSync(output.replace(/\.png$/,'-rapport.json'),JSON.stringify(report,null,2));
  writePng(output.replace(/\.png$/,'-raccord.png'),crop(result,a.width-400,800));
  console.log(JSON.stringify(report,null,2));
} else if(mode==='retoucher') {
  const a=readPng(input), b=readPng(extra), x=1856, w=128;
  if(b.width!==800||b.height!==1080) throw new Error('La retouche doit mesurer 800 × 1 080.');
  const data=Buffer.from(a.data), stripe=crop(b,336,w);
  for(let y=0;y<1080;y++) stripe.data.copy(data,(y*a.width+x)*4,y*w*4,(y+1)*w*4);
  const result={width:a.width,height:a.height,data};
  const unchanged=crop(a,0,x).data.equals(crop(result,0,x).data)&&crop(a,x+w,a.width-x-w).data.equals(crop(result,x+w,a.width-x-w).data);
  if(!unchanged) throw new Error('Modification hors de la bande autorisée.');
  writePng(output,result);
  writePng(output.replace(/\.png$/,'-raccord.png'),crop(result,1520,800));
  const report={pixels_hors_bande_identiques:unchanged,bande:{x,largeur:w},raccord:seamScore(crop(result,0,1920),crop(result,1920,result.width-1920))};
  writeFileSync(output.replace(/\.png$/,'-rapport.json'),JSON.stringify(report,null,2));
  console.log(JSON.stringify(report,null,2));
} else throw new Error('Mode : normaliser, preparer, assembler ou retoucher.');
