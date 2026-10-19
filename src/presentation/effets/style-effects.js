import { drawUltimateEffect, scarfPose } from './ultimate-sprites.js';
import { scarfHand, scarfGrip } from './scarf-character.js';
import { usesScarfWeapon } from '../personnages/scarf-costume.js';

export function drawStyleEffects(renderer, state) {
  const { ctx, metrics:m, config }=renderer,hz=config.balance.simulation_architecture.fixed_tick_hz;
  const frame=(count,fps=10)=>Math.floor(state.tick*fps/hz)%count;
  ctx.save();
  for(const power of state.powers) {
    if(power.fire_zone?.expires_tick>state.tick) {
      const radius=config.balance.specials.fire.radius*m.pixelsPerUnit;
      // Conserver la taille des flammes et descendre leur sprite : sa base
      // s'enfonce légèrement dans le sol au lieu de sembler flotter dessus.
      drawUltimateEffect(renderer,'fire',6+frame(2),renderer.screenX(power.fire_zone.x)-radius,m.groundY+m.characterHeight*.14-m.characterHeight*.32,radius*2,m.characterHeight*.32);
    }
    for(const [id,burn] of Object.entries(power.burns||{})) {
      if(burn.expires_tick<=state.tick)continue;
      const target=[...state.candidates,...state.npcs,...state.temporary_units].find(t=>t.id===id&&!t.is_ko&&t.faction_id);
      if(target)drawUltimateEffect(renderer,'fire',6+frame(2),renderer.screenX(target.x)-m.characterHeight*.14,m.groundY+m.characterHeight*(.06-.3-(target.combat?.height||0)),m.characterHeight*.28,m.characterHeight*.3);
    }
  }
  for(const c of state.candidates) {
    if(c.is_ko||c.disappeared)continue;
    if(renderer.scarfTransitionBodies?.get(c.id)===state.tick)continue;
    const x=renderer.screenX(c.x),h=m.characterHeight,feet=m.groundY+h*.06-(c.combat?.height||0)*h;
    if(c.ultimate_effect?.kind==='EUROPE'&&c.ultimate_effect.expires_tick>state.tick) {
      // last_hit is replaced by the outgoing retaliation. Use its confirmed
      // result, so ranged hits and evaded attacks never display a counter.
      const counter=state.hit_results?.findLast(hit=>hit.source_id===c.id&&(hit.attack_id?.startsWith('riposte:')||hit.attack_id?.startsWith('europe-dash:'))&&hit.damage>0&&state.tick>=hit.tick&&state.tick-hit.tick<hz*.3);
      if(counter){
        ctx.save();ctx.globalAlpha=Math.min(1,(1-(state.tick-counter.tick)/(hz*.3))*2);
        drawUltimateEffect(renderer,'europe',12,x-h*.48,feet-h*1.48,h*.96,h*1.58);
        ctx.restore();
      }
    }
    // The attack's lifetime remains authoritative if the power expires mid-swing.
    const attack=state.attacks.find(a=>a.owner_id===c.id&&a.kind==='SCARF'&&a.id===c.combat?.attack_id);
    if(attack || usesScarfWeapon(c,state) || renderer.scarfTransitionHeld?.get(c.id)===state.tick) {
      const pose=attack?scarfPose(attack):{frame:0,extension:0};
      const direction=attack?.direction||c.facing||1;
      const recorded=renderer.scarfHands?.get(c.id);
      const grip=recorded?.tick===state.tick?recorded:null;
      const hand=grip?scarfGrip(grip.atlas,grip.frame,grip.scale):scarfHand(c,h,pose.frame);
      const floor=m.groundY+h*(m.groundOffsetRatio??.06)-(c.combat?.height||0)*h;
      const handX=(grip?.x??x)+direction*hand.x,handY=(grip?.y??floor)+hand.y;
      const thickness=h*.13;
      if(pose.extension>0) {
        const reach=attack.range*m.pixelsPerUnit;
        const length=h*.36+(Math.max(0,reach-hand.x)-h*.36)*pose.extension;
        drawUltimateEffect(renderer,'scarf',6,handX,handY-thickness*.43,length,thickness,direction);
      } else {
        // L'écharpe reste saisie entre les coups, et passe derrière le poing à l'armé.
        const angle=attack && attack.elapsed_ticks<attack.windup_ticks?1.2+pose.frame*.8:1.2;
        ctx.save();ctx.translate(handX,handY);ctx.scale(direction,1);ctx.rotate(angle);
        drawUltimateEffect(renderer,'scarf',6,0,-thickness*.43,h*.36,thickness);
        ctx.restore();
      }
    }
  }
  ctx.restore();
}
