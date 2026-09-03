Le premier jalon est validé. La caméra, l'échelle générale, le déplacement,
la composition latérale et le principe de persuasion par proximité me conviennent.

Conserve ces éléments tels quels sauf pour UNE correction à appliquer immédiatement :
LA DENSITÉ ET LE RESPAWN DES PNJ NEUTRES.

==================================================
1. CORRECTION IMPORTANTE : DENSITÉ DES PNJ NEUTRES
==================================================

La version actuelle contient trop de PNJ Neutres.

Je veux que les PNJ engageables soient une ressource humaine relativement rare,
comme les vagabonds dans Kingdom.

IMPORTANT :
les PNJ visibles ne représentent toujours PAS la population électorale abstraite.
Ils représentent uniquement les personnes susceptibles de devenir Sympathisants,
puis Militants, puis éventuellement Services d'ordre.

AU DÉBUT D'UNE PARTIE :

Je veux environ 4 à 5 PNJ Neutres maximum PAR BIOME au total.

Un biome comporte 3 sous-zones.

Cela signifie qu'on doit généralement voir seulement :
- 1 PNJ dans certaines sous-zones ;
- 2 dans d'autres ;
- parfois aucune temporairement.

Ne mets surtout pas 4 ou 5 PNJ par sous-zone.

Le monde ne doit pas sembler désert, car les bâtiments et décors l'occuperont plus tard,
mais les personnages recrutables doivent rester relativement rares et importants.

Tous les candidats commencent toujours avec :
- 0 Sympathisant ;
- 0 Militant ;
- 0 Service d'ordre.

Mélenchon ne reçoit aucun PNJ gratuitement.

==================================================
2. RESPAWN DES PNJ
==================================================

Le spawn doit dépendre de la sous-zone.

Le spawn n'est PAS parfaitement régulier.

À chaque réapparition, appliquer une variation aléatoire autour de la durée moyenne
afin que le joueur ne puisse pas prédire précisément le prochain PNJ.

Par exemple :
durée réelle = durée moyenne × facteur aléatoire.

Utilise provisoirement un facteur compris entre environ :
0,75 et 1,25

Tous ces paramètres doivent rester facilement modifiables dans world_layout.json
ou game_balance.json.

VALEURS DE DÉPART :

### Sous-zones populaires / forte disponibilité humaine
environ :
1 nouveau PNJ / jour de jeu

avec variation aléatoire.

Exemple :
0,75 à 1,25 jour.

La Banlieue doit globalement appartenir à cette catégorie.

### Campagne
environ :
1 nouveau PNJ / 1,5 jour de jeu

avec variation aléatoire.

Exemple :
1,1 à 1,9 jour environ.

### Sous-zones aisées / faible disponibilité humaine
environ :
1 nouveau PNJ / 2 jours de jeu

avec variation aléatoire.

Exemple :
1,5 à 2,5 jours.

Les Quartiers riches doivent globalement appartenir à cette catégorie.

Pour les autres sous-zones (Paris 19e, Périurbain, Retraités),
utilise des valeurs intermédiaires cohérentes pour le prototype,
mais NE considère pas ces valeurs comme des affirmations sociologiques :
ce sont uniquement des paramètres fictifs d'équilibrage.

Je veux que chaque sous-zone possède explicitement dans la configuration :
- initial_neutral_count
- mean_spawn_days
- spawn_randomness
- max_neutrals_waiting

afin que je puisse les modifier sans toucher au code.

Évite l'accumulation infinie de Neutres :
chaque point social doit avoir une capacité maximale de PNJ non recrutés.

==================================================
3. OBJECTIF DU DEUXIÈME JALON
==================================================

Implémente maintenant la première véritable boucle de gestion :

NEUTRE
→ SYMPATHISANT
→ IMPLANTATION LOCALE
→ DÉBLOCAGE D'INFRASTRUCTURES
→ UTILISATION DE SERVICES
→ MILITANT
→ ACTION AUTONOME

Je veux surtout tester si le jeu commence à donner la sensation de Kingdom :
je mets progressivement en place un réseau humain et des infrastructures,
puis je vois ce réseau fonctionner sans microgestion permanente.

==================================================
4. SYMPATHISANTS
==================================================

Le système de persuasion déjà validé reste identique :

- aucun argent ;
- aucun bouton ;
- candidat ou Militant restant près du Neutre ;
- progression automatique ;
- Mélenchon convainc personnellement plus rapidement.

Une fois convaincu :

NEUTRE → SYMPATHISANT

Le Sympathisant :
- appartient au candidat ;
- conserve définitivement son biome, sa sous-zone et son point social d'origine ;
- reste principalement dans son secteur tant qu'aucune tâche ne lui est attribuée ;
- produit une faible influence locale abstraite ;
- peut être utilisé indirectement par les infrastructures.

Ne fais pas suivre tous les Sympathisants derrière le joueur.

Je veux qu'ils donnent l'impression de faire partie du territoire.

==================================================
5. IMPLANTATION LOCALE
==================================================

Le nombre de Sympathisants présents dans une zone constitue une condition
de développement territorial.

Certains bâtiments ne peuvent être construits que si suffisamment de
Sympathisants du camp sont implantés localement.

Exemple de logique :

1 Sympathisant
→ présence très faible

2 Sympathisants
→ possibilité de développer une première Permanence

3 ou 4
→ accès à davantage d'infrastructures

etc.

Les valeurs exactes viennent du fichier de configuration.

IMPORTANT :
les Sympathisants ne sont PAS consommés lors de la construction.

Leur nombre représente simplement le niveau minimal d'implantation nécessaire.

==================================================
6. PHILOSOPHIE DES INTERACTIONS ÉCONOMIQUES
==================================================

Il ne doit toujours y avoir :
- aucun menu de construction classique ;
- aucun clic sur les bâtiments ;
- aucun bouton "acheter" ;
- aucune pièce flottante comme ancienne interface.

Le principe doit rester extrêmement proche de Kingdom.

Quand le candidat passe devant quelque chose qui peut être payé :

un PETIT BILLET avec le prix apparaît.

Exemple :

[ billet ] 5 k€

Si le joueur n'a pas assez d'argent :
- billet visible mais clairement indisponible/atténué.

S'il a assez d'argent :
- rester dans la zone quelques secondes commence automatiquement le paiement ;
- afficher une progression visuelle discrète directement sur le billet ;
- aucune touche nécessaire ;
- si le joueur quitte la zone avant la fin, annuler la progression ;
- une fois la durée terminée, l'argent est retiré et l'action s'effectue.

Le joueur doit apprendre le système par observation.

==================================================
7. PERMANENCE
==================================================

Implémente complètement la Permanence.

Elle est un BÂTIMENT POSSÉDÉ PAR UN CAMP.

Avant construction :
- emplacement greybox discret ;
- si le nombre local de Sympathisants est insuffisant :
  aucune possibilité d'achat ;
- dès que le seuil est atteint :
  le billet de construction peut apparaître lorsque le candidat s'en approche.

Construction :
- rester devant ;
- billet avec prix ;
- progression ;
- paiement ;
- bâtiment construit.

Après construction :
- afficher très simplement son appartenance au camp ;
- produire son bonus d'implantation/influence ;
- permettre ses améliorations de niveau avec exactement le même système.

Aucun panneau d'informations complexe.

==================================================
8. IMPRIMERIE : SERVICE NEUTRE
==================================================

IMPORTANT :
l'Imprimerie n'est PAS une propriété politique.

Elle existe dans le monde comme un SERVICE NEUTRE.

Elle :
- n'est jamais construite par un candidat ;
- ne change jamais de couleur de parti ;
- peut être utilisée par les trois candidats.

Le joueur arrive devant l'Imprimerie.

Un billet affiche :
prix d'impression d'UN tract.

S'il reste assez longtemps et possède les fonds :
- il paie ;
- un tract est ajouté à la file de production.

Ensuite :

1. rechercher le Sympathisant allié disponible le plus proche ;
2. lui attribuer automatiquement la tâche ;
3. il marche physiquement vers l'Imprimerie ;
4. il récupère le tract ;
5. son symbole/état change ;
6. il devient MILITANT ;
7. il repart automatiquement accomplir son rôle.

Je veux absolument VOIR cette séquence.

C'est une des animations fonctionnelles les plus importantes du prototype,
même avec des silhouettes greybox.

Si plusieurs tracts sont achetés :
- utiliser une petite file d'attente ;
- attribuer les Sympathisants de manière déterministe.

Compatible future architecture multijoueur.

==================================================
9. MILITANT
==================================================

À cette étape, le combat complet n'est toujours pas nécessaire.

Le Militant doit cependant déjà fonctionner comme unité autonome.

Il :
- se déplace ;
- choisit une zone utile ;
- peut se diriger vers une zone proche où son camp est peu implanté ;
- peut rencontrer un PNJ Neutre ;
- reste automatiquement près de lui ;
- tente de le convaincre ;
- produit davantage d'influence abstraite qu'un Sympathisant.

Le Militant est donc extrêmement important :

le candidat n'est plus obligé de recruter personnellement tous les PNJ.

Je veux commencer à observer :

CANDIDAT
→ convainc quelques personnes
→ crée des Militants
→ ces Militants convainquent d'autres personnes
→ le réseau commence à s'étendre.

Attention cependant :
cela ne doit pas devenir une croissance exponentielle incontrôlable.

La rareté des PNJ et le coût des tracts doivent limiter naturellement cette expansion.

==================================================
10. FINANCEMENT
==================================================

Implémente le bâtiment Financement.

C'est un bâtiment possédé.

Il :
- nécessite un seuil local de Sympathisants ;
- coûte de l'argent ;
- se construit par présence prolongée + billet ;
- produit ensuite un revenu passif.

Les revenus de Philippe sont supérieurs conformément aux règles déjà définies.

Je veux ainsi pouvoir tester cette décision :

"Est-ce que je dépense mon argent maintenant pour produire des Militants,
ou est-ce que j'investis dans mon économie ?"

==================================================
11. ARGENT ET UI
==================================================

Dans le monde normal :

EN HAUT À GAUCHE UNIQUEMENT :

argent affiché en k€.

Exemples :
3 k€
12 k€
125 k€

Aucune grande boîte HUD.

Pas de :
- compteur de Sympathisants ;
- compteur de Militants ;
- nombre de Neutres ;
- revenu/seconde ;
- pourcentage électoral ;
- barre de vie ;
- barre spéciale.

Toutes ces informations peuvent exister dans le mode DEBUG uniquement.

Le J-XX conserve la présentation discrète déjà validée si elle est présente dans la version actuelle.

==================================================
12. MULTIPLAYER READINESS
==================================================

Continue impérativement à respecter MULTIPLAYER_READINESS_SPEC.md.

Cette V0 reste :
1 humain + 2 IA.

Mais prépare le code pour :
- 2 humains + 1 IA ;
- 3 humains ;
- serveur autoritaire futur.

En particulier :

La persuasion doit être gérée dans GameSimulation et non directement par le visuel.

L'achat doit suivre :

Player proximity/intention
→ Command
→ validation GameSimulation
→ transaction
→ GameEvent
→ affichage.

La sélection automatique d'un Sympathisant par l'Imprimerie doit être déterministe.

Tous les PNJ possèdent des IDs uniques.

Tous les bâtiments/services possèdent des IDs uniques.

Les files de production doivent appartenir à l'état sérialisable.

Le hasard des spawns doit pouvoir fonctionner avec une seed déterministe.

IMPORTANT :
pour le spawn aléatoire des PNJ,
utilise le RNG de la simulation avec une seed contrôlée,
pas un hasard directement dépendant du client graphique.

N'implémente PAS encore le réseau.

==================================================
13. DEBUG
==================================================

Dans l'overlay debug uniquement, je veux pouvoir inspecter :

POUR LA SOUS-ZONE :
- PNJ Neutres présents ;
- prochain spawn estimé ;
- durée moyenne de spawn ;
- capacité maximale ;
- Sympathisants par camp ;
- Militants ;
- niveau d'implantation ;
- influence/s.

POUR UN PNJ :
- ID ;
- origin biome ;
- origin subzone ;
- origin social point ;
- rôle ;
- camp ;
- tâche actuelle ;
- cible ;
- destination.

POUR LES BÂTIMENTS :
- propriétaire ;
- niveau ;
- seuil de Sympathisants ;
- coût ;
- état ;
- file de production éventuelle.

POUR L'ÉCONOMIE :
- argent exact ;
- revenu passif ;
- dépenses.

==================================================
14. CE QUE JE DOIS POUVOIR TESTER
==================================================

À la fin de ce jalon, je dois pouvoir :

1. commencer avec 0 Sympathisant ;

2. voir seulement quelques PNJ Neutres dans chaque biome
   (environ 4 à 5 au total par biome au démarrage) ;

3. constater qu'ils réapparaissent lentement,
   avec un délai variable et imprévisible ;

4. convaincre personnellement quelques Neutres ;

5. obtenir suffisamment de Sympathisants dans une zone ;

6. voir qu'un emplacement de Permanence devient disponible ;

7. m'arrêter devant ;

8. voir apparaître un billet avec son prix ;

9. rester quelques secondes ;

10. acheter automatiquement la Permanence ;

11. aller devant une Imprimerie neutre ;

12. payer un tract de la même manière ;

13. voir un Sympathisant partir tout seul jusqu'à l'Imprimerie ;

14. le voir récupérer son tract ;

15. le voir devenir Militant ;

16. voir ce Militant partir tout seul ;

17. le voir éventuellement convaincre un nouveau PNJ ;

18. construire un bâtiment Financement ;

19. constater que mon argent augmente ensuite progressivement ;

20. refaire ces actions dans plusieurs biomes.

==================================================
15. NE PAS ENCORE IMPLÉMENTER
==================================================

Ne développe toujours PAS :

- Service d'ordre ;
- raid ;
- Cabinet administratif de Philippe ;
- combat complet ;
- combo 3 coups ;
- dégâts électoraux ;
- pouvoirs spéciaux ;
- Tour de communication ;
- Institut de sondage ;
- Meeting ;
- arène médiatique J0 ;
- sprint du second tour ;
- multijoueur réseau.

Je veux d'abord valider cette boucle économique/humaine.

==================================================
16. FIN DU JALON
==================================================

Quand cette phase est terminée :

1. lance le projet toi-même ;
2. corrige les erreurs ;
3. vérifie les tests associés ;
4. ne modifie pas les éléments précédemment validés sans nécessité ;
5. indique-moi précisément comment tester :
   - spawn ;
   - persuasion ;
   - Permanence ;
   - Imprimerie ;
   - transformation en Militant ;
   - Financement ;
6. indique-moi où sont définies toutes les valeurs d'équilibrage ;
7. indique-moi les raccourcis debug utiles ;
8. signale toute hypothèse que tu as dû faire ;
9. puis ARRÊTE-TOI.

Je veux tester personnellement cette version avant de poursuivre.