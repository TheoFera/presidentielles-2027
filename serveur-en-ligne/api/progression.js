// Progression du compte : candidats débloqués.
// Il n'existe AUCUNE route « débloquer tel candidat ». Un déblocage n'est enregistré
// qu'à la fin validée d'une partie :
//   - multijoueur : résultat confirmé par les joueurs (matches.js) ;
//   - campagne solo : partie déclarée au serveur au lancement (game_runs), puis
//     terminée après une durée plausible, une seule fois.
// En solo, le serveur ne voit pas la partie : ces contrôles empêchent les requêtes
// forgées (identifiant inconnu, partie inexistante, trop courte, rejouée), pas un jeu
// entièrement modifié. Voir docs/comptes-partagetonjeu.md.
import { ApiError, audit, nowSeconds, randomId } from './util.js';
import { DEFAULT_UNLOCKED, STYLE_UNLOCKS, isUnlockable } from '../../src/simulation/unlock-catalog.js';

// Campagne solo sans accélération de débogage : 365 jours × 2,5 s ≈ 15 min (+ sprint).
// Le jeu n'envoie pas la fin d'une partie accélérée ; 10 min laissent une marge.
export const SOLO_CAMPAIGN_MIN_SECONDS = 600;
export const SOLO_CAMPAIGN_MAX_SECONDS = 8 * 3600;

export async function listUnlocks(db, userId) {
  const rows = (await db.prepare('SELECT candidate_id FROM player_candidate_unlocks WHERE user_id = ?').bind(userId).all()).results;
  return [...new Set([...DEFAULT_UNLOCKED, ...rows.map(r => r.candidate_id)])];
}

/** Début d'une campagne solo d'un joueur connecté. */
export async function startRun(db, userId, body, now = nowSeconds()) {
  if (body.mode !== 'campaign' || !Object.hasOwn(STYLE_UNLOCKS, body.faction)) throw new ApiError(400, 'invalid_input', 'Partie invalide.');
  const id = randomId('r');
  await db.prepare('INSERT INTO game_runs (id, user_id, mode, faction, status, created_at) VALUES (?, ?, \'campaign\', ?, \'playing\', ?)').bind(id, userId, body.faction, now).run();
  return { run_id: id };
}

/** Fin normale d'une campagne solo : enregistre les candidats mis K.-O. (sans doublon). */
export async function completeRun(db, userId, runId, body, now = nowSeconds()) {
  if (typeof runId !== 'string' || !/^r_[a-f0-9]{32}$/.test(runId)) throw new ApiError(404, 'run_not_found', 'Partie introuvable.');
  const run = await db.prepare('SELECT * FROM game_runs WHERE id = ? AND user_id = ?').bind(runId, userId).first();
  if (!run) throw new ApiError(404, 'run_not_found', 'Partie introuvable.');
  if (run.status !== 'playing') throw new ApiError(409, 'run_closed', 'Cette partie est déjà terminée.');
  const knockouts = body.knockouts ?? [];
  if (!Array.isArray(knockouts) || knockouts.length > 40 || knockouts.some(id => !isUnlockable(id))) {
    await audit(db, userId, 'run_invalid_unlock', runId).run();
    throw new ApiError(400, 'invalid_input', 'Liste de candidats invalide.');
  }
  const elapsed = now - run.created_at;
  if (elapsed < SOLO_CAMPAIGN_MIN_SECONDS || elapsed > SOLO_CAMPAIGN_MAX_SECONDS) {
    await db.batch([db.prepare('UPDATE game_runs SET status = \'rejected\', completed_at = ? WHERE id = ?').bind(now, runId), audit(db, userId, 'run_rejected', runId, `${elapsed}s`)]);
    throw new ApiError(422, 'implausible_run', 'Fin de partie refusée : durée de campagne invalide.');
  }
  // Verrou : une seule fin acceptée, même si la requête est rejouée.
  const closed = await db.prepare('UPDATE game_runs SET status = \'completed\', completed_at = ? WHERE id = ? AND status = \'playing\'').bind(now, runId).run();
  if (!closed.meta.changes) throw new ApiError(409, 'run_closed', 'Cette partie est déjà terminée.');
  const before = await listUnlocks(db, userId);
  const wanted = [...new Set(knockouts)];
  if (wanted.length) await db.batch(wanted.map(id => db.prepare('INSERT OR IGNORE INTO player_candidate_unlocks (user_id, candidate_id, unlock_method, source_run_id, unlocked_at) VALUES (?, ?, \'knockout\', ?, ?)').bind(userId, id, runId, now)));
  return { unlocked: wanted.filter(id => !before.includes(id)), unlocks: await listUnlocks(db, userId) };
}
