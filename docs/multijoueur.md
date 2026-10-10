# Multijoueur

Jusqu'à **trois joueurs**, chacun sur son appareil, en Campagne comme en Débat télé. Les candidats non choisis sont joués par l'ordinateur.

Principe commun : l'appareil qui **crée** la partie (l'hôte) calcule tout le jeu, y compris les IA. Les autres envoient leurs commandes et reçoivent l'état de la partie, en connexion directe (WebRTC). L'hôte doit garder le jeu ouvert et au premier plan : s'il quitte, la partie s'arrête.

Trois façons de se connecter :

| Méthode | Quand | Serveur |
|---|---|---|
| **En ligne, avec un code** (par défaut) | amis à distance, sur des réseaux différents | serveur de salons Cloudflare (`serveur-en-ligne/`) |
| **Même Wi-Fi, par QR codes** | pas d'Internet, appareils côte à côte | aucun |
| **Serveur local** | un ordinateur du Wi-Fi lance le jeu | `scripts/serve.mjs` sur l'ordinateur |

Selon la configuration des comptes, le multijoueur peut demander d'être connecté à un compte PartageTonJeu ; seules les parties en ligne sont classées. Voir [comptes-partagetonjeu.md](comptes-partagetonjeu.md).

## En ligne, avec un code

Dans le jeu : **Multijoueur → Créer** affiche un code de 6 caractères (par exemple `A1B2C3`) et un lien. Les amis tapent le code dans **Rejoindre**, ou ouvrent le lien. Ensuite, chacun choisit son candidat dans le salon et l'hôte lance la partie.

### Comment ça marche

1. **Se trouver** : le serveur de salons (un Worker Cloudflare) fait passer les invitations techniques entre l'hôte et les invités. Il oublie le salon dès que la partie commence et ne voit jamais l'état du jeu.
2. **Se relier** : la connexion est directe la plupart du temps. Sur certains réseaux (4G d'opérateur, Wi-Fi d'entreprise ou d'école), il faut un **relais TURN** Cloudflare, qui transporte les données chiffrées.

| Fichier | Rôle |
|---|---|
| `serveur-en-ligne/signal-hub.js` | logique des salons (code, invitations, reprise de l'hôte), testée par `test/online.test.js` |
| `serveur-en-ligne/worker.js` | serveur Cloudflare : `/` (état), `/ice` (identifiants TURN temporaires), `/salon` (WebSocket), `/api/v1` (comptes) |
| `serveur-en-ligne/wrangler.toml` | configuration du déploiement |
| `src/network/online-config.js` | adresse du serveur et adresse publique du jeu |
| `src/network/online-session.js` | session « en ligne » (la connexion directe, avec les invitations passées par le serveur) |

### Mise en place (une seule fois)

1. Créer un compte gratuit sur <https://dash.cloudflare.com/sign-up>.
2. Dans un terminal, depuis le dossier `serveur-en-ligne` :

```bash
npx wrangler login
```

```bash
npx wrangler deploy
```

   Wrangler affiche une adresse du type `https://presidentielles-2027-salons.VOTRE-NOM.workers.dev`. Ouverte dans le navigateur, elle doit répondre `{"available":true,…}`. Le déploiement demande l'identifiant de la base D1 des comptes dans `wrangler.toml` (voir [comptes-partagetonjeu.md](comptes-partagetonjeu.md)).

3. **Relais TURN** (fortement conseillé) : dans le tableau de bord Cloudflare, **Realtime → TURN Server → Create**, puis enregistrer les deux clés comme secrets (jamais dans le jeu ni dans Git) :

```bash
npx wrangler secret put TURN_KEY_ID
```

```bash
npx wrangler secret put TURN_KEY_API_TOKEN
```

   L'adresse `…workers.dev/ice` doit alors lister des adresses `turn:turn.cloudflare.com…`. Sans TURN, le jeu fonctionne, mais certaines connexions 4G échouent.

4. Dans `src/network/online-config.js`, renseigner `ONLINE_SERVER` (adresse du Worker) et `ONLINE_GAME_URL` (adresse publique du jeu, utilisée par les liens d'invitation, indispensable depuis l'application Android).
5. Conseillé : limiter le serveur au jeu avec `ALLOWED_ORIGINS` dans `wrangler.toml` (site GitHub Pages, `https://appassets.androidplatform.net` pour l'application, `http://localhost:2027` pour les essais), puis redéployer.

### Essayer et surveiller

- Serveur sur l'ordinateur : dans `serveur-en-ligne`, `npx wrangler dev` (adresse `http://localhost:8787`), puis ouvrir `http://localhost:2027/?serveur-local` dans deux onglets.
- Vrai essai : un téléphone en 4G (Wi-Fi coupé) et un autre sur une box. En cas d'échec, vérifier `/ice`.
- Journaux du serveur en direct : `npx wrangler tail`. Consommation TURN : tableau de bord Cloudflare, Realtime → TURN (1 000 Go par mois offerts).

### Limites

- Si l'hôte perd Internet moins d'une minute dans le salon, il retrouve son code ; au-delà, plus personne ne peut entrer.
- Tous les appareils doivent avoir la même version du jeu (sinon : « Les versions du jeu diffèrent »).

## Même Wi-Fi, par QR codes

Lien **« Pas d'Internet ? Jouez sur le même Wi-Fi avec des QR codes »** dans le menu Multijoueur, puis **Entre téléphones · Wi-Fi**. Aucun serveur : les appareils échangent leurs invitations par QR code.

1. L'hôte crée le salon : deux QR s'affichent, un par place (joueur 2 et joueur 3).
2. Chaque ami touche **Scanner un QR**, autorise la caméra et vise une place, puis affiche sa réponse en QR.
3. L'hôte touche **Scanner une réponse** et vise l'écran de l'ami. Les QR défilent : garder le cadre quelques secondes. **Agrandir** aide sur un petit écran.
4. Une fois tout le monde **Connecté**, chacun choisit son candidat ; l'hôte prépare la partie.

- **Sans caméra** : **Copier l'invitation**, puis **Mode texte** chez l'ami pour coller l'invitation (texte commençant par `P27:`) et **Copier la réponse** ; l'hôte colle la réponse dans son **Mode texte**.
- La caméra demande une page en **HTTPS** (site publié) ou `localhost`. Les images de la caméra restent sur l'appareil ; la caméra s'arrête après le scan.
- Un réseau invité qui isole les appareils, un VPN ou un blocage des échanges locaux peut empêcher la liaison. Autoriser l'accès au réseau local si le navigateur le demande.
- Le service STUN public de Google aide à trouver un chemin réseau ; il ne reçoit pas l'état du jeu.

## Serveur local sur un ordinateur

**Lancer le jeu.cmd** ouvre aussi le jeu au réseau local (port 2027 ; Windows peut demander d'autoriser Node.js sur le réseau privé). Dans le menu, choisir **Avec un serveur local** : l'hôte crée un salon et partage l'adresse affichée, les autres l'ouvrent. La fenêtre du serveur doit rester ouverte. `HOST=127.0.0.1` limite le serveur à l'ordinateur.

## Pendant la partie

- Chaque joueur a sa caméra et ses commandes. La pause est partagée ; masquer l'onglet demande une pause.
- Chaque joueur choisit parmi **ses** styles débloqués.
- **Ping** : affiché en haut à droite pendant une partie multijoueur (vert sous 60 ms, orange sous 150 ms, rouge au-delà ; « irrégulier » si les mesures varient de plus de 40 ms). Les appareils s'échangent un signe de vie horodaté chaque seconde (`src/network/peer-session.js`, `networkStats()`).
- **Données envoyées** : l'hôte envoie seulement les champs modifiés de l'état, 15 fois par seconde en Campagne, 30 en Débat (un par pas de simulation). Un invité **n'envoie ses commandes que lorsqu'elles changent**, plus un signe de vie 5 fois par seconde : environ 6 messages par seconde au lieu de 30.
- **Pas numérotés** (`src/network/input-timeline.js`) : chaque invité compte ses pas de simulation. L'hôte range chaque pas reçu sur sa propre ligne du temps (entre deux messages, la direction est supposée inchangée) et renvoie avec chaque état le dernier pas appliqué (`input_acks`). Il cale cette ligne du temps sur le temps d'arrivée médian des messages : une petite marge, sans file d'attente qui s'allonge.
- **Débat : retour en arrière chez l'hôte** (`DebateHost`, `src/network/debate-prediction.js`). Si un pas d'invité arrive en retard (à-coup du réseau), l'hôte revient au tick où il aurait dû être joué et recalcule jusqu'au présent : chaque geste compte au bon moment. Les combattants recalés glissent jusqu'à leur nouvelle place au lieu de sauter.
- **Débat : prédiction chez l'invité** (`DebatePrediction`). Pendant le combat, le téléphone de l'invité fait avancer lui-même le combat à partir du dernier état de l'hôte, en rejouant ses pas pas encore appliqués : ses gestes s'affichent tout de suite. Les combattants joués par l'ordinateur sont prédits à l'identique (l'hôte envoie la graine de leur hasard, `ai_seed`) ; les autres joueurs gardent leur dernière direction. Les sons de ses propres gestes (coup porté, ultime) partent aussi tout de suite, sans être rejoués quand l'hôte les confirme. L'hôte reste l'arbitre : un coup prédit qui n'a pas eu lieu chez lui disparaît.
- **Campagne : prédiction du déplacement** (`src/network/campaign-prediction.js`). Recalculer toute la campagne serait trop lourd pour un téléphone : l'invité prédit seulement le déplacement de son candidat (mêmes règles de vitesse, à pied ou en véhicule). Le reste suit l'hôte à travers un tampon qui garde un léger retard constant (`src/network/snapshot-buffer.js`) ; après une pause ou un arrêt de l'hôte, ce tampon se recale en moins de 2 s.
- **Touche pressée = pas joué aussitôt** (`FixedClock.pull`) : en multijoueur, une action lance le pas suivant sans attendre jusqu'à 33 ms (sauf pour l'hôte en campagne). L'horloge le rattrape ensuite.
- **Corrections lissées** : un écart entre la prédiction et l'hôte s'efface en 0,06 à 0,2 s selon la régularité du réseau ; au-delà de 3 unités (K.-O., nouveau round, téléportation), le candidat est replacé d'un coup.
- **Appli Android** : pendant une partie multijoueur, le Wi-Fi est gardé éveillé (mode « faible latence » d'Android 10 et plus) pour éviter les pointes de ping dues à son économie d'énergie (`PTJNativeNetwork` dans `MainActivity.java`).
- Une déconnexion termine la session avec un message : recharger, puis recréer un salon.

## Vérifier

- `npm run test:multijoueur` : salons, invitations, commandes autorisées, synchronisation, prédiction et retours en arrière avec un réseau simulé (régulier, irrégulier, très mauvais).
- `npm run test:performance-multi` : coût de préparation des messages.
- Contrôles dans un vrai navigateur : `scripts/verifications/validate-arcade-browser.mjs` (parties à 2 et 3 navigateurs) et `validate-qr-browser.mjs` (QR lus par des caméras simulées). Voir [verifications.md](verifications.md).
