-- Reprise, une seule fois par compte, des candidats débloqués sur l'appareil avant la connexion.
-- device_import_at : date de cette reprise ; NULL tant qu'elle n'a pas eu lieu.
ALTER TABLE users ADD COLUMN device_import_at INTEGER;

-- Nouvelle méthode de déblocage « device_import » : SQLite ne modifie pas une contrainte CHECK,
-- la table est donc recréée à l'identique (aucune autre table ne la référence).
PRAGMA defer_foreign_keys = true;
CREATE TABLE player_candidate_unlocks_v2 (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  candidate_id TEXT NOT NULL,                            -- identifiant interne (style ou candidat mineur)
  unlock_method TEXT NOT NULL CHECK (unlock_method IN ('default', 'knockout', 'admin', 'device_import')),
  source_match_id TEXT,                                  -- partie multijoueur à l'origine
  source_run_id TEXT,                                    -- ou campagne solo à l'origine
  unlocked_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, candidate_id)
);
INSERT INTO player_candidate_unlocks_v2 (user_id, candidate_id, unlock_method, source_match_id, source_run_id, unlocked_at)
  SELECT user_id, candidate_id, unlock_method, source_match_id, source_run_id, unlocked_at FROM player_candidate_unlocks;
DROP TABLE player_candidate_unlocks;
ALTER TABLE player_candidate_unlocks_v2 RENAME TO player_candidate_unlocks;
PRAGMA defer_foreign_keys = false;
