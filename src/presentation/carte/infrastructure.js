import { localPoliticalPresence } from '../../simulation/strategic-sites.js';
import { nearestOffer } from '../../simulation/economy.js';
import { buildingLabel, buildingSettings, factionVariant } from '../../simulation/building-rules.js';
import { drawElectoralBuilding, meetingSpriteFrame } from './electoral.js';
import { drawIllustratedBuilding, buildingAssetId, buildingGeometry } from './illustrated-buildings.js';
import { formatNumber } from '../interface/number-format.js';
import { formatEuros } from './money.js';

const labels = { permanence: 'PERMANENCE', financement: 'FINANCEMENT', imprimerie: 'IMPRIMERIE', tour_communication: 'COMMUNICATION' };

export function drawInfrastructure(renderer, state) {
  const { ctx, metrics: m, config, p, height, width } = renderer;
  const candidate = state.candidates.find(c => c.id === state.local_candidate_id);
  const settings = p.infrastructure;
  const h = settings.height_ratio * height;
  for (const building of state.buildings) {
    if (building.type === 'meeting') { drawElectoralBuilding(renderer, state, building); continue; }
    if (drawIllustratedBuilding(renderer, state, building)) continue;
    if (building.type === 'institut_sondage') { drawElectoralBuilding(renderer, state, building); continue; }
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
      if (building.state === 'ACTIVE' && building.level < config.balance.buildings.financement.max_level) {
        const upgradeX = renderer.screenX(building.x + config.balance.buildings.financement.upgrade_offset);
        ctx.fillStyle = '#46544c'; ctx.font = '600 9px system-ui'; ctx.fillText('↑ AMÉLIORER', upgradeX, ground - 8);
      }
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
    if (building.type === 'financement' && building.state === 'ACTIVE') {
      ctx.fillStyle = '#4c574f'; ctx.fillRect(left + 12, top + 143, w - 24, 22);
      ctx.fillStyle = '#f4dc72'; ctx.font = 'bold 12px system-ui'; ctx.fillText(`Cagnotte : ${formatEuros(building.stored_money_cents)}`, x, top + 158);
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
  const { ctx, config, p } = renderer;
  const candidate = state.candidates.find(c => c.id === state.local_candidate_id);
  if (!candidate.interaction_active || !candidate.campaign_active) return;
  const offer = nearestOffer(state, config, candidate);
  if (!offer) return;
  const building = state.buildings.find(b => b.id === offer.target_id);
  // Pendant un meeting, l'applaudimètre remplace le billet.
  if (building.type === 'meeting' && building.meeting_candidate_id) return;
  let x = renderer.screenX(offer.x ?? building.x);
  const w = p.infrastructure.banknote_width;
  const h = p.infrastructure.banknote_height;
  let y = Math.max(60, buildingGeometry(renderer, building).top - h - 24);
  if (building.type === 'meeting') {
    const frame = meetingSpriteFrame(renderer, state, building);
    if (frame) {
      const left = renderer.visibleWorld?.left ?? 0;
      const right = renderer.visibleWorld?.right ?? renderer.width;
      x = Math.max(left + w / 2 + 8, Math.min(right - w / 2 - 8, x));
      y = Math.max(40, frame.top - h - 8);
    }
  }
  ctx.save();
  const progress = offer.enabled && candidate.purchase_hold?.key === offer.key ? candidate.purchase_hold.elapsed_ticks / offer.required_ticks : 0;
  const left = (renderer.visibleWorld?.left ?? 0) + 112, right = (renderer.visibleWorld?.right ?? renderer.width) - 112;
  const infoX = Math.max(left, Math.min(right, x));
  let rowY = y - 25;
  // Titre seulement quand l'enseigne ne suffit pas (amélioration, tracts, sabotage…).
  if (offer.victim_id) {
    const victim = state.buildings.find(b => b.id === offer.victim_id);
    pill(ctx, infoX, rowY, `${offer.label} · ${buildingLabel(victim)}`, { ink: '#39483f', border: '#4d6648', font: '800 9px system-ui' });
    rowY += 24;
  } else if (offer.kind !== 'CAPTURE' || building.type === 'permanence' && !candidate.headquarters_site_id) {
    pill(ctx, infoX, rowY, offerTitle(offer, building, candidate), { ink: '#39483f', border: '#4d6648', font: '800 9px system-ui' });
    rowY += 24;
  }
  // Le prix, coché comme les soutiens ; la bulle se remplit pendant l'achat.
  const funded = offer.affordable !== false && offer.reason !== 'INSUFFICIENT_FUNDS';
  pill(ctx, infoX, rowY, `${funded ? '✓' : '✗'} ${formatCost(config, offer.cost)}`,
    { ink: funded ? '#2f4a30' : '#8a3a32', border: funded ? '#4d6648' : '#b98474', font: '800 11px system-ui', progress });
  rowY += 24;
  const need = presenceNeed(state, config, candidate, building, offer);
  if (need) {
    const ok = need.current >= need.required;
    drawPresenceRow(ctx, infoX, rowY, need, p.factions[candidate.faction_id]?.color, ok, `${ok ? '✓' : '✗'} ${need.current}/${need.required} soutiens dans ce quartier`);
    rowY += 24;
  }
  const other = offer.reason && !['INSUFFICIENT_FUNDS', 'INSUFFICIENT_PRESENCE'].includes(offer.reason) ? reasonTexts[offer.reason] || 'Indisponible pour le moment' : null;
  if (other) pill(ctx, infoX, rowY, `✗ ${other}`, { ink: '#8a3a32', border: '#b98474' });
  ctx.restore();
}

const reasonTexts = {
  CAMPAIGN_BUDGET_EXCEEDED: 'Plafond de dépenses de campagne atteint', CANDIDATE_LIMIT: 'Vous en possédez déjà le maximum',
  GLOBAL_LIMIT: 'Vous avez déjà le maximum de tours', QUEUE_FULL: 'Imprimerie occupée : revenez plus tard',
  NO_SYMPATHISANT: 'Il faut un de vos sympathisants dans ce biome', NO_MILITANT: 'Aucun de vos militants dans ce biome',
  NO_GUARD: 'Aucun service d’ordre disponible', SO_LIMIT: 'Plus de place pour un service d’ordre ici',
  COOLDOWN: 'Pas encore prêt : patientez un peu', ADMINISTRATIVE_BAN: 'Meeting interdit pour vous (temporaire)',
  NOT_ON_STAGE: 'Sautez sur la scène pour lancer le meeting', NO_BUILDING: 'Aucune cible à portée',
};
const kindTitles = { PRINT: 'IMPRIMER DES TRACTS', POLL: 'PUBLIER UN SONDAGE', EQUIP: 'ÉQUIPER VOS MILITANTS', REBUILD: 'RECONSTRUIRE' };

function offerTitle(offer, building, candidate) {
  if (offer.kind === 'CAPTURE') return building.type === 'permanence' && !candidate.headquarters_site_id
    ? 'FONDER VOTRE QG ICI' : `PRENDRE : ${buildingLabel(building, candidate.faction_id).toUpperCase()}`;
  if (offer.kind === 'UPGRADE') return `AMÉLIORER → NIVEAU ${building.level + 1}`;
  return offer.label || kindTitles[offer.kind] || 'ACHETER';
}

function formatCost(config, cost) {
  return cost < 1 ? `${formatNumber(cost * 1000, 0)} €`
    : `${formatNumber(cost, config.balance.display.currency_precision_decimals)} ${config.balance.display.currency_label}`;
}

/** Soutiens exigés dans le quartier pour prendre ou améliorer ce bâtiment ; null si la règle ne s'applique pas. */
function presenceNeed(state, config, candidate, building, offer) {
  if (!['CAPTURE', 'UPGRADE', 'MEETING'].includes(offer.kind)) return null;
  const settings = buildingSettings(config, building, candidate.faction_id);
  const required = settings[`required_presence_N${offer.kind === 'UPGRADE' ? building.level + 1 : 1}`] || 0;
  return required > 0 ? { required, current: localPoliticalPresence(state, building.subzone_id, candidate.faction_id) } : null;
}

/** Étiquette papier centrée, avec une éventuelle barre de progression intégrée. */
function pill(ctx, x, y, text, { ink, border, font = '700 10px system-ui', progress = 0 }) {
  ctx.save();
  ctx.font = font; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const w = ctx.measureText(text).width + 20, h = 19;
  ctx.fillStyle = '#fff4d6'; ctx.strokeStyle = border; ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.roundRect(x - w / 2, y, w, h, 9); ctx.fill();
  if (progress > 0) { ctx.fillStyle = '#b9d0a4'; ctx.beginPath(); ctx.roundRect(x - w / 2, y, w * Math.min(1, progress), h, 9); ctx.fill(); }
  ctx.beginPath(); ctx.roundRect(x - w / 2, y, w, h, 9); ctx.stroke();
  ctx.fillStyle = ink; ctx.fillText(text, x, y + h / 2 + 0.5);
  ctx.restore();
}

/** Petits personnages : un par soutien exigé, colorés quand le soutien est présent. */
function drawPawns(ctx, left, centerY, need, color) {
  const shown = Math.max(need.required, 1);
  for (let i = 0; i < shown; i++) {
    const px = left + i * 9 + 4;
    const filled = i < need.current;
    ctx.fillStyle = filled ? color || '#4d6648' : '#e6d8b5'; ctx.strokeStyle = filled ? '#263132' : '#a7977a'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(px, centerY - 4, 2.6, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.roundRect(px - 3.5, centerY - 0.5, 7, 6, [3, 3, 1, 1]); ctx.fill(); ctx.stroke();
  }
  return shown * 9;
}

function drawPresenceRow(ctx, x, y, need, color, ok, text) {
  ctx.save();
  ctx.font = '700 10px system-ui'; ctx.textBaseline = 'middle';
  const pawnsWidth = Math.max(need.required, 1) * 9;
  const w = pawnsWidth + ctx.measureText(text).width + 26, h = 19, left = x - w / 2;
  ctx.fillStyle = '#fff4d6'; ctx.strokeStyle = ok ? '#4d6648' : '#b98474'; ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.roundRect(left, y, w, h, 9); ctx.fill(); ctx.stroke();
  drawPawns(ctx, left + 9, y + h / 2, need, color);
  ctx.textAlign = 'left'; ctx.fillStyle = ok ? '#2f4a30' : '#8a3a32';
  ctx.fillText(text, left + 15 + pawnsWidth, y + h / 2 + 0.5);
  ctx.restore();
}

/**
 * Repères permanents sur les bâtiments libres ou menacés : combien de soutiens il faut dans le quartier.
 * Près d'une offre, vos soutiens qui comptent dans le quartier sont entourés.
 */
export function drawSiteRequirements(renderer, state) {
  const { ctx, config, p, metrics: m, width } = renderer;
  const candidate = state.candidates.find(c => c.id === state.local_candidate_id);
  if (!candidate || candidate.eliminated || !['CAMPAIGN', 'SECOND_ROUND_SPRINT'].includes(state.phase)) return;
  const color = p.factions[candidate.faction_id]?.color;
  const focus = candidate.interaction_active && candidate.campaign_active ? nearestOffer(state, config, candidate) : null;
  ctx.save();
  for (const building of state.buildings) {
    if (building.ownership_model !== 'capturable' || building.id === focus?.target_id) continue;
    const x = renderer.screenX(building.x);
    if (x < -80 || x > width + 80) continue;
    const open = ['EMPTY', 'NEUTRAL', 'CLOSED'].includes(building.state);
    const threatened = building.state === 'ACTIVE' && building.owner_id === candidate.faction_id && !building.headquarters && building.closure_progress > 0;
    if (!open && !threatened) continue;
    const current = localPoliticalPresence(state, building.subzone_id, candidate.faction_id);
    const required = open ? buildingSettings(config, building, candidate.faction_id).required_presence_N1 : building.required_presence;
    if (!required) continue;
    const sprite = renderer.assets?.get(buildingAssetId(building, state.world));
    const y = Math.max(8, buildingGeometry(renderer, building, sprite).top - 26);
    const need = { required, current };
    if (threatened) {
      ctx.globalAlpha = 0.7 + 0.3 * Math.sin(state.tick * 0.3);
      drawPresenceRow(ctx, x, y, need, color, false, `⚠ ${current}/${required} : bâtiment menacé`);
      ctx.globalAlpha = 1;
    } else drawPresenceRow(ctx, x, y, need, color, current >= required, `${current}/${required} soutiens`);
  }
  ctx.restore();
}
