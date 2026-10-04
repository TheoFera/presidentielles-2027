-- Choix de l'adresse qui reçoit les actualités, parmi les comptes Google/Apple liés.
-- On retient le fournisseur (pas l'adresse) : l'e-mail reste celui vérifié par Google ou Apple,
-- donc personne ne peut inscrire l'adresse d'un inconnu.
ALTER TABLE users ADD COLUMN newsletter_provider TEXT;   -- NULL : identité utilisée en dernier

DROP VIEW newsletter_subscribers;
-- Liste d'envoi : l'identité choisie d'abord, sinon celle utilisée en dernier (relais Apple compris).
CREATE VIEW newsletter_subscribers AS
SELECT u.id AS user_id, u.username,
       (SELECT i.email FROM auth_identities i WHERE i.user_id = u.id AND i.email IS NOT NULL
        ORDER BY i.provider IS (SELECT c.newsletter_provider FROM users c WHERE c.id = i.user_id) DESC, i.last_login_at DESC LIMIT 1) AS email,
       s.newsletter_consent_date, s.newsletter_consent_version
FROM users u JOIN newsletter_status s ON s.user_id = u.id
WHERE u.status = 'active' AND s.newsletter_consent = 1;
