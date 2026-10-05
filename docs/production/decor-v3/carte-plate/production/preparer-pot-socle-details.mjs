import {createRequire} from 'node:module';
const sharp=createRequire(import.meta.url)('C:/Users/ferat/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp/dist/index.cjs');
const p='docs/production/decor-v3/carte-plate/production';
for(const[id,left,top,width,height]of [['pot-retraites',24720,780,640,300],['socle-riches',30550,696,960,384]])await sharp(p+'/fresque-en-cours.png').extract({left,top,width,height}).png().toFile(p+'/'+id+'-avant.png');
