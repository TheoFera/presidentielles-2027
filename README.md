# Présidentielle 2027 : Le Jeu

Jeu d'arcade parodique en 2D : trois candidats font campagne sur une carte de France en boucle, convainquent des électeurs, prennent des bâtiments et se battent, jusqu'au second tour. Il se joue dans le navigateur (ordinateur ou téléphone) et existe en application Android.

Le jeu est une **parodie** : personnalités caricaturées, aucune consigne de vote.

## Jouer

| Où | Comment |
|---|---|
| Sur ordinateur | Double-cliquer sur **Lancer le jeu.cmd** (ou `npm start`), puis ouvrir <http://localhost:2027/>. Garder la fenêtre du serveur ouverte. |
| Sur téléphone | Ouvrir le site publié : <https://theofera.github.io/presidentielles-2027/>, de préférence en paysage. |
| Application Android | Voir [android/LISEZMOI.md](android/LISEZMOI.md). |

Node.js 24 ou plus suffit : aucune installation de paquet n'est nécessaire.

### Les modes

L'accueil propose deux modes, chacun **Solo** (contre l'ordinateur) ou **Multijoueur** :

- **Campagne** : la partie complète, décrite ci-dessous.
- **Débat télé** : un combat sur un plateau de télévision, en 1 contre 1 ou à trois, en **3 manches à thème** (Économie, Immigration, Écologie…). Le même candidat peut être choisi deux fois avec des styles différents.

### Les commandes

| Action | Clavier | Écran tactile |
|---|---|---|
| Marcher | ← → (ou Q/D, A/D) | flèches |
| Esquiver (dash) | double appui sur ← ou → | double appui |
| Sauter | ↑ ou Z | Sauter |
| Frapper / coup chargé | Espace ou J ; maintenir 1 s pour charger ; en l'air, coup plongeant | Frapper |
| Ultime (jauge pleine) | R | Ultime |
| Convaincre un électeur | s'arrêter près de lui | idem |
| Acheter un bâtiment, un service | rester devant le panneau de prix | idem |
| Aide et pause | H ou Échap | Pause |
| Plein écran | F | bouton des menus |

En Débat, ↓ fait redescendre d'un pupitre. F3 ouvre le panneau de débogage (voir [docs/verifications.md](docs/verifications.md)).

## Une partie de Campagne

1. **Campagne** : un compte à rebours de jours mène au premier tour. Chaque candidat choisit son **style de campagne** en prenant son premier QG. Il convainc les Neutres, recrute des militants, prend les bâtiments qui contrôlent les sous-zones et se bat contre les rivaux. Des **événements** (rassemblements) apparaissent dans un bandeau télé « EN DIRECT ».
2. **Soirée électorale** : les scores du premier tour s'affichent. Les deux premiers candidats principaux se qualifient.
3. **Second tour** : un sprint de 60 secondes entre les deux finalistes. Le troisième est éliminé et ses électeurs redeviennent Neutres.
4. **Résultats**, puis **Rejouer**.

Les règles détaillées sont dans [docs/regles-du-jeu.md](docs/regles-du-jeu.md).

## Organisation du projet

```text
Presidentielles 2027/
├─ index.html, conditions.html, confidentialite.html   pages du jeu publiées
├─ Lancer le jeu.cmd                    lance le serveur local (jeu + multijoueur Wi-Fi)
├─ src/                                 code du jeu
│  ├─ main.js                           démarrage et boucle du jeu
│  ├─ config.js                         chargement des données de jeu
│  ├─ simulation/                       règles, IA, combat, économie, élections
│  ├─ presentation/                     tout ce qui s'affiche, rangé par rôle :
│  │  ├─ rendu/                         moteur de dessin, chargement et liste des images
│  │  ├─ carte/                         carte plate, bâtiments, meetings, véhicules, billets
│  │  ├─ personnages/                   candidats et habitants : sprites, poses, animations
│  │  ├─ effets/                        coups, ultimes, dégâts, persuasion
│  │  ├─ interface/                     HUD en partie, commandes, son, orientation
│  │  ├─ menus/                         accueil, profil, résultats, publicités
│  │  ├─ debat/                         mode Débat télé
│  │  ├─ multijoueur/                   salons, QR codes
│  │  ├─ comptes/                       écrans des comptes PartageTonJeu
│  │  └─ debogage/                      panneau F3
│  ├─ network/                          multijoueur, comptes, publicités
│  └─ vendor/                           bibliothèques tierces (QR codes) et leurs licences
├─ donnees-jeu/                         les 5 fichiers JSON d'équilibrage et de carte
├─ assets/images/                       toutes les images du jeu (détail ci-dessous)
├─ scripts/                             serveur local, export web, application Android
│  ├─ verifications/                    contrôles dans un vrai navigateur et mesures
│  ├─ outils-images/                    mesures et retouches des planches de sprites
│  └─ lib/                              PNG et conversion WebP
├─ test/                                tests automatiques (npm test)
├─ serveur-en-ligne/                    serveur Cloudflare : salons en ligne et comptes
├─ android/                             projet de l'application Android
└─ docs/                                documentation (liste ci-dessous)
```

Les dossiers `dist/` (export), `.cache/` (conversions WebP) et `tmp/` sont des dossiers de travail recréés au besoin. Les anciens décors, les originaux des images et les anciens documents sont rangés hors du projet, dans le dossier voisin **Presidentielles 2027 - fichiers retirés**.

### Les images

```text
assets/images/
├─ carte/                 les 18 tuiles peintes de la carte (une par sous-zone)
├─ menus/                 fonds de l'accueil et du choix des candidats
├─ debat/                 plateaux du Débat télé et fond du débat
├─ meeting/               estrades et micros de meeting (un par quartier)
├─ vehicules/             vélos, scooters et candidats montés
├─ candidats/<nom>/       sprites et animations de chaque candidat
│  └─ styles/             costumes et animations des styles de campagne
├─ pouvoirs/              ultimes : effets, invocations, transformations
├─ habitants/
│  ├─ neutres/            les 120 électeurs (20 par quartier)
│  └─ militants/          les mêmes électeurs en militants
└─ secondaires/           CRS, service de sécurité, journalistes
```

Comment ajouter ou remplacer une image : [docs/images-et-animations.md](docs/images-et-animations.md).

## Régler le jeu

Les valeurs d'équilibrage sont dans `donnees-jeu/` : modifier un nombre, enregistrer, puis recharger la page. Une sauvegarde faite avec d'autres réglages est refusée : commencer une nouvelle partie.

| Fichier | Contenu |
|---|---|
| `game_balance.json` | durée de la campagne, argent, combat, ultimes, IA, élections, Débat télé |
| `world_layout.json` | quartiers, sous-zones, population maximale, positions de départ |
| `building_catalog.json` | bâtiments, prix et effets |
| `campaign_events.json` | événements de campagne |
| `prototype_config.json` | monde, déplacements, affichage |

## Vérifier et publier

```bash
npm test
```

| Commande | Rôle |
|---|---|
| `npm test` | tous les tests automatiques |
| `npm run test:campagne` | campagnes complètes jouées par l'ordinateur |
| `npm run build` | export web dans `dist/` (images WebP sans perte) |
| `npm run android` / `npm run android:test` | application Android (`.aab` pour le Play Store / `.apk` d'essai) |
| `npm run start:appli` | essayer le contenu de `dist/` sur <http://localhost:2028> |

Envoyer sur la branche `main` publie automatiquement le site sur GitHub Pages, après les tests.

## Documentation

| Document | Sujet |
|---|---|
| [docs/regles-du-jeu.md](docs/regles-du-jeu.md) | carte, bâtiments, combat, styles, candidats, élection, Débat télé |
| [docs/intelligence-artificielle.md](docs/intelligence-artificielle.md) | comportement et réglages de l'ordinateur |
| [docs/multijoueur.md](docs/multijoueur.md) | jouer à plusieurs : en ligne, Wi-Fi par QR, serveur local |
| [docs/comptes-partagetonjeu.md](docs/comptes-partagetonjeu.md) | comptes, déblocages, classement, serveur |
| [docs/publicites.md](docs/publicites.md) | publicités AdMob et AdSense |
| [docs/images-et-animations.md](docs/images-et-animations.md) | images, planches de sprites, tuiles de la carte |
| [docs/export-et-performances.md](docs/export-et-performances.md) | export web et Android, poids, fluidité |
| [docs/verifications.md](docs/verifications.md) | tests, contrôles navigateur, débogage |
| [android/LISEZMOI.md](android/LISEZMOI.md) | construire et publier l'application Android |
| [AGENTS.md](AGENTS.md) | consignes pour les assistants de code |
