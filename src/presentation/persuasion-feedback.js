// Retour visuel de la persuasion, sans texte :
// 1. au-dessus de la cible, le badge du camp se remplit comme une jauge ;
// 2. à la conversion, le PNJ sursaute, le badge éclate puis descend se fixer sur sa poitrine (le badge porté par les sympathisants).

const CREAM = '#fff5df';
const INK = '#263132';
const POP_END = 0.35;
const LAND_END = 0.7;

/** Avancement 0..1 de l'animation de conversion, ou null hors animation. */
export function conversionProgress(renderer, entity, state) {
  if (!(entity.converted_tick >= 0) || entity.role !== 'SYMPATHISANT') return null;
  const hz = renderer.config.balance.simulation_architecture.fixed_tick_hz;
  const t = (state.tick - entity.converted_tick) / Math.max(1, renderer.p.conversion_flash_seconds * hz);
  return t >= 0 && t < 1 ? t : null;
}

/** Petit bond du PNJ au moment où il se laisse convaincre (en pixels, vers le haut). */
export function conversionHop(progress, height) {
  return progress == null || progress >= POP_END ? 0 : Math.sin(progress / POP_END * Math.PI) * height * 0.07;
}

/** Le badge sur la poitrine n'apparaît qu'une fois le badge volant arrivé. */
export const conversionBadgeLanded = progress => progress == null || progress >= LAND_END;

function badge(ctx, x, y, r, color, fill = 1) {
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = CREAM; ctx.fill();
  if (fill > 0) {
    ctx.beginPath(); ctx.moveTo(x, y);
    ctx.arc(x, y, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, fill));
    ctx.closePath(); ctx.fillStyle = color; ctx.fill();
  }
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.strokeStyle = INK; ctx.lineWidth = 1.5; ctx.stroke();
}

function mark(renderer, entity) {
  const m = renderer.metrics;
  const saved = renderer.personMarks?.get(entity.id);
  if (!saved) return null;
  const height = saved.height ?? m.characterHeight * (entity.role === 'CANDIDAT' ? 1 : renderer.p.npc_height_multiplier);
  return { feetY: m.groundY + m.characterHeight * 0.06, ...saved, height };
}

export function drawPersuasionFeedback(renderer, state) {
  const { ctx, p } = renderer;
  const time = state.tick / renderer.config.balance.simulation_architecture.fixed_tick_hz;
  ctx.save();
  for (const npc of state.npcs) {
    const target = mark(renderer, npc);
    if (!target) continue;
    const r = Math.max(9, Math.round(target.height * 0.1));
    const headY = target.feetY - target.height - r - 6;
    if (npc.persuasion) {
      const actor = [...state.candidates, ...state.npcs].find(c => c.id === npc.persuasion.actor_id);
      const color = p.factions[actor?.faction_id]?.color || '#436d5c';
      const progress = npc.persuasion.elapsed_ticks / Math.max(1, npc.persuasion.required_ticks);
      // Proche du but, le badge palpite pour annoncer la bascule.
      const pulse = progress > 0.75 ? 1 + Math.sin(time * 14) * 0.08 : 1;
      badge(ctx, target.x, headY, r * pulse, color, progress);
      continue;
    }
    const t = conversionProgress(renderer, npc, state);
    if (t == null) continue;
    const color = p.factions[npc.faction_id]?.color || '#476e5d';
    if (t < POP_END) {
      // Badge plein qui gonfle, avec un éclat bref autour.
      const u = t / POP_END;
      badge(ctx, target.x, headY, r * (1 + Math.sin(u * Math.PI) * 0.45), color);
      ctx.globalAlpha = 1 - u; ctx.strokeStyle = color; ctx.lineWidth = 2.5; ctx.lineCap = 'round';
      for (let ray = 0; ray < 8; ray++) {
        const a = ray / 8 * Math.PI * 2;
        const inner = r * (1.5 + u * 0.8), outer = r * (2 + u * 1.3);
        ctx.beginPath();
        ctx.moveTo(target.x + Math.cos(a) * inner, headY + Math.sin(a) * inner);
        ctx.lineTo(target.x + Math.cos(a) * outer, headY + Math.sin(a) * outer);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    } else if (t < LAND_END) {
      // Le badge descend se fixer à l'endroit exact du badge de poitrine.
      const u = (t - POP_END) / (LAND_END - POP_END);
      const e = u * u * (3 - 2 * u);
      const pinX = target.pinX ?? target.x, pinY = target.pinY ?? target.feetY - target.height * 0.6;
      const pinR = target.pinRadius ?? r * 0.5;
      badge(ctx, target.x + (pinX - target.x) * e, headY + (pinY - headY) * e, r + (pinR - r) * e, color);
    }
  }
  ctx.restore();
}
