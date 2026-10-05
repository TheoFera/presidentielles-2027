// Les autres vues sont identiques : éviter de réécrire les images inchangées.
import fs from 'node:fs';
const write=fs.writeFileSync;
fs.writeFileSync=(file,...args)=>{
 const name=String(file).replaceAll('\\','/');
 if(name.includes('/controle-visuel-raccords/raccord-')&&!/raccord-(13-14|16-17)\.png$/.test(name))return;
 if(/\/retouches\/tuile-\d{2}-echelle\.png$/.test(name)&&!/tuile-(14|17)-echelle\.png$/.test(name))return;
 return write(file,...args);
};
await import('./inspecter-raccords-visuels.mjs');
process.argv[2]='vues';
await import('../finition.mjs');
