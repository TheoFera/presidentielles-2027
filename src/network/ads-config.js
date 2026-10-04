// Réglages des publicités interstitielles. Aucun secret ici : ces identifiants sont publics
// (ils figurent dans le code de toute page qui affiche des pubs Google).
// Voir docs/publicites.md pour les créer et les renseigner.

/** Site web : identifiant d'éditeur AdSense (« ca-pub-… », AdSense → Compte → Informations).
 *  Vide = aucune pub sur le site. L'appli Android utilise AdMob : voir android/gradle.properties. */
export const ADSENSE_CLIENT = '';
/** true = pubs de test Google sur le site (rien n'est payé). Passer à false une fois le site validé par AdSense. */
export const ADSENSE_TEST = true;

/** Règles de fréquence, communes au site et à l'appli. */
export const AD_RULES = Object.freeze({
  /** Parties terminées (campagne ou débat) sans aucune pub, pour un nouveau joueur. 0 = pub dès la première fin de campagne. */
  freeGames: 0,
  /** Écart minimal entre deux pubs, en secondes, quel que soit le mode. */
  minGapSeconds: 180,
  /** Mode Débat : au plus une pub tous les N débats… */
  debateEvery: 3,
  /** … et au moins ce nombre de secondes après la pub précédente. */
  debateGapSeconds: 240,
});
