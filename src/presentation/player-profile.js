import { CANDIDATES, portrait } from './arcade-content.js';
import { expressedScores } from './election-results.js';
import { CAMPAIGN_STYLES, isBetatestProfile } from '../simulation/campaign-styles.js';
import { MAP_DECORS, decorForProfile } from './map-decor.js';

/* Profil du joueur, gardé sur cet appareil : pseudo et statistiques de carrière.
   Il accueillera plus tard les tenues et skins à débloquer. */
export const DEFAULT_NICKNAME = 'Joueur';
export const NICKNAME_MAX = 16;
const FACTIONS = CANDIDATES.map(c => c.id);
const count = n => Number.isInteger(n) && n > 0 ? n : 0;
const escape = text => String(text).replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`);
const format = (n, digits = 0) => n.toLocaleString('fr-FR', { minimumFractionDigits: digits, maximumFractionDigits: digits });

export function cleanNickname(text) {
  const clean = String(text ?? '').replace(/[\u0000-\u001f\u007f<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, NICKNAME_MAX);
  return clean || DEFAULT_NICKNAME;
}

export function normalizeStats(stats = {}) {
  const score = Number(stats.best_score);
  return {
    games: count(stats.games), wins: count(stats.wins), qualified: count(stats.qualified), multiplayer_games: count(stats.multiplayer_games),
    best_score: Number.isFinite(score) && score > 0 ? Math.min(100, score) : null,
    best_voters: count(stats.best_voters),
    by_candidate: Object.fromEntries(FACTIONS.map(f => {
      const c = stats.by_candidate?.[f] || {};
      return [f, { games: count(c.games), wins: count(c.wins), qualified: count(c.qualified) }];
    })),
  };
}

/** Ajoute une partie terminée (phase RESULTS) aux statistiques. Ne modifie pas le profil reçu. */
export function recordMatchResult(profile, state, { multiplayer = false } = {}) {
  const stats = normalizeStats(profile.stats);
  const local = state.local_candidate_id.split(':')[1];
  if (!state.result || !FACTIONS.includes(local)) return { ...profile, stats };
  const win = state.result.winner === local, qualified = state.eliminated_faction !== local;
  const peak = Math.max(0, ...(state.match_history || []).map(p => p.voters?.[local] || 0));
  const score = qualified ? expressedScores(state.result.scores, [state.result.winner, state.result.second])?.[local] : null;
  stats.games++; stats.by_candidate[local].games++;
  if (win) { stats.wins++; stats.by_candidate[local].wins++; }
  if (qualified) { stats.qualified++; stats.by_candidate[local].qualified++; }
  if (multiplayer) stats.multiplayer_games++;
  if (score != null && score > (stats.best_score ?? 0)) stats.best_score = score;
  stats.best_voters = Math.max(stats.best_voters, peak);
  return { ...profile, stats };
}

export function favoriteCandidate(stats) {
  const played = FACTIONS.filter(f => stats.by_candidate[f].games > 0);
  if (!played.length) return null;
  return played.reduce((best, f) => stats.by_candidate[f].games > stats.by_candidate[best].games ? f : best);
}

/** Choix du décor de la carte, réservé au profil betatest (pris en compte à la partie suivante). */
function decorPicker(profile) {
  const chosen = decorForProfile(profile);
  return `<fieldset class="profile-decor"><legend>Décor de la carte · betatest</legend>${MAP_DECORS.map(d =>
    `<label><input type="radio" name="map-decor" value="${d.id}" ${d.id === chosen ? 'checked' : ''}><span><strong>${escape(d.label)}</strong><small>${escape(d.note)}</small></span></label>`).join('')}</fieldset>`;
}

/** Nom affiché : le pseudo du compte PartageTonJeu si le joueur est connecté, sinon celui de l'appareil. */
export const displayName = profile => profile.account?.username || cleanNickname(profile.nickname);
export const profileButton = profile => `<button id="menu-profile" aria-label="Mon profil : ${escape(displayName(profile))}" title="Mon profil">
  <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="4.2"/><path d="M3.5 21c.8-4.6 4.2-7 8.5-7s7.7 2.4 8.5 7z"/></svg><span>${escape(displayName(profile))}</span></button>`;

/* Petites icônes au trait (24 × 24) pour les tuiles de statistiques. */
const ICONS = {
  games: 'M4 11h16v9H4z M8 11V4h8v7 M10 7h4 M9 15h6',
  wins: 'M7 4h10v4a5 5 0 0 1-10 0z M7 5H4v1.5A3.5 3.5 0 0 0 7.5 10 M17 5h3v1.5a3.5 3.5 0 0 1-3.5 3.5 M12 13v3 M8 20h8 M9.5 16h5v4h-5z',
  rate: 'M12 3a9 9 0 1 0 9 9 M12 7a5 5 0 1 0 5 5 M12 12l7-7 M16 5h3v3',
  qualified: 'M5 21V4 M5 4h11l-2 3.5 2 3.5H5',
  score: 'M5 20v-7 M12 20V5 M19 20v-10 M3 20h18',
  voters: 'M9 11a3 3 0 1 0 0-6a3 3 0 1 0 0 6z M3 20c.5-3.5 3-5.5 6-5.5s5.5 2 6 5.5 M16 5.5a3 3 0 0 1 0 5.5 M18 14.5c1.8.7 2.8 2.6 3 5.5',
};
const icon = name => `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${ICONS[name]}"/></svg>`;

/** Grade affiché sur la carte du joueur, d'après sa carrière. */
export function profileRank(stats) {
  if (stats.wins >= 5) return 'Habitué de l’Élysée';
  if (stats.wins) return 'Élu à l’Élysée';
  if (stats.qualified) return 'Finaliste';
  if (stats.games >= 3) return 'Candidat confirmé';
  if (stats.games) return 'Militant de terrain';
  return 'Nouvel inscrit';
}

export function profileContent(profile) {
  const stats = normalizeStats(profile.stats), favorite = favoriteCandidate(stats);
  const hero = CANDIDATES.find(c => c.id === (favorite || 'melenchon'));
  const ratio = stats.games ? stats.wins / stats.games * 100 : null;
  // [icône, libellé, valeur, jauge en % (facultative)]
  const tiles = [
    ['games', 'Parties jouées', format(stats.games)], ['wins', 'Victoires', format(stats.wins)],
    ['rate', 'Taux de victoire', ratio == null ? '—' : `${format(ratio)} %`, ratio ?? 0],
    ['qualified', 'Qualifications au 2nd tour', format(stats.qualified)],
    ['score', 'Meilleur score au 2nd tour', stats.best_score == null ? '—' : `${format(stats.best_score, 2)} %`, stats.best_score ?? 0],
    ['voters', 'Record d’électeurs', format(stats.best_voters)],
  ];
  const unlocked = profile.unlocked_campaign_styles || {};
  const candidates = CANDIDATES.map(c => {
    const s = stats.by_candidate[c.id], total = CAMPAIGN_STYLES[c.id]?.length || 0, owned = Math.min(total, unlocked[c.id]?.length || 1);
    const star = c.id === favorite ? '<em class="profile-favorite" title="Candidat préféré">★ Préféré</em>' : '';
    return `<article class="profile-candidate${c.id === favorite ? ' is-favorite' : ''}" data-faction="${c.id}"><img src="${portrait(c)}" alt="">
      <div><strong>${c.short}</strong>${star}<span>${format(s.games)} partie${s.games > 1 ? 's' : ''} · ${format(s.wins)} victoire${s.wins > 1 ? 's' : ''}</span>
      <span class="profile-styles" aria-label="${owned} style${owned > 1 ? 's' : ''} de campagne débloqué${owned > 1 ? 's' : ''} sur ${total}">${Array.from({ length: total }, (_, i) => `<i class="${i < owned ? 'is-owned' : ''}"></i>`).join('')}<small>${owned}/${total} styles</small></span></div></article>`;
  }).join('');
  return `<div class="profile-screen">
    <section class="profile-identity" data-faction="${hero.id}">
      <div class="profile-hero"><span class="profile-rank">★ ${profileRank(stats)}</span><img src="${portrait(hero)}" alt=""></div>
      ${profile.account?.username ? `<p class="profile-name profile-account-name">Compte PartageTonJeu<strong>${escape(profile.account.username)}</strong></p>`
        : `<label class="profile-name">Pseudo<input id="profile-nickname" maxlength="${NICKNAME_MAX}" autocomplete="nickname" spellcheck="false" value="${escape(cleanNickname(profile.nickname))}"></label>`}
      <div class="profile-account-actions"></div>
      <p class="menu-note">${favorite ? `Candidat préféré : <strong>${hero.short}</strong>` : 'Jouez une partie complète pour lancer vos statistiques.'}</p>
    </section>
    <section class="profile-stats" aria-label="Statistiques">${tiles.map(([key, label, value, meter], i) =>
      `<p class="profile-stat" data-stat="${key}" style="--delay:${i * 60}ms">${icon(key)}<strong>${value}</strong><span>${label}</span>${meter == null ? '' : `<i class="profile-meter" style="--v:${Math.round(meter)}%" aria-hidden="true"></i>`}</p>`).join('')}</section>
    <section class="profile-candidates" aria-label="Par candidat">${candidates}</section>
    ${isBetatestProfile(profile) && MAP_DECORS.length > 1 ? decorPicker(profile) : ''}
    <p class="profile-note menu-note">${profile.account ? 'Candidats débloqués et classement enregistrés sur ton compte PartageTonJeu, sur tous tes appareils.' : 'Profil enregistré sur cet appareil. Mets un candidat K.-O. en campagne puis termine la partie pour le débloquer.'}</p>
  </div>`;
}
