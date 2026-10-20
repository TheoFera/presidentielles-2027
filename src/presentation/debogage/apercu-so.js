import { loadConfig } from '../../config.js';
import { GameSimulation } from '../../simulation/game-simulation.js';
import { combatState } from '../../simulation/combat-state.js';
import { beginCombatTick, updateCombat, startNpcAttack } from '../../simulation/combat.js';
import { updateGuard, updateRaidRecruit } from '../../simulation/military.js';
import { updateStrategicSites, captureSite } from '../../simulation/strategic-sites.js';
import { npcGender } from '../../simulation/npc-appearance.js';
import { ringDelta } from '../../simulation/world.js';
import { WorldRenderer } from '../rendu/renderer.js';
import { visualManifest } from '../rendu/visual-manifest.js';
import { SERVICE_ORDER_STYLES } from '../../simulation/service-order-rules.js';
import { SERVICE_ORDER_VARIANTS, serviceOrderVariant, serviceOrderPose } from '../personnages/service-order-sprites.js';
import { drawFixedWorld } from '../carte/fixed-world.js';
import { drawInfrastructure } from '../carte/infrastructure.js';
import { drawBuildingShutters, BUILDING_CLOSURE_ASSETS } from '../carte/building-shutters.js';

const config = await loadConfig(), initial = new GameSimulation(config, 42), hz = initial.hz;
const canvas = document.querySelector('canvas'), ctx = canvas.getContext('2d');
const labels = {
  melenchon: ['Syndicaliste · homme', 'Syndicaliste · femme', 'Antifa à capuche · homme', 'Antifa à capuche · femme', 'Antifa masqué · homme', 'Antifa masquée · femme', 'Jeune masqué · homme', 'Jeune masquée · femme',
    'Chasuble orange · homme', 'Chasuble orange · femme', 'Gilet orange à poches · homme', 'Gilet orange à poches · femme'],
  le_pen: ['Nationaliste masqué 1 · homme', 'Nationaliste masquée 1 · femme', 'Nationaliste masqué 2 · homme', 'Nationaliste masquée 2 · femme', 'Rural chasseur · homme', 'Rurale chasseuse · femme', 'Ancien militaire masqué', 'Ancienne militaire masquée',
    'Rural en bonnet · homme', 'Rurale en bonnet · femme', 'Rural en blouson · homme', 'Rurale en blouson · femme'],
};
const ids = [...Object.keys(visualManifest).filter(id => id.startsWith('security-so-') || id.startsWith('npc-') || id.startsWith('character-melenchon') || id.startsWith('character-le_pen') || id === 'character-le-pen-combat-v1'), ...Array.from({ length: 18 }, (_, i) => `plate-${String(i + 1).padStart(2, '0')}`), ...BUILDING_CLOSURE_ASSETS];
const loaded = new Map(await Promise.all(ids.map(async id => {
  const image = new Image(); image.src = visualManifest[id].file; await image.decode(); return [id, image];
})));
let faction = 'melenchon', mode = 'idle', direction = 1, paused = false, speed = 1, clock = 0, previous = performance.now();
function actorsFor(camp) {
  return SERVICE_ORDER_VARIANTS[camp].map(variant => {
    let actor;
    for (let i = 0; i < 1000; i++) {
      actor = { id: `npc:${i}`, role: 'SERVICE_D_ORDRE', faction_id: camp, x: 30, facing: 1, combat: combatState(), converted_tick: -100, persuasion_target_ids: [] };
      for (const duty of ['DEFENSE', 'RAID']) {
        const style = SERVICE_ORDER_STYLES[camp][duty].indexOf(variant.slice(0, -2));
        if (style < 0) continue;
        actor.so_assignment = { style, gender: variant.slice(-1) };
        actor.raid = duty === 'RAID' ? { id: 'apercu', phase: 'OUTBOUND', direction: 1 } : null;
        if (serviceOrderVariant(actor) === variant) return actor;
      }
    }
    throw Error('Apparence introuvable : ' + variant);
  });
}
const catalogs = Object.fromEntries(Object.keys(SERVICE_ORDER_VARIANTS).map(camp => [camp, actorsFor(camp)]));
const demo = new GameSimulation(config, 42);
demo.state.npcs = [structuredClone(catalogs.melenchon[0])];
startNpcAttack(demo, demo.state.npcs[0], 'GUARD', { cooldown_seconds: config.balance.physical_units.service_ordre.attack_cooldown_seconds });
const attackTemplate = demo.state.attacks[0];
const galleryState = { ...initial.state, candidates: [], npcs: [], temporary_units: [], buildings: [], attacks: [], powers: [], hit_results: [], projectiles: [] };
const renderer = {
  ctx, config, p: config.prototype.presentation, width: 1200, height: 640,
  metrics: { groundY: 270, characterHeight: 220, pixelsPerUnit: 65, groundOffsetRatio: 0, anchorX: 600 },
  assets: { get: id => loaded.get(id), load: async () => null },
  drawVisiblePerson: WorldRenderer.prototype.drawVisiblePerson, personMarks: new Map(),
};
let scene, sceneFrames, sceneMode;
function resetScene() {
  sceneMode = mode;
  scene = new GameSimulation(config, 42); const s = scene.state;
  if (mode === 'defense') {
    const building = s.buildings.find(b => b.fixed_variant === 'service_ordre' && b.biome_id === (faction === 'melenchon' ? 'banlieue' : 'campagne'));
    const owner = s.candidates.find(c => c.faction_id === faction), intruder = s.candidates.find(c => c.faction_id === (faction === 'melenchon' ? 'le_pen' : 'melenchon'));
    const pool = s.npcs.slice();
    s.npcs = ['h', 'f', 'h'].map((gender, i) => {
      const index = pool.findIndex(n => npcGender(n, s) === gender), npc = pool.splice(index, 1)[0];
      return { ...npc, x: building.x - direction * (4 + i * .6), role: i === 1 ? 'MILITANT' : 'SYMPATHISANT', faction_id: faction, task: null, next_donation_tick: null, donation_cents: 0 };
    });
    s.candidates = [intruder]; intruder.x = building.x + 24; intruder.campaign_active = false;
    s.buildings = [building]; s.temporary_units = []; s.tick = 600;
    captureSite(scene, building, owner);
    sceneFrames = [structuredClone(s)]; return;
  }
  const building = s.buildings.find(b => b.site_id === 'site:paris_b' && b.controls_zone);
  Object.assign(building, { state: 'ACTIVE', active: true, neutral: false, owner_id: faction === 'melenchon' ? 'le_pen' : 'melenchon', headquarters: false, closure_progress: 0, shutter_transition: null });
  s.candidates = []; s.temporary_units = []; s.buildings = [building];
  s.powers = []; s.attacks = []; s.hit_results = []; s.projectiles = []; s.tick = 600;
  s.npcs = catalogs[faction].filter(actor => actor.raid).slice(0, 3).map((actor, i) => ({ ...structuredClone(actor), x: building.x - direction * (5 + i * .8), facing: direction, hidden_durability: 90,
    guard_anchor_x: building.x - direction * 5, raid: { id: 'apercu', phase: 'OUTBOUND', direction } }));
  sceneFrames = [structuredClone(s)];
}
resetScene();
function sceneAt(seconds) {
  const index = Math.max(0, Math.floor(seconds * hz));
  while (sceneFrames.length <= index) {
    scene.state.tick++; beginCombatTick(scene);
    if (sceneMode === 'defense') {
      const seconds = (scene.state.tick - 600) / hz, building = scene.state.buildings[0];
      const intruder = scene.state.candidates[0];
      intruder.x = building.x + direction * (seconds >= 8 && seconds < 13 ? 5 : 24);
      intruder.facing = -direction;
      if (seconds >= 8 && seconds < 13) startNpcAttack(scene, intruder, 'GUARD', { range: 1.6, damage: 1, knockback: 0, electoral_damage: 0, cooldown_seconds: .9 });
    }
    for (const actor of scene.state.npcs) {
      if (actor.role === 'SERVICE_D_ORDRE') updateGuard(scene, actor);
      else if (['JOIN_GUARD', 'JOIN_RAID'].includes(actor.task?.kind)) updateRaidRecruit(scene, actor);
    }
    updateCombat(scene); updateStrategicSites(scene);
    sceneFrames.push(structuredClone(scene.state));
  }
  return sceneFrames[index];
}
function render(nextMode = mode, tick = Math.floor(clock * hz), camp = faction, facing = direction) {
  const reset = camp !== faction || facing !== direction || sceneMode !== nextMode;
  faction = camp; direction = facing;
  mode = nextMode;
  if (reset) resetScene();
  const onMap = ['raid', 'defense'].includes(mode);
  const wantedHeight = onMap ? 640 : Math.ceil(catalogs[faction].length / 4) * 320;
  if (canvas.height !== wantedHeight) canvas.height = wantedHeight;
  renderer.height = wantedHeight;
  ctx.reset(); renderer.fixedWorldActive = false;
  ctx.fillStyle = '#e9e1d2'; ctx.fillRect(0, 0, canvas.width, canvas.height);
  const records = [];
  if (onMap) {
    const seconds = (tick / hz) % (mode === 'defense' ? 20 : 14), state = sceneAt(seconds), building = state.buildings[0];
    renderer.metrics = { groundY: 565, characterHeight: 188, pixelsPerUnit: 90, groundOffsetRatio: .06, anchorX: 600 };
    const shift = mode === 'defense' ? direction * 1.5 * Math.max(0, Math.min(1, (seconds - 7.5) / 1.5, (16 - seconds) / 2)) : 0;
    renderer.cameraX = building.x + shift; renderer.screenX = x => 600 + ringDelta(renderer.cameraX, x, state.world.length) * 90;
    renderer.fixedWorldActive = drawFixedWorld(renderer, state); renderer.buildingShutterTick = state.tick;
    drawBuildingShutters(renderer, state);
    if (mode === 'defense') drawInfrastructure(renderer, state);
    for (const actor of state.npcs) {
      if (actor.task?.phase === 'INSIDE') continue;
      WorldRenderer.prototype.drawPerson.call(renderer, actor, renderer.screenX(actor.x), state); records.push({ variant: serviceOrderVariant(actor), ...serviceOrderPose(actor, state, hz), feetY: renderer.personMarks.get(actor.id)?.feetY });
    }
    for (const candidate of state.candidates) if (Math.abs(ringDelta(building.x, candidate.x, state.world.length)) < 7) WorldRenderer.prototype.drawPerson.call(renderer, candidate, renderer.screenX(candidate.x), state);
    document.querySelector('#statut').textContent = mode === 'defense'
      ? seconds < 5 ? 'Trois soutiens rejoignent le local et entrent pour s’équiper.' : seconds < 8 ? 'Les SO attendent près du local, espacés, avec quelques pas et changements d’appui.' : seconds < 13 ? 'Un candidat adverse provoque un affrontement : les gardes se répartissent autour de lui et se relaient.' : 'L’intrus est sorti du territoire : les gardes abandonnent la poursuite et reviennent au poste.'
      : building.state === 'ACTIVE'
      ? `Raid réel : approche, placement et coups sur la façade. Fermeture : ${Math.round(building.closure_progress * 100)} %.`
      : 'Le local est fermé : les SO cessent de frapper et repartent.';
  } else {
    renderer.metrics = { groundY: 272, characterHeight: 220, pixelsPerUnit: 65, groundOffsetRatio: 0, anchorX: 150 };
    galleryState.tick = tick;
    const actors = catalogs[faction]; galleryState.npcs = actors;
    galleryState.buildings = [{ id: 'apercu-facade', state: 'ACTIVE', owner_id: faction === 'melenchon' ? 'le_pen' : 'melenchon' }];
    const cycle = tick % Math.ceil(config.balance.physical_units.service_ordre.attack_cooldown_seconds * hz);
    galleryState.attacks = mode === 'punch' && cycle < attackTemplate.windup_ticks + attackTemplate.active_ticks + attackTemplate.recovery_ticks
      ? actors.map(actor => ({ ...attackTemplate, owner_id: actor.id, elapsed_ticks: cycle })) : [];
    actors.forEach((actor, i) => {
      Object.assign(actor, { facing: direction, moving: mode === 'walk', pressure_target_id: mode === 'building' ? 'apercu-facade' : null });
      ctx.save(); ctx.translate(i % 4 * 300, Math.floor(i / 4) * 320);
      ctx.fillStyle = '#223440'; ctx.textAlign = 'center'; ctx.font = 'bold 16px system-ui'; ctx.fillText(labels[faction][i], 150, 32);
      ctx.strokeStyle = '#afa385'; ctx.beginPath(); ctx.moveTo(12, 272); ctx.lineTo(288, 272); ctx.stroke();
      WorldRenderer.prototype.drawPerson.call(renderer, actor, 145, galleryState); ctx.restore();
      records.push({ variant: serviceOrderVariant(actor), ...serviceOrderPose(actor, galleryState, hz) });
    });
    document.querySelector('#statut').textContent = ({ idle: 'Pose d’attente.', walk: 'Marche légère des PNJ.', punch: 'Un coup simple : préparation, frappe et retour.', building: 'Seuls les cagoulés de raid frappent la porte. Les syndicalistes et les ruraux restent en garde.' })[mode];
  }
  return records;
}
window.controleSO = { ready: true, hz, render, actors: catalogs, pause: () => { paused = true; }, reset: () => { clock = 0; resetScene(); }, sceneAt };
document.querySelectorAll('[data-mode]').forEach(button => button.onclick = () => {
  mode = button.dataset.mode; clock = 0; resetScene();
  document.querySelectorAll('[data-mode]').forEach(b => b.setAttribute('aria-pressed', String(b === button))); render();
});
document.querySelector('#camp').onchange = e => { faction = e.target.value; clock = 0; resetScene(); render(); };
document.querySelector('#sens').onchange = e => { direction = +e.target.value; clock = 0; resetScene(); render(); };
document.querySelector('#vitesse').onchange = e => { speed = +e.target.value; };
document.querySelector('#pause').onclick = e => { paused = !paused; e.target.textContent = paused ? 'Reprendre' : 'Mettre en pause'; };
document.querySelector('#image').onclick = () => { paused = true; clock += 1 / hz; render(); };
document.querySelector('#recommencer').onclick = () => { clock = 0; resetScene(); render(); };
function animate(now) { const dt = Math.min(.1, (now - previous) / 1000); previous = now; if (!paused) { clock += dt * speed; render(); } requestAnimationFrame(animate); }
render(); requestAnimationFrame(animate);
