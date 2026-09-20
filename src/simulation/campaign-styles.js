import { actionState } from './combat-actions.js';
import { ringDelta } from './world.js';
import { isHumanCandidate } from './human-candidates.js';
import { aiNoise } from './ai-settings.js';

const style = (id, name, biome, summary, ultimate, kind, tags, accent, outfit) => ({
  id, name, primary_biome: biome, summary, skin: { accent, outfit },
  biome_multipliers: { [biome]: 1.1 }, penalized_biomes: {},
  event_tag_weights: Object.fromEntries(tags.map(tag => [tag, 1.5])),
  opinion_tag_multipliers: {},
  ultimate: { name: ultimate, kind, activation_mode: kind === 'BARDELLA' ? 'MANUAL_GUARDIAN' : 'MANUAL' },
});

export const CAMPAIGN_STYLES = {
  melenchon: [
    style('melenchon_universaliste', 'Universaliste', 'paris_19e', 'L’écologie et les quartiers urbains.', 'Hologrammes', 'HOLOGRAMS', ['urban', 'ecology', 'vegetarian', 'transport', 'university'], '#dc575a', 'red'),
    style('melenchon_communautariste', 'Communautariste', 'banlieue', 'Bousculer les lignes adverses.', 'Déferlante encapuchonnée', 'SURGE', ['suburb', 'community'], '#a26ce2', 'purple'),
    style('melenchon_populiste', 'Populiste', 'periurbain_usine', 'Le pouvoir d’achat, sur le terrain.', 'Gilet jaune', 'FIRE', ['industry', 'fuel', 'factory', 'salary', 'purchasing_power'], '#f6c943', 'worker'),
  ],
  le_pen: [
    style('le_pen_souverainiste', 'Souverainiste', 'periurbain_usine', 'Une vague qui repousse tout.', 'Vague bleu marine', 'WAVE', ['industry', 'fuel', 'rural'], '#4977bf', 'navy'),
    style('le_pen_zemmouriste', 'Zemmouriste', 'quartiers_riches', 'Une invocation fragile, mais insistante.', 'Invocation Zemmour', 'ZEMMOUR', ['wealth', 'security'], '#9b6d4d', 'dark'),
    style('le_pen_gouvernement', 'Libérale · Parti de gouvernement', 'retraites', 'Une relève au moment décisif.', 'Bardellisation', 'BARDELLA', ['retirement', 'government'], '#81b9ce', 'formal'),
  ],
  philippe: [
    style('philippe_gestionnaire', 'Gestionnaire', 'quartiers_riches', 'Deux CRS pour tenir la ligne.', 'Protection CRS', 'WALL', ['economy', 'business'], '#63ad9d', 'grey'),
    style('philippe_notable', 'Notable local', 'retraites', 'Une écharpe, beaucoup d’allonge.', 'Écharpe du maire', 'SCARF', ['retirement', 'local'], '#db9b65', 'mayor'),
    style('philippe_europeiste', 'Européiste', 'paris_19e', 'Frappez-le à vos risques et périls.', 'Super Européiste', 'EUROPE', ['urban', 'ecology', 'university', 'europe'], '#437cef', 'europe'),
  ],
};

export const DEFAULT_UNLOCKS = Object.fromEntries(Object.entries(CAMPAIGN_STYLES).map(([f, styles]) => [f, [styles[0].id]]));
export function normalizeCampaignProfile(profile = {}) {
  return { ...profile, unlocked_campaign_styles: Object.fromEntries(Object.entries(CAMPAIGN_STYLES).map(([f, styles]) =>
    [f, [...new Set([...DEFAULT_UNLOCKS[f], ...(Array.isArray(profile.unlocked_campaign_styles?.[f]) ? profile.unlocked_campaign_styles[f] : [])])].filter(id => styles.some(s => s.id === id))])) };
}
export function isCampaignStyleUnlocked(profile, faction, styleId) {
  return !!CAMPAIGN_STYLES[faction]?.some(s => s.id === styleId) && normalizeCampaignProfile(profile).unlocked_campaign_styles[faction].includes(styleId);
}
export function unlockCampaignStyle(profile, faction, styleId) {
  if (!CAMPAIGN_STYLES[faction]?.some(s => s.id === styleId)) throw new Error('Style de campagne inconnu.');
  const next = normalizeCampaignProfile(profile);
  next.unlocked_campaign_styles[faction] = [...new Set([...next.unlocked_campaign_styles[faction], styleId])];
  return next;
}
export function campaignStyles(config, faction) {
  return (CAMPAIGN_STYLES[faction] || []).map(s => {
    const override = config.balance.campaign_styles?.definitions?.[s.id] || {};
    return { ...s, ...override, id: s.id, ultimate: { ...s.ultimate, ...override.ultimate } };
  });
}
export const activeCampaignStyle = (config, candidate) => campaignStyles(config, candidate?.faction_id).find(s => s.id === candidate.current_campaign_style) || null;
/** Tous les styles du candidat sont accessibles à l’IA, sans déblocage joueur.
 * Le terrain du QG favorise un style, sans exclure les autres possibilités. */
export function chooseAICampaignStyle(state, config, candidate) {
  const styles = campaignStyles(config, candidate.faction_id);
  const biome = state.buildings.find(b => b.id === candidate.headquarters_site_id)?.biome_id;
  const weights = styles.map(s => s.primary_biome === biome ? 1.5 : 1);
  let roll = aiNoise(state.seed, `${candidate.id}:campaign-style`) * weights.reduce((a, b) => a + b, 0);
  return styles.find((_style, index) => (roll -= weights[index]) < 0)?.id ?? styles.at(-1).id;
}
export function styleInfluenceMultiplier(config, candidate, biome) {
  const s = activeCampaignStyle(config, candidate);
  return (s?.biome_multipliers?.[biome] ?? 1) * (s?.penalized_biomes?.[biome] ?? 1);
}
export const styleTagWeight = (config, candidate, tags) => tags.reduce((n, tag) => n * (activeCampaignStyle(config, candidate)?.event_tag_weights?.[tag] ?? 1), 1);
export const styleSettings = config => ({ hold_seconds: 3, radius_units: 1.2, ...config.balance.campaign_styles });
export function nearCampaignHQ(state, config, c) {
  const hq = state.buildings.find(b => b.id === c.headquarters_site_id && b.headquarters && b.state === 'ACTIVE' && b.owner_id === c.faction_id);
  return !!hq && Math.abs(ringDelta(c.x, hq.x, state.world.length)) <= styleSettings(config).radius_units;
}
// Only this candidate's ultimate entities are removed. Standard NPCs keep all their state.
export function clearCampaignUltimate(sim, candidate, resetLife = false) {
  const state = sim.state, ids = new Set(state.temporary_units.filter(u => u.owner_id === candidate.id).map(u => u.id));
  state.temporary_units = state.temporary_units.filter(u => !ids.has(u.id));
  state.powers = state.powers.filter(p => p.owner_id !== candidate.id);
  state.projectiles = state.projectiles.filter(p => p.owner_id !== candidate.id && !ids.has(p.owner_id));
  state.attacks = state.attacks.filter(a => a.owner_id !== candidate.id && !ids.has(a.owner_id));
  Object.assign(candidate.combat, actionState());
  candidate.combat.combo_step = 0; candidate.combat.combo_expires_tick = 0;
  candidate.combat.attack_id = null; candidate.combat.buffer_until_tick = -1;
  candidate.ultimate_effect = null; candidate.style_hold = null; candidate.style_interaction_held = false;
  candidate.special_charge = 0; candidate.special_decay_started = false; candidate.special_decay_origin = 0; candidate.bardella_guardian_armed = false; candidate.active_ultimate_id = null;
  candidate.dash_active = false; candidate.dash_until_tick = 0; candidate.dash_invulnerable_until_tick = 0;
  if (resetLife) { candidate.bardella_form = false; candidate.bardellisation_used = false; }
}

export class CampaignStyleSystem {
  static initialize(sim, profile) {
    sim.profile = normalizeCampaignProfile(profile);
    sim.state.campaign_style_selection = null;
    for (const c of sim.state.candidates) Object.assign(c, { current_campaign_style: null, style_hold: null, style_interaction_held: false, ultimate_effect: null, bardella_form: false, bardellisation_used: false });
  }
  static headquartersEstablished(sim, c) {
    if (c.current_campaign_style) return;
    if (isHumanCandidate(sim.state, c.id)) { if (!sim.state.campaign_style_selection) this.open(sim, c, true); }
    else this.select(sim, c, chooseAICampaignStyle(sim.state, sim.config, c), true);
  }
  static open(sim, c, mandatory = false) {
    c.axis = 0; c.moving = false; c.purchase_hold = null; c.style_hold = null; c.style_interaction_held = false; c.combat.buffer_until_tick = -1;
    sim.state.campaign_style_selection = { candidate_id: c.id, mandatory };
  }
  static select(sim, c, id, ai = false) {
    const selection = sim.state.campaign_style_selection;
    if (!ai && (!selection || selection.candidate_id !== c.id || !isCampaignStyleUnlocked(sim.profile, c.faction_id, id))) return false;
    if (!campaignStyles(sim.config, c.faction_id).some(s => s.id === id)) return false;
    if (c.current_campaign_style !== id) {
      clearCampaignUltimate(sim, c);
      // A change never grants another resurrection within the same life.
      c.bardella_form = false;
      c.current_campaign_style = id;
      sim.emit('CampaignStyleChanged', { candidate_id: c.id, style_id: id });
    }
    if (!ai) sim.state.campaign_style_selection = null;
    c.style_interaction_held = false; c.style_hold = null;
    return true;
  }
  static command(sim, command) {
    const c = sim.state.candidates.find(c => c.id === command.candidateId);
    if (command.type === 'SelectCampaignStyle') { if (c) this.select(sim, c, command.styleId); return true; }
    if (command.type === 'CancelCampaignStyle') {
      if (sim.state.campaign_style_selection?.candidate_id === c?.id && !sim.state.campaign_style_selection.mandatory) sim.state.campaign_style_selection = null;
      return true;
    }
    if (sim.state.campaign_style_selection) return true;
    if (command.type === 'HoldCampaignStyle') {
      if (c && isHumanCandidate(sim.state, c.id)) {
        c.style_interaction_held = command.active === true;
        if (c.style_interaction_held) c.purchase_hold = null;
        if (!c.style_interaction_held) c.style_hold = null;
      }
      return true;
    }
    if (c && (['Attack', 'PressAttack', 'Jump'].includes(command.type) || command.type === 'Move' && command.axis)) { c.style_hold = null; c.style_interaction_held = false; }
    return false;
  }
  static update(sim) {
    for (const c of sim.state.candidates) {
      if (sim.state.campaign_style_selection) break;
      if (!c.current_campaign_style && c.headquarters_site_id && !c.eliminated) { this.headquartersEstablished(sim, c); continue; }
      if (!c.style_interaction_held || !c.current_campaign_style || !nearCampaignHQ(sim.state, sim.config, c) || c.axis || c.moving || c.is_ko || c.eliminated || c.campaign_arena_id || c.crisis_meeting_id || c.purchase_hold || c.combat.charge_active || c.combat.jump_tick != null || c.combat.attack_id || c.combat.stun_ticks || c.combat.hitstop_ticks || Math.abs(c.combat.knockback_velocity) > 0.02 || c.combat.buffer_until_tick >= sim.state.tick) { c.style_hold = null; c.style_interaction_held = false; continue; }
      c.style_hold ??= { start_tick: sim.state.tick, hits: c.hits_received, x: c.x };
      if (c.hits_received !== c.style_hold.hits || c.x !== c.style_hold.x) { c.style_hold = null; c.style_interaction_held = false; continue; }
      if (sim.state.tick - c.style_hold.start_tick >= sim.secondsToTicks(styleSettings(sim.config).hold_seconds)) this.open(sim, c);
    }
  }
}
