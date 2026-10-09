import { CANDIDATES, portrait } from './arcade-content.js';
import { expressedScores } from './election-results.js';
import { CAMPAIGN_STYLES } from '../../simulation/campaign-styles.js';
import { nextTier, ratingTier } from '../../simulation/player-titles.js';
import { DEBATE_CANDIDATES } from '../debat/debate-selection.js';
import { candidateColor, medallionContent, playerCard, portraitFace, titleContent } from './player-card.js';

/* Profil du joueur : pseudo, médaillon (avatar + palier), titre, collection de candidats
   et statistiques (solo sur cet appareil, en ligne sur le compte). */
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

/** Nom affiché : le pseudo du compte PartageTonJeu si le joueur est connecté, sinon celui de l'appareil. */
export const displayName = profile => profile.account?.username || cleanNickname(profile.nickname);
export const profileButton = profile => `<button id="menu-profile" aria-label="Mon profil : ${escape(displayName(profile))}" title="Mon profil">
  ${medallionContent(playerCard(profile), { size: 'sm' })}<span>${escape(displayName(profile))}</span></button>`;

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

/** Collection : une carte par candidat, ses styles à l'intérieur (un losange par style, à toucher pour l'afficher).
    Aucun candidat n'est mis à part : ils sont rangés de la gauche à la droite de l'échiquier politique. */
const COLLECTION_ORDER = ['arthaud', 'roussel', 'melenchon', 'glucksmann', 'attal', 'philippe', 'retailleau', 'dupont_aignan', 'le_pen'];
const COLLECTION = [...DEBATE_CANDIDATES].sort((a, b) => COLLECTION_ORDER.indexOf(a.id) - COLLECTION_ORDER.indexOf(b.id)).map(c => ({ id: c.id, name: c.short, styles: CAMPAIGN_STYLES[c.id]
  ? CAMPAIGN_STYLES[c.id].map(s => ({ id: s.id, detail: s.name.split(' · ')[0] }))
  : [{ id: c.id, detail: '' }] }));
const LADDER_NAMES = { campaign: '★ Campagne', debate: '⚔ Débat télé' };

/** Une carte de candidat, montrant le style `shown` (par défaut : l'avatar s'il est de ce candidat, sinon son premier style débloqué). */
export function collectionCardContent(card, candidateId, shown = null) {
  const candidate = COLLECTION.find(c => c.id === candidateId), owned = new Set(card.unlocks);
  const index = Math.max(0, candidate.styles.findIndex(s => s.id === (shown ?? (candidate.styles.some(x => x.id === card.avatar) ? card.avatar : candidate.styles.find(x => owned.has(x.id))?.id))));
  const style = candidate.styles[index], has = owned.has(style.id), current = card.avatar === style.id, several = candidate.styles.length > 1;
  const ownedCount = candidate.styles.filter(s => owned.has(s.id)).length;
  const label = `${candidate.name}${style.detail ? ` ${style.detail}` : ''}`;
  const help = has ? `${label} : ${current ? 'ton avatar' : 'toucher pour en faire ton avatar'}` : `${label} : mets-le K.-O. en campagne et gagne l’élection pour le débloquer.`;
  return `<div class="collection-card${current ? ' is-avatar' : ''}" data-candidate="${candidate.id}" data-style="${style.id}" ${has ? '' : 'data-locked'} data-hint="${escape(has ? 'Choisir comme avatar' : 'Mettre KO en campagne et gagner l’élection pour débloquer')}" style="--candidate-color:${candidateColor(style.id)}">
    <button type="button" class="collection-pick" data-collection="${style.id}" aria-label="${escape(help)}">${portraitFace(style.id)}${has ? '' : '<span class="collection-lock" aria-hidden="true">🔒</span>'}
      <strong>${escape(candidate.name)}</strong><small>${escape(style.detail) || '&nbsp;'}</small></button>
    <span class="collection-pips" role="group" aria-label="${ownedCount} style${ownedCount > 1 ? 's' : ''} débloqué${ownedCount > 1 ? 's' : ''} sur ${candidate.styles.length}">${candidate.styles.map((s, i) =>
      `<button type="button" class="collection-pip${owned.has(s.id) ? ' is-owned' : ''}" data-show="${s.id}" aria-label="${escape(s.detail || candidate.name)}${owned.has(s.id) ? '' : ' (verrouillé)'}" aria-pressed="${i === index}" ${several ? '' : 'tabindex="-1"'}></button>`).join('')}</span>
    ${current ? '<em>Avatar</em>' : ''}</div>`;
}
/** Progression de la collection : candidats possédés (au moins un style) et styles possédés. */
export function collectionCounts(card) {
  const owned = new Set(card.unlocks), styled = COLLECTION.filter(c => c.styles.length > 1);
  return { candidates: COLLECTION.filter(c => c.styles.some(s => owned.has(s.id))).length, candidateTotal: COLLECTION.length,
    styles: styled.reduce((n, c) => n + c.styles.filter(s => owned.has(s.id)).length, 0), styleTotal: styled.reduce((n, c) => n + c.styles.length, 0) };
}

function collectionContent(card) {
  return `<div class="collection-groups">${COLLECTION.map(c => collectionCardContent(card, c.id)).join('')}</div>`;
}

function soloContent(profile) {
  const stats = normalizeStats(profile.stats), favorite = favoriteCandidate(stats);
  const ratio = stats.games ? stats.wins / stats.games * 100 : null;
  // [icône, libellé, valeur, jauge en % (facultative)]
  const tiles = [
    ['games', 'Parties jouées', format(stats.games)], ['wins', 'Victoires', format(stats.wins)],
    ['rate', 'Taux de victoire', ratio == null ? '—' : `${format(ratio)} %`, ratio ?? 0],
    ['qualified', 'Qualifications au 2nd tour', format(stats.qualified)],
    ['score', 'Meilleur score au 2nd tour', stats.best_score == null ? '—' : `${format(stats.best_score, 2)} %`, stats.best_score ?? 0],
    ['voters', 'Record d’électeurs', format(stats.best_voters)],
  ];
  const candidates = CANDIDATES.map(c => {
    const s = stats.by_candidate[c.id];
    const star = c.id === favorite ? '<em class="profile-favorite" title="Candidat préféré">★ Préféré</em>' : '';
    return `<article class="profile-candidate${c.id === favorite ? ' is-favorite' : ''}" data-faction="${c.id}"><img src="${portrait(c)}" alt="">
      <div><strong>${c.short}</strong>${star}<span>${format(s.games)} partie${s.games > 1 ? 's' : ''} · ${format(s.wins)} victoire${s.wins > 1 ? 's' : ''}</span></div></article>`;
  }).join('');
  return `<section class="profile-stats" aria-label="Statistiques">${tiles.map(([key, label, value, meter], i) =>
      `<p class="profile-stat" data-stat="${key}" style="--delay:${i * 60}ms">${icon(key)}<strong>${value}</strong><span>${label}</span>${meter == null ? '' : `<i class="profile-meter" style="--v:${Math.round(meter)}%" aria-hidden="true"></i>`}</p>`).join('')}</section>
    <section class="profile-candidates" aria-label="Par candidat">${candidates}</section>`;
}

/** Un classement en ligne : Elo, bilan, et barre vers la couleur de cadre suivante (jamais nommée). */
function ladderContent(name, s) {
  if (!s?.games) return '';
  const tier = ratingTier(s.rating), next = nextTier(s.rating);
  // Le palier le plus bas n'a pas de début : la barre part de 150 points sous le suivant.
  const from = next ? Math.max(next.previous, next.from - 150) : 0;
  const progress = next ? Math.max(0, Math.min(100, (s.rating - from) / (next.from - from) * 100)) : 100;
  return `<section class="profile-ladder"><h3>${name}</h3>
    <p class="profile-elo"><strong>${format(s.rating)}</strong><span>Elo</span></p>
    <p class="profile-record">${format(s.wins)} V · ${format(s.losses)} D · ${format(s.wins / s.games * 100)} %</p>
    <div class="tier-track" aria-hidden="true"><span class="tier-swatch" data-tier="${tier}"></span><i style="--v:${Math.round(progress)}%" data-tier="${tier}"></i><span class="tier-swatch" data-tier="${next?.id || tier}"></span></div>
    <p class="menu-note">${next ? `Encore ${format(next.missing)} points pour la couleur de cadre suivante.` : 'Couleur de cadre la plus haute atteinte !'}</p></section>`;
}
function onlineContent(profile) {
  if (!profile.account) return `<p class="profile-hint">Connecte-toi pour jouer en ligne et être classé.</p>`;
  const stats = profile.account.stats || {};
  const ladders = Object.entries(LADDER_NAMES).map(([id, name]) => ladderContent(name, stats[id])).join('');
  return ladders ? `<div class="profile-ladders">${ladders}</div>` : '<p class="menu-note">Pas encore de partie classée.</p>';
}

export const PROFILE_TABS = [['collection', 'Candidats'], ['solo', 'Solo'], ['online', 'Multijoueur']];
export function profileContent(profile, { tab = 'collection' } = {}) {
  const card = playerCard(profile), counts = collectionCounts(card);
  const name = profile.account?.username
    ? `<p class="profile-name profile-account-name"><span class="profile-name-row"><strong>${escape(profile.account.username)}</strong>${titleContent(card)}</span></p>`
    : `<label class="profile-name">Pseudo<span class="profile-name-row"><input id="profile-nickname" maxlength="${NICKNAME_MAX}" autocomplete="nickname" spellcheck="false" value="${escape(cleanNickname(profile.nickname))}">${titleContent(card)}</span></label>`;
  return `<div class="profile-screen">
    <section class="profile-identity">
      ${medallionContent(card, { size: 'lg', label: 'Ton avatar' })}
      <div class="profile-identity-main">${name}
        <div class="collection-progress">
          <p><span>Candidats</span><strong>${counts.candidates} / ${counts.candidateTotal}</strong></p>
          <i class="profile-meter" style="--v:${Math.round(counts.candidates / counts.candidateTotal * 100)}%" aria-hidden="true"></i>
          <p><span>Styles</span><strong>${counts.styles} / ${counts.styleTotal}</strong></p>
          <i class="profile-meter" style="--v:${Math.round(counts.styles / counts.styleTotal * 100)}%" aria-hidden="true"></i></div>
      </div>
      <div class="profile-account-actions"></div>
    </section>
    <div class="profile-tabs" role="tablist">${PROFILE_TABS.map(([id, label]) => `<button type="button" role="tab" id="profile-tab-${id}" data-profile-tab="${id}" aria-controls="profile-panel-${id}" aria-selected="${id === tab}">${label}</button>`).join('')}</div>
    ${PROFILE_TABS.map(([id]) => `<div class="profile-panel profile-${id}" role="tabpanel" id="profile-panel-${id}" aria-labelledby="profile-tab-${id}" ${id === tab ? '' : 'hidden'}>${
      id === 'collection' ? collectionContent(card) : id === 'solo' ? soloContent(profile) : onlineContent(profile)}</div>`).join('')}
  </div>`;
}
