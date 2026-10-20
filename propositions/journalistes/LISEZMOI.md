# Propositions de journalistes

Les duos sont désormais intégrés au jeu ; les règles à jour sont dans `docs/regles-du-jeu.md`, section « Les équipes de reportage ». Ce dossier conserve les propositions et leur maquette historique. `apercu-combat.html` permet de parcourir les quatre étapes de cette première maquette ; elle n’utilise pas le moteur du jeu et ne reflète pas les derniers réglages de vitesse, de dégâts ou d’apparition. Le classement et les barres de vie de cette maquette restent illustratifs.

## Planches à retenir

- `variante-1-kaki-rouge-marges-v2.png` : douze silhouettes, bords libres.
- `variante-2-marine-ocre.png` : douze silhouettes, bords libres dès l’origine.
- `variante-3-bleu-vert-marges-v2.png` : douze silhouettes, bords libres.

Les versions initiales des variantes 1 et 3 sont conservées comme originaux : leurs pixels touchent certains bords. Utiliser les versions avec marges. Vérification reproductible : `verifier-planches.py` avec Python et Pillow. Le rapport `verification-bords.json` contient les dimensions, les marges et les rectangles de chaque silhouette. Ces rectangles sont mesurés sur les dessins ; ne pas découper aveuglément les images en douze cases identiques, car les poses ne sont pas parfaitement centrées. La vérification garantit des marges dans les planches retenues ; la continuité d’une animation complète reste à préparer.

## Comportements proposés

Le duo arrive par le bas, près du candidat qui a une avance importante. Il poursuit une cible commune en formation compacte, comme un groupe de militants. La journaliste reste devant, au contact de la cible ; le cameraman reste derrière elle. La place arrière devra être recalculée si la cible change de direction.

La journaliste possède davantage de PV et inflige des dégâts avec le micro tendu. Le cameraman possède peu de PV, dans l’esprit de la fragilité demandée pour Zemmour. Son tournage ralentit le déplacement du candidat seulement tant que celui-ci reste dans son champ et à portée. Dès que l’un des deux journalistes est vaincu, le duo entier cesse le combat : plus de frappe, de filmage ni de ralentissement. Les deux repartent ensemble par le bas de l’écran, comme à leur arrivée, et disparaissent uniquement en franchissant cette limite ; aucun corps ne reste sur place. Cette règle vaut aussi bien pour la défaite du cameraman que pour celle de la journaliste. Le cône jaune est un repère de la maquette ; son affichage dans le vrai jeu reste à décider.

## Génération et vérification

Création et retouches : ImageGen intégré. Les originaux restent conservés. `consignes-generation.json` contient les consignes initiales et `consignes-retouche.json` la correction des marges. Les poses sélectionnées sont détourées par leur transparence uniquement pour l’affichage de la maquette ; les planches ne sont pas modifiées par le script d’aperçu.

`preparer-apercu.py` reconstruit l’aperçu autonome. `verifier-apercu.mjs` vérifie ses quatre étapes, l’absence d’erreurs JavaScript et l’absence de débordement horizontal à 360 pixels.
