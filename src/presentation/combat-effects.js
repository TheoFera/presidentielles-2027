import { drawStyleEffects } from './style-effects.js';
export function drawCombatEffects(renderer, state, debug) {
  const { ctx, metrics: m, config } = renderer;
  const hz = config.balance.simulation_architecture.fixed_tick_hz;
  ctx.save();
  for (const c of state.candidates) {
    if (c.combat?.charge_active) {
      const x = renderer.screenX(c.x), y = m.groundY - m.characterHeight * 1.1;
      const progress = Math.min(1, (state.tick - c.combat.press_tick) / (hz * config.balance.candidate_combat.charge_ready_seconds));
      ctx.fillStyle = '#203940'; ctx.fillRect(x - 22, y, 44, 6);
      ctx.fillStyle = progress >= 1 ? '#c5f8ff' : '#63bed1'; ctx.fillRect(x - 21, y + 1, 42 * progress, 4);
    }
  }
  for (const c of state.candidates) {
    if (!c.dash_active) continue;
    const x = renderer.screenX(c.x), y = m.groundY - m.characterHeight * .45;
    ctx.strokeStyle = state.tick <= c.dash_invulnerable_until_tick ? '#c5f8ff' : '#e9dfcc88'; ctx.lineWidth = 3;
    for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(x - c.dash_direction * 12, y + i * 10); ctx.lineTo(x - c.dash_direction * (40 + i * 9), y + i * 10); ctx.stroke(); }
  }
  for (const p of state.projectiles) {
    const x = renderer.screenX(p.x);
    if (x < -100 || x > renderer.width + 100) continue;
    if (p.kind === 'WAVE') {
      const h = m.characterHeight * 1.65;
      const width = m.pixelsPerUnit * 1.8;
      ctx.save(); ctx.translate(x, m.groundY); ctx.scale(p.direction || 1, 1);
      const wash = ctx.createLinearGradient(-width / 2, 0, width / 2, -h);
      wash.addColorStop(0, '#28578abb'); wash.addColorStop(1, '#78b4e8ef');
      ctx.fillStyle = wash; ctx.strokeStyle = '#293f5b'; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.moveTo(-width * .6, 0);
      ctx.bezierCurveTo(-width * .2, -h * .3, -width * .5, -h * .84, width * .15, -h);
      ctx.bezierCurveTo(width * .85, -h * 1.04, width * .9, -h * .65, width * .3, -h * .72);
      ctx.bezierCurveTo(width * .55, -h * .45, width * .45, -h * .2, width * .72, 0);
      ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = '#d7eef3'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(-width * .25, -h * .75); ctx.bezierCurveTo(0, -h * 1.03, width * .6, -h, width * .55, -h * .81); ctx.stroke();
      ctx.restore();
      ctx.strokeStyle = '#b9dff0'; ctx.lineWidth = 1.5;
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        for (let y = 0; y <= h; y += 5) {
          const dx = Math.sin(y / 17 + state.tick / 4 + i) * 8;
          const px = x + p.direction * (width / 2 - i * 15 + dx);
          if (!y) ctx.moveTo(px, m.groundY - h); else ctx.lineTo(px, m.groundY - h + y);
        }
        ctx.stroke();
      }
    } else if (p.kind === 'MOLOTOV') {
      const y = m.groundY - m.characterHeight * .7;
      ctx.save(); ctx.translate(x, y); ctx.rotate(state.tick * .4);
      ctx.fillStyle = '#f8c94b'; ctx.strokeStyle = '#843f34'; ctx.lineWidth = 2; ctx.beginPath(); ctx.roundRect(-6,-10,12,18,4); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#ff833c'; ctx.beginPath(); ctx.moveTo(-4,-12); ctx.lineTo(3,-26); ctx.lineTo(6,-12); ctx.fill(); ctx.restore();
    } else {
      ctx.fillStyle = '#f4f0df'; ctx.strokeStyle = renderer.p.factions[p.faction_id].color; ctx.lineWidth = 2;
      const y = m.groundY - m.characterHeight * 0.9;
      ctx.beginPath(); ctx.roundRect(x - (p.kind === 'BUBBLE' ? 33 : 15), y, p.kind === 'BUBBLE' ? 66 : 30, 20, 8); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x - 5, y + 19); ctx.lineTo(x - 10, y + 26); ctx.lineTo(x + 1, y + 20); ctx.fill(); ctx.stroke();
      ctx.fillStyle = ctx.strokeStyle; ctx.font = 'bold 12px monospace'; ctx.textAlign = 'center'; ctx.fillText(p.label || '!?', x, m.groundY - m.characterHeight * 0.9 + 13);
    }
  }
  for (const hit of state.hit_results) {
    const age = (state.tick - hit.tick) / hz;
    const duration = hit.strong ? 0.3 : 0.16;
    if (age > duration) continue;
    const x = renderer.screenX(hit.x); const y = m.groundY - m.characterHeight * (0.65 + (hit.height || 0));
    const size = (hit.strong ? 27 : 12) * (1 + age * 2);
    ctx.globalAlpha = 1 - age / duration;
    ctx.fillStyle = hit.strong ? '#f4cf76' : '#fff2c9'; ctx.strokeStyle = '#4c4035'; ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let i = 0; i < 20; i++) { const a = i * Math.PI / 10, r = size * (i % 2 ? .38 : 1); const px = x + Math.cos(a) * r, py = y + Math.sin(a) * r; if (!i) ctx.moveTo(px, py); else ctx.lineTo(px, py); }
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = '#fff6dc'; ctx.lineWidth = hit.strong ? 3 : 1.5;
    for (let i = 0; i < 8; i++) {
      const a = i * Math.PI / 4;
      ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * size * 0.3, y + Math.sin(a) * size * 0.3);
      ctx.lineTo(x + Math.cos(a) * size, y + Math.sin(a) * size); ctx.stroke();
    }
  }
  ctx.globalAlpha = 1;
  if (debug) for (const a of state.attacks) {
    const owner = [...state.candidates, ...state.npcs, ...state.temporary_units].find(t => t.id === a.owner_id);
    if (!owner || !a.range) continue;
    const x = renderer.screenX(owner.x); const w = a.range * m.pixelsPerUnit;
    const active = a.elapsed_ticks >= a.windup_ticks && a.elapsed_ticks < a.windup_ticks + a.active_ticks;
    ctx.fillStyle = active ? '#e9585844' : '#dfbc4730'; ctx.strokeStyle = active ? '#b74b4b' : '#b59740';
    ctx.fillRect(a.direction > 0 ? x : x - w, m.groundY - m.characterHeight, w, m.characterHeight);
    ctx.strokeRect(a.direction > 0 ? x : x - w, m.groundY - m.characterHeight, w, m.characterHeight);
  }
  ctx.restore();
  drawStyleEffects(renderer, state);
}
