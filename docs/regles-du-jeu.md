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
- Au combat, un Militant s'approche à 3,5 unités de sa cible pour tirer une pique verbale (portée du tir 4,5 unités, une toutes les 1,15 s, 3 dégâts). La pique blesse sans immobiliser ni interrompre un coup. Si le candidat arrive à moins de 1,6 unité, le Militant recule entre deux tirs, lentement (1,4 u/s), et se fait rattraper (`physical_units.militant`).

## Bâtiments et contrôle des sous-zones

- Chaque sous-zone a **un bâtiment de contrôle** (marqué d'un drapeau). Son propriétaire contrôle la sous-zone : ses partisans y ont **50 % de résistance en plus** (Philippe : **trois fois plus résistants**, `philippe_supporter_health_multiplier`) et les adversaires y mettent **60 % de temps en plus** pour convaincre (`zone_control`).
- La première **permanence** prise devient le **QG** du candidat. Elle reçoit les **dons** des Sympathisants : le candidat récupère la cagnotte en passant. Elle fournit aussi les **tracts** : rester 1 seconde devant en commande un, et les commandes s’enchaînent toutes les 1,2 seconde environ tant qu’on reste devant. L’impression dure 1 seconde, puis un Sympathisant vient le chercher (retrait en une demi-seconde).
- On achète en restant devant le panneau de prix, si l'on a l'argent et l'implantation demandés. Les prix sont dans `building_catalog.json`.
- **Services neutres** (payants à l'usage, sans propriétaire) : imprimerie, institut de sondage (publie un sondage : intentions de vote parmi les électeurs décidés, Neutres et électeurs à apparaître comptés à part comme indécis ; affichage décrit dans `images-et-animations.md`, « L'anneau du sondage »), place de meeting (le candidat doit être présent).
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

Le combat est **le même** en Campagne et en Débat télé (`candidate_combat`, `dash`, `special_charge`). Les candidats y marchent aussi à la même vitesse : 4,4 unités par seconde (`movement.candidate_speed_units_per_second` dans `prototype_config.json`).

- **Frapper** enchaîne léger, léger, fort. **Maintenir 1 seconde** prépare un coup chargé : le candidat est immobile et protégé, puis frappe en relâchant.
- **Sauter** évite les coups bas ; frapper en l'air donne un **coup plongeant**.
- Pendant l’**étourdissement d’un coup léger**, maintenir une direction permet de se retourner sans se déplacer, dès que la brève pause d’impact est terminée. Les coups forts et les chutes au sol gardent leur blocage ; se retourner ne permet pas de frapper ou d’esquiver pendant l’étourdissement.
- **Double appui** sur une direction : **esquive** de 3 unités, la même en Campagne et en Débat télé (`dash.distance`, `debate_mode.dash_distance` ; 3 charges, une recharge toutes les 4 secondes). Le premier appui doit être bref (0,3 s au plus) ; le second doit suivre le relâchement de 0,25 s au plus au clavier, 0,35 s au doigt. Sur téléphone, juste après un appui, la flèche attrape aussi les appuis un peu à côté.
- Les coups réussis remplissent la jauge d'**ultime** ; pleine, un son spécial retentit, le bouton Ultime devient doré et pulse (avec « PRÊT ! » au déblocage) ; l'ultime se lance alors avec R ou ce bouton.
- À zéro de résistance, le candidat est **K.-O.** : il perd un peu de score national, fait tomber de l'argent et réapparaît à sa permanence après quelques secondes (3 à 9 s, plus long en fin de campagne). Pendant l'attente, le décor passe en gris et un grand décompte s'affiche au centre de l'écran. La résistance remonte loin des combats.

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
- **Super Européiste** : pendant 5 s, chaque coup reçu au corps à corps, ainsi que les piques des militants, est renvoyé à l'attaquant avec les mêmes dégâts, un fort recul et un court étourdissement. Le dash devient illimité, et traverser un adversaire en dash le repousse de la même façon et lui inflige 15 dégâts, au plus une fois toutes les 0,8 s pour un même adversaire (`specials.europe`).

### Équilibrage des ultimes

Repère : un candidat a 100 points de vie, un combo normal fait 30 dégâts (8 + 8 + 14). Un ultime se charge en environ deux combos et demi, et doit rapporter l'équivalent de 40 à 60 points de vie.

- **Bardellisation** : au K.-O., Le Pen revient avec **la moitié de sa vie** (`specials.bardella.revive_resistance_ratio`), puis reste intouchable 1 s.
- **Invocation Zemmour** : 30 de solidité (quatre coups légers), une bulle de 6 dégâts par seconde.
- **Déferlante** : 8 dégâts par contact, au plus 4 touches par adversaire pour tout le pouvoir (`max_hits_per_target`).
- **Gilet jaune** : 10 dégâts par seconde dans le feu.
- **Écharpe du maire** : 5 s ; coups à 8, coup final à 12 (`finisher_damage`).
- **Vague bleu marine**, **mur républicain** (30 dégâts) et 3ᵉ coup du marteau d'Arthaud **font tomber** l'adversaire.
- **Débats d'événement** (vie = pourcentage de voix) : les dégâts fixes des ultimes (dash européiste, ultimes des autres candidats) sont ramenés à la même échelle qu'un coup léger.

Le catalogue est dans `src/simulation/campaign-styles.js` ; les réglages fins dans `game_balance.json` (`campaign_styles`, `specials`). Au départ, seul le premier style de chaque candidat est débloqué. Les autres se débloquent en jouant : mets K.-O. un candidat pendant la campagne, puis gagne l'élection pour le choisir parmi tes candidats vaincus (un 2ᵉ avec une pub, ou un en « seconde chance » après une défaite ; voir [comptes-partagetonjeu.md](comptes-partagetonjeu.md) et [publicites.md](publicites.md)). Le pseudo **betatest** (sans compte) débloque tout, pour les essais.

## Candidats sans style de campagne

Six autres candidats tiennent chacun une sous-zone dès le début, avec leur QG dans la permanence de cette sous-zone : Glucksmann (Paris A), Roussel (Paris C), Arthaud (Périurbain A), Dupont-Aignan (Périurbain C), Retailleau (Retraités A) et Attal (Retraités C).

- Leur QG est imprenable tant qu'ils sont en campagne. Ils restent dans leur sous-zone, convainquent jusqu'à 10 Sympathisants et se battent avec le même système de combat.
- Battus, ils ne reviennent pas : leur QG redevient neutre et s'achète normalement.
- Leurs voix comptent au premier tour, mais seuls les deux meilleurs des trois candidats principaux se qualifient. Au second tour, ils se retirent et leurs électeurs redeviennent Neutres.
- Réglages : `minor_candidates` dans `game_balance.json` et `world_layout.json`.

Chacun possède aussi un ultime personnel, en campagne et en mode Débat, sans choisir de style. Les coups donnés et reçus remplissent la même jauge que pour les candidats principaux. R ou le bouton **Ultime** l’active.

| Candidat | Ultime | Fonctionnement |
|---|---|---|
| Roussel | Saucisse boomerang | Arme son lancer pendant 0,36 s, puis repousse légèrement à l’aller. La saucisse ralentit au demi-tour, touche à nouveau au retour, ramène les adversaires vers lui et rejoint sa main même s’il s’est déplacé. Il la rattrape puis la ramène contre lui, sans nouveau dégât pendant la récupération. |
| Dupont-Aignan | Sous les radars | Invisible aux adversaires et à leur IA pendant 5 s, et sa vie remonte tout de suite, même près d’un adversaire. Son joueur et ses alliés gardent une silhouette discrète. Une attaque annule l’invisibilité ; disparition et réapparition prennent 0,3 s. Les coups non ciblés peuvent toujours le toucher. |
| Glucksmann | Livraison express de démocratie | Un appel de 0,5 s, téléphone à la même oreille, fait passer un Rafale stylisé sur une courbe continue : descente douce, tir puis remontée. Ses trois missiles « Démocratie » sont largués avant que le nez de l’avion dépasse la verticale de Glucksmann. Ils quittent l’arrière de l’aile en prolongeant sa direction, accélèrent devant lui puis virent vers leurs zones. Premier impact environ 0,93 s après l’activation, dernier impact à 1,07 s. Environ 0,17 s de vol par missile, avec des tirs espacés d’environ 0,07 s pour voir les trois ensemble. Aucun texte ne flotte au-dessus de l’avion. Les trois zones annoncées devant lui gardent leur emplacement et leur rayon ; les impacts éclatent en confettis et bousculent les adversaires. |
| Arthaud | Les outils de la lutte | Pendant 6 s, la faucille du premier coup rapproche ; le marteau du deuxième coup (14 dégâts) aplatit brièvement les sprites touchés, celui du troisième fait tomber, ce qui empêche d'enchaîner les combos sans fin. Portée accrue et plusieurs cibles possibles. |
| Retailleau | Le mur républicain | Un mur apparaît entre lui et le candidat adverse le plus proche, puis une unité ennemie à défaut. Il bloque les deux camps ; seuls les pieds d’un saut assez haut peuvent passer. Après 3,5 s, il bascule vers l’adversaire, inflige des dégâts et repousse. |
| Attal | Changement de programme | Lance un cartable vers le candidat adverse le plus proche à portée, puis une unité à défaut. Il ne fait aucun dégât à l’atterrissage (25 dégâts à l’explosion). Un second appui sur **Ultime / Faire éclater** déclenche l’explosion caricaturale, même en vol. L’IA sait aussi le déclencher. |

Les valeurs sont dans `minor_ultimates` de `game_balance.json` ; le catalogue et la simulation dans `minor-ultimate-catalog.js` et `minor-ultimates.js`. La mort, le retrait d’un candidat et le changement de round nettoient ses pouvoirs. La vague de Le Pen vérifie le passage de son corps derrière le front (`body_length_units`), conserve les cibles momentanément protégées pour les retester et ne touche chaque adversaire qu’une fois.

## Événements de campagne

Des **rassemblements** apparaissent pendant la campagne. Un grand flash télé « EN DIRECT » affiche pendant 6 secondes l’un des trois titres du biome, sans couper la phrase. Il se réduit ensuite sous la carte à une étiquette « EN DIRECT » et au nom court : Manifestation (Paris 19ᵉ), Marche (banlieues), Mouvement (périurbain), Blocages (campagne), Cortège (retraités) ou Rassemblement (quartiers riches). Le rappel reste visible jusqu’à la fin du cortège, sans lieu, consigne ni compte à rebours. Les habitants du quartier se regroupent pendant `gather_seconds` (6 s), puis marchent ensemble d'une sous-zone à l'autre ; ceux qui n'ont pas eu le temps d'arriver rattrapent le cortège en route. Passer près d'eux convainc très vite. Les gardes du service d'ordre n'y participent pas. Contenu et titres : `campaign_events.json` ; fréquence et durée du flash : `campaign_events` dans `game_balance.json`.

## Élection

1. La campagne dure `time.starting_days_before_first_round` jours de `time.real_seconds_per_game_day` secondes chacun (actuellement 365 jours de 1,4 seconde, environ 8 min 30, puis 1 min de sprint au second tour).
2. **Soirée électorale** : le monde est figé et s'assombrit sous « Place au vote… » (`vote_seconds`, 2,2 s), puis les scores du premier tour s'affichent. La carte n'est plus redessinée derrière l'écran des résultats. Les deux premiers des trois candidats principaux se qualifient. **Majorité absolue** : un candidat qui obtient plus de 50 % des voix exprimées (voix des candidats, autres candidats compris, sans les neutres) est élu dès le premier tour ; la partie passe directement au résultat final, sans second tour.
   L'écran des résultats est un face-à-face façon « 20 h » : les deux premiers occupent chacun une moitié de l'écran à leurs couleurs (portrait côté extérieur, score et nom contre la ligne centrale, alignés des deux côtés). Les scores ont une décimale, deux si les finalistes seraient sinon affichés à égalité. Le titre unique (« Victoire ! », « Défaite », « Qualifié ! », « Éliminé ») est posé sur la ligne centrale, et seul l'élu final porte l'étiquette « Élu ». Le bandeau défilant « Résultats » donne tous les autres candidats à la suite (ou le rappel du premier tour au second tour), puis « Abstention et votes blancs », c'est-à-dire les électeurs neutres.
3. **Parcours de fin imposé** : premier tour → « Continuer » (seul bouton ; un invité attend l'hôte) → second tour → résultat final → « Voir le bilan » → bilan, où se trouvent enfin « Rejouer » (en solo) et « Retour au menu ». Les boutons d'un écran de résultats restent grisés 3 secondes après l'affichage complet (`TIMELINE.hold` dans `election-results.js`), et ceux du bilan 2,5 secondes à sa première ouverture (`SUMMARY_LOCK_MS` dans `debat/match.js`), pour qu'un appui involontaire ne fasse pas sauter une étape.
4. **Second tour** : sprint de `time.second_round_sprint_seconds` secondes (60 s). Le troisième est éliminé : ses partisans redeviennent Neutres et ses bâtiments perdent leur propriétaire. Les instituts publient des sondages ; à la fin, ce sont les **vrais scores** qui comptent. En cas d'égalité, une prolongation est jouée (`second_round`).
5. Un joueur éliminé devient **spectateur** et choisit quel finaliste suivre.
6. **Transitions** (`presentation.transitions` dans `prototype_config.json`, logique dans `interface/transitions.js`) : à l'arrivée, le menu s'efface sur la carte et l'interface glisse à sa place ; en solo, la partie attend la fin du fondu. Entrer dans un débat ou en sortir passe par un rideau sombre (fermeture `cover_seconds`, ouverture `reveal_seconds`). À la fin d'un débat, l'image reste figée `debate_hold_seconds` sur le coup décisif. En solo, la partie est en pause tant que le rideau se ferme ; en multijoueur, elle continue, sans image figée. Avec « réduire les animations », tout change sans transition.

## Débat télé

Mode séparé, accessible depuis l'accueil (`debate_mode` dans `game_balance.json`, code dans `src/presentation/debat/debate-mode.js` et `src/simulation/debate-*.js`).

- 1 contre 1 ou à trois, contre l'ordinateur ou entre amis. Seuls les candidats et styles débloqués sont jouables.
- Toujours **3 manches**. Chaque manche a un **thème** en un mot (Économie, Immigration, Écologie, Sécurité, Santé, Retraites, Éducation, Europe, Énergie, Logement, Agriculture, Démocratie), annoncé pendant le décompte 3-2-1. Entre deux manches, tout est remis à zéro.
- Le dernier debout gagne la manche. En cas d'égalité après 3 manches, une manche bonus « Question du public » départage.
- Les plateaux ont des pupitres en hauteur : ↓ fait redescendre. On tient sur un pupitre tant qu’un pied le touche (0,3 au-delà du bord dessiné, `PLATFORM_FOOTING`), à l’atterrissage comme debout.
