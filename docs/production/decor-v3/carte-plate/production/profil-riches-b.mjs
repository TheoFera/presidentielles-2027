import fs from 'node:fs';
const id='riches-b-rdc-dessin',cells=[];
const sx=[330,376,380,575,579,800],dx=[330,423,427,685,689,800];
const sy=[0,54,58,103,107,119],dy=[0,160,164,208,212,220];
for(let i=0;i<5;i++)for(let j=0;j<5;j++)cells.push({source:[sx[i],sy[j],sx[i+1]-sx[i],sy[j+1]-sy[j]],target:[dx[i],dy[j],dx[i+1]-dx[i],dy[j+1]-dy[j]],role:i===2&&j===2?'panneau':'encadrement'});
const bs=[330,455,540,800],bd=[330,508,604,800];
for(let i=0;i<3;i++)cells.push({source:[bs[i],119,bs[i+1]-bs[i],273],target:[bd[i],220,bd[i+1]-bd[i],184],role:i===1?'porte':'vitrine'});
cells.push({source:[330,392,470,88],target:[330,404,470,76],role:'trottoir et chaussée'});
fs.writeFileSync('docs/production/decor-v3/carte-plate/production/retouches/'+id+'-profil.json',JSON.stringify({id,tileLeft:30720,cells},null,2));
