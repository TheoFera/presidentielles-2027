# Comptes PartageTonJeu

Comptes joueurs reliés au multijoueur en ligne, au classement et à la progression (candidats débloqués).
Le **solo ne demande jamais de compte** : ni au lancement, ni hors ligne.

> **État actuel** : tout le code est en place et testé, mais aucun identifiant Google/Apple n'est encore renseigné.
> Tant que c'est le cas, le jeu publié se comporte **exactement comme avant** (multijoueur ouvert sans compte).
> Le compte devient obligatoire pour le multijoueur dès qu'un moyen de connexion est configuré
> (voir [Ce qu'il reste à configurer](#ce-quil-reste-à-configurer)).
> **Un seul environnement** : un Worker et une base D1 distante `partagetonjeu-comptes` (production), utilisés aussi par
> le jeu lancé sur `localhost` ([Jouer sur l'ordinateur](#jouer-sur-lordinateur-avec-la-production)).

## Architecture

```
Jeu (navigateur / appli Android, plus tard iOS)
  │  1. jeton d'identité signé par Google ou Apple (+ nonce demandé à notre serveur)
  ▼
Worker Cloudflare « presidentielles-2027-salons » (déjà utilisé pour les salons)
  ├─ /salon, /ice      → salons WebRTC + TURN (inchangés, Durable Object « Salons »)
  └─ /api/v1/…         → comptes, sessions, parties, classement, progression
        │  2. vérifie le jeton (signature, émetteur, destinataire, expiration, nonce)
        │  3. crée SA session PartageTonJeu (jeton aléatoire, empreinte en base)
        ▼
     Base Cloudflare D1 « partagetonjeu-comptes » (SQLite)
```

- **Pas de nouveau serveur** : l'API est ajoutée au Worker existant. Les salons (Durable Object) ne changent pas.
- **D1 plutôt que Durable Objects** pour les comptes : données relationnelles (comptes, identités, parties, classement),
  requêtes de classement en SQL, sauvegardes et migrations versionnées. Aucun Durable Object supplémentaire.
- Le **compte PartageTonJeu** a son propre identifiant interne (`u_` + 128 bits aléatoires). Google et Apple ne sont que des
  **identités rattachées** (table `auth_identities`, clé `provider` + `provider_subject`). L'e-mail n'est jamais l'identifiant.

### Fichiers

| Fichier | Rôle |
|---|---|
| `serveur-en-ligne/migrations/0001_comptes.sql` | Schéma D1 (migration versionnée) |
| `serveur-en-ligne/api/router.js` | Routes `/api/v1`, tâche planifiée (cron) |
| `serveur-en-ligne/api/oidc.js`, `providers.js` | Vérification des jetons ; fournisseurs Google et Apple |
| `serveur-en-ligne/api/sessions.js` | Sessions PartageTonJeu |
| `serveur-en-ligne/api/accounts.js` | Comptes, pseudo, liaison, consentement, suppression |
| `serveur-en-ligne/api/matches.js`, `ratings.js` | Parties multijoueur, résultats, Elo, classement |
| `serveur-en-ligne/api/progression.js` | Candidats débloqués, campagnes solo déclarées |
| `serveur-en-ligne/api/apple.js`, `newsletter.js` | Révocation Apple, lien de désinscription |
| `src/simulation/unlock-catalog.js` | Catalogue des candidats à débloquer (partagé jeu/serveur) |
| `src/network/account-config.js` | **Identifiants publics à renseigner** (Google, Apple) |
| `src/network/account-api.js`, `auth-providers.js` | Client de l'API ; boutons Google/Apple ; pont natif |
| `src/network/ranked-match.js` | Lien salon WebRTC ↔ partie classée |
| `src/presentation/account-screens.js`, `account.css` | Écrans (invitation, connexion, pseudo, compte, classement, suppression) |
| `src/presentation/account-progress.js` | Progression du compte ↔ progression de l'appareil |
| `android/app/src/main/java/…/MainActivity.java` | Pont natif « Continuer avec Google » (Credential Manager) |
| `test/accounts.test.js`, `test/d1-memory.js` | Tests (vraies migrations sur SQLite intégré à Node) |

## Base D1

| Table | Contenu |
|---|---|
| `users` | id interne, pseudo, `username_key` (unicité sans casse ni accents), statut (`pending_profile`, `active`, `suspended`, `deleted`), dates |
| `auth_identities` | `user_id`, `provider`, `provider_subject`, e-mail, `email_verified`, `email_is_private_relay` ; unique par (fournisseur, sujet) et par (compte, fournisseur) |
| `sessions` | empreinte SHA-256 du jeton, plateforme, création, dernière utilisation, expiration, révocation |
| `auth_nonces` | nonces à usage unique (connexion, liaison, suppression) |
| `marketing_consents` | **historique** des choix d'e-mails (jamais écrasé) : accordé/refusé, version du texte, source, date |
| `multiplayer_matches` | partie en ligne déclarée : mode, format, classement concerné, statut, classée ou non |
| `match_players` | places de la partie (identifiant du salon WebRTC) ↔ compte, candidat, place finale, Elo avant/après |
| `match_reports` | résultat vu par chaque joueur (un seul par joueur) |
| `player_ratings` | Elo, parties, victoires, défaites, par compte, **classement** (`ladder`) et **saison** (`global` aujourd'hui) |
| `rating_events` | chaque variation d'Elo (historique, futurs classements hebdomadaires/mensuels) |
| `game_runs` | campagnes solo déclarées (preuve minimale pour les déblocages) |
| `player_candidate_unlocks` | candidats débloqués : `candidate_id`, méthode, partie d'origine, date |
| `audit_log` | journal d'enquête : identifiant interne + action, **jamais** d'e-mail, de jeton ni d'IP (1 an) |
| `rate_limits` | compteurs anti-abus (clés IP = empreintes tronquées, effacées à la fin de la fenêtre) |
| vues `newsletter_status`, `newsletter_subscribers` | dernier choix de chaque compte ; liste d'envoi (comptes actifs ayant accepté) |

Prévu pour plus tard sans changer le schéma : saisons/périodes (`season`, `rating_events.created_at`), modes (`ladder`),
modération des pseudos (`users.status`, variable `BLOCKED_USERNAME_TERMS`), autres fournisseurs (`provider`).

### Migrations

Nouvelle migration = nouveau fichier numéroté dans `serveur-en-ligne/migrations/` (ne jamais modifier une migration déjà appliquée).

```bash
cd serveur-en-ligne
```
```bash
npx wrangler d1 migrations list partagetonjeu-comptes --remote
```
```bash
npx wrangler d1 migrations apply partagetonjeu-comptes --remote
```

## Connexion

### Principe (commun à Google et Apple)

1. Le jeu demande un **nonce** au serveur (`POST /api/v1/auth/nonce`, valable 10 min, usage unique).
2. Il obtient de Google ou Apple un **jeton d'identité** contenant ce nonce.
3. `POST /api/v1/auth/google` (ou `/apple`) : le serveur vérifie la signature RS256 avec les clés publiques du fournisseur,
   l'émetteur, le destinataire (nos identifiants client), l'expiration et le nonce, puis consomme le nonce.
4. Identité connue → même compte. Inconnue → **nouveau compte** (statut `pending_profile`) avec les 3 candidats de départ.
5. Le serveur crée une **session PartageTonJeu** et renvoie le profil. Le jeton Google/Apple n'est ni gardé ni réutilisé.

Le serveur n'accepte jamais un e-mail ou un identifiant envoyé tel quel par le jeu.

### Google

- **Navigateur** : bouton officiel Google Identity Services (`accounts.google.com/gsi/client`), en fenêtre.
- **Appli Android** : Google interdit la connexion dans une WebView. L'appli expose `window.PTJNativeAuth`
  (`MainActivity.java`) qui utilise **Credential Manager** (« Se connecter avec Google »). Le jeton est demandé pour le
  client OAuth **Web** (`GOOGLE_WEB_CLIENT_ID`) : c'est ce destinataire que le serveur vérifie.
- **iOS (plus tard)** : SDK Google Sign-In avec `serverClientID` = client Web, appelé par le même pont.

### Sign in with Apple

- Le serveur l'accepte **dès maintenant** (`APPLE_CLIENT_IDS`).
- **Navigateur** : Apple JS (fenêtre), avec un Services ID.
- **iOS (plus tard)** : l'appli iOS fournit le même pont `window.PTJNativeAuth` (`providers()` → `["apple","google"]`,
  `platform()` → `"ios"`, `signIn(...)` puis `window.PTJNativeAuthResult(id, json)`). Le jeu affiche alors
  « Continuer avec Apple » en premier. Nonce : passer `SHA-256(nonce)` à Apple (convention iOS) ; le serveur accepte
  le nonce brut ou son empreinte.
- **Android** : pas d'Apple pour l'instant (faisable plus tard avec un onglet de navigateur sécurisé).
- **E-mail masqué** : l'adresse relais (`…@privaterelay.appleid.com`, domaines extensibles par `APPLE_RELAY_DOMAINS`)
  est enregistrée comme une adresse normale (`email_is_private_relay = 1`). Le jeu ne demande jamais l'adresse réelle.
  Apple n'envoie l'e-mail qu'à la première connexion : il n'est pas effacé ensuite.
- **Suppression du compte sur iOS** : Apple exige de révoquer l'autorisation. Le jeu redemande un code Apple au moment
  de supprimer ; le serveur l'échange puis le révoque (`api/apple.js`, secrets `APPLE_TEAM_ID`, `APPLE_KEY_ID`, `APPLE_PRIVATE_KEY`).

### Liaison de plusieurs identités

Depuis **Mon profil → Mon compte**, un joueur connecté peut lier Google ou Apple (`POST /api/v1/account/link/{fournisseur}`,
nonce de type `link` lié à son compte). **Aucune fusion automatique** par e-mail : une identité déjà utilisée par un autre
compte est refusée (`identity_in_use`). Délier est possible s'il reste un autre moyen de connexion.

## Sessions

- Jeton `ptj_` + 256 bits aléatoires, envoyé en `Authorization: Bearer`. En base : son empreinte SHA-256 seulement.
- Expiration glissante de **60 jours** sans utilisation, durée maximale **180 jours**, prolongée au plus deux fois par jour.
- Révocation : « Se déconnecter », « Déconnecter tous mes appareils », suppression du compte.
- Stockage côté jeu : `localStorage` (`partagetonjeu:session:v1`) — privé à l'application sur Android/iOS.
- **Hors ligne** : la session est conservée, les écrans affichent un message clair, le solo reste disponible.
  Seule une réponse du serveur « session expirée/invalide » efface la session.

## Pseudo

3 à 16 caractères : lettres (accents compris), chiffres, `_`, `-`, `.`, sans espace, au moins une lettre, espaces de début/fin
retirés. Unicité insensible à la casse **et** aux accents (`Élodie` = `elodie`). Noms réservés (`admin`, `partagetonjeu`,
`betatest`…) et termes interdits configurables (`BLOCKED_USERNAME_TERMS`). Un changement par jour au plus.
Le pseudo est demandé juste après la toute première connexion, avec la case des actualités.

## Actualités (newsletter)

Case **facultative, jamais cochée par défaut**, affichée après le pseudo :
« J’accepte de recevoir des informations sur les prochaines créations de PartageTonJeu », avec en dessous
« Vous pourrez vous désinscrire à tout moment. ». Elle est dans la même carte que le pseudo, juste avant « Créer mon compte »,
pour être lue dans la continuité. Elle reste **décochée par défaut** : une case pré-cochée ne vaut pas consentement (RGPD).
Le refus n'empêche rien. Chaque choix ajoute une ligne à `marketing_consents` (version `newsletter-2026-10-v2`, source ;
`v1` = ancien texte).
Se connecter avec Google/Apple **n'est pas** un consentement. Si le texte change : changer la version dans
`serveur-en-ligne/api/accounts.js` **et** `src/network/account-config.js` (un test vérifie qu'elles sont identiques).

- Liste d'envoi : `npx wrangler d1 execute partagetonjeu-comptes --remote --command "SELECT * FROM newsletter_subscribers"`.
- Lien de désinscription signé, à mettre dans chaque e-mail (et en-tête `List-Unsubscribe` + `List-Unsubscribe-Post: List-Unsubscribe=One-Click`) :
  `unsubscribeLink(env, origine, user_id)` dans `api/newsletter.js` → `/api/v1/newsletter/unsubscribe?u=…&t=…`
  (GET : page de confirmation ; POST : désinscription immédiate).
- L'envoi des e-mails lui-même n'est pas mis en place (aucun outil de mailing choisi).

## Progression : candidats débloqués

- **Au départ** : Mélenchon universaliste, Le Pen (style de départ, libellé « Protectionniste ») et Édouard Philippe
  (`melenchon_universaliste`, `le_pen_souverainiste`, `philippe_gestionnaire`).
- **Verrouillés** : les 6 autres styles et les 6 candidats mineurs (en Débat télé). Nouveau style ou nouveau mineur :
  l'ajouter à `src/simulation/unlock-catalog.js` (un test le rappelle s'il manque).
- **Règle** : mettre K.-O. (soi-même ou son camp) un candidat mineur, ou un candidat principal portant un style non débloqué,
  le **note** dans la partie (`state.knockouts`). Il n'est **débloqué qu'à la fin normale** de la campagne (résultats).
  Quitter ou abandonner avant : rien.
- **Compte = source de vérité** : `player_candidate_unlocks`, retrouvé sur tout appareil. Le jeu garde une copie pour l'affichage.
- **Aucune route « débloquer »**. Enregistrement seulement par :
  - une **partie multijoueur confirmée** par les joueurs (K.-O. inclus dans le résultat) ;
  - une **campagne solo déclarée** au lancement (`POST /runs`) puis terminée (`POST /runs/{id}/complete`) : une seule fois,
    après au moins 10 min (une campagne dure environ 15 min), identifiants vérifiés. Une partie où le panneau de débogage
    (F3) a été ouvert n'est pas envoyée.
  - Limite honnête : en solo, le serveur ne voit pas la partie ; un jeu entièrement modifié pourrait encore tricher sur ses
    propres déblocages (pas sur ceux des autres, ni sur le classement).
- **Sans compte** : la progression reste sur l'appareil, comme avant (mise de côté pendant la connexion, retrouvée à la
  déconnexion, jamais importée dans le compte car falsifiable). Le profil « betatest » ne s'applique pas quand on est connecté.

## Multijoueur ↔ compte

Le jeu reste en pair-à-pair (l'hôte simule). Compromis retenu, sans ralentir la partie :

1. Multijoueur → compte obligatoire (invitation → connexion → pseudo → **reprise automatique** de l'action, y compris
   un lien d'invitation `?en-ligne=CODE`). Le mode sans Internet (QR, Wi-Fi) demande aussi un compte, mais n'est jamais classé.
2. **Lancement** (en ligne) : l'hôte déclare la partie (`POST /matches` : mode, format, places du salon) et reçoit
   `match_id` + `join_key`, ajoutés au salon (`room.match`), donc transmis aux invités par la connexion directe chiffrée.
3. Chaque invité rejoint **sa** place (`POST /matches/{id}/join`). Place déjà prise → partie non classée + journal.
   Un candidat de Débat verrouillé pour ce compte (jeu modifié) → partie non classée.
4. **Fin** : chaque joueur envoie l'ordre d'arrivée qu'il a vu (+ K.-O.) — **une seule fois** (`POST /matches/{id}/result`).
   Refusé si la partie est trop courte (campagne < 10 min, débat < 8 s), si le joueur n'est pas dans la partie, ou s'il a déjà envoyé.
5. **Officiel** quand tous les rapports concordent. Désaccord → `disputed`, rien n'est appliqué. Après 15 min (tâche
   planifiée toutes les 10 min) : 2 rapports concordants suffisent ; un rapport seul n'est retenu que s'il ne désigne pas
   son auteur vainqueur ; sinon `void`.
6. Le serveur calcule l'Elo (jamais le jeu) et l'applique dans un lot atomique, protégé contre la double application.

Limite : l'hôte simule la partie ; un hôte au jeu modifié pourrait fausser la partie elle-même (tous les joueurs verraient
alors le même résultat). Le rendre impossible exigerait un serveur qui simule tout, ce qui n'est pas voulu.

## Classement

Un classement Elo **par mode** (`campaign`, `debate`), saison `global`. Formule (dans `api/ratings.js`) :

- ordre d'arrivée entre humains : campagne = élu, finaliste, éliminé au 1er tour ; débat = vainqueur puis K.-O. du dernier
  au premier (l'IA est ignorée) ;
- chaque paire est un duel : `ΔR = K/(N−1) × Σ (S − E)`, `E = 1/(1+10^((Rj−Ri)/400))` ;
- départ à 1 000, `K = 40` les 10 premières parties, puis 24. À deux joueurs, c'est l'Elo classique.

Routes : `GET /leaderboard?ladder=campaign|debate` (public, pseudos seulement), `GET /leaderboard/me` (rang, Elo, parties,
victoires, défaites, taux). Écran : **Mon profil → Classement**.

## Suppression du compte

**Mon profil → Mon compte → Supprimer mon compte…**, confirmation en écrivant `SUPPRIMER` (`DELETE /api/v1/account`).
Effacés : pseudo, identités et e-mails, nonces, consentements, déblocages, classement, historique d'Elo, campagnes solo,
sessions (révoquées). Il reste une ligne `users` **anonyme** (statut `deleted`, sans pseudo) pour que les parties passées
des autres joueurs restent cohérentes (`match_players`, `match_reports` ne contiennent que des identifiants techniques).
Le journal d'enquête ne contient aucune donnée personnelle. Se reconnecter ensuite crée un compte neuf.

## Routes de l'API (`/api/v1`)

| Route | Session | Rôle |
|---|---|---|
| `GET config` | — | fournisseurs actifs, version du consentement |
| `POST auth/nonce` | `login` : non ; `link`/`delete` : oui | nonce à usage unique |
| `POST auth/google`, `auth/apple` | — | connexion → session |
| `POST auth/logout`, `auth/logout-all` | oui | déconnexion |
| `GET me`, `PATCH me` | oui | profil ; pseudo, actualités |
| `GET usernames/check?username=` | oui | disponibilité du pseudo |
| `POST/DELETE account/link/{fournisseur}` | oui | lier / délier |
| `DELETE account` | oui | suppression |
| `GET progression` | oui | candidats débloqués |
| `POST runs`, `POST runs/{id}/complete` | oui (pseudo choisi) | campagne solo |
| `POST matches`, `POST matches/{id}/join`, `POST matches/{id}/result`, `GET matches/{id}` | oui (pseudo choisi) | parties en ligne |
| `GET leaderboard`, `GET leaderboard/me` | — / oui | classement |
| `GET/POST newsletter/unsubscribe` | lien signé | désinscription |

Limitation de débit sur la connexion (30 / 10 min / adresse), la création de comptes (8 / jour / adresse), le pseudo,
les parties et les résultats. Requêtes SQL toutes paramétrées. Erreurs : `{ "error": { "code", "message" } }`.

## Variables et secrets

| Nom | Où | Rôle |
|---|---|---|
| `GOOGLE_WEB_CLIENT_ID` | `src/network/account-config.js` | client OAuth Google **Web** (public) |
| `APPLE_SERVICES_ID`, `APPLE_REDIRECT_URI` | `src/network/account-config.js` | Apple sur le web (public) |
| `GOOGLE_CLIENT_IDS` | `wrangler.toml` `[vars]` | destinataires Google acceptés (client Web, et iOS si besoin) |
| `APPLE_CLIENT_IDS` | idem | Bundle ID iOS et Services ID web |
| `APPLE_RELAY_DOMAINS` | idem | domaines relais Apple |
| `BLOCKED_USERNAME_TERMS` | idem | modération des pseudos |
| `ALLOWED_ORIGINS` | idem | adresses autorisées, dont `http://localhost:2027` |
| `database_id` | `wrangler.toml` `[[d1_databases]]` | base D1 `partagetonjeu-comptes` (renseigné) |
| `NEWSLETTER_UNSUBSCRIBE_SECRET` | secret Wrangler | signature des liens de désinscription |
| `APPLE_TEAM_ID`, `APPLE_KEY_ID`, `APPLE_PRIVATE_KEY` | secrets Wrangler | révocation Apple (iOS) |
| `TURN_KEY_ID`, `TURN_KEY_API_TOKEN` | secrets Wrangler | relais TURN (inchangé) |

Aucun secret dans Git : les identifiants client OAuth sont publics ; les secrets passent par `npx wrangler secret put`.

## Jouer sur l'ordinateur avec la production

Il n'y a pas de base de test : le jeu lancé sur l'ordinateur utilise le **même Worker et la même base** que le jeu publié.

1. `npm start`, puis ouvrir `http://localhost:2027` (sans paramètre). Le jeu appelle
   `https://presidentielles-2027-salons.partagetonjeu.workers.dev` (`ONLINE_SERVER`), qui autorise `http://localhost:2027`
   (`ALLOWED_ORIGINS`).
2. La connexion Google sur `localhost` exige que `http://localhost` et `http://localhost:2027` figurent dans les
   *Origines JavaScript autorisées* du client OAuth Web (voir plus bas).
3. Les comptes, parties et classements créés ainsi sont **réels**. Pour retirer un compte d'essai : Mon profil → Mon compte
   → Supprimer mon compte.
4. Un deuxième joueur sur le même ordinateur : autre navigateur ou fenêtre privée (stockage séparé = autre appareil).

`?serveur-local` (ancien mode de test des salons avec `npx wrangler dev`) n'est pas utilisé pour les comptes : `wrangler dev`
simule une base vide sur l'ordinateur, ce n'est pas la base du jeu.

**Tests automatisés** : `npm run test:comptes` (ou `npm test`). Ils tournent entièrement sur l'ordinateur, avec les vraies
migrations sur une base SQLite en mémoire (`test/d1-memory.js`) et de faux jetons Google/Apple signés : ils n'écrivent
jamais dans la base distante.

## Procédure de déploiement

1. Remplir les valeurs de la [liste ci-dessous](#ce-quil-reste-à-configurer) (secrets, identifiants).
2. Appliquer les migrations : `npx wrangler d1 migrations apply partagetonjeu-comptes --remote`.
3. `npx wrangler deploy`.
4. Vérifier `https://presidentielles-2027-salons.partagetonjeu.workers.dev/api/v1/config` → `providers` contient `google`.
5. **Seulement ensuite** renseigner `GOOGLE_WEB_CLIENT_ID` dans le jeu, puis publier (GitHub Pages) et `npm run android`.
   C'est cette valeur qui rend le compte obligatoire pour le multijoueur.

## Apple Private Relay (e-mails vers les adresses masquées)

Pour que vos e-mails d'actualité atteignent les joueurs ayant choisi « Masquer mon adresse e-mail », Apple doit connaître
vos expéditeurs. Valeurs à **définir vous-même** (rien n'est inventé ici) :

1. **Domaine d'envoi** : le domaine qui enverra les e-mails (par exemple celui de PartageTonJeu, une fois choisi), et
   l'adresse d'expédition (ex. une adresse « actualités@ » de ce domaine).
2. **SPF** : chez votre hébergeur DNS, l'enregistrement TXT SPF fourni par votre service d'envoi d'e-mails
   (Brevo, Mailjet, Amazon SES…), qui autorise ce service à envoyer pour votre domaine.
3. **DKIM** : les enregistrements DNS DKIM fournis par ce même service (clés de signature).
4. **Apple Developer** → Certificates, Identifiers & Profiles → **Services** → *Sign in with Apple for Email Communication*
   → **Configure** : ajouter le **domaine d'envoi** et/ou les **adresses d'expédition**. Apple vérifie le SPF ; le statut doit
   passer au vert. Sans cela, les e-mails envoyés aux adresses `privaterelay.appleid.com` sont rejetés.
5. Chaque e-mail doit contenir le lien de désinscription signé (voir [Actualités](#actualités-newsletter)).

## Ce qu'il reste à configurer

Toutes les commandes Wrangler se lancent dans le dossier `serveur-en-ligne`.

### Cloudflare
1. ~~Créer la base~~ : fait (`partagetonjeu-comptes`, `database_id` renseigné dans `wrangler.toml`).
2. Migrations : `npx wrangler d1 migrations apply partagetonjeu-comptes --remote`.
3. Secret de désinscription (texte aléatoire long) : `npx wrangler secret put NEWSLETTER_UNSUBSCRIBE_SECRET`.
4. Déployer : `npx wrangler deploy`.

### Google Cloud (connexion Google)
1. <https://console.cloud.google.com> → créer un projet (ex. « PartageTonJeu »).
2. **Google Auth Platform** (ou API et services → Écran de consentement OAuth) : nom de l'application, e-mail d'assistance,
   logo, liens vers la politique de confidentialité (`confidentialite.html` publiée) ; accès `openid`, `email`, `profile` ;
   **publier** l'application (sinon seuls les testeurs peuvent se connecter).
3. **Clients → Créer un client → Application Web** (« PartageTonJeu Web ») → *Origines JavaScript autorisées* :
   `https://theofera.github.io`, `http://localhost`, `http://localhost:2027`. Copier l'**ID client** dans :
   - `GOOGLE_WEB_CLIENT_ID` (`src/network/account-config.js`) ;
   - `GOOGLE_CLIENT_IDS` dans `wrangler.toml` (`[vars]`), puis `npx wrangler deploy`.
4. **Créer un client → Android** : nom de paquet `fr.presidentielles2027.jeu` + empreinte **SHA-1** du certificat :
   - appli de test : `keytool -list -v -keystore %USERPROFILE%\.android\debug.keystore -alias androiddebugkey -storepass android` ;
   - Play Store : Play Console → votre appli → *Test et publication → Configuration → Intégrité de l'application*
     (signature d'application) → SHA-1 de la **clé de signature d'application** (et un 2ᵉ client pour la clé d'importation si besoin).
   Ces clients Android ne se recopient nulle part : ils autorisent l'appli à demander un jeton pour le client Web.
5. Plus tard pour iOS : client **iOS** (Bundle ID) ; ajouter son ID à `GOOGLE_CLIENT_IDS` seulement si l'appli iOS demande
   des jetons sans `serverClientID`.

### Apple Developer (Sign in with Apple, quand la version iOS sera prête)
1. Compte Apple Developer Program.
2. Certificates, Identifiers & Profiles → **Identifiers → App IDs** : Bundle ID de l'appli iOS, cocher *Sign in with Apple*.
3. **Identifiers → Services IDs** (pour le web) : ex. un identifiant dérivé du Bundle ID ; activer *Sign in with Apple* →
   *Configure* : App ID principal, **Domaines** `theofera.github.io`, **Return URL** = adresse publique du jeu
   (`https://theofera.github.io/presidentielles-2027/`). Reporter dans `APPLE_SERVICES_ID` et `APPLE_REDIRECT_URI`.
4. `APPLE_CLIENT_IDS` (`wrangler.toml`, `[vars]`) = `Bundle ID,Services ID`.
5. **Keys** → nouvelle clé avec *Sign in with Apple* → télécharger le `.p8` (une seule fois) → secrets :
   `npx wrangler secret put APPLE_TEAM_ID` (Membership → Team ID), `npx wrangler secret put APPLE_KEY_ID`,
   `npx wrangler secret put APPLE_PRIVATE_KEY` (coller tout le contenu du `.p8`).
6. Appli iOS : fournir le pont `window.PTJNativeAuth` (voir [Sign in with Apple](#sign-in-with-apple)), proposer Apple
   puisque Google est proposé (règle App Store 4.8), garder la suppression du compte dans l'appli (règle 5.1.1(v)).
7. E-mails vers les adresses masquées : [Apple Private Relay](#apple-private-relay-e-mails-vers-les-adresses-masquées).

### Jeu et publication
1. Compléter le **responsable du traitement et le contact** dans `confidentialite.html` (commentaire `À COMPLÉTER`).
2. Play Console → *Contenu de l'application → Sécurité des données* : déclarer identifiants (compte), e-mail, données
   de jeu ; suppression du compte possible dans l'appli. Fournir aussi un **lien web de demande de suppression**
   (exigé par Google Play) : par exemple une page expliquant la marche à suivre ou une adresse de contact.
3. `npm run build` (web) et `npm run android` (appli, augmenter `versionCode`).
