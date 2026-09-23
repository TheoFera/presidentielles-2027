import {melenchonExtraPose} from './melenchon-extra-poses.js';
import {melenchonExtraAtlases} from './melenchon-extra-atlases.js';
import {additionalExtraAtlases} from './candidate-extra-atlases.js';
import {skinAnimationFor} from './skin-animation-atlases.js';

export const candidateExtraAtlases={melenchon:melenchonExtraAtlases,...additionalExtraAtlases};

export const extraAtlasesFor = actor => skinAnimationFor(actor)?.extras || candidateExtraAtlases[actor.faction_id];

// Shared action timing, independent drawn sheets for each candidate.
export function candidateExtraPose(actor,state,config,guard,landingAge=null,walkFrame=0){
 const pose=melenchonExtraPose(actor,state,config,guard,landingAge,walkFrame);
 if(!pose||actor.faction_id==='melenchon'&&!skinAnimationFor(actor))return pose;
 if(!extraAtlasesFor(actor))return null;
 const frame=pose.frame;
 switch(pose.name){
  case 'combat_walk':return {...pose,sheet:'movement',frame};
  case 'dash':return {...pose,sheet:'movement',frame:frame+4};
  case 'hit_light':return {...pose,sheet:'movement',frame:pose.sheet==='fighter'?frame+5:frame+4};
  case 'hit_heavy':return {...pose,sheet:'movement',frame:frame+4};
  case 'knockback':return {...pose,sheet:'movement',frame:15};
  case 'stun':return {...pose,sheet:'actions',frame:frame-12};
  case 'landing':return {...pose,sheet:'actions',frame:frame-12};
  case 'persuade':return {...pose,sheet:'actions',frame:frame-2};
  case 'interaction_hold':return {...pose,sheet:'actions',frame:frame+2};
  default:return {...pose,sheet:'actions'}; // KO (10–13), activation (14–15).
 }
}
