import fs from 'node:fs';
const base='docs/production/decor-v3/carte-plate/production/retouches/';
for(const [id,panelY] of [['paris-c-cabinet-panneau-calage',100],['paris-c-institut-panneau-calage',101]]){
 const cells=[],sx=[390,427,687,720],dx=[390,427,685,720],sy=[90,panelY,147,160],dy=[90,104,148,160];
 for(let i=0;i<3;i++)for(let j=0;j<3;j++)cells.push({source:[sx[i],sy[j],sx[i+1]-sx[i],sy[j+1]-sy[j]],target:[dx[i],dy[j],dx[i+1]-dx[i],dy[j+1]-dy[j]],role:i===1&&j===1?'panneau':'encadrement'});
 fs.writeFileSync(base+id+'-profil.json',JSON.stringify({id,tileLeft:3840,cells},null,2));
}
