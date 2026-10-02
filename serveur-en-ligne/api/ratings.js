// Classement Elo multijoueur.
//
// Modes du jeu : campagne (exactement 3 joueurs humains : élu, finaliste, éliminé
// au 1er tour) et débat télé (1 contre 1, ou 1 contre 1 contre 1, avec parfois une IA).
// Une partie donne donc un ORDRE d'arrivée entre 2 ou 3 humains (l'IA est ignorée).
//
// Formule (Elo « multijoueur » par paires) :
//   pour chaque paire (i, j) d'humains : S = 1 si i finit devant j, 0 sinon ;
//   attendu E = 1 / (1 + 10^((Rj − Ri) / 400)) ;
//   ΔRi = K / (N − 1) × Σj (S − E).
// À 2 joueurs, c'est exactement l'Elo classique. À 3, chacun « joue » contre les deux
// autres, avec un K partagé pour qu'une partie à 3 ne pèse pas double.
// K = 40 pendant les 10 premières parties (classement provisoire), puis 24.
// Un classement séparé par mode (ladder) : campagne et débat ne se mélangent pas.

export const INITIAL_RATING = 1000;
export const LADDERS = ['campaign', 'debate'];
export const kFactor = games => games < 10 ? 40 : 24;
export const expectedScore = (rating, opponent) => 1 / (1 + 10 ** ((opponent - rating) / 400));

/** players : [{ id, rating, games, placement }] → Map(id → variation). */
export function eloChanges(players) {
  const changes = new Map();
  const n = players.length;
  if (n < 2) return changes;
  for (const player of players) {
    let sum = 0;
    for (const other of players) {
      if (other === player) continue;
      const score = player.placement < other.placement ? 1 : player.placement > other.placement ? 0 : 0.5;
      sum += score - expectedScore(player.rating, other.rating);
    }
    changes.set(player.id, kFactor(player.games) / (n - 1) * sum);
  }
  return changes;
}

const publicRow = r => ({ rank: r.rank, username: r.username, rating: Math.round(r.rating), games: r.games, wins: r.wins, losses: r.losses,
  win_rate: r.games ? Math.round(r.wins / r.games * 1000) / 10 : 0 });

/** Classement global d'un mode. Seuls les comptes actifs ayant joué au moins une partie classée. */
export async function leaderboard(db, ladder, { limit = 50, offset = 0, season = 'global' } = {}) {
  const rows = await db.prepare(`SELECT ROW_NUMBER() OVER (ORDER BY r.rating DESC, r.wins DESC, r.user_id) AS rank, u.username, r.rating, r.games, r.wins, r.losses, r.user_id
    FROM player_ratings r JOIN users u ON u.id = r.user_id AND u.status = 'active'
    WHERE r.ladder = ? AND r.season = ? AND r.games > 0 ORDER BY rank LIMIT ? OFFSET ?`).bind(ladder, season, limit, offset).all();
  const total = await db.prepare(`SELECT COUNT(*) AS n FROM player_ratings r JOIN users u ON u.id = r.user_id AND u.status = 'active'
    WHERE r.ladder = ? AND r.season = ? AND r.games > 0`).bind(ladder, season).first('n');
  return { ladder, season, total, entries: rows.results.map(r => ({ ...publicRow(r), user_id: r.user_id })) };
}

/** Rang personnel (même ordre que le classement). */
export async function myRank(db, userId, ladder, season = 'global') {
  const me = await db.prepare(`SELECT r.rating, r.games, r.wins, r.losses, u.username FROM player_ratings r JOIN users u ON u.id = r.user_id
    WHERE r.user_id = ? AND r.ladder = ? AND r.season = ?`).bind(userId, ladder, season).first();
  if (!me || !me.games) return { ladder, season, ranked: false, rating: INITIAL_RATING, games: 0, wins: 0, losses: 0, win_rate: 0 };
  const ahead = await db.prepare(`SELECT COUNT(*) AS n FROM player_ratings r JOIN users u ON u.id = r.user_id AND u.status = 'active'
    WHERE r.ladder = ? AND r.season = ? AND r.games > 0 AND (r.rating > ? OR (r.rating = ? AND (r.wins > ? OR (r.wins = ? AND r.user_id < ?))))`)
    .bind(ladder, season, me.rating, me.rating, me.wins, me.wins, userId).first('n');
  return { ...publicRow({ ...me, rank: ahead + 1 }), ladder, season, ranked: true };
}
