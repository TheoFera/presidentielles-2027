import { loadConfig } from '../config.js';
import { GameSimulation } from '../simulation/game-simulation.js';
import { VisualAssets } from './visual-assets.js';
import { visualManifest } from './visual-manifest.js';
import { MINOR_LOOKS } from './minor-characters.js';
import { MINOR_ANIMATION_FILES, minorAnimationId, minorCombatAtlases, minorExtraAtlases } from './minor-animation-sprites.js';
import { prepareMinorFrames, prepareAtlasFrames } from './minor-sprite-images.js';
import { MINOR_ANIMATION_DATA } from './minor-animation-data.js';
import { drawIllustratedCharacter } from './illustrated-characters.js';
import { combatAtlases } from './melenchon-combat.js';
import { candidateExtraAtlases } from './candidate-extra-poses.js';

const config = await loadConfig(), assets = new VisualAssets(visualManifest, { prepareImage: (id, image) => {
  if (id.startsWith('minor-')) prepareMinorFrames(image, id.slice(6));
  if (id.startsWith('character-minor-')) { const [faction, sheet] = id.slice(16).split('-'); prepareAtlasFrames(image, MINOR_ANIMATION_DATA[faction]?.[sheet]); }
} });
const candidate = document.querySelector('#candidate'), mode = document.querySelector('#mode');
for (const [id, look] of Object.entries(MINOR_LOOKS)) candidate.add(new Option(look.fullName, id));
candidate.value = new URLSearchParams(location.search).get('candidate') || 'arthaud';
if (!candidate.value) candidate.value = 'arthaud';
const modes = { walk: 'Marche hors combat', guard: 'Pas glissés en garde', combo: 'Enchaînement de trois coups', charge: 'Charge et frappe', jump: 'Saut et réception', dash: 'Esquive', hit: 'Réaction à un coup', knockdown: 'Chute et relevé', persuade: 'Persuasion', ko: 'K.-O.' };
for (const [id, label] of Object.entries(modes)) mode.add(new Option(label, id));
mode.value = 'guard';
let comparisons = [], playing = true, facing = 1, elapsed = 0, previous = performance.now();
const labels = {
  combat: ['Garde A','Garde B','Poing 1 · préparation','Poing 1 · impact','Poing 2 · préparation','Poing 2 · impact','Pied · préparation','Pied · impact','Charge · concentration','Charge · prête','Charge · frappe','Charge · retour','Saut · impulsion','Saut · montée','Saut · descente','Saut · frappe'],
  movement: ['Pas de garde 1','Pas de garde 2','Pas de garde 3','Pas de garde 4','Pas de garde 5','Pas de garde 6','Pas de garde 7','Pas de garde 8','Esquive · préparation','Esquive · mouvement','Esquive · retour','Coup léger · impact','Coup léger · réaction','Coup fort · impact','Coup fort · réaction','Projection'],
  actions: ['Étourdi A','Étourdi B','Réception · accroupi','Réception · retour','Persuasion A','Persuasion B','Écoute A','Écoute B','Chute · déséquilibre','Chute · côté','Chute · au sol','K.-O. au sol'],
};
function tile(label, width = 210, height = 220) {
  const figure = document.createElement('figure'), canvas = document.createElement('canvas'), caption = document.createElement('figcaption');
  canvas.width = width; canvas.height = height; caption.textContent = label; figure.append(canvas, caption); return { figure, canvas };
}
async function setup() {
  window.galleryReady = false;
  const faction = candidate.value;
  await assets.loadRequired([`minor-${faction}`, ...Object.keys(MINOR_ANIMATION_FILES[faction]).map(sheet => minorAnimationId(faction, sheet)), 'character-philippe', combatAtlases.philippe.sprite, ...Object.values(candidateExtraAtlases.philippe).map(sheet => sheet.sprite)]);
  document.querySelector('#gallery').replaceChildren();
  for (const sheet of ['combat', 'movement', 'actions']) {
    const definition = sheet === 'combat' ? minorCombatAtlases[faction] : minorExtraAtlases[faction][sheet];
    const frames = prepareAtlasFrames(assets.get(definition.sprite), definition);
    const heading = document.createElement('h2'); heading.textContent = { combat: 'Combat et saut', movement: 'Déplacements et réactions', actions: 'Persuasion, chute et relevé' }[sheet];
    const grid = document.createElement('div'); grid.className = 'poses';
    for (const [index, frame] of frames.entries()) {
      const { figure, canvas } = tile(labels[sheet][index]), ctx = canvas.getContext('2d');
      const [sx, sy, sw, sh, px, py] = definition.frames[index], scale = 140 / definition.referenceHeight;
      ctx.drawImage(frame, 100+(sx-px)*scale*1.06, 198+(sy-py)*scale*1.1236, sw*scale*1.06, sh*scale*1.1236); grid.append(figure);
    }
    document.querySelector('#gallery').append(heading, grid);
  }
  document.querySelector('#comparison').replaceChildren(); comparisons = [];
  for (const id of ['philippe', faction]) {
    const { figure, canvas } = tile(id === 'philippe' ? 'Édouard Philippe · référence' : MINOR_LOOKS[id].fullName, 300, 255);
    document.querySelector('#comparison').append(figure);
    const state = new GameSimulation(config, 42).state; state.npcs = []; state.temporary_units = [];
    const actor = state.candidates.find(c => c.faction_id === id), original = structuredClone(actor);
    const renderer = { ctx: canvas.getContext('2d'), assets, config, p: config.prototype.presentation, metrics: { characterHeight: 150, groundY: 230 } };
    comparisons.push({ canvas, state, actor, original, renderer });
  }
  reset(); render(); window.galleryReady = true;
}
function reset() { elapsed = 0; for (const { renderer } of comparisons) { renderer.combatPoseTracker?.clear(); renderer.melenchonMotionTracker?.clear(); } }
function render() {
  const hz = config.balance.simulation_architecture.fixed_tick_hz, tick = Math.floor(elapsed * hz);
  for (const { canvas, state, actor, original, renderer } of comparisons) {
    Object.assign(actor, structuredClone(original)); state.tick = tick; state.attacks = []; state.powers = [];
    for (const c of state.candidates) c.x = 300 + state.candidates.indexOf(c) * 100;
    actor.x = 100; actor.facing = facing; actor.axis = 0; actor.moving = false; actor.persuasion_target_ids = [];
    const c = actor.combat, phase = tick % 120;
    if (mode.value === 'guard') { actor.moving = true; actor.axis = facing; actor.x += elapsed*3; state.candidates.find(e => e.id !== actor.id).x = actor.x+3; }
    if (mode.value === 'walk') { actor.moving = true; actor.axis = facing; actor.x += elapsed*3; }
    const attack = (kind, step, age) => { c.attack_id = 'preview'; state.attacks = [{ id: 'preview', owner_id: actor.id, kind, step, direction: facing, elapsed_ticks: age, windup_ticks: 6, active_ticks: 5, recovery_ticks: 12 }]; };
    if (mode.value === 'combo' && phase < 90) { if (phase%30 < 23) attack('CANDIDATE', Math.floor(phase/30)+1, phase%30); }
    if (mode.value === 'charge') {
      const hold = Math.ceil(config.balance.candidate_combat.charge_ready_seconds*hz)+12, age = tick%(hold+48);
      if (age < hold) { c.charge_active = true; c.press_tick = tick-age; } else if (age < hold+23) attack('CHARGED',3,age-hold);
    }
    if (mode.value === 'jump') { const duration = Math.ceil(config.balance.candidate_combat.jump_duration_seconds*hz), age = tick%(duration+45); if (age < duration) { c.jump_tick = tick-age; c.height = Math.sin(age/duration*Math.PI)*.5; } }
    if (mode.value === 'dash' && phase < Math.ceil(config.balance.dash.duration_seconds*hz)) { actor.dash_active = true; actor.dash_direction = facing; actor.dash_until_tick = tick-phase+Math.ceil(config.balance.dash.duration_seconds*hz); }
    if (mode.value === 'hit' && phase < 30) { c.stun_ticks = 30-phase; c.last_hit = { target_id: actor.id, tick: tick-phase, strong: false }; }
    if (mode.value === 'knockdown') {
      const k = config.balance.candidate_combat, duration = Math.ceil((k.knockdown_fall_seconds+k.knockdown_ground_seconds+k.knockdown_rise_seconds)*hz), age = tick%(duration+35);
      c.knockdown_tick = tick-age; c.stun_ticks = Math.max(0,duration-age); c.invulnerable_until_tick = c.knockdown_tick+duration;
    }
    if (mode.value === 'persuade') actor.persuasion_target_ids = ['preview-electeur'];
    if (mode.value === 'ko') { actor.is_ko = true; actor.ko_started_tick = tick-phase; }
    renderer.ctx.clearRect(0,0,canvas.width,canvas.height); drawIllustratedCharacter(renderer,actor,145,state);
  }
}
candidate.onchange = () => setup(); mode.onchange = () => { reset(); render(); };
document.querySelector('#play').onclick = event => { playing = !playing; event.target.textContent = playing ? 'Mettre en pause' : 'Animer'; };
document.querySelector('#direction').onclick = event => { facing *= -1; reset(); event.target.textContent = facing === 1 ? 'Tourner vers la gauche' : 'Tourner vers la droite'; render(); };
window.setMinorPreview = (scenario, seconds) => { playing = false; if (mode.value !== scenario) reset(); mode.value = scenario; elapsed = seconds; render(); };
await setup();
function animate(now) { if (playing && window.galleryReady) { elapsed += Math.min(.1, Math.max(0,now-previous)/1000); render(); } previous = now; requestAnimationFrame(animate); }
requestAnimationFrame(animate);
