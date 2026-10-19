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
import { DEFAULT_UNLOCKED, MAX_RUN_UNLOCKS, RUN_FOLLOW_UP_SECONDS, STYLE_UNLOCKS, campaignMinSeconds, isUnlockable } from '../../src/simulation/unlock-catalog.js';
import { titleRank } from '../../src/simulation/player-titles.js';

import balance from '../../donnees-jeu/game_balance.json' with { type: 'json' };

// Durée minimale lue dans les données du jeu (75 % de 365 jours × durée d'un jour) : le seuil suit tout
// changement de durée. Le jeu fait le même calcul et ne propose pas de pub si la partie serait refusée.
export const SOLO_CAMPAIGN_MIN_SECONDS = campaignMinSeconds(balance.time);
export const SOLO_CAMPAIGN_MAX_SECONDS = 8 * 3600;

export async function listUnlocks(db, userId) {
  const rows = (await db.prepare('SELECT candidate_id FROM player_candidate_unlocks WHERE user_id = ?').bind(userId).all()).results;
  return [...new Set([...DEFAULT_UNLOCKED, ...rows.map(r => r.candidate_id)])];
}

/** Après un déblocage : retient le meilleur titre atteint (il n'est jamais perdu). */
export async function updateTitleRank(db, userId) {
  const rank = titleRank(await listUnlocks(db, userId));
  await db.prepare('UPDATE users SET title_rank = MAX(title_rank, ?) WHERE id = ?').bind(rank, userId).run();
}

/** Début d'une campagne solo d'un joueur connecté. */
export async function startRun(db, userId, body, now = nowSeconds()) {
  if (body.mode !== 'campaign' || !Object.hasOwn(STYLE_UNLOCKS, body.faction)) throw new ApiError(400, 'invalid_input', 'Partie invalide.');
  const id = randomId('r');
  await db.prepare('INSERT INTO game_runs (id, user_id, mode, faction, status, created_at) VALUES (?, ?, \'campaign\', ?, \'playing\', ?)').bind(id, userId, body.faction, now).run();
  return { run_id: id };
}

/**
 * Fin normale d'une campagne solo : enregistre les candidats CHOISIS par le joueur parmi ceux qu'il a mis K.-O.
 * (1 gratuit en cas de victoire, +1 avec une pub récompensée ; 1 avec une pub en cas de défaite).
 * Chaque choix est envoyé dès qu'il est fait : le 1er envoi termine la partie (durée vérifiée), un 2ᵉ envoi
 * est accepté dans les RUN_FOLLOW_UP_SECONDS qui suivent. Au plus MAX_RUN_UNLOCKS candidats par partie au total.
 */
export async function completeRun(db, userId, runId, body, now = nowSeconds()) {
  if (typeof runId !== 'string' || !/^r_[a-f0-9]{32}$/.test(runId)) throw new ApiError(404, 'run_not_found', 'Partie introuvable.');
  const run = await db.prepare('SELECT * FROM game_runs WHERE id = ? AND user_id = ?').bind(runId, userId).first();
  if (!run) throw new ApiError(404, 'run_not_found', 'Partie introuvable.');
  const knockouts = body.knockouts ?? [];
  if (!Array.isArray(knockouts) || knockouts.length > 40 || knockouts.some(id => !isUnlockable(id))) {
    await audit(db, userId, 'run_invalid_unlock', runId).run();
    throw new ApiError(400, 'invalid_input', 'Liste de candidats invalide.');
  }
  const picks = run.picks || 0;
  const followUp = run.status === 'completed' && picks < MAX_RUN_UNLOCKS && now - run.completed_at <= RUN_FOLLOW_UP_SECONDS;
  if (run.status !== 'playing' && !followUp) throw new ApiError(409, 'run_closed', 'Cette partie est déjà terminée.');
  if (run.status === 'playing') {
    const elapsed = now - run.created_at;
    if (elapsed < SOLO_CAMPAIGN_MIN_SECONDS || elapsed > SOLO_CAMPAIGN_MAX_SECONDS) {
      await db.batch([db.prepare('UPDATE game_runs SET status = \'rejected\', completed_at = ? WHERE id = ?').bind(now, runId), audit(db, userId, 'run_rejected', runId, `${elapsed}s`)]);
      throw new ApiError(422, 'implausible_run', 'Fin de partie refusée : durée de campagne invalide.');
    }
  }
  const before = await listUnlocks(db, userId);
  const chosen = [...new Set(knockouts)];
  const wanted = chosen.slice(0, MAX_RUN_UNLOCKS - picks);
  if (chosen.length > wanted.length) await audit(db, userId, 'run_too_many_unlocks', runId, `${picks + chosen.length}`).run();
  // Verrou : chaque envoi part de l'état lu ci-dessus ; une requête rejouée ou simultanée ne compte qu'une fois.
  const closed = await db.prepare('UPDATE game_runs SET status = \'completed\', completed_at = COALESCE(completed_at, ?), picks = ? WHERE id = ? AND status = ? AND picks = ?')
    .bind(now, picks + wanted.length, runId, run.status, picks).run();
  if (!closed.meta.changes) throw new ApiError(409, 'run_closed', 'Cette partie est déjà terminée.');
  if (wanted.length) await db.batch(wanted.map(id => db.prepare('INSERT OR IGNORE INTO player_candidate_unlocks (user_id, candidate_id, unlock_method, source_run_id, unlocked_at) VALUES (?, ?, \'knockout\', ?, ?)').bind(userId, id, runId, now)));
  if (wanted.length) await updateTitleRank(db, userId);
  return { unlocked: wanted.filter(id => !before.includes(id)), unlocks: await listUnlocks(db, userId) };
}
