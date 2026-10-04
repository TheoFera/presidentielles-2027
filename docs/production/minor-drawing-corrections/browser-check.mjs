// Contrôle visuel avec les fonctions de dessin réellement utilisées par le jeu.
import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.MINOR_PLAYWRIGHT_PATH || 'playwright');
const browser = await chromium.launch({ headless: true, channel: 'chrome' });
try {
  const page = await browser.newPage({ viewport: { width: 1100, height: 900 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(process.env.MINOR_TEST_URL || 'http://localhost:2038');
  const report = await page.evaluate(async () => {
    const [{ loadConfig }, { GameSimulation }, { drawMinorCandidate }, { drawCandidateCombat }, { visualManifest }, { candidateExtraPose }, { compositionMetrics }, { drawIllustratedCharacter }] = await Promise.all([
      import('/src/config.js'), import('/src/simulation/game-simulation.js'), import('/src/presentation/minor-characters.js'),
      import('/src/presentation/melenchon-combat.js'), import('/src/presentation/visual-manifest.js'),
      import('/src/presentation/candidate-extra-poses.js'), import('/src/presentation/renderer.js'), import('/src/presentation/illustrated-characters.js'),
    ]);
    const config = await loadConfig(), sim = new GameSimulation(config, 42), hz = config.balance.simulation_architecture.fixed_tick_hz;
    const factions = ['philippe', 'le_pen', 'roussel', 'attal', 'arthaud'];
    const images = new Map();
    const ids = Object.keys(visualManifest).filter(id => factions.some(f => id === `character-${f}` || id.startsWith(`character-${f}-`) || id.startsWith(`character-${f.replaceAll('_', '-')}-`) || id.startsWith(`character-minor-${f}-`) || id === `minor-${f}`));
    await Promise.all(ids.map(async id => {
      const image = new Image(); image.src = visualManifest[id].file; await image.decode(); images.set(id, image);
    }));
    const cases = [
      { label: 'Au repos', guard: false },
      { label: 'Marche hors combat', guard: false, moving: true },
      { label: 'Garde', guard: true },
      { label: 'Pas de garde', guard: true, moving: true },
      { label: 'Persuasion', guard: false, persuade: true },
      { label: 'Écoute en persuasion', guard: false, listening: true },
      { label: 'Réaction à un coup léger', guard: true, hurt: true },
      ...[0, .3, .45, .6].map(age => ({ label: `K.O. après ${age.toLocaleString('fr-FR')} s`, ko: age })),
    ];
    document.body.innerHTML = '<main style="background:#e8e4de;padding:16px;font:16px Arial;color:#222"><h1 style="font-size:22px">Dessins corrigés — rendu du jeu</h1><p>Philippe · Le Pen · Roussel · Attal · Arthaud, pieds sur la même ligne</p><div id="poses"></div></main>';
    const draws = [], characterHeight = compositionMetrics(config, 1100, 600).characterHeight;
    for (const entry of cases) {
      const title = document.createElement('h2'); title.style.fontSize = '16px'; title.textContent = entry.label; document.querySelector('#poses').append(title);
      const canvas = document.createElement('canvas'); canvas.width = 1050; canvas.height = 180; document.querySelector('#poses').append(canvas);
      const ctx = canvas.getContext('2d'); ctx.strokeStyle = '#999'; ctx.beginPath(); ctx.moveTo(0, 160); ctx.lineTo(1050, 160); ctx.stroke();
      for (let i = 0; i < factions.length; i++) {
        const faction = factions[i], actor = structuredClone(sim.state.candidates.find(c => c.faction_id === faction));
        actor.current_campaign_style = null; actor.is_ko = entry.ko != null; actor.debate_hp = actor.is_ko ? 0 : 100;
        actor.moving = !!entry.moving; actor.axis = entry.moving ? 1 : 0; actor.facing = 1;
        actor.persuasion_target_ids = entry.persuade ? ['test'] : [];
        actor.persuasion = !!entry.listening;
        actor.combat.attack_id = null; actor.combat.charge_active = false; actor.combat.jump_tick = null; actor.combat.knockdown_tick = null;
        actor.combat.stun_ticks = entry.hurt ? 4 : 0; actor.combat.knockback_velocity = 0;
        actor.combat.last_hit = entry.hurt ? { target_id: actor.id, tick: 115, strong: false, knockback: false } : null;
        actor.ko_started_tick = entry.ko != null ? 120 - Math.round(entry.ko * hz) : null;
        const state = { ...sim.state, tick: 120, attacks: [], candidates: [actor], npcs: [], temporary_units: [] };
        const renderer = { ctx, config, p: config.prototype.presentation, metrics: { groundY: 160, groundOffsetRatio: 0, characterHeight },
          assets: { get: id => images.get(id), load: id => { throw new Error(`Image absente : ${id}`); } },
          combatPoseTracker: { active: () => !!entry.guard }, melenchonMotionTracker: { landing: () => null, walk: () => 0 } };
        const success = actor.minor ? drawMinorCandidate(renderer, actor, 105 + i * 210, state) : (drawIllustratedCharacter(renderer, actor, 105 + i * 210, state), true);
        draws.push({ faction, case: entry.label, success, pose: candidateExtraPose(actor, state, config, !!entry.guard) });
        // Vérifier aussi le retournement vers la gauche, sur un canevas de contrôle.
        if (actor.minor) {
          const mirror = document.createElement('canvas'); mirror.width = 240; mirror.height = 180;
          renderer.ctx = mirror.getContext('2d'); actor.facing = -1;
          if (!drawMinorCandidate(renderer, actor, 120, state)) throw new Error(`${faction} : rendu miroir absent`);
        }
      }
    }
    return { characterHeight, loadedImages: images.size, draws };
  });
  if (errors.length) throw new Error(errors.join('\n'));
  for (const draw of report.draws.filter(d => ['roussel', 'attal', 'arthaud'].includes(d.faction))) {
    if (!draw.success) throw new Error(`Rendu absent : ${draw.faction} ${draw.case}`);
    if (draw.case === 'Réaction à un coup léger' && draw.pose.frame !== 12) throw new Error('Mauvaise pose de réaction');
  }
  await page.locator('main').screenshot({ path: 'docs/production/minor-drawing-corrections/rendu-jeu.png' });
  await page.locator('canvas').nth(2).screenshot({ path: 'docs/production/minor-drawing-corrections/garde-corrigee.png' });
  writeFileSync('docs/production/minor-drawing-corrections/browser-report.json', JSON.stringify({ ...report, errors }, null, 2) + '\n');
  console.log(`33 rendus de candidats corrigés, 33 rendus vers la gauche, ${report.loadedImages} images décodées ; aucune erreur.`);
} finally { await browser.close(); }
