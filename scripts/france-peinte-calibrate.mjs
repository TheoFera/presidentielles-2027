// Mesure les nouveaux quartiers peints sans retoucher les images ni déplacer les sites du jeu.
// Ce rapport de géométrie n'est pas une validation artistique des raccords.
import { writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { readPng } from './lib/png.mjs';
import { measureBaseline, findCreamSigns } from './world-v3-calibrate-lib.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const street = {
  'rue-paris-a-gauche': { zone: 'paris_a', half: 0 },
  'rue-paris-a-droite': { zone: 'paris_a', half: 1, site: 'site:paris_a', expectedX: .34 },
  'rue-paris-b-gauche': { zone: 'paris_b', half: 0, site: 'site:paris_b', expectedX: .46 },
  'rue-paris-b-droite': { zone: 'paris_b', half: 1 },
  'rue-paris-c-gauche': { zone: 'paris_c', half: 0, site: 'site:paris_c', expectedX: .48 },
  'rue-paris-c-droite': { zone: 'paris_c', half: 1, site: 'site:paris_c:institut_sondage', expectedX: .48 },
  'rue-banlieue-a-gauche': { zone:'banlieue_a', half:0, site:'site:banlieue_a', expectedX:.75144 },
  // L'image d'été contient 32 px de chaussée sous le trottoir ; la base est sa bordure.
  'rue-banlieue-a-droite': { zone:'banlieue_a', half:1, baseline:1806 },
  'rue-banlieue-b-gauche': { zone:'banlieue_b', half:0, site:'site:banlieue_b', expectedX:.44 },
  'rue-banlieue-b-droite': { zone:'banlieue_b', half:1 },
  'rue-banlieue-c-gauche': { zone:'banlieue_c', half:0, site:'site:banlieue_c', expectedX:.87272 },
  'rue-banlieue-c-droite': { zone:'banlieue_c', half:1 },
  'rue-periurbain-a-gauche': { zone:'periurbain_a', half:0 },
  'rue-periurbain-a-droite': { zone:'periurbain_a', half:1, site:'site:periurbain_a', expectedX:.14672 },
  'rue-periurbain-b-gauche': { zone:'periurbain_b', half:0, site:'site:periurbain_b', expectedX:.4 },
  'rue-periurbain-b-droite': { zone:'periurbain_b', half:1 },
  'rue-periurbain-c-gauche': { zone:'periurbain_c', half:0, site:'site:periurbain_c', expectedX:.75 },
  'rue-periurbain-c-droite': { zone:'periurbain_c', half:1 },
};
const result = { street: {}, layers: {} };
function paintedSigns(image) {
  // La lumière dorée rend certains panneaux plus jaunes que la maquette.
  // Normaliser seulement une copie destinée à la détection ; l'image livrée reste intacte.
  const probe = { ...image, data: new Uint8Array(image.data) };
  for (let i=0; i<probe.data.length; i+=4) {
    const [r,g,b,a] = probe.data.subarray(i,i+4);
    if (a>200 && r>235 && g>208 && g<245 && b>135 && b<225)
      probe.data[i+2] = Math.max(b,r-70);
  }
  return findCreamSigns(probe);
}
for (const [name, spec] of Object.entries(street)) {
  const fileName={'rue-paris-c-droite':'rue-paris-c-droite-moderne','rue-banlieue-b-gauche':'rue-banlieue-b-gauche-place-degagee','rue-banlieue-b-droite':'rue-banlieue-b-droite-place-degagee','rue-banlieue-c-droite':'rue-banlieue-c-droite-jardin-v2','rue-periurbain-a-gauche':'rue-periurbain-a-gauche-v2'}[name] || name;
  const image = readPng(`${root}assets/generated/france-peinte-complete/${fileName}.png`);
  const baseline = spec.baseline || measureBaseline(image, .5);
  if (!baseline) throw new Error(`${name} : ligne de base introuvable.`);
  const entry = { ...spec, width: image.width, height: image.height, baseline };
  if (spec.site) {
    const candidates = paintedSigns(image).filter(([x,y,w,h]) => y > image.height * .5 && w/h > 3 && h < image.height * .08);
    const sign = candidates.sort((a,b) =>
      Math.abs((a[0]+a[2]/2)/image.width-spec.expectedX) - Math.abs((b[0]+b[2]/2)/image.width-spec.expectedX))[0];
    if (!sign) throw new Error(`${name} : panneau crème introuvable.`);
    entry.sign = sign;
    console.log(`${name} : panneau ${sign.join(', ')}, base ${baseline}.`);
  }
  result.street[name] = entry;
  const winterFile = `${root}assets/generated/france-peinte-complete/${fileName}-hiver.png`;
  if (existsSync(winterFile)) {
    const winter = readPng(winterFile);
    entry.winter = { ...spec, width:winter.width, height:winter.height, baseline:measureBaseline(winter,.5) };
    if (spec.site) {
      const signs=paintedSigns(winter).filter(([x,y,w,h])=>y>winter.height*.5 && w/h>3 && h<winter.height*.08);
      entry.winter.sign=signs.sort((a,b)=>Math.abs((a[0]+a[2]/2)/winter.width-spec.expectedX)-Math.abs((b[0]+b[2]/2)/winter.width-spec.expectedX))[0];
      if(!entry.winter.sign) throw new Error(`${name} : panneau d'hiver introuvable.`);
    }
  }
}
for (const name of ['paris-horizon','paris-far','paris-mid','paris-back','paris-canal','paris-marche','paris-mobilier','saint-denis','paris-transition-est','paris-transition-ouest',
  'banlieue-horizon','banlieue-far','banlieue-mid-a','banlieue-mid-b','banlieue-mid-c','banlieue-back-a','banlieue-back-b','banlieue-back-c','banlieue-marche','banlieue-transition-est',
  'periurbain-horizon-a','periurbain-massif','periurbain-far','periurbain-mid-a','periurbain-mid-b','periurbain-mid-c','periurbain-back-a','periurbain-back-b','periurbain-back-c','periurbain-transition-est']) {
  const fileName = { 'paris-far':'paris-far-v2', 'paris-mid':'paris-mid-v2', 'saint-denis':'saint-denis-v2', 'paris-transition-ouest':'paris-transition-ouest-v2', 'banlieue-horizon':'banlieue-horizon-v2','banlieue-far':'banlieue-far-v2','periurbain-massif':'periurbain-massif-raccord-v2' }[name] || name;
  const file = `${root}assets/generated/france-peinte-complete/${fileName}.png`;
  if (!existsSync(file)) continue;
  const image = readPng(file);
  result.layers[name] = { width: image.width, height: image.height, baseline: measureBaseline(image,.3) };
  if (name === 'periurbain-massif') {
    // Mesurer le sommet peint, sans compter la marge transparente au-dessus.
    const top = Array.from({length:image.height},(_,y)=>y).find(y=> {
      let solid=0;
      for(let x=0;x<image.width;x++) if(image.data[(y*image.width+x)*4+3]>128) solid++;
      return solid>=4;
    });
    result.layers[name].top = top;
  }
}
writeFileSync(`${root}src/presentation/france-peinte-calibration.js`,
  `// Mesures générées par scripts/france-peinte-calibrate.mjs. Ne prouvent pas la qualité visuelle.\nexport const COMPLETE_CALIBRATION = ${JSON.stringify(result,null,2)};\n`);
