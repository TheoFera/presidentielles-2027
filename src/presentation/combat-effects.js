export function drawCombatEffects(renderer, state, debug) {
  const { ctx, metrics: m, config } = renderer;
  const hz = config.balance.simulation_architecture.fixed_tick_hz;
  ctx.save();
  for (const p of state.projectiles) {
    const x = renderer.screenX(p.x);
    if (x < -100 || x > renderer.width + 100) continue;
    if (p.kind === 'WAVE') {
      const h = m.characterHeight * 1.65;
      const width = m.pixelsPerUnit * 1.8;
      ctx.fillStyle = '#163972b8'; ctx.fillRect(x - width / 2, m.groundY - h, width, h);
      ctx.strokeStyle = '#779bcd'; ctx.lineWidth = 4;
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        for (let y = 0; y <= h; y += 5) {
          const dx = Math.sin(y / 17 + state.tick / 4 + i) * 8;
          const px = x + p.direction * (width / 2 - i * 15 + dx);
          if (!y) ctx.moveTo(px, m.groundY - h); else ctx.lineTo(px, m.groundY - h + y);
        }
        ctx.stroke();
      }
    } else {
      ctx.fillStyle = '#f4f0df'; ctx.strokeStyle = renderer.p.factions[p.faction_id].color; ctx.lineWidth = 2;
      ctx.fillRect(x - 12, m.groundY - m.characterHeight * 0.9, 24, 17);
      ctx.strokeRect(x - 12, m.groundY - m.characterHeight * 0.9, 24, 17);
      ctx.fillStyle = ctx.strokeStyle; ctx.font = 'bold 12px monospace'; ctx.textAlign = 'center'; ctx.fillText('!?', x, m.groundY - m.characterHeight * 0.9 + 13);
    }
  }
  for (const hit of state.hit_results) {
    const age = (state.tick - hit.tick) / hz;
    const duration = hit.strong ? 0.3 : 0.16;
    if (age > duration) continue;
    const x = renderer.screenX(hit.x); const y = m.groundY - m.characterHeight * 0.65;
    const size = (hit.strong ? 27 : 12) * (1 + age * 2);
    ctx.globalAlpha = 1 - age / duration; ctx.strokeStyle = hit.strong ? '#fff0b9' : '#fffdf0'; ctx.lineWidth = hit.strong ? 5 : 2;
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
}
