import { airborne, diving, platformUnder } from './combat-actions.js';
import { aiNoise, aiSettings } from './ai-settings.js';

const gap = (a, b) => Math.max(0, Math.abs(a.x - b.x) - a.half_width - b.half_width);
const nearestSupport = (state, actor) => state.platforms.filter(p => p.height <= actor.combat.height + 0.01)
  .sort((a, b) => Math.abs(a.height - actor.combat.height) - Math.abs(b.height - actor.combat.height)
    || Math.max(0, Math.abs(a.x - actor.x) - a.half_width) - Math.max(0, Math.abs(b.x - actor.x) - b.half_width))[0];

/** Petit parcours entre plateformes : l’IA saute les trous, sans sol implicite. */
export function arenaNavigationCommands(state, config, actor, target) {
  if (state.fall_death_height == null) return null;
  const mine = state.platforms.find(p => p.id === actor.platform_id);
  const theirs = state.platforms.find(p => p.id === target.platform_id) || nearestSupport(state, target);
  const commands = axis => [{ type: 'SetCampaignActive', candidateId: actor.id, active: true }, { type: 'Move', candidateId: actor.id, axis }];
  if (airborne(actor)) {
    // En chute sous la scène, chercher une plateforme de secours encore accessible.
    if (actor.combat.height < 0) {
      const landing = state.platforms.filter(p => p.height <= actor.combat.height)
        .sort((a, b) => Math.max(0, Math.abs(a.x - actor.x) - a.half_width) - Math.max(0, Math.abs(b.x - actor.x) - b.half_width))[0];
      return commands(landing ? Math.sign(landing.x - actor.x) : 0);
    }
    return null;
  }
  if (!mine || !theirs || mine.id === theirs.id) return null;
  const jump = state.platform_jump, speed = config.prototype.movement.candidate_speed_units_per_second;
  const queue = [{ platform: mine, path: [] }], seen = new Set([mine.id]);
  let path = null;
  while (queue.length) {
    const current = queue.shift();
    if (current.platform.id === theirs.id) { path = current.path; break; }
    const neighbors = state.platforms.filter(p => {
      if (seen.has(p.id)) return false;
      const rise = p.height - current.platform.height;
      if (rise > jump.height * 0.92) return false;
      const airtime = jump.duration_seconds * (1 + Math.sqrt(1 - rise / jump.height)) / 2;
      return gap(current.platform, p) + 0.8 < speed * airtime;
    }).sort((a, b) => Math.abs(a.x - theirs.x) - Math.abs(b.x - theirs.x));
    for (const platform of neighbors) { seen.add(platform.id); queue.push({ platform, path: [...current.path, platform] }); }
  }
  const next = path?.[0];
  if (!next) return commands(0);
  if (actor.combat.stun_ticks || actor.combat.attack_id || actor.combat.press_tick != null || actor.dash_active) return commands(0);
  const direction = Math.sign(next.x - actor.x) || actor.facing;
  if (next.height < mine.height) {
    // Choisir un bord qui a réellement une plateforme sous lui, puis s’y laisser tomber.
    const edges = [-1, 1].map(side => mine.x + side * (mine.half_width + 0.3))
      .filter(x => Math.abs(x - next.x) < next.half_width - 0.2).sort((a, b) => Math.abs(a - target.x) - Math.abs(b - target.x));
    if (edges.length) return commands(Math.sign(edges[0] - actor.x));
  }
  // Sauter dès que la trajectoire prévue se pose sur la plateforme suivante.
  const jumpNow = predictLanding(state, config, actor, { axis: direction, jump: true })?.id === next.id;
  return [...commands(direction), ...(jumpNow ? [{ type: 'Jump', candidateId: actor.id }] : [])];
}

const tickRate = config => config.balance.simulation_architecture.fixed_tick_hz;
const over = (p, x, margin = 0) => Math.abs(x - p.x) <= p.half_width - margin;
// Rester un peu à l’intérieur : une bousculade entre corps ne doit pas suffire à tomber.
const EDGE_MARGIN = 0.2;

/**
 * Rejoue la physique des plateformes image par image, sans toucher à l’état :
 * renvoie la plateforme où l’on se retrouve debout (un peu à l’intérieur du bord),
 * ou null si l’on finit dans le vide ou au ras du bord.
 * axis : direction tenue ; jump : sauter maintenant ; dive : plonger maintenant (vers direction).
 */
export function predictLanding(state, config, actor, { axis = 0, jump = false, dive = false, direction = actor.facing, ticks = 2 } = {}) {
  const k = config.balance.candidate_combat, rate = tickRate(config), c = actor.combat;
  const total = Math.ceil(state.platform_jump.duration_seconds * rate - 1e-9), rise = state.platform_jump.height;
  const speed = config.prototype.movement.candidate_speed_units_per_second, decay = Math.max(0, 1 - k.knockback_decay_per_second / rate);
  let x = actor.x, height = c.height || 0, push = c.knockback_velocity || 0, stun = c.stun_ticks || 0;
  let grounded = !airborne(actor), base = c.jump_base ?? 0, elapsed = c.jump_tick != null ? state.tick - c.jump_tick : 0, ignore = c.drop_through_id ?? null;
  const dropping = dive || diving(actor), facing = dive ? direction : actor.facing;
  if (jump && grounded) { grounded = false; elapsed = 0; base = height; ignore = null; }
  const landing = previous => state.platforms.filter(p => p.id !== ignore && over(p, x) && previous >= p.height && height <= p.height)
    .sort((a, b) => b.height - a.height)[0];
  // Arriver contre un adversaire debout le repousse : compter ce décalage avant de juger le bord.
  const standing = () => {
    const p = platformUnder(state, x, height);
    if (!p) return null;
    const other = state.candidates.find(o => o.id !== actor.id && !o.is_ko && o.platform_id === p.id && Math.abs(o.x - x) < k.body_width);
    const spot = other ? x + (Math.sign(x - other.x) || -actor.facing) * (k.body_width - Math.abs(x - other.x)) : x;
    return over(p, spot, EDGE_MARGIN) ? p : null;
  };
  for (let i = 1; i <= 180; i++) {
    const previous = height;
    if (dropping) {
      // Coup plongeant : diagonale vers l’avant, sans contrôle ; on reste sur place à la réception.
      height -= k.dive_vertical_speed / rate; x += facing * k.dive_horizontal_speed / rate;
      if (landing(previous)) { height = landing(previous).height; return standing(); }
    } else {
      let started = false;
      if (grounded && !platformUnder(state, x, height)) { grounded = false; started = true; elapsed = Math.round(total / 2); base = height - rise; ignore = null; }
      if (!grounded) {
        if (!started) elapsed++;
        const t = elapsed / total;
        height = base + rise * 4 * t * (1 - t);
        // À la réception, le pas de cette image s’ajoute encore : on continue la simulation.
        const p = height < previous && landing(previous);
        if (p) { grounded = true; height = p.height; }
      }
    }
    if (height <= state.fall_death_height) return null;
    if (Math.abs(push) > 0.02) { x += push / rate; push *= decay; } else push = 0;
    if (stun > 0) stun--;
    else if (!dropping) x += axis * speed / rate;
    // Debout, sans recul : au-delà de cet horizon, l’IA aura décidé autre chose.
    if (grounded && i >= ticks && !push && !stun && platformUnder(state, x, height)) return standing();
  }
  return null;
}

const replaceMove = (commands, actor, axis) => [...commands.filter(c => c.type !== 'Move'), { type: 'Move', candidateId: actor.id, axis }];
const isAttack = c => c.type === 'Attack' || c.type === 'PressAttack';

/**
 * Dernier contrôle avant d’agir sur une arène à trous : l’IA ne marche, ne saute,
 * ne dash ni ne plonge vers le vide. Repoussée vers un bord, elle lutte contre le recul.
 */
export function fallSafeCommands(state, config, actor, commands) {
  if (state.fall_death_height == null || !state.platform_jump || diving(actor)) return commands;
  const safe = options => !!predictLanding(state, config, actor, options);
  const flying = airborne(actor), still = Math.abs(actor.combat.knockback_velocity) <= 0.02;
  const axis = commands.findLast(c => c.type === 'Move')?.axis ?? actor.axis ?? 0;
  let out = commands;
  if (out.some(c => c.type === 'Jump') && !flying && still && !safe({ axis, jump: true })) out = out.filter(c => c.type !== 'Jump');
  const dash = out.find(c => c.type === 'Dash');
  if (dash) {
    const own = state.platforms.find(p => p.id === actor.platform_id);
    if (flying || !own || !over(own, actor.x + (dash.direction || actor.facing) * config.balance.dash.distance, 0.3)) out = out.filter(c => c !== dash);
  }
  const attack = out.find(isAttack);
  if (flying && attack && !safe({ dive: true, direction: attack.direction || actor.facing })) out = out.filter(c => !isAttack(c));
  if (out.some(c => c.type === 'Jump') && !flying && still) return out;
  if (safe({ axis })) return out;
  // Direction voulue dangereuse : s’arrêter, ou repartir de l’autre côté (sans frapper, pour rester mobile).
  const choice = [0, -axis, 1, -1].find(a => safe({ axis: a }));
  if (choice != null) return replaceMove(flying ? out : out.filter(c => !isAttack(c)), actor, choice);
  // Rien ne sauve à coup sûr : viser la plateforme la plus proche encore accessible.
  const rescue = state.platforms.filter(p => p.height <= actor.combat.height + 0.01)
    .sort((a, b) => Math.max(0, Math.abs(a.x - actor.x) - a.half_width) - Math.max(0, Math.abs(b.x - actor.x) - b.half_width))[0];
  return rescue ? replaceMove(out.filter(c => !isAttack(c)), actor, Math.sign(rescue.x - actor.x)) : out;
}

const EDGE_SENSE = { Facile: 0.35, Normal: 0.7, Difficile: 0.9 };

/**
 * Le dernier coup d’un combo renverse et projette loin : celui qui a le vide dans le dos
 * au premier coup tombe. L’IA saute donc par-dessus un adversaire proche pour reprendre
 * le côté qui a le plus de sol derrière lui.
 */
export function edgeEscapeCommands(state, config, actor, target) {
  if (state.fall_death_height == null || !state.platform_jump || airborne(actor) || airborne(target)) return null;
  if (!actor.platform_id || actor.platform_id !== target.platform_id || actor.combat.stun_ticks || actor.combat.attack_id
    || actor.combat.press_tick != null || actor.dash_active || Math.abs(actor.combat.knockback_velocity) > 0.02) return null;
  const own = state.platforms.find(p => p.id === actor.platform_id);
  const toward = Math.sign(target.x - actor.x) || actor.facing;
  // Sol restant derrière soi, et derrière l’adversaire une fois passé de l’autre côté.
  const behind = own.half_width + (actor.x - own.x) * toward, beyond = own.half_width - (target.x - own.x) * toward;
  const k = config.balance.candidate_combat, knockback = k.finisher_knockback / k.knockback_decay_per_second;
  if (Math.abs(target.x - actor.x) > 2.6 || behind > knockback + 0.3 || beyond <= behind + 0.5) return null;
  // Seul un bord sans plateforme de secours en dessous est un vrai danger.
  const edge = { ...actor, x: own.x - toward * (own.half_width + 0.05), combat: { ...actor.combat, knockback_velocity: 0, stun_ticks: 0 } };
  if (predictLanding(state, config, edge)) return null;
  const period = Math.floor(state.tick / Math.max(1, Math.round(tickRate(config) * 0.5)));
  if (aiNoise(state.seed, `${actor.id}:edge:${period}`) >= (EDGE_SENSE[aiSettings(state, config).label] ?? EDGE_SENSE.Normal)) return null;
  if (predictLanding(state, config, actor, { axis: toward, jump: true })?.id !== own.id) return null;
  return [{ type: 'SetCampaignActive', candidateId: actor.id, active: true }, { type: 'Move', candidateId: actor.id, axis: toward }, { type: 'Jump', candidateId: actor.id }];
}
