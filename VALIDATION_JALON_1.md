# Validation du premier jalon — 3 septembre 2026

Périmètre : phases 0 à 3 d’`IMPLEMENTATION_TASKS.md`, avec IA minimale et débogage nécessaires pour les vérifier. Les documents d’origine ont été lus intégralement et les deux images de référence examinées avant l’implémentation.

## Résultat

**24 tests automatiques réussis, 0 échec**, avec `npm.cmd test`, sous Node.js 22.14.0. Le serveur a été lancé et le jeu ouvert dans le navigateur intégré. Aucun avertissement ni erreur dans les journaux du navigateur pendant les vérifications.

## Critères applicables de PROTOTYPE_ACCEPTANCE_TESTS.md

| Groupe | Résultat pour ce jalon | Vérification |
| --- | --- | --- |
| A — Format et proportions | Conforme aux ratios écrits : 16:9, sol 93 %, épaisseur 2,5 %, candidat 15 % | Tests des métriques à 1920×1080, 960×540, 640×360 et 390×219,375 ; affichage observé dans le navigateur |
| A — Caméra et environnement | Candidat centré à l’arrêt, suivi adouci, anticipation de 6 % en marche ; pas de zoom collectif, d’eau ou de route sous les pieds | Observation en jeu, vérification du suivi et des coordonnées ; boucle testée dans les deux sens |
| B — Argent et HUD | Argent compact en `k €`, seul affichage permanent de l’interface normale ; jour et indications de départ transitoires | Interface et captures observées ; aide et panneau de débogage fermables |
| B / K — Institut | Aucun cercle ou score national visible | Pas d’Institut ni de calcul électoral dans ce jalon |
| C — État initial | 74 Neutres, 0 Sympathisant pour chacun des trois camps | Population exacte de chaque sous-zone et positions de départ testées |
| C — Spawn | Un nouveau Neutre par intervalle configuré, dans les 18 sous-zones, même hors champ | Test sur 36 s, contrôle de chaque population et de chaque timer |
| C — Origines | IDs de biome, sous-zone et point social inchangés après conversion et démobilisation | Tests d’origines et de restauration |
| C — Persuasion | Sans bouton, sans dépense, une cible par acteur, progression annulée hors portée | Conversion, coût nul, interruption, reprise, concurrence et couture de boucle testés |
| C — Bonus Mélenchon | 50 ticks, contre 90 pour Le Pen et Philippe | Vérification avant et après le tick exact de conversion |
| C — Retour d’origine | Démobilisation via commande de débogage, déplacement vers l’origine puis neutralité | Test de simulation ; le combat qui la déclenchera normalement est reporté |
| M — Silhouettes | Tête, torse, deux bras, deux jambes, faction et symbole de rôle ; marche et persuasion | Vérification visuelle des silhouettes et de la conversion |
| N — Séparation | Simulation sans DOM ni caméra, contrôleurs humains et IA utilisant des commandes explicites | Tests des commandes et preuve que les règles ignorent le candidat local et le type du contrôleur |
| N — Temps fixe | 30 Hz ; même état après une durée identique à 1, 20, 30, 60 et 144 FPS et à cadence irrégulière | Comparaison complète des états ; le rendu rattrape les ticks sans tronquer le temps simulé |
| N — IDs et hasard | IDs uniques stables ; graine et état RNG sauvegardés | Tests d’unicité, reproductibilité et divergence entre graines |
| N — État sérialisable | Snapshot chargé pendant une conversation puis évolution identique durant 1 200 ticks avec IA et nouveaux spawns | Comparaison complète des deux simulations ; imports invalides refusés sans modifier la partie |
| N — Restauration dans l’interface | Import réel de `artifacts/snapshot-validation.json` : graine 4242, population et timers restaurés | Panneau de débogage observé après import, avec nouvelle conversation en progression |
| N — Hors caméra | PNJ et deux IA continuent à agir dans tout le monde | Tests et observation des Sympathisants des deux IA dans le panneau |
| O — Débogage applicable | Origines, rôles, durabilité interne, timers, cibles, spawn, positions, graine, événements et tick visibles ; changement de candidat et IA activables | Panneau observé, sélection de Le Pen et téléportation en Campagne vérifiées |

La taille de la zone jouable a également été mesurée dans le navigateur pour des formats téléphone portrait (390×844) et paysage (844×390). Le ratio reste proche de 1,7778, à l’arrondi de pixels près. Le test sur téléphone physique et les gestes tactiles restent à faire.

Les appuis courts ont été vérifiés dans le navigateur : trois appuis à droite ont déplacé le candidat de 108 à 108,36 unités. Un test spécifique garantit la conservation d’un appui entre deux ticks et la remise à zéro de l’input lors d’une perte de focus. L’aide s’ouvre et se referme avec H ; elle suspend la partie.

## Critères volontairement reportés

- C : conversion par un Militant ; ces unités n’existent pas encore.
- D à H : implantation et sept bâtiments de gameplay, billets, dépenses, Imprimerie, équipements, SO, Cabinet administratif.
- I et J : combos, dégâts, knockback, pouvoirs spéciaux et charge.
- K : électorat abstrait, influence et Institut de sondage.
- L : J0, élimination et sprint du second tour.
- M : animations de coups et knockback ; la démobilisation est actuellement visualisée par une silhouette atténuée qui rentre à l’origine.
- N : transactions atomiques, puisqu’aucune transaction n’existe dans ce jalon ; réseau effectif hors périmètre.
- O : influence, support exact, pouvoirs et paiement ; le débogage les indique explicitement comme hors jalon au lieu d’afficher des résultats fictifs.

## Limites et validation attendue

- Le ressenti de la caméra, l’échelle des personnages, la vitesse de déplacement et le rythme des conversions **attendent l’essai du concepteur**. Les contrôles techniques ne remplacent pas cette validation.
- Les IA suivent un comportement simple de recrutement. Il ne s’agit pas de l’IA stratégique du jeu final.
- Aucun plafond de population n’a été inventé. Une session très longue accumule donc des PNJ ; la performance de longues parties n’a pas été qualifiée.
- L’horloge s’arrête à J-1 pour permettre de continuer l’essai sans inventer J0. Fermer l’onglet perd la partie sauf si un état JSON a été exporté.
- Le lanceur Windows ouvre le navigateur après le démarrage du serveur. Le lancement par Node et l’accès HTTP ont été vérifiés ; le double-clic Explorer du fichier `.cmd` n’a pas été automatisé.

**Arrêt du développement après livraison de ce jalon.**
