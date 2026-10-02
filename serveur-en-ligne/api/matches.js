// Parties multijoueur en ligne liées aux comptes.
//
// Le jeu reste en pair-à-pair (l'hôte simule, les invités affichent) : le serveur ne
// voit pas la partie. Le meilleur compromis retenu, sans alourdir le jeu :
//   1. au lancement, l'hôte déclare la partie (mode, places du salon) → identifiant +
//      clé de partie, transmise aux invités par la connexion directe chiffrée ;
//   2. chaque invité rejoint SA place avec cette clé : le serveur sait quel compte
//      occupe quelle place ;
//   3. en fin de partie, CHAQUE joueur envoie le résultat qu'il a vu (ordre d'arrivée,
//      K.-O. pour les déblocages). Une seule fois par joueur ;
//   4. le résultat n'est officiel que si tous les joueurs concordent (ou, passé un délai,
//      si les rapports reçus concordent et ne profitent pas à leur seul auteur).
//      Désaccord → partie « contestée », rien n'est appliqué, tout est journalisé.
// Le client n'envoie jamais de score ni d'Elo : le serveur les calcule.
import { ApiError, audit, nowSeconds, randomId, randomToken, sha256Hex } from './util.js';
import { STYLE_UNLOCKS, MINOR_UNLOCKS, DEFAULT_UNLOCKED, isUnlockable } from '../../src/simulation/unlock-catalog.js';
import { eloChanges, INITIAL_RATING } from './ratings.js';

export const MATCH_RULES = {
  // Campagne : 365 jours de jeu × 2,5 s ≈ 15 min (game_balance.json), sans accélération en multijoueur.
  campaign: { formats: { trio: [3, 3] }, minSeconds: 600, maxSeconds: 3 * 3600, ladder: 'campaign' },
  // Débat : un combat en une manche (compte à rebours compris).
  debate: { formats: { '1v1': [2, 2], '1v1v1': [2, 3] }, minSeconds: 8, maxSeconds: 3600, ladder: 'debate' },
};
export const REPORT_WINDOW_SECONDS = 15 * 60;
const SEAT = /^[a-f0-9]{16}$/;
const FACTIONS = [...Object.keys(STYLE_UNLOCKS), ...MINOR_UNLOCKS];
const bad = message => new ApiError(400, 'invalid_input', message);

function validateSeats(mode, format, seats) {
  const range = MATCH_RULES[mode].formats[format];
  if (!range) throw bad('Format de partie inconnu.');
  if (!Array.isArray(seats) || seats.length < range[0] || seats.length > range[1]) throw bad('Nombre de joueurs invalide.');
  // Les candidats mineurs n'ont qu'une tenue de base (« glucksmann_standard ») : rangée comme « sans style ».
  const clean = seats.map(s => ({ seat: String(s?.seat ?? ''), slot: s?.slot, faction: String(s?.faction ?? ''), style: s?.style === `${s?.faction}_standard` && MINOR_UNLOCKS.includes(s?.faction) ? null : s?.style ?? null }));
  for (const s of clean) {
    if (!SEAT.test(s.seat) || ![1, 2, 3].includes(s.slot)) throw bad('Place de joueur invalide.');
    if (!FACTIONS.includes(s.faction) || mode === 'campaign' && !STYLE_UNLOCKS[s.faction]) throw bad('Candidat invalide.');
    if (s.style !== null && !(STYLE_UNLOCKS[s.faction] || []).includes(s.style)) throw bad('Style invalide.');
  }
  if (new Set(clean.map(s => s.seat)).size !== clean.length || new Set(clean.map(s => s.slot)).size !== clean.length) throw bad('Places en double.');
  return clean;
}

/** L'hôte déclare la partie au moment du lancement. */
export async function createMatch(db, userId, body, now = nowSeconds()) {
  const mode = body.mode;
  if (!Object.hasOwn(MATCH_RULES, mode)) throw bad('Mode de jeu inconnu.');
  const seats = validateSeats(mode, body.format, body.seats);
  const host = seats.find(s => s.seat === body.host_seat);
  if (!host) throw bad('Place de l’hôte introuvable.');
  const id = randomId('m'), joinKey = randomToken(24);
  await db.batch([
    db.prepare(`INSERT INTO multiplayer_matches (id, mode, format, ladder, host_user_id, join_key_hash, status, ranked, created_at, started_at)
      VALUES (?, ?, ?, ?, ?, ?, 'playing', 1, ?, ?)`).bind(id, mode, body.format, MATCH_RULES[mode].ladder, userId, await sha256Hex(joinKey), now, now),
    ...seats.map(s => db.prepare('INSERT INTO match_players (match_id, seat, slot, user_id, faction, style, joined_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .bind(id, s.seat, s.slot, s === host ? userId : null, s.faction, s.style, s === host ? now : null)),
    audit(db, userId, 'match_created', id, `${mode}/${body.format}/${seats.length}`),
  ]);
  await checkCandidateUnlocked(db, id, mode, host, userId);
  return { match_id: id, join_key: joinKey };
}

// En débat, un candidat verrouillé pour ce compte (client modifié) rend la partie non classée.
async function checkCandidateUnlocked(db, matchId, mode, seat, userId) {
  if (mode !== 'debate') return;
  const candidate = MINOR_UNLOCKS.includes(seat.faction) ? seat.faction : seat.style;
  if (!candidate || DEFAULT_UNLOCKED.includes(candidate)) return;
  const owned = await db.prepare('SELECT 1 AS ok FROM player_candidate_unlocks WHERE user_id = ? AND candidate_id = ?').bind(userId, candidate).first('ok');
  if (!owned) await db.batch([db.prepare('UPDATE multiplayer_matches SET ranked = 0 WHERE id = ?').bind(matchId), audit(db, userId, 'locked_candidate', matchId, candidate)]);
}

async function loadMatch(db, matchId) {
  if (typeof matchId !== 'string' || !/^m_[a-f0-9]{32}$/.test(matchId)) throw new ApiError(404, 'match_not_found', 'Partie introuvable.');
  const match = await db.prepare('SELECT * FROM multiplayer_matches WHERE id = ?').bind(matchId).first();
  if (!match) throw new ApiError(404, 'match_not_found', 'Partie introuvable.');
  const players = (await db.prepare('SELECT * FROM match_players WHERE match_id = ? ORDER BY slot').bind(matchId).all()).results;
  return { match, players };
}

/** Un invité rejoint sa place avec la clé reçue de l'hôte. */
export async function joinMatch(db, userId, matchId, body, now = nowSeconds()) {
  const { match, players } = await loadMatch(db, matchId);
  if (match.status !== 'playing' || now - match.started_at > MATCH_RULES[match.mode].maxSeconds) throw new ApiError(409, 'match_closed', 'Cette partie n’accepte plus de joueurs.');
  if (typeof body.join_key !== 'string' || await sha256Hex(body.join_key) !== match.join_key_hash) {
    await audit(db, userId, 'join_bad_key', matchId).run();
    throw new ApiError(403, 'bad_join_key', 'Clé de partie invalide.');
  }
  const seat = players.find(p => p.seat === body.seat);
  if (!seat) throw new ApiError(404, 'seat_not_found', 'Place introuvable dans cette partie.');
  if (seat.user_id === userId) return { ok: true };
  const mine = players.find(p => p.user_id === userId);
  if (mine) throw new ApiError(409, 'already_seated', 'Vous occupez déjà une autre place dans cette partie.');
  const claimed = await db.prepare('UPDATE match_players SET user_id = ?, joined_at = ? WHERE match_id = ? AND seat = ? AND user_id IS NULL').bind(userId, now, matchId, seat.seat).run();
  if (!claimed.meta.changes) {
    // Place déjà prise par un autre compte : la partie ne comptera pas au classement.
    await db.batch([db.prepare('UPDATE multiplayer_matches SET ranked = 0 WHERE id = ?').bind(matchId), audit(db, userId, 'seat_conflict', matchId, seat.seat)]);
    throw new ApiError(409, 'seat_taken', 'Cette place est déjà occupée par un autre joueur.');
  }
  await audit(db, userId, 'match_joined', matchId).run();
  await checkCandidateUnlocked(db, matchId, match.mode, seat, userId);
  return { ok: true };
}

/** Résultat canonique : même texte pour deux rapports identiques. */
function canonicalReport(players, body) {
  const seats = players.map(p => p.seat);
  const placements = body.placements;
  if (!Array.isArray(placements) || placements.length !== seats.length || new Set(placements).size !== seats.length || placements.some(s => !seats.includes(s))) {
    throw bad('Classement de fin de partie invalide.');
  }
  const knockouts = body.knockouts ?? [];
  if (!Array.isArray(knockouts) || knockouts.length > 40) throw bad('Liste de K.-O. invalide.');
  const keys = new Set();
  for (const k of knockouts) {
    if (!seats.includes(k?.seat) || !isUnlockable(k?.candidate_id)) throw bad('K.-O. invalide.');
    keys.add(`${k.seat}|${k.candidate_id}`);
  }
  return JSON.stringify({ placements, knockouts: [...keys].sort().map(key => { const [seat, candidate_id] = key.split('|'); return { seat, candidate_id }; }) });
}

/** Chaque joueur envoie le résultat qu'il a vu, une seule fois. */
export async function reportResult(db, userId, matchId, body, now = nowSeconds()) {
  const { match, players } = await loadMatch(db, matchId);
  const me = players.find(p => p.user_id === userId);
  if (!me) throw new ApiError(403, 'not_in_match', 'Vous ne faites pas partie de cette partie.');
  const payload = canonicalReport(players, body);
  const hash = await sha256Hex(payload);
  const previous = await db.prepare('SELECT payload_hash FROM match_reports WHERE match_id = ? AND user_id = ?').bind(matchId, userId).first('payload_hash');
  if (previous) {
    if (previous === hash) return matchStatus(db, userId, matchId);
    throw new ApiError(409, 'already_reported', 'Le résultat de cette partie a déjà été enregistré.');
  }
  if (match.status !== 'playing') throw new ApiError(409, 'match_closed', 'Cette partie est déjà terminée.');
  const elapsed = now - match.started_at;
  if (elapsed < MATCH_RULES[match.mode].minSeconds) {
    await audit(db, userId, 'report_too_early', matchId, `${elapsed}s`).run();
    throw new ApiError(422, 'too_early', 'Résultat refusé : la partie est trop courte pour être terminée.');
  }
  if (elapsed > MATCH_RULES[match.mode].maxSeconds + REPORT_WINDOW_SECONDS) throw new ApiError(409, 'match_closed', 'Cette partie a expiré.');
  await db.prepare('INSERT INTO match_reports (match_id, user_id, payload, payload_hash, created_at) VALUES (?, ?, ?, ?, ?)').bind(matchId, userId, payload, hash, now).run();
  await settleMatch(db, matchId, { now });
  return matchStatus(db, userId, matchId);
}

/**
 * Décide du résultat officiel quand c'est possible. `force` : appelé par la tâche
 * planifiée après le délai de rapport.
 */
export async function settleMatch(db, matchId, { now = nowSeconds(), force = false } = {}) {
  const { match, players } = await loadMatch(db, matchId);
  if (match.status !== 'playing') return match.status;
  const reports = (await db.prepare('SELECT user_id, payload, payload_hash, created_at FROM match_reports WHERE match_id = ? ORDER BY created_at').bind(matchId).all()).results;
  const claimed = players.filter(p => p.user_id);
  if (reports.length && new Set(reports.map(r => r.payload_hash)).size > 1) {
    await db.batch([db.prepare('UPDATE multiplayer_matches SET status = \'disputed\', completed_at = ? WHERE id = ? AND status = \'playing\'').bind(now, matchId),
      audit(db, null, 'match_disputed', matchId, `${reports.length} rapports`)]);
    return 'disputed';
  }
  const late = force && (reports.length ? now - reports[0].created_at >= REPORT_WINDOW_SECONDS : now - match.started_at > MATCH_RULES[match.mode].maxSeconds);
  if (reports.length && reports.length === claimed.length) return finalize(db, match, players, JSON.parse(reports[0].payload), reports[0].payload_hash, now);
  if (!late) return 'playing';
  if (reports.length >= 2) return finalize(db, match, players, JSON.parse(reports[0].payload), reports[0].payload_hash, now);
  if (reports.length === 1) {
    // Un seul rapport : crédible seulement s'il ne désigne pas son auteur vainqueur.
    const payload = JSON.parse(reports[0].payload);
    const seat = players.find(p => p.user_id === reports[0].user_id)?.seat;
    if (payload.placements[0] !== seat) return finalize(db, match, players, payload, reports[0].payload_hash, now);
  }
  await db.batch([db.prepare('UPDATE multiplayer_matches SET status = \'void\', void_reason = ?, completed_at = ? WHERE id = ? AND status = \'playing\'')
    .bind(reports.length ? 'unconfirmed' : 'abandoned', now, matchId), audit(db, null, 'match_void', matchId, reports.length ? 'unconfirmed' : 'abandoned')]);
  return 'void';
}

async function finalize(db, match, players, payload, hash, now) {
  // Verrou : une seule exécution applique le résultat, même si deux rapports arrivent ensemble.
  const lock = await db.prepare('UPDATE multiplayer_matches SET status = \'finalizing\', completed_at = ? WHERE id = ? AND status = \'playing\'').bind(now, match.id).run();
  if (!lock.meta.changes) return 'finalizing';
  const placement = new Map(payload.placements.map((seat, i) => [seat, i + 1]));
  const ranked = match.ranked === 1 && players.every(p => p.user_id);
  const statements = [];
  const ratings = new Map();
  let changes = new Map();
  if (ranked) {
    for (const p of players) {
      const row = await db.prepare('SELECT rating, games FROM player_ratings WHERE user_id = ? AND ladder = ? AND season = \'global\'').bind(p.user_id, match.ladder).first();
      ratings.set(p.seat, { id: p.seat, rating: row?.rating ?? INITIAL_RATING, games: row?.games ?? 0, placement: placement.get(p.seat) });
    }
    changes = eloChanges([...ratings.values()]);
    for (const p of players) {
      const before = ratings.get(p.seat), delta = changes.get(p.seat), win = before.placement === 1 ? 1 : 0;
      // Mise à jour relative : sûre même si une autre partie du joueur se termine en même temps.
      statements.push(db.prepare(`INSERT INTO player_ratings (user_id, ladder, season, rating, games, wins, losses, updated_at) VALUES (?, ?, 'global', ?, 1, ?, ?, ?)
        ON CONFLICT(user_id, ladder, season) DO UPDATE SET rating = rating + ?, games = games + 1, wins = wins + ?, losses = losses + ?, updated_at = ?`)
        .bind(p.user_id, match.ladder, INITIAL_RATING + delta, win, 1 - win, now, delta, win, 1 - win, now));
      statements.push(db.prepare('INSERT INTO rating_events (user_id, ladder, season, match_id, placement, delta, rating_after, created_at) VALUES (?, ?, \'global\', ?, ?, ?, ?, ?)')
        .bind(p.user_id, match.ladder, match.id, before.placement, delta, before.rating + delta, now));
    }
  }
  for (const p of players) {
    const before = ratings.get(p.seat);
    statements.push(db.prepare('UPDATE match_players SET placement = ?, result = ?, rating_before = ?, rating_after = ? WHERE match_id = ? AND seat = ?')
      .bind(placement.get(p.seat), placement.get(p.seat) === 1 ? 'win' : 'loss', before?.rating ?? null, before ? before.rating + changes.get(p.seat) : null, match.id, p.seat));
  }
  // Déblocages : seulement maintenant, la partie étant terminée et confirmée.
  for (const k of payload.knockouts) {
    const owner = players.find(p => p.seat === k.seat)?.user_id;
    if (owner) statements.push(db.prepare('INSERT OR IGNORE INTO player_candidate_unlocks (user_id, candidate_id, unlock_method, source_match_id, unlocked_at) VALUES (?, ?, \'knockout\', ?, ?)')
      .bind(owner, k.candidate_id, match.id, now));
  }
  statements.push(db.prepare('UPDATE multiplayer_matches SET status = \'completed\', ranked = ?, completed_at = ?, result_hash = ? WHERE id = ?').bind(ranked ? 1 : 0, now, hash, match.id));
  statements.push(audit(db, null, 'match_completed', match.id, ranked ? 'classée' : 'non classée'));
  try { await db.batch(statements); }
  catch (error) {
    // Le lot est atomique : rien n'a été appliqué, la partie pourra être réglée plus tard.
    await db.prepare('UPDATE multiplayer_matches SET status = \'playing\', completed_at = NULL WHERE id = ? AND status = \'finalizing\'').bind(match.id).run();
    throw error;
  }
  return 'completed';
}

/** État de la partie vu par un participant (pour afficher « classement mis à jour »). */
export async function matchStatus(db, userId, matchId) {
  const { match, players } = await loadMatch(db, matchId);
  const me = players.find(p => p.user_id === userId);
  if (!me) throw new ApiError(403, 'not_in_match', 'Vous ne faites pas partie de cette partie.');
  return { match_id: match.id, mode: match.mode, status: match.status === 'finalizing' ? 'playing' : match.status, ranked: match.ranked === 1,
    me: { placement: me.placement, result: me.result, rating_before: me.rating_before == null ? null : Math.round(me.rating_before), rating_after: me.rating_after == null ? null : Math.round(me.rating_after) } };
}

/** Tâche planifiée : règle les parties dont le délai de rapport est passé. */
export async function settleStaleMatches(db, now = nowSeconds()) {
  const stale = (await db.prepare(`SELECT m.id FROM multiplayer_matches m WHERE m.status = 'playing' AND (m.started_at < ?
    OR EXISTS (SELECT 1 FROM match_reports r WHERE r.match_id = m.id AND r.created_at <= ?)) LIMIT 100`).bind(now - MATCH_RULES.debate.maxSeconds, now - REPORT_WINDOW_SECONDS).all()).results;
  let settled = 0;
  for (const { id } of stale) if (await settleMatch(db, id, { now, force: true }) !== 'playing') settled++;
  // Un verrou resté bloqué (Worker interrompu) est relâché : le lot est atomique, rien n'a été appliqué.
  await db.prepare(`UPDATE multiplayer_matches SET status = 'playing', completed_at = NULL WHERE status = 'finalizing' AND completed_at < ?`).bind(now - 600).run();
  return settled;
}
