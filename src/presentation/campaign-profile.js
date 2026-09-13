import { normalizeCampaignProfile, unlockCampaignStyle } from '../simulation/campaign-styles.js';

export const CAMPAIGN_PROFILE_KEY = 'presidentielles2027:profile:v1';
export function loadCampaignProfile(storage = globalThis.localStorage) {
  try { return normalizeCampaignProfile(JSON.parse(storage.getItem(CAMPAIGN_PROFILE_KEY) || '{}')); }
  catch { return normalizeCampaignProfile(); }
}
export function saveCampaignProfile(profile, storage = globalThis.localStorage) {
  const next = normalizeCampaignProfile(profile);
  storage.setItem(CAMPAIGN_PROFILE_KEY, JSON.stringify(next));
  return next;
}
// Integration point for future challenges/progression/shop. No such system is created here.
export function persistCampaignStyleUnlock(profile, faction, styleId, storage = globalThis.localStorage) {
  return saveCampaignProfile(unlockCampaignStyle(profile, faction, styleId), storage);
}
