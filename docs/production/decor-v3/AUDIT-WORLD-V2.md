# Audit visuel de world-v2 — 1er octobre 2026

Cet audit décrit l’état avant correction. Une première reprise de Banlieue B a ensuite été intégrée : voir [le pilote peint](BANLIEUE-B-PILOTE.md). Les comparatifs de cet audit conservent volontairement l’état rejeté comme référence.

La version « expanded » ne satisfait pas la demande : elle remplace la composition des panoramas par un assemblage d’éléments indépendants. Elle corrige certaines formes et l’échelle des portes interactives, mais dégrade la perspective, la lisibilité des lieux, les raccords et le mouvement du décor. **Je ne valide aucune des 18 sous-zones comme une amélioration graphique complète de l’original.** Ce jugement porte sur le rendu d’ensemble ; certains nouveaux bâtiments sont plus proches du CDC.

## Ce qui a été comparé

- Les six panoramas originaux, conservés dans `assets/generated/world-v2/panorama-*.png`.
- Les 18 sous-zones actuelles, au centre et à huit unités de chaque côté, au zoom du jeu : 54 captures.
- Les six frontières entre biomes, y compris la fermeture de la boucle.
- Le CDC HTML et le tableau joint. Quand ils diffèrent, le storyboard détaillé précise le lieu : par exemple, le parc des quartiers riches appartient à la transition, pas à Riches A.
- La branche historique de rendu des panoramas, réactivée uniquement dans un navigateur d’audit : 18 captures au même zoom et avec les positions actuelles des bâtiments. Aucun fichier du moteur n’a été remplacé pour cette comparaison.

Les planches comparent un **tiers de l’image originale** avec une **capture actuelle dans le jeu**. Elles servent à comparer la facture et la composition, pas à mesurer l’échelle : leurs cadrages diffèrent. Les images gardent leurs proportions. Le comparateur propose aussi l’ancien rendu au même zoom pour constater son défaut d’échelle initial.

Le contrôle est effectué en été, sur ordinateur, avec un joueur et sans foule. Les vues gauche/centre/droite montrent les changements de cadrage ; elles ne constituent pas une validation de l’animation sur tous les appareils. La cause du défaut de parallaxe est vérifiée séparément dans le code.

## Bilan des 18 sous-zones

« Partiel » signifie que certains éléments attendus sont présents, mais que le lieu ne respecte pas encore son cahier des charges. Un élément caché ou illisible dans le jeu ne compte pas comme une exigence satisfaite.

| Sous-zone | Conformité au CDC et au tableau | Comparaison graphique avec l’original et correction nécessaire |
|---|---|---|
| **Paris A** | **Partiel.** Café et permanence présents. Le concept store n’est pas clairement identifiable ; la pente et l’escalier ne structurent plus la rue comme dans l’original. | **Moins cohérent.** Les mêmes commerces alimentaires que Paris B occupent le fond. Garder la terrasse, l’escalier et les différences de niveaux de l’original ; prolonger cette rue autour du QG, sans copier le groupe de commerces partout. |
| **Paris B** | **Partiel.** Garage et pictogrammes des métiers de bouche présents. Les étals du marché sont cachés derrière les grilles fleuries ; le Sacré-Cœur dépasse d’un mur de façades, sans vraie montée de quartier. | **Moins joli et moins lisible.** L’ouverture en profondeur de l’original a disparu. Conserver les commerces de bouche, ouvrir la place et montrer les étals à hauteur de rue ; ménager une vue sur la colline et le Sacré-Cœur. Le marché était déjà insuffisamment développé dans l’ancien panorama parisien. |
| **Paris C** | **Partiel.** Permanence et institut présents, avec une façade moderne pour l’institut. Le canal ne se lit plus comme un passage avec pont et écluse ; le quartier reste dominé par les commerces répétés. | **Régression nette.** L’eau, les quais et la perspective de l’original ont presque disparu de la vue centrale. Réintroduire le passage du canal vers B/C et une vraie progression du haussmannien vers le moderne, puis vers le périphérique. |
| **Banlieue A** | **Partiel.** Tour Aillaud, grande tour rectangulaire et média au pied d’un immeuble : intentions pertinentes. L’implantation sur des pelouses et l’isolement des tours restent insuffisamment exprimés. | **Forme Aillaud améliorée, composition dégradée.** Le grillage fleuri répété et les fonds empilés donnent un effet de collage. Garder les tours gigantesques — leur sortie du cadre est voulue — mais organiser leurs pieds, les pelouses et le local associatif dans une seule scène cohérente. |
| **Banlieue B** | **Non sur l’identité principale.** Il y a une permanence, une boulangerie et une basilique. Mais seuls les toits des étals dépassent : les produits et les stands sont masqués. Des barres d’habitation remplissent le fond au lieu d’une vieille rue commerçante de Saint-Denis. | **Régression majeure.** L’original montrait un vrai marché ouvert vers la basilique. Reprendre cette composition, garder les étals visibles derrière ou sur les côtés de la place de meeting, retirer les haies devant eux et ouvrir le fond. |
| **Banlieue C** | **Partiel.** Local SO renforcé, maisons modestes et minaret présents. Les maisons décoratives sont le même couple répété ; l’usure et la suroccupation sont peu exprimées. La mosquée se réduit principalement à son minaret derrière les barres. | **Moins naturel.** Les façades restent joliment dessinées individuellement, mais leur répétition et le grillage continu affaiblissent le quartier. Varier des maisons réellement fatiguées et serrées ; garder des barres plus basses et larges au fond, avec une mosquée reconnaissable. |
| **Périurbain A** | **Partiel.** Petites maisons récentes, QG et grand entrepôt correspondent au thème. Le barbecue et les jardins ne sont pas lisibles dans les vues contrôlées. L’entrepôt dupliqué envahit le quartier. | **Moins riche et moins équilibré.** L’original articulait jardins, industrie et relief lointain. Composer un vrai lotissement modeste et répétitif dans son architecture, avec des jardins distincts ; placer un grand entrepôt réellement au loin, plutôt qu’en remplissage de toute la vue. |
| **Périurbain B** | **Partiel.** Garage en brique et sculpture de coq présents. Le giratoire lui-même n’est pas lisible comme une organisation de la rue ; les maisons de brique et la zone artisanale sont peu développées. | **Moins cohérent.** Le coq dépasse de la haie devant un mur d’entrepôts. L’ancien panorama avait une rue qui s’enfonçait vers le rond-point. Restaurer cette perspective et construire la place autour du giratoire, en gardant le centre jouable libre. |
| **Périurbain C** | **Partiel.** QG et massif alpin présents. Le sommet déborde du cadre ; le premier plan de pâturages et de vaches ainsi que la vallée industrielle se lisent mal derrière l’entrepôt continu. | **Régression forte.** Le massif agrandi est flou et écrase la scène. Reprendre la hiérarchie de l’original : élevage près du joueur, ville industrielle dans la vallée, Mont-Blanc derrière, avec ses arêtes et son sommet visibles. |
| **Campagne A** | **Partiel.** Serres, cultures et garage rural présents. Le garage paraît indépendant de la ferme, loin des serres. Les montagnes répétées occupent le fond agricole. | **Moins joli malgré de bonnes serres.** L’original liait jardin, mur, serres et grange ; les nouveaux éléments ont des pieds et des échelles indépendants. Prolonger l’exploitation autour d’un garage intégré à son entrée ; faire redescendre le massif vers le bocage. |
| **Campagne B** | **Partiel.** Mairie avec deux drapeaux, maisons en pierre, clocher et monument présents. Le monument est largement masqué par la haie et l’estrade ; l’église apparaît sur une plaque de paysage au contour visible. | **Régression nette.** La place ouverte de l’original devient un jardin fermé. Composer une vraie place avec les maisons, la mairie et le monument lisible sur son côté, sans gêner le meeting ; garder le clocher derrière les toits et un relief doux. |
| **Campagne C** | **Partiel.** SO, blé, silo, petit monument et éoliennes présents. Le village/clocher est trop dominant et les montagnes continuent de remplir l’horizon. | **Moins équilibré.** Les champs ouverts de l’original sont remplacés par un fond montagnard dupliqué et un petit morceau de blé. Donner la largeur aux champs ; diminuer le village et garder les éoliennes au loin. |
| **Retraités A** | **Partiel.** Garage ordinaire, QG et haies présents. On ne lit pas suffisamment une rue de pavillons en retrait avec leurs pelouses ; barbecue et boulodrome ne sont pas clairement identifiables. | **Moins cohérent.** Le fond est une mosaïque de villas et de paysages répétés. Garder les jardins entretenus et le garage de quartier, avec des maisons séparées et une continuité de murets et de trottoir. |
| **Retraités B** | **Partiel.** Mer visible, rédaction et institut intégrés à des maisons plutôt qu’à une avenue haussmannienne : progrès sur le type architectural. La pharmacie, les boutiques de plage, les cabines et la promenade ne structurent pas la place centrale. | **Pas au niveau graphique de l’original.** La mer et la ville sont en bandes répétées ; une haie ferme la place vers le front de mer. Garder le changement architectural, mais retrouver une ouverture vers la mer, une promenade et des commerces balnéaires visibles. L’ancien panorama avait lui aussi une architecture trop haussmannienne ici. |
| **Retraités C** | **Partiel, avec un progrès réel.** Deux villas différentes en brique, dont une à tourelle, et QG d’Attal : plus proches du CDC que les façades de l’ancien panorama. Jardins et recul des maisons restent insuffisamment articulés. | **Meilleurs bâtiments isolés, ensemble encore insuffisant.** Le lac boisé répété occupe toute la sous-zone alors que le bois de Boulogne doit surtout annoncer la transition suivante. Garder la personnalité des villas ; dessiner leurs jardins, grilles et chemins d’accès ensemble. |
| **Riches A** | **Partiel, avec un progrès réel.** La rédaction prend la forme ronde de la Maison de la Radio. Le tissu haussmannien est présent. Eiffel/Invalides/Grand Palais ne sont pas tous clairement lisibles depuis la rue. | **Composition moins élégante.** La Maison de la Radio est juxtaposée à des façades répétées, et le monument de fond est mal cadré. Intégrer son volume dans l’avenue et réserver des trouées vers les monuments. |
| **Riches B** | **Partiel.** Permanence et façades de boutiques présents. Le kiosque est noyé derrière les roses ; Eiffel est largement cachée par le mur de façades et déborde du cadre. | **Régression majeure.** L’original organisait toute l’avenue autour d’une perspective sur Eiffel. Retrouver cette ouverture au centre du meeting et mettre le kiosque vert à hauteur de rue, à côté de la place. |
| **Riches C** | **Partiel.** Cabinet, institut et silhouette de La Défense présents. Les start-up ne se distinguent pas clairement ; la Grande Arche est trop grande et coupée en haut de la vue centrale. | **Moins lisible et moins naturel.** Le fond est flou, les façades ferment la perspective et le cabinet a des panneaux peints latéraux tandis que son nom est posé au-dessus de la porte. Prévoir un panneau vierge au bon endroit, une rue classique avec tech au rez-de-chaussée et une skyline plus lointaine, entièrement lisible. |

## Pourquoi la parallaxe ne fonctionne pas

La parallaxe consiste à faire défiler ensemble les éléments d’un même plan, avec une vitesse plus faible pour le fond. Dans `world-v2-expanded.js`, `expandedProjection` réduit le déplacement près du centre avec une fonction `tanh`, puis limite cette réduction quand l’élément s’en éloigne.

Pour un élément du plan lointain, annoncé à 30 % de la vitesse de la rue et associé à une sous-zone de 24 unités, la vitesse effective est environ : **30 % au centre, 80 % à six unités, 98 % à douze unités**. Deux éléments du même plan n’ont donc pas la même vitesse à un instant donné. Ils glissent les uns par rapport aux autres et finissent par se déplacer presque comme la rue. La limite dépend aussi de la largeur associée à chaque élément. Ce n’est pas une perspective stable.

Autres causes observées :

- Les silhouettes de fond sont répétées quatre fois par sous-zone, avec peu de variations : commerces parisiens, barres, entrepôts et paysages alpins. Cela produit les murs continus interdits par le CDC.
- Les haies/grillages reviennent tous les 3,2 unités et sont dessinés devant les étals et petits monuments. Ils assurent du remplissage, mais détruisent leur lisibilité.
- Les bâtiments interactifs sont calibrés sur une porte ; les autres sprites sont ajustés indépendamment à une largeur et une hauteur maximales. Les étages, arbres et bâtiments voisins ne partagent donc pas une échelle architecturale commune.
- Les paysages issus de petites cellules sont beaucoup agrandis : la montagne, le village, la mer et les skylines sont nettement moins précis que les façades.
- Des contours rectangulaires subsistent. Les paysages de la nouvelle planche `landscapes` échappent à la correction de contour appliquée à certains autres sprites ; des morceaux de relief s’arrêtent verticalement, particulièrement à la transition Périurbain → Campagne et derrière Campagne B.
- Il n’y a pas de traitement atmosphérique spécifique suffisant pour éloigner visuellement les monuments : les filtres utilisés sont surtout saisonniers. Un fond agrandi et très contrasté paraît proche.

Les tests précédents vérifiaient le chargement des assets, les enseignes, les calculs de portes et le bouclage de la carte. **Ils ne prouvaient ni la conformité visuelle au CDC, ni la qualité graphique, ni une bonne parallaxe.** Ma précédente validation était donc trop large.

## Les six raccords

| Raccord | Constat visuel |
|---|---|
| Paris → Banlieue | Le pont, l’eau et les bâtiments industriels donnent un thème pertinent, mais leur faible précision et le changement brusque des grilles et des pieds de façades révèlent l’assemblage. |
| Banlieue → Périurbain | Caravanes présentes, mais très masquées ; le terrain vague et le portail ne forment pas une transition lisible. L’entrepôt apparaît comme une grande paroi ajoutée. |
| Périurbain → Campagne | Échec particulièrement visible : massif énorme, sommet hors cadre et bord vertical du relief. La descente progressive vers le bocage n’est pas obtenue. |
| Campagne → Retraités | Premier lotissement et pins présents, mais morceaux de montagnes, de champs et de villas se juxtaposent avec des contours visibles. |
| Retraités → Riches | Le lac boisé est une bonne intention, et La Défense n’occupe pas cette frontière. Mais le fond flou et les socles séparés des villas/immeubles empêchent un raccord naturel. |
| Riches → Paris | Café, escalier, métro aérien et Sacré-Cœur apportent de bons indices. La Défense reste pourtant très présente côté gauche ; elle ne cède pas progressivement la place au Paris bobo. |

## Direction de correction

Repartir des six panoramas originaux comme base visuelle, avec leurs perspectives, leurs couleurs et leurs bâtiments intégrés. Les prolonger par peinture de contenu supplémentaire, autour des positions du jeu ; ne pas les étirer et ne pas remplir la largeur par multiplication des mêmes sprites. Les ajouts au CDC doivent se faire dans ces scènes : vrais marchés visibles, vrais jardins, architecture propre à chaque sous-zone, ouvertures vers les monuments.

Le dimensionnement doit partir de la porte et de l’étage, puis déterminer la largeur à peindre. Pour une largeur de biome de 72 unités, la cible à l’échelle livrée du CDC est **72 × 80 = 5 760 px**. Ce repère n’autorise pas un redimensionnement indépendant en largeur. Le facteur uniforme est celui qui donne une porte d’environ 184 px pour un personnage de 162 px ; la largeur restante doit contenir de nouveaux bâtiments, jardins et perspectives.

La priorité issue de ta dernière demande est la fidélité aux originaux et leur prolongement. Le CDC demande également une vraie profondeur en plans : elle doit être réalisée avec des images cohérentes par plan et des vitesses stables, puis contrôlée en déplacement. Ajouter artificiellement cinq plans à des sprites indépendants ne satisfait pas cette exigence. Une simple extension d’un panorama peint d’un bloc ne suffirait pas non plus à valider la parallaxe du CDC.

Pour la prochaine correction, le cas pilote le plus révélateur est **Banlieue B** : le marché, la rue commerçante et la basilique doivent tous être lisibles, à l’échelle des joueurs, avant de réutiliser la méthode ailleurs. Paris B, le massif Périurbain C → Campagne A et Riches B sont les autres défauts prioritaires. La validation doit porter sur le centre, les déplacements, les raccords et la comparaison avec les originaux — pas seulement sur le fait que les fichiers se chargent.

## Fichiers de comparaison

- Comparateur : `artifacts/world-v2-audit/index.html` (à ouvrir dans un navigateur).
- Planches : `artifacts/world-v2-audit/comparatif-*.png`.
- Vues du jeu : `artifacts/world-v2-audit/<sous-zone>-gauche.png`, `-centre.png`, `-droite.png` et `-ancien-jeu.png`.
- Captures des frontières : `artifacts/world-v2-audit/raccord-*.png`.
- Méthode de capture reproductible : `scripts/audit-world-v2.mjs`.

Cette passe produit un audit et des comparatifs. Elle ne remplace aucun panorama et ne corrige pas encore le rendu du jeu.
