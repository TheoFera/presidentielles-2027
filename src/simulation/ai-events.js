import { ringDelta, zoneAt } from './world.js';
import { aiNoise, aiSettings } from './ai-settings.js';
import { paymentStatus } from './campaign-budget.js';
import { debateAICommands } from './debate-simulation.js';
import { factionPressure } from './ai-balance.js';
import { assessDuel } from './ai-mind.js';
import { canBeHit } from './combat-state.js';

const activeEvents = state => (state.campaign_events || []).filter(e => e.status === 'ACTIVE');
const gap = (state, a, b) => Math.abs(ringDelta(a, b, state.world.length));
const walk = (state, c, x) => {
  const d = ringDelta(c.x, x, state.world.length);
  return [{ type: 'Move', candidateId: c.id, axis: Math.abs(d) < 0.4 ? 0 : Math.sign(d) }, { type: 'InteractionPresence', candidateId: c.id, active: true }];
};
const climb = (state, config, c, site, out) => {
  if (gap(state, c.x, site.x) < config.balance.buildings.meeting.podium_half_width * 0.4 && c.podium_site_id !== site.id
    && c.combat.height <= 0 && c.combat.jump_tick == null) out.push({ type: 'Jump', candidateId: c.id });
  return out;
};

/** Engagements en cours qui priment sur tout : débat médiatique et meeting de crise sur scène. */
export function campaignCommittedAICommands(state, config, c) {
  if (!state.ai_enabled || c.is_ko) return null;
  if (c.campaign_debate_id) {
    const event = state.campaign_events.find(e => e.id === c.campaign_debate_id);
    return c.id === state.local_candidate_id && event?.debate ? debateAICommands(event.debate, config, c.id, state.ai_enabled) : [];
  }
  if (c.crisis_meeting_id) {
    const event = state.campaign_events.find(e => e.id === c.crisis_meeting_id);
    const site = state.buildings.find(b => b.id === event?.target_site_id);
    return site ? climb(state, config, c, site, walk(state, c, site.x)) : walk(state, c, c.x);
  }
  return null;
}

/**
 * Valeur politique d’un lieu : reprendre du terrain au camp dominant rapporte plus,
 * aller chez un rival qu’on préfère éviter rapporte moins.
 */
function placeFactor(state, config, c, x, adaptation) {
  const record = state.electorate.find(e => e.subzone_id === zoneAt(state.world, x).id);
  const pressure = factionPressure(adaptation, record?.controller);
  let factor = record?.controller === c.faction_id ? 1.15 : pressure > 0 ? 1.3 : pressure < 0 ? 0.6 : 1;
  // Un rival déjà sur place et redoutable rend le déplacement risqué.
  for (const rival of state.candidates) {
    if (rival === c || rival.faction_id === c.faction_id || !canBeHit(rival) || gap(state, rival.x, x) > 6) continue;
    const duel = assessDuel(state, config, c, rival, adaptation);
    if (duel.fight < -0.1) factor *= 0.45;
  }
  return factor;
}

/**
 * Événements de campagne vus par l’IA : valeur, distance, territoire, danger et coût.
 * Appelé après la gestion des rivaux proches : l’IA ne traverse plus un adversaire
 * sans réagir pour courir vers un événement.
 */
export function campaignEventAICommands(state, config, c, adaptation) {
  if (!state.ai_enabled || c.is_ko || state.phase !== 'CAMPAIGN') return null;
  const settings = aiSettings(state, config), hz = config.balance.simulation_architecture.fixed_tick_hz;
  const boost = adaptation.boost;
  const reaction = config.balance.campaign_events.ai_reaction_seconds * settings.event_reaction_multiplier
    * (1 - 0.4 * Math.max(0, boost)) * (1 + 0.5 * Math.max(0, -boost));
  const reactionTicks = Math.max(1, Math.round(reaction * hz));
  const events = activeEvents(state).filter(e => state.tick - e.start_tick >= reactionTicks);
  if (!events.length && !state.campaign_events?.length) return null;
  const noise = aiNoise(state.seed, `${c.id}:event:${Math.floor(state.tick / reactionTicks)}`);
  // Candidat fragilisé : rentrer au QG tant que le scandale plane.
  const scandal = events.find(e => e.family === 'CANDIDAT_FRAGILISE' && e.target_candidate_ids.includes(c.id));
  if (scandal && noise < 0.8) return walk(state, c, state.buildings.find(b => b.id === c.headquarters_site_id)?.x ?? c.start_x);
  const options = [];
  for (const e of events) {
    let x, value = 0, site = null;
    if (e.family === 'RASSEMBLEMENT' && e.march) { x = e.march.center_x; value = 20; }
    if (['MEETING_DE_CRISE', 'DEBAT_THEMATIQUE'].includes(e.family) && !e.debate) {
      site = state.buildings.find(b => b.id === e.target_site_id);
      const payment = paymentStatus(c, config, e.parameters.meeting_cost);
      if (!site || !payment.enabled) continue;
      x = site.x;
      if (e.family === 'DEBAT_THEMATIQUE') site = null; // le débat se joue au pied du bâtiment, sans monter sur scène
      value = e.family === 'MEETING_DE_CRISE' ? e.parameters.local_conversion_percent : 10;
      // Garder de quoi vivre : un événement qui vide les caisses vaut moins.
      if (e.parameters.meeting_cost > c.money * 0.6) value *= 0.7;
    }
    if (e.family === 'CANDIDAT_FRAGILISE' && !e.target_candidate_ids.includes(c.id)) {
      const prey = state.candidates.find(o => o.id === e.target_candidate_ids[0]);
      if (!prey || !canBeHit(prey) || factionPressure(adaptation, prey.faction_id) < 0) continue;
      x = prey.x; value = 15 * (1 + Math.max(0, assessDuel(state, config, c, prey, adaptation).fight));
    }
    if (x === undefined) continue;
    value *= placeFactor(state, config, c, x, adaptation) * (1 + 0.5 * Math.max(0, boost));
    options.push({ x, site, value: value / (1 + gap(state, c.x, x) / 30), close: gap(state, c.x, x) < 8 });
  }
  // Rouvrir un bâtiment perdu après une fermeture administrative.
  for (const e of state.campaign_events.filter(e => e.family === 'FERMETURE_BATIMENT' && e.status === 'RESOLVED'
    && e.target_candidate_ids.includes(c.id) && state.tick - e.resolved_tick < 30 * hz)) {
    const site = state.buildings.find(b => b.id === e.target_site_id);
    if (site?.owner_id === null) options.push({ x: site.x, site: null, value: 4, close: gap(state, c.x, site.x) < 8 });
  }
  options.sort((a, b) => b.value - a.value || a.x - b.x);
  const chosen = options[0];
  // L’intérêt fluctue d’une fenêtre à l’autre, sauf quand l’objectif est tout proche.
  if (!chosen || !chosen.close && noise > Math.min(1, settings.event_interest + 0.15 * boost)) return null;
  const out = walk(state, c, chosen.x);
  return chosen.site ? climb(state, config, c, chosen.site, out) : out;
}
