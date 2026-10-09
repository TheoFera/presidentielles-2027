// Progression affichée par le jeu (candidats débloqués) selon la situation :
//   - connecté : la liste du compte PartageTonJeu (le serveur fait foi, copie locale pour l'affichage) ;
//   - sans compte : la progression de cet appareil, comme avant.
// La progression de l'appareil est mise de côté pendant la connexion et retrouvée à la déconnexion
// (elle n'est jamais envoyée au compte : elle serait falsifiable).
import { unlocksToProfile, profileUnlockIds } from '../../simulation/unlock-catalog.js';
import { CAMPAIGN_STYLES } from '../../simulation/campaign-styles.js';
import { DEBATE_CANDIDATES } from '../debat/debate-selection.js';

export function applyAccountProgress(profile, accounts) {
  const me = accounts.signedIn ? accounts.me : null;
  if (me?.user) {
    if (!profile.device_unlocks) profile.device_unlocks = profileUnlockIds(profile);
    // Carte du compte : avatar, meilleur titre et Elo (palier), pour le profil, le lobby et le classement.
    Object.assign(profile, unlocksToProfile(me.unlocks || []), { account: { username: me.user.username || null, avatar: me.user.avatar ?? profile.avatar ?? null,
      title_rank: me.user.title_rank ?? 0, stats: me.stats || {} } });
  } else if (profile.account || profile.device_unlocks) {
    Object.assign(profile, unlocksToProfile(profile.device_unlocks || profileUnlockIds(profile)));
    delete profile.account; delete profile.device_unlocks;
  }
  return profile;
}

/** Sans compte : les candidats gagnés en fin de partie restent sur cet appareil. */
export function addDeviceUnlocks(profile, ids) {
  const before = profileUnlockIds(profile);
  const added = ids.filter(id => !before.includes(id));
  if (added.length) Object.assign(profile, unlocksToProfile([...before, ...added]));
  return added;
}

/** Noms lisibles : « Roussel », « Le Pen Zemmouriste »… */
export function unlockNames(ids) {
  return ids.map(id => {
    const candidate = DEBATE_CANDIDATES.find(c => c.id === id);
    if (candidate) return candidate.short;
    for (const [faction, styles] of Object.entries(CAMPAIGN_STYLES)) {
      const style = styles.find(s => s.id === id);
      if (style) return `${DEBATE_CANDIDATES.find(c => c.id === faction)?.short || faction} ${style.name.split(' · ')[0]}`;
    }
    return id;
  }).join(', ');
}
