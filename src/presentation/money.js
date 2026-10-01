import { ringDelta, wrap } from '../simulation/world.js';
import { formatNumber } from './number-format.js';

export const formatEuros = cents => `${formatNumber(cents / 100, 2)} €`;
export const formatCarriedMoney = thousands => thousands < 1
  ? formatEuros(Math.round(thousands * 100000))
  : `${formatNumber(thousands, 1)} k €`;
const sprites = new Map();

function moneySprite(tier) {
  if (sprites.has(tier)) return sprites.get(tier);
  const canvas = document.createElement('canvas'); canvas.width = 64; canvas.height = 42;
  const ctx = canvas.getContext('2d');
  const bill = (x, y, width, height, angle = 0) => {
    ctx.save(); ctx.translate(x, y); ctx.rotate(angle);
    const left = -width / 2, top = -height / 2;
    ctx.fillStyle = '#243e31'; ctx.fillRect(left - 1, top - 1, width + 2, height + 2);
    ctx.fillStyle = '#d7ecae'; ctx.fillRect(left, top, width, height);
    ctx.fillStyle = '#62946c'; ctx.fillRect(left + 3, top + 3, width - 6, height - 6);
    ctx.fillStyle = '#eaf2bd'; ctx.fillRect(left + 7, top + 5, width - 14, height - 10);
    ctx.fillStyle = '#315d43'; ctx.font = `bold ${Math.round(height * 0.7)}px system-ui`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('€', 0, 1);
    ctx.restore();
  };
  if (tier === 0) bill(32, 21, 44, 22, -0.06);
  else if (tier === 1) {
    bill(25, 24, 37, 19, -0.22);
    bill(39, 24, 37, 19, 0.22);
    bill(32, 19, 39, 20);
  } else {
    const layers = tier === 2 ? 3 : 5;
    const width = tier === 2 ? 44 : 48;
    const left = (64 - width) / 2;
    for (let layer = layers; layer >= 1; layer--) {
      const top = 10 + layer * 2;
      ctx.fillStyle = '#243e31'; ctx.fillRect(left - 1, top - 1, width + 2, 21);
      ctx.fillStyle = layer % 2 ? '#86b380' : '#d7ecae'; ctx.fillRect(left, top, width, 19);
      ctx.fillStyle = '#eaf2bd'; ctx.fillRect(left + 3, top + 2, width - 6, 2);
    }
    bill(32, 19, width, 20);
    for (const center of tier === 2 ? [17] : [15, 39]) {
      ctx.fillStyle = '#476b48'; ctx.fillRect(center - 3, 9, 7, 22 + layers * 2);
      ctx.fillStyle = '#c9dc94'; ctx.fillRect(center - 2, 9, 5, 22 + layers * 2);
      ctx.fillStyle = '#eff4bb'; ctx.fillRect(center - 1, 11, 1, 16 + layers * 2);
    }
  }
  sprites.set(tier, canvas); return canvas;
}

export function moneyTier(config, amountCents) {
  const amount = amountCents / 100;
  return config.balance.money.sprite_tiers_eur.filter(limit => amount >= limit).length;
}

export function drawMoneyPickups(renderer, state) {
  const { ctx, metrics: m, config } = renderer;
  for (const pickup of state.money_pickups || []) {
    if (Math.abs(ringDelta(renderer.cameraX, pickup.x, state.world.length)) > renderer.width / m.pixelsPerUnit) continue;
    const tier = moneyTier(config, pickup.amount_cents);
    const size = config.balance.money.pickup_sprite_base_width_px + tier * config.balance.money.pickup_sprite_width_per_tier_px;
    const tossing = Number.isFinite(pickup.toss_origin_x) && pickup.collect_after_tick > state.tick;
    const progress = tossing ? Math.max(0, Math.min(1, (state.tick - pickup.toss_started_tick)
      / (pickup.collect_after_tick - pickup.toss_started_tick))) : 1;
    const visualX = tossing ? wrap(pickup.toss_origin_x + ringDelta(pickup.toss_origin_x, pickup.x, state.world.length) * progress,
      state.world.length) : pickup.x;
    const x = renderer.screenX(visualX);
    const tossHeight = tossing ? (1 - progress) * m.characterHeight * 0.55 + Math.sin(Math.PI * progress) * m.characterHeight * 0.16 : 0;
    const phase = state.tick / config.balance.simulation_architecture.fixed_tick_hz
      * Math.PI * 2 / config.balance.money.pickup_hover_period_seconds + Number(pickup.id.slice(6)) * 1.6;
    const hover = tossing ? 0 : Math.sin(phase) * config.balance.money.pickup_hover_amplitude_px;
    const visualOffset = pickup.height_ratio > 0 ? config.balance.money.elevated_pickup_visual_offset_px
      : config.balance.money.ground_pickup_visual_offset_px;
    const y = m.groundY - pickup.height_ratio * config.balance.candidate_combat.jump_height_ratio * m.characterHeight
      - visualOffset - tossHeight - hover;
    const sprite = moneySprite(tier);
    ctx.save();
    const halo = config.balance.money.pickup_halo_opacity;
    if (halo > 0) {
      const centerY = y - size * 0.32;
      const light = ctx.createRadialGradient(x, centerY, size * 0.08, x, centerY, size * 0.64);
      light.addColorStop(0, `rgba(218, 248, 178, ${halo})`);
      light.addColorStop(0.6, `rgba(218, 248, 178, ${halo * 0.4})`);
      light.addColorStop(1, 'rgba(218, 248, 178, 0)');
      ctx.fillStyle = light; ctx.beginPath(); ctx.ellipse(x, centerY, size * 0.64, size * 0.43, 0, 0, Math.PI * 2); ctx.fill();
    }
    ctx.shadowColor = '#263d32'; ctx.shadowBlur = 4; ctx.shadowOffsetY = 2;
    ctx.drawImage(sprite, x - size / 2, y - size * 0.65, size, size * 0.65);
    ctx.restore();
  }
}

export function drawMoneyFeedback(renderer, state) {
  const { ctx, metrics: m } = renderer;
  const duration = renderer.config.balance.simulation_architecture.fixed_tick_hz;
  for (const event of state.events || []) {
    if (!['DonationDropped', 'DonationHandedOver', 'DonationDeposited', 'FundingCollected', 'MoneyPickedUp'].includes(event.type)) continue;
    const age = state.tick - event.tick;
    if (age < 0 || age >= duration) continue;
    const entity = state.npcs.find(n => n.id === event.npc_id) || state.candidates.find(c => c.id === event.candidate_id)
      || state.buildings.find(b => b.id === event.target_id);
    if (!entity) continue;
    const x = renderer.screenX(entity.x);
    ctx.save(); ctx.globalAlpha = 1 - age / duration;
    ctx.fillStyle = '#fff2b5'; ctx.strokeStyle = '#304532'; ctx.lineWidth = 3;
    ctx.font = 'bold 14px system-ui'; ctx.textAlign = 'center';
    const label = event.type === 'DonationDropped' ? `Don : ${formatEuros(event.amount_cents)}` : `+${formatEuros(event.amount_cents)}`;
    const y = m.groundY - m.characterHeight - 10 - age * 0.45;
    ctx.strokeText(label, x, y); ctx.fillText(label, x, y); ctx.restore();
  }
}
