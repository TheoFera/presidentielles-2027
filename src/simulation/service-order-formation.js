import { ringDelta, wrap } from './world.js';
import { stableIdOrder } from './territory.js';
import { defensiveGuard, guardDefendsPosition } from './service-order-rules.js';

/** Variations reproductibles : aucun hasard lié à la fréquence d'affichage. */
export function serviceOrderSeed(id) {
  let seed = 2166136261;
  for (const c of String(id)) seed = Math.imul(seed ^ c.charCodeAt(0), 16777619);
  seed ^= seed >>> 16; seed = Math.imul(seed, 0x7feb352d); seed ^= seed >>> 15;
  return seed >>> 0;
}

const fraction = id => serviceOrderSeed(id) / 4294967296;

/** Écarts inégaux, qui évoluent lentement et sans saut, entre les membres d'une bande. */
export function serviceOrderMarchOffsets(members, raid, tick, hz) {
  const offsets = [0];
  for (let i = 1; i < members.length; i++) {
    const key = `${raid.id}:${members[i - 1].id}:${members[i].id}:marche`;
    const clock = tick / hz / (5 + serviceOrderSeed(key) % 4) + fraction(key + ':phase');
    const epoch = Math.floor(clock), blend = (1 - Math.cos((clock - epoch) * Math.PI)) / 2;
    const first = fraction(key + ':' + epoch), next = fraction(key + ':' + (epoch + 1));
    const gap = 1.2 + .6 * (first + (next - first) * blend);
    offsets.push(offsets[i - 1] + gap);
  }
  const center = offsets.reduce((sum, x) => sum + x, 0) / offsets.length;
  return offsets.map(x => x - center);
}

/** Comme les militants : celui qui prend de l'avance ralentit pour garder le groupe proche. */
export function serviceOrderMarchSpeed(state, npc, members, settings, hz) {
  const direction = npc.raid.direction, origin = members[0].x;
  const ordered = members.slice().sort((a, b) => ringDelta(origin, a.x, state.world.length) * direction
    - ringDelta(origin, b.x, state.world.length) * direction || stableIdOrder(a, b));
  const index = ordered.indexOf(npc);
  const center = wrap(origin + ordered.reduce((sum, n) => sum + ringDelta(origin, n.x, state.world.length), 0) / ordered.length, state.world.length);
  const offsets = serviceOrderMarchOffsets(ordered, npc.raid, state.tick, hz);
  const ahead = ringDelta(center + direction * offsets[index], npc.x, state.world.length) * direction;
  let speed = settings.move_speed * Math.max(.15, Math.min(1, 1 - ahead / 1.4));
  const front = ordered[index + 1];
  if (front) {
    // Un retardataire rattrape son voisin sans jamais le traverser.
    const room = ringDelta(npc.x, front.x, state.world.length) * direction - 1.08;
    speed = Math.min(speed, Math.max(0, room * hz));
  }
  return speed;
}

/** Une petite place personnelle, changée seulement toutes les quelques secondes. */
export function serviceOrderPostOffset(npc, index, count, tick, hz) {
  const seed = serviceOrderSeed(npc.id), period = (6 + seed % 5) * hz;
  const epoch = Math.floor((tick + seed % period) / period);
  return (index - (count - 1) / 2) * 1.65 + (fraction(npc.id + ':place') - .5) * .25
    + (fraction(npc.id + ':attente:' + epoch) - .5) * .5;
}

/** Dispersion limitée devant la façade, avec de petits réajustements indépendants. */
export function serviceOrderFacadeOffset(npc, index, count, tick, hz) {
  const epoch = Math.floor((tick + serviceOrderSeed(npc.id) % (7 * hz)) / (7 * hz));
  return (index - (count - 1) / 2) * 1.4 + (fraction(npc.id + ':facade') - .5) * .32
    + (fraction(npc.id + ':pas:' + epoch) - .5) * .25;
}

/** Deux côtés libres pour frapper ; les suivants patientent et prennent le relais. */
export function serviceOrderCombatPlace(state, npc, target, settings, hz) {
  const members = state.npcs.filter(n => n.role === 'SERVICE_D_ORDRE' && n.faction_id === npc.faction_id
    && Math.abs(ringDelta(n.x, target.x, state.world.length)) <= Math.max(settings.candidate_focus_range, settings.defense_detection_range)
    && (!n.combat?.target_id || n.combat.target_id === target.id)).sort(stableIdOrder);
  const index = Math.max(0, members.indexOf(npc));
  const leader = members[0] || npc;
  const side = leader.task?.target_id === target.id && leader.task.combat_side
    || Math.sign(ringDelta(target.x, leader.x, state.world.length)) || -1;
  const countOnSide = Math.ceil((members.length - index % 2) / 2);
  const turn = Math.floor((state.tick / hz + fraction(target.id) * 2) / 2.8) % countOnSide;
  let rank = (Math.floor(index / 2) - turn + countOnSide) % countOnSide;
  let ownSide = index % 2 ? -side : side;
  const reach = settings.attack_range * (.76 + fraction(npc.id + ':portee') * .1);
  if (defensiveGuard(npc) && (!guardDefendsPosition(state, npc, wrap(target.x + side * reach, state.world.length))
    || !guardDefendsPosition(state, npc, wrap(target.x - side * reach, state.world.length)))) {
    // Près d'une frontière, un seul accès reste ouvert : chacun attend son tour à distance.
    ownSide = guardDefendsPosition(state, npc, wrap(target.x + side * reach, state.world.length)) ? side : -side;
    rank = (index - Math.floor(state.tick / hz / 2.8) % members.length + members.length) % members.length;
  }
  const gap = rank ? reach + rank * 1.5 : reach;
  let destination = wrap(target.x + ownSide * gap, state.world.length);
  if (defensiveGuard(npc) && !guardDefendsPosition(state, npc, destination)) destination = npc.x;
  return { index, side, destination, attacking: rank === 0 && Math.abs(ringDelta(destination, target.x, state.world.length)) <= settings.attack_range };
}

/** Un coup de pied, un retour d'appui, puis une pause propre à chaque personnage. */
export function serviceOrderKickCycle(npc, tick, hz) {
  const seed = serviceOrderSeed(npc.id), period = 1.35 + seed % 8 * .11;
  return (tick / hz + fraction(npc.id + ':frappe') * period) % period;
}
