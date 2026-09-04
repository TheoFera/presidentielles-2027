import { ringDelta, wrap, zoneAt } from '../simulation/world.js';
import { drawInfrastructure, drawBanknote } from './infrastructure.js';
import { drawCombatEffects } from './combat-effects.js';
import { drawTerritoryFlags } from './electoral.js';
import { drawArena } from './match.js';

export function compositionMetrics(config, width, height) {
  const ratios = config.layout.visual_layout;
  return {
    width, height, groundY: height * ratios.player_ground_y_ratio,
    groundThickness: height * ratios.visible_ground_thickness_ratio,
    characterHeight: height * ratios.character_height_ratio,
    anchorX: width * ratios.camera_anchor_x_ratio,
    pixelsPerUnit: width / config.prototype.world.units_per_screen * config.balance.camera.default_zoom,
  };
}

export class WorldRenderer {
  constructor(canvas, config) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.config = config;
    this.p = config.prototype.presentation;
    this.width = this.p.reference_width;
    this.height = this.p.reference_height;
    this.metrics = compositionMetrics(config, this.width, this.height);
    this.cameraX = null;
    this.followedId = null;
    this.resize();
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(canvas);
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    const pixelRatio = Math.min(window.devicePixelRatio || 1, this.p.max_pixel_ratio);
    this.canvas.width = Math.max(1, Math.round(rect.width * pixelRatio));
    this.canvas.height = Math.max(1, Math.round(rect.height * pixelRatio));
  }

  resetCamera() { this.cameraX = null; }

  draw(state, previous, alpha, elapsed, debug = false) {
    if (state.phase === 'FIRST_ROUND_ARENA') { drawArena(this, state.arena, previous.arena, alpha); return; }
    const ctx = this.ctx;
    const m = this.metrics;
    const candidate = state.candidates.find(c => c.id === state.local_candidate_id);
    const oldCandidate = previous.candidates.find(c => c.id === candidate.id) || candidate;
    const playerX = wrap(oldCandidate.x + ringDelta(oldCandidate.x, candidate.x, state.world.length) * alpha, state.world.length);
    const lookAhead = candidate.axis * this.config.balance.camera.look_ahead_ratio * this.config.prototype.world.units_per_screen;
    if (this.cameraX === null || this.followedId !== candidate.id) this.cameraX = playerX;
    this.followedId = candidate.id;
    const smoothing = 1 - Math.pow(1 - this.config.balance.camera.follow_smoothing, elapsed * this.p.smoothing_reference_hz);
    this.cameraX = wrap(this.cameraX + ringDelta(this.cameraX, playerX + lookAhead, state.world.length) * smoothing, state.world.length);
    this.screenX = x => m.anchorX + ringDelta(this.cameraX, x, state.world.length) * m.pixelsPerUnit;
    ctx.setTransform(this.canvas.width / this.width, 0, 0, this.canvas.height / this.height, 0, 0);
    ctx.imageSmoothingEnabled = false;
    const zone = zoneAt(state.world, playerX);
    const palette = this.p.biome_palettes[zone.biome_id];
    ctx.fillStyle = palette.sky;
    ctx.fillRect(0, 0, this.width, this.height);
    this.drawFarScenery(state, palette);
    const screenUnits = this.width / m.pixelsPerUnit;
    for (const subzone of state.world.subzones) {
      const left = this.screenX(subzone.start);
      if (left > this.width || left + subzone.width * m.pixelsPerUnit < 0) continue;
      this.drawZone(subzone, left, this.p.biome_palettes[subzone.biome_id], state);
    }
    drawInfrastructure(this, state);
    drawTerritoryFlags(this, state);
    ctx.fillStyle = this.p.ground_edge;
    ctx.fillRect(0, m.groundY, this.width, 2);
    ctx.fillStyle = this.p.ground_tone;
    ctx.fillRect(0, m.groundY + 2, this.width, m.groundThickness - 2);
    // The final margin shares the sky colour: no road, water or decorative foreground.
    ctx.fillStyle = palette.sky;
    ctx.fillRect(0, m.groundY + m.groundThickness, this.width, this.height);
    const oldNpcs = new Map(previous.npcs.map(n => [n.id, n]));
    const entities = [...state.npcs, ...state.temporary_units, ...state.candidates.filter(c => !c.eliminated && !c.disappeared && c.id !== candidate.id), ...(!candidate.eliminated && !candidate.disappeared ? [candidate] : [])];
    for (const entity of entities) {
      if (Math.abs(ringDelta(this.cameraX, entity.x, state.world.length)) > screenUnits * 0.6) continue;
      const old = oldNpcs.get(entity.id) || previous.candidates.find(c => c.id === entity.id) || entity;
      const x = wrap(old.x + ringDelta(old.x, entity.x, state.world.length) * alpha, state.world.length);
      this.drawPerson(entity, this.screenX(x), state);
    }
    drawBanknote(this, state);
    drawCombatEffects(this, state, debug);
    if (!candidate.eliminated && candidate.resistance < this.config.balance.candidate_combat.resistance_max) {
      const injury = 1 - candidate.resistance / this.config.balance.candidate_combat.resistance_max;
      const gradient = ctx.createRadialGradient(this.width / 2, this.height / 2, this.height * 0.22, this.width / 2, this.height / 2, this.width * 0.65);
      gradient.addColorStop(0, '#8f101000'); gradient.addColorStop(0.68, '#8f101000'); gradient.addColorStop(1, `rgba(145, 12, 12, ${0.08 + injury * 0.48})`);
      ctx.fillStyle = gradient; ctx.fillRect(0, 0, this.width, this.height);
    }
    if (debug) this.drawDebug(state, candidate);
  }

  drawFarScenery(state, palette) {
    const ctx = this.ctx;
    const ground = this.metrics.groundY;
    ctx.fillStyle = palette.far;
    // Repeating distant blocks use a world-periodic coordinate, so the seam never pops.
    const spacing = this.width / 8;
    const phase = this.cameraX / state.world.length * Math.PI * 2;
    const offset = Math.sin(phase) * this.width * this.p.background_parallax_ratio;
    for (let i = -3; i < 12; i++) {
      const h = 70 + ((i + 24) % 4) * 23;
      ctx.fillRect(i * spacing - offset, ground - h - 50, spacing - 15, h + 50);
    }
    ctx.globalAlpha = 0.3;
    ctx.fillStyle = palette.accent;
    ctx.fillRect(0, ground - 77, this.width, 77);
    ctx.globalAlpha = 1;
  }

  drawZone(zone, left, palette, state) {
    const ctx = this.ctx;
    const m = this.metrics;
    const width = zone.width * m.pixelsPerUnit;
    // Ordinary architecture, never the seven future gameplay buildings.
    for (const block of state.world.scenery.filter(s => s.subzone_id === zone.id)) {
      const x = left + (block.x - zone.start) * m.pixelsPerUnit;
      const h = this.p.building_height_ratios[block.variant] * this.height;
      const w = this.p.building_width_ratios[block.variant] * width;
      const top = m.groundY - h;
      const rural = ['campagne', 'retraites'].includes(zone.biome_id);
      ctx.fillStyle = this.p.building_edge;
      ctx.fillRect(x - 3, top - 4, w + 6, h + 4);
      ctx.fillStyle = this.p.building_tone;
      ctx.fillRect(x, top, w, h);
      if (rural) {
        ctx.fillStyle = palette.accent;
        ctx.beginPath(); ctx.moveTo(x - 10, top + 8); ctx.lineTo(x + w / 2, top - 24); ctx.lineTo(x + w + 10, top + 8); ctx.fill();
      } else {
        ctx.fillStyle = palette.accent; ctx.fillRect(x - 4, top - 4, w + 8, 10);
      }
      ctx.fillStyle = this.p.window_tone;
      for (let row = 0; row < 3; row++) {
        for (let col = 0; col < 3; col++) {
          ctx.fillRect(x + 18 + col * (w - 36) / 3, top + 29 + row * (h - 96) / 3, (w - 60) / 3, 26);
        }
      }
      ctx.fillStyle = this.p.building_edge;
      ctx.fillRect(x + w * 0.36, m.groundY - 58, w * 0.28, 58);
      ctx.fillStyle = palette.sky;
      ctx.fillRect(x + w * 0.48, m.groundY - 35, 3, 5);
      if (zone.biome_id === 'periurbain_usine') {
        ctx.fillStyle = this.p.building_edge; ctx.fillRect(x + w * 0.72, top - 51, 21, 47);
      }
    }
    // One low-detail meeting place around each social point.
    const center = left + width * 0.5;
    if (zone.biome_id === 'banlieue' && zone.local_index === 1) {
      ctx.fillStyle = this.p.building_edge;
      ctx.fillRect(center - 90, m.groundY - 132, 5, 130); ctx.fillRect(center + 85, m.groundY - 132, 5, 130);
      ctx.fillStyle = palette.accent; ctx.fillRect(center - 101, m.groundY - 139, 202, 15);
      ctx.fillStyle = this.p.building_tone; ctx.fillRect(center - 91, m.groundY - 52, 182, 35);
    } else {
      this.drawTree(left + width * 0.37, m.groundY, palette);
      ctx.fillStyle = this.p.building_edge;
      ctx.fillRect(center + 30, m.groundY - 26, 55, 7); ctx.fillRect(center + 34, m.groundY - 19, 5, 19); ctx.fillRect(center + 75, m.groundY - 19, 5, 19);
    }
    // Discreet diegetic zone sign, well above the people. No HUD banner.
    // The new neutral service occupies this space; lift only the obscured street sign.
    const hasPrinter = state.buildings.some(b => b.type === 'imprimerie' && b.subzone_id === zone.id);
    const labelGroundOffset = hasPrinter ? this.p.infrastructure.height_ratio * this.height + 56 : 210;
    ctx.textAlign = 'center';
    ctx.font = '600 13px system-ui'; ctx.fillStyle = '#56665e';
    ctx.fillText(zone.biome_name.toLocaleUpperCase('fr-FR'), center, m.groundY - labelGroundOffset);
    ctx.font = '11px system-ui';
    ctx.fillText(zone.concept, center, m.groundY - labelGroundOffset + 19);
    if (zone.local_index === 1) {
      ctx.font = '10px system-ui'; ctx.fillStyle = palette.accent;
      ctx.fillText(palette.landmark, center, m.groundY - labelGroundOffset + 40);
    }
  }

  drawTree(x, ground, palette) {
    const ctx = this.ctx;
    ctx.fillStyle = this.p.building_edge;
    ctx.fillRect(x - 5, ground - 113, 10, 113);
    ctx.fillStyle = palette.accent;
    ctx.fillRect(x - 34, ground - 148, 68, 42);
    ctx.fillRect(x - 22, ground - 170, 46, 28);
    ctx.fillRect(x - 43, ground - 134, 86, 21);
  }

  drawPerson(entity, x, state) {
    const ctx = this.ctx;
    const candidate = entity.role === 'CANDIDAT';
    const height = this.metrics.characterHeight * (candidate ? 1 : this.p.npc_height_multiplier);
    const pixel = height / 27;
    const ground = this.metrics.groundY;
    const faction = this.p.factions[entity.faction_id];
    const recentlyHit = state.tick - (entity.combat?.last_hit?.tick ?? -100) < 3 && entity.combat?.last_hit?.target_id === entity.id;
    const tone = recentlyHit ? '#eee5c8' : entity.role === 'CRS' ? '#394b61' : faction?.color || this.p.neutral_tone;
    const time = state.tick / this.config.balance.simulation_architecture.fixed_tick_hz;
    const walk = entity.moving ? Math.sin(time * this.p.animation_walk_hz * Math.PI * 2) : 0;
    const swing = Math.round(walk * 2);
    const persuading = entity.persuasion_target_ids?.length > 0;
    const celebrating = ['SYMPATHISANT', 'MILITANT'].includes(entity.role) && !entity.combat?.engaged && state.buildings.some(b => b.type === 'meeting'
      && b.state === 'ACTIVE' && b.owner_id === entity.faction_id && b.subzone_id === zoneAt(state.world, entity.x).id && b.meeting_until_tick > state.tick);
    ctx.save();
    ctx.translate(Math.round(x), Math.round(ground));
    ctx.globalAlpha = entity.role === 'DEMOBILISE' ? 0.55 : entity.role === 'HOLOGRAMME' ? 0.48 : 1;
    ctx.fillStyle = '#32403a25';
    ctx.fillRect(-8 * pixel, -pixel, 16 * pixel, pixel);
    ctx.scale(pixel, pixel);
    const rect = (x, y, w, h, color) => { ctx.fillStyle = color; ctx.fillRect(x, y, w, h); };
    const outline = this.p.outline_tone;
    const attack = state.attacks.find(a => a.owner_id === entity.id);
    const windup = attack && attack.elapsed_ticks < attack.windup_ticks;
    if (entity.combat?.stun_ticks > 0) ctx.transform(1, 0, -(entity.combat.knockback_velocity > 0 ? 0.12 : -0.12), 1, 0, 0);
    // Two legs, shoes, two arms, torso and a stepped pixel head.
    rect(-4 - Math.max(0, swing), -10, 4, 10 - Math.max(0, -swing), outline);
    rect(1 + Math.max(0, swing), -10, 4, 10 - Math.max(0, swing), outline);
    rect(-5 - Math.max(0, swing), -2 - Math.max(0, -swing), 5, 2, outline);
    rect(1 + Math.max(0, swing), -2 - Math.max(0, swing), 5, 2, outline);
    rect(-5, -20, 11, 12, outline);
    rect(-4, -19, 9, 10, tone);
    rect(-8, -19 + swing, 3, 10, outline);
    rect(-7, -18 + swing, 2, 6, tone);
    rect(-7, -12 + swing, 2, 3, this.p.skin_tone);
    const raised = celebrating ? -5 + Math.round(Math.sin(time * 7)) : persuading || entity.task?.phase === 'PICKUP' ? -3 : -swing;
    rect(6, -19 + raised, 3, 10, outline);
    rect(6, -18 + raised, 2, 6, tone);
    rect(6, -12 + raised, 2, 3, this.p.skin_tone);
    rect(-4, -26, 9, 7, outline);
    rect(-3, -27, 7, 1, outline);
    rect(-3, -25, 7, 5, this.p.skin_tone);
    rect(-3, -26, 7, 2, candidate ? '#bbbdb6' : outline);
    rect(entity.facing > 0 ? 2 : -3, -23, 1, 1, outline);
    rect(entity.facing > 0 ? 4 : -4, -23, 1, 2, this.p.skin_tone);
    if (candidate || ['SYMPATHISANT', 'MILITANT', 'SERVICE_D_ORDRE', 'HOLOGRAMME', 'CRS'].includes(entity.role)) {
      ctx.fillStyle = '#fff9e9'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = `bold ${candidate ? 6 : 5}px monospace`;
      const symbol = { MILITANT: 'M', SYMPATHISANT: 'S', SERVICE_D_ORDRE: 'SO', HOLOGRAMME: 'M', CRS: 'CRS' };
      ctx.font = `bold ${entity.role === 'CRS' ? 3.7 : entity.role === 'SERVICE_D_ORDRE' ? 4.3 : candidate ? 6 : 5}px monospace`;
      ctx.fillText(candidate ? faction.symbol : symbol[entity.role], 0.5, -14);
    }
    if (entity.role === 'MILITANT' || entity.task?.phase === 'PICKUP') {
      rect(7, -16, 4, 6, this.p.infrastructure.paper_tone);
      rect(8, -15, 2, 1, tone); rect(8, -13, 2, 1, tone);
    }
    if (entity.role === 'SERVICE_D_ORDRE' || entity.task?.kind === 'COLLECT_EQUIPMENT' && entity.task.phase === 'PICKUP') {
      rect(entity.facing > 0 ? 10 : -11, -24, 2, 16, '#595143');
      rect(-4, -27, 9, 3, tone);
    }
    if (entity.role === 'CRS') { rect(entity.facing > 0 ? 8 : -12, -23, 5, 18, '#718295'); rect(-4, -27, 9, 3, '#344456'); }
    if (attack) {
      const direction = attack.direction;
      const reach = windup ? 5 : attack.strong ? 17 : attack.step === 2 ? 13 : 11;
      const y = windup ? -21 : attack.strong ? -16 : -19;
      rect(direction > 0 ? 5 : -reach, y, reach - 3, attack.strong ? 5 : 3, outline);
      rect(direction > 0 ? reach - 1 : -reach, y, 4, attack.strong ? 5 : 3, this.p.skin_tone);
      if (!windup && attack.strong) rect(direction > 0 ? reach + 4 : -reach - 4, y - 2, 2, 9, '#fff2c5');
    }
    if (candidate && entity.special_charge >= this.config.balance.special_charge.required_points) {
      for (const eye of [-1, 3]) { rect(eye - 1, -25, 3, 1, '#ffe277'); rect(eye, -26, 1, 3, '#ffe277'); }
      rect(-5, -30, 2, 2, '#ffe277'); rect(5, -31, 2, 2, '#ffe277');
    }
    ctx.restore();
    if (persuading) {
      ctx.fillStyle = tone;
      ctx.fillRect(x + 17, ground - height - 7, 3, 3);
      ctx.fillRect(x + 23, ground - height - 10, 3, 3);
    }
    if (entity.persuasion) {
      const progress = entity.persuasion.elapsed_ticks / entity.persuasion.required_ticks;
      const actor = [...state.candidates, ...state.npcs].find(c => c.id === entity.persuasion.actor_id);
      ctx.strokeStyle = this.p.factions[actor?.faction_id]?.color || this.p.neutral_tone;
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(x, ground - height - 10, 5, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * progress); ctx.stroke();
    }
    const sinceConversion = (state.tick - entity.converted_tick) / this.config.balance.simulation_architecture.fixed_tick_hz;
    if (entity.role === 'SYMPATHISANT' && entity.converted_tick >= 0 && sinceConversion < this.p.conversion_flash_seconds) {
      ctx.fillStyle = tone; ctx.textAlign = 'center'; ctx.font = 'bold 15px system-ui';
      ctx.fillText('♥', x, ground - height - 9 - sinceConversion * 15);
    }
  }

  drawDebug(state, candidate) {
    const ctx = this.ctx;
    const m = this.metrics;
    const x = this.screenX(candidate.x);
    const radius = this.config.prototype.persuasion.radius_units * m.pixelsPerUnit;
    ctx.save();
    ctx.strokeStyle = '#b34c55'; ctx.lineWidth = 1; ctx.setLineDash([4, 4]);
    ctx.beginPath(); ctx.moveTo(m.anchorX, 0); ctx.lineTo(m.anchorX, m.groundY); ctx.stroke();
    ctx.strokeRect(x - radius, m.groundY - m.characterHeight - 22, radius * 2, m.characterHeight + 22);
    for (const zone of state.world.subzones) {
      const zx = this.screenX(zone.start);
      if (zx < 0 || zx > this.width) continue;
      ctx.strokeStyle = '#7b8d79'; ctx.beginPath(); ctx.moveTo(zx, 160); ctx.lineTo(zx, m.groundY); ctx.stroke();
    }
    ctx.setLineDash([]); ctx.font = '10px monospace'; ctx.textAlign = 'center'; ctx.fillStyle = '#35483e';
    for (const npc of state.npcs) {
      const nx = this.screenX(npc.x);
      if (nx < 0 || nx > this.width) continue;
      ctx.fillText(npc.id, nx, m.groundY - m.characterHeight * this.p.npc_height_multiplier - 25);
    }
    ctx.restore();
  }
}
