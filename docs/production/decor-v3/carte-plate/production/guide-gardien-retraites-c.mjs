import {readPng,writePng} from '../../../../../scripts/lib/png.mjs';
const base='docs/production/decor-v3/carte-plate/production/retouches/',a=readPng(base+'retraites-c-entree-calage-normalisee.png');
function fill(x,y,w,h,c){for(let j=y;j<y+h;j++)for(let i=x;i<x+w;i++){const p=(j*a.width+i)*4;a.data[p]=c[0];a.data[p+1]=c[1];a.data[p+2]=c[2];a.data[p+3]=255;}}
fill(560,200,299,344,[225,203,163]);
fill(577,304,258,44,[243,228,197]);
fill(658,360,96,184,[35,60,67]);fill(730,441,4,26,[192,147,68]);
writePng(base+'retraites-c-entree-calage-guide.png',a);
console.log('Guide du seul gardien déplacé, proportions corrigées ; aucune modification du maître.');
