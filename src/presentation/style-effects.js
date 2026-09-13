export function drawStyleEffects(renderer, state) {
  const { ctx, metrics: m, config } = renderer, hz = config.balance.simulation_architecture.fixed_tick_hz, time = state.tick / hz;
  ctx.save();
  for (const power of state.powers) {
    if (power.fire_zone && power.fire_zone.expires_tick > state.tick) {
      const x = renderer.screenX(power.fire_zone.x), radius = config.balance.specials.fire.radius * m.pixelsPerUnit;
      ctx.fillStyle = '#ef8b3755'; ctx.strokeStyle = '#ffd966'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(x, m.groundY, radius, 10, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      for (let i = 0; i < 11; i++) {
        const fx = x - radius + i * radius / 5, h = 17 + Math.sin(time * 12 + i * 3) * 8;
        ctx.fillStyle = i % 2 ? '#ffd55e' : '#ff853a'; ctx.beginPath(); ctx.moveTo(fx - 6, m.groundY); ctx.quadraticCurveTo(fx - 10, m.groundY - h * .5, fx + 3, m.groundY - h); ctx.quadraticCurveTo(fx + 10, m.groundY - h * .4, fx + 6, m.groundY); ctx.fill();
      }
    }
    for (const [id, burn] of Object.entries(power.burns || {})) {
      if (burn.expires_tick <= state.tick) continue;
      const target = [...state.candidates, ...state.npcs, ...state.temporary_units].find(t => t.id === id && !t.is_ko && t.faction_id);
      if (target) { ctx.font = 'bold 18px sans-serif'; ctx.fillStyle = '#ffc365'; ctx.fillText('♨', renderer.screenX(target.x) - 8, m.groundY - m.characterHeight * .4); }
    }
  }
  for (const c of state.candidates) {
    if (c.is_ko || c.disappeared) continue;
    const x = renderer.screenX(c.x), h = m.characterHeight;
    if (c.ultimate_effect?.kind === 'EUROPE' && c.ultimate_effect.expires_tick > state.tick) {
      ctx.save(); ctx.shadowColor = '#7edcff'; ctx.shadowBlur = 15; ctx.strokeStyle = '#9fe9ff'; ctx.lineWidth = 3;
      ctx.beginPath();
      for (let i = 0; i <= 40; i++) { const a = i / 40 * Math.PI * 2, r = 1 + .12 * Math.sin(i * 3 + time * 15); const px = x + Math.cos(a) * h * .48 * r, py = m.groundY - h * .55 + Math.sin(a) * h * .65 * r; if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py); }
      ctx.closePath(); ctx.stroke(); ctx.fillStyle = '#2d79e528'; ctx.fill(); ctx.shadowBlur = 0; ctx.font = 'bold 16px sans-serif'; ctx.fillStyle = '#ffe45f';
      for (let i = 0; i < 7; i++) { const a = i / 7 * Math.PI * 2 + time; ctx.fillText('★', x + Math.cos(a) * h * .58, m.groundY - h * .55 + Math.sin(a) * h * .7); }
      ctx.restore();
    }
    if (c.ultimate_effect?.kind === 'SCARF' && c.ultimate_effect.expires_tick > state.tick) {
      const attack = state.attacks.find(a => a.owner_id === c.id && a.kind === 'SCARF');
      if (attack && attack.elapsed_ticks >= attack.windup_ticks && attack.elapsed_ticks < attack.windup_ticks + attack.active_ticks) {
        const reach = config.balance.specials.scarf.range * m.pixelsPerUnit;
        for (const [i, color] of ['#245ccb', '#fff7e9', '#e94959'].entries()) { ctx.strokeStyle = color; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(x, m.groundY - h * .6 + i * 4); ctx.bezierCurveTo(x + c.facing * reach * .4, m.groundY - h * .9, x + c.facing * reach, m.groundY - h * .3, x + c.facing * reach, m.groundY - h * .6 + i * 4); ctx.stroke(); }
      }
    }
    if (c.bardella_form) {
      const age = (state.tick - c.bardella_transition_tick) / hz;
      if (age < .4) { ctx.fillStyle = `rgba(205,231,255,${(1 - age / .4) * .8})`; ctx.beginPath(); ctx.ellipse(x, m.groundY - h * .5, h * .5, h * .7, 0, 0, Math.PI * 2); ctx.fill(); }
      ctx.fillStyle = '#eff6ff'; ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('Bardella', x, m.groundY - h - 12);
    }
  }
  ctx.restore();
}
