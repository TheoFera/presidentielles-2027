import { campaignStyles, CAMPAIGN_STYLES } from './campaign-styles.js';
import { validAIDifficulty } from './ai-settings.js';
/** Validation of the authoritative campaign extension, before atomic snapshot import. */
export function validateCampaignSnapshot(state, config, fail) {
 const finite=n=>Number.isFinite(n)&&n>=0;
 const d=state.campaign_director, families=Object.keys(config.balance.campaign_events.families),ids=new Set();
 if(!d||!finite(d.next_event_day)||!Number.isInteger(d.rng_state)||d.rng_state<1||!Array.isArray(d.event_history)||!Array.isArray(d.active_event_ids)||!Array.isArray(state.campaign_events))fail('directeur de campagne invalide');
 if(!finite(state.campaign_time_offset)||!finite(state.campaign_elapsed_days)||state.campaign_elapsed_days>config.balance.time.starting_days_before_first_round||state.campaign_day_remaining!==state.days_remaining||!finite(state.campaign_progress_01)||state.campaign_progress_01>1)fail('calendrier de campagne invalide');
 for(const e of state.campaign_events){
 if(!e||typeof e.id!=='string'||ids.has(e.id)||!families.includes(e.family)||!['ACTIVE','RESOLVED','EXPIRED'].includes(e.status)||!['MINOR','MAJOR','CRISIS'].includes(e.intensity)||!Number.isInteger(e.start_tick)||e.start_tick<0||!(e.end_tick===null||Number.isInteger(e.end_tick)&&e.end_tick>=e.start_tick)||!e.parameters||!Array.isArray(e.target_candidate_ids)||e.target_candidate_ids.some(id=>!state.candidates.some(c=>c.id===id))||!state.buildings.some(b=>b.id===e.target_site_id))fail('événement de campagne invalide');
 ids.add(e.id);
 if(e.arena?.ai_difficulty!==undefined&&(!validAIDifficulty(e.arena.ai_difficulty)||e.arena.ai_difficulty!==(state.ai_difficulty??config.balance.ai?.difficulty??'normal')))fail('difficulté d’arène de campagne incohérente');
 if(!e.style_snapshot||Object.keys(CAMPAIGN_STYLES).some(f=>!e.style_snapshot[f]||!e.style_snapshot[f].biome_multipliers||config.layout.biomes.some(b=>!finite(e.style_snapshot[f].biome_multipliers[b.id]))))fail('paramètres de style de l’événement invalides');
 if(e.attempt&&(!state.candidates.some(c=>c.id===e.attempt.candidate_id)||!finite(e.attempt.start_tick)||!finite(e.attempt.hits)))fail('tentative de Meeting invalide');
 if(e.arena&&(!Array.isArray(e.arena.candidates)||e.arena.candidates.some(c=>!finite(c.arena_hp)||!finite(c.x)||!c.combat)||!finite(e.arena.tick)||!Array.isArray(e.arena.attacks)))fail('arène de campagne invalide');
 }
 if(JSON.stringify(d.active_event_ids)!==JSON.stringify(state.campaign_events.filter(e=>e.status==='ACTIVE').map(e=>e.id)))fail('pile d’événements incohérente');
 for(const c of state.candidates){
 if(c.current_campaign_style!==null&&!campaignStyles(config,c.faction_id).some(s=>s.id===c.current_campaign_style))fail('style de campagne invalide');
 if(typeof c.bardella_form!=='boolean'||typeof c.bardellisation_used!=='boolean'||typeof c.style_interaction_held!=='boolean')fail('état du style invalide');
 if(c.bardella_form&&(!c.bardellisation_used||c.current_campaign_style!=='le_pen_gouvernement'))fail('forme Bardella incohérente');
 if(c.style_hold&&(!Number.isInteger(c.style_hold.start_tick)||c.style_hold.start_tick<0||c.style_hold.start_tick>state.tick||!finite(c.style_hold.hits)||!finite(c.style_hold.x)))fail('maintien de style invalide');
 if(c.ultimate_effect&&(!['FIRE','SCARF','EUROPE'].includes(c.ultimate_effect.kind)||!Number.isInteger(c.ultimate_effect.expires_tick)||c.ultimate_effect.expires_tick<=state.tick||c.is_ko))fail('effet temporaire du candidat invalide');
 for(const field of ['campaign_arena_id','crisis_meeting_id'])if(c[field]!==null&&!state.campaign_events.some(e=>e.id===c[field]&&e.status==='ACTIVE'))fail('activité de campagne orpheline');
 }
 if(state.campaign_style_selection && (!state.candidates.some(c=>c.id===state.campaign_style_selection.candidate_id)||typeof state.campaign_style_selection.mandatory!=='boolean'))fail('sélection de style invalide');
 if(d.event_history.some(e=>!ids.has(e.id)||!families.includes(e.family)||!finite(e.day)))fail('historique de campagne invalide');
}
export function validateCampaignConfig(config){
 const b=config.balance.campaign_events;const fail=label=>{throw new Error(`Configuration de campagne invalide : ${label}.`);};const positive=n=>Number.isFinite(n)&&n>0;
 const settings=config.balance.campaign_styles;
 if(!settings||!positive(settings.hold_seconds)||!positive(settings.radius_units))fail('interaction des styles');
 for(const faction of Object.keys(CAMPAIGN_STYLES))for(const style of campaignStyles(config,faction)){
   for(const field of ['biome_multipliers','penalized_biomes'])if(!style[field]||Object.entries(style[field]).some(([id,v])=>!config.layout.biomes.some(b=>b.id===id)||!Number.isFinite(v)||v<0))fail(style.id+' / '+field);
   for(const field of ['event_tag_weights','opinion_tag_multipliers'])if(!style[field]||Object.values(style[field]).some(v=>!Number.isFinite(v)||v<0))fail(style.id+' / '+field);
   if(!['MANUAL','MANUAL_GUARDIAN'].includes(style.ultimate.activation_mode)||!['HOLOGRAMS','WAVE','WALL','SURGE','FIRE','ZEMMOUR','BARDELLA','SCARF','EUROPE'].includes(style.ultimate.kind))fail(style.id+' / ultime');
 }
 for(const key of ['surge','fire','zemmour','scarf','europe']){
   const power=config.balance.specials[key];if(!power||Object.entries(power).some(([field,value])=>typeof value==='number'&&(field==='knockback'?(!Number.isFinite(value)||value<0):!positive(value))))fail('ultime '+key);
 }
 if(!Array.isArray(config.balance.specials.zemmour.bubble_labels)||!config.balance.specials.zemmour.bubble_labels.length||config.balance.specials.zemmour.bubble_labels.some(s=>typeof s!=='string'||!s.trim()))fail('textes des bulles');
 if(!b||!positive(b.max_simultaneous_events)||!positive(b.initial_event_delay_days)||!positive(b.notification_display_seconds)||!positive(b.notification_arrival_seconds)||b.notification_arrival_seconds>b.notification_display_seconds||!Array.isArray(b.frequency_curve)||b.frequency_curve.some(row=>row.length!==3||!positive(row[1])||row[2]<row[1]))fail('calendrier, annonces ou fréquence');
 for(const [family,p]of Object.entries(b.families)){for(const key of ['base_weight','duration','max_simultaneous','leader_weight','second_weight','third_weight'])if(!positive(p[key]))fail(family+' / '+key);if(p.minimum_day>p.maximum_day||Object.values(p.intensity_weights).some(v=>!positive(v)))fail(family);}
 if(config.campaignCatalog){const ids=new Set();for(const v of config.campaignCatalog){if(ids.has(v.event_id)||!b.families[v.family]||typeof v.title!=='string'||!positive(v.weight)||!Array.isArray(v.tags)||!v.mechanical_parameters)fail('variante '+v.event_id);ids.add(v.event_id);}}
}
