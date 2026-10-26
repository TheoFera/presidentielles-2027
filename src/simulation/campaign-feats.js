// Exploits d'un camp pendant la campagne (sympathisants adverses mis K.-O., permanences adverses fermées),
// comptés dans l'état de la partie pour les objectifs du tutoriel : l'affichage d'un invité les reçoit aussi.

export function recordFeat(state, faction, key) {
  if (!faction) return;
  const feats = state.campaign_feats || (state.campaign_feats = {});
  const counts = feats[faction] || (feats[faction] = {});
  counts[key] = (counts[key] || 0) + 1;
}

export const featCount = (state, faction, key) => state.campaign_feats?.[faction]?.[key] || 0;
