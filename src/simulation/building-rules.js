export const factionVariant = faction => faction === 'philippe' ? 'cabinet_administratif' : 'service_ordre';
export function buildingSettings(config, building, faction = building.owner_id) {
  if (building.type !== 'faction') return config.balance.buildings[building.type];
  return config.balance.buildings[(building.variant || factionVariant(faction)) === 'service_ordre'
    ? 'faction_slot_melenchon_lepen_service_ordre' : 'faction_slot_philippe_cabinet_administratif'];
}
export const buildingLabel = (building, faction = building.owner_id) => ({ permanence: 'Permanence', financement: 'Financement', imprimerie: 'Imprimerie',
  service_ordre: 'Local du service d’ordre', cabinet_administratif: 'Cabinet administratif' })[building.type === 'faction' ? building.variant || factionVariant(faction) : building.type];
