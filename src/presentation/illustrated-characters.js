import { drawMountedCandidate } from './vehicles.js';
import { drawRallyAccessories } from './fixed-world.js';
import { drawCandidateCombat } from './melenchon-combat.js';
import { drawUltimateCharacter } from './ultimate-sprites.js';
import { specialCharacterAssetId } from './campaign-style-art.js';
import { meetingCrowdPlace } from '../simulation/electoral-buildings.js';
import { militantSpriteForFaction } from './militant-sprites.js';
import { zoneAt } from '../simulation/world.js';
import { drawMinorCandidate } from './minor-characters.js';

export const biomeArtId = id => ({ paris_19e: 'bobo', periurbain_usine: 'periurbain', quartiers_riches: 'riches' }[id] || id);
const hash = value => [...String(value)].reduce((sum, c) => (sum * 31 + c.charCodeAt(0)) >>> 0, 0);
export const npcVariantCounts = Object.freeze({bobo:20,banlieue:20,periurbain:20,campagne:20,retraites:20,riches:20});
export const npcBiomeOrder = Object.freeze(['bobo', 'banlieue', 'periurbain', 'campagne', 'retraites', 'riches']);

export function npcVisualBiome(entity, homeBiome) {
  const index = npcBiomeOrder.indexOf(homeBiome);
  if (index < 0) return 'bobo';
  const neighborRoll = hash(`${entity.id}:biome`) % 8;
  if (neighborRoll > 1) return homeBiome;
  const direction = neighborRoll === 0 ? -1 : 1;
  return npcBiomeOrder[(index + direction + npcBiomeOrder.length) % npcBiomeOrder.length];
}

const npcSequence = entity => {
  const match = /^npc:(\d+)$/.exec(entity.id);
  return match ? Number(match[1]) : Number.MAX_SAFE_INTEGER;
};

export function npcAppearanceAssetId(entity, state, homeBiome) {
  const count = npcVariantCounts[homeBiome] || 20;
  const zoneId = entity.origin_subzone_id || homeBiome;
  const zoneNpcs = (state.npcs || [])
    .filter(npc => (npc.origin_subzone_id || homeBiome) === zoneId)
    .sort((a, b) => npcSequence(a) - npcSequence(b) || String(a.id).localeCompare(String(b.id)));
  const position = zoneNpcs.findIndex(npc => npc.id === entity.id);
  const cyclePosition = position >= 0 ? position % count : hash(`${entity.id}:slot`) % count;

  // Chaque sous-zone possède un cycle fixe de vingt apparences : quinze
  // locales et cinq empruntées aux deux biomes voisins. Le pas 7 mélange le
  // cycle tout en visitant exactement une fois chacun des vingt emplacements.
  const slot = (cyclePosition * 7 + hash(`${zoneId}:skin-order`)) % count;
  const homeIndex = npcBiomeOrder.indexOf(homeBiome);
  let biome = homeBiome;
  if (homeIndex >= 0 && slot >= 15) {
    const previousShare = 2 + (hash(zoneId) % 2);
    const direction = slot < 15 + previousShare ? -1 : 1;
    biome = npcBiomeOrder[(homeIndex + direction + npcBiomeOrder.length) % npcBiomeOrder.length];
  }
  const variant = (slot + hash(`${zoneId}:skin-variant`)) % (npcVariantCounts[biome] || count);
  return `npc-${biome}-${variant}`;
}

export function characterAssetId(entity, state) {
  const variation = hash(entity.id);
  if (entity.presentation_name === 'Journaliste') return `journalist-${variation % 3}`;
  const dedicated = specialCharacterAssetId(entity, state);
  if (dedicated) return dedicated;
  if (entity.role === 'CANDIDAT' || entity.role === 'HOLOGRAMME') return `character-${entity.faction_id}`;
  if (entity.role === 'CRS') return `crs-${variation % 2}`;
  if (entity.role === 'SERVICE_D_ORDRE') return `security-${variation % 2}`;
  const origin = state.world?.subzones.find(z => z.id === entity.origin_subzone_id)
    || (state.world?.subzones.length ? zoneAt(state.world, entity.x) : null);
  const homeBiome = biomeArtId(origin?.biome_id || 'bobo');
  const appearance = npcAppearanceAssetId(entity, state, homeBiome);
  return entity.role === 'MILITANT' ? `${appearance}-militant` : appearance;
}

// Animation follows simulation events; no animation can delay or mutate a command.
export function characterAnimation(entity, state) {
  const attack = state.attacks?.find(a => a.owner_id === entity.id);
  // Renversé : l’étourdissement dure exactement le temps de la chute et du relevé.
  const downed = entity.combat?.knockdown_tick != null && entity.combat.stun_ticks > 0 && state.tick < entity.combat.invulnerable_until_tick;
  if (entity.is_ko || entity.debate_hp <= 0 || downed) return 'ko';
  if (entity.combat?.stun_ticks > 0) return Math.abs(entity.combat.knockback_velocity || 0) > 0.01 ? 'knockback' : 'hurt';
  if (attack?.kind === 'SPECIAL') return attack.elapsed_ticks < attack.windup_ticks + attack.active_ticks ? 'special_start' : 'special_recovery';
  if (attack) return attack.strong ? 'attack_heavy' : attack.step === 2 ? 'attack_light_2' : 'attack_light_1';
  if (entity.combat?.charge_active) return 'charged_attack';
  if (entity.special_active || entity.special_until_tick > state.tick) return 'special_start';
  if (!entity.moving && !entity.axis && entity.persuasion_target_ids?.length) return 'persuade';
  if (entity.persuasion) return 'persuade_listen';
  if (entity.converted_tick >= 0 && state.tick - entity.converted_tick < 12) return 'convert';
  if (entity.role === 'SYMPATHISANT' && entity.handoff_until_tick > state.tick) return 'interact_hold';
  if (entity.purchase_hold || entity.task?.phase === 'PICKUP') return 'interact_hold';
  if (entity.role === 'DEMOBILISE') return 'demobilised_return';
  if (entity.moving) return entity.combat?.engaged || entity.task?.kind === 'RAID' ? 'run' : 'walk';
  if (entity.meeting_target_id) return 'meeting';
  return 'idle';
}

/** Rang de profondeur dans la foule d'un meeting : 0 hors meeting, puis 1 (fond) à 3 (devant). */
export function meetingCrowdRow(entity, state) {
  if (entity.rally_event_id) return 1 + (entity.rally_index % 3);
  if (!entity.meeting_target_id) return 0;
  // Deux voisins d'un même flanc ne sont jamais sur le même rang : ils se tiennent côte à côte.
  return 1 + Math.floor((state ? meetingCrowdPlace(state, entity) : Number(entity.id?.slice(4)) || 0) / 2) % 3;
}

export function drawIllustratedCharacter(renderer, entity, x, state) {
  if (drawMinorCandidate(renderer, entity, x, state)) return true;
  if (drawMountedCandidate(renderer, entity, x, state)) return true;
  if (drawUltimateCharacter(renderer, entity, x, state)) return true;
  if (drawCandidateCombat(renderer, entity, x, state)) return true;
  const id = characterAssetId(entity, state);
  const source = renderer.assets.get(id);
  if (!source) { void renderer.assets.load(id); return false; }
  const { ctx, metrics: m, p } = renderer;
  const faction = p.factions[entity.faction_id];
  const sprite = entity.role === 'MILITANT' && faction
    ? militantSpriteForFaction(source, faction.color) : source;
  const spriteWidth = sprite.naturalWidth || sprite.width;
  const spriteHeight = sprite.naturalHeight || sprite.height;
  const time = state.tick / renderer.config.balance.simulation_architecture.fixed_tick_hz;
  const animation = characterAnimation(entity, state);
  // Foule : chaque rang est un peu plus bas et plus grand, comme s'il était plus proche de la caméra.
  const row = meetingCrowdRow(entity, state);
  const seed = Number(entity.id?.slice(4)) || 0;
  const rally = animation === 'meeting' ? state.buildings?.find(b => b.id === entity.meeting_target_id) : null;
  const supporter = !!rally && entity.role === 'SYMPATHISANT' && entity.faction_id === rally.meeting_faction_id;
  const cheer = rally && !entity.moving ? Math.max(0, Math.sin(time * 6.5 + seed * 1.7)) : 0;
  const groundY = m.groundY + m.characterHeight * (0.06 + (row ? row - 1 : 0) * 0.045);
  const feetY = groundY - (entity.combat?.height || 0) * m.characterHeight - cheer * m.characterHeight * (supporter ? 0.06 : 0.02);
  const candidate = entity.role === 'CANDIDAT';
  const height = m.characterHeight * (candidate ? 1 : p.npc_height_multiplier) * (1 + (row ? row - 1 : 0) * 0.04);
  const width = height * spriteWidth / spriteHeight;
  const walking = ['walk', 'run', 'demobilised_return'].includes(animation);
  const stride = walking ? Math.sin(time * (animation === 'run' ? 20 : 13)) : 0;
  const attack = state.attacks?.find(a => a.owner_id === entity.id);
  const attacking = candidate && animation.startsWith('attack');
  const windup = attack && attack.elapsed_ticks < attack.windup_ticks;
  const action = candidate
    ? attacking ? (windup ? -0.09 : attack?.strong ? 0.23 : 0.16) : animation === 'knockback' ? -0.25 : animation === 'special_start' ? -0.1 : animation === 'special_recovery' ? 0.07 : animation === 'interact_hold' ? 0.04 : 0
    : animation === 'interact_hold' ? 0.08 : 0;
  ctx.save();
  ctx.imageSmoothingEnabled = true;
  ctx.fillStyle = '#26313230'; ctx.beginPath(); ctx.ellipse(x, groundY, width * 0.48, 3, 0, 0, Math.PI * 2); ctx.fill();
  if (entity.role === 'ENCAPUCHONNE' && state.tick < entity.ready_tick) {
    ctx.beginPath(); ctx.rect(x - width, feetY - height * 1.1, width * 2, height * 1.1); ctx.clip();
    ctx.translate(0, height * (1 - (state.tick - entity.spawn_tick) / Math.max(1, entity.ready_tick - entity.spawn_tick)));
  }
  ctx.translate(x, feetY);
  ctx.scale(entity.facing < 0 ? -1 : 1, 1);
  if (animation === 'ko') ctx.translate(0, -width * .48);
  const sway = rally && !entity.moving ? Math.sin(time * 2.4 + seed) * 0.035 : 0;
  ctx.rotate(animation === 'ko' ? -Math.PI / 2 : action + stride * 0.025 + sway);
  ctx.globalAlpha = entity.role === 'DEMOBILISE' ? 0.5 : entity.role === 'HOLOGRAMME' ? 0.48 : 1;
  if (entity.role === 'HOLOGRAMME') { ctx.globalAlpha *= Math.min(1, (state.tick - (entity.spawn_tick || 0)) / Math.max(1, (entity.ready_tick || 1) - (entity.spawn_tick || 0))); ctx.shadowColor = '#6edbff'; ctx.shadowBlur = 12; }
  // Les PNJ restent statiques au repos ; seule la marche reçoit un léger mouvement procédural.
  const breathing = walking ? 1 + Math.sin(time * 3) * 0.004 : 1;
  ctx.scale(1 / breathing, breathing);
  // Deform the two leg regions around a fixed hip seam, reusing the master identity.
  if (walking) {
    const split = Math.floor(spriteHeight * 0.75);
    ctx.drawImage(sprite, 0, 0, spriteWidth, split, -width / 2, -height, width, height * 0.75);
    for (const side of [0, 1]) {
      ctx.drawImage(sprite, side * spriteWidth / 2, split, spriteWidth / 2, spriteHeight - split,
        -width / 2 + side * width / 2, -height * 0.25, width / 2, height * 0.25 - Math.max(0, stride * (side ? -1 : 1)) * 3);
    }
  } else ctx.drawImage(sprite, -width / 2, -height, width, height);
  ctx.shadowBlur = 0;
  if (faction && ['SYMPATHISANT', 'MILITANT', 'SERVICE_D_ORDRE'].includes(entity.role)) {
    const pinX = width * 0.10;
    const pinY = -height * (entity.role === 'MILITANT' ? 0.66 : 0.60);
    const pinRadius = Math.max(4, height * (entity.role === 'MILITANT' ? 0.04 : 0.05));
    ctx.fillStyle = faction.color;
    ctx.beginPath();
    ctx.arc(pinX, pinY, pinRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#fff5df';
    ctx.lineWidth = Math.max(2, pinRadius * 0.36);
    ctx.stroke();
    ctx.strokeStyle = '#263132';
    ctx.lineWidth = 1;
    ctx.stroke();
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
  drawRallyAccessories(renderer, entity, x, feetY, height, state);
  ctx.save(); ctx.textAlign = 'center';
  if (supporter && !entity.moving && seed % 2 === 0) {
    // Pancarte brandie au rythme des acclamations, texte toujours lisible (dessinée hors du miroir).
    const side = entity.facing < 0 ? -1 : 1;
    const stickX = x - side * width * 0.28;
    const signW = Math.max(18, width * 0.62), signH = Math.max(11, height * 0.17);
    const signY = feetY - height * 1.02 - signH - cheer * 3;
    ctx.strokeStyle = '#5a4630'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(stickX, feetY - height * 0.55); ctx.lineTo(stickX, signY + signH); ctx.stroke();
    ctx.fillStyle = faction.color; ctx.strokeStyle = '#263132'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.roundRect(stickX - signW / 2, signY, signW, signH, 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#fff9e9'; ctx.font = `800 ${Math.round(signH * 0.62)}px system-ui`; ctx.textBaseline = 'middle';
    ctx.fillText(faction.symbol || '★', stickX, signY + signH / 2 + 0.5, signW - 4);
    ctx.textBaseline = 'alphabetic';
  }
  if (['persuade', 'interact_hold', 'persuade_listen'].includes(animation)) {
    const wave = Math.sin(time * 5);
    ctx.fillStyle = '#fff7e4'; ctx.strokeStyle = '#29353b'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.roundRect(x + 14, feetY - height - 13 + wave, 24, 17, 6); ctx.fill(); ctx.stroke();
    ctx.fillStyle = faction?.color || '#364548'; ctx.font = 'bold 12px system-ui';
    ctx.fillText(animation === 'interact_hold' ? '…' : '!', x + 26, feetY - height + wave);
  }
  if (entity.persuasion) {
    const progress = entity.persuasion.elapsed_ticks / entity.persuasion.required_ticks;
    ctx.strokeStyle = p.factions[[...state.candidates, ...state.npcs].find(c => c.id === entity.persuasion.actor_id)?.faction_id]?.color || '#436d5c';
    ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, feetY - height - 9, 5, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * progress); ctx.stroke();
  }
  if (animation === 'convert') {
    ctx.font = 'bold 16px system-ui'; ctx.fillStyle = faction?.color || '#476e5d'; ctx.fillText('♥', x, feetY - height - 8);
    // Petit cercle au sol : le PNJ vient de changer de camp.
    const t = Math.min(1, (state.tick - entity.converted_tick) / 12);
    ctx.globalAlpha = 1 - t; ctx.strokeStyle = faction?.color || '#476e5d'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(x, groundY, width * (0.3 + t * 0.5), 3 + t * 4, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.globalAlpha = 1;
  }
  if (animation === 'ko') {
    ctx.font = 'bold 13px system-ui'; ctx.fillStyle = '#ffd66b'; ctx.strokeStyle = '#51412e'; ctx.lineWidth = 2;
    const headX = animation === 'ko' ? x - height * 0.85 : x;
    const headY = animation === 'ko' ? feetY - 20 : feetY - height - 6;
    for (let i = 0; i < 3; i++) { const sx = headX + Math.cos(time * 3 + i * 2.1) * 14; const sy = headY + Math.sin(time * 3 + i * 2.1) * 3; ctx.strokeText('✦', sx, sy); ctx.fillText('✦', sx, sy); }
  }
  ctx.restore();
  return true;
}

