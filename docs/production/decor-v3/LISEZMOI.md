# Décor v3 — carte de France en couches

Ce dossier contient tout ce qu’il faut pour produire le nouveau décor avec ChatGPT (ou Codex) puis le brancher dans le jeu sans retoucher le code.

## Ce qui change pour le joueur

Le décor est découpé en plusieurs plans qui défilent à des vitesses différentes, pour créer de la profondeur :

| Plan | Vitesse | Contenu | Qui le dessine |
| --- | --- | --- | --- |
| Ciel | fixe | dégradé selon la saison, nuages | le jeu |
| Lointain | 0,2 | repères du biome : Sacré-Cœur, Stade de France, Mont-Blanc, collines, mer, tour Eiffel et La Défense | 6 images (1 par biome) |
| Plan intermédiaire | 0,45 | toits, butte, canal, basilique de Saint-Denis, éoliennes, plage, Trocadéro | 6 images (1 par biome) |
| Rue jouable | 1 | façades avec les bâtiments du jeu **peints dedans**, place de meeting au centre des sous-zones B | 18 images (1 par sous-zone) |
| Trottoir et chaussée | 1 | pavés, béton, bas-côtés, chemin, promenade, grandes dalles ; neige, feuilles, fleurs | le jeu |
| Arbres | 1 | arbres saisonniers aux emplacements prévus, bosquet à chaque raccord | le jeu |
| Avant-plan | 1,35 | lampadaires, bornes, colonne Morris, panneaux, buissons (devant les personnages) | le jeu |

Il n’y a **aucun fondu** : chaque image de rue couvre exactement sa sous-zone. Ses bords restent bas (haie, muret, planche) et un bosquet dessiné par le jeu cache la couture. Le sol, le trottoir et le ciel sont communs à toute la carte, ce qui rend les raccords continus. Pour les plans de fond, chaque tiers d’image correspond à une sous-zone : un repère placé au centre d’un tiers passe au centre de l’écran quand le joueur est au milieu de cette sous-zone.

Saisons : le jeu teinte chaque plan selon la saison, pose de la neige sur les arêtes des toits en hiver, fait changer les arbres, et ajoute neige, feuilles mortes ou fleurs au sol. Les images n’ont donc besoin que d’une seule version.

## Échelle (zoom de la caméra actuel)

- Une image de rue fait **1536 × 1024 px** et représente une sous-zone (24 unités, soit 64 px par unité).
- Le sol (bas des portes) est à **y = 990**. Un personnage mesure **200 px** et une porte environ **260 px**.
- À l’écran, 1 pixel d’image correspond à peu près à 1 pixel physique : fini le flou des panoramas v2, qui étaient étirés.

## Fichiers

- `maquettes/*-maquette.png` : plan exact en formes plates à joindre à ChatGPT (aucun texte). Les rectangles crème sont les enseignes vierges : le jeu y écrit la fonction et la couleur du propriétaire.
- `maquettes/*-legende.png` : même plan avec la ligne de sol, la règle en unités, une silhouette à l’échelle et le nom de chaque élément.
- `PROMPTS.md` : un prompt complet par image, avec les coordonnées de chaque élément.
- Source unique : `src/presentation/world-v3/spec.js`. Après toute modification : `node scripts/world-v3-export.mjs` régénère les maquettes et les prompts.
- Aperçu en direct : `npm start`, puis `http://localhost:2027/?decor=maquette` (les portes jouables suivent alors celles des maquettes). La page `src/presentation/world-v3/apercu.html` montre toutes les maquettes.
- Captures automatiques du jeu (centres et raccords des 18 sous-zones, saisons, financier) : `node scripts/world-v3-export.mjs captures` (maquettes) ou `captures-final` (images réelles), dans `artifacts/world-v3/`.

## Procédure pour Codex ou ChatGPT

1. Pour chaque image de `PROMPTS.md`, joindre la maquette et les références de style, puis coller le prompt.
2. Enregistrer le résultat sous `assets/generated/world-v3/<nom>.png`. Si le fond n’est pas transparent, un fond **magenta pur #FF00FF** est accepté.
3. Lancer `node scripts/world-v3-calibrate.mjs`. Le script :
   - retire le fond magenta et le halo sombre ;
   - mesure la ligne de sol et retrouve chaque enseigne crème ;
   - écrit `src/presentation/world-v3/calibration.js` ;
   - recale les portes dans `Présidentielles 2027/world_layout.json` ;
   - indique `✗` pour chaque image à refaire, avec la raison.
4. Dès que les 3 rues d’un biome sont validées, ce biome passe au nouveau décor. Si le lointain ou l’intermédiaire manque encore, les anciens fonds de parallaxe servent de secours. Les autres biomes gardent les panoramas v2 provisoires, coupés net et sans fondu.
5. Vérifier avec `node scripts/world-v3-export.mjs captures-final`, puis `npm test`.

## Avis sur les images déjà générées

- **Financiers** (`financier-tech.png`, `financier-russe.png`, `financier-medias.png`) : conservés. Le style correspond à celui des personnages. Les trois poses (discret, contrat, liasse) sont utilisées en jeu. Le léger halo sombre est retiré automatiquement.
- **Rues v3 de Codex** (Paris A, B, C, Banlieue B, C), rangées dans `assets/generated/world-v3/brouillons-codex/` :
  - le style est bon et la composition proche du tableau ;
  - mais l’échelle est trop petite pour le zoom du jeu : les portes seraient moins hautes que les personnages, et la ligne de sol est trop haute ;
  - elles ont aussi un halo sombre autour des bâtiments, et des enseignes crème vierges sur des commerces sans fonction ;
  - le script de calage les rejette. À refaire avec les nouvelles maquettes ; on peut les joindre comme référence d’ambiance.
- **Panoramas v2** (`world-v2/panorama-*.png`) : provisoires. Ils sont trop pixelisés, car une image de 2 172 px est étirée sur 3 sous-zones, et n’ont pas de profondeur. Ils ne respectent pas non plus certains points du tableau : Haussmann à la mer, rond-point au fond, local SO minuscule.
- **Anciens fonds** (`biomes/distant-*`, `biomes/landscape-*`) : bon style, mais sans la mer, le Mont-Blanc ni La Défense. Ils servent seulement de secours.

## Archives

`archives-codex/world-v3-briefs.json` : premières consignes de Codex, remplacées par `spec.js`.
