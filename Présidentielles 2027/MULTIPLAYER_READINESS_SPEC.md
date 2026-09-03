# MULTIPLAYER_READINESS_SPEC — V0.3

## 0. Objectif

La V0 reste **solo : 1 joueur humain + 2 IA**.
Aucun réseau, matchmaking ou serveur n'est requis maintenant.

En revanche, le code doit être conçu pour qu'une version ultérieure puisse proposer :

- 3 humains ;
- 2 humains + 1 IA ;
- 1 humain + 2 IA ;
- éventuellement reconnexion et remplacement temporaire par IA.

Le gameplay et les règles doivent rester identiques entre solo et multijoueur.

# 1. Principe d'autorité future

Architecture cible à terme : **serveur autoritaire**.

Les clients enverront des intentions/commandes, par exemple :
- MoveLeft / MoveRight / Stop ;
- Attack ;
- EnterInteractionZone / LeaveInteractionZone ;
- StartRaidDirection ;
- choix de cible administrative si nécessaire.

Le serveur décidera de l'état officiel :
- positions ;
- hits ;
- progression d'achat par présence ;
- dépenses ;
- conversions ;
- influence ;
- états des bâtiments ;
- démobilisations ;
- transitions J0 / second tour.

# 2. Séparer simulation, contrôleurs et rendu

Structure conceptuelle obligatoire :

`Controller → GameCommand → GameSimulation → GameEvents/GameState → Presentation`

Les contrôleurs possibles doivent partager la même interface :
- `LocalHumanController` ;
- `AIController` ;
- futur `NetworkController`.

Le code gameplay ne doit pas savoir si une commande vient d'un humain local, de l'IA ou du réseau.

# 3. Pas de mutation directe depuis l'UI/input

Interdit :
`bouton attaque → cible.damage -= 10`

Attendu :
`input → AttackCommand → simulation valide → HitEvent → état mis à jour`.

Même principe pour l'achat automatique :
- la présence dans une zone fait progresser un timer dans la simulation ;
- lorsque le seuil est atteint, la simulation vérifie l'argent et exécute l'achat ;
- l'affichage du billet ne décide jamais de la transaction.

# 4. Tick de simulation

- gameplay indépendant du FPS ;
- utiliser un fixed timestep / simulation tick ;
- toutes les durées gameplay exprimées en secondes/ticks de simulation ;
- ne pas utiliser le framerate graphique comme source de vérité.

# 5. Identifiants uniques

Chaque entité persistante doit avoir un ID unique stable :
- candidat ;
- PNJ ;
- bâtiment ;
- slot ;
- social point ;
- sous-zone.

Les commandes réseau futures référenceront ces IDs.

# 6. État sérialisable

Le monde complet doit pouvoir être exporté/importé dans un snapshot sérialisable :
- positions ;
- rôles ;
- factions ;
- origines PNJ ;
- argent ;
- bâtiments/niveaux ;
- timers ;
- influence ;
- scores ;
- phase de partie ;
- RNG seed ;
- charge spéciale.

Prévoir un test snapshot → reload → état fonctionnel équivalent.

# 7. Aléatoire contrôlé

Tous les éléments aléatoires gameplay doivent utiliser une seed contrôlable.
Éviter les RNG dispersés directement dans les composants visuels.

# 8. Simulation hors caméra

La caméra ne doit jamais déterminer si une unité existe ou agit.
Les PNJ, bâtiments, influence et IA continuent de fonctionner hors écran.
Cette règle est essentielle pour le solo comme pour le futur multijoueur.

# 9. Ownership et conflits

Les transactions doivent être atomiques dans la simulation.
Deux futurs joueurs ne doivent pas pouvoir acheter simultanément le même bâtiment possédable.

Pour une Imprimerie neutre : plusieurs camps peuvent la fréquenter, mais chaque commande d'impression
est validée séparément par la simulation.

# 10. Reconnexion future

Ne pas implémenter maintenant, mais permettre plus tard :
- snapshot complet envoyé à un client qui rejoint/revient ;
- reprise du candidat par IA pendant déconnexion ;
- restitution au joueur après reconnexion.

# 11. Critère V0

La V0 n'a PAS besoin d'un socket réseau.
Elle doit seulement prouver que :
- les trois candidats peuvent être pilotés par des Controller interchangeables ;
- la simulation est indépendante du rendu ;
- l'état est sérialisable ;
- les commandes sont explicites ;
- un fixed timestep existe ;
- la caméra n'influence pas la logique.
