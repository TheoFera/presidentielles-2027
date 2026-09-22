import { seasonAt } from '../simulation/campaign-events.js';
import { ringDelta, wrap } from '../simulation/world.js';
import { eventIconData } from './illustrated-icons.js';
const labels={MEETING_DE_CRISE:'Meeting exceptionnel',CHOC_OPINION:'Choc d’opinion',CANDIDAT_FRAGILISE:'Candidat fragilisé — prime au KO',PIEGE_MEDIATIQUE:'Piège médiatique',DEBAT_THEMATIQUE:'Débat thématique',CRISE_FINANCEMENT:'Crise de financement',FERMETURE_BATIMENT:'Fermeture de bâtiment'};

function fundingEffectText(parameters) {
 const effects = [];
 if (parameters.can_start_new_campaign === false) effects.push('Nouvelles collectes bloquées');
 // Chaque variante ne fournit que les paramètres de ses effets ; zéro reste une valeur valide.
 if (Number.isFinite(parameters.payout_multiplier)) effects.push(`Rendement des collectes ×${parameters.payout_multiplier.toLocaleString('fr-FR')}`);
 if (Number.isFinite(parameters.campaign_duration_multiplier)) effects.push(`Durée des collectes ×${parameters.campaign_duration_multiplier.toLocaleString('fr-FR')}`);
 if (Number.isFinite(parameters.payout_max)) effects.push(`Collectes plafonnées à ${parameters.payout_max.toLocaleString('fr-FR')} k€`);
 return effects.join(' · ') || labels.CRISE_FINANCEMENT;
}

export class CampaignDisplay {
 constructor(config){this.config=config;this.cards=new Map();this.seen=new Map();this.seed=null;this.lastTick=0;this.root=document.createElement('div');this.root.id='campaign-events';this.root.setAttribute('aria-live','polite');(document.getElementById('game')||document.body).append(this.root);}
 update(state){
 if(this.seed!==state.seed||state.tick<this.lastTick){this.root.replaceChildren();this.cards.clear();this.seen.clear();this.seed=state.seed;}const previousTick=this.lastTick;this.lastTick=state.tick;const now=performance.now();
 const hz=this.config.balance.simulation_architecture.fixed_tick_hz;
 const displaySeconds=this.config.balance.campaign_events.notification_display_seconds,arrivalSeconds=this.config.balance.campaign_events.notification_arrival_seconds;
 for(const e of state.campaign_events){if(!this.seen.has(e.id))this.seen.set(e.id,e.status==='ACTIVE'||e.start_tick>=previousTick?now:-Infinity);const age=(now-this.seen.get(e.id))/1000,visible=state.phase==='CAMPAIGN'&&(e.status==='ACTIVE'||age<displaySeconds);
 if(!visible){this.cards.get(e.id)?.remove();this.cards.delete(e.id);continue;}
 let card=this.cards.get(e.id);if(!card){card=document.createElement('article');card.className='campaign-card';card.tabIndex=0;card.setAttribute('role','button');card.setAttribute('aria-expanded','false');const toggle=()=>{const expanded=card.classList.toggle('expanded');card.setAttribute('aria-expanded',String(expanded));};card.onclick=toggle;card.onkeydown=event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();toggle();}};this.root.append(card);this.cards.set(e.id,card);}
 const zone=state.world.subzones.find(z=>z.id===e.target_subzone_id),names=e.target_candidate_ids.map(id=>this.config.prototype.presentation.factions[state.candidates.find(c=>c.id===id).faction_id].name).join(', ');
 card.style.order = e.start_tick; card.dataset.family = e.family; card.style.setProperty('--event-icon', eventIconData[e.family] || 'none');
 const heading=e.title;
 const narrative=e.description;
 const effect=e.family==='CRISE_FINANCEMENT' ? fundingEffectText(e.parameters) : e.family==='CANDIDAT_FRAGILISE' ? 'KO : −'+e.parameters.ko_poll_loss+' points nationaux vers les Neutres' : e.family==='FERMETURE_BATIMENT' ? ({permanence:'Permanence',financement:'Financement',faction:'Local de faction',tour_communication:'Tour de communication'}[state.buildings.find(b=>b.id===e.target_site_id).type]+' bientôt neutralisé') : labels[e.family];
 const winner=e.winner&&this.config.prototype.presentation.factions[e.winner]?.name;
 const detail=e.family==='DEBAT_THEMATIQUE'&&winner?`${effect} · ${zone.biome_name} · remporté par ${winner}`:`${effect} · ${['MEETING_DE_CRISE','DEBAT_THEMATIQUE','FERMETURE_BATIMENT','CHOC_OPINION'].includes(e.family)?zone.biome_name+' · ':''}${['MEETING_DE_CRISE','DEBAT_THEMATIQUE'].includes(e.family)?'Ouvert aux trois candidats':names}`;
 const timer=e.family==='DEBAT_THEMATIQUE'?(e.status==='ACTIVE'?`Premier candidat à payer au Meeting : ${e.parameters.meeting_cost.toLocaleString('fr-FR')} k€`:'Victoire attribuée dès le paiement · Fiction satirique'):e.attempt?`Tenir la position : ${Math.min(e.parameters.meeting_hold_seconds,(state.tick-e.attempt.start_tick)/hz).toFixed(1)} / ${e.parameters.meeting_hold_seconds} s`:`${e.category==='INSTANT'?'Effet instantané':e.end_tick===null?'Battez les journalistes — le monde continue':Math.max(0,Math.ceil((e.end_tick-state.tick)/hz))+' s'} · Fiction satirique`;
 const contentKey=[heading,narrative,detail,timer].join('\n');
 if(card.dataset.contentKey!==contentKey){
   if(!card.children.length){const nodes=['strong','span','span','small'].map(tag=>document.createElement(tag));nodes[1].className='campaign-card-narrative';card.append(...nodes);}
   [heading,narrative,detail,timer].forEach((text,index)=>{if(card.children[index].textContent!==text)card.children[index].textContent=text;});
   card.setAttribute('aria-label',e.title+' : afficher ou masquer les détails');card.dataset.contentKey=contentKey;
 }
 card.classList.toggle('arriving',age<arrivalSeconds);card.classList.toggle('instant',e.category==='INSTANT');
 }
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
 if(e.family==='DEBAT_THEMATIQUE')ctx.fillText(`Premier paiement · ${e.parameters.meeting_cost} k€`,x,m.groundY-122);
 }
 for(const c of state.candidates){
 if(state.campaign_events.some(e=>e.status==='ACTIVE'&&e.family==='CANDIDAT_FRAGILISE'&&e.target_candidate_ids.includes(c.id))){ctx.fillStyle='#ffdb76';ctx.fillText('⚠ Prime au KO',renderer.screenX(c.x),m.groundY-m.characterHeight-35);}

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
export function campaignDebugReport(state){const d=state.campaign_director;return `J-${state.campaign_day_remaining} · ${seasonAt(state.campaign_progress_01).name}\nProchain événement : jour ${d.next_event_day.toFixed(1)}\nActifs : ${d.active_event_ids.join(', ')}\nPoids familles : ${JSON.stringify(d.family_weights)}\nPoids cibles : ${JSON.stringify(d.target_weights)}\nClassement : ${(d.ranking||[]).join(' > ')}\nStyles : ${state.candidates.map(c=>c.faction_id+' '+c.current_campaign_style).join('\n')}\nHistorique : ${d.event_history.slice(-8).map(e=>e.family+' · '+e.candidate+' · jour '+e.day).join('\n')}`;}
