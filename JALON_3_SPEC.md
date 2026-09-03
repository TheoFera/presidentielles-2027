Précision ajoutée au message : réduire la vitesse de marche des Militants ; elle doit rester au maximum égale à deux fois celle du joueur.

Le deuxième jalon est validé et fonctionne correctement.

IMPORTANT :
conserve tels quels les systèmes déjà validés, notamment :

- caméra et composition de l'écran ;
- déplacement ;
- monde horizontal bouclé ;
- faible densité de PNJ Neutres ;
- spawn aléatoire configurable par sous-zone ;
- persuasion automatique par proximité ;
- bonus personnel de persuasion de Mélenchon ;
- Sympathisants ;
- seuils d'implantation ;
- interaction économique par présence prolongée ;
- billet affichant le prix ;
- Permanence ;
- Imprimerie neutre ;
- Sympathisant → Militant via achat de tract ;
- comportement autonome actuel des Militants ;
- Financement ;
- argent en haut à gauche ;
- UI minimale ;
- architecture multiplayer-ready.

Ne refais pas ces systèmes sauf nécessité technique réelle.

Relis avant de coder :
- PROTOTYPE_GAMEPLAY_SPEC.md
- VISUAL_COMPOSITION_SPEC.md
- MULTIPLAYER_READINESS_SPEC.md
- PROTOTYPE_ACCEPTANCE_TESTS.md
- IMPLEMENTATION_TASKS.md
- game_balance.json
- world_layout.json
- building_catalog.json

==================================================
OBJECTIF DU TROISIÈME JALON
==================================================

Je veux maintenant rendre le monde CONFLICTUEL.

À la fin de cette phase, je dois pouvoir :

- attaquer physiquement des unités adverses ;
- effectuer le combo léger → léger → fort ;
- voir des Militants adverses attaquer ;
- démobiliser des unités sans jamais les tuer ;
- voir les démobilisés retourner vers leur biome d'origine ;
- créer des Services d'ordre avec Mélenchon et Le Pen ;
- voir ces Services d'ordre défendre automatiquement leur biome ;
- lancer un raid de Services d'ordre ;
- utiliser la mécanique alternative d'Édouard Philippe ;
- charger et déclencher les trois pouvoirs spéciaux.

L'objectif n'est PAS encore d'équilibrer parfaitement les valeurs.

L'objectif est de savoir si intervenir personnellement dans les combats
est amusant et apporte réellement quelque chose à la stratégie.

==================================================
1. PRINCIPE DU COMBAT
==================================================

Le combat doit rester :

- très simple ;
- immédiatement compréhensible ;
- caricatural ;
- sans sang ;
- sans mort ;
- lisible comme un jeu d'action 2D.

Référence de sensation :
Fiscal Combat / beat'em up 2D pour la proximité,
avec un knockback lisible inspiré des jeux de combat type Smash Bros.

Mais la caméra normale reste celle déjà validée :
NE transforme PAS le monde en arène de combat.

Le candidat reste contrôlé avec le même déplacement horizontal.

Ajouter UN bouton d'attaque principal.

==================================================
2. COMBO DU CANDIDAT
==================================================

Le bouton d'attaque produit une séquence automatique de trois coups :

Coup 1
→ léger

Coup 2
→ léger

Coup 3
→ fort

Si le joueur attend trop longtemps entre deux coups :
le combo revient au coup 1.

Les valeurs doivent être configurables.

Le troisième coup doit avoir :
- davantage de dégâts internes ;
- beaucoup plus de knockback ;
- un feedback greybox nettement plus fort.

Même sans graphismes finaux, je veux sentir :

tap
→ tap
→ BOUM.

Prévoir :
- courte anticipation ;
- hitbox ;
- hit-stop léger ;
- knockback ;
- stun très court.

Ne rends pas le combat lourd ou technique.

==================================================
3. AUCUNE BARRE DE VIE VISIBLE
==================================================

Les PNJ peuvent posséder une valeur interne de résistance/durabilité,
mais elle doit être totalement invisible dans l'UI normale.

Aucune barre au-dessus de la tête.

Aucun chiffre.

Aucun indicateur de PV.

Ces données peuvent être affichées uniquement dans le mode DEBUG.

La lecture doit venir :
- des réactions ;
- du knockback ;
- des animations ;
- de l'état Démobilisé.

==================================================
4. ÉQUILIBRAGE INITIAL DES UNITÉS
==================================================

Utilise des valeurs facilement modifiables dans game_balance.json.

Sensation cible :

### SYMPATHISANT

Un combo complet correctement placé :

léger
→ léger
→ fort

doit le démobiliser.

### MILITANT

Un combo complet correctement placé doit également pouvoir le démobiliser.

Le Militant peut éventuellement être très légèrement plus résistant
si cela améliore la sensation,
mais évite de transformer les combats en sacs à PV.

### SERVICE D'ORDRE

Beaucoup plus résistant.

Point de départ :
environ 3 fois la résistance d'un Militant.

Sensation cible :

JOUEUR vs 1 SO
→ joueur clairement favori s'il joue correctement.

JOUEUR vs 2 SO
→ combat serré ;
→ gagnable de justesse si le joueur joue bien.

JOUEUR vs 3 SO
→ joueur en réel danger ;
→ il doit souvent reculer ou chercher de l'aide.

L'équilibrage doit aussi utiliser :
- dégâts adverses ;
- stun ;
- knockback ;
- rythme d'attaque ;

et pas uniquement augmenter artificiellement les PV.

==================================================
5. DÉMOBILISATION
==================================================

PERSONNE NE MEURT.

Quand la durabilité d'un :

- Sympathisant ;
- Militant ;
- Service d'ordre

atteint zéro :

il passe en état :

DEMOBILISED.

Il doit :

1. arrêter immédiatement de combattre ;
2. perdre son affiliation politique ;
3. ne plus produire d'influence ;
4. marcher vers son `origin_biome_id` ;
5. rejoindre son `origin_social_point_id` ;
6. redevenir NEUTRE à l'arrivée.

Il conserve donc toute sa vie :

- origin_biome_id ;
- origin_subzone_id ;
- origin_social_point_id.

Je veux pouvoir voir physiquement un ancien Militant rouge,
par exemple,
quitter le front et rentrer progressivement vers son quartier d'origine.

C'est une mécanique importante du jeu.

==================================================
6. COMBAT DES MILITANTS
==================================================

Les Militants doivent maintenant pouvoir combattre.

Leur attaque doit être différente de celle du candidat.

Je veux conserver l'idée caricaturale suivante :

MILITANT
→ attaque principalement à distance par des insultes / slogans.

Pour la greybox :

utilise une petite bulle / projectile abstrait simple.

Le Militant :
- détecte un adversaire ;
- garde une distance raisonnable ;
- lance périodiquement son attaque verbale ;
- peut viser :
  - Militant adverse ;
  - candidat adverse ;
  - éventuellement Service d'ordre.

Ne vise pas prioritairement les simples Sympathisants.

Les Militants doivent continuer à pouvoir :
- se déplacer ;
- convaincre des Neutres ;
- produire de l'influence.

Ils sont donc à la fois :
- unités de terrain ;
- propagandistes ;
- unités offensives légères.

==================================================
7. COUPS REÇUS PAR LES CANDIDATS
==================================================

IMPORTANT :

Les candidats principaux n'ont PAS de barre de vie classique
dans le monde d'exploration.

Ils ne sont pas "tués".

Quand un candidat reçoit :

- un coup physique ;
- une attaque verbale d'un Militant ;

il subit :

- knockback ;
- éventuellement court stun ;
- surtout une perte de soutien électoral.

Cette perte doit être faible par attaque normale,
mais devenir significative si le joueur accepte de se faire frapper longtemps.

Les voix perdues :

CANDIDAT
→ deviennent NEUTRES.

La perte doit être répartie uniquement dans les territoires actuellement contrôlés
par ce candidat.

Exemple conceptuel :

Mélenchon possède plusieurs zones.

Il reçoit plusieurs coups.

Une très petite quantité de soutien Mélenchon dans ses zones contrôlées
redevient Neutre.

IMPORTANT :
aucun pourcentage ne doit apparaître à l'écran si le joueur
n'a pas encore débloqué l'Institut de sondage.

Le système fonctionne néanmoins en arrière-plan.

Les valeurs exactes doivent être visibles en DEBUG.

==================================================
8. SERVICE D'ORDRE : MÉLENCHON ET LE PEN UNIQUEMENT
==================================================

Mélenchon et Marine Le Pen peuvent utiliser le bâtiment actuellement nommé
provisoirement :

LOCAL DU SERVICE D'ORDRE.

Ce nom reste un nom de travail.

Édouard Philippe NE possède PAS ce gameplay.

==================================================
9. CONSTRUCTION DU LOCAL SO
==================================================

Même philosophie que les bâtiments déjà validés :

- nécessite suffisamment de Sympathisants locaux ;
- bâtiment possédé ;
- billet avec prix ;
- présence prolongée ;
- achat automatique ;
- aucun clic ;
- aucun menu.

Les seuils et coûts viennent de la configuration.

==================================================
10. MILITANT → SERVICE D'ORDRE
==================================================

Un Service d'ordre n'est PAS créé à partir d'un Sympathisant.

Il faut déjà posséder un MILITANT.

Le joueur se place devant le Local SO.

Un billet affiche le prix d'un équipement.

Pour la greybox, représenter cet équipement par exemple par :

un bâton.

Après paiement :

1. trouver automatiquement le Militant allié disponible le plus proche DANS LE BIOME ;
2. lui attribuer la tâche ;
3. il marche jusqu'au Local ;
4. il récupère l'équipement ;
5. il devient SERVICE_D_ORDRE.

Je veux voir cette séquence se dérouler physiquement.

Même principe que l'Imprimerie.

==================================================
11. COMPORTEMENT NORMAL DES SERVICES D'ORDRE
==================================================

Un Service d'ordre est avant tout une unité TERRITORIALE.

Il reste dans son biome.

Il ne part pas spontanément conquérir toute la carte.

Quand aucun danger n'est présent :
- attente ;
- petite patrouille ;
- garde locale.

Quand entre dans son biome :

- un candidat adverse ;
OU
- un Militant adverse ;

les Services d'ordre disponibles doivent :

1. détecter l'intrusion ;
2. foncer automatiquement vers l'adversaire ;
3. attaquer au corps à corps ;
4. continuer jusqu'à :
   - son départ du biome ;
   - sa démobilisation ;
   - ou disparition de la menace.

Ils doivent donner la sensation :

"Ce territoire est protégé."

==================================================
12. RAID DES SERVICES D'ORDRE
==================================================

Je veux pouvoir temporairement transformer ces défenseurs en force offensive.

Le raid se déclenche physiquement depuis le Local SO.

Pas de menu RTS.

Je propose pour la greybox :

CÔTÉ GAUCHE DU BÂTIMENT
→ billet RAID GAUCHE

CÔTÉ DROIT DU BÂTIMENT
→ billet RAID DROITE

Si le candidat reste dans la zone correspondante
et paie le prix :

tous les Services d'ordre disponibles du biome
reçoivent l'ordre de partir dans cette direction.

Ils :
- quittent temporairement leur biome ;
- foncent vers le front ;
- attaquent les adversaires rencontrés.

Le coût / cooldown doit empêcher le spam.

Après le raid :
- survivants retournent à leur biome ;
OU
- retournent dès que la durée maximale expire.

Tout doit être configurable.

==================================================
13. ÉDOUARD PHILIPPE : PAS DE SO PERMANENT
==================================================

Philippe ne peut jamais produire de Service d'ordre permanent.

Son slot de bâtiment est remplacé par :

CABINET ADMINISTRATIF

nom provisoire.

C'est un bâtiment possédé.

Construction :
- seuil de Sympathisants ;
- billet ;
- présence prolongée ;
- paiement.

==================================================
14. CABINET ADMINISTRATIF DE PHILIPPE
==================================================

Le Cabinet permet à Philippe de payer CHER
pour faire fermer un bâtiment adverse.

Cette mécanique doit être coûteuse.

Quand l'action réussit :

le bâtiment adverse ciblé :

→ ferme ;
→ cesse de produire ses effets ;
→ perd ses améliorations ;
→ devient inutilisable.

Pour le réactiver :

le propriétaire adverse doit :
- revenir physiquement sur place ;
- repayer sa reconstruction ;
- repartir du niveau 1.

Cela doit donc coûter :
- du temps ;
- de l'argent ;
- un déplacement du candidat.

IMPORTANT :
l'action ne doit pas supprimer définitivement l'emplacement.

==================================================
15. CIBLAGE DU CABINET — GREYBOX
==================================================

Évite un gros menu.

Pour cette première version,
utilise une sélection simple et intuitive.

Par exemple :

zone d'interaction gauche du Cabinet
→ cible éligible la plus proche vers la gauche.

zone droite
→ cible éligible la plus proche vers la droite.

Le petit feedback contextuel peut montrer :

[petite icône du bâtiment cible]
[billet + prix]

Puis présence prolongée
→ paiement
→ fermeture.

Si cette méthode est trop restrictive techniquement,
implémente un sélecteur greybox minimal,
mais NE construis pas une grosse interface de gestion.

Documente toute hypothèse.

==================================================
16. CHARGE DU POUVOIR SPÉCIAL
==================================================

AUCUNE BARRE DE COOLDOWN.

Le pouvoir spécial se charge en combattant.

Chaque coup réussi du candidat :

→ ajoute des points de charge.

Exemple :
- coup léger = +1
- coup fort = +2

Seuil configurable.

Quand la charge est pleine :

le candidat affiche simplement :

ÉTOILES DANS LES YEUX

ou un équivalent greybox extrêmement lisible.

Aucune jauge permanente.

==================================================
17. DÉCLENCHEMENT DU POUVOIR
==================================================

Quand le pouvoir est prêt :

LE PROCHAIN COUP D'ATTAQUE DU JOUEUR
déclenche automatiquement son pouvoir spécial.

Donc :

pas de bouton spécial supplémentaire.

Après déclenchement :
charge = 0.

Ce comportement doit être identique pour les trois candidats.

==================================================
18. POUVOIR MÉLENCHON : HOLOGRAMMES
==================================================

Quand son spécial est déclenché :

plusieurs hologrammes de Mélenchon apparaissent autour de lui.

Greybox :
silhouettes humaines rouges semi-transparentes / distinctes.

Ils :

- détectent immédiatement les adversaires proches ;
- se ruent sur eux ;
- frappent ;
- produisent knockback ;
- restent actifs quelques secondes ;
- disparaissent ensuite.

Ils ne :
- convainquent pas ;
- construisent pas ;
- utilisent pas de bâtiments ;
- produisent pas durablement d'influence.

C'est un pouvoir de surnombre offensif.

==================================================
19. POUVOIR MARINE LE PEN : VAGUE BLEU MARINE
==================================================

Quand son spécial est déclenché :

une grande vague BLEU MARINE part en ligne droite
dans la direction du personnage.

Ce n'est pas une charge physique de Marine Le Pen.

C'est une vague/projectile horizontal large.

Elle traverse une partie importante de l'écran.

Tout adversaire touché reçoit :
- fort knockback ;
- gros dégâts internes.

Calibration spécifique :

SYMPATHISANT
→ démobilisation immédiate.

MILITANT à pleine durabilité
→ presque démobilisé.
Environ 80–90 % de sa résistance retirée.

SERVICE D'ORDRE
→ dégâts importants mais il doit normalement rester debout.

CANDIDAT
→ fort knockback
+ perte électorale nettement supérieure à un coup normal.

Le pouvoir doit être spectaculaire même dans la greybox :
grand rectangle/onde bleue animée suffit.

==================================================
20. POUVOIR PHILIPPE : MUR DE CRS
==================================================

Quand son spécial est déclenché :

des CRS TEMPORAIRES apparaissent immédiatement autour de Philippe.

Par défaut :

1 à gauche
+
1 à droite.

Ils :
- restent très proches de Philippe ;
- avancent avec lui ;
- forment un mur physique ;
- attaquent automatiquement les adversaires proches ;
- repoussent fortement ;
- interceptent autant que possible les attaques.

Durée limitée.

Après quelques secondes :
ils disparaissent.

Ils ne deviennent JAMAIS des unités permanentes.

Ils ne peuvent pas :
- conquérir ;
- convaincre ;
- utiliser un bâtiment ;
- rester après la fin du pouvoir.

Le but est que Philippe devienne temporairement
très difficile à approcher et à frapper.

==================================================
21. GREYBOX DES COMBATS
==================================================

Continue d'utiliser les silhouettes humaines pixelisées déjà présentes.

Il faut simplement ajouter des animations primitives :

- préparation coup 1 ;
- coup 1 ;
- coup 2 ;
- coup fort ;
- recul ;
- knockback ;
- attaque verbale Militant ;
- attaque SO ;
- démobilisation ;
- pouvoir spécial.

Pas besoin de beau pixel art.

Mais la silhouette doit rester humaine :
- tête ;
- torse ;
- deux bras ;
- deux jambes.

Les symboles de rôle restent visibles sur le torse.

==================================================
22. MULTIPLAYER READINESS
==================================================

Cette phase est particulièrement importante pour l'architecture future.

N'implémente PAS encore le réseau.

Mais :

TOUTES les attaques doivent passer par la simulation.

Structure :

Player/AI Input
→ AttackCommand
→ GameSimulation
→ HitResult
→ GameEvent
→ Presentation.

Même chose pour :

- démobilisation ;
- raid ;
- équipement SO ;
- fermeture administrative ;
- charge spéciale ;
- pouvoir spécial.

IMPORTANT :

Les collisions/hit results déterminant le gameplay
ne doivent pas être calculés uniquement dans l'animation graphique locale.

La simulation doit produire le résultat autoritaire.

Chaque :
- attaque ;
- projectile ;
- pouvoir ;
- unité temporaire

doit posséder un identifiant si nécessaire.

Le RNG éventuel doit être seedable.

L'état suivant doit être sérialisable :

- durabilité interne ;
- état de combat ;
- affiliation ;
- origine ;
- charge spéciale ;
- raid ;
- bâtiment fermé ;
- durée restante des unités temporaires.

Le même système devra pouvoir fonctionner à terme avec :

1 humain + 2 IA
2 humains + 1 IA
3 humains

N'implémente toujours aucun réseau.

==================================================
23. DEBUG
==================================================

Dans le mode debug uniquement,
je veux pouvoir voir :

POUR UNE UNITÉ :
- rôle ;
- camp ;
- durabilité exacte ;
- état ;
- cible ;
- origine ;
- tâche ;
- état raid.

POUR UN CANDIDAT :
- charge spéciale ;
- dégâts électoraux reçus ;
- cible actuelle ;
- dernier hit.

POUR UN BÂTIMENT :
- actif/fermé ;
- propriétaire ;
- niveau ;
- coût reconstruction ;
- cible Cabinet.

POUR LE COMBAT :
- hitboxes si possible ;
- dégâts ;
- knockback ;
- attaque courante ;
- combo step ;
- combo timer.

Ajouter un raccourci debug permettant de :

- remplir immédiatement la charge spéciale ;
- spawn 1 Sympathisant ;
- spawn 1 Militant ;
- spawn 1 SO ;
- démobiliser l'unité ciblée ;
- donner de l'argent.

==================================================
24. CE QUE JE DOIS POUVOIR TESTER
==================================================

À la fin du jalon, je dois pouvoir réaliser cette séquence :

1. lancer la partie ;

2. convaincre des Neutres ;

3. produire plusieurs Militants via l'Imprimerie ;

4. rencontrer des unités adverses ;

5. leur donner :
   léger → léger → fort ;

6. voir une unité être démobilisée ;

7. la voir repartir physiquement vers son biome d'origine ;

8. voir les Militants adverses m'attaquer par des attaques verbales ;

9. constater que recevoir des coups fait perdre une petite quantité
   de soutien électoral dans mes territoires ;

10. avec Mélenchon ou Le Pen,
    construire un Local SO ;

11. acheter un équipement ;

12. voir un Militant venir le chercher ;

13. le voir devenir Service d'ordre ;

14. voir le SO défendre automatiquement le biome ;

15. entrer avec un candidat adverse dans ce biome
    et voir les SO foncer sur moi ;

16. lancer un raid vers la gauche ou la droite ;

17. jouer Philippe ;

18. construire son Cabinet administratif ;

19. payer pour fermer un bâtiment adverse ;

20. revenir avec l'adversaire
    et constater que je dois le reconstruire ;

21. combattre assez pour charger mon spécial ;

22. voir apparaître l'effet étoile dans les yeux ;

23. donner le coup suivant ;

24. voir l'ulti correspondant se déclencher ;

25. tester les trois ultis.

==================================================
25. NE PAS ENCORE IMPLÉMENTER
==================================================

Ne développe PAS encore :

- Tour de communication complète ;
- Institut de sondage ;
- cercle électoral visible ;
- Meeting ;
- IA stratégique finale ;
- arène médiatique J0 ;
- élimination du troisième candidat ;
- sprint du second tour ;
- multijoueur réseau ;
- graphismes finaux ;
- sons finaux.

Si certains de ces systèmes existent déjà partiellement,
ne les supprime pas,
mais ne cherche pas à les finaliser maintenant.

==================================================
26. FIN DU JALON
==================================================

Lorsque tout cela fonctionne :

1. lance le jeu ;
2. teste les trois candidats ;
3. corrige les crashes et erreurs ;
4. exécute les tests applicables ;
5. NE continue pas automatiquement vers la phase suivante.

Donne-moi ensuite un rapport très court contenant :

- contrôles de combat ;
- valeurs actuelles des résistances ;
- valeurs des trois coups ;
- coût du Service d'ordre ;
- coût du raid ;
- coût du Cabinet Philippe ;
- charge nécessaire pour un spécial ;
- fonctionnement exact des trois ultis ;
- raccourcis debug ;
- éventuelles hypothèses techniques prises.

Puis ARRÊTE-TOI.

Je veux tester moi-même si les combats et l'intervention directe
du candidat sont réellement amusants avant d'ajouter le reste du jeu.
