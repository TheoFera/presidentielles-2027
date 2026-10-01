import { validateCampaignConfig } from './simulation/campaign-validation.js';
import { validAIDifficulty } from './simulation/ai-settings.js';
import { validateMinorConfig } from './simulation/minor-candidates.js';
export function validateConfig(config) {
  if (config.balance.ai?.difficulty !== undefined && !validAIDifficulty(config.balance.ai.difficulty)) throw new Error('Configuration : difficulté de l’IA invalide.');
  validateCampaignConfig(config);
  const positive = (value, label) => {
    if (!Number.isFinite(value) || value <= 0) throw new Error(`Configuration : ${label} doit être un nombre positif.`);
  };
  positive(config.balance.simulation_architecture.fixed_tick_hz, 'fixed_tick_hz');
  const combat = config.balance.candidate_combat;
  positive(combat.light_stun_seconds, 'étourdissement des coups légers');
  positive(combat.ko_ground_seconds, 'maintien au sol après KO');
  if (combat.charge_activation_seconds >= combat.charge_ready_seconds) throw new Error('Configuration : la préparation doit commencer avant que la charge soit prête.');
  positive(config.balance.first_round_debate.damage.charged, 'dégâts chargés en débat');
  const dash = config.balance.dash, charge = config.balance.special_charge;
  for (const key of ['max_charges', 'recharge_seconds', 'duration_seconds', 'distance', 'invulnerability_seconds', 'double_tap_window_ms']) positive(dash?.[key], `dash : ${key}`);
  const hz = config.balance.simulation_architecture.fixed_tick_hz;
  if (!Number.isInteger(dash.max_charges) || Math.ceil(dash.invulnerability_seconds * hz) >= Math.ceil(dash.duration_seconds * hz)) throw new Error('Configuration : le dash doit avoir des charges entières et une invulnérabilité plus courte que sa durée.');
  for (const key of ['required_points', 'points_per_light_hit', 'points_per_second_hit', 'points_per_finisher_hit', 'decay_delay_seconds', 'decay_duration_seconds']) positive(charge?.[key], `ultime : ${key}`);
  if (typeof dash.allowed_in_debate !== 'boolean' || typeof charge.enemy_summons_charge !== 'boolean' || typeof charge.ultimate_key !== 'string' || !charge.ultimate_key) throw new Error('Configuration : commandes de combat invalides.');
  positive(config.prototype.world.units_per_screen, 'units_per_screen');
  positive(config.layout.screens_per_subzone, 'screens_per_subzone');
  positive(config.prototype.movement.candidate_speed_units_per_second, 'vitesse de marche');
  positive(config.prototype.persuasion.radius_units, 'rayon de persuasion');
  positive(config.balance.persuasion.candidate_base_seconds, 'temps de persuasion');
  positive(config.balance.persuasion.melenchon_personal_time_multiplier, 'bonus Mélenchon');
  positive(config.balance.time.real_seconds_per_game_day, 'durée du jour');
  positive(config.balance.money.campaign_spending_limit, 'plafond de dépenses de campagne');
  const money = config.balance.money;
  const donation = money.donation;
  const supporterIncome = donation.biome_multipliers;
  if (!supporterIncome || typeof supporterIncome !== 'object' || Array.isArray(supporterIncome)) throw new Error('Configuration : dons par biome manquants ou invalides.');
  for (const biome of config.layout.biomes) {
    const value = supporterIncome[biome.id];
    if (!Number.isFinite(value) || value < 0) throw new Error(`Configuration : don invalide pour ${biome.id}.`);
  }
  for (const id of Object.keys(supporterIncome)) if (!config.layout.biomes.some(b => b.id === id)) throw new Error(`Configuration : biome de don inconnu (${id}).`);
  for (const key of ['base_eur', 'cooldown_min_seconds', 'cooldown_max_seconds', 'handoff_radius_units', 'handoff_toss_distance_units', 'handoff_toss_seconds', 'deposit_radius_units', 'collection_radius_units',
    'ai_handoff_search_radius_units', 'ai_funding_collection_threshold_eur']) positive(donation[key], `don.${key}`);
  if (donation.cooldown_max_seconds < donation.cooldown_min_seconds) throw new Error('Configuration : délais des dons inversés.');
  const initial = money.starting_pickups;
  for (const key of ['default_total_eur', 'philippe_total_eur', 'height_min_ratio', 'height_max_ratio']) positive(initial[key], `argent initial.${key}`);
  for (const key of ['minimum_spacing_units', 'near_start_min_distance_units', 'near_start_max_distance_units', 'zone_edge_margin_ratio']) positive(initial[key], `argent initial.${key}`);
  if (initial.philippe_total_eur <= initial.default_total_eur || initial.height_min_ratio > initial.height_max_ratio || initial.height_max_ratio >= 1
    || initial.height_min_ratio <= money.pickup_height_tolerance_ratio || initial.near_start_max_distance_units < initial.near_start_min_distance_units
    || initial.zone_edge_margin_ratio >= 0.5) throw new Error('Configuration : montant ou placement des billets initiaux invalides.');
  for (const kind of ['default', 'philippe']) if (!Number.isInteger(initial[`${kind}_count`]) || initial[`${kind}_count`] < 3
    || !Number.isInteger(initial[`${kind}_total_eur`] / 50) || initial[`${kind}_total_eur`] < 50 * (initial[`${kind}_count`] + 9)) throw new Error('Configuration : répartition initiale impossible.');
  for (const key of ['pickup_radius_units', 'pickup_height_tolerance_ratio', 'drop_spread_units', 'pickup_sprite_base_width_px',
    'pickup_sprite_width_per_tier_px', 'ground_pickup_visual_offset_px', 'elevated_pickup_visual_offset_px',
    'pickup_hover_amplitude_px', 'pickup_hover_period_seconds']) positive(money[key], `argent.${key}`);
  if (!Number.isFinite(money.pickup_halo_opacity) || money.pickup_halo_opacity < 0 || money.pickup_halo_opacity > 1)
    throw new Error('Configuration : intensité du halo des billets invalide.');
  if (!Number.isInteger(money.max_drop_pickups) || money.max_drop_pickups < 1 || !Array.isArray(money.sprite_tiers_eur)
    || money.sprite_tiers_eur.length !== 3 || money.sprite_tiers_eur.some((v, i) => !Number.isInteger(v) || v <= 0 || i && v <= money.sprite_tiers_eur[i - 1])) throw new Error('Configuration : pickups ou paliers visuels invalides.');
  const ko = config.balance.candidate_combat;
  for (const key of ['ko_respawn_min_seconds', 'ko_respawn_max_seconds', 'ko_respawn_progress_exponent']) positive(ko[key], `KO.${key}`);
  if (ko.ko_respawn_max_seconds < ko.ko_respawn_min_seconds || !Number.isFinite(ko.ko_money_drop_ratio) || ko.ko_money_drop_ratio < 0 || ko.ko_money_drop_ratio > 1) throw new Error('Configuration : perte d’argent au KO invalide.');
  if (!Number.isInteger(config.balance.time.starting_days_before_first_round) || config.balance.time.starting_days_before_first_round < 1) throw new Error('Configuration : nombre de jours initial invalide.');
  positive(config.balance.time.second_round_sprint_seconds, 'durée du second tour');
  const debate = config.balance.first_round_debate;
  for (const key of ['width_units', 'edge_margin', 'transition_seconds', 'ai_retarget_seconds', 'ai_variation_units']) positive(debate[key], `débat ${key}`);
  if (debate.width_units >= config.layout.biomes.length * 3 * config.prototype.world.units_per_screen || debate.edge_margin * 2 >= debate.width_units) throw new Error('Configuration : limites du plateau invalides.');
  for (const key of ['light_1', 'light_2', 'heavy', 'hologram', 'wave', 'crs']) positive(debate.damage[key], `dégât de débat ${key}`);
  const mode = config.balance.debate_mode;
  for (const key of ['dash_distance', 'countdown_seconds', 'fight_banner_seconds', 'victory_delay_seconds', 'ai_retarget_seconds']) positive(mode[key], `mode Débat ${key}`);
  if (!mode.maps[mode.default_map]) throw new Error('Configuration : carte de débat par défaut inconnue.');
  for (const [id, map] of Object.entries(mode.maps)) {
    if (!map.name || !Array.isArray(map.platforms)) throw new Error(`Configuration : carte de débat ${id} invalide.`);
    if (map.ground_y_ratio != null && (!Number.isFinite(map.ground_y_ratio) || map.ground_y_ratio <= 0 || map.ground_y_ratio >= 1)) throw new Error(`Configuration : ligne de scène de la carte ${id} invalide.`);
    if (map.fall_death_height != null && (!Number.isFinite(map.fall_death_height) || map.fall_death_height >= 0 || !map.platforms.length)) throw new Error(`Configuration : limite de chute de la carte ${id} invalide.`);
    if (map.platforms.length) { positive(map.jump_height, `saut de la carte ${id}`); positive(map.jump_duration_seconds, `durée du saut de la carte ${id}`); }
    for (const p of map.platforms) {
      for (const key of ['x', 'half_width']) positive(p[key], `pupitre ${p.id} ${key}`);
      if (map.fall_death_height == null) positive(p.height, `pupitre ${p.id} height`);
      else if (!Number.isFinite(p.height) || p.height <= map.fall_death_height) throw new Error(`Configuration : hauteur de la plateforme ${p.id} invalide.`);
      const margin = map.fall_death_height == null ? debate.edge_margin : 0;
      if (p.x - p.half_width < margin || p.x + p.half_width > debate.width_units - margin) throw new Error(`Configuration : le pupitre ${p.id} dépasse du plateau.`);
    }
  }
  const sprint = config.balance.second_round;
  for (const key of ['poll_refresh_seconds', 'meeting_cooldown_seconds', 'extension_seconds', 'ai_opponent_detection_range', 'ai_meeting_distance', 'ai_recruit_distance', 'ai_former_third_priority', 'ai_neutral_zone_priority']) positive(sprint[key], `second tour ${key}`);
  if (!['REPEAT_OVERTIME', 'J0_THEN_SEED'].includes(sprint.tie_rule)) throw new Error('Configuration : règle d’égalité inconnue.');
  positive(config.balance.persuasion.militant_base_seconds, 'temps de persuasion des Militants');
  positive(config.balance.interaction.radius_units, 'portée des interactions');
  if (!Number.isInteger(config.layout.social_points_per_subzone) || config.layout.social_points_per_subzone < 1) throw new Error('Configuration : au moins un point social par sous-zone.');
  if (config.layout.neutral_spawn_capacity_policy !== 'skip_and_reschedule_when_full') throw new Error('Configuration : politique de capacité inconnue.');
  const populationGrowth = config.layout.neutral_population_growth;
  if (!populationGrowth || typeof populationGrowth.enabled !== 'boolean') throw new Error('Configuration : réglage de croissance des PNJ manquant.');
  if (!Number.isInteger(populationGrowth.target_days_before_first_round) || populationGrowth.target_days_before_first_round < 0
    || populationGrowth.target_days_before_first_round >= config.balance.time.starting_days_before_first_round) throw new Error('Configuration : date cible de population invalide.');
  positive(populationGrowth.interval_randomness?.min_factor, 'variation minimale des apparitions');
  positive(populationGrowth.interval_randomness?.max_factor, 'variation maximale des apparitions');
  if (populationGrowth.interval_randomness.min_factor > populationGrowth.interval_randomness.max_factor
    || populationGrowth.interval_randomness.max_factor > 1) throw new Error('Configuration : variation des apparitions invalide ou susceptible de dépasser le premier tour.');
  const generation = config.layout.strategic_site_generation;
  if (!generation || generation.mode !== 'fixed_explicit_slots' || !Array.isArray(generation.slots)) throw new Error('Configuration : emplacements stratégiques absents.');
  if (config.prototype.persuasion.break_policy !== 'reset' || config.prototype.persuasion.contest_policy !== 'nearest_then_stable_id') {
    throw new Error('Règle de persuasion inconnue dans prototype_config.json.');
  }
  const ids = new Set();
  let configuredElectors = 0;
  for (const biome of config.layout.biomes) {
    if (!config.prototype.presentation.biome_palettes[biome.id]) throw new Error(`Palette absente : ${biome.id}.`);
    for (const zone of biome.subzones) {
      if (ids.has(zone.id)) throw new Error(`Sous-zone en double : ${zone.id}.`);
      ids.add(zone.id);
      if (!Number.isInteger(zone.initial_neutral_count) || zone.initial_neutral_count < 0 || !Number.isInteger(zone.max_npcs_by_origin)
        || zone.max_npcs_by_origin < 8 || zone.max_npcs_by_origin > 16) throw new Error(`Population ou capacité invalide dans ${zone.id} : plafond entier entre 8 et 16 attendu.`);
      if (zone.initial_neutral_count > zone.max_npcs_by_origin) throw new Error(`Configuration : population initiale supérieure à la capacité dans ${zone.id}.`);
      configuredElectors += zone.max_npcs_by_origin;
    }
  }
  if (config.layout.total_electors !== 200 || configuredElectors !== config.layout.total_electors) throw new Error('Configuration : la carte doit contenir exactement 200 électeurs.');
  for (const id of Object.values(config.layout.starting_positions)) if (!ids.has(id)) throw new Error(`Position de départ inconnue : ${id}.`);
  const slotIds = new Set(); const slotsByZone = new Map();
  for (const slot of generation.slots) {
    if (!ids.has(slot.subzone_id) || slotIds.has(slot.site_id) || !Number.isFinite(slot.x_ratio) || slot.x_ratio <= 0 || slot.x_ratio >= 1) throw new Error('Configuration : site stratégique explicite invalide.');
    slotIds.add(slot.site_id); slotsByZone.set(slot.subzone_id, (slotsByZone.get(slot.subzone_id) || 0) + 1);
  }
  if ([...ids].some(id => !slotsByZone.has(id)) || [...slotsByZone.values()].some(count => count > generation.max_sites_per_subzone)) throw new Error('Configuration : nombre de sites invalide dans une sous-zone.');
  const siteTypes = ['permanence', 'financement', 'faction', 'tour_communication', 'imprimerie', 'meeting', 'institut_sondage', 'garage_velo', 'garage_scooter'];
  if (siteTypes.some(type => !Number.isInteger(generation.site_counts[type]) || generation.site_counts[type] < 0)
    || Object.values(generation.site_counts).reduce((a, b) => a + b, 0) !== generation.slots.length) throw new Error('Configuration : quotas de sites incohérents.');
  for (const id of ids) {
    if (generation.slots.filter(s => s.subzone_id === id && s.controls_zone).length !== 1) throw new Error('Un bâtiment de contrôle est requis par sous-zone.');
  }
  for (const biome of config.layout.biomes) {
    const meetings = generation.slots.filter(s => s.type === 'meeting' && biome.subzones.some(z => z.id === s.subzone_id));
    if (meetings.length !== 1 || meetings[0].subzone_id !== biome.subzones[1].id || meetings[0].x_ratio !== 0.5) throw new Error('Le meeting doit être au centre du biome.');
  }
  for (const type of siteTypes) if (generation.slots.filter(s => s.type === type).length !== generation.site_counts[type]) throw new Error('Fonctions fixes des bâtiments incohérentes.');
  for (const slot of generation.slots) if (!siteTypes.includes(slot.type) || typeof slot.controls_zone !== 'boolean'
    || slot.controls_zone && ['meeting', 'institut_sondage', 'imprimerie', 'financement'].includes(slot.type)
    || slot.type === 'faction' && !['service_ordre', 'cabinet_administratif'].includes(slot.fixed_variant)) throw new Error('Fonction de bâtiment invalide.');
  validateMinorConfig(config);
  for (const [key, value] of Object.entries(config.balance.vehicles)) positive(value, key);
  for (const [key, value] of Object.entries(config.balance.zone_control)) positive(value, key);
  const capturableConfigs = ['garage_velo', 'garage_scooter', 'permanence', 'financement', 'tour_communication', 'faction_slot_melenchon_lepen_service_ordre', 'faction_slot_philippe_cabinet_administratif'];
  for (const type of [...capturableConfigs, 'imprimerie', 'meeting', 'institut_sondage']) {
    const building = config.balance.buildings[type];
    for (const cap of ['global_max', 'max_per_candidate', 'max_per_biome', 'max_per_subzone']) if (!Number.isInteger(building[cap]) || building[cap] < 0) throw new Error(`Configuration : cap invalide (${type}.${cap}).`);
    if (building.max_level !== 1 || building.upgrade_costs.length !== 0) throw new Error(`Niveau unique attendu : ${type}.`);
    for (const key of ['required_presence_N1', 'required_presence_N2', 'required_presence_N3', 'maintain_presence_N1', 'maintain_presence_N2', 'maintain_presence_N3']) if (!Number.isFinite(building[key]) || building[key] < 0) throw new Error(`Seuil invalide : ${type}.${key}.`);
    if (capturableConfigs.includes(type)) { positive(building.capture_cost, `capture ${type}`); positive(building.capture_seconds, `capture ${type}`); positive(building.closure_delay_seconds, `fermeture ${type}`); }
    for (const cost of building.upgrade_costs) positive(cost, `amélioration ${type}`);
  }
  const printer = config.balance.buildings.imprimerie;
  for (const field of ['purchase_hold_seconds', 'pickup_seconds']) positive(printer[field], `imprimerie.${field}`);
  positive(printer.tract_cost_by_level[0], 'prix du tract'); positive(printer.equipment_seconds_by_level[0], 'durée d’impression');
  const funding = config.balance.buildings.financement;
  for (const field of ['upgrade_offset', 'upgrade_radius', 'completion_feedback_seconds']) positive(funding[field], `financement.${field}`);
  positive(config.balance.buildings.permanence.first_headquarters_capture_cost, 'coût du premier QG');
  positive(config.balance.physical_units.sympathisant.task_move_speed, 'vitesse de collecte');
  positive(config.balance.physical_units.militant.move_speed, 'vitesse du Militant');
  positive(config.balance.physical_units.militant.max_player_speed_multiplier, 'limite de vitesse du Militant');
  for (const [section, fields] of [
    [config.balance.candidate_combat, ['charge_activation_seconds', 'charge_ready_seconds', 'charged_damage', 'charged_partial_max_ratio', 'charged_stun_seconds', 'jump_height_ratio', 'jump_duration_seconds', 'hit_stun_seconds', 'light_hit_hidden_damage', 'finisher_hidden_damage', 'finisher_knockback', 'combo_reset_seconds', 'light_range', 'finisher_range', 'light_windup_seconds', 'finisher_windup_seconds', 'active_seconds', 'light_recovery_seconds', 'finisher_recovery_seconds', 'input_buffer_seconds', 'knockback_decay_per_second', 'combo_cancel_seconds', 'body_width', 'knockdown_fall_seconds', 'knockdown_ground_seconds', 'knockdown_rise_seconds', 'wakeup_invulnerability_seconds', 'dive_min_height', 'dive_vertical_speed', 'dive_horizontal_speed', 'dive_range', 'dive_damage', 'dive_knockback', 'dive_landing_recovery_seconds']],
    [config.balance.physical_units.militant, ['verbal_range', 'verbal_cooldown_seconds', 'verbal_damage', 'projectile_speed', 'projectile_range']],
    [config.balance.physical_units.service_ordre, ['hidden_durability', 'move_speed', 'attack_range', 'attack_cooldown_seconds', 'attack_damage', 'raid_cost', 'raid_duration_seconds', 'raid_cooldown_seconds']],
    [config.balance.special_charge, ['required_points', 'points_per_light_hit', 'points_per_finisher_hit', 'points_per_hit_taken', 'points_per_strong_hit_taken']],
  ]) for (const field of fields) positive(section[field], field);
  if (!Number.isFinite(config.balance.candidate_combat.light_knockback) || config.balance.candidate_combat.light_knockback < 0) throw new Error('Le recul léger doit être positif ou nul.');
  for (const value of Object.values(config.balance.faction_interactions)) positive(value, 'zone d’interaction factionnelle');
  for (const type of ['faction_slot_melenchon_lepen_service_ordre', 'faction_slot_philippe_cabinet_administratif']) positive(config.balance.buildings[type].purchase_hold_seconds, type);
  const so = config.balance.buildings.faction_slot_melenchon_lepen_service_ordre;
  if (so.baton_cost_by_level.length !== so.max_level || so.equipment_seconds_by_level.length !== so.max_level) throw new Error('Configuration : équipement SO invalide.');
  for (const value of [...so.baton_cost_by_level, ...so.equipment_seconds_by_level, so.pickup_seconds]) positive(value, 'équipement SO');
  for (const settings of Object.values(config.balance.specials)) for (const [key, value] of Object.entries(settings)) if (typeof value === 'number') {
    if(key==='knockback'){if(!Number.isFinite(value)||value<0)throw new Error('Configuration : recul du pouvoir invalide.');}
    else positive(value, `pouvoir.${key}`);
  }
  positive(config.balance.physical_units.militant.reconsider_seconds, 'réévaluation du Militant');
  if (!Number.isInteger(config.balance.physical_units.militant.nearby_zone_radius) || config.balance.physical_units.militant.nearby_zone_radius < 1) throw new Error('Configuration : rayon de prospection invalide.');
  if (!Number.isInteger(config.balance.physical_units.militant.expedition_min_group_size) || config.balance.physical_units.militant.expedition_min_group_size < 2) throw new Error('Configuration : taille minimale de groupe de militants invalide.');
  positive(config.balance.physical_units.militant.expedition_spacing_units, 'espacement des militants en groupe');
  if (!Number.isInteger(config.balance.physical_units.sympathisant.tract_pickup_zone_radius) || config.balance.physical_units.sympathisant.tract_pickup_zone_radius < 0) throw new Error('Configuration : distance de collecte des tracts invalide.');
  positive(config.layout.electoral_weights?.default, 'poids électoral par défaut');
  for (const [id, weight] of Object.entries(config.layout.electoral_weights.by_subzone)) {
    if (!ids.has(id)) throw new Error(`Configuration : poids d’une sous-zone inconnue (${id}).`);
    positive(weight, `poids électoral ${id}`);
  }
  const tower = config.balance.buildings.tour_communication;
  if (!Number.isInteger(tower.global_limit) || tower.global_limit < 1) throw new Error('Configuration : limite globale de Tours invalide.');
  positive(tower.broadcast_interval_seconds, 'intervalle de communication');
  positive(config.balance.buildings.institut_sondage.poll_cost, 'prix du sondage');
  const meeting = config.balance.buildings.meeting;
  positive(meeting.interaction_radius, 'portée Meeting');
  if (meeting.meeting_max_level !== 1 || meeting.activation_cost_by_level.length !== 1) throw new Error('Configuration : un seul meeting est attendu.');
  for (const key of ['activation_cost', 'hold_seconds', 'pause_grace_seconds', 'cooldown_seconds', 'gather_speed', 'gather_spacing', 'podium_height', 'podium_half_width', 'wave_visual_seconds']) positive(meeting[key], `meeting.${key}`);
  if (!Array.isArray(config.balance.ai_economy.development_order) || config.balance.ai_economy.development_order.some(type => !config.balance.buildings[type])) throw new Error('Configuration : ordre de développement IA invalide.');
  return config;
}

export async function loadConfig() {
  const base = new URL('../Présidentielles 2027/', import.meta.url);
  const files = ['game_balance.json', 'world_layout.json', 'building_catalog.json', 'prototype_config.json', 'campaign_events.json'];
  const [balance, layout, buildings, prototype, campaignCatalog] = await Promise.all(files.map(async file => {
    const response = await fetch(new URL(file, base));
    if (!response.ok) throw new Error(`Impossible de charger ${file} (${response.status}).`);
    return response.json();
  }));
  return validateConfig({ balance, layout, buildings, prototype, campaignCatalog });
}
