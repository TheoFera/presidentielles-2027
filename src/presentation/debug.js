import { demobilize, selectCandidate, setAIEnabled, teleport, teleportTarget, grantMoney, fillSpecial, spawnUnit, controlZone } from '../simulation/commands.js';
import { FACTIONS, ringDelta, zoneAt } from '../simulation/world.js';
import { managementReport, roleNames, buildingNames } from './debug-report.js';

export class DebugPanel {
  constructor(config, callbacks) {
    this.config = config; this.callbacks = callbacks;
    this.element = document.getElementById('debug');
    this.text = document.getElementById('debug-text');
    this.candidate = document.getElementById('candidate');
    this.zone = document.getElementById('zone');
    this.ai = document.getElementById('ai-toggle');
    this.seed = document.getElementById('seed');
    this.seed.value = config.prototype.seed;
    this.inspectNpc = document.getElementById('inspect-npc');
    this.inspectBuilding = document.getElementById('inspect-building');
    this.spawnFaction = document.getElementById('spawn-faction');
    document.getElementById('fill-special').addEventListener('click', () => callbacks.queue(fillSpecial(callbacks.state().local_candidate_id)));
    document.getElementById('control-zone').addEventListener('click', () => callbacks.queue(controlZone(callbacks.state().local_candidate_id)));
    for (const [id, role] of [['spawn-s', 'SYMPATHISANT'], ['spawn-m', 'MILITANT'], ['spawn-so', 'SERVICE_D_ORDRE']]) document.getElementById(id).addEventListener('click', () => this.spawnTestUnit(role));
    const state = callbacks.state();
    for (const faction of FACTIONS) this.candidate.add(new Option(config.prototype.presentation.factions[faction].name, `candidate:${faction}`));
    for (const zone of state.world.subzones) this.zone.add(new Option(`${zone.index + 1}. ${zone.biome_name} — ${zone.concept}`, zone.id));
    this.zone.value = zoneAt(state.world, state.candidates.find(c => c.id === state.local_candidate_id).x).id;
    for (const building of state.buildings) this.inspectBuilding.add(new Option(`${building.subzone_id} — ${buildingNames[building.type]}`, building.id));
    document.getElementById('go-npc').addEventListener('click', () => {
      const npc = this.inspectedNpc(callbacks.state());
      if (npc) callbacks.queue(teleportTarget(callbacks.state().local_candidate_id, npc.id));
    });
    document.getElementById('go-building').addEventListener('click', () => {
      const building = this.inspectedBuilding(callbacks.state());
      if (building) callbacks.queue(teleportTarget(callbacks.state().local_candidate_id, building.id));
    });
    document.getElementById('pause-debug').addEventListener('click', callbacks.togglePause);
    document.getElementById('speed-debug').addEventListener('click', callbacks.toggleSpeed);
    document.getElementById('grant-money').addEventListener('click', () => callbacks.queue(grantMoney(callbacks.state().local_candidate_id)));
    this.candidate.addEventListener('change', () => callbacks.queue(selectCandidate(this.candidate.value)));
    this.ai.addEventListener('click', () => callbacks.queue(setAIEnabled(!callbacks.state().ai_enabled)));
    document.getElementById('close-debug').addEventListener('click', () => this.toggle(false));
    document.getElementById('teleport').addEventListener('click', () => callbacks.queue(teleport(callbacks.state().local_candidate_id, this.zone.value)));
    document.getElementById('demobilize').addEventListener('click', () => {
      const state = callbacks.state();
      const nearest = this.inspectedNpc(state);
      if (nearest && ['SYMPATHISANT', 'MILITANT', 'SERVICE_D_ORDRE'].includes(nearest.role)) callbacks.queue(demobilize(nearest.id));
      else callbacks.notify('Sélectionne un Sympathisant, un Militant ou un SO à démobiliser.');
    });
    document.getElementById('save').addEventListener('click', callbacks.save);
    document.getElementById('load').addEventListener('change', async event => {
      const file = event.target.files[0];
      if (file) await callbacks.load(file);
      event.target.value = '';
    });
    document.getElementById('restart').addEventListener('click', () => {
      const seed = Number(this.seed.value);
      if (!Number.isInteger(seed) || seed < 1 || seed > 0xffffffff) { callbacks.notify('La graine doit être un entier entre 1 et 4 294 967 295.'); return; }
      callbacks.restart(seed);
    });
  }

  get visible() { return !this.element.hidden; }
  toggle(force = !this.visible) { this.element.hidden = !force; if (!force) document.getElementById('world').focus(); }

  nearest(state, entities) {
    const x = state.candidates.find(c => c.id === state.local_candidate_id).x;
    return [...entities].sort((a, b) => Math.abs(ringDelta(x, a.x, state.world.length)) - Math.abs(ringDelta(x, b.x, state.world.length)))[0];
  }
  inspectedNpc(state) { return state.npcs.find(n => n.id === this.inspectNpc.value) || this.nearest(state, state.npcs); }
  inspectedBuilding(state) { return state.buildings.find(b => b.id === this.inspectBuilding.value) || this.nearest(state, state.buildings); }
  spawnTestUnit(role) {
    const state = this.callbacks.state();
    const candidate = state.candidates.find(c => c.id === state.local_candidate_id);
    const selected = this.spawnFaction.value;
    const faction = selected === 'ALLY' ? candidate.faction_id : selected === 'ENEMY' ? candidate.faction_id === 'melenchon' ? 'le_pen' : 'melenchon' : selected;
    if (role === 'SERVICE_D_ORDRE' && faction === 'philippe') { this.callbacks.notify('Philippe ne possède pas de SO permanent.'); return; }
    this.callbacks.queue(spawnUnit(candidate.id, role, faction));
  }

  action(key) {
    if (!this.visible) return;
    const state = this.callbacks.state();
    if (key === 'f4') this.callbacks.togglePause();
    if (key === 'f6') this.callbacks.toggleSpeed();
    if (key === 'k') this.callbacks.queue(fillSpecial(state.local_candidate_id));
    if (key === 'y') this.callbacks.queue(controlZone(state.local_candidate_id));
    if (key === 'f7') this.spawnTestUnit('SYMPATHISANT');
    if (key === 'f8') this.spawnTestUnit('MILITANT');
    if (key === 'f9') this.spawnTestUnit('SERVICE_D_ORDRE');
    if (key === 'x') { const npc = this.inspectedNpc(state); if (npc) this.callbacks.queue(demobilize(npc.id)); }
    if (key === 'g') this.callbacks.queue(grantMoney(state.local_candidate_id));
    if (key === 'c') {
      const npc = this.nearest(state, state.npcs.filter(n => n.role === 'NEUTRE'));
      if (npc) this.callbacks.queue(teleportTarget(state.local_candidate_id, npc.id));
    }
    if (['b', 't', 'n', 'l'].includes(key)) {
      const types = { b: 'permanence', t: 'imprimerie', n: 'financement', l: 'faction' };
      const building = this.nearest(state, state.buildings.filter(b => b.type === types[key]));
      if (building) { this.inspectBuilding.value = building.id; this.callbacks.queue(teleportTarget(state.local_candidate_id, building.id)); }
    }
    if (['1', '2', '3', '&', 'é', '"'].includes(key)) {
      const index = ['1', '2', '3'].includes(key) ? Number(key) - 1 : ['&', 'é', '"'].indexOf(key);
      this.callbacks.queue(selectCandidate(`candidate:${FACTIONS[index]}`));
    }
    if (key === 'i') this.callbacks.queue(setAIEnabled(!state.ai_enabled));
    if (key === '[' || key === ']') {
      const candidate = state.candidates.find(c => c.id === state.local_candidate_id);
      const current = zoneAt(state.world, candidate.x).index;
      const next = (current + (key === ']' ? 1 : -1) + state.world.subzones.length) % state.world.subzones.length;
      this.callbacks.queue(teleport(candidate.id, state.world.subzones[next].id));
    }
  }

  update(state, fps) {
    if (!this.visible) return;
    const cfg = this.config;
    const hz = cfg.balance.simulation_architecture.fixed_tick_hz;
    const candidate = state.candidates.find(c => c.id === state.local_candidate_id);
    const zone = zoneAt(state.world, candidate.x);
    const signature = state.npcs.map(n => `${n.id}:${n.role}`).join(',');
    if (signature !== this.npcSignature) {
      this.npcSignature = signature;
      const selected = this.inspectNpc.value;
      this.inspectNpc.replaceChildren(new Option('Le plus proche', ''));
      for (const npc of state.npcs) this.inspectNpc.add(new Option(`${npc.id} — ${roleNames[npc.role]} — ${npc.origin_subzone_id}`, npc.id));
      if (state.npcs.some(n => n.id === selected)) this.inspectNpc.value = selected;
    }
    const nearest = this.inspectedNpc(state);
    const timer = state.spawn_timers.find(t => t.subzone_id === zone.id);
    this.candidate.value = state.local_candidate_id;
    this.ai.textContent = state.ai_enabled ? 'Suspendre les IA' : 'Activer les IA';
    document.getElementById('pause-debug').textContent = this.callbacks.paused() ? 'Reprendre (F4)' : 'Pause (F4)';
    document.getElementById('speed-debug').textContent = this.callbacks.speed() === 1 ? `Accélérer ×${cfg.balance.debug.acceleration_multiplier} (F6)` : 'Vitesse normale (F6)';
    const f = n => n.toLocaleString('fr-FR', { maximumFractionDigits: 2 });
    const role = roleNames;
    const origin = nearest && state.world.subzones.find(z => z.id === nearest.origin_subzone_id);
    const persuasion = nearest?.persuasion;
    this.text.textContent = [
      `J-${state.days_remaining} · COMBATS ET TERRITOIRES`,
      `Tick ${state.tick} · ${hz} Hz fixes · rendu ${Math.round(fps)} i/s`,
      `Temps simulé : ${f(state.tick / hz)} s · ${this.callbacks.paused() ? 'EN PAUSE' : `vitesse ×${this.callbacks.speed()}`}`,
      `Graine : ${state.seed} · RNG : ${state.rng_state}`,
      `Monde : ${state.world.subzones.length} sous-zones · ${f(state.world.length)} unités`,
      `Position : ${f(candidate.x)} · ${zone.id}`,
      `Biome actuel : ${zone.biome_name}`,
      `Vitesse : ${f(cfg.prototype.movement.candidate_speed_units_per_second)} u/s`,
      `Portée persuasion : ${f(cfg.prototype.persuasion.radius_units)} u`,
      `Durée : ${f(cfg.balance.persuasion.candidate_base_seconds * (candidate.faction_id === 'melenchon' ? cfg.balance.persuasion.melenchon_personal_time_multiplier : 1))} s (arrondie au tick supérieur)`,
      `Conversation(s) : ${candidate.persuasion_target_ids.map(id => {
        const target = state.npcs.find(n => n.id === id);
        return `${id} · ${f(target.persuasion.elapsed_ticks / hz)} / ${f(target.persuasion.required_ticks / hz)} s`;
      }).join(', ') || 'aucune'}`,
      `Sol : ${f(cfg.layout.visual_layout.player_ground_y_ratio * 100)} % · épaisseur ${f(cfg.layout.visual_layout.visible_ground_thickness_ratio * 100)} %`,
      `Silhouette : ${f(cfg.layout.visual_layout.character_height_ratio * 100)} %`,
      '',
      `Population : ${state.npcs.length} PNJ physiques`,
      ...state.candidates.map(c => `${cfg.prototype.presentation.factions[c.faction_id].name} : ${c.id === state.local_candidate_id ? 'humain' : state.ai_enabled ? (c.axis ? 'IA · marche' : 'IA · proximité') : 'IA suspendue'} · ${state.npcs.filter(n => n.faction_id === c.faction_id && n.role === 'SYMPATHISANT').length} S · ${state.npcs.filter(n => n.faction_id === c.faction_id && n.role === 'MILITANT').length} M · ${f(c.money)} k €`),
      `Neutres : ${state.npcs.filter(n => n.role === 'NEUTRE').length}`,
      `Prochaine tentative d’apparition : ${f((timer.interval_ticks - timer.elapsed_ticks) / hz)} s`,
      '',
      nearest ? `PNJ inspecté : ${nearest.id} · ${role[nearest.role]}` : 'Aucun PNJ',
      nearest ? `Origine : ${origin.biome_name} / ${nearest.origin_subzone_id}\nPoint : ${nearest.origin_social_point_id}\nDistance : ${f(Math.abs(ringDelta(candidate.x, nearest.x, state.world.length)))} u\nDurabilité interne : ${f(nearest.hidden_durability)}` : '',
      persuasion ? `Persuasion : ${f(persuasion.elapsed_ticks / hz)} / ${f(persuasion.required_ticks / hz)} s\nActeur : ${persuasion.actor_id}` : 'Persuasion : aucune sur ce PNJ',
      '',
      managementReport(state, cfg, candidate, nearest, this.inspectedBuilding(state)),
      '', 'Hors jalon : sondages, Meeting, J0, second tour et réseau.',
      '',
      'Derniers événements :',
      ...state.events.slice(-5).map(event => {
        const names = { NeutralSpawned: 'Apparition', NpcConverted: 'Conversion', NpcDemobilized: 'Démobilisation', NpcReturnedHome: 'Retour à l’origine', ControllerChanged: 'Contrôleur changé', CandidateTeleported: 'Téléportation', DayChanged: 'Nouveau jour', TractOrdered: 'Tract commandé', TractWorkerAssigned: 'Sympathisant affecté', TractReady: 'Tract prêt', MilitantEquipped: 'Militant équipé', BuildingConstructed: 'Construction', BuildingUpgraded: 'Amélioration', DebugMoneyGranted: 'Fonds de test ajoutés' };
        Object.assign(names, { HitResolved: 'Impact', AttackStarted: 'Attaque', SpecialTriggered: 'Pouvoir déclenché', EquipmentOrdered: 'Équipement commandé', EquipmentWorkerAssigned: 'Militant affecté', EquipmentReady: 'Équipement prêt', GuardEquipped: 'SO équipé', RaidStarted: 'Raid lancé', GuardReturnedHome: 'SO rentré', BuildingClosed: 'Bâtiment fermé', BuildingRebuilt: 'Bâtiment reconstruit', EquipmentRefunded: 'Équipement remboursé', DebugUnitSpawned: 'Unité de test', DebugZoneControlled: 'Contrôle de test' });
        return `${event.tick} · ${names[event.type] || event.type} · ${event.npc_id || event.order_id || event.target_id || event.candidate_id || event.actor_id || `J-${event.days_remaining}`}`;
      }),
    ].join('\n');
  }
}
