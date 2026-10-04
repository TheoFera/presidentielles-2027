// Carte du joueur : médaillon carré (buste du candidat choisi, bord à la couleur du palier)
// et titre écrit après le pseudo. Le nom du palier n'est jamais affiché : seulement sa couleur.
// Utilisée dans le profil, le lobby multijoueur, l'écran de fin et le classement.
import { ALL_CANDIDATE_IDS, MINOR_UNLOCKS, STYLE_UNLOCKS, profileUnlockIds } from '../simulation/unlock-catalog.js';
import { isBetatestProfile } from '../simulation/campaign-styles.js';
import { bestRating, cleanAvatar, cleanPlayerCard, gainedCount, ratingTier, titleName, titleRank } from '../simulation/player-titles.js';
import { styleSpriteId } from './campaign-style-art.js';
import { visualManifest } from './visual-manifest.js';
import { selectionPortrait } from './debate-selection.js';

const escape = text => String(text).replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`);

/* Couleur de chaque candidat (configuration du jeu), pour le fond du portrait, comme dans le Débat télé. */
let candidateColors = {};
export function setCandidateColors(factions = {}) { candidateColors = Object.fromEntries(Object.entries(factions).map(([id, f]) => [id, f.color])); }
/** Candidat d'un avatar : le camp d'un style (melenchon_populiste → melenchon), ou l'identifiant lui-même. */
export const avatarFaction = id => Object.keys(STYLE_UNLOCKS).find(f => STYLE_UNLOCKS[f].includes(id)) ?? id;
export const candidateColor = id => candidateColors[avatarFaction(id)] || '#56708f';
/** Le même portrait partout (profil, collection, salon, classement) : cadrage et fond du Débat télé. */
export const portraitFace = id => `<span class="medallion-face" data-avatar="${escape(id)}" style="--candidate-color:${candidateColor(id)}"></span>`;

/** Candidats possédés : ceux du compte ou de l'appareil, tous pour le profil « betatest ». */
export const ownedCandidates = profile => isBetatestProfile(profile) ? [...ALL_CANDIDATE_IDS] : profileUnlockIds(profile);

/**
 * Meilleur titre retenu sur l'appareil (sans compte). Il est noté avec le nombre de candidats
 * gagnés à ce moment-là : comme un déblocage ne se perd jamais, un titre noté avec plus de
 * candidats que l'appareil n'en a (ancien essai « betatest », copie corrompue) est ignoré.
 */
function deviceBestTitle(profile) {
  const best = profile.best_title;
  return best && Number.isInteger(best.rank) && Number.isInteger(best.gained) && best.gained <= gainedCount(profileUnlockIds(profile)) ? best.rank : 0;
}

/** Ce que le joueur montre de lui : avatar, titre, palier et candidats débloqués. */
export function playerCard(profile) {
  const unlocks = ownedCandidates(profile), account = profile.account;
  // Connecté : seul le meilleur titre du compte compte ; sinon celui de l'appareil.
  const best = account ? account.title_rank | 0 : deviceBestTitle(profile);
  return cleanPlayerCard({ avatar: cleanAvatar(account ? account.avatar ?? profile.avatar : profile.avatar, unlocks),
    title: titleRank(unlocks, best), tier: account ? ratingTier(bestRating(account.stats)) : null, unlocks });
}
/** Sans compte : retient le meilleur titre atteint sur l'appareil (jamais avec le profil « betatest »). Renvoie le patch à enregistrer. */
export function rememberTitle(profile) {
  if (profile.account || isBetatestProfile(profile)) return {};
  const ids = profileUnlockIds(profile), rank = titleRank(ids, deviceBestTitle(profile));
  return rank > deviceBestTitle(profile) ? { best_title: { rank, gained: gainedCount(ids) } } : {};
}

/** Médaillon : `size` = 'lg' (profil), 'md' (lobby) ou 'sm' (lignes de classement). */
export function medallionContent(card, { size = 'md', label = '' } = {}) {
  const avatar = card?.avatar || cleanAvatar(null);
  return `<span class="medallion" data-size="${size}" data-tier="${card?.tier || 'none'}" ${label ? `role="img" aria-label="${escape(label)}"` : 'aria-hidden="true"'}>${portraitFace(avatar)}</span>`;
}
/** Titre affiché après le pseudo (rien tant qu'aucun candidat n'est gagné). */
export function titleContent(card) {
  const name = titleName(card?.title);
  return name ? `<span class="player-title">${escape(name)}</span>` : '';
}

/** Image du buste : le sprite du style (candidats principaux) ou la première image du candidat mineur. */
export function avatarImage(id) {
  if (MINOR_UNLOCKS.includes(id)) return selectionPortrait(id);
  return Promise.resolve(visualManifest[styleSpriteId(id)]?.file || '');
}
export function hydrateMedallions(root) {
  root.querySelectorAll('.medallion-face[data-avatar]:not([data-ready])').forEach(face => {
    face.dataset.ready = 'true';
    // Le portrait se pose sur le dégradé à la couleur du candidat (deux couches, voir player-profile.css).
    void avatarImage(face.dataset.avatar).then(src => { if (src) face.style.backgroundImage = `url("${src}"), var(--face-bg)`; }).catch(() => {});
  });
}
