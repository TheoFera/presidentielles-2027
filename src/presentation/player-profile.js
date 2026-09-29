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

export const profileButton = profile => `<button id="menu-profile" aria-label="Mon profil : ${escape(cleanNickname(profile.nickname))}" title="Mon profil">
  <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="4.2"/><path d="M3.5 21c.8-4.6 4.2-7 8.5-7s7.7 2.4 8.5 7z"/></svg><span>${escape(cleanNickname(profile.nickname))}</span></button>`;

export function profileContent(profile) {
  const stats = normalizeStats(profile.stats), favorite = favoriteCandidate(stats);
  const hero = CANDIDATES.find(c => c.id === (favorite || 'melenchon'));
  const rate = stats.games ? `${format(stats.wins / stats.games * 100)} %` : '—';
  const tiles = [
    ['Parties jouées', format(stats.games)], ['Victoires', format(stats.wins)], ['Taux de victoire', rate],
    ['Qualifications au 2nd tour', format(stats.qualified)],
    ['Meilleur score au 2nd tour', stats.best_score == null ? '—' : `${format(stats.best_score, 2)} %`],
    ['Record d’électeurs', format(stats.best_voters)],
  ];
  const unlocked = profile.unlocked_campaign_styles || {};
  const candidates = CANDIDATES.map(c => {
    const s = stats.by_candidate[c.id], total = CAMPAIGN_STYLES[c.id]?.length || 0, owned = Math.min(total, unlocked[c.id]?.length || 1);
    return `<article class="profile-candidate" data-faction="${c.id}"><img src="${portrait(c)}" alt="">
      <div><strong>${c.short}</strong><span>${format(s.games)} partie${s.games > 1 ? 's' : ''} · ${format(s.wins)} victoire${s.wins > 1 ? 's' : ''}</span>
      <span class="profile-styles" aria-label="${owned} style${owned > 1 ? 's' : ''} de campagne débloqué${owned > 1 ? 's' : ''} sur ${total}">${Array.from({ length: total }, (_, i) => `<i class="${i < owned ? 'is-owned' : ''}"></i>`).join('')}<small>${owned}/${total} styles</small></span></div></article>`;
  }).join('');
  return `<div class="profile-screen">
    <section class="profile-identity">
      <div class="profile-hero"><img src="${portrait(hero)}" alt=""></div>
      <label class="profile-name">Pseudo<input id="profile-nickname" maxlength="${NICKNAME_MAX}" autocomplete="nickname" spellcheck="false" value="${escape(cleanNickname(profile.nickname))}"></label>
      <p class="menu-note">${favorite ? `Candidat préféré : <strong>${hero.short}</strong>` : 'Jouez une partie complète pour lancer vos statistiques.'}</p>
    </section>
    <section class="profile-stats" aria-label="Statistiques">${tiles.map(([label, value]) => `<p><strong>${value}</strong><span>${label}</span></p>`).join('')}</section>
    <section class="profile-candidates" aria-label="Par candidat">${candidates}</section>
    ${isBetatestProfile(profile) ? decorPicker(profile) : ''}
    <p class="profile-note menu-note">Profil enregistré sur cet appareil. De nouveaux skins et tenues seront bientôt à débloquer ici.</p>
  </div>`;
}
