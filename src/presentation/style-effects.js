import { drawUltimateEffect, scarfPose } from './ultimate-sprites.js';

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
    const x=renderer.screenX(c.x),h=m.characterHeight,feet=m.groundY+h*.06-(c.combat?.height||0)*h;
    if(c.ultimate_effect?.kind==='EUROPE'&&c.ultimate_effect.expires_tick>state.tick) {
      // last_hit is replaced by the outgoing retaliation. Use its confirmed
      // result, so ranged hits and evaded attacks never display a counter.
      const counter=state.hit_results?.findLast(hit=>hit.source_id===c.id&&hit.attack_id?.startsWith('riposte:')&&hit.damage>0&&state.tick>=hit.tick&&state.tick-hit.tick<hz*.3);
      if(counter){
        ctx.save();ctx.globalAlpha=Math.min(1,(1-(state.tick-counter.tick)/(hz*.3))*2);
        drawUltimateEffect(renderer,'europe',12,x-h*.48,feet-h*1.48,h*.96,h*1.58);
        ctx.restore();
      }
    }
    // The attack's lifetime remains authoritative if the power expires mid-swing.
    const attack=state.attacks.find(a=>a.owner_id===c.id&&a.kind==='SCARF'&&a.id===c.combat?.attack_id);
    if(attack) {
      const pose=scarfPose(attack),reach=attack.range*m.pixelsPerUnit,direction=attack.direction||1;
      if(pose.extension>0) {
        const hand=h*.39*1.12,length=Math.max(0,reach-hand)*pose.extension;
        drawUltimateEffect(renderer,'scarf',pose.cloth,x+direction*hand,feet-h*.76*1.06,length,h*.18*1.06,direction);
      }
    }
  }
  ctx.restore();
}
