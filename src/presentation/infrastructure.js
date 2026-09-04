import { localSympathisants } from '../simulation/territory.js';
import { nearestOffer } from '../simulation/economy.js';
import { buildingLabel, buildingSettings, factionVariant } from '../simulation/building-rules.js';
import { drawElectoralBuilding } from './electoral.js';

const labels = { permanence: 'PERMANENCE', financement: 'FINANCEMENT', imprimerie: 'IMPRIMERIE' };

export function drawInfrastructure(renderer, state) {
  const { ctx, metrics: m, config, p, height, width } = renderer;
  const candidate = state.candidates.find(c => c.id === state.local_candidate_id);
  const settings = p.infrastructure;
  const h = settings.height_ratio * height;
  for (const building of state.buildings) {
    if (['tour_communication', 'institut_sondage', 'meeting'].includes(building.type)) { drawElectoralBuilding(renderer, state, building); continue; }
    const w = (building.type === 'faction' ? settings.faction_width_ratio : settings.width_ratio) * width;
    const x = renderer.screenX(building.x);
    if (x + w / 2 < 0 || x - w / 2 > width) continue;
    const left = Math.round(x - w / 2);
    const ground = m.groundY;
    const top = Math.round(ground - h);
    const faction = p.factions[building.owner_id];
    const variant = building.type === 'faction' ? building.variant || factionVariant(candidate.faction_id) : building.type;
    const label = building.headquarters ? 'QG' : variant === 'service_ordre' ? 'LOCAL SO' : variant === 'cabinet_administratif' ? 'CABINET' : labels[building.type] || (building.type === 'meeting' ? 'SALLE' : building.type === 'institut_sondage' ? 'SONDAGES' : 'SITE');
    ctx.save();
    ctx.fillStyle = p.building_edge; ctx.fillRect(left - 3, top - 4, w + 6, h + 4);
    ctx.fillStyle = building.type === 'imprimerie' ? settings.printer_tone : p.building_tone;
    ctx.fillRect(left, top, w, h);
    ctx.fillStyle = faction?.color || '#78817d'; ctx.fillRect(left - 4, top - 5, w + 8, 10);
    ctx.fillStyle = '#e9ebe2'; ctx.fillRect(left + 9, top + 21, w - 18, 29);
    ctx.fillStyle = '#35433c'; ctx.textAlign = 'center'; ctx.font = '700 13px system-ui';
    ctx.fillText(label, x, top + 40);
    ctx.fillStyle = p.window_tone;
    ctx.fillRect(left + 17, top + 66, w - 34, 76);
    ctx.fillStyle = p.building_edge; ctx.fillRect(left + w / 2 - 24, ground - 86, 48, 86);
    ctx.fillStyle = '#c4cfc6'; ctx.fillRect(left + w / 2 + 11, ground - 43, 3, 6);
    if (faction) {
      ctx.fillStyle = p.building_edge; ctx.fillRect(left + w - 20, top - 29, 3, 42);
      ctx.fillStyle = faction.color; ctx.fillRect(left + w - 17, top - 28, 27, 17);
      for (let level = 0; level < building.level; level++) { ctx.fillStyle = faction.color; ctx.fillRect(x - 12 + level * 10, top + 57, 6, 4); }
    }
    if (building.type === 'imprimerie') {
      // Visible press and paper stack; the facade always remains neutral.
      ctx.fillStyle = '#52615a'; ctx.fillRect(left + 36, top + 87, w - 72, 37);
      ctx.fillStyle = '#cdd2c9'; ctx.fillRect(left + 43, top + 92, w - 86, 11);
      ctx.fillStyle = settings.paper_tone;
      for (let index = 0; index < building.queue.length; index++) ctx.fillRect(x + 20 + index * 3, ground - 105 - index * 4, 18, 11);
      const printing = building.queue.find(order => order.state === 'PRINTING');
      if (printing) {
        const duration = config.balance.buildings.imprimerie.equipment_seconds_by_level[0] * config.balance.simulation_architecture.fixed_tick_hz;
        ctx.fillRect(x - 10, top + 115, 20, 3 + printing.production_elapsed_ticks / duration * 12);
      }
    } else if (building.type === 'financement') {
      ctx.fillStyle = '#e5e4d6'; ctx.font = '600 33px system-ui'; ctx.fillText('€', x, top + 117);
    } else if (building.type === 'faction') {
      ctx.fillStyle = '#e5e4d6'; ctx.font = '600 22px system-ui'; ctx.fillText(variant === 'service_ordre' ? 'SO' : 'DOSSIERS', x, top + 115);
      if (building.state === 'ACTIVE') {
        const offsets = config.balance.faction_interactions;
        ctx.font = '600 9px system-ui'; ctx.fillStyle = '#46544c';
        ctx.fillText(variant === 'service_ordre' ? '← RAID' : '← FERMER', renderer.screenX(building.x - offsets.side_offset), ground - 7);
        ctx.fillText(variant === 'service_ordre' ? 'RAID →' : 'FERMER →', renderer.screenX(building.x + offsets.side_offset), ground - 7);
        if (building.level < buildingSettings(config, building).max_level) ctx.fillText('↑', renderer.screenX(building.x + offsets.upgrade_offset), ground - 8);
      }
    } else {
      ctx.fillStyle = faction?.color || '#78817d'; ctx.fillRect(x - 17, top + 79, 34, 43);
      if (faction) { ctx.fillStyle = '#fff9e9'; ctx.font = 'bold 20px system-ui'; ctx.fillText(faction.symbol, x, top + 108); }
    }
    if (building.level >= 2 && building.ownership_model !== 'neutral_service') { ctx.fillStyle = faction?.color || '#78817d'; ctx.fillRect(left + 18, top - 19, 18, 15); }
    if (building.level >= 3 && building.ownership_model !== 'neutral_service') { ctx.fillStyle = faction?.color || '#78817d'; ctx.fillRect(left + w - 36, top - 28, 18, 24); }
    if (building.headquarters) { ctx.strokeStyle = '#f0d36a'; ctx.lineWidth = 4; ctx.strokeRect(left - 7, top - 9, w + 14, h + 9); }
    if (building.closure_progress > 0) { ctx.fillStyle = `rgba(120, 126, 123, ${Math.min(0.82, building.closure_progress * 0.82)})`; ctx.fillRect(left, top, w, h); }
    if (building.type === 'financement' && building.funding_state === 'RUNNING') {
      ctx.fillStyle = '#e8ce63'; ctx.font = 'bold 18px system-ui'; ctx.fillText(state.tick % 20 < 10 ? '€' : '·€·', x, top + 72);
    }
    if (building.state === 'CLOSED') {
      ctx.fillStyle = '#757c76cc'; ctx.fillRect(left, top + 52, w, h - 52);
      ctx.strokeStyle = '#b45151'; ctx.lineWidth = 5; ctx.beginPath();
      ctx.moveTo(left + 20, top + 72); ctx.lineTo(left + w - 20, ground - 25);
      ctx.moveTo(left + w - 20, top + 72); ctx.lineTo(left + 20, ground - 25); ctx.stroke();
      ctx.fillStyle = '#f2ecdf'; ctx.fillRect(x - 40, top + 93, 80, 24);
      ctx.fillStyle = '#7e3737'; ctx.font = 'bold 12px system-ui'; ctx.fillText('FERMÉ', x, top + 110);
    }
    const sinceAction = (state.tick - building.last_action_tick) / config.balance.simulation_architecture.fixed_tick_hz;
    if (building.last_action_tick >= 0 && sinceAction < settings.construction_flash_seconds) {
      ctx.strokeStyle = '#f9f6dd'; ctx.lineWidth = 3; ctx.strokeRect(left - 2, top - 3, w + 4, h + 3);
    }
    ctx.restore();
  }
}

export function drawBanknote(renderer, state) {
  const { ctx, config, p, metrics: m } = renderer;
  const candidate = state.candidates.find(c => c.id === state.local_candidate_id);
  if (!candidate.interaction_active || !candidate.campaign_active) return;
  const offer = nearestOffer(state, config, candidate);
  if (!offer) return;
  const building = state.buildings.find(b => b.id === offer.target_id);
  const x = renderer.screenX(offer.x ?? building.x);
  const w = p.infrastructure.banknote_width;
  const h = p.infrastructure.banknote_height;
  const y = m.groundY - m.characterHeight - h - 16;
  ctx.save();
  ctx.fillStyle = offer.enabled ? '#e9ebd6' : '#d4d8d0';
  ctx.strokeStyle = offer.enabled ? '#62745a' : '#8a938b';
  ctx.lineWidth = 1;
  ctx.fillRect(x - w / 2, y, w, h); ctx.strokeRect(x - w / 2, y, w, h);
  ctx.strokeRect(x - w / 2 + 4, y + 5, 13, h - 10);
  ctx.fillStyle = offer.enabled ? '#354b35' : '#858e85';
  ctx.font = '600 13px system-ui'; ctx.textAlign = 'center';
  const price = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: config.balance.display.currency_precision_decimals }).format(offer.cost);
  ctx.fillText(`${price} ${config.balance.display.currency_label}`, x + 8, y + 19);
  if (!offer.enabled) {
    ctx.beginPath(); ctx.moveTo(x - w / 2 + 3, y + h - 3); ctx.lineTo(x - w / 2 + 18, y + 3); ctx.stroke();
  }
    if (candidate.purchase_hold?.key === offer.key) {
    ctx.fillStyle = '#637c51';
      ctx.fillRect(x - w / 2 + 2, y + h - 3, (w - 4) * candidate.purchase_hold.elapsed_ticks / offer.required_ticks, 2);
    }
    if (building.ownership_model === 'capturable') {
      const max = buildingSettings(config, building, candidate.faction_id).max_level;
      for (let level = 1; level <= max; level++) {
        const segmentWidth = (w - 12) / max; const sx = x - w / 2 + 6 + (level - 1) * segmentWidth;
        ctx.fillStyle = level <= building.level ? '#637c51' : level === building.level + 1 && offer.enabled ? '#b9c5ac' : '#aeb3ae';
        ctx.fillRect(sx, y + h - 8, segmentWidth - 2, 4);
      }
    }
  if (offer.reason === 'CAMPAIGN_BUDGET_EXCEEDED') {
    ctx.fillStyle = '#7e3737'; ctx.font = '600 11px system-ui';
    ctx.fillText('Plafond de campagne insuffisant', x, y + h + 14);
  }
  if (offer.label || offer.kind === 'REBUILD') {
    if (offer.victim_id) { ctx.fillStyle = '#f2f0e5ee'; ctx.fillRect(x - 86, y - 31, 172, 27); }
    ctx.fillStyle = '#39483f'; ctx.font = '600 9px system-ui'; ctx.fillText(offer.label || 'RECONSTRUIRE', x, y - 7);
    if (offer.victim_id) {
      const victim = state.buildings.find(b => b.id === offer.victim_id);
      ctx.font = '9px system-ui'; ctx.fillText(`${buildingLabel(victim)} · ${victim.subzone_id}`, x, y - 20);
    }
  }
  ctx.restore();
}
