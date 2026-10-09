# Export, application Android et performances

## Ce qui est exporté

| Commande | Résultat |
|---|---|
| `npm run build` | `dist/` : version web (GitHub Pages) |
| `node scripts/build-pages.mjs --app` | `dist/` : version application, à ouvrir dans Android Studio |
| `npm run android` | version application, puis le fichier `.aab` pour le Play Store |
| `npm run android:test` | idem, avec un `.apk` d'essai à installer sur un téléphone |
| `npm run start:appli` | sert `dist/` sur <http://localhost:2028> pour l'essayer |

L'export part de `index.html` et suit les `<script>`, `<link>` et `import` : seuls les fichiers réellement chargés par le jeu sont copiés, avec les cinq fichiers de `donnees-jeu/`, les pages légales et les licences des bibliothèques. Les documents, tests, scripts et outils ne sont jamais exportés. Ne jamais modifier `dist/` à la main : il est recréé à chaque export.

La version web et l'application contiennent les mêmes fichiers. Dans l'application, `src/app-build.js` est remplacé par `APP_BUILD = true` : cadence d'affichage adaptée au téléphone, plein écran et paysage d'office (le bouton plein écran disparaît).

## Images WebP sans perte

- Les PNG sont convertis en **WebP sans perte** par `ffmpeg` (`scripts/lib/webp.mjs`) ; chaque conversion est vérifiée pixel par pixel. Les sources restent en PNG ; seuls les chemins des copies de `dist/` passent en `.webp`.
- Les conversions sont gardées dans `.cache/webp/` (ignoré par Git), repérées par le contenu de l'image : la première conversion complète prend environ 8 minutes, les suivantes quelques secondes. GitHub Actions garde aussi ce cache.
- Sans `ffmpeg`, l'export reste en PNG (plus lourd) et le signale. `--png` force le PNG.
- La compression **avec perte** (qualité 90, trois fois plus légère) a été essayée le 5 octobre 2026 puis abandonnée : la carte devenait saccadée sur téléphone. Le réglage `APP_WEBP_QUALITY` de `scripts/build-pages.mjs` reste à `null` ; ne le changer qu'après un essai sur téléphone.

Poids actuel (9 octobre 2026) : `dist/` ≈ **130 Mo**, 543 fichiers, dont 128 Mo d'images. La limite d'un paquet Play Store est de 200 Mo.

## Fluidité

Le jeu garde la même qualité d'image partout ; la fluidité repose sur ces choix :

- **Chargement complet avant de jouer** : toutes les images de la partie sont chargées, décodées et envoyées une fois à la carte graphique derrière l'écran de chargement. Une image en erreur propose « Réessayer ».
- **Tuiles de la carte** : les tuiles visibles et leurs voisines sont décodées à l'avance hors du fil du jeu (`createImageBitmap`) et dessinées telles quelles. Pas d'effet de saison à l'écran pour l'instant (aucun filtre de couleur).
- **Images prêtes à dessiner (application)** : `src/presentation/rendu/sprite-bitmaps.js`. La WebView de l'application garde moins d'images décodées que Chrome : elle jetait des planches d'animation et les redécodait en pleine partie (saccades en marchant ou en attaquant). Dans l'application, chaque image est décodée une seule fois hors du fil du jeu et gardée ; les planches des personnages sont réduites à la taille utile (moitié sur un téléphone, rien sur une grande tablette), soit environ 4 fois moins de mémoire, sans perte visible. Les coordonnées des planches restent celles des fichiers d'origine (`naturalWidth`, conversion dans `drawImage`). Une partie demande environ 650 Mo d'images décodées sans cette réduction, environ 250 Mo avec.
- **Rendu** : les images hors du cadre sont ignorées, les textes des enseignes sont gardés en petites images, l'affichage lit l'état vivant de la simulation sans le recopier.
- **Même rythme que le navigateur** : l'application dessine à chaque rafraîchissement de l'écran, comme Chrome. Le régulateur « une image sur deux » (FramePacer) a été retiré : il provoquait des chutes à 30 images par seconde quand le téléphone changeait de fréquence d'écran.
- **Multijoueur** : seuls les champs modifiés de l'état sont envoyés, encodés une seule fois pour tous les invités.

Mesures et réglages propres à l'application : [android/LISEZMOI.md](../android/LISEZMOI.md#fluidité--ce-quil-faut-savoir-mesures-du-5-octobre-2026). Pour juger la fluidité, utiliser la version **release** de l'application, débranchée du câble.

## Vérifier l'export

```bash
node --test test/pages.test.js
```

Ce test construit l'export dans un dossier temporaire et vérifie que toute image du manifeste est présente, que les chemins fonctionnent sous `/presidentielles-2027/` et que les réglages se chargent. Ensuite : `npm run android:test` et un essai sur téléphone.
