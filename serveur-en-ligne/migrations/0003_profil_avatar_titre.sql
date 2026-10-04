-- Profil public du joueur : avatar choisi et meilleur titre atteint.
-- avatar : identifiant d'un candidat débloqué (style ou candidat mineur) ; NULL = candidat de départ.
-- title_rank : meilleur titre atteint (0 = aucun). Gardé même si le catalogue s'agrandit.
ALTER TABLE users ADD COLUMN avatar TEXT;
ALTER TABLE users ADD COLUMN title_rank INTEGER NOT NULL DEFAULT 0;
