import {createRequire} from 'node:module';
const sharp=createRequire(import.meta.url)('C:/Users/ferat/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp/dist/index.cjs');
const p='docs/production/decor-v3/carte-plate/production',master=p+'/fresque-en-cours.png';
for(const n of [13,14,15])await sharp(master).extract({left:(n-1)*1920,top:660,width:1920,height:420}).resize(1440,315).png().toFile(p+'/repere-pot-'+n+'.png');
await sharp(master).extract({left:30620,top:875,width:730,height:205}).png().toFile(p+'/socle-riches-guide.png');
