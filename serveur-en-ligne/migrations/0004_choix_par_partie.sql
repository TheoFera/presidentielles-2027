-- Campagne solo : nombre de candidats déjà enregistrés pour cette partie.
-- Le choix gratuit est enregistré dès le clic, le 2ᵉ (pub récompensée) juste après la pub :
-- une même partie peut donc recevoir deux envois, sans jamais dépasser MAX_RUN_UNLOCKS candidats.
ALTER TABLE game_runs ADD COLUMN picks INTEGER NOT NULL DEFAULT 0;
