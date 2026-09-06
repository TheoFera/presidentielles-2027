/** Validation of the authoritative campaign extension, before atomic snapshot import. */
export function validateCampaignSnapshot(state, config, fail) {
 const finite=n=>Number.isFinite(n)&&n>=0;
 const d=state.campaign_director, families=Object.keys(config.balance.campaign_events.families),ids=new Set();
 if(!d||!finite(d.next_event_day)||!Number.isInteger(d.rng_state)||d.rng_state<1||!Array.isArray(d.event_history)||!Array.isArray(d.active_event_ids)||!Array.isArray(state.campaign_events))fail('directeur de campagne invalide');
 if(!finite(state.campaign_time_offset)||!finite(state.campaign_elapsed_days)||state.campaign_elapsed_days>config.balance.time.starting_days_before_first_round||state.campaign_day_remaining!==state.days_remaining||!finite(state.campaign_progress_01)||state.campaign_progress_01>1)fail('calendrier de campagne invalide');
 for(const e of state.campaign_events){
 if(!e||typeof e.id!=='string'||ids.has(e.id)||!families.includes(e.family)||!['ACTIVE','RESOLVED','EXPIRED'].includes(e.status)||!['MINOR','MAJOR','CRISIS'].includes(e.intensity)||!Number.isInteger(e.start_tick)||e.start_tick<0||!(e.end_tick===null||Number.isInteger(e.end_tick)&&e.end_tick>=e.start_tick)||!e.parameters||!Array.isArray(e.target_candidate_ids)||e.target_candidate_ids.some(id=>!state.candidates.some(c=>c.id===id))||!state.buildings.some(b=>b.id===e.target_site_id))fail('événement de campagne invalide');
 ids.add(e.id);
 if(e.attempt&&(!state.candidates.some(c=>c.id===e.attempt.candidate_id)||!finite(e.attempt.start_tick)||!finite(e.attempt.hits)))fail('tentative de Meeting invalide');
 if(e.arena&&(!Array.isArray(e.arena.candidates)||e.arena.candidates.some(c=>!finite(c.arena_hp)||!finite(c.x)||!c.combat)||!finite(e.arena.tick)||!Array.isArray(e.arena.attacks)))fail('arène de campagne invalide');
 }
 if(JSON.stringify(d.active_event_ids)!==JSON.stringify(state.campaign_events.filter(e=>e.status==='ACTIVE').map(e=>e.id)))fail('pile d’événements incohérente');
 for(const c of state.candidates){
 if(!Array.isArray(c.orientation_choices)||c.orientation_choices.length>config.balance.campaign_events.orientation_days.length||!c.campaign_orientation_bonuses||Object.entries(c.campaign_orientation_bonuses).some(([biome,value])=>!config.layout.biomes.some(b=>b.id===biome)||!finite(value)))fail('orientation de campagne invalide');
 for(const field of ['campaign_arena_id','crisis_meeting_id'])if(c[field]!==null&&!state.campaign_events.some(e=>e.id===c[field]&&e.status==='ACTIVE'))fail('activité de campagne orpheline');
 }
 if(d.event_history.some(e=>!ids.has(e.id)||!families.includes(e.family)||!finite(e.day)))fail('historique de campagne invalide');
}
export function validateCampaignConfig(config){
 const b=config.balance.campaign_events;const fail=label=>{throw new Error(`Configuration de campagne invalide : ${label}.`);};const positive=n=>Number.isFinite(n)&&n>0;
 if(!b||!positive(b.max_simultaneous_events)||!positive(b.initial_event_delay_days)||!Array.isArray(b.frequency_curve)||b.frequency_curve.some(row=>row.length!==3||!positive(row[1])||row[2]<row[1])||!Array.isArray(b.orientation_days)||b.orientation_days.some(d=>!Number.isInteger(d)||d<0||d>365))fail('calendrier ou fréquence');
 for(const [family,p]of Object.entries(b.families)){for(const key of ['base_weight','duration','max_simultaneous','leader_weight','second_weight','third_weight'])if(!positive(p[key]))fail(family+' / '+key);if(p.minimum_day>p.maximum_day||Object.values(p.intensity_weights).some(v=>!positive(v)))fail(family);}
 if(config.campaignCatalog){const ids=new Set();for(const v of config.campaignCatalog){if(ids.has(v.event_id)||!b.families[v.family]||typeof v.title!=='string'||!positive(v.weight)||!Array.isArray(v.tags)||!v.mechanical_parameters)fail('variante '+v.event_id);ids.add(v.event_id);}}
}
