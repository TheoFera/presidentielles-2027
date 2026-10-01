# Économiser le contexte et préparer le mobile

## Pour tes prochains prompts

Le petit fichier `AGENTS.md` à la racine oriente l'assistant vers les bons dossiers. Exemple de prompt :

> Dans le menu de pause, agrandis le bouton Reprendre sur téléphone. Conserve le comportement actuel et vérifie le test concerné.

Décris le résultat attendu et le problème observé ; inutile de joindre tous les fichiers du jeu. `.rgignore` masque les images, rapports et dossiers de compilation dans les recherches courantes. Pour une recherche exceptionnelle : `rg --no-ignore -n "motif" assets`.

## Ce qui est embarqué

| Commande | Résultat |
|---|---|
| `npm run build` | `dist/` : version web complète (GitHub Pages), décors betatest compris |
| `npm run android` | `dist/` version application, puis le fichier Play Store `.aab` |
| `npm run android:test` | idem, avec un `.apk` de test à installer sur un téléphone |
| `npm run start:appli` | sert le contenu de `dist/` sur http://localhost:2028 pour l'essayer |

L'export suit les `<script>`, `<link>` et `import` depuis `index.html` : seuls les fichiers réellement chargés par le jeu sont copiés. Les pages d'outils (storyboard, maquettes), documents, tests, scripts, originaux et captures restent dans le projet et pèsent **zéro octet** dans l'application.

### Images WebP sans perte

Les PNG sont convertis en **WebP sans perte** par `ffmpeg` (`scripts/lib/webp.mjs`). Chaque conversion est vérifiée pixel par pixel : seule la couleur cachée sous des pixels totalement transparents peut changer, ce qui ne se voit jamais. Le 1er octobre 2026, les 435 images de l'application ont aussi été comparées une à une dans Chrome : **aucune différence**. Les chemins `.png` des sources sont remplacés par `.webp` dans les copies de `dist/` ; les sources restent en PNG.

- Les conversions sont gardées dans `.cache/webp/` (ignoré par Git) : la première prend quelques minutes, les suivantes une seconde.
- Sans `ffmpeg`, l'export reste en PNG (plus lourd) et l'indique. `node scripts/build-pages.mjs --png` force le PNG.
- Une nouvelle image doit être référencée par un chemin littéral `assets/generated/catégorie/fichier.png` dans le manifeste, le HTML ou le CSS. Les PNJ (`npc-v2`, `npc-militants`) sont inclus par dossier car le manifeste construit leurs chemins par une boucle.

### Version application

`npm run android` remplace `src/app-build.js` par `APP_BUILD = true` dans `dist/` :

- seul le décor par défaut « biomes » est proposé ; les décors du profil betatest (panoramas world-v2, France peinte, décor v3) et les anciens fonds jamais affichés ne sont pas copiés (liste `APP_EXCLUDED_IMAGES` dans `scripts/build-pages.mjs`) ;
- le bouton plein écran disparaît : l'application est déjà en plein écran et en paysage.

`test/pages.test.js` vérifie qu'aucune image utile au décor par défaut, aux personnages ou au débat n'est exclue.

## Mesures du 1er octobre 2026

| | Avant | Après |
|---|---:|---:|
| Export `dist/` | 286 Mo (PNG, tous décors) | **121 Mo** (WebP, application) |
| Fichier Play Store `.aab` | — | **120 Mo** (limite Google : 200 Mo) |
| Version web complète (tous décors betatest) | 286 Mo | **193 Mo**, malgré les nouveaux décors France peinte |

Le WebP sans perte se décode plus lentement que le PNG : sur ordinateur, l'écran de chargement d'une partie passe d'environ 7,3 s à 8,8 s. La fluidité en partie est identique (16 ms par image). Une version PNG de l'application pèserait 201 Mo, au-delà de la limite d'un paquet Play Store, d'où le choix du WebP. Mesures sur ordinateur, à confirmer sur téléphone.

## Pour les futures évolutions

- Ne jamais modifier `dist/` à la main : il est recréé à chaque export.
- Les originaux haute définition restent dans `assets/generated/masters/`.
- Après une modification de l'export : `node --test test/pages.test.js`, puis `npm run android:test`.
