import { ringDelta } from '../simulation/world.js';

export const formatEuros = cents => `${(cents / 100).toLocaleString('fr-FR', { maximumFractionDigits: 2 })} €`;
const sprites = new Map();

function moneySprite(tier) {
  if (sprites.has(tier)) return sprites.get(tier);
  const canvas = document.createElement('canvas'); canvas.width = 64; canvas.height = 42;
  const ctx = canvas.getContext('2d');
  const count = [1, 3, 6, 9][tier];
  for (let i = 0; i < count; i++) {
    const x = 8 + i * (tier === 3 ? 4 : tier === 2 ? 5 : 7);
    const y = 21 - i * (tier >= 2 ? 1.4 : 2);
    ctx.fillStyle = '#243e31'; ctx.fillRect(x - 1, y - 1, 24, 14);
    ctx.fillStyle = tier >= 2 ? '#c4e0a6' : '#d7ecae'; ctx.fillRect(x, y, 22, 12);
    ctx.fillStyle = '#62946c'; ctx.fillRect(x + 2, y + 2, 18, 8);
    ctx.fillStyle = '#eaf2bd'; ctx.font = 'bold 8px system-ui'; ctx.textAlign = 'center'; ctx.fillText('€', x + 11, y + 9);
  }
  if (tier >= 2) {
    ctx.fillStyle = '#aa7340'; ctx.fillRect(23, tier === 3 ? 9 : 13, 9, tier === 3 ? 23 : 19);
    ctx.fillStyle = '#eed079'; ctx.fillRect(25, tier === 3 ? 9 : 13, 4, tier === 3 ? 23 : 19);
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
    const size = 28 + tier * 5;
    const x = renderer.screenX(pickup.x), y = m.groundY - pickup.height_ratio * config.balance.candidate_combat.jump_height_ratio * m.characterHeight - 12;
    const sprite = moneySprite(tier);
    ctx.drawImage(sprite, x - size / 2, y - size * 0.65, size, size * 0.65);
  }
}

export function drawCarriedDonation(renderer, npc, x) {
  if (npc.role !== 'SYMPATHISANT' || !npc.donation_cents) return;
  const tier = moneyTier(renderer.config, npc.donation_cents);
  renderer.ctx.drawImage(moneySprite(tier), x + 6, renderer.metrics.groundY - renderer.metrics.characterHeight * 0.8 - 18, 24, 16);
}

export function drawMoneyFeedback(renderer, state) {
  const { ctx, metrics: m } = renderer;
  const duration = renderer.config.balance.simulation_architecture.fixed_tick_hz;
  for (const event of state.events || []) {
    if (!['DonationHandedOver', 'DonationDeposited', 'FundingCollected', 'MoneyPickedUp'].includes(event.type)) continue;
    const age = state.tick - event.tick;
    if (age < 0 || age >= duration) continue;
    const entity = state.npcs.find(n => n.id === event.npc_id) || state.candidates.find(c => c.id === event.candidate_id)
      || state.buildings.find(b => b.id === event.target_id);
    if (!entity) continue;
    const x = renderer.screenX(entity.x);
    ctx.save(); ctx.globalAlpha = 1 - age / duration;
    ctx.fillStyle = '#fff2b5'; ctx.strokeStyle = '#304532'; ctx.lineWidth = 3;
    ctx.font = 'bold 14px system-ui'; ctx.textAlign = 'center';
    const label = `+${formatEuros(event.amount_cents)}`;
    const y = m.groundY - m.characterHeight - 10 - age * 0.45;
    ctx.strokeText(label, x, y); ctx.fillText(label, x, y); ctx.restore();
  }
}
