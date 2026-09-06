import { seasonAt, orientationOptions, availableOrientations } from '../simulation/campaign-events.js';
import { ringDelta, wrap } from '../simulation/world.js';
const labels={MEETING_DE_CRISE:'Meeting exceptionnel',CHOC_OPINION:'Choc d’opinion',CANDIDAT_FRAGILISE:'Candidat fragilisé — prime au KO',PIEGE_MEDIATIQUE:'Piège médiatique',DEBAT_THEMATIQUE:'Débat thématique',CRISE_FINANCEMENT:'Crise de financement',FERMETURE_BATIMENT:'Fermeture de bâtiment'};
export class CampaignDisplay {
 constructor(config){this.config=config;this.cards=new Map();this.seen=new Map();this.seed=null;this.lastTick=0;this.root=document.createElement('div');this.root.id='campaign-events';this.root.setAttribute('aria-live','polite');document.body.append(this.root);this.orientationRoot=document.createElement('section');this.orientationRoot.id='campaign-orientation';this.orientationRoot.setAttribute('aria-live','polite');(document.getElementById('game')||document.body).append(this.orientationRoot);}
 update(state){
 if(this.seed!==state.seed||state.tick<this.lastTick){this.root.replaceChildren();this.cards.clear();this.seen.clear();this.seed=state.seed;}const previousTick=this.lastTick;this.lastTick=state.tick;const now=performance.now();
 const hz=this.config.balance.simulation_architecture.fixed_tick_hz;
 const displaySeconds=this.config.balance.campaign_events.notification_display_seconds,arrivalSeconds=this.config.balance.campaign_events.notification_arrival_seconds;
 for(const e of state.campaign_events){if(!this.seen.has(e.id))this.seen.set(e.id,e.status==='ACTIVE'||e.start_tick>=previousTick?now:-Infinity);const age=(now-this.seen.get(e.id))/1000,visible=state.phase==='CAMPAIGN'&&(e.status==='ACTIVE'||age<displaySeconds);
 if(!visible){this.cards.get(e.id)?.remove();this.cards.delete(e.id);continue;}
 let card=this.cards.get(e.id);if(!card){card=document.createElement('article');card.className='campaign-card';this.root.append(card);this.cards.set(e.id,card);}
 const zone=state.world.subzones.find(z=>z.id===e.target_subzone_id),names=e.target_candidate_ids.map(id=>this.config.prototype.presentation.factions[state.candidates.find(c=>c.id===id).faction_id].name).join(', ');
 card.style.order = e.start_tick;
 const heading=document.createElement('strong');heading.textContent=e.title;
 const narrative=document.createElement('span');narrative.className='campaign-card-narrative';narrative.textContent=e.description;
 const effect=e.family==='CRISE_FINANCEMENT' ? (e.parameters.can_start_new_campaign===false ? 'Nouvelles collectes bloquées' : e.parameters.payout_multiplier ? 'Rendement des collectes ×'+e.parameters.payout_multiplier.toLocaleString('fr-FR') : 'Durée des collectes ×'+e.parameters.campaign_duration_multiplier.toLocaleString('fr-FR')) : e.family==='CANDIDAT_FRAGILISE' ? 'KO : −'+e.parameters.ko_poll_loss+' points nationaux vers les Neutres' : e.family==='FERMETURE_BATIMENT' ? ({permanence:'Permanence',financement:'Financement',faction:'Local de faction',tour_communication:'Tour de communication'}[state.buildings.find(b=>b.id===e.target_site_id).type]+' bientôt neutralisé') : labels[e.family];
 const detail=document.createElement('span');detail.textContent=`${effect} · ${['MEETING_DE_CRISE','DEBAT_THEMATIQUE','FERMETURE_BATIMENT','CHOC_OPINION'].includes(e.family)?zone.biome_name+' · ':''}${['MEETING_DE_CRISE','DEBAT_THEMATIQUE'].includes(e.family)?'Ouvert aux trois candidats':names}`;
 const timer=document.createElement('small');timer.textContent=e.attempt?`Tenir la position : ${Math.min(e.parameters.meeting_hold_seconds,(state.tick-e.attempt.start_tick)/hz).toFixed(1)} / ${e.parameters.meeting_hold_seconds} s`:`${e.category==='INSTANT'?'Effet instantané':e.end_tick===null?'Battez les journalistes — le monde continue':Math.max(0,Math.ceil((e.end_tick-state.tick)/hz))+' s'} · Fiction satirique`;
 card.replaceChildren(heading,narrative,detail,timer);card.classList.toggle('arriving',age<arrivalSeconds);card.classList.toggle('instant',e.category==='INSTANT');
 }
 this.updateOrientation(state);
 }
 updateOrientation(state){
 const candidate=state.candidates.find(c=>c.id===state.local_candidate_id),available=candidate?availableOrientations(state,this.config,candidate):0;
 if(state.phase!=='CAMPAIGN'||!candidate||candidate.eliminated||available<=0){this.orientationRoot.hidden=true;this.orientationRoot.replaceChildren();return;}
 this.orientationRoot.hidden=false;
 const hq=state.buildings.find(b=>b.id===candidate.headquarters_site_id&&b.headquarters&&b.owner_id===candidate.faction_id);
 const near=!!hq&&Math.abs(ringDelta(candidate.x,hq.x,state.world.length))<=12;
 const title=document.createElement('strong');title.textContent='Choisissez votre type de campagne';
 const count=document.createElement('span');count.className='orientation-count';count.textContent=`${available} décision${available>1?'s':''} disponible${available>1?'s':''}`;
 const instruction=document.createElement('p');instruction.textContent=!hq?'Capturez un Local pour établir votre QG et faire ce choix.':!near?'Retournez à votre QG pour choisir votre orientation.':`Placez-vous sur un repère devant le QG et restez immobile ${this.config.balance.campaign_events.orientation_hold_seconds.toLocaleString('fr-FR')} secondes.`;
 const options=document.createElement('div');options.className='orientation-options';
 if(hq&&near)for(const [index,entry]of orientationOptions[candidate.faction_id].entries()){
 const [name,biomeId]=entry,biome=this.config.layout.biomes.find(b=>b.id===biomeId),option=document.createElement('div');option.className='orientation-option';option.classList.toggle('active',candidate.orientation_hold?.index===index);
 const heading=document.createElement('strong');heading.textContent=name;const target=document.createElement('span');target.textContent=biome.display_name;
 const previous=candidate.orientation_choices.filter(choice=>choice.biome===biomeId).length,effect=document.createElement('small');effect.textContent=`+${Math.round(this.config.balance.campaign_events.orientation_bonus*100)} % aux gains électoraux des événements${previous?` · déjà choisie ${previous} fois`:''}`;
 const progress=document.createElement('i');if(candidate.orientation_hold?.index===index)progress.style.width=`${Math.min(100,(state.tick-candidate.orientation_hold.start_tick)/(this.config.balance.campaign_events.orientation_hold_seconds*this.config.balance.simulation_architecture.fixed_tick_hz)*100)}%`;
 option.append(heading,target,effect,progress);options.append(option);
 }
 this.orientationRoot.replaceChildren(title,count,instruction,options);
 }
}
export function drawCampaignScenery(renderer,state){
 const {ctx,metrics:m}=renderer,p=state.campaign_progress_01||0,season=seasonAt(p),colors=[[115,188,220],[184,159,124],[160,181,199],[151,208,218]],a=colors[season.index],b=colors[(season.index+1)%4];
 ctx.fillStyle=`rgba(${a.map((v,i)=>Math.round(v+(b[i]-v)*season.blend)).join(',')},0.26)`;ctx.fillRect(0,0,renderer.width,m.groundY);
 for(const z of state.world.subzones)for(let i=0;i<4;i++){
 const x=renderer.screenX(z.start+z.width*(i+0.35)/4);if(x<-100||x>renderer.width+100)continue;
 const h=48+(z.index*17+i*11)%35,y=m.groundY+2;
 ctx.strokeStyle='#665245';ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x,y-h);ctx.moveTo(x,y-h*0.55);ctx.lineTo(x-18,y-h*0.8);ctx.moveTo(x,y-h*0.65);ctx.lineTo(x+19,y-h*0.95);ctx.stroke();
 const local=seasonAt(Math.min(1,p+(i-1.5)*0.007));const leaf=[1,0.9,0,0.55],alpha=leaf[local.index]+(leaf[(local.index+1)%4]-leaf[local.index])*local.blend;
 const c=[[58,130,65],[188,103,42],[150,118,69],[116,176,91]],ca=c[local.index],cb=c[(local.index+1)%4];ctx.fillStyle=`rgba(${ca.map((v,i)=>Math.round(v+(cb[i]-v)*local.blend)).join(',')},${alpha})`;
 for(const [dx,dy,r]of [[0,0,23],[-18,14,18],[18,10,19]]){ctx.beginPath();ctx.arc(x+dx,y-h+dy,r,0,Math.PI*2);ctx.fill();}
 }
}
export function drawCampaignMarkers(renderer,state){
 const {ctx,metrics:m}=renderer;ctx.save();ctx.textAlign='center';ctx.font='bold 13px sans-serif';
 for(const e of state.campaign_events.filter(e=>e.status==='ACTIVE')){
 const b=state.buildings.find(b=>b.id===e.target_site_id);if(!['MEETING_DE_CRISE','DEBAT_THEMATIQUE','FERMETURE_BATIMENT'].includes(e.family))continue;
 const x=renderer.screenX(b.x);ctx.strokeStyle='#ffe078';ctx.lineWidth=3;ctx.beginPath();ctx.ellipse(x,m.groundY-2,36,9,0,0,Math.PI*2);ctx.stroke();ctx.fillStyle='#fff1ab';ctx.fillText(e.title,x,m.groundY-140);
 if(e.family==='MEETING_DE_CRISE')ctx.fillText(`Rester ${e.parameters.meeting_hold_seconds} s · ${e.parameters.meeting_cost} k€`,x,m.groundY-122);
 }
 for(const c of state.candidates){
 if(state.campaign_events.some(e=>e.status==='ACTIVE'&&e.family==='CANDIDAT_FRAGILISE'&&e.target_candidate_ids.includes(c.id))){ctx.fillStyle='#ffdb76';ctx.fillText('⚠ Prime au KO',renderer.screenX(c.x),m.groundY-m.characterHeight-35);}
 if(availableOrientations(state,renderer.config,c)<=0)continue;
 const hq=state.buildings.find(b=>b.id===c.headquarters_site_id);if(!hq)continue;
 orientationOptions[c.faction_id].forEach(([name,biome],i)=>{const x=renderer.screenX(wrap(hq.x+(i-1)*3,state.world.length));ctx.fillStyle=c.id===state.local_candidate_id?'#9cffc2':'#c3d2d9';ctx.fillRect(x-10,m.groundY-9,20,9);if(c.id===state.local_candidate_id){ctx.save();ctx.translate(x,m.groundY-30-(i%2)*18);ctx.font='11px sans-serif';ctx.fillText(name,0,0);ctx.restore();}});
 ctx.fillStyle='#a4ffcb';ctx.fillText('Orientation disponible · rester 3 s sur un repère',renderer.screenX(hq.x),m.groundY-168);
 }ctx.restore();
}
export function installCampaignDebug(panel){
 const box=document.createElement('fieldset'),legend=document.createElement('legend');legend.textContent='Année électorale et événements';box.append(legend);
 const select=document.createElement('select');select.setAttribute('aria-label','Famille d’événement');for(const [id,label]of Object.entries(labels))select.add(new Option(label,id));box.append(select);
 const button=(label,fn)=>{const b=document.createElement('button');b.textContent=label;b.type='button';b.onclick=fn;box.append(b);};
 button('Déclencher sur la cible sélectionnée',()=>panel.callbacks.queue({type:'DebugStartCampaignEvent',family:select.value,candidateId:panel.candidate.value,biomeId:panel.callbacks.state().world.subzones.find(z=>z.id===panel.zone.value)?.biome_id,...(select.value==='FERMETURE_BATIMENT'?{siteId:panel.inspectBuilding.value}:{})}));
 button('Déclencher avec cible automatique',()=>panel.callbacks.queue({type:'DebugStartCampaignEvent',family:select.value}));
 for(const days of [30,100])button(`+${days} jours`,()=>panel.callbacks.queue({type:'DebugAdvanceCampaign',days}));for(const remaining of [30,5])button(`Aller à J-${remaining}`,()=>panel.callbacks.queue({type:'DebugAdvanceCampaign',remaining}));
 panel.campaignReport=document.createElement('pre');box.append(panel.campaignReport);panel.element.insertBefore(box, panel.text);
}
export function campaignDebugReport(state){const d=state.campaign_director;return `J-${state.campaign_day_remaining} · ${seasonAt(state.campaign_progress_01).name}\nProchain événement : jour ${d.next_event_day.toFixed(1)}\nActifs : ${d.active_event_ids.join(', ')}\nPoids familles : ${JSON.stringify(d.family_weights)}\nPoids cibles : ${JSON.stringify(d.target_weights)}\nClassement : ${(d.ranking||[]).join(' > ')}\nOrientations : ${state.candidates.map(c=>c.faction_id+' '+JSON.stringify(c.campaign_orientation_bonuses)).join('\n')}\nHistorique : ${d.event_history.slice(-8).map(e=>e.family+' · '+e.candidate+' · jour '+e.day).join('\n')}`;}
