import { move, setCampaignActive, interactionPresence, attack } from './commands.js';
import { ringDelta, zoneAt } from './world.js';
import { buildingOffers } from './economy.js';
import { nearestEnemy } from './combat-state.js';

/** Finalists use the ordinary validated commands, prices and presence requirements. */
export function sprintAICommands(state, config, c) {
  const commands = (axis, purchase = false) => [setCampaignActive(c.id, state.ai_enabled), interactionPresence(c.id, state.ai_enabled && purchase), move(c.id, axis)];
  if (!state.ai_enabled) return commands(0);
  const settings = config.balance.second_round;
  const delta = x => ringDelta(c.x, x, state.world.length);
  const go = (x, radius, purchase = false) => commands(Math.abs(delta(x)) <= radius ? 0 : Math.sign(delta(x)), purchase && Math.abs(delta(x)) <= radius);
  const rival = nearestEnemy(state, c, settings.ai_opponent_detection_range, t => t.role === 'CANDIDAT');
  if (rival) {
    const close = Math.abs(delta(rival.x)) <= config.balance.candidate_combat.light_range;
    const result = commands(close ? 0 : Math.sign(delta(rival.x)));
    if (close && !c.combat.attack_id && !c.combat.stun_ticks) result.push(attack(c.id, Math.sign(delta(rival.x)) || c.facing));
    return result;
  }
  const talking = state.npcs.find(n => n.role === 'NEUTRE' && n.persuasion?.actor_id === c.id);
  if (talking) return commands(0);
  const economic = state.buildings.flatMap(b => b.id === c.purchase_latch_target_id ? [] : buildingOffers(state, config, c, b).filter(o => o.enabled
    && (o.kind === 'MEETING' || o.kind === 'RAID' || o.kind === 'CLOSE' || o.kind === 'BUILD' && ['meeting', 'permanence', 'institut_sondage'].includes(b.type))))
    .filter(o => Math.abs(delta(o.x)) <= settings.ai_meeting_distance)
    .sort((a, b) => Number(b.kind === 'MEETING') - Number(a.kind === 'MEETING') || Math.abs(delta(a.x)) - Math.abs(delta(b.x)));
  if (economic[0]) return go(economic[0].x, economic[0].radius * config.prototype.ai.stop_distance_radius_ratio, true);
  const targets = state.npcs.filter(n => ['NEUTRE', 'DEMOBILISE'].includes(n.role) && !n.persuasion && Math.abs(delta(n.x)) <= settings.ai_recruit_distance);
  const rank = n => Math.abs(delta(n.x)) - (n.former_eliminated_faction ? settings.ai_former_third_priority : 0) + (n.role === 'DEMOBILISE' ? 8 : 0);
  targets.sort((a, b) => rank(a) - rank(b) || a.id.localeCompare(b.id));
  if (targets[0]) {
    const n = targets[0];
    // Walk alongside returnees; they still must reach home before becoming persuadable.
    return go(n.x, config.prototype.persuasion.radius_units * config.prototype.ai.stop_distance_radius_ratio);
  }
  const zones = [...state.electorate].sort((a, b) => {
    const value = e => Math.abs(delta(state.world.subzones.find(z => z.id === e.subzone_id).center)) - e.support.neutral * settings.ai_neutral_zone_priority - (!e.controller ? 3 : 0);
    return value(a) - value(b) || a.subzone_id.localeCompare(b.subzone_id);
  });
  const zone = state.world.subzones.find(z => z.id === zones[0].subzone_id);
  return go(zone.center, config.prototype.persuasion.radius_units);
}
