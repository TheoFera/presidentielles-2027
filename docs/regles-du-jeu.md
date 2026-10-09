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

- Les **Neutres** apparaissent autour des points de vie de chaque sous-zone, jusqu'à un plafond par sous-zone (`world_layout.json`, `max_npcs_by_origin`). Un habitant garde toujours son quartier d'origine.
- S'arrêter près d'un Neutre le **convainc** : il devient Sympathisant du camp. La persuasion ne marche qu'immobile.
- Les Sympathisants peuvent devenir **Militants** (ils convainquent et se battent pour le camp) ou membres du **service d'ordre**.
- Un Militant seul reste près de sa permanence et agit dans sa sous-zone et les voisines. À partir de 3 Militants sans cible, ils partent ensemble en expédition.

## Bâtiments et contrôle des sous-zones

- Chaque sous-zone a **un bâtiment de contrôle** (marqué d'un drapeau). Son propriétaire contrôle la sous-zone : ses partisans y ont **50 % de résistance en plus** et les adversaires y mettent **60 % de temps en plus** pour convaincre (`zone_control`).
- La première **permanence** prise devient le **QG** du candidat. Elle reçoit les **dons** des Sympathisants : le candidat récupère la cagnotte en passant. Elle fournit aussi les **tracts**.
- On achète en restant devant le panneau de prix, si l'on a l'argent et l'implantation demandés. Les prix sont dans `building_catalog.json`.
- **Services neutres** (payants à l'usage, sans propriétaire) : imprimerie, institut de sondage (publie un sondage), place de meeting (le candidat doit être présent).
- **Garages** : après achat, rester devant le garage fournit un vélo ou un scooter, qui accélère beaucoup la marche (`vehicles`). Sauter, frapper, esquiver, lancer l'ultime ou recevoir un coup fait descendre du véhicule.
- Un bâtiment de contrôle reste à son propriétaire même sans partisans ; seuls un raid du service d'ordre ou une fermeture par le cabinet le neutralisent.
- Les dépenses d'une partie sont plafonnées (`money.campaign_spending_limit`, 16,8 millions d'euros par candidat pour toute la partie).

## Argent

- Au départ, des **billets** sont posés près de chaque candidat (`money.starting_pickups`).
- Ensuite, l'argent vient surtout des **dons** reçus à la permanence, plus ou moins généreux selon le quartier (`money.donation`).
- Un candidat mis **K.-O.** laisse tomber **30 %** de l'argent qu'il transporte (`candidate_combat.ko_money_drop_ratio`).

## Combat

Le combat est **le même** en Campagne et en Débat télé (`candidate_combat`, `dash`, `special_charge`).

- **Frapper** enchaîne léger, léger, fort. **Maintenir 1 seconde** prépare un coup chargé : le candidat est immobile et protégé, puis frappe en relâchant.
- **Sauter** évite les coups bas ; frapper en l'air donne un **coup plongeant**.
- **Double appui** sur une direction : **esquive** (3 charges, une recharge toutes les 4 secondes).
- Les coups réussis remplissent la jauge d'**ultime** ; pleine, l'ultime se lance avec R ou le bouton Ultime.
- À zéro de résistance, le candidat est **K.-O.** : il perd un peu de score national, fait tomber de l'argent et réapparaît après quelques secondes. La résistance remonte loin des combats.

## Styles de campagne et ultimes

En prenant son premier QG, chaque candidat choisit **un style**, définitif pour la partie. Le style donne un bonus de **10 %** dans son quartier de prédilection, oriente les événements et définit l'**ultime**.

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

Le catalogue est dans `src/simulation/campaign-styles.js` ; les réglages fins dans `game_balance.json` (`campaign_styles`, `specials`). Au départ, seul le premier style de chaque candidat est débloqué. Les autres se débloquent en jouant (voir [comptes-partagetonjeu.md](comptes-partagetonjeu.md)). Le pseudo **betatest** (sans compte) débloque tout, pour les essais.

## Candidats sans style de campagne

Six autres candidats tiennent chacun une sous-zone dès le début, avec leur QG dans la permanence de cette sous-zone : Glucksmann (Paris A), Roussel (Paris C), Arthaud (Périurbain A), Dupont-Aignan (Périurbain C), Retailleau (Retraités A) et Attal (Retraités C).

- Leur QG est imprenable tant qu'ils sont en campagne. Ils restent dans leur sous-zone, convainquent jusqu'à 10 Sympathisants et se battent avec le même système de combat.
- Battus, ils ne reviennent pas : leur QG redevient neutre et s'achète normalement.
- Leurs voix comptent au premier tour, mais seuls les deux meilleurs des trois candidats principaux se qualifient. Au second tour, ils se retirent et leurs électeurs redeviennent Neutres.
- Réglages : `minor_candidates` dans `game_balance.json` et `world_layout.json`.

## Événements de campagne

Des **rassemblements** apparaissent pendant la campagne, annoncés par un bandeau télé « EN DIRECT » avec une flèche vers le lieu. Les habitants du quartier marchent ensemble d'une sous-zone à l'autre ; passer près d'eux convainc très vite. Contenu : `campaign_events.json` ; fréquence : `campaign_events` dans `game_balance.json`.

## Élection

1. La campagne dure `time.starting_days_before_first_round` jours de `time.real_seconds_per_game_day` secondes chacun (actuellement 365 jours de 2,5 secondes, environ 15 minutes).
2. **Soirée électorale** : le monde est figé, les scores du premier tour s'affichent. Les deux premiers des trois candidats principaux se qualifient.
3. **Second tour** : sprint de `time.second_round_sprint_seconds` secondes (60 s). Le troisième est éliminé : ses partisans redeviennent Neutres et ses bâtiments perdent leur propriétaire. Les instituts publient des sondages ; à la fin, ce sont les **vrais scores** qui comptent. En cas d'égalité, une prolongation est jouée (`second_round`).
4. Un joueur éliminé devient **spectateur** et choisit quel finaliste suivre.

## Débat télé

Mode séparé, accessible depuis l'accueil (`debate_mode` dans `game_balance.json`, code dans `src/presentation/debat/debate-mode.js` et `src/simulation/debate-*.js`).

- 1 contre 1 ou à trois, contre l'ordinateur ou entre amis. Seuls les candidats et styles débloqués sont jouables.
- Toujours **3 manches**. Chaque manche a un **thème** en un mot (Économie, Immigration, Écologie, Sécurité, Santé, Retraites, Éducation, Europe, Énergie, Logement, Agriculture, Démocratie), annoncé pendant le décompte 3-2-1. Entre deux manches, tout est remis à zéro.
- Le dernier debout gagne la manche. En cas d'égalité après 3 manches, une manche bonus « Question du public » départage.
- Les plateaux ont des pupitres en hauteur : ↓ fait redescendre.
