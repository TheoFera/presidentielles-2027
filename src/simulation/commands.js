/** Controllers express intentions. They never receive writable simulation entities. */
export const move = (candidateId, axis) => ({ type: 'Move', candidateId, axis });
export const setCampaignActive = (candidateId, active) => ({ type: 'SetCampaignActive', candidateId, active });
export const interactionPresence = (candidateId, active = true) => ({ type: 'InteractionPresence', candidateId, active });
export const teleportTarget = (candidateId, targetId) => ({ type: 'DebugTeleportTarget', candidateId, targetId });
export const grantMoney = candidateId => ({ type: 'DebugGrantMoney', candidateId });
export const selectCandidate = candidateId => ({ type: 'DebugSelectCandidate', candidateId });
export const setAIEnabled = enabled => ({ type: 'DebugSetAIEnabled', enabled });
export const teleport = (candidateId, subzoneId) => ({ type: 'DebugTeleport', candidateId, subzoneId });
export const demobilize = npcId => ({ type: 'DebugDemobilize', npcId });
export const attack = (candidateId, direction = null) => ({ type: 'Attack', candidateId, direction });
export const fillSpecial = candidateId => ({ type: 'DebugFillSpecial', candidateId });
export const controlZone = candidateId => ({ type: 'DebugControlZone', candidateId });
export const spawnUnit = (candidateId, role, factionId) => ({ type: 'DebugSpawnUnit', candidateId, role, factionId });
