// Production de la carte plate : rectangles opaques, sans fondu.
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {readPng,writePng} from '../../../../scripts/lib/png.mjs';
import {plateTiles} from '../../../../scripts/fresque-plate-gabarits.mjs';
import {seamScore,transparentPixels} from '../../../../scripts/fresque-plate-raccords.mjs';
const root=process.cwd(), base=path.join(root,'docs/production/decor-v3/carte-plate');
const out=path.join(base,'production'), masterFile=path.join(out,'fresque-en-cours.png');
const sharp=createRequire(import.meta.url)('C:/Users/ferat/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp/dist/index.cjs');
const tiles=plateTiles(JSON.parse(fs.readFileSync('Présidentielles 2027/world_layout.json','utf8')));
const cahier=fs.readFileSync(path.join(base,'CAHIER-CODEX.md'),'utf8');
const sections=cahier.split(/^### /m).slice(1);
const crop=(a,x,w)=>{
  if(x<0||x+w>a.width) throw new Error('Découpe hors image.');
  const data=Buffer.alloc(w*a.height*4);
  for(let y=0;y<a.height;y++) a.data.copy(data,y*w*4,(y*a.width+x)*4,(y*a.width+x+w)*4);
  return {width:w,height:a.height,data};
};
const hash=a=>createHash('sha256').update(a.data).digest('hex');
const writeJson=(file,obj)=>fs.writeFileSync(file,JSON.stringify(obj,null,2));
const [mode,arg,arg2,arg3]=process.argv.slice(2);
fs.mkdirSync(out,{recursive:true});
if(mode==='init'){
  if(fs.existsSync(masterFile)) throw new Error('Fresque déjà commencée.');
  fs.copyFileSync(path.join(base,'pilote/essai/assemblage-retouche.png'),masterFile);
  writeJson(path.join(out,'generations.json'),{reference_initiale:'../pilote/essai/assemblage-retouche.png',extensions:[]});
  console.log('Fresque reprise : 3 584 × 1 080 px.');
}else if(mode==='preparer'){
  const a=readPng(masterFile), count=Math.ceil(a.width/1920)+1;
  if(count>18) throw new Error('Les 18 tuiles sont peintes.');
  const tile=tiles[count-1], target=count*1920, start=a.width-256, width=target-start;
  const data=Buffer.alloc(width*1080*4), tail=crop(a,a.width-256,256);
  for(let y=0;y<1080;y++)tail.data.copy(data,y*width*4,y*256*4,(y+1)*256*4);
  for(let x=a.width;x<target;){
    const index=Math.floor(x/1920), g=readPng(path.join(base,'gabarits',tiles[index].file));
    const local=x%1920, n=Math.min(1920-local,target-x);
    for(let y=0;y<1080;y++)g.data.copy(data,(y*width+x-start)*4,(y*1920+local)*4,(y*1920+local+n)*4);
    x+=n;
  }
  const stem=`extension-${tile.number}`, canvas=path.join(out,`${stem}-guide.png`),offset=tile.masterLeft-start;
  // Croquis de travail sans annotations : positions inchangées du gabarit officiel.
  if(count>=8){
    const fill=(x0,y0,w,h,c)=>{for(let y=y0;y<y0+h;y++)for(let x=Math.max(256,x0);x<Math.min(width,x0+w);x++){const i=(y*width+x)*4;data[i]=c[0];data[i+1]=c[1];data[i+2]=c[2];data[i+3]=255;}};
    for(let y=0;y<1080;y++){
      const t=Math.max(0,Math.min(1,(y-64)/640));
      const c=y<1004?[Math.round(159+69*t),Math.round(207+34*t),Math.round(238+8*t)]:[189,185,173];
      fill(256,y,width-256,1,c);
    }
    fill(256,900,width-256,104,[224,217,197]);
    if(tile.meeting)fill(offset+672,748,576,256,[235,224,203]);
    for(const b of tile.buildings){
      const x=offset+b.x;
      fill(x-184,520,368,484,tile.id.startsWith('periurbain')?[175,112,73]:[222,201,164]);
      fill(x-129,764,258,44,[243,228,197]);
      fill(x-48,820,96,184,[35,60,67]);
      fill(x+24,900,5,30,[192,147,68]);
      fill(x-146,566,76,114,[103,126,137]);fill(x+70,566,76,114,[103,126,137]);
    }
  }
  writePng(canvas,{width,height:1080,data});
  const section=sections.find(s=>s.startsWith(tile.name+' —'));
  if(!section) throw new Error('Storyboard introuvable.');
  const points=section.split('**Premier plan')[0];
  const photos=[...section.matchAll(/\[(photos\/[^\]]+\.jpg)\]/g)].map(m=>m[1]).filter(p=>!p.includes('deja-dans-le-jeu'));
  const refs=[photos.find(p=>p.includes('premier-plan')),photos.find(p=>p.includes('arriere-plan'))||photos.find(p=>p.includes('premier-plan')&&p!==photos[0])].filter(Boolean);
  const geometry=tile.buildings.map(b=>`${b.label}: entrée centrée x=${offset+b.x}, rectangle porte x=${offset+b.x-48}..${offset+b.x+48}, y=820..1004; panneau crème vierge x=${offset+b.x-129}..${offset+b.x+129}, y=764..808.`).join('\n');
  const next=tiles[count];
  const transitions={3:'Fin de Paris C : la porte de Paris, périphérique au loin et canal de l’Ourcq avec Grands Moulins de Pantin annoncent progressivement la banlieue.',6:'Fin de Banlieue C : sortie de ville, terrain vague, camp de caravanes derrière portail, terrain de football municipal au fond et autoroute lointaine annoncent le périurbain.',9:'Mont-Blanc très élevé et réaliste, glaciers et aiguilles ; le massif commence à redescendre progressivement à droite vers le bocage de Campagne A.',12:'Les champs annoncent à droite un lotissement lointain, puis pins et thuyas, sans panneau de ville.',15:'Les jardins de villas annoncent à droite le bois de Boulogne : parc proche, allées et lac, pas de La Défense.',18:'La Défense reste lointaine à gauche ; à droite, concept stores et cafés annoncent Paris A, rues montant vers Montmartre. Préparer le raccord de boucle au quartier de Paris A.'};
  const prompt=`Peindre l’extension à droite de l’image 1, une nouvelle partie de la fresque continue du jeu. C’est un OUTPAINTING du bord déjà peint, pas une nouvelle composition indépendante. L’image 2, panorama world-v2, est la référence obligatoire de style. Les images suivantes sont des références photographiques d’architecture uniquement, sans copier leurs textes, marques ou véhicules.
Format demandé : ${width} × 1080 px, PNG entièrement opaque.
L’image 1 contient à gauche exactement 256 px déjà peints : reproduire leur cadrage et continuer leurs lignes et leur perspective au-delà de x=256. Le script conservera ces 256 px originaux. À droite se trouve le gabarit à remplacer par la peinture : AUCUNE annotation, silhouette, ligne, hachure, zone colorée ou estrade du gabarit ne doit apparaître.
La portion nouvelle appartient à ${tile.name}. Son bord gauche dans ce canevas est x=${offset}. ${offset>256?'Les pixels x=256..'+offset+' terminent Paris B : achever la dernière devanture, puis un passage vers le canal ; ne pas ajouter de commerce de bouche supplémentaire.':''}
CONTENU DU STORYBOARD :
${points}
POSITIONS ABSOLUES DANS LE CANEVAS :
${geometry}
${tile.meeting?`PLACE DE MEETING : le rectangle x=${offset+672}..${offset+1248} doit être une place ouverte, dégagée et de plain-pied au premier plan. AUCUN bâtiment, étal, fontaine, arbre, kiosque, sculpture, estrade ou mobilier dans cette zone. Fond lointain en perspective permis. Reporter les monuments et étals en dehors de ce rectangle.`:''}
Tous les pieds des portes et façades proches sont à y=1004, sur une rue horizontale continue. Il ne reste que76px de trottoir/chaussée en dessous. Portes184px de haut, étage168px, rez-de-chaussée256px, personnage invisible162px. Ne pas dessiner de personnage. Les arbres et objets du décor ne doivent pas masquer les façades interactives. Les bâtiments lointains rapetissent en perspective.
Style exactement world-v2 : peinture cartoon détaillée, contours fins foncés, couleurs chaudes, matériaux de France, verdure d’été, profondeur atmosphérique bleutée et perspectives cohérentes. Lumière de milieu de matinée venant de gauche, ombres à droite. Ciel uni#9FCFEE dans les64premières lignes, puis dégradé régulier vers#E4F1F6 à l’horizon. Aucun plan de parallaxe séparé.
${transitions[count]||''} ${next?'Le bord droit continue naturellement vers '+next.name+' : pas de changement abrupt sur la coupe, éviter portes et panneaux traversant la coupe.':''}
INTERDITS : aucun texte, lettre, chiffre, marque ou logo ; aucun véhicule ni vélo garé ; aucune personne. Aucun commerce de bouche hors Paris B (l’unique boulangerie, fromagerie et boucherie ont déjà été peintes). Aucun autre supermarché hors la zone commerciale lointaine de Périurbain A. Haussmannien seulement à Paris et aux Quartiers riches, jamais au bord de mer. Ne pas copier les erreurs des anciennes références.
AUCUN FONDU : aucune transparence, double contour, flou de raccord, mélange de deux images ou superposition. Une seule scène peinte et nette, qui prolonge fidèlement la bande de gauche.`;
  const biome=tile.id.split('_')[0],style=count>=8?`style-detail-${biome}.png`:biome==='paris'?'reference-style-carte-plate.png':`reference-style-plate-${biome}.png`;
  const metadata={number:tile.number,name:tile.name,previousWidth:a.width,targetWidth:target,canvasWidth:width,canvas,offset,prompt,refs:[canvas,path.join(root,'assets/generated/world-v2',style),...refs.map(p=>path.join(base,p))]};
  fs.writeFileSync(path.join(out,`${stem}-prompt.txt`),prompt);writeJson(path.join(out,'prochaine-extension.json'),metadata);
  console.log(JSON.stringify(metadata));
}else if(mode==='ajouter'){
  const meta=JSON.parse(fs.readFileSync(path.join(out,'prochaine-extension.json'),'utf8'));
  const a=readPng(masterFile);
  if(a.width!==meta.previousWidth)throw new Error('Fresque modifiée depuis la préparation.');
  const raw=path.join(out,`extension-${meta.number}-brute.png`), normalized=path.join(out,`extension-${meta.number}.png`);
  fs.copyFileSync(arg,raw);
  await sharp(raw).resize(meta.canvasWidth,1080,{fit:'cover',position:'centre'}).ensureAlpha().png().toFile(normalized);
  let b=readPng(normalized);
  const verticalShift=arg2?1004-Number(arg2):0;
  if(verticalShift){
    const data=Buffer.alloc(b.data.length);
    for(let y=0;y<1080;y++){
      const sourceY=y-verticalShift;
      if(sourceY>=0&&sourceY<1080)b.data.copy(data,y*b.width*4,sourceY*b.width*4,(sourceY+1)*b.width*4);
      else for(let x=0;x<b.width;x++){const i=(y*b.width+x)*4;data[i]=159;data[i+1]=207;data[i+2]=238;data[i+3]=255;}
    }
    b={...b,data};writePng(normalized,b);
  }
  const addition=crop(b,256,b.width-256), width=a.width+addition.width;
  if(transparentPixels(b))throw new Error('Image transparente refusée.');
  const data=Buffer.alloc(width*1080*4);
  for(let y=0;y<1080;y++){
    a.data.copy(data,y*width*4,y*a.width*4,(y+1)*a.width*4);
    addition.data.copy(data,(y*width+a.width)*4,y*addition.width*4,(y+1)*addition.width*4);
  }
  const result={width,height:1080,data};
  if(!crop(result,0,a.width).data.equals(a.data))throw new Error('Pixels originaux altérés.');
  const manifestFile=path.join(out,'generations.json'), manifest=JSON.parse(fs.readFileSync(manifestFile,'utf8'));
  const report={number:meta.number,name:meta.name,width,pixelsPrecedentsIdentiques:true,sha256Precedent:hash(a),raccord:seamScore(a,addition),source:raw,translationVerticale:verticalShift};
  const temporary=path.join(out,`fresque-apres-${meta.number}.png`);
  writePng(temporary,result);
  let renamed=false;
  for(let attempt=0;attempt<8;attempt++){
    try{fs.renameSync(temporary,masterFile);renamed=true;break;}
    catch(error){if(attempt===7)throw error;await new Promise(resolve=>setTimeout(resolve,300));}
  }
  if(!renamed)throw new Error('Impossible de remplacer la fresque.');
  writePng(path.join(out,`raccord-${meta.number}.png`),crop(result,a.width-400,800));
  manifest.extensions.push(report);writeJson(manifestFile,manifest);
  if(width===5760){fs.copyFileSync(masterFile,path.join(base,'pilote/fresque-plate-maitre.png'));}
  console.log(JSON.stringify(report));
}else if(mode==='vue'){
  const a=readPng(masterFile);await sharp(masterFile).resize({width:Math.round(a.width/4)}).png().toFile(path.join(out,'vue-ensemble.png'));
  console.log(`${a.width} × ${a.height} px peints.`);
}else throw new Error('Mode : init, preparer, ajouter, vue.');
