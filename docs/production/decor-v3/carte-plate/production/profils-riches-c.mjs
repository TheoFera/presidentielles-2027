import fs from 'node:fs';
const base='docs/production/decor-v3/carte-plate/production/retouches/';
for(const p of [
 {id:'riches-c-cabinet-distinct',sx:[316,332,336,769,773,816],dx:[316,433,437,695,699,816],sy:[60,71,75,139,145,178],dy:[60,160,164,208,214,220],bs:[316,523,614,816],bd:[316,518,614,816],bodyY:178,bodyBottom:394},
 {id:'riches-c-institut-distinct',sx:[316,345,350,847,853,897],dx:[316,433,437,695,699,856],sy:[60,76,81,149,154,194],dy:[60,160,164,208,214,220],bs:[316,568,674,897],bd:[316,518,614,856],bodyY:194,bodyBottom:394},
]){
 const cells=[];
 for(let i=0;i<5;i++)for(let j=0;j<5;j++)cells.push({source:[p.sx[i],p.sy[j],p.sx[i+1]-p.sx[i],p.sy[j+1]-p.sy[j]],target:[p.dx[i],p.dy[j],p.dx[i+1]-p.dx[i],p.dy[j+1]-p.dy[j]],role:i===2&&j===2?'panneau':'encadrement'});
 for(let i=0;i<3;i++)cells.push({source:[p.bs[i],p.bodyY,p.bs[i+1]-p.bs[i],p.bodyBottom-p.bodyY],target:[p.bd[i],220,p.bd[i+1]-p.bd[i],184],role:i===1?'porte':'vitrine'});
 cells.push({source:[p.bs[0],394,p.bs[3]-p.bs[0],86],target:[p.bd[0],404,p.bd[3]-p.bd[0],76],role:'trottoir et chaussée'});
 fs.writeFileSync(base+p.id+'-profil.json',JSON.stringify({id:p.id,tileLeft:32640,cells},null,2));
}
