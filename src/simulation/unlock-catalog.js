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
 * Note un K.-O. dans l'état de la partie. Rien n'est débloqué ici : le joueur choisit
 * ses candidats à la fin normale de la partie, voir unlockOffer().
 * Seul un K.-O. porté par le candidat lui-même compte, ultimes comprises (hologrammes, CRS,
 * encapuchonnés, Zemmour : unités temporaires de son pouvoir). Ses militants et gardes ne débloquent rien.
 */
export const ownKnockout = source => source?.role === 'CANDIDAT' || source?.temporary === true && !!source.power_id;
export function recordKnockout(state, source, target) {
  const candidate_id = knockoutUnlockId(target);
  if (!candidate_id || !ownKnockout(source) || !source.faction_id || source.faction_id === target.faction_id) return;
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

/**
 * Fin de campagne : le joueur ne débloque pas tous les candidats qu'il a mis K.-O., il en CHOISIT.
 * - victoire : 1 au choix gratuitement, +1 en regardant une pub récompensée ;
 * - défaite (« seconde chance ») : 1 au choix, seulement en regardant une pub récompensée.
 * Le serveur des comptes refuse plus de MAX_RUN_UNLOCKS candidats pour une même partie.
 */
export const UNLOCK_PICKS = Object.freeze({ free: 1, rewarded: 1, secondChance: 1 });
export const MAX_RUN_UNLOCKS = Math.max(UNLOCK_PICKS.free + UNLOCK_PICKS.rewarded, UNLOCK_PICKS.secondChance);
/** Après le 1er envoi d'une campagne, délai pour envoyer le 2ᵉ choix (pub récompensée comprise). */
export const RUN_FOLLOW_UP_SECONDS = 15 * 60;

/**
 * Durée réelle minimale d'une campagne solo pour que ses déblocages soient acceptés : 75 % de la campagne
 * (jours × durée d'un jour, voir game_balance.json). Le jeu et le serveur utilisent le même calcul.
 */
export function campaignMinSeconds(time) {
  return Math.floor(time.starting_days_before_first_round * time.real_seconds_per_game_day * 0.75);
}

/** Candidats que ce camp a lui-même mis K.-O. pendant la partie (sans doublon, dans l'ordre). */
export function knockedOutBy(state, faction) {
  if (!Array.isArray(state?.knockouts)) return [];
  return [...new Set(state.knockouts.filter(k => k?.by_faction === faction && isUnlockable(k.candidate_id)).map(k => k.candidate_id))];
}

/**
 * Ce que la fin normale de la campagne propose à ce camp, ou null (partie pas terminée, rien de nouveau).
 * `owned` : identifiants déjà débloqués (ils ne sont pas proposés une seconde fois).
 * free : choix gratuits ; rewarded : choix de plus contre une pub récompensée.
 */
export function unlockOffer(state, faction, owned = []) {
  if (state?.phase !== 'RESULTS') return null;
  const choices = knockedOutBy(state, faction).filter(id => !owned.includes(id));
  if (!choices.length) return null;
  const won = state.result?.winner === faction;
  const free = won ? Math.min(UNLOCK_PICKS.free, choices.length) : 0;
  const rewarded = Math.min(won ? UNLOCK_PICKS.rewarded : UNLOCK_PICKS.secondChance, choices.length - free);
  return { won, choices, free, rewarded };
}

/** Multijoueur (sans pub) : le vainqueur de l'élection garde tous les candidats qu'il a mis K.-O. */
export function earnedUnlocks(state, faction) {
  if (state?.phase !== 'RESULTS' || state.result?.winner !== faction) return [];
  return knockedOutBy(state, faction);
}
