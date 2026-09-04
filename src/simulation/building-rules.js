export const factionVariant = faction => faction === 'philippe' ? 'cabinet_administratif' : 'service_ordre';
export function buildingSettings(config, building, faction = building.owner_id) {
  if (building.type !== 'faction') return config.balance.buildings[building.type];
  return config.balance.buildings[(building.variant || factionVariant(faction)) === 'service_ordre'
    ? 'faction_slot_melenchon_lepen_service_ordre' : 'faction_slot_philippe_cabinet_administratif'];
}
export const buildingLabel = (building, faction = building.owner_id) => ({ permanence: 'Permanence', financement: 'Financement', imprimerie: 'Imprimerie',
  tour_communication: 'Tour de communication', institut_sondage: 'Institut de sondage', meeting: 'Salle de meeting',
  service_ordre: 'Local du service d’ordre', cabinet_administratif: 'Cabinet administratif' })[building.type === 'faction' ? building.variant || factionVariant(faction) : building.type];

export const isNeutralService = building => building.ownership_model === 'neutral_service';
export const isCapturable = building => !isNeutralService(building);
export const isNeutral = building => isCapturable(building) && building.owner_id === null;
export const presenceForLevel = (settings, prefix, level) => settings[`${prefix}_N${Math.max(1, Math.min(3, level || 1))}`];

export function siteTypeForLimits(building, faction = building.owner_id) {
  return building.type === 'faction' ? factionVariant(faction) : building.type;
}

export function siteLimitSettings(config, building, faction = building.owner_id) {
  return buildingSettings(config, building, faction);
}
