// Titres et paliers du joueur, partagés par le jeu et le serveur des comptes.
//   - Titre : d'après la collection de candidats gagnés (hors candidats offerts au départ).
//     Seuils en pourcentage : ajouter des candidats au catalogue ne casse pas l'échelle.
//     Un titre obtenu n'est jamais perdu, sauf « Président » qui exige toute la collection actuelle.
//   - Palier : d'après l'Elo en ligne. Il n'est jamais écrit, seulement montré par une couleur.
//   - Carte du joueur : ce que les autres voient de lui en multijoueur (avatar, titre, palier, déblocages).
import { ALL_CANDIDATE_IDS, UNLOCKABLE_IDS, DEFAULT_UNLOCKED, isUnlockable } from './unlock-catalog.js';

/** share : part des candidats à gagner nécessaire. Le premier titre arrive dès le 1er déblocage. */
export const TITLES = [
  { name: 'Sympathisant', share: 0 },
  { name: 'Militant', share: .15 },
  { name: 'Conseiller municipal', share: .25 },
  { name: 'Maire', share: .40 },
  { name: 'Député', share: .55 },
  { name: 'Ministre', share: .70 },
  { name: 'Premier ministre', share: .85 },
  { name: 'Président de la République', share: 1 },
];
export const MAX_TITLE_RANK = TITLES.length;

/** Nombre de candidats gagnés nécessaire pour chaque titre, selon la taille actuelle du catalogue. */
export function titleThresholds(total = UNLOCKABLE_IDS.length) {
  return TITLES.map((t, i) => i === TITLES.length - 1 ? total : Math.max(1, Math.ceil(t.share * total)));
}
export const gainedCount = ids => new Set((ids || []).filter(isUnlockable)).size;

/** Rang du titre (0 = aucun, 1 = Sympathisant…). `best` : meilleur rang déjà atteint, jamais perdu. */
export function titleRank(ids, best = 0) {
  const gained = gainedCount(ids), needs = titleThresholds();
  const computed = needs.reduce((rank, need, i) => gained >= need ? i + 1 : rank, 0);
  if (computed === MAX_TITLE_RANK) return computed;
  const kept = Number.isInteger(best) ? Math.min(Math.max(best, 0), MAX_TITLE_RANK - 1) : 0;
  return Math.max(computed, kept);
}
export const titleName = rank => TITLES[rank - 1]?.name ?? null;

/** Prochain titre : son nom et le nombre de candidats qui manquent (null si tout est gagné). */
export function nextTitle(ids, best = 0) {
  const rank = titleRank(ids, best);
  if (rank >= MAX_TITLE_RANK) return null;
  return { rank: rank + 1, name: TITLES[rank].name, missing: Math.max(1, titleThresholds()[rank] - gainedCount(ids)) };
}

/** Paliers en ligne, du plus bas au plus haut. Tout le monde commence à 1 000 Elo. */
export const TIERS = [
  { id: 'bronze', from: -Infinity },
  { id: 'silver', from: 1000 },
  { id: 'gold', from: 1150 },
  { id: 'elysee', from: 1300 },
];
/** Palier d'un Elo ; null tant que le joueur n'a joué aucune partie classée. */
export function ratingTier(rating) {
  if (!Number.isFinite(rating)) return null;
  return TIERS.findLast(t => rating >= t.from).id;
}
/** Points qui manquent pour le palier suivant (null au plus haut ou sans partie classée). */
export function nextTier(rating) {
  if (!Number.isFinite(rating)) return null;
  const next = TIERS.find(t => t.from > rating);
  return next ? { id: next.id, missing: Math.ceil(next.from - rating), from: next.from, previous: TIERS[TIERS.indexOf(next) - 1].from } : null;
}
/** Meilleur Elo parmi les classements joués ({ campaign: { rating, games }, debate: … }). */
export function bestRating(stats) {
  const ratings = Object.values(stats || {}).filter(s => s?.games > 0 && Number.isFinite(s.rating)).map(s => s.rating);
  return ratings.length ? Math.max(...ratings) : null;
}

/** Avatar valide : un candidat débloqué, sinon le premier candidat de départ. */
export function cleanAvatar(avatar, ids = DEFAULT_UNLOCKED) {
  return ALL_CANDIDATE_IDS.includes(avatar) && (DEFAULT_UNLOCKED.includes(avatar) || ids.includes(avatar)) ? avatar : DEFAULT_UNLOCKED[0];
}

/** Carte reçue d'un autre joueur : seules des valeurs connues sont gardées. */
export function cleanPlayerCard(card) {
  if (!card || typeof card !== 'object') return null;
  const unlocks = Array.isArray(card.unlocks) ? [...new Set(card.unlocks.filter(id => ALL_CANDIDATE_IDS.includes(id)))] : [...DEFAULT_UNLOCKED];
  const rank = Number.isInteger(card.title) && card.title >= 0 && card.title <= MAX_TITLE_RANK ? card.title : 0;
  return { avatar: cleanAvatar(card.avatar, unlocks), title: rank, tier: TIERS.some(t => t.id === card.tier) ? card.tier : null, unlocks };
}
