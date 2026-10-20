// Scène d'ouverture de la Campagne : chaque candidat se déclare sur l'estrade de sa sous-zone de départ,
// devant les habitants du quartier et trois équipes de journalistes. Le joueur peut marcher sur
// l'estrade ; son premier coup disperse les journalistes et lance la campagne.
//
// Pendant la scène, le temps de la campagne est gelé : `state.tick` ne bouge pas, aucun jour ne passe,
// ni l'IA, ni les passants, ni l'économie n'avancent. Seul `campaign_intro.tick` compte le temps de la
// scène (il sert aussi à animer l'affichage). La partie démarre donc exactement comme sans la scène.
//
// Multijoueur : la scène est dans l'état partagé (l'hôte la fait avancer). La campagne démarre quand
// tous les joueurs ont frappé, ou `multiplayer_wait_seconds` après le premier coup.
import { FACTIONS, ringDelta, wrap } from './world.js';
import { movementBlocked } from './combat-state.js';
import { isHumanCandidate } from './human-candidates.js';

const majorCandidates = state => state.candidates.filter(c => FACTIONS.includes(c.faction_id) && !c.minor && !c.eliminated);
const settingsOf = config => config.prototype.campaign_intro;

/** Estrade (place de meeting) de la sous-zone de départ d'un candidat. */
export function introStage(state, config, candidate) {
  const zoneId = config.layout.starting_positions[candidate.faction_id];
  return state.buildings.find(b => b.type === 'meeting' && b.subzone_id === zoneId) || null;
}

/** Place les candidats sur leur estrade et rassemble les habitants du quartier autour. */
export function createCampaignIntro(sim) {
  const { state, config } = sim, s = settingsOf(config), meeting = config.balance.buildings.meeting;
  const stages = {}, crowd = [];
  for (const candidate of majorCandidates(state)) {
    const stage = introStage(state, config, candidate);
    if (!stage) continue;
    stages[candidate.id] = stage.id;
    Object.assign(candidate, { x: wrap(stage.x, state.world.length), podium_site_id: stage.id, facing: 1, axis: 0, moving: false });
    candidate.combat.height = meeting.podium_height;
    // Les habitants du quartier les plus proches viennent écouter, à parts égales des deux côtés de
    // l'estrade, juste derrière le dernier journaliste de chaque côté.
    const outer = side => Math.max(0, ...s.press_offsets_units.flat().filter(offset => Math.sign(offset) === side).map(Math.abs));
    const zone = state.world.subzones.find(z => z.id === stage.subzone_id);
    const listeners = state.npcs.filter(n => n.role === 'NEUTRE' && state.world.subzones.find(z => z.id === n.origin_subzone_id)?.biome_id === zone.biome_id)
      .map(npc => ({ npc, distance: Math.abs(ringDelta(stage.x, npc.x, state.world.length)) }))
      .sort((a, b) => a.distance - b.distance || (a.npc.id < b.npc.id ? -1 : 1)).slice(0, s.crowd_max);
    listeners.forEach(({ npc }, index) => {
      const side = index % 2 ? 1 : -1, slot = Math.floor(index / 2);
      npc.x = wrap(stage.x + side * (outer(side) + s.crowd_gap_units + slot * s.crowd_spacing_units), state.world.length);
      npc.roam_target_x = npc.x; npc.facing = -side; npc.moving = false;
      crowd.push(npc.id);
    });
  }
  state.campaign_intro = { tick: 0, stages, crowd_ids: crowd, strikes: {} };
}

/**
 * Commandes pendant la scène : les joueurs marchent sur l'estrade et frappent ; tout le reste
 * (sauts, ultime, achats, IA…) attend le début de la campagne. Renvoie true si la commande est traitée.
 */
export function campaignIntroCommand(sim, command) {
  const intro = sim.state.campaign_intro;
  if (!intro || String(command.type).startsWith('Debug')) return false;
  if (['SetCampaignActive', 'InteractionPresence'].includes(command.type)) return false;
  const candidate = sim.state.candidates.find(c => c.id === command.candidateId);
  if (!candidate || !intro.stages[candidate.id] || !isHumanCandidate(sim.state, candidate.id)) return true;
  if (command.type === 'Move' && [-1, 0, 1].includes(command.axis)) candidate.axis = command.axis;
  else if (['Attack', 'PressAttack'].includes(command.type)) strike(sim, candidate);
  return true;
}

function strike(sim, candidate) {
  const { state, config } = sim, intro = state.campaign_intro, b = config.balance.candidate_combat;
  if (intro.strikes[candidate.id] != null || intro.tick < sim.secondsToTicks(settingsOf(config).strike_min_seconds) || movementBlocked(candidate)) return;
  intro.strikes[candidate.id] = intro.tick;
  // Coup d'annonce : la même animation qu'un coup léger, sans cible, sans dégâts ni ultime.
  const attack = { id: `attack:${state.next_attack_id++}`, owner_id: candidate.id, faction_id: candidate.faction_id, kind: 'CANDIDATE',
    direction: candidate.facing, elapsed_ticks: 0, hit_ids: [], launched: false, charged: false, intro: true, step: 1, strong: false,
    windup_ticks: sim.secondsToTicks(b.light_windup_seconds), active_ticks: sim.secondsToTicks(b.active_seconds),
    recovery_ticks: sim.secondsToTicks(b.light_recovery_seconds), range: 0, damage: 0, knockback: 0, stun_seconds: 0, electoral_damage: 0 };
  candidate.combat.attack_id = attack.id; candidate.axis = 0; candidate.moving = false;
  state.attacks.push(attack);
  sim.emit('CampaignIntroStrike', { candidate_id: candidate.id });
}

/** Un pas de la scène : marche sur l'estrade, coups d'annonce, puis départ de la campagne. */
export function stepCampaignIntro(sim) {
  const { state, config } = sim, intro = state.campaign_intro, s = settingsOf(config);
  intro.tick++;
  const half = config.balance.buildings.meeting.podium_half_width - s.stage_edge_margin_units;
  for (const candidate of majorCandidates(state)) {
    const stage = state.buildings.find(b => b.id === intro.stages[candidate.id]);
    if (!stage) continue;
    const before = candidate.x;
    if (!movementBlocked(candidate) && isHumanCandidate(state, candidate.id) && candidate.axis) {
      if (candidate.axis !== candidate.facing) { candidate.facing = candidate.axis; candidate.turn_tick = intro.tick; }
      const desired = ringDelta(stage.x, candidate.x, state.world.length) + candidate.axis * config.prototype.movement.candidate_speed_units_per_second / sim.hz;
      candidate.x = wrap(stage.x + Math.max(-half, Math.min(half, desired)), state.world.length);
    }
    candidate.moving = candidate.x !== before;
  }
  for (const attack of state.attacks) if (attack.intro) attack.elapsed_ticks++;
  for (const attack of state.attacks.filter(a => a.intro && a.elapsed_ticks >= a.windup_ticks + a.active_ticks + a.recovery_ticks)) endIntroAttack(state, attack);
  const humans = majorCandidates(state).filter(c => intro.stages[c.id] && isHumanCandidate(state, c.id));
  const struck = humans.map(c => intro.strikes[c.id]).filter(tick => tick != null);
  const everyone = struck.length === humans.length;
  const waited = struck.length && intro.tick - Math.min(...struck) >= sim.secondsToTicks(s.multiplayer_wait_seconds);
  // Le coup d'annonce va jusqu'au bout avant le premier jour de campagne.
  if ((everyone || waited) && !state.attacks.some(a => a.intro)) finishCampaignIntro(sim);
}

function endIntroAttack(state, attack) {
  state.attacks = state.attacks.filter(a => a !== attack);
  const owner = state.candidates.find(c => c.id === attack.owner_id);
  if (owner?.combat.attack_id === attack.id) owner.combat.attack_id = null;
}

/** Fin de la scène : les habitants rentrent chez eux à pied, chacun à son rythme. */
export function finishCampaignIntro(sim) {
  const { state, config } = sim, intro = state.campaign_intro, s = settingsOf(config);
  if (!intro) return;
  for (const attack of state.attacks.filter(a => a.intro)) endIntroAttack(state, attack);
  intro.crowd_ids.forEach((id, index) => {
    const npc = state.npcs.find(n => n.id === id);
    if (!npc || npc.role !== 'NEUTRE') return;
    const [min, max] = s.crowd_home_wait_seconds;
    npc.roam_target_x = npc.home_x;
    npc.roam_wait_ticks = sim.secondsToTicks(min + (max - min) * ((index * 0.618034) % 1));
  });
  for (const candidate of majorCandidates(state)) {
    candidate.turn_tick = -1000000; candidate.axis = 0; candidate.moving = false;
    // L'ordinateur redescend de l'estrade : perché, il ne sauterait jamais vers les billets en hauteur
    // (ai-strategy.js ne saute que depuis le sol) et resterait bloqué. Son estrade est hors de l'écran des joueurs.
    if (!isHumanCandidate(state, candidate.id) && candidate.podium_site_id === intro.stages[candidate.id]) {
      candidate.podium_site_id = null; candidate.combat.height = 0;
    }
  }
  state.campaign_intro = null;
  sim.emit('CampaignIntroEnded', {});
}
