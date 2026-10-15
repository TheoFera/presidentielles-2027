// Lecture et mesure uniquement : les PNG originaux ne sont jamais réécrits.
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { readPng } from '../lib/png.mjs';
import { visualManifest } from '../../src/presentation/rendu/visual-manifest.js';
import { MINOR_SPRITES } from '../../src/presentation/personnages/minor-sprites.js';
import { MINOR_ATLASES } from '../../src/presentation/personnages/minor-sprite-atlases.js';
import { minorCombatAtlases, minorExtraAtlases, minorStandingAtlases } from '../../src/presentation/personnages/minor-animation-sprites.js';
import { combatAtlases } from '../../src/presentation/personnages/melenchon-combat.js';
import { candidateExtraAtlases } from '../../src/presentation/personnages/candidate-extra-poses.js';
import { skinAnimationAtlases } from '../../src/presentation/personnages/skin-animation-atlases.js';
import { ultimateAtlases } from '../../src/presentation/effets/ultimate-sprite-data.js';
import { ultimateGuardAtlases } from '../../src/presentation/effets/ultimate-guard-sprites.js';
import { minorUltimateAtlases } from '../../src/presentation/effets/minor-ultimate-art.js';
import { characterFrameScale } from '../../src/presentation/personnages/character-scale.js';
import { ultimateCharacterScale } from '../../src/presentation/effets/ultimate-character-scale.js';
import { CAMPAIGN_STYLES } from '../../src/simulation/campaign-styles.js';
import { styleSpriteId } from '../../src/presentation/personnages/campaign-style-art.js';

const images = new Map(), inventory = [];
const getImage = file => { if (!images.has(file)) images.set(file, readPng(file)); return images.get(file); };

function add(group, faction, sheet, atlas, type, allowed = null) {
  const url = visualManifest[atlas.sprite]?.file;
  if (!url) throw new Error(`Image manquante : ${atlas.sprite}`);
  const file = fileURLToPath(url), image = getImage(file);
  for(const [index,frame] of atlas.frames.entries()) {
    if (allowed && !allowed.includes(index)) continue;
    const [x,y,w,h]=frame;
    if(frame.some(value=>!Number.isFinite(value))||x<0||y<0||w<=0||h<=0||x+w>image.width||y+h>image.height)throw new Error(`Découpe hors image : ${group}/${sheet}/${index}`);
    const scale=(atlas.frameScales?.[index]??1)/(atlas.referenceHeight||(sheet==='combat'?340:360));
    const sx=type==='base'||type==='minor-ultimate'||atlas.uniformCharacter ? characterFrameScale(atlas,index,1)
      : type==='ultimate' ? ultimateCharacterScale(atlas,index,1,group.split(':')[1]) : scale*1.1236;
    const sy=sx;
    inventory.push({group,faction,sheet,index,sprite:atlas.sprite,file,frame,type,scaleX:sx,scaleY:sy,
      isolated: type === 'base' || type === 'minor-ultimate' || !!atlas.isolated, clip: atlas.clips?.[index]});
  }
}

for(const [faction,atlas]of Object.entries(combatAtlases))add(faction,faction,'combat',atlas,'combat');
for(const [faction,atlas]of Object.entries(minorStandingAtlases))add(faction,faction,'attente',atlas,'base');
for(const [faction,sheets]of Object.entries(candidateExtraAtlases))for(const[sheet,atlas]of Object.entries(sheets))add(faction,faction,sheet,atlas,minorExtraAtlases[faction]?'minor-extra':'extra');
for(const [style,skin]of Object.entries(skinAnimationAtlases)) {
  add(style,skin.faction,'combat',skin.combat,'combat');
  for(const[sheet,atlas]of Object.entries(skin.extras))add(style,skin.faction,sheet,atlas,'extra');
}
const ultimateCharacters={wave:[0,1,2,3],fire:[0,1,2,3],scarf:[0,1,2,3],europe:[0,1,2,3,4,5,6,7,8,9,10,11],bardella:[0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15]};
for(const[key,allowed]of Object.entries(ultimateCharacters)) {
  const faction={wave:'le_pen',fire:'melenchon',scarf:'philippe',europe:'philippe',bardella:'le_pen',wall:'philippe',surge:'melenchon',zemmour:'le_pen'}[key];
  add(`ultimate:${key}`,faction,'ultimate',ultimateAtlases[key],'ultimate',allowed);
}
for(const[key,atlas]of Object.entries(ultimateGuardAtlases))add(`ultimate:${key}`,key.startsWith('europe')?'philippe':'le_pen','ultimate',atlas,'ultimate');
for(const [key,faction] of Object.entries({tools:'arthaud',phone:'glucksmann',satchelThrow:'attal',sausageThrow:'roussel'}))add(faction,faction,key,minorUltimateAtlases[key],'minor-ultimate');
for(const[faction,file]of Object.entries(MINOR_SPRITES)) {
 const atlas=MINOR_ATLASES[faction],sprite=`minor-${faction}`;
 add(faction,faction,'base',{...atlas,sprite},'base');
}
for(const faction of ['philippe','le_pen','melenchon']) {
 const sprite=`character-${faction}`,file=fileURLToPath(visualManifest[sprite].file),image=getImage(file);
 add(faction,faction,'base',{sprite,referenceHeight:image.height,frames:[[0,0,image.width,image.height,image.width/2,image.height]]},'main-base');
 const item=inventory.at(-1);item.scaleX=item.scaleY=1/image.height;
}
for(const[faction,styles]of Object.entries(CAMPAIGN_STYLES))for(const style of styles){
 const sprite=styleSpriteId(style.id),image=getImage(fileURLToPath(visualManifest[sprite].file));
 add(style.id,faction,'base',{sprite,frames:[[0,0,image.width,image.height,image.width/2,image.height]]},'main-base');
 inventory.at(-1).scaleX=inventory.at(-1).scaleY=1/image.height;
}
mkdirSync('artifacts/animation-audit',{recursive:true});
writeFileSync('artifacts/animation-audit/inventory-after.json',JSON.stringify(inventory,null,2));
const deformed=inventory.filter(p=>Math.abs(p.scaleX/p.scaleY-1)>.01);
console.log(JSON.stringify({poses:inventory.length,nonUniformScales:deformed.length}));
