# Contrat du cinquième jalon — partie complète

Complément aux spécifications de `Présidentielles 2027/`. La demande du jalon courant prime sur les anciennes mentions de J0 hors périmètre et du J-XX transitoire. Les réglages de caméra, densité, déplacement, économie et combat du monde restent ceux validés.

## Autorité et horloges

`CAMPAIGN → FIRST_ROUND_ARENA → SECOND_ROUND_SPRINT → RESULTS`

`tick` est l’horloge du monde : elle s’arrête dans l’arène et au résultat. `match_tick` compte aussi l’arène. `arena.tick` sert uniquement au plateau. `phase_started_match_tick` alimente les annonces visuelles sans décider du gameplay. J0 survient après exactement `starting_days × real_seconds_per_game_day`.

Les contrôleurs locaux et IA passent par les mêmes commandes. `commandAllowed` interdit les interactions du monde dans l’arène, les actions du camp éliminé et toute mutation au résultat. Une commande de transition clôt le lot courant ; les nouvelles intentions arrivent au pas suivant. Les outils de debug nécessitent `debug.commands_enabled`.

## Gel et reprise

`campaign_snapshot` conserve une copie JSON complète : topologie, compteurs, RNG, candidats, PNJ, origines, tâches, bâtiments, queues, soutiens, sondages, monnaie, délais, attaques et pouvoirs en cours. La scène graphique n’intervient pas.

Le plateau possède des candidats copiés, positions, combats, unités temporaires et événements séparés. Les IDs de ses objets temporaires sont locaux à `ArenaSimulation` ; les candidats gardent leur identité. Les horloges et impacts s’interprètent dans leur phase.

Au premier KO, le monde sauvegardé est restitué, puis neutralisé une seule fois. Les dégâts, positions, charges dépensées et délais du plateau ne fuient pas dans le monde. La copie de gel est ensuite libérée ; elle n’est pas récursive.

## Arène

Trois positions permutées par la RNG seedée, sol plat, bords solides, aucune sortie de ring. Les jauges viennent des scores pondérés réels, sans redistribuer les Neutres. Chaîne : `Input → Attack → ArenaSimulation → HitResult.score_damage → HitResolved → présentation`.

Les trois coups et les trois pouvoirs ont des dégâts de jauge configurables. Les timings, le recul et la charge sont ceux du combat existant. Au premier zéro, les impacts suivants du pas sont ignorés. Un candidat déjà à zéro à J0 est éliminé au premier pas, sans blocage. L’IA considère distance, santé, menace et variation périodique seedée, sans consulter l’identité du joueur humain pour choisir sa cible.

## Camp éliminé

Le candidat conserve un enregistrement inactif pour son identité : aucun contrôleur, mouvement, revenu, persuasion, achat ou combat. Ses S/M/SO passent en `DEMOBILISE`, perdent faction, tâches, raids et attaques, gardent positions et origines, puis marchent jusqu’au point d’origine avant de redevenir `NEUTRE`.

Ses bâtiments redeviennent `EMPTY`, propriétaire nul, niveau zéro, sans effet ni Meeting. La reconstruction impose prix et implantation. Les Imprimeries restent actives et neutres ; seules les commandes du camp éliminé sont annulées. Ses attaques, projectiles, pouvoirs et temporaires disparaissent. Ses soutiens locaux deviennent Neutres ; les voix des finalistes restent inchangées, somme 100 %.

## Sprint et résultat

60 s par défaut. Les sources d’influence et bonus sont additionnés puis multipliés une fois par ×10. Le facteur de Tour atténue sa source avant ce calcul. Le burst du Meeting reçoit également le ×10 une fois ; présence, coût et cooldown restent requis. La persuasion physique conserve sa durée : aucune reconversion automatique.

Les Instituts actifs mesurent le réel toutes les 2,5 s ; fermés, ils gardent leur ancienne mesure. Le résultat compare les scores autoritaires des deux finalistes, jamais un sondage. Une différence au plus égale à `1e-10` point est traitée comme une égalité à la précision des calculs flottants : prolongations successives de 15 s par défaut, ou règle J0 puis graine. Le résultat fige la simulation.

## Spectateur, nouvelle partie et sauvegardes

Après l’élimination du joueur, le choix du finaliste suivi concerne uniquement la caméra. Les deux finalistes restent sous leur contrôleur IA.

Rejouer crée un nouveau `GameSimulation`, même candidat, et réinitialise input, commandes en attente, horloge de présentation, caméra, vitesse, annonces et résultats. Retour à l’accueil prépare ce même état neuf, en pause sur l’aide.

Snapshot version 5, import atomique : cohérence des phases, jauges, résultat, camp disparu, horloges et monde figé. Le format ancien ou des réglages différents sont refusés sans altérer la partie ouverte.

## Télémétrie

`state.telemetry` contient : `j0_scores`, `eliminated_faction`, `arena_duration_seconds`, `arena_hits` (tous impacts), `arena_candidate_hits`, `sprint_start_scores`, `final_scores`, `changed_subzone_ids`, `reconverted_npc_ids`, `sprint_meetings`, `winner`.

Les listes de zones et PNJ comptent les identités distinctes ; la neutralisation initiale n’est pas un retournement du sprint. Le navigateur journalise le JSON au résultat et le debug permet son export. Les campagnes de contrôle alimentent `artifacts/validation-jalon5.json`.
