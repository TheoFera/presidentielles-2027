# Présidentielles 2027 — troisième jalon jouable

La version 0.3.0 ajoute les combats, la défense territoriale, les raids, le Cabinet administratif et les trois pouvoirs. Caméra, échelle, boucle du monde, recrutement, rareté des Neutres et boucle économique validés sont conservés. **Les Militants marchent désormais à 2,4 unités/s au lieu de 3,2**, contre 3,6 pour le joueur. Leur vitesse de marche est également plafonnée à deux fois celle du joueur.

## Lancer

Double-clique sur **Lancer le jeu.cmd**, puis garde son terminal ouvert. Adresse : **http://localhost:2027**.

Autre méthode, dans ce dossier :

~~~powershell
npm.cmd start
~~~

Node.js 20 ou plus récent, aucune dépendance à installer. La validation utilise Node.js 22.14.0. Ctrl+C arrête le serveur. Ne lance pas directement index.html : les JSON nécessitent le serveur local.

## Jouer et combattre

| Contrôle | Action |
| --- | --- |
| ← →, Q / D ou A / D | Marcher et choisir la direction |
| Espace ou J | Une attaque : léger → léger → fort |
| H, Échap ou P | Aide et pause / reprise |
| F | Plein écran |
| F3 | Débogage |

Trois appuis espacés d’environ **0,4 à 0,5 seconde** permettent d’enchaîner le combo. Garde la cible devant toi et avance entre les coups si elle recule. Au-delà de **0,7 seconde depuis le début du coup précédent**, le combo repart au premier coup. Un appui bref est conservé entre deux ticks ; maintenir une touche ne produit pas une rafale automatique.

Les coups ont une préparation, une courte phase active puis une récupération. La préparation est d’environ 0,10 s pour un léger, 0,13 s pour un fort à 30 ticks/s. Les impacts arrêtent brièvement les acteurs touchés et produisent un recul ; le troisième coup est visuellement plus marqué. La caméra garde son fonctionnement habituel.

Sur tactile, les zones de marche sont conservées et un petit bouton **Frapper** apparaît. Le centre du jeu ouvre l’aide. Le tactile n’a pas été vérifié sur téléphone physique.

### Valeurs des combats

| Élément | Réglage |
| --- | --- |
| Résistance interne S / M / SO | **30 / 30 / 90** |
| Dégâts léger / léger / fort | **8 / 8 / 14** |
| Impulsion de recul léger / fort | **2,2 / 4,8 unités/s**, amorties |
| Portée léger / fort | **2 / 2,4 unités**, plus rayon de cible 0,35 |
| Étourdissement | 0,16 s, arrondi à 5 ticks |
| Perte électorale léger / fort reçu par un candidat | **0,03 / 0,07 point**, au total dans ses zones contrôlées |
| Militant : attaque verbale | 4 de résistance ou 0,025 point électoral ; portée 5 ; intervalle 1,15 s |
| SO : attaque | 9 de résistance ou 0,06 point électoral ; portée 1,6 ; intervalle 0,9 s |
| Charge spéciale | **10 points** ; léger réussi +1, fort réussi +2 |

Aucune résistance, jauge ou valeur électorale n’est affichée dans le jeu normal. Les candidats n’ont pas de PV et ne meurent pas. Les unités démobilisées deviennent grises, perdent leur affiliation et leur influence, cessent de combattre et marchent jusqu’à leur point social d’origine. Elles y redeviennent Neutres.

Les Militants utilisent des bulles-projectiles et gardent leurs distances ; ils privilégient candidats, Militants, SO et unités temporaires adverses. Hors affrontement, ils reprennent leur prospection et leur persuasion.

## Services d’ordre et Cabinet

Tous les paiements demandent **2 secondes de présence continue**. S’éloigner annule sans dépense. Aucun clic ni bouton d’achat.

### Mélenchon et Le Pen : Local SO

- **5 S dans la sous-zone**, non consommés, débloquent le Local à **70 k€**.
- Au centre de la porte : équipement à **20 k€**. Il faut un **Militant disponible dans le biome**, pas un Sympathisant.
- Le Militant disponible le plus proche reçoit la tâche ; en cas d’égalité, son ID départage. Il vient physiquement chercher l’équipement. Préparation : **6 s**, retrait : **1 s**, puis SO.
- File maximale : **3 équipements**. Rester au centre permet plusieurs achats si des Militants restent disponibles.
- Le SO défend le **biome de son Local d’équipement** : il intercepte les intrus candidats, Militants et autres combattants, puis reprend sa garde après leur départ.
- À gauche ou à droite : billet **RAID à 45 k€**. Les SO disponibles du biome partent dans cette direction pendant **18 s maximum**, puis reviennent. Délai entre deux raids : **35 s** depuis le paiement.
- Le repère **↑**, juste à droite de la porte, sert à améliorer. Niveaux 2/3 : **95 / 140 k€**. Équipement : **18 / 15 k€** ; préparation : **5 / 4 s**. Éloigne-toi puis reviens pour chaque amélioration.

### Philippe : Cabinet administratif

Philippe ne peut jamais produire de SO permanent. Son emplacement factionnel devient un Cabinet.

- Construction : **5 S locaux et 80 k€**.
- Côté gauche / droit : la cible admissible la plus proche en suivant ce sens de la boucle apparaît au-dessus du billet.
- Fermeture : **120 k€** au niveau 1, délai de réutilisation **20 s**.
- La cible ferme, perd tous ses niveaux et cesse de produire ses effets. Son propriétaire doit revenir payer le prix de construction ; elle repart alors au niveau 1.
- Les Imprimeries neutres et les Cabinets sont exclus des cibles.
- Repère ↑ : améliorations à **110 / 160 k€** ; fermeture à **105 / 90 k€** aux niveaux 2/3.

Les bâtiments déjà validés restent inchangés : Permanence 2 S et 35 k€, tract 12 k€, Financement 4 S et 55 k€. Le guide du deuxième jalon est conservé dans **GUIDE_JALON_2.md**.

## Les trois pouvoirs

Quand la charge atteint 10, les yeux du candidat brillent. **Le prochain appui sur la même touche d’attaque déclenche le pouvoir et remet la charge à zéro.** Aucun bouton spécial ni jauge supplémentaire.

| Candidat | Fonctionnement |
| --- | --- |
| Mélenchon | **5 hologrammes pendant 7 s**. Ils détectent les adversaires proches, se ruent sur eux à 5,5 unités/s et frappent : 7 de résistance, recul 2,5. Ils ne recrutent pas et ne produisent pas d’influence. |
| Le Pen | Vague bleu marine dans la direction regardée, **0,9 écran à 15 unités/s**. Un S est démobilisé ; un M perd **85 % de sa résistance maximale**, un SO **35 %**. Un candidat perd **0,3 point** dans ses territoires contrôlés. Recul : **8**. Le Pen reste sur place. |
| Philippe | **1 CRS à gauche et 1 à droite pendant 9 s**. Ils suivent Philippe, bloquent l’approche, interceptent les projectiles et frappent au contact : 12 de résistance, recul 4,5. Résistance interne : 120 chacun. Aucune unité permanente n’est créée. |

Hologrammes et CRS disparaissent à expiration, ou avant s’ils sont neutralisés. Les hologrammes ont 15 de résistance interne. Les attaques des pouvoirs ne rechargent pas la charge spéciale.

## Essayer rapidement

Ouvre F3, clique sur **Pause (F4)**, puis ouvre « Déplacements, fonds de test et sauvegardes » et importe l’un des fichiers ci-dessous. Clique ensuite sur **Reprendre (F4)** et masque F3 pour observer. Les scènes utilisent les réglages normaux, mais préparent explicitement des unités et ressources de débogage. Elles ne représentent pas une progression naturelle depuis zéro.

| Sauvegarde dans artifacts/ | Test |
| --- | --- |
| jalon3-duel.json | Militant adverse à proximité : approcher, frapper, observer les slogans et pertes électorales |
| jalon3-1so.json / jalon3-2so.json / jalon3-3so.json | Comparer la difficulté face à 1, 2 ou 3 SO |
| jalon3-hologrammes.json | Mélenchon, pouvoir chargé : appuyer sur J ou Espace |
| jalon3-vague.json | Le Pen, pouvoir chargé : même commande |
| jalon3-crs.json | Philippe, pouvoir chargé : même commande, puis marcher avec le mur |
| jalon3-equipement.json | Local construit, équipement payé, Militant en route |
| jalon3-retrait-so.json | Militant npc:31 en train de prendre son équipement ; il devient SO après environ 1 s |
| jalon3-raid.json | Candidat sur le côté droit du Local : rester pour payer le raid puis suivre les SO |
| jalon3-cabinet.json | Philippe devant le billet de fermeture d’un Financement adverse niveau 3 |
| jalon3-reconstruction.json | Mélenchon devant le Financement fermé : rester pour payer sa reconstruction |

Pour vérifier un combo complet simplement : F3 → I pour suspendre les candidats IA → F7 pour créer un S adverse devant toi → trois appuis rapprochés sur J. Le débogage doit montrer 8, 8, 14, puis le rôle « Retour à l’origine ». Un adversaire Militant peut riposter et reculer : la portée compte.

Les cinq sauvegardes **jalon2-*.json** ont aussi été régénérées et restent importables pour revoir la boucle économique validée.

## Débogage

Les raccourcis ci-dessous exigent F3 ouvert. Les commandes sont appliquées au prochain tick : reprendre le jeu si nécessaire.

| Raccourci | Action |
| --- | --- |
| F4 / F6 | Pause / vitesse ×4 |
| 1 / 2 / 3, ou & / é / " | Contrôler Mélenchon / Le Pen / Philippe |
| I | Suspendre / activer les candidats IA ; les unités autonomes continuent |
| F7 / F8 / F9 | Créer un S / M / SO devant le candidat |
| K | Remplir la charge spéciale |
| X | Démobiliser le PNJ inspecté |
| G | Ajouter 200 k€ de test |
| Y | Donner au candidat le contrôle de sa sous-zone pour mesurer les dégâts électoraux |
| B / T / N / L | Rejoindre Permanence / Imprimerie / Financement / Local SO ou Cabinet |
| C / [ / ] | Neutre le plus proche / sous-zone précédente / suivante |

Dans « Essais de combat et pouvoirs », choisis le camp des unités créées : **Adversaire** par défaut, **Allié**, ou un candidat précis. Pour préparer un Local, choisis Allié, crée cinq S, puis un M. Philippe reste exclu des SO, même avec ces commandes.

Le panneau montre les origines, tâches, raids, résistance, charge, dégâts électoraux, dernier impact, préparation et récupération, combo, revenus, coûts et files. Les rectangles d’attaque n’apparaissent qu’en F3. Tu peux inspecter et rejoindre une unité ou un bâtiment par sa liste. Les champs de saisie gardent leurs propres touches ; cliquer dans le jeu rend le clavier au personnage.

## Réglages et hypothèses

Les valeurs sont dans **Présidentielles 2027/game_balance.json** :

- **candidate_combat** : dégâts, portée, recul, anticipation, combo, récupération, étourdissement et tampon des appuis.
- **physical_units.militant / service_ordre** : vitesses, durabilités, attaques, garde, coût et durée des raids.
- **special_charge / specials** : charge et valeurs des trois pouvoirs.
- **buildings.faction_slot_melenchon_lepen_service_ordre** : seuil, construction, améliorations, équipement et file.
- **buildings.faction_slot_philippe_cabinet_administratif** : coûts, améliorations et fermeture.
- **faction_interactions** : centres et rayons des zones de présence ; centre 0,45 unité, côtés à ±2 avec rayon 0,55, amélioration à +0,95 avec rayon 0,3.
- **influence** : définition du contrôle territorial et résistance électorale ; **debug** : fonds, distance de création et historique.
- Les coûts et revenus des bâtiments précédents restent dans leurs sections d’origine.

**world_layout.json** conserve les populations, spawns et implantations. **prototype_config.json** regroupe caméra, déplacement du joueur, proportions et présentation. Le nouvel emplacement est à 35 % de chaque sous-zone ; sa façade est un peu plus étroite pour ne pas recouvrir les bâtiments validés. **building_catalog.json** définit notamment les cibles administratives autorisées.

Hypothèses explicites :

1. Une sous-zone est contrôlée à partir de **35 % de soutien**, avec **4 points d’avance** sur chacun des autres camps. Sans zone contrôlée, un coup provoque recul et étourdissement mais aucune perte électorale. **Y** prépare volontairement une zone contrôlée pour tester cet effet immédiatement. La perte indiquée est un budget total réparti entre les zones contrôlées proportionnellement au soutien, pas autant de points perdus dans chacune.
2. Le troisième emplacement est commun aux camps : le premier constructeur détermine Local SO ou Cabinet. Une fermeture conserve son propriétaire et son emplacement. La reconstruction ne revérifie pas le seuil de S initial. Les SO déjà équipés continuent de défendre après fermeture de leur Local ; les équipements payés mais non livrés sont annulés et remboursés.
3. Sur un monde bouclé, gauche et droite peuvent aboutir à la même cible administrative s’il n’en reste qu’une. La sélection est recalculée avant de débiter ; une cible devenue indisponible annule le paiement. Les délais du Cabinet et du raid sont propres à chaque bâtiment.
4. « Disponible » exclut les unités déjà occupées à une collecte ou un affrontement. Les SO en raid ne participent pas à un deuxième raid. Le biome de garde est celui où le SO a été équipé ; son origine permanente reste celle du PNJ, utilisée après démobilisation.
5. Un coup de mêlée touche le premier adversaire dans sa portée. Les CRS peuvent donc s’interposer. La vague traverse plusieurs cibles et ne touche chacune qu’une fois. Les Neutres et alliés sont protégés. Un projectile verbal est annulé si son auteur perd son affiliation.
6. Les bâtiments gardent l’absence de collision du déplacement validé. Les CRS ajoutent uniquement un obstacle mobile à l’approche des candidats adverses. Un coup ou une attaque interrompt la persuasion et le paiement ; une unité recommence ensuite normalement.
7. Les durées sont arrondies au tick supérieur à **30 Hz**. Le bref arrêt d’impact concerne les combattants, sans suspendre l’économie du monde. Les IA candidates savent combattre par les mêmes commandes, sans nouvelle stratégie finale.
8. Les sauvegardes sont au **format 3** et contiennent attaques, projectiles, charge, temporaires, raids, fermetures et files. Les anciens fichiers de sauvegarde ou ceux d’autres réglages sont refusés sans endommager la partie. L’état interne de démobilisation garde son nom historique **DEMOBILISE**.
9. La difficulté 1 SO / 2 SO / 3 SO reste un réglage de départ à juger en jouant. Les tests vérifient la résistance et l’augmentation de la pression, pas une promesse de victoire. Aucun son ni graphisme final n’est ajouté.

## Vérification et arrêt du jalon

~~~powershell
npm.cmd test
npm.cmd run test:parcours
npm.cmd run test:conflits
~~~

Les tests couvrent les règles et la continuation déterministe des sauvegardes. Le premier parcours vérifie encore la boucle du deuxième jalon sans argent ni PNJ ajoutés. Le second prépare les scènes de test et vérifie les chaînes SO/raid et fermeture/reconstruction. Voir **VALIDATION_JALON_3.md** pour les résultats.

**Arrêt au troisième jalon, en attente de ton essai.** Tour complète, sondages, cercle électoral, Meeting, arène J0, second tour, réseau, graphismes et sons finaux restent hors périmètre.

