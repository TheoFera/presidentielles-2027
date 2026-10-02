-- Comptes PartageTonJeu, sessions, consentements, matchs, classement et progression.
-- Base Cloudflare D1 (SQLite). Appliquer avec :
--   npx wrangler d1 migrations apply partagetonjeu-comptes --remote          (production)
--   npx wrangler d1 migrations apply partagetonjeu-comptes-dev --env dev --remote
-- Dates : secondes Unix (INTEGER). Identifiants : texte aléatoire non prédictible.

-- Compte PartageTonJeu. Le pseudo n'est jamais l'identifiant technique.
CREATE TABLE users (
  id TEXT PRIMARY KEY,                                   -- « u_ » + 128 bits aléatoires
  username TEXT,                                         -- pseudo affiché ; NULL tant qu'il n'est pas choisi, ou après suppression
  username_key TEXT UNIQUE,                              -- forme comparée (minuscules, sans accents) : unicité insensible à la casse
  status TEXT NOT NULL DEFAULT 'pending_profile'
    CHECK (status IN ('pending_profile', 'active', 'suspended', 'deleted')),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  username_changed_at INTEGER,
  deleted_at INTEGER
);

-- Identités externes rattachées à un compte (Google, Apple, puis d'autres fournisseurs).
-- On identifie la personne par le couple (fournisseur, identifiant du fournisseur), jamais par l'e-mail.
CREATE TABLE auth_identities (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,                                -- 'google', 'apple', 'dev' (développement uniquement)
  provider_subject TEXT NOT NULL,                        -- « sub » du jeton OpenID Connect
  email TEXT,                                            -- e-mail du compte (peut être un relais Apple)
  email_verified INTEGER NOT NULL DEFAULT 0,
  email_is_private_relay INTEGER NOT NULL DEFAULT 0,      -- « Masquer mon adresse e-mail » d'Apple
  created_at INTEGER NOT NULL,
  last_login_at INTEGER NOT NULL,
  UNIQUE (provider, provider_subject),
  UNIQUE (user_id, provider)                             -- une seule identité par fournisseur et par compte
);
CREATE INDEX auth_identities_user ON auth_identities(user_id);

-- Sessions PartageTonJeu. Seule l'empreinte SHA-256 du jeton est stockée.
CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  token_hash TEXT NOT NULL UNIQUE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  platform TEXT NOT NULL DEFAULT 'web',                  -- 'web', 'android', 'ios'
  created_at INTEGER NOT NULL,
  last_seen_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  revoked_at INTEGER
);
CREATE INDEX sessions_user ON sessions(user_id);

-- Nonces à usage unique, liés à chaque connexion Google/Apple (anti-rejeu des jetons).
CREATE TABLE auth_nonces (
  nonce_hash TEXT PRIMARY KEY,
  purpose TEXT NOT NULL CHECK (purpose IN ('login', 'link', 'delete')),
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,   -- renseigné pour une liaison de compte
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);

-- Historique du consentement aux e-mails d'actualité (jamais écrasé).
-- Se connecter avec Google ou Apple n'est PAS un consentement.
CREATE TABLE marketing_consents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  granted INTEGER NOT NULL CHECK (granted IN (0, 1)),
  consent_version TEXT NOT NULL,                         -- version du texte affiché
  source TEXT NOT NULL,                                  -- 'onboarding', 'settings', 'email_unsubscribe'
  created_at INTEGER NOT NULL
);
CREATE INDEX marketing_consents_user ON marketing_consents(user_id, id);

-- Partie multijoueur déclarée au serveur par l'hôte (seules les parties en ligne).
CREATE TABLE multiplayer_matches (
  id TEXT PRIMARY KEY,                                   -- « m_ » + aléatoire
  mode TEXT NOT NULL CHECK (mode IN ('campaign', 'debate')),
  format TEXT NOT NULL,                                  -- 'trio' (campagne), '1v1', '1v1v1' (débat)
  ladder TEXT NOT NULL,                                  -- classement concerné
  host_user_id TEXT NOT NULL REFERENCES users(id),
  join_key_hash TEXT NOT NULL,                           -- clé transmise aux invités par la connexion directe
  status TEXT NOT NULL DEFAULT 'playing'
    CHECK (status IN ('playing', 'finalizing', 'completed', 'disputed', 'void')),
  ranked INTEGER NOT NULL DEFAULT 1,
  void_reason TEXT,
  created_at INTEGER NOT NULL,
  started_at INTEGER NOT NULL,
  completed_at INTEGER,
  result_hash TEXT
);
CREATE INDEX multiplayer_matches_status ON multiplayer_matches(status, started_at);

-- Places d'une partie. « seat » est l'identifiant de joueur du salon WebRTC.
CREATE TABLE match_players (
  match_id TEXT NOT NULL REFERENCES multiplayer_matches(id) ON DELETE CASCADE,
  seat TEXT NOT NULL,
  slot INTEGER NOT NULL,
  user_id TEXT REFERENCES users(id),                     -- NULL tant que le joueur n'a pas rejoint
  faction TEXT NOT NULL,
  style TEXT,
  joined_at INTEGER,
  placement INTEGER,                                     -- 1 = vainqueur
  result TEXT CHECK (result IN ('win', 'loss')),
  rating_before REAL,
  rating_after REAL,
  PRIMARY KEY (match_id, seat),
  UNIQUE (match_id, user_id)
);
CREATE INDEX match_players_user ON match_players(user_id);

-- Résultat vu par chaque joueur. Le résultat officiel exige leur accord.
CREATE TABLE match_reports (
  match_id TEXT NOT NULL REFERENCES multiplayer_matches(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id),
  payload TEXT NOT NULL,                                 -- JSON canonique (places, K.-O.)
  payload_hash TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (match_id, user_id)
);

-- Classement : une ligne par joueur, classement (ladder) et saison.
-- Saison 'global' = classement permanent ; hebdo/mensuel/saisons = autres valeurs plus tard.
CREATE TABLE player_ratings (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  ladder TEXT NOT NULL,
  season TEXT NOT NULL DEFAULT 'global',
  rating REAL NOT NULL DEFAULT 1000,
  games INTEGER NOT NULL DEFAULT 0,
  wins INTEGER NOT NULL DEFAULT 0,
  losses INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, ladder, season)
);
CREATE INDEX player_ratings_board ON player_ratings(ladder, season, rating DESC);

-- Chaque variation de classement (historique, périodes, enquêtes).
CREATE TABLE rating_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  ladder TEXT NOT NULL,
  season TEXT NOT NULL,
  match_id TEXT NOT NULL REFERENCES multiplayer_matches(id),
  placement INTEGER NOT NULL,
  delta REAL NOT NULL,
  rating_after REAL NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX rating_events_user ON rating_events(user_id, created_at);

-- Campagnes solo déclarées au serveur (preuve minimale pour les déblocages).
CREATE TABLE game_runs (
  id TEXT PRIMARY KEY,                                   -- « r_ » + aléatoire
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  mode TEXT NOT NULL CHECK (mode IN ('campaign')),
  faction TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'playing' CHECK (status IN ('playing', 'completed', 'rejected')),
  created_at INTEGER NOT NULL,
  completed_at INTEGER
);
CREATE INDEX game_runs_user ON game_runs(user_id, created_at);

-- Candidats débloqués par compte (le serveur est la source de vérité).
CREATE TABLE player_candidate_unlocks (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  candidate_id TEXT NOT NULL,                            -- identifiant interne (style ou candidat mineur)
  unlock_method TEXT NOT NULL CHECK (unlock_method IN ('default', 'knockout', 'admin')),
  source_match_id TEXT,                                  -- partie multijoueur à l'origine
  source_run_id TEXT,                                    -- ou campagne solo à l'origine
  unlocked_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, candidate_id)
);

-- Journal minimal pour enquêter sur des abus : jamais d'e-mail, de jeton ni d'adresse IP.
CREATE TABLE audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at INTEGER NOT NULL,
  user_id TEXT,
  action TEXT NOT NULL,
  target TEXT,
  detail TEXT
);
CREATE INDEX audit_log_user ON audit_log(user_id, created_at);

-- Compteurs de limitation de débit (fenêtres fixes ; les clés IP sont des empreintes).
CREATE TABLE rate_limits (
  key TEXT PRIMARY KEY,
  count INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);

-- État actuel du consentement de chaque compte (dernier choix enregistré).
CREATE VIEW newsletter_status AS
SELECT c.user_id, c.granted AS newsletter_consent, c.created_at AS newsletter_consent_date,
       c.consent_version AS newsletter_consent_version, c.source
FROM marketing_consents c
WHERE c.id = (SELECT MAX(id) FROM marketing_consents WHERE user_id = c.user_id);

-- Liste d'envoi : comptes actifs ayant accepté, avec l'e-mail de l'identité utilisée en dernier
-- (adresse relais Apple comprise). À lire avec « wrangler d1 execute ».
CREATE VIEW newsletter_subscribers AS
SELECT u.id AS user_id, u.username,
       (SELECT i.email FROM auth_identities i WHERE i.user_id = u.id AND i.email IS NOT NULL
        ORDER BY i.last_login_at DESC LIMIT 1) AS email,
       s.newsletter_consent_date, s.newsletter_consent_version
FROM users u JOIN newsletter_status s ON s.user_id = u.id
WHERE u.status = 'active' AND s.newsletter_consent = 1;
