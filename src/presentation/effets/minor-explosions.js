/** Explosion de dessin animé : éclat bref, petits nuages et papiers, sans flash plein écran. */
export function drawMinorExplosion(renderer, x, y, progress, radius, stationery = false) {
  if (progress < 0 || progress >= 1) return;
  const { ctx, metrics: m } = renderer;
  const size = Math.min(radius, m.characterHeight * .72);
  const ground = m.groundY + m.characterHeight * (m.groundOffsetRatio ?? .06);
  const ease = 1 - (1 - progress) ** 3;
  ctx.save();
  // Les impacts au sol montent en gerbe ; les explosions en vol gardent leur centre.
  ctx.beginPath(); ctx.rect(x - size * 2, y - size * 2, size * 4, Math.max(0, ground - y) + size * 2);
  ctx.clip();
  const opacity = ctx.globalAlpha;
  // Six bouffées légèrement irrégulières, assez transparentes pour voir les combattants.
  for (let i = 0; i < 6; i++) {
    const angle = Math.PI + (i + .5) * Math.PI / 6;
    const distance = size * (.2 + ease * .42);
    const puff = size * (.12 + ease * .12) * (1 + (i % 3) * .12);
    ctx.globalAlpha = opacity * .48 * (1 - progress) * Math.min(1, progress * 14);
    ctx.fillStyle = i % 2 ? '#e6dcc8' : '#c7bba7';
    ctx.beginPath();
    ctx.ellipse(x + Math.cos(angle) * distance, y + Math.sin(angle) * distance - size * progress * .2,
      puff, puff * .85, 0, 0, Math.PI * 2); ctx.fill();
  }
  // Un petit éclat crénelé à contour chaud, qui disparaît dès le premier tiers.
  if (progress < .34) {
    const flash = progress / .34;
    const burst = size * (.2 + Math.sin(Math.PI * flash * .85) * .42);
    ctx.globalAlpha = opacity * (1 - flash) * .9;
    ctx.fillStyle = '#f4c665'; ctx.strokeStyle = '#b78247';
    ctx.lineWidth = Math.max(1, m.characterHeight * .009);
    ctx.beginPath();
    for (let i = 0; i < 20; i++) {
      const angle = i * Math.PI / 10;
      const r = burst * (i % 2 ? .53 : 1 + (i % 3) * .08);
      const px = x + Math.cos(angle) * r, py = y + Math.sin(angle) * r * .8;
      ctx[i ? 'lineTo' : 'moveTo'](px, py);
    }
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#fff1c1'; ctx.beginPath();
    ctx.ellipse(x, y, burst * .35, burst * .3, 0, 0, Math.PI * 2); ctx.fill();
  }
  const colors = stationery ? ['#fff6df', '#f8e9c9', '#dbe7ed'] : ['#e66b69', '#fff4de', '#78a9ca'];
  const count = stationery ? 18 : 14;
  for (let i = 0; i < count; i++) {
    const angle = i * 2.39996;
    const travel = size * progress * (.65 + (i % 5) * .16);
    const px = x + Math.cos(angle) * travel;
    const py = y + Math.sin(angle) * travel * .65 - size * progress * .65 + size * progress ** 2 * .9;
    const paper = m.characterHeight * (stationery ? .043 : .026);
    ctx.save(); ctx.translate(px, Math.min(ground - paper, py));
    ctx.rotate(angle + progress * (i % 2 ? 4 : -4));
    ctx.globalAlpha = opacity * Math.min(1, (1 - progress) * 3);
    ctx.fillStyle = colors[i % colors.length];
    ctx.fillRect(-paper / 2, -paper / 2, paper, paper * (stationery ? 1.3 : .5));
    if (stationery && i % 3 === 0) {
      ctx.strokeStyle = '#8cabc1'; ctx.lineWidth = Math.max(.6, paper * .09);
      ctx.beginPath(); ctx.moveTo(-paper * .3, 0); ctx.lineTo(paper * .3, 0);
      ctx.moveTo(-paper * .3, paper * .3); ctx.lineTo(paper * .15, paper * .3); ctx.stroke();
    }
    ctx.restore();
  }
  ctx.restore();
}
