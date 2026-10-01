// Audit visuel en lecture seule : aucune modification du moteur ou des images sources.
import { createRequire } from 'node:module';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';

const require = createRequire(import.meta.url);
const { chromium } = require(path.join(process.env.CAMPAIGN_TEST_NODE_MODULES, 'playwright'));
const output = path.resolve('artifacts/world-v2-audit');
await mkdir(output, { recursive: true });
if (process.argv.includes('--report-only')) {
  await buildComparison(JSON.parse(await readFile(path.join(output, 'captures.json'), 'utf8')).zones);
  process.exit(0);
}
const browser = await chromium.launch({ headless: true, channel: 'chrome' });
const saveImage = (name, url) => writeFile(path.join(output, name + '.png'), Buffer.from(url.split(',')[1], 'base64'));
const baseUrl = process.env.CAMPAIGN_TEST_URL || 'http://localhost:2027';
const errors = [];

try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(baseUrl + '/src/presentation/world-v2-preview.html?decor=panoramas');
  await page.waitForFunction(() => window.worldV2Preview, { timeout: 60000 });
  const zones = await page.evaluate(() => worldV2Preview.sim.state.world.subzones.map(z => ({ id: z.id, biome: z.biome_id, start: z.start, center: z.center, width: z.width })));
  for (const zone of zones) {
    for (const [label, offset] of [['gauche', -8], ['centre', 0], ['droite', 8]]) {
      const data = await page.evaluate(x => { worldV2Preview.draw(x); return worldV2Preview.renderer.canvas.toDataURL(); }, zone.center + offset);
      await saveImage(zone.id + '-' + label, data);
    }
    if (zone.id.endsWith('_a')) {
      const data = await page.evaluate(x => { worldV2Preview.draw(x); return worldV2Preview.renderer.canvas.toDataURL(); }, zone.start);
      await saveImage('raccord-' + zone.id, data);
    }
  }
  const metrics = await page.evaluate(() => ({ metrics: worldV2Preview.renderer.metrics, assets: worldV2Preview.renderer.assets.status() }));

  // Réactive seulement dans ce navigateur la branche historique encore présente.
  // Les fichiers du projet et les positions actuelles des sites sont conservés.
  const original = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  original.on('pageerror', error => errors.push(error.message));
  const fixed = await readFile('src/presentation/fixed-world.js', 'utf8');
  const selection = await readFile('src/presentation/illustrated-world.js', 'utf8');
  const ids = ['bobo', 'banlieue', 'periurbain', 'campagne', 'retraites', 'riches'].map(name => 'panorama-' + name);
  assert.ok(fixed.includes("if (decor === 'panoramas') {"));
  assert.ok(selection.includes('for (const id of expandedWorldAssetIds()) wanted.add(id);'));
  await original.route('**/src/presentation/fixed-world.js', route => route.fulfill({
    contentType: 'text/javascript',
    body: fixed.replace("if (decor === 'panoramas') {", "if (false && decor === 'panoramas') {")
      .replace("if (currentMapDecor() === 'panoramas') return renderer.worldV2Sites?.get(building.site_id) || null;", '// Audit : enseignes historiques du panorama.'),
  }));
  await original.route('**/src/presentation/illustrated-world.js', route => route.fulfill({
    contentType: 'text/javascript',
    body: selection.replace('for (const id of expandedWorldAssetIds()) wanted.add(id);', `for (const id of ${JSON.stringify(ids)}) wanted.add(id);`),
  }));
  await original.goto(baseUrl + '/src/presentation/world-v2-preview.html?decor=panoramas');
  await original.waitForFunction(() => window.worldV2Preview, { timeout: 60000 });
  for (const zone of zones) {
    const data = await original.evaluate(x => { worldV2Preview.draw(x); return worldV2Preview.renderer.canvas.toDataURL(); }, zone.center);
    await saveImage(zone.id + '-ancien-jeu', data);
  }
  const sheets = await page.evaluate(async zones => {
    const arts = { paris_19e: 'bobo', banlieue: 'banlieue', periurbain_usine: 'periurbain', campagne: 'campagne', retraites: 'retraites', quartiers_riches: 'riches' };
    const load = url => new Promise((resolve, reject) => { const img = new Image(); img.onload = () => resolve(img); img.onerror = reject; img.src = url; });
    const result = [];
    for (const [biome, art] of Object.entries(arts)) {
      const image = await load('/assets/generated/world-v2/panorama-' + art + '.png');
      const canvas = document.createElement('canvas'); canvas.width = 1280; canvas.height = 1110;
      const ctx = canvas.getContext('2d'); ctx.fillStyle = '#f3e9d4'; ctx.fillRect(0, 0, canvas.width, canvas.height);
      zones.filter(z => z.biome === biome).forEach((zone, index) => {
        const y = index * 370; ctx.fillStyle = '#203d32'; ctx.font = '16px system-ui';
        ctx.fillText(zone.id + ' — original : extrait peint', 8, y + 24);
        ctx.fillText('Version composée : centre, zoom du jeu', 648, y + 24);
        const sourceWidth = image.width / 3, width = 320 * sourceWidth / image.height;
        ctx.drawImage(image, index * sourceWidth, 0, sourceWidth, image.height, (640 - width) / 2, y + 30, width, 320);
        worldV2Preview.draw(zone.center);
        const view = worldV2Preview.renderer.canvas, viewHeight = 640 * view.height / view.width;
        ctx.drawImage(view, 640, y + 30 + (320 - viewHeight) / 2, 640, viewHeight);
      });
      result.push({ biome, data: canvas.toDataURL() });
    }
    return result;
  }, zones);
  for (const sheet of sheets) await saveImage('comparatif-' + sheet.biome, sheet.data);
  assert.deepEqual(errors, []);
  assert.deepEqual(metrics.assets.failed, []);
  await writeFile(path.join(output, 'captures.json'), JSON.stringify({ zones, ...metrics, errors, note: 'Ancien jeu : branche historique du panorama, zoom et positions actuelles. Extraits peints : tiers des originaux, cadrage différent, pour comparer la facture graphique.' }, null, 2));
  await buildComparison(zones);
  console.log(JSON.stringify({ output, zones: zones.length, vuesActuelles: 54, vuesAnciennes: 18, raccords: 6, comparatifs: sheets.length, errors }));
} finally {
  await browser.close();
}

async function buildComparison(zones) {
  const report = await readFile('docs/production/decor-v3/AUDIT-WORLD-V2.md', 'utf8');
  const rows = report.split('\n').filter(line => /^\| \*\*/.test(line)).map(line => line.split('|').slice(1, -1).map(cell => cell.trim()));
  assert.equal(rows.length, zones.length);
  const entries = zones.map((zone, index) => ({ ...zone, title: rows[index][0], conformity: rows[index][1], quality: rows[index][2] }));
  const data = JSON.stringify(entries).replaceAll('<', '\\u003c');
  const html = `<!doctype html>
<html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Audit world-v2 — 18 sous-zones</title>
<style>
*{box-sizing:border-box}body{margin:0;background:#efe7d7;color:#253c34;font:16px/1.55 system-ui}main{max-width:1500px;margin:auto;padding:24px}h1{font-size:28px;margin:0 0 12px}h2{font-size:21px}p{max-width:100ch}.verdict{background:#fff7f0;border-left:5px solid #a54d32;padding:14px 20px}nav{display:flex;gap:12px;flex-wrap:wrap;align-items:center;padding:14px 0}select,button{font:inherit;padding:8px;background:#fffaf0;border:1px solid #a6aa99;border-radius:6px;cursor:pointer}label{display:flex;align-items:center;gap:8px}.compare{display:grid;grid-template-columns:1fr 1fr;gap:16px}figure{margin:0;background:#fffaf0;border:1px solid #d4cbb8;border-radius:8px;overflow:hidden}figcaption{padding:12px;font-weight:650}.stage{height:410px;display:flex;align-items:center;justify-content:center;background:#e1dbcd}.stage>img{width:100%;height:100%;object-fit:contain}.crop{position:relative;overflow:hidden;aspect-ratio:1;width:min(100%,410px);height:auto}.crop img{position:relative;width:300%;max-width:none;height:auto;display:block}.notes{display:grid;grid-template-columns:1fr 1fr;gap:16px}.notes section{background:#fffaf0;border-radius:8px;padding:8px 20px;margin:16px 0}.notes h2{font-size:18px}.sheet{width:100%;height:auto}summary{cursor:pointer;font-weight:650;padding:14px}details{margin:14px 0;background:#fffaf0;border-radius:8px}a{color:#235e55}small{display:block;max-width:110ch}button:focus-visible,select:focus-visible{outline:3px solid #266c65;outline-offset:2px}@media(max-width:850px){.compare,.notes{grid-template-columns:1fr}.stage{height:330px}main{padding:16px}}
</style>
<main><h1>Audit world-v2 : chaque sous-zone face à l’original</h1>
<p class="verdict"><strong>La version composée n’est pas validée.</strong> Les portes interactives et quelques formes ont progressé, mais la composition, les lieux et la parallaxe n’atteignent pas la référence world-v2.</p>
<p>Comparer la peinture d’origine, le rendu actuel et les vues de part et d’autre du centre. Les panoramas sources sont conservés. Cette page est un audit ; le moteur du jeu n’a pas été corrigé pendant cette passe.</p>
<nav><button id="previous" aria-label="Sous-zone précédente">←</button><label>Sous-zone <select id="zone"></select></label><button id="next" aria-label="Sous-zone suivante">→</button><label>Référence <select id="reference"><option value="paint">Extrait peint original</option><option value="game">Ancien rendu, même zoom</option></select></label><label>Vue actuelle <select id="position"><option value="gauche">Gauche (−8 unités)</option><option value="centre" selected>Centre</option><option value="droite">Droite (+8 unités)</option></select></label></nav>
<div class="compare"><figure><figcaption id="reference-title"></figcaption><div id="original-stage" class="stage"></div></figure><figure><figcaption id="current-title"></figcaption><div class="stage"><img id="current" alt="Capture de la sous-zone actuelle"></div></figure></div>
<p><small>Un extrait peint montre la composition d’origine, avec un cadrage différent de celui du jeu. Le mode « Ancien rendu, même zoom » utilise la branche historique, les positions actuelles des sites et le même viewport. Les poses du joueur peuvent varier. Les images sont affichées sans déformation.</small></p>
<div class="notes"><section><h2>1. Respect du CDC et du tableau</h2><p id="conformity"></p></section><section><h2>2. Qualité et correction nécessaire</h2><p id="quality"></p></section></div>
<p><a href="../../docs/production/decor-v3/AUDIT-WORLD-V2.md">Lire l’audit complet et les causes dans le code</a> · <a href="../../docs/production/decor-v3/cahier-des-charges-decor.html">Cahier des charges</a></p>
<details><summary>Les six planches comparatives</summary><div id="sheets"></div></details>
<details><summary>Les six raccords entre biomes</summary><div id="joins"></div></details>
<p>Priorité : retrouver des scènes cohérentes à partir des originaux, prolonger leur contenu à l’échelle du jeu et rendre les éléments du CDC visibles. Banlieue B est le premier cas à reprendre : marché ouvert, vieille rue commerçante et basilique en fond.</p>
</main>
<script>
const entries=${data};
const arts={paris_19e:'bobo',banlieue:'banlieue',periurbain_usine:'periurbain',campagne:'campagne',retraites:'retraites',quartiers_riches:'riches'};
const zone=document.querySelector('#zone'),reference=document.querySelector('#reference'),position=document.querySelector('#position');
const plain=text=>text.replaceAll('**','').replaceAll(String.fromCharCode(96),'');
entries.forEach((entry,index)=>zone.add(new Option((index+1)+' · '+plain(entry.title),String(index))));
function refresh(){
 const entry=entries[Number(zone.value)],paint=reference.value==='paint';
 document.querySelector('#reference-title').textContent=plain(entry.title)+' — '+(paint?'peinture originale':'ancien rendu au même zoom');
 document.querySelector('#current-title').textContent='Version composée — '+position.options[position.selectedIndex].text;
 document.querySelector('#current').src=entry.id+'-'+position.value+'.png';
 const stage=document.querySelector('#original-stage');stage.replaceChildren();const img=new Image();img.alt='Référence world-v2 de '+plain(entry.title);
 if(paint){const crop=document.createElement('div');crop.className='crop';img.src='../../assets/generated/world-v2/panorama-'+arts[entry.biome]+'.png';img.style.left=-(Number(zone.value)%3)*100+'%';crop.append(img);stage.append(crop);}else{img.src=entry.id+'-ancien-jeu.png';stage.append(img);}
 document.querySelector('#conformity').textContent=plain(entry.conformity);document.querySelector('#quality').textContent=plain(entry.quality);
}
zone.onchange=reference.onchange=position.onchange=refresh;
document.querySelector('#previous').onclick=()=>{zone.value=(Number(zone.value)+17)%18;refresh();};document.querySelector('#next').onclick=()=>{zone.value=(Number(zone.value)+1)%18;refresh();};
for(const [biome,art] of Object.entries(arts)){const img=new Image();img.className='sheet';img.loading='lazy';img.alt='Comparatif des trois sous-zones : '+art;img.src='comparatif-'+biome+'.png';document.querySelector('#sheets').append(img);}
for(const entry of entries.filter(e=>e.id.endsWith('_a'))){const figure=document.createElement('figure'),caption=document.createElement('figcaption'),img=new Image();caption.textContent='Frontière à l’entrée de '+entry.id;img.className='sheet';img.loading='lazy';img.alt=caption.textContent;img.src='raccord-'+entry.id+'.png';figure.append(caption,img);document.querySelector('#joins').append(figure);}
refresh();
</script></html>`;
  await writeFile(path.join(output, 'index.html'), html);
}
