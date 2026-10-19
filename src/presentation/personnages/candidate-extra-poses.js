import {melenchonExtraPose} from './melenchon-extra-poses.js';
import {melenchonExtraAtlases} from './melenchon-extra-atlases.js';
import {additionalExtraAtlases} from './candidate-extra-atlases.js';
import {skinAnimationFor} from './skin-animation-atlases.js';
import {minorExtraAtlases} from './minor-animation-sprites.js';

export const candidateExtraAtlases={melenchon:melenchonExtraAtlases,...additionalExtraAtlases,...minorExtraAtlases};

export const extraAtlasesFor = actor => skinAnimationFor(actor)?.extras || candidateExtraAtlases[actor.faction_id];

// Shared action timing, independent drawn sheets for each candidate.
export function candidateExtraPose(actor,state,config,guard,landingAge=null,walkFrame=0){
 const pose=melenchonExtraPose(actor,state,config,guard,landingAge,walkFrame);
 if(!pose||actor.faction_id==='melenchon'&&!skinAnimationFor(actor))return pose;
 if(!extraAtlasesFor(actor))return null;
 // L'appel finit avant la récupération de SPECIAL : revenir directement à la garde.
 if(actor.faction_id==='glucksmann' && pose.name==='ultimate') {
  const delivery=state.powers.find(p=>p.owner_id===actor.id && p.kind==='DELIVERY' && p.expires_tick>state.tick);
  const callTicks=Math.ceil(config.balance.minor_ultimates.delivery.call_seconds*config.balance.simulation_architecture.fixed_tick_hz-1e-9);
  if(delivery && state.tick>=delivery.started_tick+callTicks) return {...pose,sheet:'guardIdle',frame:0,name:'combat_idle'};
 }
 if(minorExtraAtlases[actor.faction_id] && ['interaction_hold','ultimate'].includes(pose.name))return null;
 const frame=pose.frame;
 switch(pose.name){
  case 'combat_walk':return {...pose,sheet:extraAtlasesFor(actor).guardWalk?'guardWalk':'movement',frame};
  case 'dash':return {...pose,sheet:'movement',frame:frame+4};
  case 'hit_light':return {...pose,sheet:'movement',frame:pose.sheet==='fighter'?frame+5:frame+4};
  case 'hit_heavy':return {...pose,sheet:'movement',frame:frame+4};
  case 'knockback':return {...pose,sheet:'movement',frame:15};
  case 'stun':return {...pose,sheet:'actions',frame:frame-12};
  case 'landing':return {...pose,sheet:'actions',frame:frame-12};
  case 'persuade':return extraAtlasesFor(actor).persuasion
    ? {...pose,sheet:'persuasion',frame:frame-6}
    : {...pose,sheet:'actions',frame:frame-2};
  case 'interaction_hold':return {...pose,sheet:'actions',frame:frame+2};
  case 'ko_fall': case 'ko_ground': return actor.faction_id === 'attal'
    ? {...pose,sheet:'knockout',frame:frame-9}
    : {...pose,sheet:'actions',frame:minorExtraAtlases[actor.faction_id]?frame-2:frame};
  default:return {...pose,sheet:'actions'}; // KO (10–13), activation (14–15).
 }
}
