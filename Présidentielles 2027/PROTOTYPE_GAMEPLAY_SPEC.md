# PROTOTYPE_GAMEPLAY_SPEC — V0.3

## 0. Source de vérité

Lire ce document avec `VISUAL_COMPOSITION_SPEC.md`, `MULTIPLAYER_READINESS_SPEC.md`,
`game_balance.json`, `world_layout.json` et `building_catalog.json`.

La V0.3 reste une greybox solo + IA, mais son architecture doit permettre un futur multijoueur.

# 1. Monde et caméra

Le monde est une ligne horizontale bouclée de 6 biomes × 3 sous-zones ≈ 18 écrans :
Paris 19e/Bobo → Banlieue → Périurbain/Usine → Campagne → Retraités → Quartiers riches → retour Paris.

Caméra : side-view 2D, joueur centré, sol très fin très bas, presque rien sous le sol.
Toutes les proportions et références sont dans `VISUAL_COMPOSITION_SPEC.md`.

# 2. Deux systèmes séparés

## Monde physique
`NEUTRE → SYMPATHISANT → MILITANT → SERVICE_D_ORDRE`

Exception Philippe : pas de Service d'ordre permanent.

## Électorat abstrait
Chaque sous-zone : Mélenchon %, Le Pen %, Philippe %, Neutres % = 100 %.
Les PNJ visibles ne sont jamais un échantillon 1:1 de cet électorat.

# 3. PNJ Neutres

Chaque PNJ conserve à vie : `origin_biome_id`, `origin_subzone_id`, `origin_social_point_id`.
La densité initiale et le respawn varient par sous-zone dans `world_layout.json`.
Tous les candidats commencent avec 0 Sympathisant.

Après démobilisation, le PNJ retourne physiquement vers son point d'origine puis redevient Neutre.

# 4. Neutre → Sympathisant

Aucun argent, aucun bouton.
Un candidat ou un Militant reste suffisamment longtemps à proximité : persuasion automatique.
Feedback léger et diégétique, sans grosse jauge.

Bonus Mélenchon : son temps de persuasion personnelle est plus court.

# 5. Sympathisants et implantation

Le Sympathisant :
- faible influence locale ;
- main-d'œuvre de campagne ;
- condition de construction.

Les bâtiments possédables nécessitent un nombre minimal de Sympathisants locaux pour devenir disponibles.
Le seuil n'est pas consommé.

# 6. Interaction économique générale

Il n'y a plus de clic/bouton d'achat ni de pièces contextuelles.

Pour toute dépense :
1. entrer dans la zone d'interaction ;
2. un billet avec le prix en `k €` apparaît ;
3. si fonds suffisants, rester immobile/présent pendant quelques secondes ;
4. progression discrète automatique ;
5. à complétion, la simulation débite l'argent et exécute l'action ;
6. sortir trop tôt annule/décrémente la progression.

La transaction est gérée par la simulation, pas par l'UI.

# 7. Deux catégories de bâtiments/services

## 7.1 Bâtiments possédés par une faction
Ils ont un propriétaire, peuvent avoir des niveaux et peuvent, si autorisé, être ciblés par Philippe.

## 7.2 Services neutres
Ils existent déjà dans le monde et n'appartiennent à personne.
Un camp paie uniquement pour utiliser le service.

L'Imprimerie est le premier service neutre de la V0.3.

# 8. Imprimerie neutre : Sympathisant → Militant

L'Imprimerie :
- est préexistante ;
- n'est jamais achetée ;
- n'est jamais colorée comme propriété d'un parti ;
- est utilisable par tous les camps ;
- ne peut pas être fermée par l'action administrative de Philippe dans la V0.3.

Pour imprimer un tract :
1. le candidat reste devant l'Imprimerie ;
2. un billet affiche le prix d'UN tract ;
3. le maintien dans la zone paie automatiquement une impression ;
4. le Sympathisant allié éligible le plus proche dans le biome reçoit la tâche ;
5. il vient chercher le tract ;
6. il devient Militant ;
7. il part automatiquement vers un front.

Chaque nouvelle impression nécessite un nouveau paiement.

# 9. Service d'ordre — Mélenchon et Le Pen

Bâtiment possédé : `Local du service d'ordre`.
Produit un SO à partir du Militant allié le plus proche dans le biome : le joueur paie l'équipement
via présence devant le bâtiment, le Militant vient le chercher, puis devient SO.

Le SO reste normalement dans son biome et fonce sur tout candidat/Militant ennemi qui y pénètre.

Raid : depuis le Local, une dépense permet d'envoyer tous les SO disponibles du biome vers gauche ou droite.
L'implémentation greybox peut utiliser deux zones de présence distinctes de part et d'autre du bâtiment
pour choisir intuitivement la direction sans menu.

# 10. Philippe — Cabinet administratif

Philippe n'a pas de SO permanent.
Son bâtiment factionnel est le `Cabinet administratif`.

Il peut payer cher pour fermer un **bâtiment adverse possédé** :
- bâtiment désactivé ;
- améliorations perdues ;
- propriétaire obligé de revenir ;
- reconstruction et upgrades à repayer.

Les services neutres, notamment l'Imprimerie, sont exclus des cibles.

# 11. Fonctions de bâtiments V0.3

1. Permanence — possédée ; implantation/influence locale.
2. Imprimerie — **service neutre**, paiement par tract, aucune propriété.
3. Local SO (Mélenchon/Le Pen) OU Cabinet administratif (Philippe) — possédé.
4. Financement — possédé ; revenus.
5. Tour de communication — possédée ; influence passive globale modulée par contrôle/proximité.
6. Institut de sondage — possédé ; débloque l'information nationale.
7. Meeting — possédé ; forte mobilisation active locale, candidat présent.

# 12. Argent

Seule ressource monétaire visible : argent.
Affichage permanent : haut gauche uniquement, format `k €`.
Pas de compteur permanent de PNJ, Militants ou votants.

# 13. Combat des unités

Toutes les durabilités sont internes et invisibles.
Combo candidat : léger → léger → fort.

Calibration initiale :
- Sympathisant : un combo complet le démobilise ;
- Militant : un combo complet bien placé le démobilise ou le laisse à la limite selon réglage ;
- SO : environ 3× plus robuste ; 1v2 serré mais gagnable, 1v3 très dangereux.

Aucun décès : à 0 durabilité, démobilisation puis retour à l'origine.

# 14. Candidats : pas de PV en exploration

Un candidat touché ne perd pas une barre de vie.
Chaque coup/insulte provoque une petite `electoral_damage` : des voix du candidat dans les territoires
qu'il contrôle redeviennent Neutres.
Knockback/stun restent physiques et visibles.

# 15. Pouvoirs spéciaux

Pas de barre de cooldown.
Les coups réussis remplissent `special_charge` en interne.
Quand prêt : étoile/éclat dans les yeux.
Le coup d'attaque suivant déclenche automatiquement l'ulti.

Mélenchon : Hologrammes temporaires qui se ruent sur les adversaires.
Le Pen : Vague bleu marine en ligne droite, Sympathisant immédiatement démobilisé,
Militant presque démobilisé, gros knockback.
Philippe : CRS temporaires à gauche/droite formant un mur mobile et frappant les adversaires.

# 16. Bonus stratégiques

Mélenchon : persuasion personnelle plus rapide ; sa zone de départ a une forte disponibilité de Neutres via le monde.
Le Pen : meilleur support initial local + multiplicateur de gain d'influence.
Philippe : argent initial et revenus supérieurs + Cabinet administratif.

Tous commencent avec 0 Sympathisant / 0 Militant / 0 SO.

# 17. Influence et contrôle

Sources : Sympathisants, Militants, Permanence, Tour de communication, Meeting, présence/actions candidat.
La conquête prend d'abord aux Neutres abstraits ; les derniers deviennent plus difficiles à convertir.
Quand les Neutres sont rares, retournement adverse très lent possible.

# 18. Information / Institut de sondage

Avant Institut : aucun cercle national et aucun pourcentage national exact.
Après Institut : cercle compact + scores nationaux accessibles/visibles.
Le cercle peut intégrer le jour courant en son centre.

En debug, tout reste visible.

# 19. UI exploration

Se référer à `VISUAL_COMPOSITION_SPEC.md`.

Permanent : uniquement argent top-left en `k €`.
Jours : information transitoire au changement de jour ; intégrable au cercle après Institut.
Dépenses : billet + prix + progression de présence.
Aucun gros HUD supérieur.

# 20. J0 — arène médiatique

À J0 : transition vers plateau médiatique à trois.
Les scores nationaux deviennent exceptionnellement des jauges de combat visibles.
Le premier candidat dont la jauge atteint 0 est éliminé ; combat arrêté immédiatement.

# 21. Après élimination du troisième

- bâtiments possédés → neutres/fermés ;
- Sympathisants/Militants/SO → démobilisés ;
- PNJ retournent vers leurs origines ;
- services neutres restent inchangés.

# 22. Sprint second tour

Retour au monde avec 2 candidats.
Chronomètre 60 s par défaut.
Influence ×10 par défaut.
Les ex-unités du troisième constituent une réserve humaine à reconvaincre.
À 0 s : calcul national, meilleur des deux gagne.

# 23. Greybox

Silhouettes humaines pixelisées primitives : tête, torse, 2 bras, 2 jambes, symbole de rôle.
Animations minimales : idle, marche, persuasion, coup, knockback, démobilisation.

# 24. Solo maintenant, multijoueur plus tard

V0.3 : 1 humain + 2 IA.
Le code doit respecter intégralement `MULTIPLAYER_READINESS_SPEC.md`.
Ne pas implémenter de réseau maintenant.

# 25. Debug

Overlay séparé : support exact, influence/s, durabilité, charge spéciale, origine PNJ, timers,
états IA, bâtiments, transaction hold, phase de partie et fixed tick.

# 26. Hors scope

Sprites/décors finaux, audio final, matchmaking, serveurs, comptes, monétisation, sauvegarde cloud,
multijoueur réseau effectif, véhicules, narration complexe.
