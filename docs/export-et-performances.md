# Export, application Android et performances

## Ce qui est exporté

| Commande | Résultat |
|---|---|
| `npm run build` | `dist/` : version web (GitHub Pages) |
| `node scripts/build-pages.mjs --app` | `dist/` : version application, à ouvrir dans Android Studio |
| `npm run android` | version application, puis le fichier `.aab` pour le Play Store |
| `npm run android:test` | idem, avec un `.apk` d'essai à installer sur un téléphone |
| `npm run start:appli` | sert `dist/` sur <http://localhost:2028> pour l'essayer |

Pour le Play Store, la prochaine version est **1.0.4**, avec **`versionCode = 5`**, après la version publiée 1.0.3 (code 4). Le numéro affiché vient de `src/version.js` et le code de `android/app/build.gradle`. La construction finale nécessite `android/keystore.properties` et la clé de téléversement existante ; les secrets restent locaux et exclus de Git. Les notes de mise à jour et la procédure sont dans [le guide Android](../android/LISEZMOI.md#mise-à-jour-104-code-5).

L'export part de `index.html` et suit les `<script>`, `<link>` et `import` : seuls les fichiers réellement chargés par le jeu sont copiés, avec les cinq fichiers de `donnees-jeu/`, les pages légales et les licences des bibliothèques. Les documents, tests, scripts et outils ne sont jamais exportés. Ne jamais modifier `dist/` à la main : il est recréé à chaque export.

La version web et l'application contiennent les mêmes fichiers. Dans l'application, `src/app-build.js` est remplacé par `APP_BUILD = true` : cadence d'affichage adaptée au téléphone, plein écran et paysage d'office (le bouton plein écran disparaît).

Sur iPhone, Safari et les autres navigateurs refusent le plein écran d'une page (seules les vidéos y ont droit). Le seul moyen d'ouvrir le jeu sans barres est de l'ajouter à l'écran d'accueil (Partager → « Sur l'écran d'accueil ») puis de le lancer depuis l'icône. `manifest.webmanifest`, les balises `apple-mobile-web-app-*` de `index.html` et les icônes PNG de `icones/` (non converties en WebP) servent à cela. Ouvert depuis l'icône, le jeu masque son bouton plein écran.

## Images WebP sans perte

- Les PNG sont convertis en **WebP sans perte** par `ffmpeg` (`scripts/lib/webp.mjs`) ; chaque conversion est vérifiée pixel par pixel. Les sources restent en PNG ; seuls les chemins des copies de `dist/` passent en `.webp`.
- Les conversions sont gardées dans `.cache/webp/` (ignoré par Git), repérées par le contenu de l'image : la première conversion complète prend environ 8 minutes, les suivantes quelques secondes. GitHub Actions garde aussi ce cache.
- Sans `ffmpeg`, l'export reste en PNG (plus lourd) et le signale. `--png` force le PNG.
- La compression **avec perte** (qualité 90, trois fois plus légère) a été essayée le 5 octobre 2026 puis abandonnée : la carte devenait saccadée sur téléphone. Le réglage `APP_WEBP_QUALITY` de `scripts/build-pages.mjs` reste à `null` ; ne le changer qu'après un essai sur téléphone.

Poids actuel (9 octobre 2026) : `dist/` ≈ **130 Mo**, 543 fichiers, dont 128 Mo d'images. La limite d'un paquet Play Store est de 200 Mo.

## Fluidité

Le jeu garde la même qualité d'image partout ; la fluidité repose sur ces choix :

- **Portes au repos** : les deux battants du garage demandent 32 bandes de perspective et deux retouches du décor. Ouverts ou fermés, ils sont conservés dans un petit cache borné à 16 images par moteur de rendu, à la résolution physique exacte du canevas : un seul dessin remplace ces 34 appels. Pendant le mouvement, les bandes restent dessinées normalement. Le cache distingue le zoom, l'échelle, l'alignement sur les pixels et les textures ; aucune baisse de résolution. Sur 48 scènes de campagne peuplée dans Chrome, aux rapports de pixels 1 et 2, le seul écart de couleur observé est un arrondi de 1 sur 255 dû à la composition des portes transparentes. Ces mesures ne préjugent pas des FPS sur iPhone.
- **Préparation des personnages visibles** : les PNJ hors écran sont écartés avant le calcul des rangs et le tri de dessin. Les personnages visibles sont répartis en un passage entre estrade, rue et arrivées, dans le même ordre qu'auparavant. L'écartement de la foule continue à prendre toute la population en compte. Les personnages sans effet de transparence évitent la recherche du joueur et réutilisent une échelle constante.
- **Combats et projectiles** : chercher un propriétaire ou une cible par identifiant ne reconstruit plus la liste de tous les combattants. Les tests de portée écartent les personnages éloignés avant les règles de touche et de hauteur ; l'ordre des cibles est conservé. Aucun changement de fréquence de réflexion, de comportement ou d'équilibrage de l'IA. Le contrôle `scripts/verifications/validate-simulation-performance.mjs` compare les empreintes complètes de trois campagnes, tous les 300 pas jusqu'à 6 000 pas par campagne ; une référence JSON peut être passée en argument pour vérifier une optimisation.
- **Chargement complet avant de jouer** : toutes les images de la partie sont chargées, décodées et envoyées une fois à la carte graphique derrière l'écran de chargement. Une image en erreur propose « Réessayer ».
- **Tuiles de la carte** : les tuiles visibles et leurs voisines sont décodées à l'avance hors du fil du jeu (`createImageBitmap`) et dessinées telles quelles. Pas d'effet de saison à l'écran pour l'instant (aucun filtre de couleur).
- **Images prêtes à dessiner (application)** : `src/presentation/rendu/sprite-bitmaps.js`. La WebView de l'application garde moins d'images décodées que Chrome : elle jetait des planches d'animation et les redécodait en pleine partie (saccades en marchant ou en attaquant). Dans l'application, chaque image est décodée une seule fois hors du fil du jeu et gardée ; les planches des personnages sont réduites à la taille utile (moitié sur un téléphone, rien sur une grande tablette), soit environ 4 fois moins de mémoire, sans perte visible. Les coordonnées des planches restent celles des fichiers d'origine (`naturalWidth`, conversion dans `drawImage`). Une partie demande environ 650 Mo d'images décodées sans cette réduction, environ 250 Mo avec.
- **Rendu** : les images hors du cadre sont ignorées, les textes des enseignes sont gardés en petites images, l'affichage lit l'état vivant de la simulation sans le recopier.
- **60 images par seconde dans l'application** (`src/presentation/rendu/frame-cadence.js`) : une image n'est pas dessinée si la précédente date de moins de 10,5 ms (une sur deux à 120 Hz, toutes à 60 ou 90 Hz). Mesuré le 09/10/2026 sur un Redmi Note 13 Pro 5G : la carte graphique de la WebView met environ 8,4 ms par image, intenable à 120 Hz ; Chrome est fluide parce que le téléphone le met à 60 Hz. Résultat sur 45 s de jeu : 234 retards de plus de 25 ms (10,3 s) avant, 15 (0,8 s) après. La règle ne devine pas la fréquence : l'ancien régulateur (FramePacer), qui l'estimait sur 40 images, faisait tomber le jeu à 30 images par seconde quand le téléphone changeait de fréquence.
- **Portraits des candidats** : ils réutilisent les découpes préparées pendant le chargement et sont encodés hors du fil du jeu (`toBlob`) ; un portrait qui apparaissait en pleine partie bloquait le jeu 150 ms.
- **Multijoueur** : seuls les champs modifiés de l'état sont envoyés, encodés une seule fois pour tous les invités.
- **Pas de flou sur les grandes formes** : un flou (`shadowBlur`) sur un grand cercle coûte très cher. L'onde de fin de meeting est donc faite de traits larges et transparents superposés, au même rendu : environ 3 ms par image au lieu de plus de 50 ms (mesuré le 14/10/2026 dans Chrome). Le flou sur une image de personnage (hologrammes, charge) est bon marché : le garder. Une lueur préparée à l'avance s'est même révélée plus lente.
- **Simulation en fin de campagne** : le coût d'un pas triple entre le début et la fin, à cause des calculs qui comparent chaque personnage à tous les autres. `nearestEnemy` teste la distance (une soustraction) avant les règles d'équipe ; la persuasion range les neutres par position et ne regarde que ceux proches de chaque militant. La place de chaque spectateur d'un meeting est calculée une fois par pas pour toute la foule. Avec 200 habitants : `nearestEnemy` passe de 0,9 ms à 0,11 ms par pas, la persuasion de 0,12 à 0,06 ms ; la partie reste identique au résultat près.
- **Voix et rapport de force** : le décompte des voix évite copies et tris (le camp en tête est trouvé en un passage, les habitants sont comptés en une fois par quartier d'origine) et n'est refait en cours de pas que si un événement de campagne est actif (sinon une fois en fin de pas). Le rapport de force entre les camps, demandé par chaque IA, chaque militant et chaque conversion, est calculé une fois par pas. Parties vérifiées identiques par empreinte complète.
- **Fréquence de réflexion de l'IA** (`ai_tactics.think_every_ticks`) : à 3, une IA ne réfléchit qu'une image sur trois quand aucun adversaire n'est en vue, et garde sa direction entre deux ; en combat, adversaire en vue, juste après un coup ou pendant un achat, elle réfléchit à chaque image (le rythme des frappes est calé sur le numéro de l'image : sans cette règle, Le Pen et Philippe ne frappaient plus en premier). Mesuré : −29 % de temps pour l'IA, −18 % au total ; tournoi du 14/10/2026 sur 400 parties : −2,3 ± 2,9 points d'écart de voix, pas de différence sûre. **Laissé à 1** pour l'instant.

Mesures et réglages propres à l'application : [android/LISEZMOI.md](../android/LISEZMOI.md#fluidité--ce-quil-faut-savoir-mesures-du-5-octobre-2026). Pour juger la fluidité, utiliser la version **release** de l'application, débranchée du câble.

## Vérifier l'export

```bash
node --test test/pages.test.js
```

Ce test construit l'export dans un dossier temporaire et vérifie que toute image du manifeste est présente, que les chemins fonctionnent sous `/presidentielles-2027/` et que les réglages se chargent. Ensuite : `npm run android:test` et un essai sur téléphone.
