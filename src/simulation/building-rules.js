export const factionVariant = faction => faction === 'philippe' ? 'cabinet_administratif' : 'service_ordre';
export const siteVariant = (building, faction = building.owner_id) => building.fixed_variant || building.variant || factionVariant(faction);
export const acceptsDonations = building => building.type === 'permanence';
export const printsTracts = building => ['imprimerie', 'permanence'].includes(building.type);
export function buildingSettings(config, building, faction = building.owner_id) {
  if (building.type !== 'faction') return config.balance.buildings[building.type];
  return config.balance.buildings[siteVariant(building, faction) === 'service_ordre'
    ? 'faction_slot_melenchon_lepen_service_ordre' : 'faction_slot_philippe_cabinet_administratif'];
}
export const buildingLabel = (building, faction = building.owner_id) => building.label || ({ permanence: 'Permanence', financement: 'Financement privé', imprimerie: 'Imprimerie',
  garage_velo: 'Garage à vélo', garage_scooter: 'Garage à scooter',
  tour_communication: 'Rédaction', institut_sondage: 'Institut de sondage', meeting: 'Place de meeting',
  service_ordre: 'Local du service d’ordre', cabinet_administratif: 'Cabinet administratif' })[building.type === 'faction' ? siteVariant(building, faction) : building.type];

export const isNeutralService = building => building.ownership_model === 'neutral_service';
export const isCapturable = building => !isNeutralService(building);
export const isNeutral = building => isCapturable(building) && building.owner_id === null;
export const presenceForLevel = (settings, prefix, level) => settings[`${prefix}_N${Math.max(1, Math.min(3, level || 1))}`];

export function siteTypeForLimits(building, faction = building.owner_id) {
  return building.type === 'faction' ? siteVariant(building, faction) : building.type;
}

export function siteLimitSettings(config, building, faction = building.owner_id) {
  return buildingSettings(config, building, faction);
}
