# Cahier des charges du décor — sans parallaxe

Présidentielles 2027 — la carte de France de la campagne

Version du 4 octobre 2026 · variante à tester : un seul plan peint, sans parallaxe, la profondeur vient du dessin · accompagné du storyboard (photos de référence, extraits des panoramas world-v2 et des anciens fonds)

> **Version texte pour Codex**, tirée de `../cahier-des-charges-decor-sans-parallaxe.html` (même contenu, photos à part). Les gabarits sont dans `gabarits/`, les photos de référence dans `photos/`, rangées par sous-zone. Les photos servent uniquement de références visuelles : elles ne sont jamais copiées dans le jeu.

## 1. Intention

Le décor est une fresque de la France, presque anthropologique et sociologique, dans le style cartoon satirique du jeu. En traversant la carte, le joueur doit sentir qu’il se balade en France.

On doit percevoir les ruptures entre territoires : de bâti, de mode de vie, de paysage, de relief et de sociologie. Paris dense et commerçant, les cités dortoirs, les lotissements et les zones commerciales, les vallées industrielles au pied des Alpes, la campagne agricole qui se vide, les pavillons de retraités et le front de mer, la banlieue bourgeoise, les beaux quartiers.

Les bâtiments interactifs du jeu sont pleinement intégrés au premier plan. Le décor a de la vie et de la profondeur. Cette profondeur vient du dessin lui-même (perspective, lointain bleuté), et non de plans séparés qui défilent à des vitesses différentes.

## 2. La carte

La carte est une boucle de 18 sous-zones, parcourues de gauche à droite : 6 biomes de 3 sous-zones (A, B, C). Après Quartiers riches C, on revient à Paris A sans raccord visible.

Ordre : Paris (19e) → Banlieue → Périurbain / Usine → Campagne → Retraités → Quartiers riches → retour à Paris.

Une place de meeting occupe le centre de chaque sous-zone B. Elle reste libre de tout bâtiment, et l’estrade y est posée par le jeu.

Six candidats mineurs ont leur QG dans une permanence : Glucksmann (Paris A), Roussel (Paris C), Arthaud (Périurbain A), Dupont-Aignan (Périurbain C), Retailleau (Retraités A), Attal (Retraités C).

## 3. Échelle et cadrage (règles chiffrées)

- Une sous-zone mesure 24 unités de jeu et occupe 1,25 largeur d’écran : zoom 1 et cadrage 1,25. C’est l’échelle d’origine du jeu. Ne jamais compenser un décor mal proportionné par le zoom.
- Un personnage mesure environ 15 % de la hauteur de l’écran, soit 81 px sur un écran de référence de 540 px de haut, ce qui donne environ 2 unités de jeu.
- Le décor est à l’échelle des personnages : une porte fait environ 1,15 fois la hauteur d’un personnage (≈ 92 px), un étage courant environ 84 px, un rez-de-chaussée commerçant environ 128 px. Les portes immenses sont interdites.
- Tout le décor est parfaitement proportionné par rapport aux personnages, candidats comme PNJ (environ 2 unités de haut) : portes, fenêtres, étages, marches, bancs, clôtures, étals, arbres et objets du quotidien. Un personnage posé devant une façade doit paraître à sa taille réelle, ni nain ni géant. Les éléments lointains rapetissent selon la perspective, mais tout ce qui est au niveau du trottoir est à l’échelle exacte des personnages.
- Sur un écran plus haut (tablette), personnages et décor grandissent ensemble. Les proportions restent identiques.
- Le gameplay est identique quel que soit le décor : même carte, mêmes positions de bâtiments, même zoom.

## 4. L’objectif : une fresque peinte d’un seul plan

Le décor idéal reprend le meilleur des décors déjà faits pour le jeu, mais en un seul plan. Ces trois exigences sont indissociables :

- LE STYLE GRAPHIQUE des panoramas world-v2 (dossier assets/generated/world-v2). C’est le style parfait, la référence absolue : peinture cartoon riche et détaillée, couleurs chaudes, lumière douce, végétation généreuse, bâtiments pleins de caractère et intégrés dans leur quartier, beaucoup de vie.
- LA PROFONDEUR PEINTE : la perspective est dans l’image. Ciel, horizon, lointain et rue sont peints ensemble, dans une seule image qui défile à la vitesse du joueur. Pas de couches séparées, pas de parallaxe.
- L’ÉCHELLE ET LA CONTINUITÉ du jeu : une sous-zone = 1,25 écran, un décor à l’échelle des personnages et une carte sans aucune rupture visible.

Est-ce possible ? Oui. Les panoramas world-v2 suivent déjà ce principe : ils sont peints d’un seul bloc, dans le bon style. Mais ils sont coupés net à chaque frontière de biome et leur échelle est trop grande, car un panorama couvre trois sous-zones. Il faut donc peindre une nouvelle fresque continue sur toute la boucle, dans le style world-v2 et à l’échelle du jeu. Méthode recommandée au chapitre 14.

## 5. Style graphique (référence : world-v2)

- Toutes les images reprennent le style des panoramas world-v2, qu’on joint comme référence à chaque demande de génération. Même facture, mêmes couleurs, même densité de détails, même lumière.
- Un seul style homogène, du premier plan à l’horizon. Pas de mélange de styles ni d’images de facture différente côte à côte.
- Aucune déformation : jamais d’image étirée.
- Pas de ronds décoratifs incompréhensibles sur les façades.

## 6. Raccords parfaits entre les tuiles (règle absolue)

Le joueur ne doit jamais pouvoir distinguer la ligne de séparation entre deux tuiles en jeu. Une seule méthode est acceptée, car elle rend le raccord parfait par construction :

- **On peint une fresque maître continue, jamais des tuiles séparées.** Les 18 tuiles sont ensuite découpées dans cette fresque par un script, au pixel près. Deux tuiles voisines partagent donc exactement la même colonne de pixels de part et d’autre de la coupe : aucune rupture n’est possible.
- **La fresque grandit par extension (outpainting), de gauche à droite.** Chaque nouveau morceau est généré en recevant les 256 derniers pixels déjà peints comme partie fixe de l’image : l’IA continue le dessin existant. Ces pixels déjà validés ne sont jamais modifiés.
- **FONDU INTERDIT.** Aucun fondu, aucune transparence, aucun mélange de deux images superposées, ni sur les bords des tuiles ni entre deux morceaux générés. C’est une triche qui produit des images fantômes (objets dédoublés, contours flous). Toute tuile où l’on voit un dédoublement ou une zone floue est refusée et refaite.
- Si deux morceaux ne se raccordent pas, on corrige par retouche locale (inpainting) d’une bande étroite qui redessine la jonction, jamais par un fondu.
- La boucle se ferme : le dernier morceau (Transition Riches → Paris) est peint en extension à la fois du bord droit de Riches C et du bord gauche de Paris A, pour que la tuile 18 se raccorde à la tuile 1.
- Chaque coupe tombe à un endroit « facile » : arbre, haie, muret, pelouse, ciel, jamais au milieu d’une porte, d’une fenêtre, d’un panneau crème ou d’un personnage peint.
- Même ligne de sol, même ciel et même lumière partout (chapitre 16) : ce sont les premières causes de coutures visibles.
- Les changements de quartier se font progressivement dans l’image, jamais pile sur une coupe.
- Contrôle obligatoire : pour chaque coupe (y compris 18 → 1), on vérifie à 100 % une bande de 400 px de chaque côté. Aucune différence de couleur, de hauteur de sol, de lumière ou de dessin ne doit être visible.
- Côté moteur : les tuiles sont affichées à des positions entières, sans espace ni chevauchement d’un pixel, pour qu’aucun filet n’apparaisse à l’écran.

## 7. Profondeur peinte, sans parallaxe

- Le décor est un seul plan, qui défile exactement à la vitesse du joueur. Aucune couche séparée : ni ciel à part, ni lointain à part, ni avant-plan.
- Ciel, horizon (montagnes, mer, collines), lointain (silhouettes de villes, monuments), plan intermédiaire, fond proche et rue jouable sont peints ensemble dans la même image.
- La profondeur vient du dessin : rues qui s’enfoncent en perspective vers un monument, avec un point de fuite cohérent ; maisons en retrait derrière leur jardin ; bâtiments en gradins sur les pentes. Une rue ne doit jamais devenir un mur de façades continu qui cache tout le fond.
- Perspective atmosphérique : plus un élément est loin, plus il est petit, clair, bleuté et peu détaillé.
- Comme tout défile à la même vitesse, un élément lointain n’est visible que sur la portion de carte où il est peint. Plus de Mont-Blanc qui « suit » le joueur jusqu’en banlieue. En contrepartie, une montagne ou une skyline doit être peinte sur toute la largeur où l’on veut la voir (le massif alpin sur environ 3 sous-zones).
- Rien ne passe devant les personnages : pas de lampadaire, de branche ou de poteau au premier plan qui masquerait le joueur. Tout le décor est derrière lui.
- Les collines, montagnes, mer et skylines sont toujours au fond. Les parcs ne sont jamais au fond : au premier plan ou juste derrière la rue.
- La végétation s’entremêle entre le premier plan et le fond (arbres, cyprès, pins, haies, bosquets), comme dans les panoramas world-v2.

## 8. Rue, trottoir, chaussée et saisons

- La route et le trottoir sont continus sur toute la carte. Chaque biome a sa matière : pavés parisiens, bitume de banlieue, bas-côtés herbeux, chemin de campagne, promenade de bord de mer. Les transitions se font en douceur aux frontières.
- La route est cohérente avec les sprites des personnages, qui marchent sur le trottoir.
- Première version : **été seulement**. Les saisons ci-dessous viendront plus tard, sous forme de fresques complètes séparées.
- Les saisons changent le décor au fil de la campagne : feuilles mortes, neige sur les toits et le trottoir, arbres nus en hiver, fleurs au printemps.

## 9. Bâtiments interactifs

- Chaque bâtiment du jeu est intégré au premier plan, dans l’architecture de son quartier : ce n’est pas un sprite collé devant le décor. Les anciens sprites « building-* » ne doivent plus servir.
- Sa devanture montre sa fonction : affiches de campagne pour une permanence, atelier de vélos ou de scooters pour un garage, studio de radio pour une rédaction, porte blindée et barreaux pour un local du service d’ordre ou un cabinet, écrans de graphiques pour un institut de sondage.
- Il porte un panneau crème vierge, bien lisible, où le jeu écrit le nom du bâtiment et ajoute la couleur de son propriétaire.
- Ce sont les seuls endroits du décor où il y a du texte, à deux exceptions près (chapitre 10).
- Aucun arbre ni objet devant une devanture interactive.
- Les meetings utilisent l’estrade provisoire en bois (images building-meeting_stage-*), jamais une scène en pierre.
- Chaque bâtiment est placé entre 15 % et 85 % de la largeur de sa sous-zone : jamais collé à une frontière. Une permanence reste un peu centrale.
- Dans les sous-zones B, aucun bâtiment entre 35 % et 65 % : c’est la place de meeting et sa foule.
- Les positions sont fixées par le jeu (chapitre 17) : le décor se compose autour d’elles, et non l’inverse.

## 10. Interdits et règles transverses

- Aucun texte dans le décor : pas de noms de magasins (boulangerie, supermarché…), pas de noms de ville, pas de marques, pas de nom de lieu lisible. Deux exceptions seulement : le mot « ÉCOLE » gravé au fronton de l’école communale, et, au loin, un panneau d’entrée de village dont on ne peut pas lire le nom. Les commerces se reconnaissent visuellement, par leur vitrine et un pictogramme.
- Aucun véhicule dans le décor (voitures, camping-car, fourgon, tracteur, vélos garés) : ils ne sont pas utilisables et enverraient un mauvais signal. Seuls les véhicules jouables du jeu existent.
- Aucun financeur réel ou étranger, aucun élément de ce type dans le décor.
- Le haussmannien est réservé à Paris et aux quartiers riches.
- La banlieue est une zone dortoir : très peu de commerces.
- Le bord de mer n’est pas haussmannien : c’est une station balnéaire.

## 11. Détails de France obligatoires

- Métiers de bouche : une seule boulangerie, une seule fromagerie et une seule boucherie sur toute la carte, toutes à Paris B. Aucun autre commerce de bouche ailleurs, même en arrière-plan.
- Au moins un barbecue dans un jardin, en Périurbain A ou en Retraités A.
- La mairie de village avec ses drapeaux français et européen, et la place avec son monument aux morts.
- Le kiosque à journaux vert, la fontaine Wallace et la colonne Morris à Paris ; les étals de marché rayés.
- Le rond-point avec sa sculpture locale kitsch.
- Les haies de thuyas et le nain de jardin chez les retraités ; les cabines de plage et la promenade au bord de mer.
- Le boulodrome sous les platanes, à l’entrée du hameau de Campagne C, où le premier plan est presque vide.
- Le bar-tabac PMU de Retraités A : terrasse, carotte rouge du tabac, sans texte ni logo.
- Une pharmacie dans le biome Retraités (Retraités B) : croix verte, sans texte.
- Un terrain de football municipal en arrière-plan, à la sortie de la banlieue (transition Banlieue → Périurbain).
- L’école communale (portail, préau, cour) en retrait au village, et un château d’eau au loin dans la campagne.
- Pylônes et lignes électriques au loin dans la campagne ; très loin, une ligne de chemin de fer avec un petit train régional.
- Optionnel : quelques rangs de vigne entre la campagne et les premiers pavillons de Retraités A.

## 12. Transitions entre biomes (fils conducteurs)

On pense chaque frontière avec les deux biomes à la fois, jamais séparément. Un fil conducteur traverse chaque transition :

- Paris → Banlieue : la porte de Paris et le périphérique ; le canal de l’Ourcq et les Grands Moulins de Pantin au loin.
- Banlieue → Périurbain : la sortie de ville, un terrain vague, un camp de caravanes derrière un portail, les premières enseignes ; l’autoroute au loin, jamais sous les pieds du joueur.
- Périurbain → Campagne : le massif alpin monte puis redescend sur environ 3 sous-zones, et le bocage apparaît au premier plan.
- Campagne → Retraités : le premier lotissement au bout des champs ; pins et thuyas annoncent la côte.
- Retraités → Quartiers riches : la banlieue bourgeoise (type Neuilly), puis le bois de Boulogne, sans La Défense à cet endroit.
- Quartiers riches → Paris : la tour Eiffel disparaît, place aux concept stores et aux cafés, au métro aérien, et le Sacré-Cœur apparaît au bout de la rue.

## 13. Ce qui n’a pas fonctionné (à ne pas refaire)

- Panoramas world-v2 : le style est parfait, mais ils sont coupés net à la frontière de chaque biome et sont trop grands à l’échelle du jeu, car un panorama couvre trois sous-zones.
- Bâtiments placés là où le panorama les avait peints (parfois à 1 % du bord de la sous-zone) au lieu de peindre le décor autour des bons emplacements.
- Zoom réduit à 0,65 pour faire tenir des panoramas mal proportionnés : les sous-zones devenaient plus étroites que l’écran.
- Mélange d’images peintes et de dessins de facture différente : rendu incohérent.
- Colline ou montagne coupée net au bord d’une image.
- Façades en mur continu, sans perspective ni vie.
- Montagnes en forme de dôme ou de colline, sans arêtes, roche ni glaciers, sans montée progressive.
- Tour collée à un autre immeuble ; immeuble trop haut qui ne correspond à rien.
- Villas identiques et collées, sans âme ; maisons de lotissement trop riches.
- Éléments lointains visibles hors de leur territoire (tours au-dessus du lotissement, Mont-Blanc en banlieue).
- Texte sur les commerces, voitures garées, décors vides dont on ne comprend pas ce qu’ils représentent.

## 14. Méthode de production : une fresque maître

- Ne pas découper les panoramas world-v2 existants : leur échelle est trop grande et ils sont coupés net entre biomes.
- Étape 1 — Esquisse globale en basse résolution de toute la boucle (432 unités), par exemple au cinquième de la taille finale. On y place les biomes, les transitions et les grands éléments (montagnes, mer, monuments). Rapide à corriger.
- Étape 2 — Calque de repères posé sur l’esquisse : ligne de sol, emplacements des bâtiments interactifs (chapitre 17), places de meeting. C’est la référence pour ne rien casser au gameplay.
- Étape 3 — Une image de référence de style (panorama world-v2), jointe à chaque demande de génération.
- Étape 4 — Génération à la taille finale, morceau par morceau, en suivant l’esquisse. Chaque morceau chevauche ses voisins d’environ 200 à 300 px pour éviter les coutures. Les outils d’IA ne savent pas traiter une image de 34 560 px d’un coup.
- Étape 5 — Retouche des coutures et des incohérences, à la main ou par inpainting (l’IA ne redessine qu’une zone choisie).
- Étape 6 — Assemblage d’une fresque maître unique, conservée dans assets/generated/masters/, puis découpage automatique en tuiles pour le jeu.
- Commencer par un biome pilote complet (par exemple Paris, avec ses deux transitions), le valider dans le jeu, puis étendre aux autres biomes.
- Principal risque : d’un morceau généré à l’autre, le style, la lumière ou la ligne de sol dérivent et les raccords se voient. Chaque morceau se contrôle sur le calque de repères et à côté de ses voisins avant d’être validé.

## 15. Décors disponibles dans le jeu aujourd’hui

- Par défaut, pour tous les joueurs : l’ancien décor en couches peintes (dossier assets/generated/biomes).
- Profil « betatest » seulement (menu Mon profil) : choix entre ce décor, les panoramas world-v2 (assets/generated/world-v2) et la fresque dessinée par le code (src/presentation/world-v3/fresque).
- Les trois décors ont le même gameplay et le même zoom.
- L’affichage d’une fresque d’un seul plan découpée en tuiles reste à brancher dans le moteur. Les panoramas world-v2, déjà affichés sans parallaxe, peuvent servir de base.

## 16. Livrables attendus pour la production des images

- Style : celui des panoramas world-v2. Profondeur : peinte dans l’image, un seul plan, sans parallaxe. Raccords invisibles partout.
- Une fresque maître continue de 34 560 × 1 080 px : 432 unités de jeu × 80 px. La boucle se referme : le bord droit se raccorde au bord gauche.
- Découpée en 18 tuiles de 1 920 × 1 080 px, une par sous-zone (24 unités).
- Échelle ×2 : personnage 162 px, porte 184 px, étage 168 px, rez-de-chaussée commerçant 256 px, une unité de jeu 80 px.
- PNG opaque, ciel compris : plus de fond transparent ni de magenta. La ligne de sol est à la même hauteur sur toute la fresque.
- Vue de face depuis le trottoir, lumière de gauche. Les panneaux crème des bâtiments interactifs sont vierges.
- Contrôle de l’échelle : chaque tuile est vérifiée avec un personnage de 162 px posé sur le trottoir, devant une porte (184 px). Toute tuile où le personnage paraît trop petit ou trop grand est refaite.
- Ce cahier est la seule référence : l’ancien fichier FRESQUE-A-PEINDRE.md est obsolète et ne doit pas être utilisé.
- **Valeurs en pixels (échelle ×2, 80 px par unité)** : tuile de 1 920 × 1 080 px = 24 unités. Ligne de sol (pieds des personnages et pied des façades) à **y = 1 004 px** sur toutes les tuiles ; en dessous, 76 px de trottoir et de chaussée. Personnage : 162 px, pieds à y = 1 004. Porte : 184 px de haut (haut de porte à y = 820). Rez-de-chaussée commerçant : 256 px.
- **Bâtiments interactifs** : la porte est centrée à x = (position du chapitre 17) × 1 920 px dans sa tuile. Panneau crème vierge centré au-dessus de la porte, de y = 764 à y = 808 px (44 px de haut), large d’environ 70 % de la façade et au moins 200 px.
- **Place de meeting** (sous-zones B) : rien de construit entre x = 672 et x = 1 248 px ; l’estrade du jeu occupe environ 216 px au centre (x = 852 à 1 068).
- **Ciel et lumière fixés** : même ciel d’été sur toute la fresque, bleu uni #9FCFEE sur les 64 px du haut (le jeu peut ainsi prolonger le ciel sur les écrans plus hauts), dégradé régulier jusqu’à #E4F1F6 à l’horizon. Milieu de matinée, soleil en haut à gauche, ombres portées vers la droite, mêmes couleurs d’ombre partout. Quelques nuages légers, jamais coupés par une tuile.
- **Ordre de travail** : pilote Paris A → B → C avec les deux transitions, validé dans le jeu ; puis dans l’ordre de la carte, chaque morceau en extension du précédent ; enfin la fermeture de la boucle.
- **Noms des fichiers** : fresque maître `fresque-plate-maitre.png` ; tuiles `tuile-01-paris-a.png` … `tuile-18-riches-c.png` (numéro sur deux chiffres, puis la sous-zone).
- **Liste de contrôle par tuile** : ☐ 1 920 × 1 080 px, opaque ; ☐ sol à y = 1 004 ; ☐ échelle vérifiée avec un personnage de 162 px ; ☐ portes et panneaux crème aux bonnes positions ; ☐ place de meeting libre ; ☐ raccord parfait avec la tuile de gauche et celle de droite, sans fondu ni dédoublement ; ☐ aucun texte hors exceptions ; ☐ aucun véhicule ; ☐ ciel et lumière conformes ; ☐ éléments du storyboard présents.
- **Gabarits** : un gabarit de 1 920 × 1 080 px par tuile dans `docs/production/decor-v3/carte-plate/gabarits/` (sol, portes, panneaux crème, place de meeting, personnage à l’échelle, zones de coupe), plus une vue d’ensemble `00-vue-ensemble.png`. Chaque morceau de la fresque est peint en suivant son gabarit. Régénération : `node scripts/fresque-plate-gabarits.mjs`.
- **Découpe et contrôle** : `node scripts/fresque-plate-raccords.mjs decouper fresque-plate-maitre.png` produit les 18 tuiles au pixel près ; `node scripts/fresque-plate-raccords.mjs verifier <dossier des tuiles> fresque-plate-maitre.png` refuse toute transparence, toute tuile retouchée après découpe et toute coupe visible, et enregistre une vue rapprochée de chaque coupe à regarder à 100 %.
- **Version pour Codex** : `docs/production/decor-v3/carte-plate/CAHIER-CODEX.md` reprend ce cahier en texte, avec les photos rangées par sous-zone dans `carte-plate/photos/`.

## 17. Positions des bâtiments du jeu (en pixels)

Position de la porte de chaque bâtiment interactif. « x dans la tuile » se mesure depuis le bord gauche de la tuile de 1 920 px ; « x dans la fresque » depuis le bord gauche de la fresque maître de 34 560 px. Chaque gabarit trace ces positions.

| Tuile | Sous-zone | Bâtiment | Position | x dans la tuile | x dans la fresque |
|---|---|---|---|---|---|
| 01 | Paris A | Permanence (QG Glucksmann) | 67 % | 1294 px | 1294 px |
| 02 | Paris B | Garage à vélo | 23 % | 444 px | 2364 px |
| 02 | Paris B | Place de meeting (rien de construit de 672 à 1 248 px) | 50 % | 960 px | 2880 px |
| 03 | Paris C | Permanence (QG Roussel) | 24 % | 458 px | 4298 px |
| 03 | Paris C | Institut de sondage | 74 % | 1425 px | 5265 px |
| 04 | Banlieue A | Rédaction | 38 % | 721 px | 6481 px |
| 05 | Banlieue B | Permanence | 22 % | 422 px | 8102 px |
| 05 | Banlieue B | Place de meeting (rien de construit de 672 à 1 248 px) | 50 % | 960 px | 8640 px |
| 06 | Banlieue C | Local du service d’ordre | 44 % | 838 px | 10438 px |
| 07 | Périurbain A | Permanence (QG Arthaud) | 57 % | 1101 px | 12621 px |
| 08 | Périurbain B | Garage à scooter | 20 % | 384 px | 13824 px |
| 08 | Périurbain B | Place de meeting (rien de construit de 672 à 1 248 px) | 50 % | 960 px | 14400 px |
| 09 | Périurbain C | Permanence (QG Dupont-Aignan) | 49 % | 937 px | 16297 px |
| 10 | Campagne A | Garage à scooter | 77 % | 1474 px | 18754 px |
| 11 | Campagne B | Permanence | 22 % | 422 px | 19622 px |
| 11 | Campagne B | Place de meeting (rien de construit de 672 à 1 248 px) | 50 % | 960 px | 20160 px |
| 12 | Campagne C | Local du service d’ordre | 36 % | 689 px | 21809 px |
| 13 | Retraités A | Permanence (QG Retailleau) | 65 % | 1256 px | 24296 px |
| 14 | Retraités B | Rédaction | 20 % | 375 px | 25335 px |
| 14 | Retraités B | Institut de sondage | 80 % | 1536 px | 26496 px |
| 14 | Retraités B | Place de meeting (rien de construit de 672 à 1 248 px) | 50 % | 960 px | 25920 px |
| 15 | Retraités C | Permanence (QG Attal) | 66 % | 1273 px | 28153 px |
| 16 | Riches A | Rédaction | 54 % | 1045 px | 29845 px |
| 17 | Riches B | Permanence | 22 % | 422 px | 31142 px |
| 17 | Riches B | Place de meeting (rien de construit de 672 à 1 248 px) | 50 % | 960 px | 31680 px |
| 18 | Riches C | Cabinet | 23 % | 433 px | 33073 px |
| 18 | Riches C | Institut de sondage | 57 % | 1087 px | 33727 px |

## 18. Storyboard sous-zone par sous-zone

Pour chaque sous-zone, dans l’ordre de la carte : ce qu’il faut retenir, les exigences, puis trois familles d’images. **Premier plan** : les façades vues depuis le trottoir. **Arrière-plan** : paysages, silhouettes et monuments, peints dans la même image que la rue, en perspective, jamais au premier plan. **Déjà dans le jeu** : l’extrait du panorama world-v2 et les anciens fonds en couches à garder ou à égaler. Les six transitions sont en pointillés. Les photos sont des références visuelles uniquement : elles ne sont pas intégrées au jeu.

### Paris A — café et boutique de créateurs, sur la butte

*Paris 19e / Bobo*

Gabarit : [gabarits/tuile-01-paris-a.png](gabarits/tuile-01-paris-a.png) · tuile 01, fresque maître x = 0 → 1920 px.

**À retenir :** Paris dense et urbain : immeubles haussmanniens vus depuis le trottoir, rue en pente avec escaliers (comme rue de Crimée), café-terrasse de chaîne type Starbucks, concept store.

*Le parc des Buttes-Chaumont n'est pas un fond : au plus, une grille de parc au premier plan.*

**Exigences**

- Immeubles haussmanniens vus depuis le trottoir, rue en pente et grand escalier (type rue de Crimée).
- Café-terrasse de chaîne et concept store.
- Le parc des Buttes-Chaumont n’est jamais un fond : au plus, une grille de parc au premier plan.
- Permanence = QG de Glucksmann.

**Premier plan : la rue jouable, façades vues depuis le trottoir**

- [photos/01-paris-a/premier-plan-1.jpg](photos/01-paris-a/premier-plan-1.jpg) — Immeuble 36 Rue Crimée - Paris XIX (FR75) - 2024-08-19 - 1 — Chabe01 · CC BY-SA 4.0 ([source](https://commons.wikimedia.org/wiki/File:Immeuble_36_Rue_Crim%C3%A9e_-_Paris_XIX_(FR75)_-_2024-08-19_-_1.jpg))
- [photos/01-paris-a/premier-plan-2.jpg](photos/01-paris-a/premier-plan-2.jpg) — Terrasse de café, 188 avenue de Versailles, Paris 16e — Thank you to indicate this credit line next to the image in case of reuse: Cred · CC BY-SA 4.0 ([source](https://commons.wikimedia.org/wiki/File:Terrasse_de_caf%C3%A9,_188_avenue_de_Versailles,_Paris_16e.jpg))

**Déjà dans le jeu : à garder ou à égaler**

- [photos/01-paris-a/deja-dans-le-jeu-1.jpg](photos/01-paris-a/deja-dans-le-jeu-1.jpg) — Panorama world-v2, tiers A : intégration des bâtiments et esprit à garder
- `assets/generated/biomes/street-bobo.png` — Ancienne rue (biomes) : street-bobo
- `assets/generated/biomes/distant-bobo.png` — Ancien fond lointain (biomes) : distant-bobo

### Paris B — place du marché, boulangerie, garage à vélo

*Paris 19e / Bobo*

Gabarit : [gabarits/tuile-02-paris-b.png](gabarits/tuile-02-paris-b.png) · tuile 02, fresque maître x = 1920 → 3840 px.

**À retenir :** Comme dans world-v2 : boulangerie, étals rayés, commerces en rez-de-chaussée d'immeubles haussmanniens. Le Sacré-Cœur reste au fond, en surplomb, comme dans l'ancien fond distant-bobo.

**Exigences**

- Boulangerie, fromagerie et boucherie, reconnaissables sans texte.
- Place du marché au centre (meeting), étals rayés, garage à vélo.
- Le Sacré-Cœur en surplomb sur sa butte couverte d’immeubles en gradins, comme dans le panorama world-v2.

**Premier plan : la rue jouable, façades vues depuis le trottoir**

- [photos/02-paris-b/premier-plan-1.jpg](photos/02-paris-b/premier-plan-1.jpg) — Devanture Boulangerie 159 rue Ordener — KoS · CC BY-SA 3.0 ([source](https://commons.wikimedia.org/wiki/File:Devanture_Boulangerie_159_rue_Ordener.jpg))
- [photos/02-paris-b/premier-plan-2.jpg](photos/02-paris-b/premier-plan-2.jpg) — Boulangerie Patisserie La Parisienne, 28 rue Monge, 75005 Paris, 15 January 2017 — besopha · CC BY 2.0 ([source](https://commons.wikimedia.org/wiki/File:Boulangerie_Patisserie_La_Parisienne,_28_rue_Monge,_75005_Paris,_15_January_2017.jpg))
- [photos/02-paris-b/premier-plan-3.jpg](photos/02-paris-b/premier-plan-3.jpg) — Marché dAligre 4 — Jesús Gorriti from Madrid, Spain · CC BY-SA 2.0 ([source](https://commons.wikimedia.org/wiki/File:March%C3%A9_dAligre_4.jpg))
- [photos/02-paris-b/premier-plan-4.jpg](photos/02-paris-b/premier-plan-4.jpg) — **L’unique boucherie de la carte** — Boucherie Lamartine — Oderik · CC BY-SA 3.0 ([source](https://commons.wikimedia.org/wiki/File:Boucherie_Lamartine.jpg))

**Arrière-plan : peint dans la même image, en perspective (paysages, silhouettes, monuments)**

- [photos/02-paris-b/arriere-plan-1.jpg](photos/02-paris-b/arriere-plan-1.jpg) — Paris - Basilique du Sacré-Cœur de Montmartre - 2025-09-30 23-31-57 001 — Giò Terra (Terragio67) · CC BY-SA 4.0 ([source](https://commons.wikimedia.org/wiki/File:Paris_-_Basilique_du_Sacr%C3%A9-C%C5%93ur_de_Montmartre_-_2025-09-30_23-31-57_001.jpg))

**Déjà dans le jeu : à garder ou à égaler**

- [photos/02-paris-b/deja-dans-le-jeu-1.jpg](photos/02-paris-b/deja-dans-le-jeu-1.jpg) — Panorama world-v2, tiers B : intégration des bâtiments et esprit à garder
- `assets/generated/biomes/distant-bobo.png` — Ancien fond lointain (biomes) : distant-bobo
- `assets/generated/biomes/landscape-bobo.png` — Ancien plan intermédiaire (biomes) : landscape-bobo

### Paris C — quartier mixte vers le périphérique, institut de sondage

*Paris 19e / Bobo*

Gabarit : [gabarits/tuile-03-paris-c.png](gabarits/tuile-03-paris-c.png) · tuile 03, fresque maître x = 3840 → 5760 px.

**À retenir :** Quartier mixte : un peu d'haussmannien, des immeubles plus modernes (boulevard Macdonald), le périphérique qui approche. Le canal n'est qu'un passage : une passerelle entre B et C, pas tout le biome.

**Exigences**

- Quartier mixte : un peu d’haussmannien, des immeubles plus modernes (boulevard Macdonald).
- Le canal Saint-Martin n’est qu’un passage : une passerelle des écluses, pas tout le biome.
- Institut de sondage ici. Permanence = QG de Roussel. Le périphérique approche.

**Premier plan : la rue jouable, façades vues depuis le trottoir**

- [photos/03-paris-c/premier-plan-1.jpg](photos/03-paris-c/premier-plan-1.jpg) — Boulevard Macdonald - Paris XIX (FR75) - 2021-06-02 - 1 — Chabe01 · CC BY-SA 4.0 ([source](https://commons.wikimedia.org/wiki/File:Boulevard_Macdonald_-_Paris_XIX_(FR75)_-_2021-06-02_-_1.jpg))
- [photos/03-paris-c/premier-plan-2.jpg](photos/03-paris-c/premier-plan-2.jpg) — Passerelle des écluses de la Villette, canal Saint-Martin, 17 août 2015 — Benoît Prieur · CC0 ([source](https://commons.wikimedia.org/wiki/File:Passerelle_des_%C3%A9cluses_de_la_Villette,_canal_Saint-Martin,_17_ao%C3%BBt_2015.jpg))

**Arrière-plan : peint dans la même image, en perspective (paysages, silhouettes, monuments)**

- [photos/03-paris-c/arriere-plan-1.jpg](photos/03-paris-c/arriere-plan-1.jpg) — Porte de Pantin y peripherique — Wikimedia Commons · CC BY-SA 3.0 ([source](https://commons.wikimedia.org/wiki/File:Porte_de_Pantin_y_peripherique.jpg))

**Déjà dans le jeu : à garder ou à égaler**

- [photos/03-paris-c/deja-dans-le-jeu-1.jpg](photos/03-paris-c/deja-dans-le-jeu-1.jpg) — Panorama world-v2, tiers C : intégration des bâtiments et esprit à garder
- `assets/generated/biomes/street-bobo.png` — Ancienne rue (biomes) : street-bobo

### Transition Paris → Banlieue : le périphérique et la porte de Paris

*Transition*

Transition : elle se peint à cheval sur la fin du biome précédent et le début du suivant, progressivement, jamais pile sur une coupe.

**À retenir :** On passe la porte de Paris : périphérique en arrière-plan, premiers grands ensembles derrière. Le canal de l'Ourcq et les Grands Moulins peuvent apparaître au loin, sans dominer.

**Exigences**

- Porte de Paris, périphérique en arrière-plan, premiers grands ensembles derrière.
- Canal de l’Ourcq et Grands Moulins au loin, sans dominer.

**Premier plan : la rue jouable, façades vues depuis le trottoir**

- [photos/04-t-paris-banlieue/premier-plan-1.jpg](photos/04-t-paris-banlieue/premier-plan-1.jpg) — Porte de La Villette, Paris 9 May 2013 — Guilhem Vellut from Tokyo, Japan · CC BY 2.0 ([source](https://commons.wikimedia.org/wiki/File:Porte_de_La_Villette,_Paris_9_May_2013.jpg))

**Arrière-plan : peint dans la même image, en perspective (paysages, silhouettes, monuments)**

- [photos/04-t-paris-banlieue/arriere-plan-1.jpg](photos/04-t-paris-banlieue/arriere-plan-1.jpg) — Paris 19e Pont du canal de l'Ourcq Grands Moulins de Pantin 356 — GFreihalter · CC BY-SA 4.0 ([source](https://commons.wikimedia.org/wiki/File:Paris_19e_Pont_du_canal_de_l%27Ourcq_Grands_Moulins_de_Pantin_356.jpg))

### Banlieue A — tours de cité vues de près, média associatif

*Banlieue*

Gabarit : [gabarits/tuile-04-banlieue-a.png](gabarits/tuile-04-banlieue-a.png) · tuile 04, fresque maître x = 5760 → 7680 px.

**À retenir :** Les tours sont gigantesques et proches, vues depuis le trottoir : barres des 4000, tours nuages Aillaud à hublots.

**Exigences**

- Au moins deux tours gigantesques vues de près, isolées sur leurs pelouses, jamais collées à un autre immeuble.
- Barres des 4000, tours nuages à hublots.
- Rédaction associative en pied de tour.
- Immeubles de 3-4 étages avant d’arriver aux pavillons. Cité dortoir : presque aucun commerce.

**Premier plan : la rue jouable, façades vues depuis le trottoir**

- [photos/05-banlieue-a/premier-plan-1.jpg](photos/05-banlieue-a/premier-plan-1.jpg) — Nanterre — Quispiam · CC0 ([source](https://commons.wikimedia.org/wiki/File:Nanterre.jpg))
- [photos/05-banlieue-a/premier-plan-2.jpg](photos/05-banlieue-a/premier-plan-2.jpg) — Cité pablo picasso nanterre — Wikimedia Commons · Public domain ([source](https://commons.wikimedia.org/wiki/File:Cit%C3%A9_pablo_picasso_nanterre.jpg))
- [photos/05-banlieue-a/premier-plan-3.jpg](photos/05-banlieue-a/premier-plan-3.jpg) — La Courneuve 4000 logements - AM La Courneuve 8Fi337 — Wikimedia Commons · CC BY-SA 4.0 ([source](https://commons.wikimedia.org/wiki/File:La_Courneuve_4000_logements_-_AM_La_Courneuve_8Fi337.jpg))

**Déjà dans le jeu : à garder ou à égaler**

- [photos/05-banlieue-a/deja-dans-le-jeu-1.jpg](photos/05-banlieue-a/deja-dans-le-jeu-1.jpg) — Panorama world-v2, tiers A : intégration des bâtiments et esprit à garder
- `assets/generated/biomes/street-banlieue.png` — Ancienne rue (biomes) : street-banlieue
- `assets/generated/biomes/landscape-banlieue.png` — Ancien plan intermédiaire (biomes) : landscape-banlieue

### Banlieue B — marché populaire, basilique de Saint-Denis

*Banlieue*

Gabarit : [gabarits/tuile-05-banlieue-b.png](gabarits/tuile-05-banlieue-b.png) · tuile 05, fresque maître x = 7680 → 9600 px.

**À retenir :** Rue commerçante de Saint-Denis et marché vu depuis le trottoir (photo idéale à fournir : étals du marché de Saint-Denis au niveau de la rue). La basilique en arrière-plan.

**Exigences**

- Rue commerçante ancienne de Saint-Denis et marché populaire vu du trottoir, au centre (meeting).
- Le marché n’est pas entouré de tours.
- La basilique de Saint-Denis bien visible au fond.

**Premier plan : la rue jouable, façades vues depuis le trottoir**

- [photos/06-banlieue-b/premier-plan-1.jpg](photos/06-banlieue-b/premier-plan-1.jpg) — Rue République - Saint-Denis (FR93) - 2022-01-01 - 2 — Chabe01 · CC BY-SA 4.0 ([source](https://commons.wikimedia.org/wiki/File:Rue_R%C3%A9publique_-_Saint-Denis_(FR93)_-_2022-01-01_-_2.jpg))
- [photos/06-banlieue-b/premier-plan-2.jpg](photos/06-banlieue-b/premier-plan-2.jpg) — Marché dAligre 3 — Jesús Gorriti from Madrid, Spain · CC BY-SA 2.0 ([source](https://commons.wikimedia.org/wiki/File:March%C3%A9_dAligre_3.jpg))

**Arrière-plan : peint dans la même image, en perspective (paysages, silhouettes, monuments)**

- [photos/06-banlieue-b/arriere-plan-1.jpg](photos/06-banlieue-b/arriere-plan-1.jpg) — Ouest Basilique Saint-Denis Place — Thomon · CC BY-SA 4.0 ([source](https://commons.wikimedia.org/wiki/File:Ouest_Basilique_Saint-Denis_Place.jpg))

**Déjà dans le jeu : à garder ou à égaler**

- [photos/06-banlieue-b/deja-dans-le-jeu-1.jpg](photos/06-banlieue-b/deja-dans-le-jeu-1.jpg) — Panorama world-v2, tiers B : intégration des bâtiments et esprit à garder — **À ne pas reproduire : la boulangerie à gauche (la seule boulangerie est à Paris B).**
- `assets/generated/biomes/distant-banlieue.png` — Ancien fond lointain (biomes) : distant-banlieue

### Banlieue C — pavillons modestes, local SO, cités basses au fond

*Banlieue*

Gabarit : [gabarits/tuile-06-banlieue-c.png](gabarits/tuile-06-banlieue-c.png) · tuile 06, fresque maître x = 9600 → 11520 px.

**À retenir :** Rue de pavillons serrés et fatigués. En arrière-plan, des cités plus basses et plus larges, et une mosquée moderne discrète : petite, lointaine, en partie cachée, jamais dominante.

**Exigences**

- Rue de pavillons serrés et fatigués.
- Local du service d’ordre = un vrai bâtiment.
- Pas de coiffeur ni de primeur ; à la rigueur un kebab.
- Au fond : des cités plus basses et plus larges ; une mosquée moderne discrète (petite, lointaine, en partie masquée, jamais un élément dominant).

**Premier plan : la rue jouable, façades vues depuis le trottoir**

- [photos/07-banlieue-c/premier-plan-1.jpg](photos/07-banlieue-c/premier-plan-1.jpg) — Rue Pavillons - Montreuil (FR93) - 2020-10-23 - 1 — Chabe01 · CC BY-SA 4.0 ([source](https://commons.wikimedia.org/wiki/File:Rue_Pavillons_-_Montreuil_(FR93)_-_2020-10-23_-_1.jpg))

**Arrière-plan : peint dans la même image, en perspective (paysages, silhouettes, monuments)**

- [photos/07-banlieue-c/arriere-plan-1.jpg](photos/07-banlieue-c/arriere-plan-1.jpg) — Mosquée de Gennevilliers — vue de près ici, mais à peindre petite, lointaine et en partie cachée — Mosquee-gennevilliers · CC BY-SA 4.0 ([source](https://commons.wikimedia.org/wiki/File:Mosqu%C3%A9e_de_Gennevilliers.jpg))

**Déjà dans le jeu : à garder ou à égaler**

- [photos/07-banlieue-c/deja-dans-le-jeu-1.jpg](photos/07-banlieue-c/deja-dans-le-jeu-1.jpg) — Panorama world-v2, tiers C : intégration des bâtiments et esprit à garder
- `assets/generated/biomes/street-banlieue.png` — Ancienne rue (biomes) : street-banlieue

### Transition Banlieue → Périurbain : sortie de ville et camp de caravanes

*Transition*

Transition : elle se peint à cheval sur la fin du biome précédent et le début du suivant, progressivement, jamais pile sur une coupe.

**À retenir :** Le joueur longe une sortie de ville : terrain vague, camp de caravanes de gens du voyage derrière un portail, puis les premières enseignes du périurbain. En arrière-plan, un terrain de football municipal. L'autoroute peut passer au loin, jamais sous les pieds du joueur.

**Exigences**

- Sortie de ville : terrain vague, camp de caravanes derrière un portail, premières enseignes. En arrière-plan, un terrain de football municipal : cages, grillage, petits vestiaires.
- L’autoroute au loin, jamais sous les pieds du joueur.

**Premier plan : la rue jouable, façades vues depuis le trottoir**

- [photos/08-t-banlieue-periurbain/premier-plan-1.jpg](photos/08-t-banlieue-periurbain/premier-plan-1.jpg) — Aire d'accueil des gens du voyage de Beynost en avril 2023 — Benoît Prieur · CC0 ([source](https://commons.wikimedia.org/wiki/File:Aire_d%27accueil_des_gens_du_voyage_de_Beynost_en_avril_2023.JPG))

**Arrière-plan : peint dans la même image, en perspective (paysages, silhouettes, monuments)**

- [photos/08-t-banlieue-periurbain/arriere-plan-1.jpg](photos/08-t-banlieue-periurbain/arriere-plan-1.jpg) — Autoroute A1 - Saint-Denis (FR93) - 2026-09-15 - 5 — Chabe01 · CC BY-SA 4.0 ([source](https://commons.wikimedia.org/wiki/File:Autoroute_A1_-_Saint-Denis_(FR93)_-_2026-09-15_-_5.jpg))
- [photos/08-t-banlieue-periurbain/arriere-plan-2.jpg](photos/08-t-banlieue-periurbain/arriere-plan-2.jpg) — **Terrain de football municipal** — Stade de Foot Estrablin 02 — Jlgay38 · CC BY 4.0 ([source](https://commons.wikimedia.org/wiki/File:Stade_de_Foot_Estrablin_02.jpg))

### Périurbain A — lotissement « French Dream » et zone commerciale au loin

*Périurbain / Usine*

Gabarit : [gabarits/tuile-07-periurbain-a.png](gabarits/tuile-07-periurbain-a.png) · tuile 07, fresque maître x = 11520 → 13440 px.

**À retenir :** Pavillons neufs tous pareils (comme ta photo : enduit crème, toit d'ardoise, garage, clôture grillagée, boîte aux lettres). Au loin, une zone commerciale peu visible plutôt qu’un simple hangar : c’est là qu’est le seul supermarché de la carte. Pas encore de grosses collines.

**Exigences**

- Lotissement « French Dream » : maisons neuves toutes identiques, sans âme, bon marché (pas riches), comme la photo fournie.
- Au loin, une zone commerciale peu visible plutôt qu’un simple hangar isolé (un entrepôt logistique peut en faire partie). C’est là qu’est le seul supermarché de la carte : n’en peindre aucun autre. Pas encore de grosses collines.
- Barbecue dans un jardin (ici ou en Retraités A). Permanence = QG d’Arthaud.

**Premier plan : la rue jouable, façades vues depuis le trottoir**

- [photos/09-periurbain-a/premier-plan-1.jpg](photos/09-periurbain-a/premier-plan-1.jpg) — Photo fournie par toi
- [photos/09-periurbain-a/premier-plan-2.jpg](photos/09-periurbain-a/premier-plan-2.jpg) — **Lotissement de pavillons neufs** — Osny - Lotissement près du stade,pavillons individuels - Rue du Cèdre — Région Île-de-France · Licence Ouverte ([source](https://commons.wikimedia.org/wiki/File:Osny_-_Lotissement_pr%C3%A8s_du_stade,pavillons_individuels_-_Rue_du_C%C3%A8dre.jpg))

**Arrière-plan : peint dans la même image, en perspective (paysages, silhouettes, monuments)**

- [photos/09-periurbain-a/arriere-plan-1.jpg](photos/09-periurbain-a/arriere-plan-1.jpg) — **Zone commerciale et son supermarché, à peindre petite et lointaine** — Intermarché de Saint Marcel — Rémi Simonnin · CC BY-SA 4.0 ([source](https://commons.wikimedia.org/wiki/File:Intermarch%C3%A9_de_Saint_Marcel.jpg))
- [photos/09-periurbain-a/arriere-plan-2.jpg](photos/09-periurbain-a/arriere-plan-2.jpg) — Zone industrielle de Biars-sur-Cère — Lucas Destrem · CC BY-SA 4.0 ([source](https://commons.wikimedia.org/wiki/File:Zone_industrielle_de_Biars-sur-C%C3%A8re.jpg))

**Déjà dans le jeu : à garder ou à égaler**

- [photos/09-periurbain-a/deja-dans-le-jeu-1.jpg](photos/09-periurbain-a/deja-dans-le-jeu-1.jpg) — Panorama world-v2, tiers A : intégration des bâtiments et esprit à garder
- `assets/generated/biomes/street-periurbain.png` — Ancienne rue (biomes) : street-periurbain
- `assets/generated/biomes/landscape-periurbain.png` — Ancien plan intermédiaire (biomes) : landscape-periurbain

### Périurbain B — zone artisanale et rond-point

*Périurbain / Usine*

Gabarit : [gabarits/tuile-08-periurbain-b.png](gabarits/tuile-08-periurbain-b.png) · tuile 08, fresque maître x = 13440 → 15360 px.

**À retenir :** Le giratoire au premier plan, la zone artisanale, les maisons en briques rouges. Les collines commencent à monter au fond.

**Exigences**

- Rond-point au premier plan, avec sa sculpture ; son centre reste libre pour le meeting.
- Zone artisanale, sans supermarché (le seul est dans la zone commerciale au loin, en Périurbain A), maisons de briques rouges, garage à scooter.
- Les collines commencent à monter au fond.

**Premier plan : la rue jouable, façades vues depuis le trottoir**

- [photos/10-periurbain-b/premier-plan-1.jpg](photos/10-periurbain-b/premier-plan-1.jpg) — Remiremont - carrefour giratoire du faubourg d'Épinal - 3 — Mathieu Kappler · CC BY-SA 4.0 ([source](https://commons.wikimedia.org/wiki/File:Remiremont_-_carrefour_giratoire_du_faubourg_d%27%C3%89pinal_-_3.jpg))
- [photos/10-periurbain-b/premier-plan-2.jpg](photos/10-periurbain-b/premier-plan-2.jpg) — Armentières maisons de briques 2016 01 — Lamiot · CC BY-SA 4.0 ([source](https://commons.wikimedia.org/wiki/File:Armenti%C3%A8res_maisons_de_briques_2016_01.jpg))

**Arrière-plan : peint dans la même image, en perspective (paysages, silhouettes, monuments)**

- [photos/10-periurbain-b/arriere-plan-1.jpg](photos/10-periurbain-b/arriere-plan-1.jpg) — Remiremont - faubourg d'Épinal le long de la zone commerciale - 1 — Mathieu Kappler · CC BY-SA 4.0 ([source](https://commons.wikimedia.org/wiki/File:Remiremont_-_faubourg_d%27%C3%89pinal_le_long_de_la_zone_commerciale_-_1.jpg))

**Déjà dans le jeu : à garder ou à égaler**

- [photos/10-periurbain-b/deja-dans-le-jeu-1.jpg](photos/10-periurbain-b/deja-dans-le-jeu-1.jpg) — Panorama world-v2, tiers B : intégration des bâtiments et esprit à garder
- `assets/generated/biomes/distant-periurbain.png` — Ancien fond lointain (biomes) : distant-periurbain

### Périurbain C — le Mont-Blanc, usines de vallée, premiers élevages

*Périurbain / Usine*

Gabarit : [gabarits/tuile-09-periurbain-c.png](gabarits/tuile-09-periurbain-c.png) · tuile 09, fresque maître x = 15360 → 17280 px.

**À retenir :** Prés et vaches montbéliardes au premier plan. En arrière-plan, une petite ville de vallée avec ses usines et leurs cheminées. Au fond, le Mont-Blanc enneigé, le plus haut fond du jeu.

**Exigences**

- Prés et vaches montbéliardes au premier plan.
- Petite ville de vallée avec ses usines et leurs cheminées en arrière-plan.
- Le Mont-Blanc enneigé, le plus haut fond du jeu. Permanence = QG de Dupont-Aignan.

**Premier plan : la rue jouable, façades vues depuis le trottoir**

- [photos/11-periurbain-c/premier-plan-1.jpg](photos/11-periurbain-c/premier-plan-1.jpg) — Montbéliardes (2) — Gzen92 · CC BY-SA 4.0 ([source](https://commons.wikimedia.org/wiki/File:Montb%C3%A9liardes_(2).jpg))

**Arrière-plan : peint dans la même image, en perspective (paysages, silhouettes, monuments)**

- [photos/11-periurbain-c/arriere-plan-1.jpg](photos/11-periurbain-c/arriere-plan-1.jpg) — **Vallée de l’Arve et ses sommets** — Vallée de Magland vue du Chevran - panoramio — marsupilami51 · CC BY 3.0 ([source](https://commons.wikimedia.org/wiki/File:Vall%C3%A9e_de_Magland_vue_du_Chevran_-_panoramio.jpg))
- [photos/11-periurbain-c/arriere-plan-2.jpg](photos/11-periurbain-c/arriere-plan-2.jpg) — Mont Blanc @ Sallanches — Rémih · CC BY-SA 4.0 ([source](https://commons.wikimedia.org/wiki/File:Mont_Blanc_@_Sallanches.jpg))
- [photos/11-periurbain-c/arriere-plan-3.jpg](photos/11-periurbain-c/arriere-plan-3.jpg) — Haute-vallée de l'Arve-1 (2017) — B. Brassoud · CC BY-SA 4.0 ([source](https://commons.wikimedia.org/wiki/File:Haute-vall%C3%A9e_de_l%27Arve-1_(2017).jpg))

**Déjà dans le jeu : à garder ou à égaler**

- [photos/11-periurbain-c/deja-dans-le-jeu-1.jpg](photos/11-periurbain-c/deja-dans-le-jeu-1.jpg) — Panorama world-v2, tiers C : intégration des bâtiments et esprit à garder
- `assets/generated/biomes/distant-periurbain.png` — Ancien fond lointain (biomes) : distant-periurbain

### Transition Périurbain → Campagne : la montagne redescend en collines

*Transition*

Transition : elle se peint à cheval sur la fin du biome précédent et le début du suivant, progressivement, jamais pile sur une coupe.

**À retenir :** Le massif est un fond immense qui couvre presque 3 sous-zones : collines, puis montagne (sommets en Périurbain C), puis collines. Il redescend progressivement vers la campagne, qui reste vallonnée. Au premier plan, le bocage.

**Exigences**

- Le massif couvre environ 3 sous-zones : collines, puis petites montagnes, puis hauts sommets, puis redescente vers la campagne vallonnée.
- Montagnes réalistes : arêtes, faces d’ombre, neige, glaciers, aiguilles autour du Mont-Blanc. Jamais de dôme en forme de colline.
- Le bocage au premier plan.

**Premier plan : la rue jouable, façades vues depuis le trottoir**

- [photos/12-t-periurbain-campagne/premier-plan-1.jpg](photos/12-t-periurbain-campagne/premier-plan-1.jpg) — Bocage normand GR 221 — Goéland · CC BY-SA 4.0 ([source](https://commons.wikimedia.org/wiki/File:Bocage_normand_GR_221.jpg))

**Arrière-plan : peint dans la même image, en perspective (paysages, silhouettes, monuments)**

- [photos/12-t-periurbain-campagne/arriere-plan-1.jpg](photos/12-t-periurbain-campagne/arriere-plan-1.jpg) — Cluse de Chambéry et Belledonnes depuis le Mont du Chat (avril 2018) — Florian Pépellin · CC BY-SA 4.0 ([source](https://commons.wikimedia.org/wiki/File:Cluse_de_Chamb%C3%A9ry_et_Belledonnes_depuis_le_Mont_du_Chat_(avril_2018).JPG))

### Campagne A — ferme maraîchère, serres et garage à l'entrée

*Campagne*

Gabarit : [gabarits/tuile-10-campagne-a.png](gabarits/tuile-10-campagne-a.png) · tuile 10, fresque maître x = 17280 → 19200 px.

**À retenir :** Tunnels et serres de tomates. La grange-garage à scooter doit être bien visible à l'entrée de la ferme, accolée aux serres.

**Exigences**

- Ferme maraîchère : tunnels et serres de tomates.
- La grange-garage à scooter bien visible à l’entrée de la ferme, accolée aux serres. Au loin : pylônes et lignes électriques à travers les champs, et un château d’eau, petit à l’horizon. Optionnel, très loin vers le village : un panneau d’entrée de village dont on ne lit pas le nom.

**Premier plan : la rue jouable, façades vues depuis le trottoir**

- [photos/13-campagne-a/premier-plan-1.jpg](photos/13-campagne-a/premier-plan-1.jpg) — Serre de tomates - Fraisochamps - Thil — Benoît Prieur · CC0 ([source](https://commons.wikimedia.org/wiki/File:Serre_de_tomates_-_Fraisochamps_-_Thil.JPG))

**Arrière-plan : peint dans la même image, en perspective (paysages, silhouettes, monuments)**

- [photos/13-campagne-a/arriere-plan-1.jpg](photos/13-campagne-a/arriere-plan-1.jpg) — Serre-les-Sapins, les terres agricoles — Wikipedro · CC BY-SA 4.0 ([source](https://commons.wikimedia.org/wiki/File:Serre-les-Sapins,_les_terres_agricoles.jpg))
- [photos/13-campagne-a/arriere-plan-2.jpg](photos/13-campagne-a/arriere-plan-2.jpg) — **Pylônes et lignes électriques au loin** — La ligne haute tension entre Avelin et Tourmignies — Pierre André Leclercq · CC BY-SA 4.0 ([source](https://commons.wikimedia.org/wiki/File:La_ligne_haute_tension_entre_Avelin_et_Tourmignies.jpg))
- [photos/13-campagne-a/arriere-plan-3.jpg](photos/13-campagne-a/arriere-plan-3.jpg) — **Château d’eau, petit à l’horizon (sans les enseignes)** — Water tower, Lisieux-2895 — Raimond Spekking · CC BY-SA 4.0 ([source](https://commons.wikimedia.org/wiki/File:Water_tower,_Lisieux-2895.jpg))

**Déjà dans le jeu : à garder ou à égaler**

- [photos/13-campagne-a/deja-dans-le-jeu-1.jpg](photos/13-campagne-a/deja-dans-le-jeu-1.jpg) — Panorama world-v2, tiers A : intégration des bâtiments et esprit à garder
- `assets/generated/biomes/street-campagne.png` — Ancienne rue (biomes) : street-campagne
- `assets/generated/biomes/landscape-campagne.png` — Ancien plan intermédiaire (biomes) : landscape-campagne

### Campagne B — le village : mairie, maisons, clocher, place

*Campagne*

Gabarit : [gabarits/tuile-11-campagne-b.png](gabarits/tuile-11-campagne-b.png) · tuile 11, fresque maître x = 19200 → 21120 px.

**À retenir :** Mairie avec drapeau, place avec son monument aux morts, et davantage de maisons de village en pierre le long de la rue. L'église et son clocher en arrière-plan.

**Exigences**

- Mairie avec drapeaux, place avec son monument aux morts (meeting au centre).
- Davantage de maisons de village en pierre le long de la rue.
- L’église et son clocher en arrière-plan.
- En retrait derrière la rue, hors de la place de meeting : l’école communale avec son portail, son préau et sa cour, éventuellement le mot « ÉCOLE » gravé au fronton.

**Premier plan : la rue jouable, façades vues depuis le trottoir**

- [photos/14-campagne-b/premier-plan-1.jpg](photos/14-campagne-b/premier-plan-1.jpg) — Roussillon - Place de la Mairie (5849020860) — Elliott Brown from Birmingham, United Kingdom · CC BY 2.0 ([source](https://commons.wikimedia.org/wiki/File:Roussillon_-_Place_de_la_Mairie_(5849020860).jpg))
- [photos/14-campagne-b/premier-plan-2.jpg](photos/14-campagne-b/premier-plan-2.jpg) — Rue du Four, Flavigny-sur-Ozerain - Maison de l'Écuyer and Maison Lacordaire (35093451593) — Elliott Brown from Birmingham, United Kingdom · CC BY-SA 2.0 ([source](https://commons.wikimedia.org/wiki/File:Rue_du_Four,_Flavigny-sur-Ozerain_-_Maison_de_l%27%C3%89cuyer_and_Maison_Lacordaire_(35093451593).jpg))
- [photos/14-campagne-b/premier-plan-3.jpg](photos/14-campagne-b/premier-plan-3.jpg) — Village square and monument aux morts in Dracy-le-Fort 1996 — JopkeB · CC BY-SA 4.0 ([source](https://commons.wikimedia.org/wiki/File:Village_square_and_monument_aux_morts_in_Dracy-le-Fort_1996.jpg))
- [photos/14-campagne-b/premier-plan-4.jpg](photos/14-campagne-b/premier-plan-4.jpg) — **École communale (seul « ÉCOLE » autorisé, sans « MAIRIE »)** — Mairie-école de Courtavon — Espirat · CC BY-SA 4.0 ([source](https://commons.wikimedia.org/wiki/File:Mairie-%C3%A9cole_de_Courtavon.jpg))

**Arrière-plan : peint dans la même image, en perspective (paysages, silhouettes, monuments)**

- [photos/14-campagne-b/arriere-plan-1.jpg](photos/14-campagne-b/arriere-plan-1.jpg) — Saint-Macoux 86 Église&place 2013 — JLPC · CC BY-SA 3.0 ([source](https://commons.wikimedia.org/wiki/File:Saint-Macoux_86_%C3%89glise%26place_2013.jpg))

**Déjà dans le jeu : à garder ou à égaler**

- [photos/14-campagne-b/deja-dans-le-jeu-1.jpg](photos/14-campagne-b/deja-dans-le-jeu-1.jpg) — Panorama world-v2, tiers B : intégration des bâtiments et esprit à garder
- `assets/generated/biomes/distant-campagne.png` — Ancien fond lointain (biomes) : distant-campagne

### Campagne C — blés, éoliennes, village et clocher au loin

*Campagne*

Gabarit : [gabarits/tuile-12-campagne-c.png](gabarits/tuile-12-campagne-c.png) · tuile 12, fresque maître x = 21120 → 23040 px.

**À retenir :** Champs, silo et petit monument au bord de la route. En arrière-plan, les éoliennes. Au fond, un village et son clocher.

**Exigences**

- Le minimum au premier plan : le local du service d’ordre et quelques éléments de décor (champs, silo, petit monument au bord de la route).
- Éoliennes en arrière-plan ; au fond, un village et son clocher. À l’entrée du hameau, un boulodrome sous les platanes. Très loin, une ligne de chemin de fer avec un petit train régional qui traverse la plaine.

**Premier plan : la rue jouable, façades vues depuis le trottoir**

- [photos/15-campagne-c/premier-plan-1.jpg](photos/15-campagne-c/premier-plan-1.jpg) — Monument aux morts éoliennes silo Pré-Saint-Martin Eure-et-Loir France — Le Passant · CC BY-SA 4.0 ([source](https://commons.wikimedia.org/wiki/File:Monument_aux_morts_%C3%A9oliennes_silo_Pr%C3%A9-Saint-Martin_Eure-et-Loir_France.jpg))
- [photos/15-campagne-c/premier-plan-2.jpg](photos/15-campagne-c/premier-plan-2.jpg) — **Boulodrome sous les arbres** — Légny - Boulodrome (juil 2023) — Sebleouf · CC BY-SA 4.0 ([source](https://commons.wikimedia.org/wiki/File:L%C3%A9gny_-_Boulodrome_(juil_2023).jpg))

**Arrière-plan : peint dans la même image, en perspective (paysages, silhouettes, monuments)**

- [photos/15-campagne-c/arriere-plan-1.jpg](photos/15-campagne-c/arriere-plan-1.jpg) — Eoliennes Beauce (1) — Remi Jouan · CC BY-SA 3.0 ([source](https://commons.wikimedia.org/wiki/File:Eoliennes_Beauce_(1).JPG))
- [photos/15-campagne-c/arriere-plan-2.jpg](photos/15-campagne-c/arriere-plan-2.jpg) — **Village et clocher au loin, derrière les champs** — Mérignies, Chat pylons de la ligne haute tension en 2022 — Pierre André Leclercq · CC BY-SA 4.0 ([source](https://commons.wikimedia.org/wiki/File:M%C3%A9rignies,_Chat_pylons_de_la_ligne_haute_tension_en_2022.jpg))
- [photos/15-campagne-c/arriere-plan-3.jpg](photos/15-campagne-c/arriere-plan-3.jpg) — **Train régional, à peindre tout petit, très loin** — TER Alstom Régiolis n°84675 — Dacia 1410 Sport · CC BY-SA 4.0 ([source](https://commons.wikimedia.org/wiki/File:TER_Alstom_R%C3%A9giolis_n%C2%B084675.jpg))

**Déjà dans le jeu : à garder ou à égaler**

- [photos/15-campagne-c/deja-dans-le-jeu-1.jpg](photos/15-campagne-c/deja-dans-le-jeu-1.jpg) — Panorama world-v2, tiers C : intégration des bâtiments et esprit à garder
- `assets/generated/biomes/distant-campagne.png` — Ancien fond lointain (biomes) : distant-campagne

### Transition Campagne → Retraités : le lotissement en bout de champ

*Transition*

Transition : elle se peint à cheval sur la fin du biome précédent et le début du suivant, progressivement, jamais pile sur une coupe.

**À retenir :** Au bout des champs, le premier lotissement neuf. Pins et haies de thuyas annoncent la côte. Aucun panneau de ville : rien ne doit nommer explicitement un lieu.

**Exigences**

- Au bout des champs, le premier lotissement neuf.
- Pins et haies de thuyas annoncent la côte. Aucun panneau de ville. Optionnel : quelques rangs de vigne sur la pente, juste avant les premiers pavillons de Retraités A.

**Premier plan : la rue jouable, façades vues depuis le trottoir**

- [photos/16-t-campagne-retraites/premier-plan-1.jpg](photos/16-t-campagne-retraites/premier-plan-1.jpg) — Lotissement Village - Garnerans (FR01) - 2025-06-07 - 1 — Chabe01 · CC BY-SA 4.0 ([source](https://commons.wikimedia.org/wiki/File:Lotissement_Village_-_Garnerans_(FR01)_-_2025-06-07_-_1.jpg))
- [photos/16-t-campagne-retraites/premier-plan-2.jpg](photos/16-t-campagne-retraites/premier-plan-2.jpg) — **Optionnel : rangs de vigne** — Vignoble et église de Cruet (octobre 2021) — Florian Pépellin · CC BY-SA 4.0 ([source](https://commons.wikimedia.org/wiki/File:Vignoble_et_%C3%A9glise_de_Cruet_(octobre_2021).JPG))

### Retraités A — pavillons impeccables et bar-tabac PMU

*Retraités*

Gabarit : [gabarits/tuile-13-retraites-a.png](gabarits/tuile-13-retraites-a.png) · tuile 13, fresque maître x = 23040 → 24960 px.

**À retenir :** On revient vers l'urbain : vraies rues pavillonnaires vues depuis le trottoir, avec haies taillées, pelouses et le bar-tabac PMU du quartier.

**Exigences**

- Vraies rues pavillonnaires vues du trottoir : haies taillées, pelouses, maisons en retrait.
- Le bar-tabac PMU du quartier, à la place du garage (plus représentatif de la France) : terrasse, carotte rouge du tabac, sans texte ni logo. Barbecue possible. Permanence = QG de Retailleau.

**Premier plan : la rue jouable, façades vues depuis le trottoir**

- [photos/17-retraites-a/premier-plan-1.jpg](photos/17-retraites-a/premier-plan-1.jpg) — Luzarches (95), rue du Parisis — P.poschadel · CC BY-SA 2.0 fr ([source](https://commons.wikimedia.org/wiki/File:Luzarches_(95),_rue_du_Parisis.jpg))
- [photos/17-retraites-a/premier-plan-2.jpg](photos/17-retraites-a/premier-plan-2.jpg) — Villabé - 2018-12-13 - IMG 9273 — Poudou99 · CC BY-SA 4.0 ([source](https://commons.wikimedia.org/wiki/File:Villab%C3%A9_-_2018-12-13_-_IMG_9273.jpg))
- [photos/17-retraites-a/premier-plan-3.jpg](photos/17-retraites-a/premier-plan-3.jpg) — **Bar-tabac PMU sur la place** — Coye-la-Forêt (60), place de la Mairie, bar-tabac-PMU 'Le Régent', à dr. l'école du centre — P.poschadel · CC BY-SA 2.0 fr ([source](https://commons.wikimedia.org/wiki/File:Coye-la-For%C3%AAt_(60),_place_de_la_Mairie,_bar-tabac-PMU_%27Le_R%C3%A9gent%27,_%C3%A0_dr._l%27%C3%A9cole_du_centre.jpg))
- [photos/17-retraites-a/premier-plan-4.jpg](photos/17-retraites-a/premier-plan-4.jpg) — **Bar-tabac PMU : carotte rouge, terrasse (sans texte ni logo)** — Restaurant Bar Tabac de la Poste Estrablin 03 — Jlgay38 · CC BY 4.0 ([source](https://commons.wikimedia.org/wiki/File:Restaurant_Bar_Tabac_de_la_Poste_Estrablin_03.jpg))

**Déjà dans le jeu : à garder ou à égaler**

- [photos/17-retraites-a/deja-dans-le-jeu-1.jpg](photos/17-retraites-a/deja-dans-le-jeu-1.jpg) — Panorama world-v2, tiers A : intégration des bâtiments et esprit à garder
- `assets/generated/biomes/street-retraites.png` — Ancienne rue (biomes) : street-retraites
- `assets/generated/biomes/landscape-retraites.png` — Ancien plan intermédiaire (biomes) : landscape-retraites

### Retraités B — station balnéaire type Les Sables-d'Olonne, la mer au fond

*Retraités*

Gabarit : [gabarits/tuile-14-retraites-b.png](gabarits/tuile-14-retraites-b.png) · tuile 14, fresque maître x = 24960 → 26880 px.

**À retenir :** Front de mer, promenade, villas balnéaires, galeries commerçantes, et la mer bien visible au fond.

**Exigences**

- Station balnéaire type Les Sables-d’Olonne, pas haussmannienne : front de mer, promenade, villas balnéaires, galerie commerçante avec la pharmacie du biome (croix verte, sans texte).
- La mer bien visible au fond. Rédaction conservatrice, institut de sondage, place de meeting.

**Premier plan : la rue jouable, façades vues depuis le trottoir**

- [photos/18-retraites-b/premier-plan-1.jpg](photos/18-retraites-b/premier-plan-1.jpg) — Front de mer de La Baule près du casino (octobre 2022) — Florian Pépellin · CC BY-SA 4.0 ([source](https://commons.wikimedia.org/wiki/File:Front_de_mer_de_La_Baule_pr%C3%A8s_du_casino_(octobre_2022).JPG))
- [photos/18-retraites-b/premier-plan-2.jpg](photos/18-retraites-b/premier-plan-2.jpg) — Promenade et galerie commercante du front de mer, Royan. - panoramio — FrenchCobber · CC BY-SA 3.0 ([source](https://commons.wikimedia.org/wiki/File:Promenade_et_galerie_commercante_du_front_de_mer,_Royan._-_panoramio.jpg))
- [photos/18-retraites-b/premier-plan-3.jpg](photos/18-retraites-b/premier-plan-3.jpg) — **La pharmacie du biome (croix verte, sans texte)** — Façade de la pharmacie du Parc (Vichy) (1) 2025-06-15 — Tabl-trai · CC BY-SA 4.0 ([source](https://commons.wikimedia.org/wiki/File:Fa%C3%A7ade_de_la_pharmacie_du_Parc_(Vichy)_(1)_2025-06-15.JPG))

**Arrière-plan : peint dans la même image, en perspective (paysages, silhouettes, monuments)**

- [photos/18-retraites-b/arriere-plan-1.jpg](photos/18-retraites-b/arriere-plan-1.jpg) — Bord de mer Arcachon P1050123 — Pline · CC BY-SA 3.0 ([source](https://commons.wikimedia.org/wiki/File:Bord_de_mer_Arcachon_P1050123.JPG))

**Déjà dans le jeu : à garder ou à égaler**

- [photos/18-retraites-b/deja-dans-le-jeu-1.jpg](photos/18-retraites-b/deja-dans-le-jeu-1.jpg) — Panorama world-v2, tiers B : intégration des bâtiments et esprit à garder — **À ne pas reproduire : les façades d’allure haussmannienne (le bord de mer n’est pas haussmannien).**
- `assets/generated/biomes/distant-retraites.png` — Ancien fond lointain (biomes) : distant-retraites

### Retraités C — banlieue bourgeoise type Neuilly

*Retraités*

Gabarit : [gabarits/tuile-15-retraites-c.png](gabarits/tuile-15-retraites-c.png) · tuile 15, fresque maître x = 26880 → 28800 px.

**À retenir :** Villas en meulière et en brique, grilles, jardins soignés. C'est déjà presque la transition vers les beaux quartiers.

**Exigences**

- Banlieue bourgeoise type Neuilly : villas en meulière et en brique, chacune unique et pleine de caractère (tourelles, décors de brique, grands toits).
- Villas en retrait dans des jardins arborés, derrière grilles et murets, jamais collées. Presque déjà la transition vers les beaux quartiers.
- Permanence = QG d’Attal.

**Premier plan : la rue jouable, façades vues depuis le trottoir**

- [photos/19-retraites-c/premier-plan-1.jpg](photos/19-retraites-c/premier-plan-1.jpg) — Villa Régina à Chaville — Jacques Albert · CC BY-SA 4.0 ([source](https://commons.wikimedia.org/wiki/File:Villa_R%C3%A9gina_%C3%A0_Chaville.jpg))
- [photos/19-retraites-c/premier-plan-2.jpg](photos/19-retraites-c/premier-plan-2.jpg) — Le Vésinet Villa 055 — GFreihalter · CC BY-SA 3.0 ([source](https://commons.wikimedia.org/wiki/File:Le_V%C3%A9sinet_Villa_055.jpg))
- [photos/19-retraites-c/premier-plan-3.jpg](photos/19-retraites-c/premier-plan-3.jpg) — House in Le Vésinet 006 — Moonik · CC BY-SA 3.0 ([source](https://commons.wikimedia.org/wiki/File:House_in_Le_V%C3%A9sinet_006.JPG))

**Déjà dans le jeu : à garder ou à égaler**

- [photos/19-retraites-c/deja-dans-le-jeu-1.jpg](photos/19-retraites-c/deja-dans-le-jeu-1.jpg) — Panorama world-v2, tiers C : intégration des bâtiments et esprit à garder — **À ne pas reproduire : le Sacré-Cœur et la mer au fond, hors de leur territoire.**
- `assets/generated/biomes/street-retraites.png` — Ancienne rue (biomes) : street-retraites

### Transition Retraités → Quartiers riches : le bois de Boulogne

*Transition*

Transition : elle se peint à cheval sur la fin du biome précédent et le début du suivant, progressivement, jamais pile sur une coupe.

**À retenir :** C'est ici qu'est le parc : allées et lacs du bois de Boulogne, avant les avenues cossues du 16e. Pas de La Défense ici.

**Exigences**

- Le parc est ici : allées et lacs du bois de Boulogne, avant les avenues cossues. Pas de La Défense ici.

**Premier plan : la rue jouable, façades vues depuis le trottoir**

- [photos/20-t-retraites-riches/premier-plan-1.jpg](photos/20-t-retraites-riches/premier-plan-1.jpg) — Allée bois de Boulogne 10 — Celette · CC BY-SA 4.0 ([source](https://commons.wikimedia.org/wiki/File:All%C3%A9e_bois_de_Boulogne_10.jpg))

**Arrière-plan : peint dans la même image, en perspective (paysages, silhouettes, monuments)**

- [photos/20-t-retraites-riches/arriere-plan-1.jpg](photos/20-t-retraites-riches/arriere-plan-1.jpg) — Lac inférieur du bois de Boulogne, Paris 12 — Polymagou · CC BY-SA 4.0 ([source](https://commons.wikimedia.org/wiki/File:Lac_inf%C3%A9rieur_du_bois_de_Boulogne,_Paris_12.jpg))

### Riches A — 16e arrondissement, rédaction nationale

*Quartiers riches*

Gabarit : [gabarits/tuile-16-riches-a.png](gabarits/tuile-16-riches-a.png) · tuile 16, fresque maître x = 28800 → 30720 px.

**À retenir :** Avenue haussmannienne cossue et la Maison de la Radio. Pas de parc ici, il est dans la transition. Au fond, la tour Eiffel, les Invalides et le Grand Palais qui ressortent, comme dans distant-riches.

**Exigences**

- Avenue haussmannienne cossue et la Maison de la Radio (rédaction nationale).
- Pas de parc ici. Au fond : la tour Eiffel, les Invalides et le Grand Palais.

**Premier plan : la rue jouable, façades vues depuis le trottoir**

- [photos/21-riches-a/premier-plan-1.jpg](photos/21-riches-a/premier-plan-1.jpg) — Avenue Henri-Martin, Paris 16e 3 — Thank you to indicate this credit line next to the image in case of reuse: Cred · CC BY-SA 4.0 ([source](https://commons.wikimedia.org/wiki/File:Avenue_Henri-Martin,_Paris_16e_3.jpg))
- [photos/21-riches-a/premier-plan-2.jpg](photos/21-riches-a/premier-plan-2.jpg) — GD-FR-Paris-Maison de la Radio — Wikimedia Commons · CC BY-SA 2.5 ([source](https://commons.wikimedia.org/wiki/File:GD-FR-Paris-Maison_de_la_Radio.jpg))

**Déjà dans le jeu : à garder ou à égaler**

- [photos/21-riches-a/deja-dans-le-jeu-1.jpg](photos/21-riches-a/deja-dans-le-jeu-1.jpg) — Panorama world-v2, tiers A : intégration des bâtiments et esprit à garder
- `assets/generated/biomes/distant-riches.png` — Ancien fond lointain (biomes) : distant-riches
- `assets/generated/biomes/street-riches.png` — Ancienne rue (biomes) : street-riches

### Riches B — avenue de luxe, kiosque, tour Eiffel au fond

*Quartiers riches*

Gabarit : [gabarits/tuile-17-riches-b.png](gabarits/tuile-17-riches-b.png) · tuile 17, fresque maître x = 30720 → 32640 px.

**À retenir :** Boutiques de luxe et kiosque à journaux vert au premier plan. La tour Eiffel au fond, centrée sur la place de meeting.

**Exigences**

- Boutiques de luxe et kiosque à journaux vert au premier plan.
- La tour Eiffel au fond, centrée sur la place de meeting.

**Premier plan : la rue jouable, façades vues depuis le trottoir**

- [photos/22-riches-b/premier-plan-1.jpg](photos/22-riches-b/premier-plan-1.jpg) — Christian Dior, 30 Avenue Montaigne, Paris 2016 — Frédéric BISSON from Rouen, France · CC BY 2.0 ([source](https://commons.wikimedia.org/wiki/File:Christian_Dior,_30_Avenue_Montaigne,_Paris_2016.jpg))
- [photos/22-riches-b/premier-plan-2.jpg](photos/22-riches-b/premier-plan-2.jpg) — Kiosque à journaux, avenue Marceau (Paris) en janvier 2020 — Benoît Prieur · CC0 ([source](https://commons.wikimedia.org/wiki/File:Kiosque_%C3%A0_journaux,_avenue_Marceau_(Paris)_en_janvier_2020.jpg))

**Arrière-plan : peint dans la même image, en perspective (paysages, silhouettes, monuments)**

- [photos/22-riches-b/arriere-plan-1.jpg](photos/22-riches-b/arriere-plan-1.jpg) — **Tour Eiffel** — Tour Eiffel vue depuis Jardins Trocadéro Paris 1 — Chabe01 · CC BY-SA 4.0 ([source](https://commons.wikimedia.org/wiki/File:Tour_Eiffel_vue_depuis_Jardins_Trocad%C3%A9ro_Paris_1.jpg))

**Déjà dans le jeu : à garder ou à égaler**

- [photos/22-riches-b/deja-dans-le-jeu-1.jpg](photos/22-riches-b/deja-dans-le-jeu-1.jpg) — Panorama world-v2, tiers B : intégration des bâtiments et esprit à garder
- `assets/generated/biomes/distant-riches.png` — Ancien fond lointain (biomes) : distant-riches
- `assets/generated/biomes/landscape-riches.png` — Ancien plan intermédiaire (biomes) : landscape-riches

### Riches C — Paris classique avec start-up, La Défense au fond

*Quartiers riches*

Gabarit : [gabarits/tuile-18-riches-c.png](gabarits/tuile-18-riches-c.png) · tuile 18, fresque maître x = 32640 → 34560 px.

**À retenir :** Au premier plan, un quartier haussmannien classique avec des start-up de la tech en rez-de-chaussée (photo idéale à fournir). La Défense et la Grande Arche restent au fond.

**Exigences**

- Paris classique avec des start-up de la tech en rez-de-chaussée d’immeubles haussmanniens.
- La Défense et la Grande Arche au fond. Cabinet et institut de sondage.

**Premier plan : la rue jouable, façades vues depuis le trottoir**



**Arrière-plan : peint dans la même image, en perspective (paysages, silhouettes, monuments)**

- [photos/23-riches-c/arriere-plan-1.jpg](photos/23-riches-c/arriere-plan-1.jpg) — La Défense vue depuis la Tour Eiffel — ZarlokX · CC BY-SA 4.0 ([source](https://commons.wikimedia.org/wiki/File:La_D%C3%A9fense_vue_depuis_la_Tour_Eiffel.png))
- [photos/23-riches-c/arriere-plan-2.jpg](photos/23-riches-c/arriere-plan-2.jpg) — Grande Arche, France - April 2011 — Cristian Bortes from Cluj-Napoca, Romania · CC BY 2.0 ([source](https://commons.wikimedia.org/wiki/File:Grande_Arche,_France_-_April_2011.jpg))

**Déjà dans le jeu : à garder ou à égaler**

- [photos/23-riches-c/deja-dans-le-jeu-1.jpg](photos/23-riches-c/deja-dans-le-jeu-1.jpg) — Panorama world-v2, tiers C : intégration des bâtiments et esprit à garder
- `assets/generated/biomes/street-riches.png` — Ancienne rue (biomes) : street-riches

### Transition Riches → Paris 19e (fermeture de la boucle) : concept stores et Sacré-Cœur

*Transition*

Transition : elle se peint à cheval sur la fin du biome précédent et le début du suivant, progressivement, jamais pile sur une coupe.

**À retenir :** La tour Eiffel disparaît presque. On entre dans le Paris bobo : rues commerçantes, concept stores, cafés, et le Sacré-Cœur qui apparaît au bout de la rue. Le métro aérien peut passer en arrière-plan.

**Exigences**

- La tour Eiffel disparaît presque ; on entre dans le Paris bobo : rues commerçantes, concept stores, cafés.
- Le Sacré-Cœur apparaît au bout de la rue ; le métro aérien peut passer en arrière-plan.

**Premier plan : la rue jouable, façades vues depuis le trottoir**

- [photos/24-t-riches-paris/premier-plan-1.jpg](photos/24-t-riches-paris/premier-plan-1.jpg) — Rue de Martyrs Paris 1 — Karibo · CC BY-SA 3.0 ([source](https://commons.wikimedia.org/wiki/File:Rue_de_Martyrs_Paris_1.jpg))
- [photos/24-t-riches-paris/premier-plan-2.jpg](photos/24-t-riches-paris/premier-plan-2.jpg) — Paris 75018 Rue de Steinkerque 20100719 no 013 — Mister No · CC BY 3.0 ([source](https://commons.wikimedia.org/wiki/File:Paris_75018_Rue_de_Steinkerque_20100719_no_013.jpg))

**Arrière-plan : peint dans la même image, en perspective (paysages, silhouettes, monuments)**

- [photos/24-t-riches-paris/arriere-plan-1.jpg](photos/24-t-riches-paris/arriere-plan-1.jpg) — **Métro aérien sur son viaduc** — Metro Paris - Ligne 6 - Station Passy - Viaduc — Greenski · CC BY-SA 3.0 ([source](https://commons.wikimedia.org/wiki/File:Metro_Paris_-_Ligne_6_-_Station_Passy_-_Viaduc.jpg))

## 19. Photos encore à fournir

- Étals du marché de Saint-Denis vus au niveau de la rue (Banlieue B).
- Paris haussmannien avec des start-up en rez-de-chaussée (Riches C).
- Ferme maraîchère avec un garage à l’entrée (Campagne A).
- Fromagerie vue de face (Paris B).

## 20. Crédits des photos

Photos de Wikimedia Commons sous licences libres, et une photo de référence personnelle (lotissement). Les extraits world-v2 et biomes sont des images du jeu.

- Terrasse de café, 188 avenue de Versailles, Paris 16e.jpg — Thank you to indicate this credit line next to the image in case of reuse: Cred — CC BY-SA 4.0
- Immeuble 36 Rue Crimée - Paris XIX (FR75) - 2024-08-19 - 1.jpg — Chabe01 — CC BY-SA 4.0
- Devanture Boulangerie 159 rue Ordener.jpg — KoS — CC BY-SA 3.0
- Boulangerie Patisserie La Parisienne, 28 rue Monge, 75005 Paris, 15 January 2017.jpg — besopha — CC BY 2.0
- Marché dAligre 4.jpg — Jesús Gorriti from Madrid, Spain — CC BY-SA 2.0
- Paris - Basilique du Sacré-Cœur de Montmartre - 2025-09-30 23-31-57 001.jpg — Giò Terra (Terragio67) — CC BY-SA 4.0
- Boulevard Macdonald - Paris XIX (FR75) - 2021-06-02 - 1.jpg — Chabe01 — CC BY-SA 4.0
- Passerelle des écluses de la Villette, canal Saint-Martin, 17 août 2015.jpg — Benoît Prieur — CC0
- Porte de Pantin y peripherique.jpg — Auteur sur Commons — CC BY-SA 3.0
- Porte de La Villette, Paris 9 May 2013.jpg — Guilhem Vellut from Tokyo, Japan — CC BY 2.0
- Paris 19e Pont du canal de l'Ourcq Grands Moulins de Pantin 356.jpg — GFreihalter — CC BY-SA 4.0
- La Courneuve 4000 logements - AM La Courneuve 8Fi337.jpg — Auteur sur Commons — CC BY-SA 4.0
- Nanterre.jpg — Quispiam — CC0
- Cité pablo picasso nanterre.jpg — Auteur sur Commons — Public domain
- Marché dAligre 3.jpg — Jesús Gorriti from Madrid, Spain — CC BY-SA 2.0
- Rue République - Saint-Denis (FR93) - 2022-01-01 - 2.jpg — Chabe01 — CC BY-SA 4.0
- Ouest Basilique Saint-Denis Place.jpg — Thomon — CC BY-SA 4.0
- Rue Pavillons - Montreuil (FR93) - 2020-10-23 - 1.jpg — Chabe01 — CC BY-SA 4.0
- Mosquée de Gennevilliers.jpg — Mosquee-gennevilliers — CC BY-SA 4.0
- Aire d'accueil des gens du voyage de Beynost en avril 2023.JPG — Benoît Prieur — CC0
- Autoroute A1 - Saint-Denis (FR93) - 2026-09-15 - 5.jpg — Chabe01 — CC BY-SA 4.0
- Zone industrielle de Biars-sur-Cère.jpg — Lucas Destrem — CC BY-SA 4.0
- Remiremont - carrefour giratoire du faubourg d'Épinal - 3.jpg — Mathieu Kappler — CC BY-SA 4.0
- Armentières maisons de briques 2016 01.jpg — Lamiot — CC BY-SA 4.0
- Remiremont - faubourg d'Épinal le long de la zone commerciale - 1.jpg — Mathieu Kappler — CC BY-SA 4.0
- Montbéliardes (2).jpg — Gzen92 — CC BY-SA 4.0
- Haute-vallée de l'Arve-1 (2017).jpg — B. Brassoud — CC BY-SA 4.0
- Mont Blanc @ Sallanches.jpg — Rémih — CC BY-SA 4.0
- Bocage normand GR 221.jpg — Goéland — CC BY-SA 4.0
- Cluse de Chambéry et Belledonnes depuis le Mont du Chat (avril 2018).JPG — Florian Pépellin — CC BY-SA 4.0
- Serre de tomates - Fraisochamps - Thil.JPG — Benoît Prieur — CC0
- Serre-les-Sapins, les terres agricoles.jpg — Wikipedro — CC BY-SA 4.0
- Rue du Four, Flavigny-sur-Ozerain - Maison de l'Écuyer and Maison Lacordaire (35093451593).jpg — Elliott Brown from Birmingham, United Kingdom — CC BY-SA 2.0
- Roussillon - Place de la Mairie (5849020860).jpg — Elliott Brown from Birmingham, United Kingdom — CC BY 2.0
- Village square and monument aux morts in Dracy-le-Fort 1996.jpg — JopkeB — CC BY-SA 4.0
- Saint-Macoux 86 Église&place 2013.jpg — JLPC — CC BY-SA 3.0
- Monument aux morts éoliennes silo Pré-Saint-Martin Eure-et-Loir France.jpg — Le Passant — CC BY-SA 4.0
- Eoliennes Beauce (1).JPG — Remi Jouan — CC BY-SA 3.0
- Lotissement Village - Garnerans (FR01) - 2025-06-07 - 1.jpg — Chabe01 — CC BY-SA 4.0
- Villabé - 2018-12-13 - IMG 9273.jpg — Poudou99 — CC BY-SA 4.0
- Luzarches (95), rue du Parisis.jpg — P.poschadel — CC BY-SA 2.0 fr
- Front de mer de La Baule près du casino (octobre 2022).JPG — Florian Pépellin — CC BY-SA 4.0
- Promenade et galerie commercante du front de mer, Royan. - panoramio.jpg — FrenchCobber — CC BY-SA 3.0
- Bord de mer Arcachon P1050123.JPG — Pline — CC BY-SA 3.0
- Le Vésinet Villa 055.jpg — GFreihalter — CC BY-SA 3.0
- House in Le Vésinet 006.JPG — Moonik — CC BY-SA 3.0
- Villa Régina à Chaville.jpg — Jacques Albert — CC BY-SA 4.0
- Allée bois de Boulogne 10.jpg — Celette — CC BY-SA 4.0
- Lac inférieur du bois de Boulogne, Paris 12.jpg — Polymagou — CC BY-SA 4.0
- Avenue Henri-Martin, Paris 16e 3.jpg — Thank you to indicate this credit line next to the image in case of reuse: Cred — CC BY-SA 4.0
- GD-FR-Paris-Maison de la Radio.jpg — Auteur sur Commons — CC BY-SA 2.5
- Christian Dior, 30 Avenue Montaigne, Paris 2016.jpg — Frédéric BISSON from Rouen, France — CC BY 2.0
- Kiosque à journaux, avenue Marceau (Paris) en janvier 2020.jpg — Benoît Prieur — CC0
- Grande Arche, France - April 2011.jpg — Cristian Bortes from Cluj-Napoca, Romania — CC BY 2.0
- La Défense vue depuis la Tour Eiffel.png — ZarlokX — CC BY-SA 4.0
- Paris 75018 Rue de Steinkerque 20100719 no 013.jpg — Mister No — CC BY 3.0
- Rue de Martyrs Paris 1.jpg — Karibo — CC BY-SA 3.0
- Osny - Lotissement près du stade,pavillons individuels - Rue du Cèdre.jpg — Région Île-de-France — Licence Ouverte
- Intermarché de Saint Marcel.jpg — Rémi Simonnin — CC BY-SA 4.0
- Vallée de Magland vue du Chevran - panoramio.jpg — marsupilami51 — CC BY 3.0
- Mérignies, Chat pylons de la ligne haute tension en 2022.jpg — Pierre André Leclercq — CC BY-SA 4.0
- Tour Eiffel vue depuis Jardins Trocadéro Paris 1.jpg — Chabe01 — CC BY-SA 4.0
- Metro Paris - Ligne 6 - Station Passy - Viaduc.jpg — Greenski — CC BY-SA 3.0
- Boucherie Lamartine.jpg — Oderik — CC BY-SA 3.0
- Stade de Foot Estrablin 02.jpg — Jlgay38 — CC BY 4.0
- La ligne haute tension entre Avelin et Tourmignies.jpg — Pierre André Leclercq — CC BY-SA 4.0
- Water tower, Lisieux-2895.jpg — Raimond Spekking — CC BY-SA 4.0
- Mairie-école de Courtavon.jpg — Espirat — CC BY-SA 4.0
- Légny - Boulodrome (juil 2023).jpg — Sebleouf — CC BY-SA 4.0
- TER Alstom Régiolis n°84675.jpg — Dacia 1410 Sport — CC BY-SA 4.0
- Vignoble et église de Cruet (octobre 2021).JPG — Florian Pépellin — CC BY-SA 4.0
- Coye-la-Forêt (60), place de la Mairie, bar-tabac-PMU 'Le Régent', à dr. l'école du centre.jpg — P.poschadel — CC BY-SA 2.0 fr
- Restaurant Bar Tabac de la Poste Estrablin 03.jpg — Jlgay38 — CC BY 4.0
- Façade de la pharmacie du Parc (Vichy) (1) 2025-06-15.JPG — Tabl-trai — CC BY-SA 4.0
