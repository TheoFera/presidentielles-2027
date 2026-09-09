import { zoneAt } from '../simulation/world.js';

export const biomeArtId = id => ({ paris_19e: 'bobo', periurbain_usine: 'periurbain', quartiers_riches: 'riches' }[id] || id);
const hash = value => [...String(value)].reduce((sum, c) => (sum * 31 + c.charCodeAt(0)) >>> 0, 0);
export const npcVariantCounts = Object.freeze({bobo:3,banlieue:4,periurbain:5,campagne:4,retraites:4,riches:4});

export function characterAssetId(entity, state) {
  const variation = hash(entity.id);
  if (entity.presentation_name === 'Journaliste') return `journalist-${variation % 3}`;
  if (entity.role === 'CANDIDAT' || entity.role === 'HOLOGRAMME') return `character-${entity.faction_id}`;
  if (entity.role === 'CRS') return `crs-${variation % 2}`;
  if (entity.role === 'SERVICE_D_ORDRE') return `security-${variation % 2}`;
  const origin = state.world?.subzones.find(z => z.id === entity.origin_subzone_id)
    || (state.world?.subzones.length ? zoneAt(state.world, entity.x) : null);
  const biome = biomeArtId(origin?.biome_id || 'bobo');
  return `npc-${biome}-${variation % (npcVariantCounts[biome] || 3)}`;
}

// Animation follows simulation events; no animation can delay or mutate a command.
export function characterAnimation(entity, state) {
  const attack = state.attacks?.find(a => a.owner_id === entity.id);
  if (entity.is_ko || entity.arena_hp <= 0) return 'ko';
  if (entity.combat?.stun_ticks > 0) return Math.abs(entity.combat.knockback_velocity || 0) > 0.01 ? 'knockback' : 'hurt';
  if (attack?.kind === 'SPECIAL') return attack.elapsed_ticks < attack.windup_ticks + attack.active_ticks ? 'special_start' : 'special_recovery';
  if (attack) return attack.strong ? 'attack_heavy' : attack.step === 2 ? 'attack_light_2' : 'attack_light_1';
  if (entity.charging || entity.combat?.charge_ticks > 0) return 'charged_attack';
  if (entity.special_active || entity.special_until_tick > state.tick) return 'special_start';
  if (entity.persuasion_target_ids?.length) return 'persuade';
  if (entity.persuasion) return 'persuade_listen';
  if (entity.converted_tick >= 0 && state.tick - entity.converted_tick < 12) return 'convert';
  if (entity.purchase_hold || entity.task?.phase === 'PICKUP') return 'interact_hold';
  if (entity.role === 'DEMOBILISE') return 'demobilised_return';
  if (entity.moving) return entity.combat?.engaged || entity.task?.kind === 'RAID' ? 'run' : 'walk';
  if (state.buildings?.some(b => b.type === 'meeting' && b.meeting_until_tick > state.tick && b.meeting_faction_id === entity.faction_id)) return 'meeting';
  return 'idle';
}

export function drawIllustratedCharacter(renderer, entity, x, state) {
  const id = characterAssetId(entity, state);
  const sprite = renderer.assets.get(id);
  if (!sprite) { void renderer.assets.load(id); return false; }
  const { ctx, metrics: m, p } = renderer;
  const candidate = entity.role === 'CANDIDAT';
  const height = m.characterHeight * (candidate ? 1 : p.npc_height_multiplier);
  const width = height * sprite.naturalWidth / sprite.naturalHeight;
  const time = state.tick / renderer.config.balance.simulation_architecture.fixed_tick_hz;
  const animation = characterAnimation(entity, state);
  const walking = ['walk', 'run', 'demobilised_return'].includes(animation);
  const stride = walking ? Math.sin(time * (animation === 'run' ? 20 : 13)) : 0;
  const attack = state.attacks?.find(a => a.owner_id === entity.id);
  const attacking = animation.startsWith('attack');
  const windup = attack && attack.elapsed_ticks < attack.windup_ticks;
  const action = attacking ? (windup ? -0.09 : attack?.strong ? 0.23 : 0.16) : animation === 'knockback' ? -0.25 : animation === 'special_start' ? -0.1 : animation === 'special_recovery' ? 0.07 : animation === 'interact_hold' ? 0.04 : 0;
  const faction = p.factions[entity.faction_id];
  ctx.save();
  ctx.imageSmoothingEnabled = true;
  ctx.fillStyle = '#26313230'; ctx.beginPath(); ctx.ellipse(x, m.groundY, width * 0.48, 3, 0, 0, Math.PI * 2); ctx.fill();
  ctx.translate(x, m.groundY - Math.abs(stride) * 1.8);
  ctx.scale(entity.facing < 0 ? -1 : 1, 1);
  if (animation === 'ko') ctx.translate(0, -width * .48);
  ctx.rotate(animation === 'ko' ? -Math.PI / 2 : action + stride * 0.025);
  ctx.globalAlpha = entity.role === 'DEMOBILISE' ? 0.5 : entity.role === 'HOLOGRAMME' ? 0.48 : 1;
  if (entity.role === 'HOLOGRAMME') { ctx.shadowColor = '#6edbff'; ctx.shadowBlur = 12; }
  const breathing = 1 + Math.sin(time * 3) * 0.008;
  ctx.scale(1 / breathing, breathing);
  // Deform the two leg regions around a fixed hip seam, reusing the master identity.
  if (walking) {
    const split = Math.floor(sprite.naturalHeight * 0.75);
    ctx.drawImage(sprite, 0, 0, sprite.naturalWidth, split, -width / 2, -height, width, height * 0.75);
    for (const side of [0, 1]) {
      ctx.drawImage(sprite, side * sprite.naturalWidth / 2, split, sprite.naturalWidth / 2, sprite.naturalHeight - split,
        -width / 2 + side * width / 2, -height * 0.25, width / 2, height * 0.25 - Math.max(0, stride * (side ? -1 : 1)) * 3);
    }
  } else ctx.drawImage(sprite, -width / 2, -height, width, height);
  ctx.shadowBlur = 0;
  if (!candidate && faction && entity.role !== 'HOLOGRAMME') {
    ctx.fillStyle = faction.color; ctx.strokeStyle = '#263132'; ctx.lineWidth = 1.1;
    ctx.beginPath(); ctx.roundRect(-width * 0.36, -height * 0.53, width * 0.24, 6, 2); ctx.fill(); ctx.stroke();
    if (entity.role === 'MILITANT') {
      ctx.fillStyle = '#fff2d9'; ctx.fillRect(width * 0.3, -height * 0.44, 7, 11);
      ctx.fillStyle = faction.color; ctx.fillRect(width * 0.3 + 1, -height * 0.44 + 2, 5, 2);
    }
  }
  if (attacking && !windup) {
    ctx.strokeStyle = '#fff1b8'; ctx.lineWidth = attack.strong ? 4 : 2;
    ctx.beginPath(); ctx.arc(width * 0.25, -height * 0.58, width * 0.8, -1.3, 0.8); ctx.stroke();
  }
  if (entity.role === 'HOLOGRAMME') {
    ctx.globalAlpha = 0.7; ctx.strokeStyle = '#9fe9f5'; ctx.lineWidth = 0.7;
    for (let line = 0; line < height; line += 5) { ctx.beginPath(); ctx.moveTo(-width * 0.34, -line); ctx.lineTo(width * 0.34, -line); ctx.stroke(); }
  }
  if (animation === 'special_start') {
    ctx.strokeStyle = faction?.color || '#d4ad58'; ctx.lineWidth = 2;
    for (let ray = 0; ray < 7; ray++) { const a = ray / 6 * Math.PI; ctx.beginPath(); ctx.moveTo(Math.cos(a) * width * .65, -height * .6 - Math.sin(a) * width); ctx.lineTo(Math.cos(a) * width * .85, -height * .6 - Math.sin(a) * width * 1.25); ctx.stroke(); }
  }
  ctx.restore();
  ctx.save(); ctx.textAlign = 'center';
  if (['persuade', 'interact_hold', 'persuade_listen', 'meeting'].includes(animation)) {
    const wave = Math.sin(time * 5);
    ctx.fillStyle = '#fff7e4'; ctx.strokeStyle = '#29353b'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.roundRect(x + 14, m.groundY - height - 13 + wave, 24, 17, 6); ctx.fill(); ctx.stroke();
    ctx.fillStyle = faction?.color || '#364548'; ctx.font = 'bold 12px system-ui';
    ctx.fillText(animation === 'interact_hold' ? '…' : '!', x + 26, m.groundY - height + wave);
  }
  if (entity.persuasion) {
    const progress = entity.persuasion.elapsed_ticks / entity.persuasion.required_ticks;
    ctx.strokeStyle = p.factions[[...state.candidates, ...state.npcs].find(c => c.id === entity.persuasion.actor_id)?.faction_id]?.color || '#436d5c';
    ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, m.groundY - height - 9, 5, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * progress); ctx.stroke();
  }
  if (animation === 'convert') { ctx.font = 'bold 16px system-ui'; ctx.fillStyle = faction?.color || '#476e5d'; ctx.fillText('♥', x, m.groundY - height - 8); }
  if (animation === 'ko' || candidate && entity.special_charge >= renderer.config.balance.special_charge.required_points) {
    ctx.font = 'bold 13px system-ui'; ctx.fillStyle = '#ffd66b'; ctx.strokeStyle = '#51412e'; ctx.lineWidth = 2;
    const headX = animation === 'ko' ? x - height * 0.85 : x;
    const headY = animation === 'ko' ? m.groundY - 20 : m.groundY - height - 6;
    for (let i = 0; i < 3; i++) { const sx = headX + Math.cos(time * 3 + i * 2.1) * 14; const sy = headY + Math.sin(time * 3 + i * 2.1) * 3; ctx.strokeText('✦', sx, sy); ctx.fillText('✦', sx, sy); }
  }
  ctx.restore();
  return true;
}
