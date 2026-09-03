# Présidentielles 2027 — deuxième jalon jouable

> Archive du jalon validé. Pour la version actuelle, les contrôles de combat et les nouvelles hypothèses, lire README.md. Les sauvegardes jalon2 livrées ont été régénérées avec le schéma actuel.

La boucle est maintenant jouable : Neutre → Sympathisant → implantation locale → Permanence → Imprimerie → Militant autonome → Financement. Caméra, échelle, déplacement et persuasion par proximité du premier jalon sont conservés.

## Lancer

Sous Windows, double-clique sur **Lancer le jeu.cmd** et garde son terminal ouvert. Le jeu est à **http://localhost:2027**. Autre méthode, dans un terminal ouvert dans ce dossier :

~~~powershell
npm.cmd start
~~~

Node.js 20 ou plus récent est nécessaire ; la machine de validation possède Node.js 22.14.0. Aucune dépendance à installer et aucune connexion Internet nécessaire. Ne lance pas directement index.html : le serveur local charge les JSON. Ctrl+C arrête le serveur.

## Commandes normales

| Commande | Action |
| --- | --- |
| Flèches gauche / droite, Q / D ou A / D | Marcher |
| Rester près d’un Neutre | Convaincre gratuitement, sans bouton |
| Rester devant un billet disponible pendant 2 secondes | Payer automatiquement |
| S’éloigner avant la fin du paiement | Annuler, sans dépense |
| H, Échap ou P | Aide et pause ; même touche pour reprendre |
| F | Plein écran |
| F3 | Afficher ou masquer le débogage |

Sur écran tactile, maintenir un doigt à gauche ou à droite fait marcher ; toucher le centre ouvre l’aide. Le paysage est préférable. Le tactile est conservé, mais pas vérifié sur un téléphone physique.

Un Neutre est gris ; une veste de parti et **S** indiquent un Sympathisant ; **M** et un tract clair indiquent un Militant. Les candidats gardent leur silhouette distinctive et leur initiale. Les Sympathisants vivent dans leur secteur ; les Militants partent recruter sans ordre individuel. Seul l’argent reste affiché en permanence. Le jour et le lieu apparaissent brièvement.

## Parcours de test conseillé

Commence une nouvelle partie avec Mélenchon. Pour isoler tes essais, ouvre F3 puis presse **I** pour suspendre les deux candidats IA. Les Militants continuent de travailler. Tu peux ensuite masquer F3. Les raccourcis de test ci-dessous exigent F3 ouvert et une partie en marche.

1. **Densité et spawn.** Au départ : **25 Neutres**, aucun allié offert à aucun candidat. Paris, Périurbain, Campagne, Retraités et Quartiers riches en ont chacun 4 ; Banlieue en a 5, répartis 2 / 2 / 1. F3 affiche pour chaque point social son occupation sur 2 places, son délai tiré et sa prochaine tentative. Recrute un Neutre pour libérer une place, puis attends. En Banlieue, le délai tiré est de **15 à 25 secondes** ; en Campagne, **22,5 à 37,5** ; dans les Quartiers riches, **30 à 50**. Il est compté depuis la dernière tentative : l’attente restante peut donc être plus courte. F6 accélère tout le jeu ×4. Sans recrutement, le point reste plafonné à 2 Neutres : une tentative sans place est sautée et un nouveau délai est tiré.
2. **Persuasion et implantation.** Dans la sous-zone de départ, « Marché populaire central », approche les deux Neutres et reste à portée. Un arc avance puis chacun devient S. Mélenchon demande environ **1,67 seconde**, les autres candidats **3 secondes**, avant bonus de Permanence. S’éloigner interrompt la conversation. Dans F3, vérifie les 2 S locaux, leurs origines et leur faible influence. C permet de rejoindre le Neutre le plus proche.
3. **Permanence.** Avec **2 S dans cette même sous-zone**, va vers l’emplacement de gauche marqué « PERMANENCE » (B en débogage). Le billet de **35 k€** apparaît ; reste **2 secondes**. Le bâtiment se construit avec le drapeau de ton camp, sans consommer les S. Quitter le billet avant la fin annule le paiement. Pour améliorer, éloigne-toi puis reviens : niveau 2 à **55 k€**, niveau 3 à **90 k€**. Une seule construction ou amélioration est autorisée par passage. G ajoute 200 k€ de test pour vérifier rapidement les niveaux.
4. **Imprimerie et collecte.** Va à l’Imprimerie grise au centre du biome (T). Elle existe déjà et reste neutre. Avec au moins **1 S allié dans le biome**, reste devant le billet de **12 k€** pendant 2 secondes. **Éloigne-toi dès le premier paiement pour n’acheter qu’un tract.** Sinon un nouvel achat peut se produire toutes les 2 secondes, jusqu’à 4 commandes en attente. Le S disponible le plus proche marche vers l’Imprimerie, attend si nécessaire, puis lève le bras pour récupérer le papier. L’impression prend **4 secondes par tract** ; le retrait dure **1 seconde**. F3 affiche la file, l’ID du S affecté et sa tâche.
5. **Militant autonome.** Après le retrait, le même personnage devient M, conserve ses origines et repart seul. Suis-le à pied ou sélectionne-le dans F3 puis clique sur « Aller près du PNJ inspecté ». Il cherche une sous-zone proche utile, s’arrête près d’un Neutre et le convainc en **5 secondes**, avant bonus local. Le bonus personnel de Mélenchon ne s’applique pas aux Militants. Le nouveau S reste dans le territoire ; un autre tract payant sera nécessaire pour le transformer à son tour. Le Militant produit aussi davantage d’influence.
6. **Financement.** Recrute les nouveaux Neutres jusqu’à avoir **4 S présents dans une même sous-zone**. Les Militants ne comptent pas dans ce seuil. Va à l’emplacement « FINANCEMENT » à droite (N), puis reste devant le billet de **55 k€** pendant 2 secondes. Dans F3, le revenu de Mélenchon passe de **0,12 à 0,42 k€/s** avec un Financement de niveau 1. Éloigne-toi puis reviens pour les niveaux 2 et 3 : **80 puis 125 k€**. Philippe multiplie tous ses revenus passifs par **1,3**. Répète le parcours dans un autre biome pour vérifier les seuils locaux.

Un billet gris barré indique un achat indisponible : fonds insuffisants, file pleine ou absence de S allié dans le biome. Un emplacement non débloqué par l’implantation ne propose aucun billet.

## Sauvegardes pour voir une étape immédiatement

Dans F3, mets en pause avec F4, ouvre « Déplacements, fonds de test et sauvegardes », puis « Importer un état JSON ». Les fichiers suivants sont dans **artifacts/**. Reprends avec F4 ; tu peux masquer le panneau avec F3 pour mieux voir. Si tu masques F3 en laissant le jeu en pause, H permet aussi de reprendre.

| Fichier | Moment du parcours |
| --- | --- |
| jalon2-billet.json | 9,37 s : premier paiement en cours, aucune dépense |
| jalon2-permanence.json | 10,37 s : Permanence construite, 35 k€ dépensés |
| jalon2-collecte.json | 15 s : premier S en route vers l’Imprimerie, 47 k€ dépensés au total |
| jalon2-retrait.json | 18,5 s : le S npc:8 commence à récupérer le tract |
| jalon2-financement.json | 73,67 s : Financement actif, Militant autonome, 102 k€ dépensés au total |

Ces états proviennent d’un parcours automatique avec les réglages normaux, uniquement par marche et présence, sans argent ni PNJ ajoutés. Les IA candidates y sont suspendues ; I les réactive. Les temps décrivent ce parcours déterministe, pas une limite à respecter en jouant.

## Raccourcis et inspection F3

| Raccourci, avec F3 ouvert | Action |
| --- | --- |
| F4 | Pause / reprise sans ouvrir l’aide |
| F6 | Vitesse normale / ×4 |
| I | Activer / suspendre les candidats IA |
| 1 / 2 / 3, ou & / é / " | Contrôler Mélenchon / Le Pen / Philippe |
| B / T / N | Rejoindre la Permanence / Imprimerie / le Financement le plus proche |
| C | Rejoindre le Neutre le plus proche |
| G | Ajouter 200 k€ de test au candidat contrôlé |
| [ / ] | Sous-zone précédente / suivante |

Le panneau permet de choisir un PNJ ou un bâtiment précis et de le rejoindre. Il montre l’implantation par camp, les origines immuables, les tâches et destinations, la production, les prix, propriétaires et niveaux, l’argent exact, les revenus et les dépenses. « Démobiliser » vérifie le retour physique à l’origine ; ce n’est pas du combat.

Les déplacements et fonds de test sont des commandes appliquées au prochain tick : reprends la simulation si elle est en pause. Les raccourcis ne s’appliquent pas pendant la saisie dans un champ ; clique dans le jeu pour rendre le clavier au personnage. L’export/import restaure toute la simulation, files et hasard compris. Les sauvegardes du premier jalon ou de réglages différents sont refusées avec un message ; la partie en cours est conservée.

## Où régler les valeurs

Tous les fichiers suivants sont dans **Présidentielles 2027/**. Après modification, recharge la page.

| Fichier et section | Valeurs actives |
| --- | --- |
| world_layout.json → chaque sous-zone | initial_neutral_count, mean_spawn_days, spawn_randomness.min_factor/max_factor, max_neutrals_waiting, points sociaux |
| world_layout.json → infrastructure_layout | Position relative des emplacements et de l’Imprimerie |
| world_layout.json → starting_support | Répartition électorale abstraite initiale et bonus locaux de départ |
| game_balance.json → time | 20 secondes par jour de jeu |
| game_balance.json → money | Fonds de départ, revenu de base, multiplicateurs de Philippe |
| game_balance.json → persuasion | Durées candidat / Militant et bonus personnel de Mélenchon |
| game_balance.json → physical_units.sympathisant et .militant | Influence, vitesse des tâches et critères de destination |
| game_balance.json → buildings.permanence | Seuil 2 S, prix 35 / 55 / 90, délai 2 s, influence et accélération locale de persuasion |
| game_balance.json → buildings.imprimerie | Tract 12, impression 4 s, retrait 1 s, capacité 4, seuil d’usage 1 S dans le biome |
| game_balance.json → buildings.financement | Seuil 4 S, prix 55 / 80 / 125, revenus supplémentaires 0,3 / 0,52 / 0,82 k€/s |
| game_balance.json → interaction | Portée 1,15 unité, nouveau passage pour améliorer, achats répétés à l’Imprimerie |
| game_balance.json → influence | Résistance de l’électorat abstrait et bonus de Le Pen |
| game_balance.json → ai_economy et debug | Réserves et objectifs IA ; accélération, fonds de test, historique |
| prototype_config.json | Géométrie, déplacement, portée de persuasion, vie locale des PNJ, couleurs, dimensions des bâtiments et billets |
| building_catalog.json | Description des bâtiments ; coûts effectifs dans game_balance.json |

Les paramètres déjà présents pour les fonctionnalités futures sont conservés, mais celles-ci ne sont pas actives. En particulier, l’Imprimerie reste au niveau 1 : ses prix et durées de niveaux 2/3 sont réservés pour plus tard.

## Hypothèses retenues

- **Local = sous-zone physique actuelle**, pas biome d’origine. Seuls les S débloquent les constructions ; ils ne sont jamais consommés. Un S en collecte compte encore tant qu’il est présent et conserve ce rôle. Les améliorations ne revérifient pas le seuil initial.
- Chaque sous-zone possède un emplacement de Permanence et un de Financement, accessibles au premier camp qui paie. Une Imprimerie neutre occupe la sous-zone centrale de chaque biome. Les bâtiments n’ont pas de collision, conformément au déplacement validé.
- Chaque point social a 2 places de Neutres en attente. Le délai est tiré au départ et après chaque tentative ; un point plein ne cumule pas de naissances différées. Les retours de démobilisation réservent leur place pour les spawns ; l’outil debug peut néanmoins provoquer un dépassement temporaire en ramenant des unités vers un point déjà plein. Aucun plafond général de S ou M n’est ajouté : rareté humaine et tracts payants limitent la croissance.
- Les moyennes des autres biomes sont fictives : Paris 1,2 à 1,4 jour, Périurbain 1,25 à 1,5, Retraités 1,6 à 1,8. Ce ne sont pas des affirmations sociologiques.
- La file de 4 tracts est commune aux trois camps et inclut les tracts prêts mais non retirés. L’affectation choisit le S allié disponible le plus proche **dans le biome**, puis son ID en cas d’égalité. Un S occupé ne prend pas une deuxième commande. Les commandes payées sans S disponible attendent une disponibilité future ; aucun remboursement automatique.
- La production est séquentielle. Un S se déplace à 2,4 unités/s ; le Militant à 3,2. Le Militant cherche dans sa sous-zone ou une voisine et favorise une faible implantation ; il reconsidère sa destination toutes les 3 secondes. Il ne commande pas de tracts lui-même. Les candidats IA construisent, améliorent et impriment avec les mêmes règles que l’humain.
- Un S apporte 0,008 point/s d’influence brute, un Militant 0,035. La Permanence apporte 0,012 / 0,02 / 0,032 selon son niveau et multiplie les temps de persuasion locaux par 0,95 / 0,88 / 0,8. Le bonus de Mélenchon reste personnel. La résistance de l’électorat atténue les gains ; convertir un PNJ n’ajoute jamais directement un électeur ou un point de pourcentage. Les parts abstraites restent à 100 %, visibles uniquement en débogage.
- Une visite achète un seul niveau de bâtiment. L’Imprimerie autorise les commandes répétées. Sortir de portée annule immédiatement le paiement incomplet.
- Simulation à 30 ticks/s, indépendamment des images affichées. Onglet masqué et pause suspendent le temps ; les zones hors caméra continuent lorsque le jeu tourne. À J-1, le compteur reste bloqué et la gestion continue, J0 étant hors jalon.
- Caméra, sol à 93 %, épaisseur 2,5 %, silhouette 15 %, vitesse du candidat 3,6 unités/s et largeur de sous-zone 24 unités conservés. Seule la légende de lieu au-dessus d’une Imprimerie est remontée pour éviter son recouvrement.

## Architecture et vérification

Les contrôleurs humain et IA produisent des commandes. GameSimulation valide les achats, effectue les transactions puis émet les événements. Le rendu lit l’état. **src/simulation/** ne dépend ni du DOM ni du Canvas. IDs, affectations, files et timers sont sérialisables. Le générateur aléatoire est centralisé et sauvegardé. Les états version 2 sont vérifiés avant remplacement de la partie. Aucun réseau n’est implémenté.

~~~powershell
npm.cmd test
npm.cmd run test:parcours
~~~

La première commande vérifie les règles et régressions ; la deuxième rejoue la boucle complète et régénère les cinq sauvegardes. Voir **VALIDATION_JALON_2.md** pour les résultats et leurs limites. **JALON_2_SPEC.md** conserve la demande et remplace les anciennes règles de densité. VALIDATION_JALON_1.md et artifacts/snapshot-validation.json sont des archives du premier jalon.

**Développement arrêté au deuxième jalon, en attente de ton essai.** Service d’ordre, raids, Cabinet, combat, pouvoirs, Tour, sondages, Meeting, J0, second tour et réseau restent hors périmètre.
