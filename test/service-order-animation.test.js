import test from 'node:test';
import assert from 'node:assert/strict';
import { SERVICE_ORDER_VARIANTS, serviceOrderVariant, serviceOrderAssetId, serviceOrderPose } from '../src/presentation/personnages/service-order-sprites.js';
import { SERVICE_ORDER_ATLASES } from '../src/presentation/personnages/service-order-atlases.js';
import { visualManifest } from '../src/presentation/rendu/visual-manifest.js';
import { GameSimulation } from '../src/simulation/game-simulation.js';
import { combatState, canBeHit } from '../src/simulation/combat-state.js';
import { startNpcAttack, beginCombatTick, updateCombat } from '../src/simulation/combat.js';
import { updateGuard, updateRaidRecruit, updateGuardRecruitment, startRaid } from '../src/simulation/military.js';
import { captureSite, updateStrategicSites, neutralizeSite } from '../src/simulation/strategic-sites.js';
import { npcGender } from '../src/simulation/npc-appearance.js';
import { convertNeutral } from '../src/simulation/npc-votes.js';
import { SERVICE_ORDER_STYLES } from '../src/simulation/service-order-rules.js';
import { campaignConfig } from '../scripts/validate-campaign.mjs';
import { ringDelta } from '../src/simulation/world.js';
import { readPng } from '../scripts/lib/png.mjs';
import { isolateMinorFigure } from '../src/presentation/personnages/minor-sprite-images.js';
import { measureMinorSprites } from '../scripts/outils-images/measure-minor-sprites.mjs';

const guard = (id = 'npc:10', faction_id = 'melenchon') => ({ id, faction_id, role: 'SERVICE_D_ORDRE', moving: false, combat: combatState() });
const state = () => ({ tick: 120, attacks: [], buildings: [{ id: 'local', owner_id: 'le_pen', state: 'ACTIVE' }] });

function defenseScene(faction = 'melenchon') {
  const sim = new GameSimulation(campaignConfig(), 42);
  sim.state.ai_enabled = false;
  for (const candidate of sim.state.candidates) { candidate.x = 12; candidate.campaign_active = false; }
  const local = sim.state.buildings.find(b => b.type === 'faction' && b.fixed_variant === 'service_ordre');
  const candidate = sim.state.candidates.find(c => c.faction_id === faction);
  return { sim, local, candidate };
}

function supporters(sim, local, faction, count = 3) {
  return sim.state.npcs.slice(0, count).map((npc, i) => {
    convertNeutral(sim, npc, faction);
    npc.x = local.x + 2 + i; npc.task = null;
    if (i === 1) { npc.role = 'MILITANT'; npc.donation_cents = 0; npc.next_donation_tick = null; }
    return npc;
  });
}

test('Garde : trois soutiens proches passent par le local, conservent leur sexe et reçoivent trois tenues différentes', () => {
  for (const faction of ['melenchon', 'le_pen']) {
    const { sim, local, candidate } = defenseScene(faction);
    const recruits = supporters(sim, local, faction), population = sim.state.npcs.length;
    const genders = recruits.map(n => npcGender(n, sim.state));
    captureSite(sim, local, candidate);
    assert.equal(recruits.filter(n => n.task?.kind === 'JOIN_GUARD').length, 3);
    assert.ok(recruits.every(n => n.role !== 'SERVICE_D_ORDRE'));
    let inside = false;
    for (let t = 0; t < sim.secondsToTicks(7); t++) {
      for (const n of recruits) if (n.task?.kind === 'JOIN_GUARD') { updateRaidRecruit(sim, n); inside ||= n.task?.phase === 'INSIDE'; }
      sim.state.tick++;
    }
    assert.ok(inside);
    assert.equal(sim.state.npcs.length, population);
    assert.ok(recruits.every(n => n.role === 'SERVICE_D_ORDRE' && !n.raid));
    assert.deepEqual(recruits.map(n => n.so_assignment.gender), genders);
    assert.equal(new Set(recruits.map(n => n.so_assignment.style)).size, 3);
    for (const n of recruits) assert.ok(SERVICE_ORDER_STYLES[faction].DEFENSE.some(style => serviceOrderVariant(n).startsWith(style + '-')));
    const restored = new GameSimulation(sim.config, 42);
    restored.importSnapshot(sim.exportSnapshot());
    assert.deepEqual(restored.state.npcs.map(n => n.so_assignment), sim.state.npcs.map(n => n.so_assignment));
  }
});

test('Garde : les places manquantes attendent des soutiens locaux, sans recruter à l’autre bout de la carte', () => {
  const { sim, local, candidate } = defenseScene();
  const [first, second, far] = supporters(sim, local, candidate.faction_id);
  second.x = far.x = 12;
  captureSite(sim, local, candidate);
  assert.equal(first.task?.kind, 'JOIN_GUARD');
  assert.equal(local.guard_recruitment.slots.length, 2);
  second.x = local.x + 2;
  updateGuardRecruitment(sim);
  assert.equal(second.task?.kind, 'JOIN_GUARD');
  assert.equal(far.task, null);
  assert.equal(local.guard_recruitment.slots.length, 1);
  neutralizeSite(sim, local);
  updateRaidRecruit(sim, first);
  assert.equal(first.task, null);
  assert.equal(first.role, 'SYMPATHISANT');
});

test('Garde : parcours complet dans la boucle du jeu et sauvegardes pendant le recrutement puis au poste', () => {
  const { sim, local, candidate } = defenseScene();
  const recruits = supporters(sim, local, candidate.faction_id);
  captureSite(sim, local, candidate);
  const restored = new GameSimulation(sim.config, 42);
  restored.importSnapshot(sim.exportSnapshot());
  let inside = false;
  for (let t = 0; t < sim.secondsToTicks(8); t++) {
    sim.step(); restored.step();
    inside ||= recruits.some(n => n.task?.phase === 'INSIDE');
  }
  assert.ok(inside);
  assert.ok(recruits.every(n => n.role === 'SERVICE_D_ORDRE' && !n.raid && n.task.kind === 'GUARD'));
  assert.deepEqual(restored.state, sim.state);
  restored.importSnapshot(sim.exportSnapshot());
  // Les trois places ont été attribuées une seule fois : aucune quatrième recrue.
  const extra = sim.state.npcs[4]; convertNeutral(sim, extra, candidate.faction_id); extra.x = local.x;
  updateGuardRecruitment(sim);
  assert.notEqual(extra.task?.kind, 'JOIN_GUARD');
});

test('Garde : les trois gardes restent groupés au local SO même si plusieurs quartiers sont tenus', () => {
  const { sim, local, candidate } = defenseScene();
  const sites = sim.state.buildings.filter(b => b.controls_zone && b.biome_id === local.biome_id);
  for (const site of sites) captureSite(sim, site, candidate);
  const recruits = supporters(sim, local, candidate.faction_id);
  for (const n of recruits) Object.assign(n, { role: 'SERVICE_D_ORDRE', guard_biome_id: local.biome_id, guard_anchor_x: local.x, raid: null });
  for (const n of recruits) updateGuard(sim, n);
  assert.equal(new Set(recruits.map(n => n.task.destination_x.toFixed(6))).size, 3);
  assert.ok(recruits.every(n => Math.abs(n.task.destination_x - local.x) < 2.1));
  neutralizeSite(sim, sites[0]);
  for (const n of recruits) updateGuard(sim, n);
  assert.ok(recruits.every(n => n.task.destination_subzone_id !== sites[0].subzone_id));
  assert.ok(recruits.every(n => !n.raid && !n.pressure_target_id));
});

test('Garde : intervention contre un intrus, arrêt à la frontière et retour au poste ; les sympathisants sont ignorés', () => {
  const { sim, local, candidate } = defenseScene();
  captureSite(sim, local, candidate);
  const n = sim.state.npcs[0], intruder = sim.state.candidates.find(c => c.faction_id === 'le_pen');
  Object.assign(n, guard(n.id), { x: local.x, guard_biome_id: local.biome_id, guard_anchor_x: local.x });
  intruder.x = n.x + 4;
  updateGuard(sim, n);
  assert.equal(n.combat.target_id, null, 'une simple présence sans affrontement ne vide pas le poste');
  intruder.combat.engaged = true;
  updateGuard(sim, n);
  assert.equal(n.combat.target_id, intruder.id);
  assert.equal(n.task.phase, 'DEFEND');
  intruder.x = 12;
  const neutral = sim.state.npcs[1];
  Object.assign(neutral, { role: 'SYMPATHISANT', faction_id: 'le_pen', x: n.x + 1 });
  updateGuard(sim, n);
  assert.equal(n.combat.target_id, null);
  assert.ok(['POST', 'RETURN'].includes(n.task.phase));
  const zone = sim.state.world.subzones.find(z => z.id === local.subzone_id);
  n.x = zone.end - 1; intruder.x = zone.end + .1;
  updateGuard(sim, n);
  assert.equal(n.combat.target_id, null, 'le candidat a quitté le quartier tenu');
  n.x = local.x;
  Object.assign(neutral, { role: 'MILITANT', x: n.x + 2 }); neutral.combat.engaged = true;
  updateGuard(sim, n);
  assert.equal(n.combat.target_id, neutral.id);
  Object.assign(local, { state: 'NEUTRAL', owner_id: null });
  updateGuard(sim, n);
  assert.equal(n.combat.target_id, null, 'le quartier perdu ne peut plus être défendu');
});

test('Garde : petits pas entrecoupés d’attente près du local, puis retour dans le même périmètre après le calme', () => {
  const { sim, local, candidate } = defenseScene();
  captureSite(sim, local, candidate);
  const n = sim.state.npcs[0], intruder = sim.state.candidates.find(c => c.faction_id === 'le_pen');
  Object.assign(n, guard(n.id), { x: local.x, source_site_id: local.id, guard_biome_id: local.biome_id, guard_anchor_x: local.x });
  let waiting = 0, steps = 0, positions = new Set();
  for (let t = 0; t < 900; t++) {
    sim.state.tick++; updateGuard(sim, n);
    if (n.moving) steps++; else waiting++;
    positions.add(n.x.toFixed(2));
    assert.ok(Math.abs(n.x - local.x) < .4);
  }
  assert.ok(waiting > steps * 4 && steps > 0 && positions.size > 3, 'Le garde attend surtout, mais change parfois d’appui à petits pas.');
  intruder.x = n.x + 4; intruder.combat.last_hit = { tick: sim.state.tick };
  updateGuard(sim, n);
  assert.equal(n.task.phase, 'DEFEND'); assert.ok(n.x > local.x);
  sim.state.tick += sim.secondsToTicks(sim.config.balance.physical_units.service_ordre.defense_calm_seconds) + 1;
  for (let t = 0; t < 60; t++) { sim.state.tick++; updateGuard(sim, n); }
  assert.equal(n.combat.target_id, null); assert.ok(['POST', 'RETURN'].includes(n.task.phase));
  assert.ok(Math.abs(n.x - local.x) < .4);
});

test('Garde : aucune pression ni animation de casse, même si une ancienne cible de bâtiment reste renseignée', () => {
  const { sim, local, candidate } = defenseScene();
  captureSite(sim, local, candidate);
  const n = sim.state.npcs[0], enemy = sim.state.buildings.find(b => b.controls_zone && b.biome_id !== local.biome_id);
  captureSite(sim, enemy, sim.state.candidates.find(c => c.faction_id === 'le_pen'));
  Object.assign(n, guard(n.id), { x: local.x, guard_biome_id: local.biome_id, guard_anchor_x: local.x, pressure_target_id: enemy.id });
  assert.notEqual(serviceOrderPose(n, sim.state, sim.hz).mode, 'building');
  updateStrategicSites(sim);
  assert.equal(enemy.hostile_pressure, 0);
  updateGuard(sim, n);
  assert.equal(n.pressure_target_id, null);
  assert.ok(!n.raid);
});

test('SO : une mêlée conserve des places séparées et chaque membre prend le relais', () => {
  for (const raid of [false, true]) {
    const { sim, local, candidate } = defenseScene();
    captureSite(sim, local, candidate);
    const guards = sim.state.npcs.slice(0, 3);
    for (const [i, n] of guards.entries()) Object.assign(n, guard(n.id), {
      x: local.x - i * 1.5, guard_biome_id: local.biome_id, guard_anchor_x: local.x, hidden_durability: 90,
      raid: raid ? { id: 'test', phase: 'OUTBOUND', direction: 1 } : null,
    });
    const rival = sim.state.candidates.find(c => c.faction_id === 'le_pen');
    rival.hidden_durability = 100000;
    const hits = new Set(), sides = new Set(); let settled = 0;
    for (let tick = 0; tick < 600; tick++) {
      sim.state.tick++; beginCombatTick(sim);
      rival.x = local.x + 5; rival.combat.engaged = true;
      for (const n of guards) updateGuard(sim, n);
      for (const attack of sim.state.attacks) if (guards.some(n => n.id === attack.owner_id)) hits.add(attack.owner_id);
      if (tick > 120 && guards.every(n => !n.moving)) {
        settled++;
        const xs = guards.map(n => n.x).sort((a, b) => a - b);
        assert.ok(xs[1] - xs[0] > .8 && xs[2] - xs[1] > .8, 'Les trois combattants ne se fondent pas dans une seule silhouette.');
        for (const n of guards) sides.add(Math.sign(ringDelta(rival.x, n.x, sim.state.world.length)));
      }
      updateCombat(sim);
    }
    assert.ok(settled > 30, 'Le placement doit laisser de vrais moments de frappe et d’attente.');
    assert.equal(hits.size, 3, 'Le troisième membre prend aussi le relais.');
    assert.equal(sides.size, 2, 'Les combattants occupent les deux côtés de l’adversaire.');
  }
});

test('Raid : les trois coups de pied sont espacés par des pauses et ne partent pas à l’unisson', () => {
  const s = state(), guards = Array.from({ length: 3 }, (_, i) => ({ ...guard('npc:' + i), raid: { id: 'test' }, pressure_target_id: 'local' }));
  const kicked = new Set(); let mixed = 0, paused = 0;
  for (let tick = 0; tick < 180; tick++) {
    s.tick = tick;
    const poses = guards.map(n => serviceOrderPose(n, s, 30));
    poses.forEach((p, i) => { if (p.frame === 5) kicked.add(i); if (p.frame === 0) paused++; });
    if (new Set(poses.map(p => p.frame)).size > 1) mixed++;
  }
  assert.equal(kicked.size, 3); assert.ok(mixed > 80 && paused > 180);
});

test('Raid : une bande reste proche avec des écarts irréguliers et variables, sans croisement, même autour de la carte', () => {
  for (const direction of [-1, 1]) {
    const sim = new GameSimulation(campaignConfig(), 42), state = sim.state, length = state.world.length;
    state.buildings = []; state.candidates = []; state.temporary_units = [];
    const origin = direction > 0 ? length - 2 : 2;
    state.npcs = Array.from({ length: 3 }, (_, i) => ({ ...guard('npc:' + i),
      x: (origin + direction * i * .8 + length) % length, facing: direction,
      raid: { id: 'test', phase: 'OUTBOUND', direction },
    }));
    const replay = new GameSimulation(sim.config, 42); replay.state = structuredClone(state);
    const gaps = [[], []]; let different = 0;
    for (let tick = 0; tick < 900; tick++) {
      state.tick++; replay.state.tick++;
      const before = state.npcs.map(n => n.x);
      for (const n of state.npcs) updateGuard(sim, n);
      for (const n of replay.state.npcs) updateGuard(replay, n);
      for (let i = 0; i < 3; i++) {
        const step = ringDelta(before[i], state.npcs[i].x, length) * direction;
        assert.ok(step >= -1e-8 && step <= sim.config.balance.physical_units.service_ordre.move_speed / sim.hz + 1e-8);
      }
      if (tick > 90) {
        const a = ringDelta(state.npcs[0].x, state.npcs[1].x, length) * direction;
        const b = ringDelta(state.npcs[1].x, state.npcs[2].x, length) * direction;
        assert.ok(a >= 1.079 && b >= 1.079 && a + b < 4.1, 'Le trio reste compact et chaque silhouette garde sa place.');
        gaps[0].push(a); gaps[1].push(b);
        if (Math.abs(a - b) > .08) different++;
      }
    }
    assert.ok(different > 200, 'Le groupe ne retrouve pas deux intervalles identiques.');
    assert.ok(gaps.every(values => Math.max(...values) - Math.min(...values) > .12), 'Les distances varient pendant la marche.');
    assert.deepEqual(replay.state, state, 'Le même déplacement est reproduit sur une autre simulation.');
  }
});

test('Garde : près d’une frontière, les trois combattants restent espacés du côté autorisé', () => {
  const { sim, local, candidate } = defenseScene(); captureSite(sim, local, candidate);
  const zone = sim.state.world.subzones.find(z => z.id === local.subzone_id), guards = sim.state.npcs.slice(0, 3);
  for (const [i, n] of guards.entries()) Object.assign(n, guard(n.id), {
    x: zone.end - 4 - i * 1.3, guard_biome_id: local.biome_id, guard_anchor_x: local.x, hidden_durability: 90,
  });
  const rival = sim.state.candidates.find(c => c.faction_id === 'le_pen'); rival.hidden_durability = 100000;
  let settled = 0;
  for (let tick = 0; tick < 360; tick++) {
    sim.state.tick++; beginCombatTick(sim); rival.x = zone.end - .15; rival.combat.engaged = true;
    for (const n of guards) updateGuard(sim, n);
    assert.ok(guards.every(n => n.x < zone.end && n.x >= zone.start));
    if (tick > 120 && guards.every(n => !n.moving)) {
      settled++; const xs = guards.map(n => n.x).sort((a, b) => a - b);
      assert.ok(xs[1] - xs[0] > .9 && xs[2] - xs[1] > .9);
    }
    updateCombat(sim);
  }
  assert.ok(settled > 10);
});

test('Raid : un pas sur le côté de la façade ne fait pas abandonner le bâtiment en cours', () => {
  const { sim, local } = defenseScene(); sim.state.tick = 600; sim.state.candidates = [];
  Object.assign(local, { owner_id: 'le_pen', state: 'ACTIVE', headquarters: false }); sim.state.buildings = [local];
  sim.state.npcs = ['npc:0', 'npc:1', 'npc:18'].map((id, i) => ({ ...guard(id),
    x: local.x + (i === 2 ? 1.59 : i - 1), facing: 1, guard_anchor_x: local.x - 5,
    raid: { id: 'test', phase: 'OUTBOUND', direction: 1 },
    task: { kind: 'GUARD', phase: 'PRESSURE', target_id: local.id },
  }));
  let reached = false;
  for (let tick = 0; tick < 60; tick++) {
    for (const n of sim.state.npcs) updateGuard(sim, n);
    reached ||= sim.state.npcs[2].x - local.x > 1.6;
    assert.ok(sim.state.npcs.every(n => n.task.target_id === local.id && n.task.phase === 'PRESSURE'));
    sim.state.tick++;
  }
  assert.ok(reached); assert.equal(sim.state.npcs[2].pressure_target_id, local.id);
});

test('Garde : un coup déjà préparé ne touche ni un sympathisant ni un adversaire sorti du territoire', () => {
  const { sim, local, candidate } = defenseScene();
  captureSite(sim, local, candidate);
  const n = sim.state.npcs[0], rival = sim.state.candidates.find(c => c.faction_id === 'le_pen');
  const zone = sim.state.world.subzones.find(z => z.id === local.subzone_id);
  Object.assign(n, guard(n.id), { x: zone.end - .5, facing: 1, guard_biome_id: local.biome_id, guard_anchor_x: local.x });
  rival.x = zone.end - .1;
  startNpcAttack(sim, n, 'GUARD', { range: 1.6, damage: 9, cooldown_seconds: .9 });
  assert.equal(sim.state.attacks.length, 1);
  rival.x = zone.end + .1;
  const bystander = sim.state.npcs[1];
  Object.assign(bystander, { role: 'SYMPATHISANT', faction_id: rival.faction_id, x: n.x + .1, hidden_durability: 30 });
  const before = rival.hidden_durability;
  for (let tick = 0; tick < 30; tick++) { sim.state.tick++; beginCombatTick(sim); updateCombat(sim); }
  assert.equal(rival.hidden_durability, before);
  assert.equal(bystander.hidden_durability, 30);
  bystander.task = { kind: 'JOIN_GUARD', phase: 'INSIDE' };
  assert.equal(canBeHit(bystander), false, 'la recrue à l’intérieur du local est hors du combat');
});

test('Raid : trois recrues distinctes de la garde, trois tenues cagoulées et sexe conservé', () => {
  const { sim, local, candidate } = defenseScene('le_pen');
  const recruits = supporters(sim, local, candidate.faction_id, 7);
  // Le raid conserve son recrutement parmi les sympathisants.
  recruits[1].role = 'SYMPATHISANT';
  captureSite(sim, local, candidate);
  assert.equal(startRaid(sim, local, candidate.faction_id, 1), 3);
  const raiders = recruits.filter(n => n.task?.kind === 'JOIN_RAID');
  const genders = raiders.map(n => npcGender(n, sim.state));
  assert.equal(recruits.filter(n => n.task?.kind === 'JOIN_GUARD').length, 3);
  for (let t = 0; t < sim.secondsToTicks(8); t++) {
    for (const n of recruits) if (['JOIN_RAID', 'JOIN_GUARD'].includes(n.task?.kind)) updateRaidRecruit(sim, n);
    sim.state.tick++;
  }
  assert.deepEqual(raiders.map(n => n.so_assignment.gender), genders);
  assert.equal(new Set(raiders.map(n => n.so_assignment.style)).size, 3);
  for (const n of raiders) assert.ok(SERVICE_ORDER_STYLES.le_pen.RAID.some(style => serviceOrderVariant(n).startsWith(style + '-')));
});

test('SO : les découpes isolées retirent les fragments voisins, même sur l’ancienne planche punk', () => {
  const atlas = SERVICE_ORDER_ATLASES['melenchon-antifa-2-h'];
  assert.equal(atlas.isolated, true, 'Le rendu doit employer les découpes isolées.');
  // Conserver la vraie planche qui reproduisait le défaut, même après le changement de tenue.
  const image = readPng(new URL('../assets/images/secondaires/so/melenchon-antifa-2-h-v1.png', import.meta.url));
  const original = measureMinorSprites(image, { count: 6, columns: 3, koFrames: [] });
  const [sx, sy, width, height] = original.frames[4];
  const pixels = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const source = ((sy + y) * image.width + sx + x) * 4;
    const target = (y * width + x) * 4;
    pixels.set(image.data.subarray(source, source + 4), target);
    // Même seuil que la préparation des images : les halos faibles ne relient pas les poses.
    if (pixels[target + 3] < 90) pixels[target + 3] = 0;
  }
  const shoePixels = () => {
    let count = 0;
    for (let y = 0; y < 4; y++) for (let x = 0; x < 100; x++) if (pixels[(y * width + x) * 4 + 3]) count++;
    return count;
  };
  assert.ok(shoePixels() > 0, 'Le rectangle brut reproduit le morceau de chaussure observé.');
  isolateMinorFigure(pixels, width, height);
  assert.equal(shoePixels(), 0, 'La chaussure de la pose voisine doit disparaître.');
  let remaining = 0;
  for (let i = 3; i < pixels.length; i += 4) if (pixels[i]) remaining++;
  assert.ok(remaining > 60000, 'Le corps et les mains du personnage restent visibles.');
});

test('SO : douze identités stables par camp, six hommes et six femmes', () => {
  for (const faction of ['melenchon', 'le_pen']) {
    const variants = SERVICE_ORDER_VARIANTS[faction];
    assert.equal(variants.length, 12);
    assert.equal(variants.filter(id => id.endsWith('-h')).length, 6);
    assert.equal(variants.filter(id => id.endsWith('-f')).length, 6);
    const seen = new Set();
    for (let i = 0; i < 128; i++) {
      const actor = { ...guard(`npc:${i}`, faction), raid: i % 2 ? { id: 'test' } : null, so_assignment: { style: Math.floor(i / 4) % 3, gender: i % 4 < 2 ? 'h' : 'f' } };
      const variant = serviceOrderVariant(actor); seen.add(variant);
      assert.equal(serviceOrderVariant(structuredClone(actor)), variant);
      assert.ok(visualManifest[serviceOrderAssetId(actor)]);
    }
    assert.deepEqual([...seen].sort(), [...variants].sort());
  }
  assert.equal(serviceOrderVariant(guard('npc:1', 'philippe')), null);
  assert.equal(serviceOrderVariant({ ...guard(), role: 'MILITANT' }), null);
});

test('SO : le poing suit la préparation, l’activité et le retour du vrai coup', () => {
  const actor = guard(), s = state();
  const attack = { owner_id: actor.id, windup_ticks: 4, active_ticks: 3, elapsed_ticks: 0 };
  s.attacks = [attack];
  for (const [tick, frame] of [[0, 1], [3, 1], [4, 2], [6, 2], [7, 3], [10, 3]]) {
    attack.elapsed_ticks = tick;
    assert.deepEqual(serviceOrderPose(actor, s, 30), { frame, mode: 'punch' });
  }
  actor.combat.stun_ticks = 2;
  assert.equal(serviceOrderPose(actor, s, 30).mode, 'hurt');
  Object.assign(actor.combat, { knockdown_tick: 119, invulnerable_until_tick: 140 });
  assert.equal(serviceOrderPose(actor, s, 30).mode, 'ko');
});

test('SO : les coups de façade cessent en mouvement, en combat et dès la fermeture', () => {
  const actor = { ...guard(), raid: { id: 'test' }, pressure_target_id: 'local' }, s = state(), seen = new Set();
  for (let tick = 0; tick < 54; tick++) { s.tick = tick; seen.add(serviceOrderPose(actor, s, 30).frame); }
  assert.deepEqual([...seen].sort(), [0, 4, 5]);
  actor.moving = true; assert.equal(serviceOrderPose(actor, s, 30).mode, 'walk');
  actor.moving = false; actor.combat.engaged = true; assert.equal(serviceOrderPose(actor, s, 30).mode, 'ready');
  actor.combat.engaged = false; s.buildings[0].state = 'NEUTRAL'; assert.equal(serviceOrderPose(actor, s, 30).mode, 'idle');
  s.buildings[0].state = 'ACTIVE'; s.buildings[0].owner_id = 'melenchon'; assert.equal(serviceOrderPose(actor, s, 30).mode, 'idle');
  s.buildings = []; assert.equal(serviceOrderPose(actor, s, 30).mode, 'idle');
});

test('SO : le groupe rejoint trois places devant le bâtiment avant de le fermer', () => {
  const config = campaignConfig(), sim = new GameSimulation(config, 42), s = sim.state;
  const building = s.buildings.find(b => b.controls_zone && b.type !== 'meeting' && b.type !== 'institut_sondage');
  Object.assign(building, { state: 'ACTIVE', owner_id: 'le_pen', headquarters: false });
  s.buildings = [building]; s.candidates = []; s.temporary_units = [];
  const template = s.npcs[0];
  s.npcs = Array.from({ length: 3 }, (_, i) => ({ ...structuredClone(template), ...guard(`npc:${i}`),
    x: building.x - 3, facing: 1, guard_anchor_x: building.x - 5,
    raid: { id: 'test', phase: 'OUTBOUND', direction: 1 } }));
  // Le groupe doit rejoindre ses places avant de peser sur la fermeture.
  for (const npc of s.npcs) updateGuard(sim, npc);
  assert.ok(s.npcs.every(n => !n.pressure_target_id));
  for (let i = 0; i < 60; i++) { for (const npc of s.npcs) updateGuard(sim, npc); s.tick++; }
  assert.ok(s.npcs.every(n => n.pressure_target_id === building.id && !n.moving));
  assert.equal(new Set(s.npcs.map(n => n.facing)).size, 2, 'Le groupe se tourne vers la porte depuis ses différents côtés.');
  assert.equal(new Set(s.npcs.map(n => n.x)).size, 3);
  const offsets = s.npcs.map(n => ringDelta(building.x, n.x, s.world.length)).sort((a, b) => a - b);
  assert.ok(offsets[1] - offsets[0] > 1 && offsets[2] - offsets[1] > 1);
  for (let i = 0; i < sim.secondsToTicks(20) && building.state === 'ACTIVE'; i++) {
    for (const npc of s.npcs) updateGuard(sim, npc);
    updateStrategicSites(sim); s.tick++;
  }
  assert.notEqual(building.state, 'ACTIVE');
  assert.ok(s.npcs.every(n => serviceOrderPose(n, s, sim.hz).mode !== 'building'));
});

test('SO : vingt-quatre planches transparentes et six silhouettes entières par personnage', () => {
  assert.equal(Object.keys(SERVICE_ORDER_ATLASES).length, 24);
  for (const variants of Object.values(SERVICE_ORDER_VARIANTS)) for (const id of variants) {
    const atlas = SERVICE_ORDER_ATLASES[id];
    assert.equal(atlas.frames.length, 6);
    assert.equal(atlas.buildingMotion, 'kick', `${id} : aucun ancien geste de barre invisible`);
    const image = readPng(new URL(visualManifest[atlas.sprite].file));
    assert.equal(image.data[3], 0, `${id} : fond transparent`);
    for (const [x, y, w, h, px, py] of atlas.frames) {
      assert.ok(x > 0 && y > 0 && x + w < image.width && y + h < image.height, `${id} : silhouette entière`);
      assert.ok(px >= x && px <= x + w && py === y + h, `${id} : appui sous les chaussures`);
    }
    if (atlas.building) {
      const kicking = readPng(new URL(visualManifest[atlas.building.sprite].file));
      assert.equal(atlas.building.frames.length, 3, 'Attente étalon, genou, pied projeté');
      assert.ok(atlas.building.isolated);
      for (const [x, y, w, h] of atlas.building.frames) {
        assert.ok(x > 0 && y > 0 && x + w < kicking.width && y + h < kicking.height, `${id} : coup de pied entier`);
      }
    }
  }
});

test('SO : les coups de pied supplémentaires préservent les apparences syndicalistes et rurales', () => {
  const preserved = ['melenchon-cgt-h', 'melenchon-cgt-f', 'le-pen-rural-h', 'le-pen-rural-f'];
  for (const id of preserved) assert.ok(SERVICE_ORDER_ATLASES[id].building, id);
  for (const variants of Object.values(SERVICE_ORDER_VARIANTS)) for (const id of variants) {
    if (!preserved.includes(id)) assert.equal(SERVICE_ORDER_ATLASES[id].building, undefined);
  }
});
