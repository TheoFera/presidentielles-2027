# Règles du jeu

Ce document décrit le jeu tel qu'il est aujourd'hui. Les chiffres viennent des fichiers de `donnees-jeu/` : en cas de doute, ces fichiers font foi (la section concernée est indiquée entre parenthèses).

## La carte

Une seule carte, la **carte plate** : une fresque peinte qui fait le tour de la France et revient à son point de départ (le monde boucle). Elle compte **6 quartiers** (biomes) de **3 sous-zones** (A, B, C), soit 18 sous-zones. Chaque sous-zone correspond à une tuile peinte de `assets/images/carte/`.

| Quartier | Sous-zone A | Sous-zone B | Sous-zone C |
|---|---|---|---|
| Paris | Permanence | Garage à vélo + place de meeting | Permanence + institut de sondage |
| Banlieue | Rédaction | Permanence + place de meeting | Local du camp |
| Périurbain | Permanence | Garage à scooter + place de meeting | Permanence |
| Campagne | Garage à scooter | Permanence + place de meeting | Local du camp |
| Retraités | Permanence | Rédaction + place de meeting + institut de sondage | Permanence |
| Quartiers riches | Rédaction | Permanence + place de meeting | Local du camp + institut de sondage |

Le « local du camp » devient le local du service d'ordre ou le cabinet administratif, selon le candidat qui le possède. Les emplacements sont fixes : ils ne changent pas d'une partie à l'autre.

## Électeurs et persuasion

- Les **Neutres** apparaissent dans chaque sous-zone, jusqu'à un plafond par sous-zone (`world_layout.json`, `max_npcs_by_origin`). Chaque habitant reçoit sa propre place, choisie loin de celles des autres (`prototype_config.json`, `home_margin_units`, `home_candidate_draws`) : il y apparaît, flâne autour (`roam_radius_units`) et y revient. Un habitant garde toujours son quartier d'origine.
- S'arrêter près d'un Neutre le **convainc** : il devient Sympathisant du camp. La persuasion ne marche qu'immobile. Un nouveau PNJ doit avoir terminé son arrivée sur la ligne de marche (1,6 seconde) avant de pouvoir être convaincu, par un candidat ou un Militant.
- Chaque candidat a un **avantage de départ** : Mélenchon convainc plus vite (`melenchon_personal_time_multiplier`), Philippe commence avec plus d'argent et les coups de Le Pen font **50 % de dégâts en plus** aux Sympathisants (`le_pen_sympathisant_damage_multiplier`).
- Les Sympathisants peuvent devenir **Militants** (ils convainquent et se battent pour le camp) ou membres du **service d'ordre**.
- Un Militant seul reste près de sa permanence (sans cible, chacun attend à sa propre place autour, `idle_spread_units`) et agit dans sa sous-zone et les voisines. À partir de 3 Militants sans cible, ils partent ensemble en expédition.

## Bâtiments et contrôle des sous-zones

- Chaque sous-zone a **un bâtiment de contrôle** (marqué d'un drapeau). Son propriétaire contrôle la sous-zone : ses partisans y ont **50 % de résistance en plus** (Philippe : **trois fois plus résistants**, `philippe_supporter_health_multiplier`) et les adversaires y mettent **60 % de temps en plus** pour convaincre (`zone_control`).
- La première **permanence** prise devient le **QG** du candidat. Elle reçoit les **dons** des Sympathisants : le candidat récupère la cagnotte en passant. Elle fournit aussi les **tracts**.
- On achète en restant devant le panneau de prix, si l'on a l'argent et l'implantation demandés. Les prix sont dans `building_catalog.json`.
- **Services neutres** (payants à l'usage, sans propriétaire) : imprimerie, institut de sondage (publie un sondage), place de meeting (le candidat doit être présent).
- **Garages** : après achat, rester devant le garage fournit un vélo ou un scooter, qui accélère beaucoup la marche (`vehicles`). Sauter, frapper, esquiver, lancer l'ultime ou recevoir un coup fait descendre du véhicule.
- La jauge « Monter sur le vélo » ou « Monter sur le scooter » apparaît seulement pendant une montée effective : à portée du garage possédé, immobile et disponible pour interagir. Les indications d’achat suivent aussi la disponibilité réelle du candidat : elles disparaissent pendant le combat, un saut, le choix d’un style, à bord d’un véhicule ou pendant la courte pause entre deux achats. Les raisons d’un achat impossible (argent, soutiens, délai…) restent indiquées quand le candidat est disponible ; un meeting suspendu conserve sa jauge avec son avertissement de pause.
- Un bâtiment reste à son propriétaire même sans partisans : il ne se perd jamais faute de présence. Seuls un raid du service d'ordre (plus de gardes adverses que de partisans sur place pendant `closure_delay_seconds`) ou une fermeture par le cabinet le neutralisent. Une fermeture par le cabinet renvoie aussi chez eux les sympathisants, militants et membres du service d'ordre du camp visé dans un rayon de `close_demobilize_radius_units` (6) autour du bâtiment : ils redeviennent neutres, comme après un coup.
- **Raid du service d'ordre** (local de Mélenchon ou de Le Pen) : on achète « ← RAID » ou « RAID → » (`service_ordre.raid_cost`, 2 k€), sans équipement préalable. Les 3 sympathisants libres les plus proches (`raid_recruits`) marchent jusqu'à la porte du local, y entrent un instant (`pickup_seconds`) et ressortent en service d'ordre. Une fois les trois dehors et chacun à sa place, ils partent du côté choisi. Le raid n'a pas de fin : les gardes vont fermer les bâtiments adverses (hors QG) et ne se battent qu'avec les adversaires tout proches (`engage_range`), sauf un candidat adverse à environ un tiers de sous-zone (`candidate_focus_range`) : ils le prennent alors en chasse en priorité. Ils marchent un peu plus vite qu'un militant (`move_speed`). On ne peut pas les rappeler ; battus, ils deviennent des PNJ battus qui rentrent chez eux. Nouveau raid possible après `raid_cooldown_seconds`.
- Les gardes gardent chacun leur place (`service_ordre.spacing_units`) : ils ne s'empilent jamais au même endroit.
- Les dépenses d'une partie sont plafonnées (`money.campaign_spending_limit`, 16,8 millions d'euros par candidat pour toute la partie).

## Argent

- Au départ, des **billets** sont posés près de chaque candidat (`money.starting_pickups`).
- Ensuite, l'argent vient surtout des **dons** reçus à la permanence, plus ou moins généreux selon le quartier (`money.donation`).
- Un candidat mis **K.-O.** laisse tomber **30 %** de l'argent qu'il transporte (`candidate_combat.ko_money_drop_ratio`).

## Combat

Le combat est **le même** en Campagne et en Débat télé (`candidate_combat`, `dash`, `special_charge`).

- **Frapper** enchaîne léger, léger, fort. **Maintenir 1 seconde** prépare un coup chargé : le candidat est immobile et protégé, puis frappe en relâchant.
- **Sauter** évite les coups bas ; frapper en l'air donne un **coup plongeant**.
- Pendant l’**étourdissement d’un coup léger**, maintenir une direction permet de se retourner sans se déplacer, dès que la brève pause d’impact est terminée. Les coups forts et les chutes au sol gardent leur blocage ; se retourner ne permet pas de frapper ou d’esquiver pendant l’étourdissement.
- **Double appui** sur une direction : **esquive** (3 charges, une recharge toutes les 4 secondes). Le premier appui doit être bref (0,3 s au plus) ; le second doit suivre le relâchement de 0,25 s au plus au clavier, 0,35 s au doigt. Sur téléphone, juste après un appui, la flèche attrape aussi les appuis un peu à côté.
- Les coups réussis remplissent la jauge d'**ultime** ; pleine, un son spécial retentit, le bouton Ultime devient doré et pulse (avec « PRÊT ! » au déblocage) ; l'ultime se lance alors avec R ou ce bouton.
- À zéro de résistance, le candidat est **K.-O.** : il perd un peu de score national, fait tomber de l'argent et réapparaît après quelques secondes. La résistance remonte loin des combats.

## Styles de campagne et ultimes

En prenant son premier QG, chaque candidat choisit **un style**, définitif pour la partie. Dans le quartier de son style, le candidat et ses Militants convainquent **4 fois plus vite** (`style_biome_time_divisor`). Dans le quartier opposé sur la carte, ils mettent **2 fois plus de temps** (`opposite_biome_time_multiplier`) : Bobos ↔ Campagne, Riches ↔ Périurbain, Banlieues ↔ Retraités. Le style donne aussi un bonus de **10 %** aux événements de son quartier, oriente les événements et définit l'**ultime**.

| Candidat | Style | Quartier | Ultime |
|---|---|---|---|
| Mélenchon | Universaliste | Paris | Hologrammes |
| Mélenchon | Créolisé | Banlieue | Déferlante encapuchonnée |
| Mélenchon | Populiste | Périurbain | Gilet jaune (feu) |
| Le Pen | Protectionniste | Périurbain | Vague bleu marine |
| Le Pen | Zemmouriste | Quartiers riches | Invocation Zemmour |
| Le Pen | Libérale · Parti de gouvernement | Retraités | Bardellisation (relève au K.-O.) |
| Philippe | Gestionnaire | Quartiers riches | Protection CRS |
| Philippe | Notable local | Retraités | Écharpe du maire |
| Philippe | Européiste | Paris | Super Européiste |

- **Hologrammes** : quatre copies transparentes apparaissent de part et d'autre de Mélenchon. Ce sont des copies exactes : elles rejouent tout ce que fait Mélenchon (marche, saut, charge, coups) avec un léger retard : 0,1 s pour les deux plus proches, 0,2 s pour les deux plus éloignées (`echo_delay_seconds`), toujours à sa hauteur (elles ne tombent pas au-dessus du vide). On ne peut ni les viser ni les toucher, elles n'ont pas de points de vie, traversent tout et peuvent sortir du plateau si Mélenchon est au bord. Leurs coups font exactement les mêmes dégâts que ceux de Mélenchon.
- **Protection CRS** : deux CRS encadrent Philippe, bloquent les adversaires et les repoussent loin, avec des coups assez lents et peu puissants (`philippe_crs_wall`).
- **Super Européiste** : pendant 5 s, chaque coup reçu au corps à corps est renvoyé à l'attaquant avec les mêmes dégâts, un fort recul et un court étourdissement. Le dash devient illimité, et traverser un adversaire en dash le repousse de la même façon et lui inflige 15 dégâts (`specials.europe`).

Le catalogue est dans `src/simulation/campaign-styles.js` ; les réglages fins dans `game_balance.json` (`campaign_styles`, `specials`). Au départ, seul le premier style de chaque candidat est débloqué. Les autres se débloquent en jouant : mets K.-O. un candidat pendant la campagne, puis gagne l'élection pour le choisir parmi tes candidats vaincus (un 2ᵉ avec une pub, ou un en « seconde chance » après une défaite ; voir [comptes-partagetonjeu.md](comptes-partagetonjeu.md) et [publicites.md](publicites.md)). Le pseudo **betatest** (sans compte) débloque tout, pour les essais.

## Candidats sans style de campagne

Six autres candidats tiennent chacun une sous-zone dès le début, avec leur QG dans la permanence de cette sous-zone : Glucksmann (Paris A), Roussel (Paris C), Arthaud (Périurbain A), Dupont-Aignan (Périurbain C), Retailleau (Retraités A) et Attal (Retraités C).

- Leur QG est imprenable tant qu'ils sont en campagne. Ils restent dans leur sous-zone, convainquent jusqu'à 10 Sympathisants et se battent avec le même système de combat.
- Battus, ils ne reviennent pas : leur QG redevient neutre et s'achète normalement.
- Leurs voix comptent au premier tour, mais seuls les deux meilleurs des trois candidats principaux se qualifient. Au second tour, ils se retirent et leurs électeurs redeviennent Neutres.
- Réglages : `minor_candidates` dans `game_balance.json` et `world_layout.json`.

## Événements de campagne

Des **rassemblements** apparaissent pendant la campagne, annoncés par un bandeau télé « EN DIRECT » avec une flèche vers le lieu. Les habitants du quartier se regroupent pendant `gather_seconds` (6 s), puis marchent ensemble d'une sous-zone à l'autre ; ceux qui n'ont pas eu le temps d'arriver rattrapent le cortège en route. Passer près d'eux convainc très vite. Les gardes du service d'ordre n'y participent pas. Contenu : `campaign_events.json` ; fréquence : `campaign_events` dans `game_balance.json`.

## Élection

1. La campagne dure `time.starting_days_before_first_round` jours de `time.real_seconds_per_game_day` secondes chacun (actuellement 365 jours de 1,4 seconde, environ 8 min 30, puis 1 min de sprint au second tour).
2. **Soirée électorale** : le monde est figé, les scores du premier tour s'affichent. Les deux premiers des trois candidats principaux se qualifient. **Majorité absolue** : un candidat qui obtient plus de 50 % des voix exprimées (voix des candidats, autres candidats compris, sans les neutres) est élu dès le premier tour ; la partie passe directement au résultat final, sans second tour.
3. **Parcours de fin imposé** : premier tour → « Continuer » (seul bouton ; un invité attend l'hôte) → second tour → résultat final → « Voir le bilan » → bilan, où se trouvent enfin « Rejouer » (en solo) et « Retour au menu ». Les boutons d'un écran de résultats restent grisés 3 secondes après l'affichage complet (`TIMELINE.hold` dans `election-results.js`), et ceux du bilan 2,5 secondes à sa première ouverture (`SUMMARY_LOCK_MS` dans `debat/match.js`), pour qu'un appui involontaire ne fasse pas sauter une étape.
4. **Second tour** : sprint de `time.second_round_sprint_seconds` secondes (60 s). Le troisième est éliminé : ses partisans redeviennent Neutres et ses bâtiments perdent leur propriétaire. Les instituts publient des sondages ; à la fin, ce sont les **vrais scores** qui comptent. En cas d'égalité, une prolongation est jouée (`second_round`).
5. Un joueur éliminé devient **spectateur** et choisit quel finaliste suivre.

## Débat télé

Mode séparé, accessible depuis l'accueil (`debate_mode` dans `game_balance.json`, code dans `src/presentation/debat/debate-mode.js` et `src/simulation/debate-*.js`).

- 1 contre 1 ou à trois, contre l'ordinateur ou entre amis. Seuls les candidats et styles débloqués sont jouables.
- Toujours **3 manches**. Chaque manche a un **thème** en un mot (Économie, Immigration, Écologie, Sécurité, Santé, Retraites, Éducation, Europe, Énergie, Logement, Agriculture, Démocratie), annoncé pendant le décompte 3-2-1. Entre deux manches, tout est remis à zéro.
- Le dernier debout gagne la manche. En cas d'égalité après 3 manches, une manche bonus « Question du public » départage.
- Les plateaux ont des pupitres en hauteur : ↓ fait redescendre.
