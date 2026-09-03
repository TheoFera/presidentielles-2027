export function validateConfig(config) {
  const positive = (value, label) => {
    if (!Number.isFinite(value) || value <= 0) throw new Error(`Configuration : ${label} doit être un nombre positif.`);
  };
  positive(config.balance.simulation_architecture.fixed_tick_hz, 'fixed_tick_hz');
  positive(config.prototype.world.units_per_screen, 'units_per_screen');
  positive(config.layout.screens_per_subzone, 'screens_per_subzone');
  positive(config.prototype.movement.candidate_speed_units_per_second, 'vitesse de marche');
  positive(config.prototype.persuasion.radius_units, 'rayon de persuasion');
  positive(config.balance.persuasion.candidate_base_seconds, 'temps de persuasion');
  positive(config.balance.persuasion.melenchon_personal_time_multiplier, 'bonus Mélenchon');
  positive(config.balance.time.real_seconds_per_game_day, 'durée du jour');
  const supporterIncome = config.balance.money.supporter_income_per_second_by_origin_biome;
  if (!supporterIncome || typeof supporterIncome !== 'object' || Array.isArray(supporterIncome)) throw new Error('Configuration : revenus des partisans par biome manquants ou invalides.');
  for (const biome of config.layout.biomes) {
    const value = supporterIncome[biome.id];
    if (!Number.isFinite(value) || value < 0) throw new Error(`Configuration : revenu des partisans invalide pour ${biome.id} (nombre positif ou nul attendu).`);
  }
  for (const id of Object.keys(supporterIncome)) if (!config.layout.biomes.some(b => b.id === id)) throw new Error(`Configuration : biome de revenu inconnu (${id}).`);
  if (!Number.isInteger(config.balance.time.starting_days_before_first_round) || config.balance.time.starting_days_before_first_round < 1) throw new Error('Configuration : nombre de jours initial invalide.');
  for (const key of ['second_round_sprint_seconds', 'second_round_influence_multiplier']) positive(config.balance.time[key], key);
  const arena = config.balance.first_round_arena;
  for (const key of ['width_units', 'edge_margin', 'transition_seconds', 'ai_retarget_seconds', 'ai_variation_units']) positive(arena[key], `arène ${key}`);
  if (arena.width_units >= config.layout.biomes.length * 3 * config.prototype.world.units_per_screen || arena.edge_margin * 2 >= arena.width_units) throw new Error('Configuration : limites du plateau invalides.');
  for (const key of ['light_1', 'light_2', 'heavy', 'hologram', 'wave', 'crs']) positive(arena.damage[key], `dégât d’arène ${key}`);
  const sprint = config.balance.second_round;
  for (const key of ['poll_refresh_seconds', 'tower_influence_multiplier', 'meeting_cooldown_seconds', 'extension_seconds', 'ai_opponent_detection_range', 'ai_meeting_distance', 'ai_recruit_distance', 'ai_former_third_priority', 'ai_neutral_zone_priority']) positive(sprint[key], `second tour ${key}`);
  if (!['REPEAT_OVERTIME', 'J0_THEN_SEED'].includes(sprint.tie_rule)) throw new Error('Configuration : règle d’égalité inconnue.');
  positive(config.balance.persuasion.militant_base_seconds, 'temps de persuasion des Militants');
  positive(config.balance.interaction.radius_units, 'portée des interactions');
  if (!Number.isInteger(config.layout.social_points_per_subzone) || config.layout.social_points_per_subzone < 1) throw new Error('Configuration : au moins un point social par sous-zone.');
  if (config.layout.neutral_spawn_capacity_policy !== 'skip_and_reschedule_when_full') throw new Error('Configuration : politique de capacité inconnue.');
  for (const ratio of Object.values(config.layout.infrastructure_layout)) if (!Number.isFinite(ratio) || ratio <= 0 || ratio >= 1) throw new Error('Configuration : emplacement d’infrastructure invalide.');
  if (config.prototype.persuasion.break_policy !== 'reset' || config.prototype.persuasion.contest_policy !== 'nearest_then_stable_id') {
    throw new Error('Règle de persuasion inconnue dans prototype_config.json.');
  }
  const ids = new Set();
  for (const biome of config.layout.biomes) {
    if (!config.prototype.presentation.biome_palettes[biome.id]) throw new Error(`Palette absente : ${biome.id}.`);
    for (const zone of biome.subzones) {
      if (ids.has(zone.id)) throw new Error(`Sous-zone en double : ${zone.id}.`);
      ids.add(zone.id);
      positive(zone.mean_spawn_days, `délai moyen ${zone.id}`);
      positive(zone.spawn_randomness?.min_factor, `variation minimale ${zone.id}`);
      positive(zone.spawn_randomness?.max_factor, `variation maximale ${zone.id}`);
      if (zone.spawn_randomness.min_factor > zone.spawn_randomness.max_factor) throw new Error(`Configuration : intervalle aléatoire inversé dans ${zone.id}.`);
      if (!Number.isInteger(zone.initial_neutral_count) || zone.initial_neutral_count < 0 || !Number.isInteger(zone.max_neutrals_waiting) || zone.max_neutrals_waiting < 0) throw new Error(`Population ou capacité invalide : ${zone.id}.`);
      if (zone.initial_neutral_count > zone.max_neutrals_waiting * config.layout.social_points_per_subzone) throw new Error(`Configuration : population initiale supérieure à la capacité dans ${zone.id}.`);
    }
  }
  for (const id of Object.values(config.layout.starting_positions)) if (!ids.has(id)) throw new Error(`Position de départ inconnue : ${id}.`);
  for (const type of ['permanence', 'financement']) {
    const building = config.balance.buildings[type];
    if (!Number.isInteger(building.required_local_sympathisants) || building.required_local_sympathisants < 0) throw new Error(`Seuil invalide : ${type}.`);
    positive(building.build_cost, `coût ${type}`);
    positive(building.purchase_hold_seconds, `durée d’achat ${type}`);
    if (!Number.isInteger(building.max_level) || building.max_level < 1 || building.upgrade_costs.length !== building.max_level - 1) throw new Error(`Niveaux incohérents : ${type}.`);
    for (const cost of building.upgrade_costs) positive(cost, `amélioration ${type}`);
    const fields = type === 'permanence' ? ['local_influence_by_level', 'local_persuasion_time_multiplier_by_level'] : ['income_per_second_by_level'];
    for (const field of fields) {
      if (building[field].length !== building.max_level) throw new Error(`Réglages de niveaux incomplets : ${type}.`);
      for (const value of building[field]) positive(value, `${type}.${field}`);
    }
  }
  const printer = config.balance.buildings.imprimerie;
  for (const field of ['purchase_hold_seconds', 'pickup_seconds']) positive(printer[field], `imprimerie.${field}`);
  positive(printer.tract_cost_by_level[0], 'prix du tract'); positive(printer.equipment_seconds_by_level[0], 'durée d’impression');
  if (!Number.isInteger(printer.max_queue_length) || printer.max_queue_length < 1) throw new Error('Configuration : capacité de file invalide.');
  positive(config.balance.physical_units.sympathisant.task_move_speed, 'vitesse de collecte');
  positive(config.balance.physical_units.militant.move_speed, 'vitesse du Militant');
  positive(config.balance.physical_units.militant.max_player_speed_multiplier, 'limite de vitesse du Militant');
  for (const [section, fields] of [
    [config.balance.candidate_combat, ['light_hit_hidden_damage', 'finisher_hidden_damage', 'light_knockback', 'finisher_knockback', 'combo_reset_seconds', 'light_range', 'finisher_range', 'light_windup_seconds', 'finisher_windup_seconds', 'active_seconds', 'light_recovery_seconds', 'finisher_recovery_seconds', 'input_buffer_seconds', 'knockback_decay_per_second']],
    [config.balance.physical_units.militant, ['verbal_range', 'verbal_cooldown_seconds', 'verbal_damage', 'projectile_speed', 'projectile_range']],
    [config.balance.physical_units.service_ordre, ['hidden_durability', 'move_speed', 'attack_range', 'attack_cooldown_seconds', 'attack_damage', 'raid_cost', 'raid_duration_seconds', 'raid_cooldown_seconds']],
    [config.balance.special_charge, ['required_points', 'points_per_light_hit', 'points_per_finisher_hit']],
  ]) for (const field of fields) positive(section[field], field);
  for (const value of Object.values(config.balance.faction_interactions)) positive(value, 'zone d’interaction factionnelle');
  for (const type of ['faction_slot_melenchon_lepen_service_ordre', 'faction_slot_philippe_cabinet_administratif']) {
    const b = config.balance.buildings[type];
    positive(b.build_cost, type); positive(b.purchase_hold_seconds, type);
    if (!Number.isInteger(b.required_local_sympathisants) || b.required_local_sympathisants < 0 || b.max_level !== b.upgrade_costs.length + 1) throw new Error('Configuration : bâtiment factionnel invalide.');
    for (const cost of b.upgrade_costs) positive(cost, type);
  }
  const so = config.balance.buildings.faction_slot_melenchon_lepen_service_ordre;
  if (!Number.isInteger(so.max_queue_length) || so.max_queue_length < 1 || so.baton_cost_by_level.length !== so.max_level || so.equipment_seconds_by_level.length !== so.max_level) throw new Error('Configuration : équipement SO invalide.');
  for (const value of [...so.baton_cost_by_level, ...so.equipment_seconds_by_level, so.pickup_seconds]) positive(value, 'équipement SO');
  for (const settings of Object.values(config.balance.specials)) for (const [key, value] of Object.entries(settings)) if (typeof value === 'number') positive(value, `pouvoir.${key}`);
  positive(config.balance.physical_units.militant.reconsider_seconds, 'réévaluation du Militant');
  if (!Number.isInteger(config.balance.physical_units.militant.nearby_zone_radius) || config.balance.physical_units.militant.nearby_zone_radius < 1) throw new Error('Configuration : rayon de prospection invalide.');
  positive(config.layout.electoral_weights?.default, 'poids électoral par défaut');
  for (const [id, weight] of Object.entries(config.layout.electoral_weights.by_subzone)) {
    if (!ids.has(id)) throw new Error(`Configuration : poids d’une sous-zone inconnue (${id}).`);
    positive(weight, `poids électoral ${id}`);
  }
  for (const type of ['tour_communication', 'institut_sondage', 'meeting']) {
    const b = config.balance.buildings[type];
    positive(b.build_cost, `coût ${type}`); positive(b.purchase_hold_seconds, `présence ${type}`);
    if (!Number.isInteger(b.required_local_sympathisants) || b.required_local_sympathisants < 0
      || !Number.isInteger(b.max_level) || b.max_level < 1 || (b.upgrade_costs || []).length !== b.max_level - 1) throw new Error(`Configuration : niveaux ou seuil invalides (${type}).`);
    for (const [key, values] of Object.entries(b).filter(([key]) => key.endsWith('_by_level'))) {
      if (values.length !== b.max_level) throw new Error(`Configuration : niveaux incomplets (${type}.${key}).`);
      for (const value of values) positive(value, `${type}.${key}`);
    }
    for (const cost of b.upgrade_costs || []) positive(cost, `amélioration ${type}`);
  }
  const tower = config.balance.buildings.tour_communication;
  if (!Number.isInteger(tower.global_limit) || tower.global_limit < 1) throw new Error('Configuration : limite globale de Tours invalide.');
  for (const key of ['controlled_zone_multiplier', 'adjacent_zone_multiplier', 'distant_zone_multiplier']) positive(tower[key], key);
  positive(config.balance.buildings.institut_sondage.poll_refresh_seconds, 'fréquence du sondage');
  const meeting = config.balance.buildings.meeting;
  for (const key of ['interaction_radius', 'upgrade_offset', 'upgrade_radius']) positive(meeting[key], `Meeting ${key}`);
  if (meeting.duration_seconds_by_level.some((duration, i) => duration > meeting.internal_cooldown_seconds_by_level[i])
    || meeting.ally_influence_multiplier_by_level.some(value => value < 1)) throw new Error('Configuration : bonus ou durée de Meeting incohérents.');
  for (const [key, value] of Object.entries(config.balance.influence)) if (!Number.isFinite(value) || value < 0) throw new Error(`Configuration : influence invalide (${key}).`);
  for (const key of ['control_min_leader_percent', 'control_required_lead_points', 'allow_opponent_conversion_below_neutral_percent']) if (config.balance.influence[key] > 100) throw new Error(`Configuration : seuil supérieur à 100 (${key}).`);
  if (!Array.isArray(config.balance.ai_economy.development_order) || config.balance.ai_economy.development_order.some(type => !config.balance.buildings[type])) throw new Error('Configuration : ordre de développement IA invalide.');
  return config;
}

export async function loadConfig() {
  const base = new URL('../Présidentielles 2027/', import.meta.url);
  const files = ['game_balance.json', 'world_layout.json', 'building_catalog.json', 'prototype_config.json'];
  const [balance, layout, buildings, prototype] = await Promise.all(files.map(async file => {
    const response = await fetch(new URL(file, base));
    if (!response.ok) throw new Error(`Impossible de charger ${file} (${response.status}).`);
    return response.json();
  }));
  return validateConfig({ balance, layout, buildings, prototype });
}
