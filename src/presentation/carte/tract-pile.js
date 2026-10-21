import { plateFeatureFrame } from './carte-plate.js';

// Emplacement de la pile en pixels de tuile (1 920 × 1 080) : x = centre, floor = pied de la façade.
// Toujours à côté de la porte, jamais devant ; une façade en retrait (banlieue B) garde sa pile au même retrait.
const PILE_SPOTS = {
  'site:paris_a': { x: 1167, floor: 1004 },
  'site:paris_c': { x: 549, floor: 1004 },
  'site:banlieue_b': { x: 333, floor: 940 },
  'site:periurbain_a': { x: 1015, floor: 1004 },
  'site:periurbain_c': { x: 1027, floor: 1004 },
  'site:campagne_b': { x: 512, floor: 1004 },
  'site:retraites_a': { x: 1345, floor: 1004 },
  'site:retraites_c': { x: 1365, floor: 1004 },
  'site:riches_b': { x: 216, floor: 999 },
};
// Paquet de tracts et palette, en pixels de tuile.
const PACK_W = 46, PACK_H = 11, PALLET_H = 7, INK = '#2f2a24';

/**
 * Pile des tracts en attente devant chaque permanence, posée sur une petite palette : un paquet par tract,
 * pâle pendant l'impression puis cerclé de la couleur du candidat. Un sympathisant qui en emporte un fait baisser la pile.
 */
export function drawTractPiles(renderer, state) {
  if (!renderer.fixedWorldActive) return;
  const { ctx, config } = renderer, settings = config.balance.buildings.imprimerie;
  const printTicks = settings.equipment_seconds_by_level[0] * config.balance.simulation_architecture.fixed_tick_hz;
  for (const building of state.buildings) {
    if (building.type !== 'permanence' || !building.queue.length) continue;
    const spot = PILE_SPOTS[building.site_id], faction = renderer.p.factions[building.owner_id];
    const frame = spot && faction && plateFeatureFrame(renderer, building, { x: spot.x, y: spot.floor, w: 0, h: 0 });
    if (!frame || frame.left < -60 || frame.left > renderer.width + 60) continue;
    const s = frame.scaleX, cx = frame.left, floor = frame.top, w = PACK_W * s, h = PACK_H * s;
    const orders = building.queue.filter(order => order.faction_id === building.owner_id);
    ctx.save(); ctx.lineWidth = Math.max(1, 1.6 * s); ctx.strokeStyle = INK;
    // Ombre portée et palette : la pile repose sur le trottoir.
    ctx.fillStyle = 'rgba(45, 35, 25, 0.3)';
    ctx.beginPath(); ctx.ellipse(cx, floor, w * 0.75, 5 * s, 0, 0, Math.PI * 2); ctx.fill();
    const palletW = w + 8 * s, palletX = cx - palletW / 2, base = floor - PALLET_H * s;
    ctx.fillStyle = '#5e4329';
    for (const foot of [0, 0.5, 1]) {
      const fx = palletX + foot * (palletW - 7 * s); ctx.fillRect(fx, base + 3 * s, 7 * s, 4 * s); ctx.strokeRect(fx, base + 3 * s, 7 * s, 4 * s);
    }
    ctx.fillStyle = '#9a7149'; ctx.fillRect(palletX, base, palletW, 3 * s); ctx.strokeRect(palletX, base, palletW, 3 * s);
    orders.forEach((order, index) => {
      const x = cx - w / 2 + (index % 2 ? 2 : -2) * s, y = base - (index + 1) * h;
      // Paquet en cours d'impression : il apparaît peu à peu ; prêt, il reçoit sa sangle aux couleurs du candidat.
      const ready = order.state === 'READY' ? 1 : order.state === 'PRINTING' ? Math.min(1, order.production_elapsed_ticks / printTicks) : 0;
      ctx.globalAlpha = 0.35 + 0.65 * ready;
      ctx.fillStyle = '#f4ecd8'; ctx.fillRect(x, y, w, h);
      ctx.fillStyle = '#d8c9a8'; ctx.fillRect(x, y + h * 0.62, w, h * 0.38); ctx.fillRect(x + w * 0.86, y, w * 0.14, h);
      // Tranche des feuilles, comme les traits fins des décors peints.
      ctx.fillStyle = '#b9a885'; ctx.fillRect(x + 3 * s, y + h * 0.4, w - 6 * s, Math.max(1, 0.8 * s));
      if (index === orders.length - 1) { ctx.fillStyle = '#fffaf0'; ctx.fillRect(x + 2 * s, y - 3 * s, w - 4 * s, 3 * s); ctx.strokeRect(x + 2 * s, y - 3 * s, w - 4 * s, 3 * s); }
      if (ready === 1) { ctx.fillStyle = faction.color; ctx.fillRect(x + w * 0.42, y, w * 0.16, h); ctx.strokeRect(x + w * 0.42, y, w * 0.16, h); }
      ctx.strokeRect(x, y, w, h); ctx.globalAlpha = 1;
    });
    if (orders.length >= settings.max_waiting_tracts) {
      const tagY = base - orders.length * h - 22;
      ctx.fillStyle = '#f3e4c5'; ctx.beginPath(); ctx.roundRect(cx - 23, tagY, 46, 15, 3); ctx.fill(); ctx.lineWidth = 1.5; ctx.stroke();
      ctx.fillStyle = '#8a3a32'; ctx.font = '800 10px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('PLEIN', cx, tagY + 8);
    }
    ctx.restore();
  }
}
