// Capture le rendu réel à hauteur de référence ; ne retouche pas les images du jeu.
const { chromium } = require('C:/Users/ferat/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs = require('node:fs');
const path = require('node:path');
(async () => {
  const directory = path.resolve(process.argv[2] || 'artifacts/france-peinte/reprise/controle');
  const format = process.argv[3] || '';
  const seasons = process.argv[4] || 'paris_b';
  fs.mkdirSync(directory,{recursive:true});
  const browser = await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
  try {
    const page = await browser.newPage({viewport:{width:1600,height:900}}), errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    await page.goto(`http://localhost:2027/src/presentation/world-v3/captures.html?decor=france_peinte&saisons=${encodeURIComponent(seasons)}${format ? `&format=${format}` : ''}`);
    await page.waitForFunction(()=>document.title==='Captures prêtes',{},{timeout:120000});
    const images=await page.locator('#list img').evaluateAll(list=>list.map(img=>img.src));
    const shotNames=await page.locator('#list img').evaluateAll(list=>list.map(img=>img.alt));
    images.forEach((data,index)=>fs.writeFileSync(path.join(directory,`${String(index).padStart(2,'0')}.png`),Buffer.from(data.split(',')[1],'base64')));
    fs.writeFileSync(path.join(directory,'rapport.json'),JSON.stringify({format:format||'ordinateur',images:images.length,shotNames,errors},null,2));
    if(errors.length) throw new Error(errors.join('\n'));
    console.log(`${images.length} captures enregistrées dans ${directory}.`);
  } finally { await browser.close(); }
})().catch(error=>{console.error(error);process.exitCode=1;});
