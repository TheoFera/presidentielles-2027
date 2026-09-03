# Présidentielles 2027 — cinquième jalon jouable

Une partie complète : **campagne → arène à trois → élimination → sprint à deux → résultat → rejouer**. Les systèmes des quatre premiers jalons sont conservés.

## Lancer et jouer

### Sur téléphone et GitHub Pages

Le jeu est prêt pour un hébergement statique : aucun serveur de jeu ni installation sur le téléphone n’est nécessaire. La publication doit d’abord être activée sur GitHub.

1. Dans le dépôt GitHub, ouvre **Settings → Pages** et choisis **GitHub Actions** comme source.
2. GitHub Pages doit être disponible pour le dépôt : un dépôt privé nécessite une offre compatible. Sinon, il faut décider de rendre le dépôt public (cela expose aussi son code et son historique).
3. Envoie les modifications sur `main`, ou lance **Actions → Publier le jeu sur GitHub Pages → Run workflow**. Les tests passent avant la publication.
4. Après la réussite du déploiement, ouvre l’adresse affichée dans **Settings → Pages** depuis Safari ou Chrome sur ton téléphone. L’adresse attendue est https://theofera.github.io/presidentielles-2027/ ; elle n’est utilisable qu’après activation et publication.

Sur téléphone, le **mode paysage** est conseillé. Maintiens **← / →** pour marcher et touche **Frapper** avec l’autre pouce. Relâche la flèche pour t’arrêter et convaincre. **Pause** ouvre l’aide ; **Plein écran** fonctionne si le navigateur le permet. Le portrait conserve le monde sans le déformer et place les commandes sous le jeu. La partie est locale à chaque onglet : recharger la page la recommence.

`npm run build` prépare le dossier `dist/` avec uniquement la page, le code du jeu et ses quatre fichiers de réglages. Le déploiement ne publie ni les documents de travail ni les sauvegardes de test. Les chemins relatifs fonctionnent sous `/presidentielles-2027/`.

### Sur ordinateur, en local

Double-clique sur **Lancer le jeu.cmd**, puis ouvre [le jeu](http://localhost:2027/). Garde le terminal ouvert. Recharge la page si elle était déjà ouverte.

- Flèches, Q/D ou A/D : marcher.
- Espace ou J : léger → léger → fort. Quand les yeux brillent, l’attaque suivante déclenche le pouvoir.
- Rester près d’un Neutre : convaincre automatiquement.
- Rester devant un billet : payer après 2 secondes de présence, avec les fonds et l’implantation nécessaires.
- Après un achat de bâtiment : s’éloigner, puis revenir. L’Imprimerie permet plusieurs commandes séparément payées en restant sur place.
- H, Échap ou P : aide et pause. F : plein écran. F3 : débogage.

Les Militants marchent toujours à **2,4 unités/s**, contre **3,6** pour le candidat ; leur plafond reste à deux fois la vitesse du joueur.

## Déroulement

La campagne commence à **J-30**, avec **20 secondes par jour**, soit 10 minutes. Le J-XX reste discret. L’onglet masqué met la session locale en pause.

À **J0**, le monde est intégralement sauvegardé et figé. Sur le plateau télévisé, le **score national réel devient la jauge visible** de chaque candidat. Les coups et pouvoirs retirent directement des points de cette jauge, sans modifier le soutien sauvegardé. Le combat s’arrête au **premier candidat à 0**.

Les finalistes reviennent immédiatement à leurs anciennes positions, avec leur argent, leur charge et leurs délais du monde conservés. Les anciens S/M/SO du troisième deviennent gris et rentrent à pied à leur origine ; ils redeviennent alors Neutres et peuvent être convaincus normalement. Ses bâtiments perdent leurs effets et leur propriétaire ; leurs emplacements sont à nouveau constructibles en remplissant les conditions et en payant. Les Imprimeries restent neutres ; seules les commandes du camp éliminé sont annulées. Toutes ses voix deviennent **Neutres**, sans transfert aux finalistes.

Le J-XX est remplacé par **60 secondes**. L’influence est multipliée par **10**, une seule fois, avant la résistance électorale. Les combats, pouvoirs, raids, constructions et Meetings restent actifs. Les IA recherchent notamment la réserve humaine du troisième, les Meetings accessibles et le rival proche.

Un Institut actif publie un sondage toutes les **2,5 secondes**. Fermé, il conserve sa dernière mesure. La Tour bénéficie du ×10 avec un facteur propre de **0,35**, pour limiter son influence sans présence sur le terrain. Le Meeting reste payant et exige la présence du candidat ; son délai passe à **22 secondes**, sans raccourcir un événement actif.

À zéro, les **scores réels des finalistes** décident du vainqueur, même si le sondage est ancien. Les Neutres restent possibles. Une égalité déclenche **15 secondes supplémentaires**, renouvelées si nécessaire.

Si ton candidat est éliminé, tu passes en **spectateur** et choisis quel finaliste suivre, sans contrôler son camp. **Rejouer** crée une partie entièrement neuve avec le même candidat ; **Retour à l’accueil** prépare une nouvelle campagne en pause sur l’aide.

## Tester la fin rapidement

**F3 → « Partie complète : J0, arène et sprint »** donne accès à :

| Commande | Effet |
|---|---|
| Forcer J0 / Démarrer l’arène | Figer le monde courant et lancer le premier tour |
| Candidat à éliminer + Terminer l’arène | Choisir le troisième et revenir au monde |
| Démarrer le sprint | Passer directement au sprint en neutralisant le camp sélectionné |
| Chrono à 10 s | Rapprocher le résultat |
| Forcer une égalité à l’échéance | Déclencher immédiatement la prolongation |
| 50 % de Neutres partout | Tester la reconquête sur les 18 sous-zones |
| Afficher le score réel | Consulter l’état autoritaire, distinct du sondage |
| Vitesse ×5 | Accélérer toute la simulation ; F6 permet de revenir à ×1 |
| Exporter le résumé DEBUG | Télécharger la télémétrie JSON |

**F4** met en pause quand le debug est ouvert. **K** charge le pouvoir, y compris dans l’arène. Les anciens outils restent présents. Les commandes incompatibles avec la phase sont refusées. Après le résultat, seule une nouvelle partie relance la simulation.

Ces fichiers sont importables dans **F3 → Déplacements, fonds de test et sauvegardes → Importer un état JSON** ; `npm run test:partie` les régénère :

- `artifacts/jalon5-arene-visuelle.json` : jauges 34/30/26, pouvoirs prêts, camp Le Pen établi près de la caméra du monde.
- `artifacts/jalon5-effondrement.json` : ce camp vient d’être neutralisé ; douze anciens alliés repartent vers leurs origines.
- `artifacts/jalon5-j0.json`, `jalon5-sprint.json`, `jalon5-resultat.json` : étapes d’une campagne normale de trois IA, graine 2027.

Les sauvegardes utilisent le **format 5**, lié aux réglages courants. Les anciens JSON des jalons précédents sont incompatibles. Un import invalide est refusé sans modifier la partie ouverte.

## Réglages dans game_balance.json

Le bloc `money.supporter_income_per_second_by_origin_biome` règle le revenu ajouté **par partisan et par seconde de simulation à vitesse ×1**, selon son biome de naissance :

| Biome d’origine | Clé à modifier | Revenu par partisan |
|---|---|---|
| Paris 19e / Bobo | `paris_19e` | 0,05 k €/s |
| Banlieue | `banlieue` | 0,02 k €/s |
| Périurbain / Usine | `periurbain_usine` | 0,04 k €/s |
| Campagne | `campagne` | 0,03 k €/s |
| Retraités | `retraites` | 0,06 k €/s |
| Quartiers riches | `quartiers_riches` | 0,1 k €/s |

Un partisan est un **Sympathisant, un Militant ou un Service d’ordre** de ton camp. Son revenu commence dès son recrutement, reste identique après une promotion ou un déplacement, et cesse à sa démobilisation. S’il est ensuite recruté par un autre camp, sa contribution revient à ce camp avec le même biome d’origine. Les Neutres, candidats, unités temporaires et pourcentages de soutien électoral ne produisent pas ce revenu.

Le gain total est : **(revenu de base + contributions des partisans + revenus des bâtiments de financement) × bonus du candidat**. Les contributions des partisans ont été divisées par **20**. Le bonus de Philippe reste ×1,3 et s’applique à l’ensemble. Par exemple, cinq partisans de Banlieue donnent **0,22 k €/s** avec le revenu de base, sans bâtiment ni bonus, contre 0,12 sans partisan. Le monde étant figé dans l’arène et en pause, aucun revenu n’y est versé ; un camp éliminé ne gagne plus rien.

Le gain total apparaît sous l’argent en jeu. **F3** affiche le détail par biome et les contributions avant bonus. Pour changer un montant, modifie le nombre dans `Présidentielles 2027/game_balance.json` (avec un point pour les décimales, par exemple `0.8`), enregistre puis **recharge la page**. `0` désactive la contribution d’un biome. Les changements s’appliquent aussi aux IA et demandent une nouvelle partie ; les sauvegardes liées aux anciens réglages sont incompatibles.

Le réglage `money.campaign_spending_limit` vaut **16800 k€**, soit **16,8 millions d’euros par candidat pour toute la partie**, premier et second tours compris. Il limite les dépenses cumulées, pas l’argent détenu : constructions, améliorations, reconstructions, tracts, équipements, raids, fermetures et Meetings sont tous comptés. Un achat dépassant le reliquat est bloqué avant le paiement, même avec assez d’argent. Une dépense qui atteint exactement le plafond est autorisée. Les revenus, fonds de test et remboursements n’augmentent pas le plafond restant ; les remboursements restent ajoutés à la trésorerie. Le compteur est conservé dans les sauvegardes et entre les tours, et revient à zéro avec une nouvelle partie.

## Population maximale par sous-zone

Dans `Présidentielles 2027/world_layout.json`, chaque sous-zone possède `max_npcs_by_origin`. Ce plafond remplace `max_neutrals_waiting` : il compte **tous les PNJ existants nés dans la sous-zone**, tous camps et rôles confondus (Neutres, Sympathisants, Militants, Services d’ordre et démobilisés), même s’ils sont maintenant ailleurs. Les candidats et unités temporaires des pouvoirs n’entrent pas dans ce compte.

| Biome | Sous-zone A | Sous-zone B | Sous-zone C |
|---|---|---|---|
| Paris 19e / Bobo | Canal, cafés : **9** | Place, commerces : **10** | Quartier mixte : **9** |
| Banlieue | Cité dortoir : **9** | Marché central : **9** | Pavillons modestes : **7** |
| Périurbain / Usine | Zone artisanale : **7** | Usine, entrepôts : **8** | Sortie vers les champs : **6** |
| Campagne | Entrée du village : **6** | Cœur de village : **7** | Champs : **5** |
| Retraités | Pavillons : **6** | Square, associations : **7** | Secteur aisé : **5** |
| Quartiers riches | Résidentiel : **5** | Avenue commerçante : **6** | Haussmannien : **5** |

Soit **126 PNJ permanents au maximum dans le monde** avec ces réglages. La fréquence et sa variation aléatoire sont conservées jusqu’au plafond. Tous les points sociaux d’une même sous-zone partagent sa capacité. À saturation, les tentatives sont ignorées puis reprogrammées, sans accumuler de PNJ à faire apparaître plus tard. Recruter, promouvoir, déplacer, changer de camp ou démobiliser un PNJ ne libère aucune place : il garde son identité et son origine, puis revient au même point social lorsqu’il est démobilisé. Seule sa suppression effective libérerait une place ; le jeu ordinaire ne tue pas les PNJ.

F3 distingue la population présente de la population d’origine et indique quand le plafond est atteint. Même les apparitions de débogage respectent cette limite. Après modification des plafonds, recharge la page pour démarrer une nouvelle partie ; les anciennes sauvegardes ne sont plus compatibles.

## Autres réglages de partie

| Chemin | Valeur par défaut |
|---|---|
| `time.starting_days_before_first_round` / `real_seconds_per_game_day` | 30 / 20 s |
| `time.second_round_sprint_seconds` / `second_round_influence_multiplier` | 60 s / ×10 |
| `first_round_arena.damage.light_1` / `light_2` / `heavy` | 0,45 / 0,55 / 1,1 point |
| `first_round_arena.damage.hologram` / `wave` / `crs` | 0,12 / 6 / 0,22 point par impact |
| `first_round_arena.ai_retarget_seconds` / `ai_variation_units` | 2,2 s / 7 |
| `second_round.poll_refresh_seconds` | 2,5 s |
| `second_round.tower_influence_multiplier` | 0,35 avant le ×10 global |
| `second_round.meeting_cooldown_seconds` | 22 s, au moins la durée du Meeting |
| `second_round.extension_seconds` / `tie_rule` | 15 s / `REPEAT_OVERTIME` |

La règle alternative `J0_THEN_SEED` départage une égalité par le score à J0, puis par la graine si nécessaire. Les dégâts d’arène des candidats sont séparés de ceux du monde ; les hologrammes et CRS conservent leur durabilité normale. La persuasion physique garde sa durée : le ×10 accélère les transferts électoraux abstraits, pas la marche ou la conversation.

## Vérification et architecture

```text
npm test
npm run test:partie
```

`GamePhase` valide les commandes. `ArenaSimulation` possède sa propre horloge et son propre combat ; `GameSimulation` conserve le monde complet jusqu’au retour. Impacts, jauges, élimination et résultats sont autoritaires, indépendants du rendu. Aucun réseau n’est implémenté.

Le résumé DEBUG enregistre les scores à J0, l’éliminé, la durée et les coups de l’arène, les scores du sprint, les zones ayant changé de contrôle, les anciens PNJ reconvertis, les Meetings et le vainqueur.

Voir [VALIDATION_JALON_5.md](VALIDATION_JALON_5.md), [JALON_5_SPEC.md](JALON_5_SPEC.md) et [le guide du quatrième jalon](GUIDE_JALON_4.md). Ce dernier conserve les détails des systèmes validés ; ses mentions de J0 hors périmètre et des anciennes sauvegardes sont historiques. Le banc `test:conquete` isole sa campagne de 900 s avec J-100 pour éviter le nouveau premier tour.
