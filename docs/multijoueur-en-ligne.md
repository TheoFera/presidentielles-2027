# Multijoueur en ligne

Objectif : jouer avec des amis **qui ne sont pas sur le même Wi-Fi**. L’hôte crée un salon, reçoit un code à 6 caractères (ex. `A1B2C3`) et l’envoie ; ses amis tapent le code (ou ouvrent le lien) et la partie démarre comme d’habitude.

## Comment ça marche

Le jeu a déjà une connexion directe entre téléphones (WebRTC) : l’hôte simule la partie, les invités envoient leurs touches et reçoivent l’image du jeu. Sur Internet, deux problèmes se posent :

1. **Se trouver** (la « signalisation ») : chaque téléphone doit recevoir l’invitation technique de l’autre. Sur le même Wi-Fi, ce sont les QR. En ligne, c’est un petit **serveur de salons** qui les fait passer automatiquement.
2. **Traverser les box et la 4G** : la plupart du temps, STUN suffit (connexion directe). Pour environ 10 à 20 % des réseaux (4G d’opérateurs, Wi-Fi d’entreprise ou d’école), il faut un **relais TURN** qui fait transiter les données chiffrées.

```
Hôte ──(1) code, invitation──► Serveur de salons ◄──(1)── Invité
  ▲                          (Cloudflare Worker)            │
  └────────(2) partie en direct (ou via relais TURN)────────┘
```

Le serveur de salons ne voit jamais l’état de la partie : il oublie le salon dès que la partie commence.

## Les options possibles

| Option | Serveur à vous ? | Fiabilité | Coût | Travail |
|---|---|---|---|---|
| **A. WebRTC + salons Cloudflare + TURN Cloudflare** *(fournie, recommandée)* | Un Worker gratuit, sans machine à gérer | Excellente (TURN en secours) | Gratuit ; TURN : 1 000 Go/mois offerts, puis 0,05 $/Go | 15 min de mise en place |
| B. WebRTC sans aucun serveur : envoyer l’invitation `P27:…` par WhatsApp/SMS (le « Mode texte » existant) | Aucun | Moyenne : échoue sans TURN sur beaucoup de 4G ; échange en 2 temps fastidieux | Gratuit | Déjà présent ; il ne manque qu’un TURN |
| C. Signalisation par services publics (PeerJS Cloud, Trystero via Nostr/BitTorrent/MQTT) | Aucun | Dépend de services gratuits sans garantie ; TURN toujours nécessaire | Gratuit | Ajoute une bibliothèque tierce |
| D. Serveur relais central : héberger `scripts/multiplayer-server.mjs` (Render, Fly.io, VPS) | Oui, un serveur Node à maintenir | Excellente, mais toute la partie passe par le serveur (latence +, bande passante importante) | Gratuit avec mise en veille (démarrage lent), sinon 5 €/mois environ | Ajouter CORS, HTTPS, adresse configurable |

**Pourquoi A ?** Elle réutilise tout le code WebRTC existant (même protocole que les QR), n’ajoute aucune dépendance au jeu, ne demande aucune machine allumée, et l’offre gratuite de Cloudflare couvre largement un jeu entre amis (un seul « Durable Object » pour tous les salons : il ne peut pas dépasser le quota quotidien).

## Fichiers ajoutés

| Fichier | Rôle |
|---|---|
| `serveur-en-ligne/signal-hub.js` | Logique des salons (création, code, relais des invitations, reprise de l’hôte). Sans dépendance, testée par `test/online.test.js`. |
| `serveur-en-ligne/worker.js` | Le serveur Cloudflare : routes `/`, `/ice` (identifiants TURN temporaires) et `/salon` (WebSocket). |
| `serveur-en-ligne/wrangler.toml` | Configuration du déploiement Cloudflare. |
| `src/network/online-config.js` | **Les deux adresses à remplir** dans le jeu. |
| `src/network/online-session.js` | Session « En ligne » : la session WebRTC existante, avec les invitations envoyées par le serveur. |
| `src/presentation/multiplayer.js`, `src/main.js` | Choix « En ligne · avec un code » dans le menu, lien `?en-ligne=CODE`. |
| `confidentialite.html` | Paragraphe sur le serveur de salons et le relais. |

## Mise en place pas à pas

### 1. Créer le compte Cloudflare (gratuit)

1. Créez un compte sur <https://dash.cloudflare.com/sign-up>.
2. Dans un terminal, à la racine du projet :

```bash
cd serveur-en-ligne
```

```bash
npx wrangler login
```

(La première fois, `npx` télécharge l’outil Wrangler ; une fenêtre du navigateur s’ouvre pour autoriser l’accès.)

### 2. Déployer le serveur de salons

```bash
npx wrangler deploy
```

À la fin, Wrangler affiche une adresse du type `https://presidentielles-2027-salons.VOTRE-NOM.workers.dev`. Ouvrez-la : vous devez voir `{"available":true,…}`.

### 3. Activer le relais TURN (fortement conseillé)

1. Dans le tableau de bord Cloudflare : **Realtime → TURN Server → Create** (nom : `presidentielles-2027`).
2. Notez le **Turn Token ID** et l’**API Token** affichés.
3. Enregistrez-les comme secrets (ils ne doivent jamais être dans le jeu ni dans Git) :

```bash
npx wrangler secret put TURN_KEY_ID
```

```bash
npx wrangler secret put TURN_KEY_API_TOKEN
```

4. Vérifiez : `https://…workers.dev/ice` doit maintenant lister des adresses `turn:turn.cloudflare.com…`.

Sans cette étape, le jeu fonctionne quand même, mais certaines connexions 4G échoueront.

### 4. Brancher le jeu sur le serveur

Dans `src/network/online-config.js` :

```js
export const ONLINE_SERVER = 'https://presidentielles-2027-salons.VOTRE-NOM.workers.dev';
export const ONLINE_GAME_URL = 'https://theofera.github.io/presidentielles-2027/';
```

`ONLINE_GAME_URL` sert au lien d’invitation (indispensable depuis l’application Android, dont l’adresse interne n’est pas ouvrable par vos amis).

### 5. (Conseillé) Limiter le serveur à votre jeu

Dans `serveur-en-ligne/wrangler.toml` :

```toml
ALLOWED_ORIGINS = "https://theofera.github.io,https://appassets.androidplatform.net,http://localhost:2027"
```

puis redéployez (`npx wrangler deploy`). La 2ᵉ adresse est celle de l’application Android.

### 6. Publier

Commit puis push : GitHub Pages republie le jeu. Pour l’application : `npm run android`.

## Tester

- Tests automatiques (sans réseau) : `npm run test:multijoueur`.
- Serveur local : dans `serveur-en-ligne`, lancez `npx wrangler dev` (adresse `http://localhost:8787`), puis ouvrez le jeu avec `http://localhost:2027/?serveur-local` dans deux onglets.
- Vrai test : un téléphone en 4G (Wi-Fi coupé) et un autre sur une box. Si cela échoue, vérifiez `/ice` (étape 3).
- Journaux du serveur en direct : `npx wrangler tail`.

## Utilisation dans le jeu

Multijoueur → **Connexion : En ligne · avec un code**.

- **Hôte** : « Créer un salon » → le code et le lien s’affichent → envoyez-les.
- **Invité** : tapez le code puis « Rejoindre », ou ouvrez directement le lien reçu.

Le reste (choix des candidats, débat, lancement) est identique au mode Wi-Fi.

## Limites connues

- L’hôte doit garder le jeu au premier plan : s’il quitte, la partie s’arrête (comme en Wi-Fi).
- Si l’hôte perd Internet moins d’une minute dans le salon, il reprend son code automatiquement ; au-delà, les joueurs déjà reliés restent, mais plus personne ne peut entrer.
- Tous les appareils doivent avoir la même version du jeu (message « Les versions du jeu diffèrent » sinon).
- Coût TURN : seules les parties qui ne peuvent pas se connecter en direct passent par le relais. Surveillez la consommation dans le tableau de bord Cloudflare (Realtime → TURN).

## Comptes, classement et parties classées

Le même Worker sert aussi l'API des comptes PartageTonJeu (`/api/v1`, base D1) : compte obligatoire pour le multijoueur
une fois Google/Apple configuré, parties en ligne classées (Elo), candidats débloqués. Voir `docs/comptes-partagetonjeu.md`.
Attention : `npx wrangler deploy` demande désormais l'identifiant de la base D1 dans `wrangler.toml`.
