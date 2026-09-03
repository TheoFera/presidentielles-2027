Le troisième jalon est validé.

Conserve tels quels tous les systèmes déjà validés, notamment :

- caméra et composition latérale ;
- échelle des personnages ;
- monde horizontal bouclé de 6 biomes × 3 sous-zones ;
- faible densité et spawn variable des PNJ Neutres ;
- origine persistante des PNJ ;
- persuasion automatique par proximité ;
- Sympathisants ;
- implantation locale ;
- interaction économique par présence prolongée ;
- billets contextuels indiquant les prix ;
- Permanence ;
- Imprimerie neutre ;
- Sympathisant → Militant ;
- Financement ;
- combat léger → léger → fort ;
- démobilisation et retour vers le biome d'origine ;
- attaques verbales des Militants ;
- dégâts électoraux reçus par les candidats ;
- Services d'ordre Mélenchon / Le Pen ;
- raid ;
- Cabinet administratif Philippe ;
- charge cachée du pouvoir spécial ;
- Hologrammes Mélenchon ;
- Vague bleu marine Le Pen ;
- CRS temporaires Philippe ;
- UI extrêmement légère ;
- architecture multiplayer-ready.

Ne refais pas ces systèmes sauf nécessité technique.

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
OBJECTIF DU QUATRIÈME JALON
==================================================

Je veux maintenant connecter complètement :

ACTION PHYSIQUE
→ IMPLANTATION
→ INFLUENCE ÉLECTORALE
→ CONTRÔLE TERRITORIAL
→ SCORE NATIONAL.

Implémente et rends réellement jouables :

1. le système complet d'influence électorale ;
2. le contrôle des 18 sous-zones ;
3. la Tour de communication ;
4. l'Institut de sondage ;
5. le Meeting ;
6. la représentation très légère du contrôle territorial ;
7. le cercle électoral débloqué uniquement grâce à l'Institut.

Je veux pouvoir comprendre si la conquête politique du monde est satisfaisante
sans transformer le jeu en tableau Excel ou en jeu de gestion avec énormément de HUD.

==================================================
1. RAPPEL ESSENTIEL : PNJ ≠ ÉLECTEURS
==================================================

Ne mélange surtout pas les deux systèmes.

MONDE PHYSIQUE :

- Neutre
- Sympathisant
- Militant
- Service d'ordre

Ce sont les personnages visibles.

SIMULATION ÉLECTORALE :

chaque sous-zone possède :

- soutien Mélenchon %
- soutien Le Pen %
- soutien Philippe %
- Neutres %

Somme permanente = 100 %.

Les PNJ visibles sont uniquement des acteurs produisant ou facilitant de l'influence.

Exemple :

3 Militants présents ne signifient PAS 3 électeurs.

Ils génèrent un débit d'influence
qui modifie progressivement la population électorale abstraite.

==================================================
2. DONNÉES ÉLECTORALES PAR SOUS-ZONE
==================================================

Chaque sous-zone doit stocker un état autoritaire du type :

support:
- melenchon
- le_pen
- philippe
- neutral

Toujours renormaliser proprement à 100 %.

Chaque sous-zone doit également connaître :

- candidat actuellement en tête ;
- contrôle éventuel ;
- influence/s de chaque camp ;
- valeur électorale/poids de la sous-zone ;
- biomes adjacents / sous-zones adjacentes.

Pour la V0, les poids peuvent rester égaux
si c'est ce qui est actuellement prévu dans la configuration.

Mais le poids doit rester configurable.

==================================================
3. SOURCES D'INFLUENCE
==================================================

Connecte maintenant réellement toutes les sources déjà prévues.

Un camp peut produire de l'influence grâce à :

- Sympathisants locaux ;
- Militants présents ;
- Permanence ;
- Tour de communication ;
- Meeting ;
- présence éventuelle du candidat ;
- bonus propre à Marine Le Pen.

Les Services d'ordre ne doivent produire
aucune ou quasiment aucune influence politique directement.

Ils servent principalement à protéger l'appareil militant.

Le Cabinet administratif Philippe ne produit pas directement de voix :
il affaiblit les infrastructures adverses.

Toutes les valeurs doivent venir de game_balance.json.

==================================================
4. MÉCANIQUE DE CONVERSION DES ÉLECTEURS
==================================================

Au début, l'influence d'un candidat doit principalement convertir les NEUTRES abstraits.

Exemple :

Mélenchon + influence

Mélenchon 25 %
Neutres 30 %

devient progressivement :

Mélenchon 25,1 %
Neutres 29,9 %.

IMPORTANT :

les derniers Neutres doivent être plus difficiles à convaincre.

Je veux une logique de rendement décroissant.

Quand une zone contient beaucoup de Neutres :
→ progression relativement rapide.

Quand il reste très peu de Neutres :
→ progression plus lente.

Une fois les Neutres suffisamment faibles,
une partie de l'influence peut commencer à prendre très lentement
du soutien aux candidats adverses.

Les voix adverses retournées passent directement
vers le candidat qui produit l'influence.

Le seuil et la vitesse doivent être configurables.

==================================================
5. BONUS MARINE LE PEN
==================================================

Le bonus stratégique de Marine Le Pen doit maintenant être pleinement observable.

Elle possède :

1. davantage de soutien électoral initial dans ses zones de départ
   conformément à la configuration ;

2. un multiplicateur de gain d'influence supérieur.

Ce bonus doit affecter la simulation,
mais pas artificiellement le nombre de PNJ visibles.

Elle ne recrute pas plus de Sympathisants physiquement.

==================================================
6. CONTRÔLE D'UNE SOUS-ZONE
==================================================

Une sous-zone ne doit pas changer de propriétaire à chaque variation de 0,1 %.

Utilise une règle de contrôle configurable.

Exemple conceptuel :

un candidat contrôle une sous-zone si :

- il possède au moins X % ;
ET
- il possède au moins Y points d'avance sur le deuxième.

Exemple initial possible :

minimum 35 %
+
4 points d'avance.

Si personne ne satisfait les conditions :

ZONE CONTESTÉE.

Tous ces paramètres restent configurables.

==================================================
7. CONSÉQUENCES DU CONTRÔLE
==================================================

Le contrôle territorial doit avoir des effets concrets.

Au minimum :

- influence de la Tour de communication ;
- représentation dans le cercle électoral ;
- information debug ;
- éventuellement léger bonus d'implantation configurable.

Ne donne pas trop de bonus cumulés pour le moment.

Le contrôle doit surtout représenter une situation politique,
pas provoquer immédiatement un effet boule de neige impossible à arrêter.

==================================================
8. FEEDBACK VISUEL DU CONTRÔLE DANS LE MONDE
==================================================

Même sans graphismes finaux,
je veux pouvoir ressentir qu'une sous-zone est :

- rouge ;
- bleu marine ;
- blanche/grise ;
- contestée.

Mais NE colore pas tout l'écran de manière agressive.

Utilise un feedback greybox discret.

Par exemple :

- petit drapeau ;
- petit panneau ;
- bande colorée sur certains éléments ;
- symbole sur emplacement politique ;
- léger changement de quelques éléments du décor.

Le monde doit rester lisible.

Pas de gros texte :

"ZONE CONTRÔLÉE PAR X".

==================================================
9. TOUR DE COMMUNICATION
==================================================

Implémente complètement la Tour de communication.

C'est un bâtiment POSSÉDÉ.

Même interaction que les autres :

- seuil d'implantation en Sympathisants ;
- billet ;
- prix ;
- présence prolongée ;
- construction ;
- améliorations via le même système.

Je recommande pour cette V0 :

UNE SEULE TOUR DE COMMUNICATION ACTIVE PAR CANDIDAT
sur toute la carte.

Si les fichiers actuels prévoient plusieurs Tours,
adapte proprement la configuration afin de pouvoir choisir facilement
entre `global_limit = 1` et plusieurs tours plus tard.

==================================================
10. EFFET DE LA TOUR DE COMMUNICATION
==================================================

La Tour produit en permanence une petite quantité d'influence
dans TOUT le monde.

Mais elle est beaucoup plus efficace là où le parti possède déjà du terrain.

Logique cible :

ZONE CONTRÔLÉE PAR LE CAMP
→ multiplicateur fort.

ZONE ADJACENTE À UNE ZONE CONTRÔLÉE
→ multiplicateur intermédiaire.

ZONE ÉLOIGNÉE
→ multiplicateur faible.

Valeurs de départ indicatives :

contrôlée : ×2
adjacente : ×1,5
lointaine : ×1

mais utilise les valeurs déjà présentes/configurables.

IMPORTANT :

la Tour ne doit pas conquérir seule la carte.

Son influence de base doit rester relativement faible.

Elle doit fonctionner comme :

AMPLIFICATEUR DU TRAVAIL DE TERRAIN.

==================================================
11. AMÉLIORATION DE LA TOUR
==================================================

Niveaux 1 à 3.

Même principe d'interaction :

rester devant
→ billet
→ paiement progressif
→ amélioration.

Les niveaux peuvent augmenter :

- influence globale de base ;
- éventuellement multiplicateurs.

Ne crée aucun menu.

==================================================
12. INSTITUT DE SONDAGE
==================================================

Implémente complètement l'Institut.

C'est un bâtiment possédé.

Construction :

- seuil local de Sympathisants ;
- coût ;
- billet ;
- présence prolongée.

IMPORTANT :

AVANT sa construction,
le joueur ne connaît PAS précisément son score national.

==================================================
13. UI AVANT INSTITUT
==================================================

Dans le mode normal :

EN HAUT À GAUCHE :
argent en k€.

EN HAUT AU CENTRE :
J-XX, très discret.

C'est tout.

Pas de :

- % Mélenchon ;
- % Le Pen ;
- % Philippe ;
- % Neutres ;
- cercle ;
- carte ;
- compteur de territoires ;
- tableau ;
- mini-map traditionnelle.

L'état réel reste visible en DEBUG uniquement.

==================================================
14. DÉBLOCAGE DU CERCLE
==================================================

Dès que le joueur possède un Institut de sondage actif :

faire apparaître discrètement le CERCLE ÉLECTORAL.

Je veux qu'il soit intégré autour / à proximité immédiate du J-XX,
sans créer une grosse barre HUD.

Le cercle représente les 18 sous-zones
dans leur ordre géographique réel.

Chaque segment indique discrètement :

- rouge ;
- bleu ;
- blanc/gris ;
- neutre/contesté.

Le cercle doit permettre de comprendre :

"où en est la conquête autour du monde ?"

sans ouvrir de menu.

==================================================
15. POURCENTAGES NATIONAUX
==================================================

L'Institut débloque également les scores nationaux.

Agrège les 18 sous-zones selon leur poids.

Afficher de façon extrêmement compacte :

Mélenchon
Le Pen
Philippe
Neutres

Évite les noms complets si cela surcharge.

Par exemple :

🔴 31 %
🔵 29 %
⚪ 24 %
· 16 %

ou une représentation équivalente.

La priorité reste la sobriété.

==================================================
16. SONDAGES NON TEMPS RÉEL
==================================================

IMPORTANT :

l'Institut ne doit pas forcément afficher le score exact en temps réel.

Il doit fonctionner comme un véritable sondage avec rafraîchissement périodique.

Exemple :

mise à jour toutes les 8 secondes
ou selon configuration.

Entre deux sondages :

l'affichage conserve la dernière mesure.

Donc :

SCORE RÉEL
≠
DERNIER SONDAGE AFFICHÉ.

Le debug affiche toujours le score réel.

Cette mécanique doit être claire dans le code :

actualGameState
et
lastPollSnapshot.

==================================================
17. MEETING
==================================================

Implémente complètement le bâtiment / lieu Meeting.

Le Meeting est un bâtiment POSSÉDÉ ou emplacement politique construit
selon les règles déjà définies.

Même interaction :

- implantation suffisante ;
- billet construction ;
- présence prolongée ;
- construction.

Mais son effet principal n'est PAS passif.

==================================================
18. DÉCLENCHEMENT DU MEETING
==================================================

Le candidat doit se déplacer personnellement jusqu'au Meeting.

Une fois devant :

un billet affiche le prix de l'événement.

Présence prolongée
→ paiement
→ déclenchement.

Pas de bouton.

Pas de menu.

Le candidat doit donc réellement perdre du temps
pour venir sur place.

==================================================
19. EFFET DU MEETING
==================================================

Le Meeting produit :

1. un gros gain ponctuel d'influence dans la sous-zone ;

2. pendant quelques secondes :
   multiplicateur d'influence pour les Sympathisants et Militants alliés locaux.

Le meeting doit être très puissant localement,
mais :

- coûte relativement cher ;
- possède un cooldown ;
- nécessite la présence du candidat.

Il devient donc une décision stratégique :

"Est-ce que je traverse la carte pour sauver cette zone
avec un Meeting ?"

==================================================
20. FEEDBACK DU MEETING
==================================================

Pas besoin de graphismes finaux.

Greybox :

quand actif :

- quelques silhouettes supplémentaires décoratives éventuelles ;
- petits symboles ;
- podium rudimentaire ;
- impulsion visuelle ;
- animation simple des Sympathisants.

Je veux comprendre immédiatement :

"un Meeting est en train d'avoir lieu".

Mais n'ajoute pas de grand panneau de texte.

==================================================
21. COOLDOWN DU MEETING
==================================================

Pas de barre de cooldown permanente.

Quand le joueur approche pendant le cooldown :

le lieu peut simplement paraître indisponible.

En debug :
afficher la durée exacte restante.

==================================================
22. PRÉSENCE DU CANDIDAT
==================================================

Connecte la présence du candidat à l'influence si prévu dans la configuration.

Je veux un bonus relativement léger.

Le simple fait de rester dans une zone ne doit pas suffire
à la conquérir rapidement.

Le candidat doit être beaucoup plus utile lorsqu'il :

- convainc ;
- combat ;
- construit ;
- organise un Meeting ;
- protège ses Militants.

==================================================
23. EFFET DES COUPS REÇUS SUR LES SCORES
==================================================

Le système du jalon précédent doit maintenant être connecté
au système électoral complet.

Quand un candidat prend un coup :

une petite quantité de ses voix
dans les sous-zones qu'il contrôle
redevient NEUTRE.

Vérifie :

- renormalisation ;
- absence de valeur négative ;
- répartition correcte ;
- effet sur contrôle territorial ;
- effet éventuel sur le cercle au prochain sondage.

Je veux pouvoir voir en DEBUG :

avant attaque
→ après attaque.

==================================================
24. FERMETURE DE BÂTIMENT PAR PHILIPPE
==================================================

Connecte également le Cabinet administratif
au nouveau système d'influence.

Un bâtiment fermé :

- ne produit plus aucun revenu ;
- ne produit plus aucune influence ;
- ne produit plus aucun bonus ;
- ne permet plus les actions associées.

Exemples :

Permanence fermée
→ bonus d'implantation perdu.

Tour fermée
→ communication coupée.

Meeting fermé
→ impossible de l'utiliser.

Institut fermé
→ IMPORTANT :
le dernier sondage peut rester affiché,
mais il ne se rafraîchit plus tant que l'Institut n'est pas reconstruit.

Je veux cette mécanique.

Cela permet à Philippe de rendre temporairement
les informations adverses obsolètes.

==================================================
25. DESTRUCTION / FERMETURE TOUR ET INSTITUT
==================================================

Quand une Tour de communication est fermée :

son influence globale cesse immédiatement.

Quand un Institut est fermé :

- le cercle peut rester visible ;
- le dernier snapshot reste visible ;
- aucune nouvelle information n'arrive ;
- éventuellement une petite indication visuelle très légère montre que le sondage est ancien.

Pas de gros texte "INSTITUT DÉTRUIT".

==================================================
26. IA MINIMALE POUR TESTER CES SYSTÈMES
==================================================

Ne développe pas encore l'IA stratégique finale.

Mais les deux IA doivent être capables au minimum de :

- construire une Tour quand elles ont l'implantation et l'argent ;
- construire un Institut ;
- construire/utiliser un Meeting ;
- améliorer leur Tour ;
- utiliser leurs ressources sans rester totalement passives.

Une IA simple à règles suffit.

Je veux pouvoir observer une partie
où les trois camps utilisent réellement les nouveaux systèmes.

==================================================
27. MULTIPLAYER READINESS
==================================================

Continue de respecter strictement MULTIPLAYER_READINESS_SPEC.md.

La simulation électorale doit être entièrement indépendante
de l'interface locale.

Structure :

GameSimulation
→ ElectoralState
→ PollSnapshot
→ Presentation.

Les commandes suivantes doivent passer par la simulation :

- BuildCommunicationTowerCommand
- UpgradeCommunicationTowerCommand
- BuildPollingInstituteCommand
- TriggerMeetingCommand

ou équivalent selon l'architecture existante.

La génération d'influence doit fonctionner sur fixed tick.

Aucun calcul de score ne doit dépendre :

- du FPS ;
- de la caméra ;
- de ce qui est actuellement visible à l'écran.

Le serveur futur devra pouvoir calculer toute la carte
même si aucun joueur ne regarde une sous-zone.

Tous les états doivent être sérialisables :

- support de chaque sous-zone ;
- propriétaire ;
- contrôle ;
- influence ;
- bâtiments ;
- niveau Tour ;
- cooldown Meeting ;
- dernier PollSnapshot.

N'implémente PAS encore le réseau.

==================================================
28. DEBUG
==================================================

Ajoute / complète le debug.

POUR CHAQUE SOUS-ZONE :

- M %
- LP %
- EP %
- Neutres %
- leader ;
- contrôle ;
- influence/s de chaque camp ;
- sources détaillées d'influence ;
- poids électoral.

TOUR :

- niveau ;
- influence de base ;
- multiplicateur utilisé dans chaque zone.

INSTITUT :

- score réel ;
- dernier PollSnapshot ;
- âge du sondage ;
- prochain rafraîchissement.

MEETING :

- coût ;
- cooldown ;
- bonus actif ;
- durée restante.

GLOBAL :

- score national réel ;
- score national affiché par sondage ;
- nombre de sous-zones contrôlées ;
- J-XX.

==================================================
29. TEST DE CONTRÔLE TERRITORIAL
==================================================

Ajoute si possible des raccourcis debug pour :

- + influence Mélenchon dans la sous-zone ;
- + influence Le Pen ;
- + influence Philippe ;
- mettre Neutres à 50 % ;
- forcer changement de contrôle ;
- construire Tour instantanément ;
- construire Institut instantanément ;
- déclencher Meeting ;
- accélérer le temps ×5 / ×10.

Cela permettra d'équilibrer rapidement.

==================================================
30. CE QUE JE DOIS POUVOIR TESTER
==================================================

À la fin du jalon, je dois pouvoir :

1. commencer sans Institut ;

2. ne voir aucun score national précis ;

3. développer mon implantation ;

4. observer en debug que mes Sympathisants et Militants
   font évoluer les % locaux ;

5. voir une sous-zone passer :
   contestée → contrôlée ;

6. construire une Tour de communication ;

7. constater que mon influence augmente légèrement partout ;

8. constater que l'effet est supérieur
   dans mes territoires et ceux voisins ;

9. améliorer la Tour ;

10. construire un Institut ;

11. voir apparaître le cercle autour/près du J-XX ;

12. voir apparaître les scores nationaux ;

13. constater que les sondages se mettent à jour
    seulement périodiquement ;

14. continuer à agir entre deux sondages
    et observer une différence entre score réel debug
    et score affiché ;

15. construire un Meeting ;

16. venir physiquement devant ;

17. payer l'événement ;

18. observer un gros changement d'influence locale ;

19. utiliser le Meeting pour faire basculer une zone ;

20. recevoir des coups avec mon candidat
    et constater que je perds du soutien électoral ;

21. fermer une Tour/Institut avec Philippe
    et constater que leurs effets cessent ;

22. voir les IA utiliser elles aussi
    ces trois bâtiments.

==================================================
31. CE QU'IL NE FAUT PAS ENCORE FAIRE
==================================================

Ne développe PAS encore :

- arène médiatique de J0 ;
- premier tour de combat ;
- élimination du troisième ;
- neutralisation de ses unités ;
- sprint de 60 secondes ;
- multiplicateur ×10 du second tour ;
- résultat final complet ;
- multijoueur réseau ;
- matchmaking ;
- graphismes finaux ;
- audio final.

Le prochain jalon sera précisément consacré
à la structure complète :

CAMPAGNE
→ J0
→ PLATEAU MÉDIATIQUE
→ ÉLIMINATION DU 3e
→ SPRINT À DEUX
→ RÉSULTAT FINAL.

==================================================
32. FIN DU JALON
==================================================

Une fois ce jalon terminé :

1. lance plusieurs simulations ;
2. vérifie que les scores restent mathématiquement cohérents ;
3. vérifie qu'aucune sous-zone ne dépasse 100 % au total ;
4. vérifie que les contrôles peuvent réellement basculer dans les trois sens ;
5. vérifie que la Tour n'est pas assez puissante pour remplacer les Militants ;
6. vérifie que le Meeting est puissant mais coûteux ;
7. vérifie que l'Institut n'affiche rien avant sa construction ;
8. vérifie que sa fermeture bloque bien les nouveaux sondages ;
9. teste avec les trois candidats ;
10. corrige les erreurs.

Puis donne-moi un rapport COURT avec :

- règles exactes actuelles de contrôle d'une zone ;
- influence/s des Sympathisants ;
- influence/s des Militants ;
- influence de la Permanence ;
- valeurs de la Tour niveau 1/2/3 ;
- multiplicateurs contrôlé / adjacent / distant ;
- coût de la Tour ;
- coût de l'Institut ;
- fréquence des sondages ;
- coût/puissance/cooldown du Meeting ;
- bonus d'influence de Le Pen ;
- bonus de présence candidat ;
- raccourcis debug.

Puis ARRÊTE-TOI.

Je veux tester personnellement si la conquête électorale,
la communication, les sondages et les Meetings
créent une vraie stratégie territoriale avant d'implémenter la fin de partie.