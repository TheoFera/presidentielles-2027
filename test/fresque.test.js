import { test } from 'node:test';
import assert from 'node:assert/strict';
import { config as base } from '../scripts/game-config.mjs';
import { GameSimulation } from '../src/simulation/game-simulation.js';
import { PLANE_ORDER, SITE_STYLES, fresqueScene } from '../src/presentation/world-v3/fresque/scene.js';
import { signRect } from '../src/presentation/world-v3/fresque/sites.js';
import { solAt } from '../src/presentation/world-v3/fresque/sol.js';
import * as paris from '../src/presentation/world-v3/fresque/paris.js';
import * as banlieue from '../src/presentation/world-v3/fresque/banlieue.js';
import * as periurbain from '../src/presentation/world-v3/fresque/periurbain.js';
import * as campagne from '../src/presentation/world-v3/fresque/campagne.js';
import * as littoral from '../src/presentation/world-v3/fresque/littoral.js';
import * as beaux from '../src/presentation/world-v3/fresque/beaux.js';
import * as lointain from '../src/presentation/world-v3/fresque/lointain.js';
import * as paysage from '../src/presentation/world-v3/fresque/paysage.js';
import * as perspective from '../src/presentation/world-v3/fresque/perspective.js';
import * as villas from '../src/presentation/world-v3/fresque/villas.js';

const sim = new GameSimulation(structuredClone(base), 42);
const { world, buildings } = sim.state;
const scene = fresqueScene(world, buildings);
const OPEN = new Set(['jardinVilla', 'place', 'pelouseCite', 'champ', 'pre', 'quai', 'promenade', 'lisiereBois', 'terrainVague', 'haie', 'haieBocage', 'marche', 'rondPoint', 'jardinLotissement', 'escalier']);
const PAINTERS = new Set(['site', 'terrain', 'sea', 'chaine', 'lisiere', ...[paris, banlieue, periurbain, campagne, littoral, beaux, lointain, paysage, perspective, villas].flatMap(m => Object.keys(m))]);

test('Fresque : tout est dessiné par le code, chaque élément a son peintre', () => {
  for (const plane of PLANE_ORDER) for (const e of scene.planes[plane]) {
    assert.ok(PAINTERS.has(e.kind), `peintre manquant : ${e.kind}`);
    assert.notEqual(e.kind, 'img', 'plus aucune image peinte mélangée au dessin');
  }
});

test('Fresque : chaque bâtiment du jeu a sa devanture et son panneau, à sa vraie position', () => {
  for (const building of buildings.filter(b => b.type !== 'meeting')) {
    assert.ok(SITE_STYLES[building.site_id], `style manquant : ${building.site_id}`);
    assert.equal(scene.sites[building.site_id].x, building.x);
    const sign = signRect(SITE_STYLES[building.site_id].w * 40);
    assert.ok(sign.w >= 90 && sign.h >= 20, 'panneau assez grand pour le nom du bâtiment');
  }
});

test('Fresque : la rue est continue, sans bâtiments qui se chevauchent, places de meeting ouvertes', () => {
  const items = scene.planes.street.filter(e => e.w).map(e => ({ kind: e.kind, a: e.x - e.w / 2, b: e.x + e.w / 2, open: OPEN.has(e.kind) })).sort((p, q) => p.a - q.a);
  const solid = items.filter(i => !i.open);
  for (let i = 1; i < solid.length; i++) assert.ok(solid[i].a >= solid[i - 1].b - 0.05, `${solid[i - 1].kind} chevauche ${solid[i].kind} vers x = ${solid[i].a.toFixed(1)}`);
  let reach = -0.3;
  for (const item of items) { assert.ok(item.a <= reach + 0.3, `trou dans la rue vers x = ${reach.toFixed(1)}`); reach = Math.max(reach, item.b); }
  assert.ok(reach >= world.length - 0.5, 'la rue fait le tour complet de la carte');
  for (const meeting of buildings.filter(b => b.type === 'meeting'))
    assert.ok(solid.every(i => i.b < meeting.x - 3 || i.a > meeting.x + 3), `bâtiment sur la place de meeting de ${meeting.subzone_id}`);
});

test('Fresque : métiers de bouche, barbecue, tours isolées et repères du storyboard', () => {
  const shops = scene.planes.street.flatMap(e => e.p.shops || []);
  for (const shop of ['boulangerie', 'fromagerie', 'boucherie']) assert.ok(shops.includes(shop), shop);
  assert.equal(scene.barbecues.length, 1);
  const kinds = new Set(PLANE_ORDER.flatMap(p => scene.planes[p].map(e => e.kind)));
  for (const kind of ['massif', 'chaine', 'ruePerspective', 'butteMontmartre', 'entrepotGeant', 'villaBourgeoise', 'mosquee', 'sea', 'rondPoint', 'mairie', 'monumentMorts', 'serres', 'caravanes', 'kiosque', 'laDefense', 'basilique', 'plage', 'passerelle', 'metroAerien', 'tourEiffel', 'maisonLotissement', 'boulodrome'])
    assert.ok(kinds.has(kind), kind);
  // Les tours de cité ne sont jamais collées à un autre immeuble : pelouse ou parking de chaque côté.
  const street = scene.planes.street.filter(e => e.w).map(e => ({ kind: e.kind === 'site' ? e.p.style : e.kind, a: e.x - e.w / 2, b: e.x + e.w / 2 })).sort((p, q) => p.a - q.a);
  street.forEach((e, i) => { if (e.kind === 'tour' || e.kind === 'tourCite') for (const n of [street[i - 1], street[i + 1]]) assert.ok(['pelouseCite'].includes(n.kind), `tour collée à ${n.kind}`); });
  // Campagne C : presque rien au premier plan, en dehors du local et des champs.
  const campagneC = scene.planes.street.filter(e => e.x > 266 && e.x < 288 && e.w && !['champ', 'haieBocage', 'site'].includes(e.kind));
  assert.deepEqual(campagneC.map(e => e.kind), []);
});

test('Fresque : aucun véhicule dans le décor, villas toutes différentes, repères dans leur sous-zone', () => {
  const kinds = PLANE_ORDER.flatMap(p => scene.planes[p].map(e => e.kind));
  for (const vehicle of ['voiture', 'berline', 'campingCar', 'tracteur']) assert.ok(!kinds.includes(vehicle), vehicle);
  const villasC = scene.planes.street.filter(e => e.kind === 'villaBourgeoise').map(e => e.p.variant);
  assert.equal(new Set(villasC).size, villasC.length, 'chaque villa bourgeoise est unique');
  const at = (plane, kind) => scene.planes[plane].find(e => e.kind === kind).x;
  assert.ok(at('back', 'basilique') > 96 && at('back', 'basilique') < 120, 'basilique derrière le marché de Banlieue B');
  assert.ok(at('back', 'mosquee') > 120 && at('back', 'mosquee') < 144, 'mosquée en Banlieue C');
  assert.ok(at('back', 'entrepotGeant') > 144 && at('back', 'entrepotGeant') < 168, 'entrepôt en Périurbain A');
  const perspectives = scene.planes.street.filter(e => e.kind === 'ruePerspective').map(e => e.p.kind).sort();
  assert.deepEqual(perspectives, ['defense', 'escalier', 'montmartre', 'saintdenis']);
});

test('Fresque : aucun arbre devant une devanture du jeu', () => {
  for (const tree of scene.trees) for (const b of buildings.filter(b => b.type !== 'meeting')) assert.ok(Math.abs(b.x - tree.x) >= 3.8, `arbre à ${tree.x} devant ${b.site_id}`);
});

test('Fresque : le sol change de matière en douceur et boucle sans raccord', () => {
  assert.equal(solAt(10).key, 'paris');
  assert.equal(solAt(325).key, 'mer');
  assert.equal(solAt(431.9).walk, solAt(-0.1).walk);
  assert.notEqual(solAt(73).walk, solAt(70).walk, 'transition progressive Paris → banlieue');
});
