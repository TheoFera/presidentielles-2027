import { startRally, updateRally, finishRally } from './rallies.js';
import { isHumanCandidate } from './human-candidates.js';
import { clearCampaignUltimate, activeCampaignStyle, styleTagWeight, styleInfluenceMultiplier } from './campaign-styles.js';
import { random, ringDelta, wrap, zoneAt, FACTIONS } from './world.js';
import { aggregateNational, refreshElectoralState } from './electoral-state.js';
import { applyOpinionDelta } from './npc-votes.js';
import { neutralizeSite } from './strategic-sites.js';
import { paymentStatus } from './campaign-budget.js';
import { DebateSimulation, debateAICommands } from './debate-simulation.js';
import { triggerMeeting, cancelMeeting, candidateOnMeetingStage } from './electoral-buildings.js';

export function seasonAt(progress) {
 const t=Math.min(3.999999,Math.max(0,progress % 1)*4), i=Math.floor(t);
 return {name:['Été','Automne','Hiver','Printemps'][i],index:i,blend:t-i};
}
export function initializeCampaign(sim) {
 const s=sim.state;
 s.campaign_elapsed_days=0; s.campaign_day_remaining=s.days_remaining; s.campaign_progress_01=0; s.campaign_time_offset=0;
 s.campaign_events=[]; s.campaign_director={next_event_day:sim.config.balance.campaign_events.initial_event_delay_days,event_history:[],active_event_ids:[],rng_state:(s.seed^0x9e3779b9)>>>0||1,next_id:1,target_counts:Object.fromEntries(FACTIONS.map(f=>[f,0])),family_weights:{},target_weights:{}};
 for(const c of s.candidates){c.campaign_debate_id=null;c.crisis_meeting_id=null;c.VULNERABLE_SCANDAL=null;}
}
const active=s=>s.campaign_events.filter(e=>e.status==='ACTIVE');
const cfg=sim=>sim.config.balance.campaign_events;
const pick=(rng,items)=>{const sum=items.reduce((n,e)=>n+e.weight,0);if(!(sum>0))return null;let roll=random(rng)*sum;return items.find(e=>(roll-=e.weight)<0)||items.at(-1);};
export function transferSupport(sim,record,faction,delta,multiplier=1){
 return applyOpinionDelta(sim,faction,delta*multiplier*record.electoral_weight/sim.config.layout.total_electors,{subzoneId:record.subzone_id,source:'ÉVÉNEMENT'});
}
function reward(sim,e,faction){for(const r of sim.state.electorate)if(r.biome_id===e.target_biome_id)transferSupport(sim,r,faction,(r.subzone_id===e.target_subzone_id?e.parameters.local_conversion_percent:0)+(e.parameters.biome_conversion_percent||0),e.style_snapshot[faction]?.biome_multipliers[r.biome_id]??1);}
export function resolveCampaignEvent(sim,e,status='RESOLVED',winner=null){
 if(e.status!=='ACTIVE')return;
 if(e.family==='RASSEMBLEMENT')finishRally(sim,e);
 if(e.family==='MEETING_DE_CRISE'&&status==='EXPIRED'){const site=sim.state.buildings.find(b=>b.id===e.target_site_id);if(site?.meeting_candidate_id)cancelMeeting(sim,site);}
 e.status=status;e.resolved_tick=sim.state.tick;e.winner=winner;
 for(const c of sim.state.candidates){if(c.VULNERABLE_SCANDAL===e.id)c.VULNERABLE_SCANDAL=null;if(c.crisis_meeting_id===e.id)c.crisis_meeting_id=null;if(c.campaign_debate_id===e.id){const a=e.debate?.candidates.find(a=>a.id===c.id);clearCampaignUltimate(sim,c);c.bardella_form=false;c.bardellisation_used ||= !!a?.bardellisation_used;c.campaign_debate_id=null;c.disappeared=false;c.campaign_active=true;c.interaction_active=true;c.axis=0;}}
 if(winner&&!['MEETING_DE_CRISE','RASSEMBLEMENT'].includes(e.family))reward(sim,e,winner);
 sim.state.campaign_director.active_event_ids=active(sim.state).map(e=>e.id);
 sim.emit(status==='EXPIRED'?'CampaignEventExpired':'CampaignEventResolved',{campaign_event_id:e.id,winner});
}
export function directorWeights(sim){
 const s=sim.state,d=s.campaign_director,b=cfg(sim),history=d.event_history,recent=history.slice(-b.anti_repeat_window),scores=aggregateNational(s.electorate),rank=[...FACTIONS].sort((a,c)=>scores[c]-scores[a]);
 const targets=Object.fromEntries(rank.map((f,i)=>[f,[b.leader_target_multiplier,b.second_target_multiplier,b.third_target_multiplier][i]*(i===0?1+Math.min(0.5,(scores[f]-scores[rank[1]])/30):1)/(1+recent.filter(e=>e.candidate===f).length*0.5+d.target_counts[f]*0.03)]));
 const weights={};for(const [family,p]of Object.entries(b.families)){
 if(b.active_families&&!b.active_families.includes(family)){weights[family]=0;continue;}
 const last=history.findLast(e=>e.family===family),count=active(s).filter(e=>e.family===family).length;
 weights[family]=s.campaign_elapsed_days<p.minimum_day||s.campaign_elapsed_days>p.maximum_day||count>=p.max_simultaneous||(!p.can_overlap&&active(s).length)||last&&s.campaign_elapsed_days-last.day<Math.max(p.cooldown_days,p.minimum_days_between_same_family)?0:p.base_weight*(history.at(-1)?.family===family?0.2:1);
 }d.family_weights=weights;d.target_weights=targets;d.ranking=rank;return {weights,targets,rank,recent};
}
export class CampaignEventDirector {
 static start(sim,request={}){
 const s=sim.state,d=s.campaign_director,b=cfg(sim);if(!b.event_enabled||s.phase!=='CAMPAIGN'||active(s).length>=b.max_simultaneous_events)return null;
 const {weights,targets,rank,recent}=directorWeights(sim);
 const options=[];
 for(const v of sim.config.campaignCatalog||[]){
 if(b.active_families&&!b.active_families.includes(v.family))continue;
 if(request.family&&request.family!==v.family)continue;
 if(!request.family&&(!weights[v.family]||s.campaign_elapsed_days<v.minimum_day||s.campaign_elapsed_days>v.maximum_day))continue;
 const settings=b.families[v.family];if(active(s).filter(e=>e.family===v.family).length>=settings.max_simultaneous)continue;
 const previousVariant=d.event_history.findLast(e=>e.variant_id===v.event_id);
 if(previousVariant&&(!b.allow_variant_repeat||s.campaign_elapsed_days-previousVariant.day<v.cooldown_days))continue;
 if(request.candidateId&&v.candidate_target&&request.candidateId!==`candidate:${v.candidate_target}`)continue;
 if(request.biomeId&&v.biome_target&&request.biomeId!==v.biome_target)continue;
 for(const c of s.candidates){if(c.minor||c.is_ko||c.campaign_debate_id||c.eliminated||request.candidateId&&request.candidateId!==c.id||v.candidate_target&&v.candidate_target!==c.faction_id)continue;
 const sites=s.buildings.filter(site=>!request.siteId||site.id===request.siteId).filter(site=>v.family==='FERMETURE_BATIMENT'?site.owner_id===c.faction_id&&!site.headquarters&&site.state==='ACTIVE'&&settings.eligible_building_types.includes(site.type):['MEETING_DE_CRISE','DEBAT_THEMATIQUE','RASSEMBLEMENT'].includes(v.family)?site.type==='meeting'&&site.ownership_model==='neutral_service':true).filter(site=>(!v.biome_target||site.biome_id===v.biome_target)&&(!request.biomeId||site.biome_id===request.biomeId));
 if(['MEETING_DE_CRISE','DEBAT_THEMATIQUE'].includes(v.family)){for(let i=sites.length-1;i>=0;i--)if(active(s).some(e=>e.target_site_id===sites[i].id&&['MEETING_DE_CRISE','DEBAT_THEMATIQUE'].includes(e.family)))sites.splice(i,1);}
 if(!sites.length)continue;
 const index=rank.indexOf(c.faction_id),rw=['leader_weight','second_weight','third_weight'][index];
 options.push({v,c,sites,weight:(request.family?settings.base_weight:weights[v.family])*v.weight*styleTagWeight(sim.config,c,v.tags)*targets[c.faction_id]*settings[rw]*v[rw]*(recent.some(e=>e.tags.some(t=>v.tags.includes(t)))?0.7:1)});
 }}
 // Normalize within each family so narrative richness does not bias family frequency.
 const totals=Object.fromEntries(Object.keys(b.families).map(f=>[f,options.filter(o=>o.v.family===f).reduce((n,o)=>n+o.weight,0)]));
 for(const o of options)o.weight=o.weight/totals[o.v.family]*(request.family?b.families[o.v.family].base_weight:weights[o.v.family]);
 const chosen=pick(d,options);if(!chosen)return null;
 const {v,c}=chosen,p={...b.families[v.family],...v.mechanical_parameters};
 const site=pick(d,chosen.sites.map(site=>({site,weight:(recent.at(-1)?.biome===site.biome_id?0.45:1)*(recent.at(-1)?.site_type===site.type&&v.family==='FERMETURE_BATIMENT'?0.4:1)*(s.electorate.find(r=>r.subzone_id===site.subzone_id)?.controller?1:1.3)}))).site;
 const intensity=pick(d,Object.entries({MINOR:0.85-0.55*s.campaign_progress_01,MAJOR:0.14+0.43*s.campaign_progress_01,CRISIS:0.01+0.12*s.campaign_progress_01}).map(([value,w])=>({value,weight:w*p.intensity_weights[value]}))).value;
 const duration=v.duration??p.duration;
 const e={id:`campaign:${d.next_id++}`,variant_id:v.event_id,family:v.family,title:v.title,description:v.description,start_tick:s.tick,end_tick:s.tick+sim.secondsToTicks(duration),target_candidate_ids:v.mechanical_parameters.affected_candidates==='ALL'?s.candidates.filter(c=>!c.minor).map(c=>c.id):[c.id],target_biome_id:site.biome_id,target_subzone_id:site.subzone_id,target_site_id:site.id,status:'ACTIVE',parameters:p,intensity:v.intensity||intensity,category:v.family==='CHOC_OPINION'?'INSTANT':'ACTIVE',attempt:null,participants:[],debate:null};
 e.style_snapshot=Object.fromEntries(s.candidates.filter(candidate=>!candidate.minor).map(candidate=>[candidate.faction_id,{style_id:candidate.current_campaign_style,biome_multipliers:Object.fromEntries(sim.config.layout.biomes.map(b=>[b.id,styleInfluenceMultiplier(sim.config,candidate,b.id)]))}]));
 if(e.family==='RASSEMBLEMENT')startRally(sim,e);
 s.campaign_events.push(e);d.target_counts[c.faction_id]++;
 d.event_history.push({id:e.id,variant_id:v.event_id,family:e.family,day:s.campaign_elapsed_days,candidate:c.faction_id,biome:site.biome_id,site_type:site.type,tags:v.tags,intensity:e.intensity});
 if(e.family==='CANDIDAT_FRAGILISE')c.VULNERABLE_SCANDAL=e.id;
 if(e.family==='CHOC_OPINION'){
  for(const r of s.electorate){
   const delta=p.biome_deltas?.[r.biome_id]??(r.biome_id===e.target_biome_id?p.favored_delta:p.other_biomes_delta);
   transferSupport(sim,r,c.faction_id,delta*v.tags.reduce((n,t)=>n*(activeCampaignStyle(sim.config,c)?.opinion_tag_multipliers?.[t]??1),1));
  }
  resolveCampaignEvent(sim,e);
 }
 if(e.family==='FERMETURE_BATIMENT')e.end_tick=s.tick+sim.secondsToTicks(p.warning_seconds);
 if(e.family==='PIEGE_MEDIATIQUE'){
 const charge=c.special_charge;clearCampaignUltimate(sim,c);c.special_charge=charge;
 e.participants=[c.id];c.campaign_debate_id=e.id;c.purchase_hold=null;c.crisis_meeting_id=null;
 if(!isHumanCandidate(s,c.id)){e.ai_return_tick=s.tick+sim.secondsToTicks(p.AI_absence_duration_range[0]+random(d)*(p.AI_absence_duration_range[1]-p.AI_absence_duration_range[0]));e.end_tick=e.ai_return_tick;}
 else {e.debate=DebateSimulation.create(sim.config,s);e.debate.campaign_event_family=e.family;e.debate.campaign_damage_multiplier=p.player_damage_multiplier;const player=e.debate.candidates.find(a=>a.id===c.id);player.debate_hp=player.debate_initial_hp=100;player.campaign_debate_id=null;const journalists=e.debate.candidates.filter(a=>a.id!==c.id).slice(0,e.intensity==='CRISIS'?2:p.journalist_count);for(const j of journalists){j.is_ko=false;j.disappeared=false;j.eliminated=false;j.faction_id=journalists[0].faction_id;j.debate_hp=j.debate_initial_hp=p.journalist_durability;j.campaign_debate_id=null;j.presentation_name='Journaliste';j.journalist_damage=p.journalist_damage;}e.debate.candidates=[player,...journalists];e.debate.eliminated_faction=null;e.end_tick=null;}
 }
 d.active_event_ids=active(s).map(e=>e.id);refreshElectoralState(s,sim.config);sim.emit('StartCampaignEvent',{campaign_event_id:e.id});return e;
 }
 static update(sim){const s=sim.state,d=s.campaign_director,b=cfg(sim);directorWeights(sim);if(!b.event_enabled||s.campaign_day_remaining<=0||s.campaign_elapsed_days<d.next_event_day)return;if(active(s).length>=b.max_simultaneous_events)return;
 const e=this.start(sim);const [,min,max]=b.frequency_curve.find(([day])=>s.campaign_day_remaining>=day)||b.frequency_curve.at(-1);d.next_event_day=s.campaign_elapsed_days+(e?min+random(d)*(max-min):1);
 }
}
export function updateCampaignEvents(sim){
 const s=sim.state;if(s.phase!=='CAMPAIGN')return;
 if(!cfg(sim).event_enabled){for(const e of active(s))resolveCampaignEvent(sim,e,'EXPIRED');return;}
 for(const e of active(s)){
 if(e.family==='RASSEMBLEMENT'){if(updateRally(sim,e))resolveCampaignEvent(sim,e);continue;}
 const p=e.parameters,site=s.buildings.find(b=>b.id===e.target_site_id),target=s.candidates.find(c=>c.id===e.target_candidate_ids[0]);
 if(e.family==='CANDIDAT_FRAGILISE'&&target.is_ko){const national=aggregateNational(s.electorate)[target.faction_id];const changed=applyOpinionDelta(sim,target.faction_id,-p.ko_poll_loss,{source:'SCANDALE'});sim.emit('ScandalKOTriggered',{candidate_id:target.id,loss:changed*100/sim.config.layout.total_electors});resolveCampaignEvent(sim,e);continue;}
 if(e.family==='FERMETURE_BATIMENT'&&s.tick>=e.end_tick){if(site.owner_id===target.faction_id&&!site.headquarters){const level=site.level;neutralizeSite(sim,site,'CAMPAIGN_EVENT');if(!p.become_neutral){site.owner_id=target.faction_id;site.state='ACTIVE';site.active=true;site.neutral=false;site.level=p.lose_levels?1:level;}}resolveCampaignEvent(sim,e);continue;}
 if(e.family==='MEETING_DE_CRISE'){
 const attempt=e.attempt,c=attempt&&s.candidates.find(c=>c.id===attempt.candidate_id);
 if(c&&!site.meeting_candidate_id){
   if(site.meeting_wave_tick>=attempt.start_tick){resolveCampaignEvent(sim,e,'RESOLVED',c.faction_id);continue;}
   c.crisis_meeting_id=null;e.attempt=null;e.retry_tick=s.tick+sim.secondsToTicks(1);sim.emit('InterruptCrisisMeeting',{campaign_event_id:e.id,candidate_id:c.id});
 }
 if(!e.attempt&&s.tick>=(e.retry_tick||0)){
 const entrant=!site.meeting_candidate_id&&s.candidates.find(c=>!c.minor&&!c.is_ko&&!c.campaign_debate_id&&!c.crisis_meeting_id&&!c.combat.stun_ticks&&!c.combat.attack_id&&!c.combat.charge_active&&c.combat.jump_tick==null&&c.axis===0&&c.interaction_active&&candidateOnMeetingStage(s,sim.config,c,site)&&Math.abs(ringDelta(c.x,site.x,s.world.length))<=sim.config.balance.interaction.radius_units&&paymentStatus(c,sim.config,p.meeting_cost).enabled);
 if(entrant){s.transactions.push({id:`transaction:${s.next_transaction_id++}`,tick:s.tick,candidate_id:entrant.id,faction_id:entrant.faction_id,target_id:site.id,kind:'CRISIS_MEETING',cost:p.meeting_cost});if(s.transactions.length>sim.config.balance.debug.transaction_history_limit)s.transactions.shift();entrant.combat.buffer_until_tick=-1;entrant.money-=p.meeting_cost;entrant.total_spent+=p.meeting_cost;entrant.spending.CRISIS_MEETING=(entrant.spending.CRISIS_MEETING||0)+p.meeting_cost;entrant.crisis_meeting_id=e.id;entrant.purchase_hold=null;e.attempt={candidate_id:entrant.id,start_tick:s.tick,hits:entrant.hits_received};triggerMeeting(sim,site,entrant.faction_id,entrant.id);sim.emit('StartCrisisMeeting',{campaign_event_id:e.id,candidate_id:entrant.id});}
 }
 }
 if(e.family==='DEBAT_THEMATIQUE'){
 const entrant=s.candidates.filter(c=>!c.minor&&!c.is_ko&&!c.campaign_debate_id&&!c.crisis_meeting_id&&!c.combat.stun_ticks&&!c.combat.attack_id&&!c.combat.charge_active&&c.combat.jump_tick==null&&c.axis===0&&c.interaction_active&&Math.abs(ringDelta(c.x,site.x,s.world.length))<=sim.config.balance.interaction.radius_units&&paymentStatus(c,sim.config,p.meeting_cost).enabled)
   .sort((a,b)=>Math.abs(ringDelta(a.x,site.x,s.world.length))-Math.abs(ringDelta(b.x,site.x,s.world.length))||a.id.localeCompare(b.id))[0];
 if(entrant){
   s.transactions.push({id:`transaction:${s.next_transaction_id++}`,tick:s.tick,candidate_id:entrant.id,faction_id:entrant.faction_id,target_id:site.id,kind:'THEMATIC_DEBATE',cost:p.meeting_cost});
   if(s.transactions.length>sim.config.balance.debug.transaction_history_limit)s.transactions.shift();
   entrant.money-=p.meeting_cost;entrant.total_spent+=p.meeting_cost;entrant.spending.THEMATIC_DEBATE=(entrant.spending.THEMATIC_DEBATE||0)+p.meeting_cost;entrant.purchase_hold=null;e.participants=[entrant.id];
   sim.emit('WinThematicDebate',{campaign_event_id:e.id,candidate_id:entrant.id,cost:p.meeting_cost});resolveCampaignEvent(sim,e,'RESOLVED',entrant.faction_id);continue;
 }
 }
 if(e.debate){
 // Player attacks use normal combat damage; only journalist attacks use reduced damage.
 const debate=new DebateSimulation(sim.config,e.debate);
 for(const c of e.debate.candidates)if(!isHumanCandidate(s,c.id)){if(c.presentation_name==='Journaliste')c.special_charge=0;for(const command of debateAICommands(e.debate,sim.config,c.id,true))debate.applyCommand(command);}
 debate.step();
 if(e.debate.eliminated_faction){const loser=e.debate.candidates.find(c=>c.debate_hp<=0)||e.debate.candidates.find(c=>c.faction_id===e.debate.eliminated_faction);if(e.family==='PIEGE_MEDIATIQUE'&&loser.id===target.id){loser.debate_hp=100;loser.combat.stun_ticks=sim.secondsToTicks(2);e.debate.eliminated_faction=null;continue;}e.debate.candidates=e.debate.candidates.filter(c=>c!==loser);e.debate.eliminated_faction=null;
 if(e.family==='PIEGE_MEDIATIQUE'&&(loser.id===target.id||e.debate.candidates.length===1))resolveCampaignEvent(sim,e);
 }
 }
 if(e.status==='ACTIVE'&&e.end_tick!==null&&s.tick>=e.end_tick)resolveCampaignEvent(sim,e,'EXPIRED');
 }
 for(const c of s.candidates){c.disappeared=!!c.campaign_debate_id||(c.is_ko&&s.tick>=c.disappear_tick);if(c.campaign_debate_id)c.axis=0;}
 refreshElectoralState(s,sim.config);
}
export function campaignCommand(sim,command){
 if(command.type==='DebugStartCampaignEvent'){if(!cfg(sim).event_enabled||!CampaignEventDirector.start(sim,command))sim.emit('CampaignEventRejected',{reason:!cfg(sim).event_enabled?'Les événements de campagne sont désactivés.':'Aucune cible admissible, variante déjà utilisée ou limite d’événements atteinte.'});return true;}
 if(command.type==='DebugAdvanceCampaign'){if(sim.state.phase==='CAMPAIGN'){const remaining=Number.isFinite(command.remaining)?Math.max(0,command.remaining):Math.max(0,sim.state.days_remaining-(command.days||0));sim.state.campaign_time_offset+=sim.state.days_remaining-remaining;}return true;}
 const c=sim.state.candidates.find(c=>c.id===command.candidateId);if(c?.campaign_debate_id){const e=sim.state.campaign_events.find(e=>e.id===c.campaign_debate_id);if(e?.debate)new DebateSimulation(sim.config,e.debate).applyCommand(command);return true;}
 if(c?.crisis_meeting_id&&command.type==='Attack')return true;return false;
}
