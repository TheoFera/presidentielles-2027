import { controlledZones } from '../simulation/combat-state.js';
import { buildingSettings } from '../simulation/building-rules.js';
import { cabinetTarget } from '../simulation/faction-buildings.js';
export const attackNames = { CANDIDATE: 'Coup du candidat', VERBAL: 'Attaque verbale', GUARD: 'Coup de SO', HOLOGRAM: 'Coup d’hologramme', CRS: 'Coup de CRS', SPECIAL: 'Pouvoir spécial' };
export const transactionNames = { BUILD: 'Construction', UPGRADE: 'Amélioration', PRINT: 'Impression', REBUILD: 'Reconstruction', EQUIP: 'Équipement SO', RAID: 'Raid', CLOSE: 'Fermeture' };

export function combatReport(state, config, candidate, npc, building) {
  const hz = config.balance.simulation_architecture.fixed_tick_hz;
  const f = v => Number(v).toLocaleString('fr-FR', { maximumFractionDigits: 4 });
  const c = candidate.combat;
  const attack = state.attacks.find(a => a.id === c.attack_id);
  const lines = ['', '— COMBAT DU CANDIDAT —', `Charge spéciale : ${f(candidate.special_charge)} / ${config.balance.special_charge.required_points}`,
    `Territoires contrôlés : ${controlledZones(state, config, candidate.faction_id).length}`,
    `Pertes électorales cumulées : ${f(candidate.electoral_damage_received)} point(s) · ${candidate.hits_received} coup(s) reçu(s)`,
    `Cible : ${c.target_id || 'Aucune'}`, `Attaque : ${attack ? `${attackNames[attack.kind]} · ${attack.id}` : 'Aucune'}`,
    `Combo : ${c.combo_step} / 3 · délai restant ${f(Math.max(0, c.combo_expires_tick - state.tick) / hz)} s`,
    `Étourdissement : ${f(c.stun_ticks / hz)} s · arrêt d’impact : ${f(c.hitstop_ticks / hz)} s`,
    `Vitesse de recul : ${f(c.knockback_velocity)} u/s`,
    c.last_hit ? `Dernier impact : ${c.last_hit.id} · ${c.last_hit.source_id} → ${c.last_hit.target_id}\n  résistance −${f(c.last_hit.damage)} · soutien −${f(c.last_hit.electoral_damage)} · recul ${f(c.last_hit.knockback)}` : 'Dernier impact : aucun',
    `Unités temporaires : ${state.temporary_units.length} · projectiles : ${state.projectiles.length}`];
  if (attack) lines.push(`Préparation / activité / récupération : ${f(attack.windup_ticks / hz)} / ${f(attack.active_ticks / hz)} / ${f(attack.recovery_ticks / hz)} s`, `Dégâts : ${f(attack.damage)} · recul : ${f(attack.knockback)} · portée : ${f(attack.range)} u`);
  if (npc) lines.push('', '— COMBAT DU PNJ —', `Durabilité exacte : ${f(npc.hidden_durability)}`,
    `Cible de combat : ${npc.combat.target_id || 'Aucune'}`,
    `État : ${npc.role === 'DEMOBILISE' ? 'Démobilisé, retour à l’origine' : npc.combat.stun_ticks ? 'Étourdi' : npc.combat.attack_id ? 'Attaque' : npc.combat.engaged ? 'Affrontement' : 'Hors combat'}`,
    `Biome défendu : ${npc.guard_biome_id || 'Aucun'}`,
    `Raid : ${npc.raid ? `${npc.raid.id} · ${npc.raid.direction < 0 ? 'gauche' : 'droite'} · ${npc.raid.phase === 'RETURN' ? 'retour' : 'offensive'} · ${f(Math.max(0, npc.raid.expires_tick - state.tick) / hz)} s` : 'Aucun'}`);
  if (building && building.type !== 'imprimerie') {
    const s = buildingSettings(config, building, candidate.faction_id);
    lines.push('', `Reconstruction : ${f(s.build_cost)} k € · ${building.state === 'CLOSED' ? 'Nécessaire' : 'Non nécessaire'}`);
    if (building.variant === 'cabinet_administratif') for (const d of [-1, 1]) lines.push(`Cible Cabinet ${d < 0 ? 'gauche' : 'droite'} : ${cabinetTarget(state, config, building, d)?.id || 'Aucune'}`);
    if (building.type === 'faction') lines.push(`Prochain raid : ${f(Math.max(0, building.raid_ready_tick - state.tick) / hz)} s · prochaine fermeture : ${f(Math.max(0, building.closure_ready_tick - state.tick) / hz)} s`);
  }
  lines.push(`Équipement : ${f(candidate.spending.EQUIP || 0)} · raids : ${f(candidate.spending.RAID || 0)} · fermetures : ${f(candidate.spending.CLOSE || 0)} · reconstructions : ${f(candidate.spending.REBUILD || 0)} k €`, `Équipements remboursés : ${f(candidate.refunds_received)} k €`);
  return lines.join('\n');
}
