// Catalogue des candidats à débloquer, avec les identifiants internes du jeu.
// Un « candidat jouable » est soit un style de campagne d'un candidat principal
// (ex. melenchon_communautariste), soit un candidat mineur (ex. glucksmann).
// Ce fichier ne dépend de rien : le serveur des comptes (serveur-en-ligne/api)
// l'importe aussi pour refuser tout identifiant inconnu.
// Nouveau style ou nouveau candidat mineur : l'ajouter ici. test/accounts.test.js
// vérifie que ce catalogue suit CAMPAIGN_STYLES et MINOR_FACTIONS.

/** Styles de campagne des candidats principaux. Le premier de chaque liste est offert d'emblée. */
export const STYLE_UNLOCKS = {
  melenchon: ['melenchon_universaliste', 'melenchon_communautariste', 'melenchon_populiste'],
  le_pen: ['le_pen_souverainiste', 'le_pen_zemmouriste', 'le_pen_gouvernement'],
  philippe: ['philippe_gestionnaire', 'philippe_notable', 'philippe_europeiste'],
};
/** Candidats mineurs (identifiant de camp), tous verrouillés au départ. */
export const MINOR_UNLOCKS = ['glucksmann', 'roussel', 'arthaud', 'dupont_aignan', 'retailleau', 'attal'];

/** Disponibles pour tout nouveau joueur : Mélenchon universaliste, Le Pen, Édouard Philippe. */
export const DEFAULT_UNLOCKED = Object.values(STYLE_UNLOCKS).map(styles => styles[0]);
export const ALL_CANDIDATE_IDS = [...Object.values(STYLE_UNLOCKS).flat(), ...MINOR_UNLOCKS];
/** Ce qui peut être gagné en jeu (tout sauf les candidats de départ). */
export const UNLOCKABLE_IDS = ALL_CANDIDATE_IDS.filter(id => !DEFAULT_UNLOCKED.includes(id));
export const isUnlockable = id => typeof id === 'string' && UNLOCKABLE_IDS.includes(id);
export const isMinorUnlock = id => MINOR_UNLOCKS.includes(id);

/** Identifiant débloqué en mettant ce candidat K.-O. : le mineur lui-même, ou le style que portait le principal. */
export function knockoutUnlockId(target) {
  if (!target || target.role !== 'CANDIDAT') return null;
  const id = target.minor ? target.faction_id : target.current_campaign_style;
  return isUnlockable(id) ? id : null;
}

/**
 * Note un K.-O. dans l'état de la partie. Rien n'est débloqué ici : le déblocage
 * n'est validé qu'à la fin de la partie (phase RESULTS), voir earnedUnlocks().
 * `source` peut être le candidat ou une unité de son camp (militant, garde…).
 */
export function recordKnockout(state, source, target) {
  const candidate_id = knockoutUnlockId(target);
  if (!candidate_id || !source?.faction_id || source.faction_id === target.faction_id) return;
  if (!Array.isArray(state.knockouts)) state.knockouts = [];
  if (state.knockouts.length >= 200) return;
  state.knockouts.push({ tick: state.tick, by_faction: source.faction_id, candidate_id });
}

/** Liste d'identifiants → champs du profil lus par le jeu (styles par candidat, mineurs). */
export function unlocksToProfile(ids = []) {
  const owned = new Set([...DEFAULT_UNLOCKED, ...ids]);
  return {
    unlocked_campaign_styles: Object.fromEntries(Object.entries(STYLE_UNLOCKS).map(([faction, styles]) => [faction, styles.filter(id => owned.has(id))])),
    unlocked_minor_candidates: MINOR_UNLOCKS.filter(id => owned.has(id)),
  };
}
/** Champs du profil → liste d'identifiants. */
export function profileUnlockIds(profile = {}) {
  const styles = Object.values(profile.unlocked_campaign_styles || {}).flat();
  return ALL_CANDIDATE_IDS.filter(id => DEFAULT_UNLOCKED.includes(id) || styles.includes(id) || (profile.unlocked_minor_candidates || []).includes(id));
}

/** Candidats gagnés par ce camp, seulement une fois la partie terminée normalement. */
export function earnedUnlocks(state, faction) {
  if (state?.phase !== 'RESULTS' || !Array.isArray(state.knockouts)) return [];
  return [...new Set(state.knockouts.filter(k => k?.by_faction === faction && isUnlockable(k.candidate_id)).map(k => k.candidate_id))];
}
