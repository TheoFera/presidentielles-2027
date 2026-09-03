# Présidentielles 2027 — quatrième jalon jouable

La conquête électorale relie désormais les personnages, les bâtiments, les 18 territoires et les scores nationaux. Le jeu reste une greybox : les proportions, les déplacements, la persuasion, l’économie et les combats des jalons précédents sont conservés.

## Lancer et jouer

Double-clique sur **Lancer le jeu.cmd**, puis ouvre **http://localhost:2027/**. Garde le terminal du serveur ouvert. Si le jeu est déjà ouvert, recharge sa page.

- Flèches, Q/D ou A/D : marcher.
- Espace ou J : léger → léger → fort. Le pouvoir spécial se déclenche avec l’attaque suivante lorsqu’il est chargé.
- Rester près d’un Neutre : convaincre automatiquement.
- Rester devant un billet : payer après 2 secondes de présence continue. Sortir avant la fin annule la progression.
- Après un achat de bâtiment : s’éloigner puis revenir pour une nouvelle dépense. L’Imprimerie et l’équipement SO peuvent répéter leurs commandes.
- H, Échap ou P : aide et pause. F : plein écran. F3 : débogage.

Les Militants marchent toujours à **2,4 unités/s**, contre **3,6** pour le candidat ; le plafond de sécurité reste à deux fois la vitesse du candidat.

## Ce que signifie conquérir

Les personnages visibles ne représentent pas un nombre d’électeurs. Un Sympathisant ou un Militant **produit de l’influence**, qui modifie progressivement un électorat abstrait.

Chaque sous-zone conserve quatre soutiens : Mélenchon, Le Pen, Philippe et Neutres. Leur somme reste à **100 %**. Une zone est contrôlée si le premier candidat possède **au moins 35 %** et **au moins 4 points d’avance** sur le deuxième candidat. Sinon, elle est contestée. Les Neutres ne participent pas au classement des candidats.

Un petit drapeau indique le contrôle réel : rouge, bleu marine, blanc/gris pour Philippe ; un drapeau gris barré signale une zone contestée. Les couleurs des personnages déjà validées sont conservées.

Le score national est la moyenne des soutiens locaux, pondérée par le poids de chaque zone. Les 18 poids valent actuellement 1. Le champ `electoral_weights.by_subzone` de `world_layout.json` permet de changer individuellement ces poids.

## Débits d’influence

Ces valeurs sont des **points d’influence par seconde avant résistance**, pas des électeurs physiques ni des points de score garantis.

| Source | Valeur actuelle |
|---|---:|
| Un Sympathisant local | 0,008/s |
| Un Militant présent | 0,035/s |
| Permanence niveau 1 / 2 / 3 | 0,012 / 0,020 / 0,032/s |
| Candidat actif, hors interruption de combat | 0,002/s dans sa sous-zone |
| SO, Cabinet, Institut, hologrammes et CRS | aucune influence directe |
| Gain de Le Pen | ensemble des sources ×1,25 |

La part convertie depuis les Neutres est multipliée par `(Neutres / 100)^1,8`. Les derniers Neutres deviennent donc plus difficiles à convaincre. Sous **12 % de Neutres**, une conversion directe depuis les soutiens adverses s’ajoute, avec un facteur **0,3 × (1 − résistance)** ; elle se répartit proportionnellement aux soutiens adverses disponibles. Les transferts sont simultanés et plafonnés aux voix réellement disponibles.

Le Pen commence à **31 % dans campagne_b** : 18 % de base, 5 points de bonus de départ et 8 points supplémentaires. Mélenchon et Philippe commencent à 23 % dans leur sous-zone de départ. Aucun PNJ allié n’est offert.

## Les trois nouveaux lieux

| Lieu | Implantation locale | Construction | Améliorations |
|---|---:|---:|---:|
| Tour de communication | 6 Sympathisants | 75 k € | 110 puis 160 k € |
| Institut de sondage | 6 Sympathisants | 90 k € | un niveau |
| Meeting | 5 Sympathisants | 65 k € | 95 puis 140 k € |

Les Sympathisants ne sont pas consommés. Leurs emplacements s’ajoutent aux bâtiments existants, sans déplacer les anciens.

### Tour

Une seule Tour **active par camp dans tout le monde**. `global_limit` permet d’autoriser plusieurs Tours. Une Tour fermée ne compte plus dans cette limite ; sa reconstruction recontrôle la limite.

| Niveau | Influence de base dans chaque zone |
|---|---:|
| 1 | 0,002/s |
| 2 | 0,0035/s |
| 3 | 0,0055/s |

Multiplicateurs : **×2** dans une zone contrôlée par le camp, **×1,5** dans une zone immédiatement voisine d’un de ses territoires, **×1** ailleurs. Le voisinage traverse la jonction du monde. Ces catégories ne se cumulent pas. Même au niveau 3, dans une zone contrôlée, la Tour produit moins du tiers de l’influence locale d’un Militant, à camp égal.

### Institut et cercle

Avant le premier Institut actif du camp suivi, l’interface permanente montre seulement l’argent et **J-XX**. Aucun score ni cercle n’est affiché.

À la construction, une première mesure apparaît, puis une autre toutes les **8 secondes de simulation**. Le cercle représente les 18 sous-zones dans leur ordre géographique, dans le sens des aiguilles d’une montre, depuis Paris à midi. Ses couleurs et les scores conservent la dernière mesure entre deux sondages. Le jour continue d’avancer normalement.

Les pourcentages sont arrondis au dixième, avec un total affiché de 100 %. Le debug conserve toute la précision. Chaque camp possède son propre dernier sondage : changer de candidat en debug ne donne pas accès aux données débloquées par un autre camp.

Si tous les Instituts d’un camp sont fermés, **le dernier sondage et le cercle restent visibles, grisés, sans se rafraîchir**. Une reconstruction produit une mesure immédiate et relance le rythme de 8 secondes.

### Meeting

Après la construction, éloigne-toi du lieu, puis reviens **au micro, au centre du podium** pour payer l’événement. Le petit repère **↑ à droite** permet de payer une amélioration. Il n’y a aucun bouton d’action.

| Niveau | Événement | Impulsion d’influence | Bonus local S/M | Durée | Délai entre événements |
|---|---:|---:|---:|---:|---:|
| 1 | 30 k € | 12 | ×1,30 | 14 s | 55 s |
| 2 | 35 k € | 18 | ×1,45 | 17 s | 48 s |
| 3 | 40 k € | 26 | ×1,60 | 20 s | 40 s |

L’impulsion suit la même conversion électorale que les débits continus. Par exemple, à 30 % de Neutres, le niveau 1 apporte environ **1,37 point local** depuis les Neutres, ou **1,72 pour Le Pen**. À faible réserve neutre, les transferts adverses s’appliquent également. Ces impulsions ont été renforcées pour rendre l’événement nettement sensible.

Le candidat doit être personnellement présent pendant le paiement. Ensuite, il peut repartir : le bonus continue pendant la durée payée. Seuls les Sympathisants et Militants **alliés actuellement dans la sous-zone** en bénéficient. La Permanence, la Tour et le candidat n’héritent pas de ce multiplicateur. Une amélioration ne modifie pas rétroactivement un événement en cours. Les étoiles, l’impulsion du podium et les bras levés signalent le Meeting.

## Coups et fermetures

Les coups reçus par un candidat font revenir une petite quantité de ses voix aux Neutres, uniquement dans ses zones contrôlées, proportionnellement à son soutien. Ils peuvent lui faire perdre le contrôle. Le drapeau réel change immédiatement ; le cercle attend le prochain sondage. Le debug montre les valeurs avant et après le coup.

Le Cabinet de Philippe peut fermer les nouveaux bâtiments. Une fermeture coupe les effets, supprime les niveaux et impose une reconstruction payante par le propriétaire. Un Meeting en cours est interrompu ; son délai reste conservé pour éviter de le réinitialiser par reconstruction. Une Tour fermée cesse d’influencer toute la carte. L’Institut garde uniquement sa dernière mesure. Les Imprimeries restent neutres et ne peuvent pas être fermées.

## Débogage et essais rapides

Ouvre F3. Les outils sont aussi accessibles par les boutons des rubriques repliables. Les commandes en attente pendant une pause sont appliquées à la reprise avec F4.

| Raccourcis, avec F3 ouvert | Action |
|---|---|
| 1 / 2 / 3 | Suivre Mélenchon / Le Pen / Philippe |
| F4 ; F6 | Pause ; vitesse ×1 → ×4 → ×5 → ×10 |
| I ; G | Suspendre les IA ; ajouter 200 k € de test |
| 4 / 5 / 6 | Ajouter 20 points d’influence brute locale M / LP / EP |
| 7 ; Y | Remettre les Neutres à 50 % ; forcer le contrôle du camp suivi |
| 8 / 9 / 0 | Construire gratuitement ici Tour / Institut / podium |
| V | Déclencher gratuitement le Meeting allié local, sans attendre son délai |
| O / U / M | Aller à la Tour / à l’Institut / au Meeting le plus proche |
| B / T / N / L | Aller à la Permanence / Imprimerie / Financement / bâtiment factionnel |
| C ; [ / ] | Rejoindre un Neutre ; sous-zone précédente / suivante |
| F7 / F8 / F9 | Créer un S / M / SO du camp sélectionné |
| K ; X | Charger le pouvoir ; démobiliser le PNJ inspecté |

Les touches de la rangée des chiffres fonctionnent aussi sans Majuscule sur AZERTY. Les constructions gratuites ignorent l’argent et l’implantation, mais respectent la propriété adverse et la limite de Tours.

Dans **Déplacements, fonds de test et sauvegardes → Importer un état JSON**, les fichiers `artifacts/jalon4-*.json` permettent d’essayer immédiatement :

- `jalon4-avant-institut.json` : paiement à mi-parcours, aucun score débloqué.
- `jalon4-tour-niveau-3.json` : Tour entièrement améliorée.
- `jalon4-sondage-melenchon.json`, `...-le_pen.json`, `...-philippe.json` : sondage ouvert, zone locale proche du basculement, Meeting construit.
- `jalon4-meeting-melenchon.json`, `...-le_pen.json`, `...-philippe.json` : événement payé, bonus actif et zone conquise ; le cercle peut encore afficher la mesure précédente.
- `jalon4-institut-ferme.json` : dernière mesure conservée après une vraie fermeture payée par Philippe.
- `jalon4-simulation-2027.json`, `...-73.json`, `...-31415.json` : parties de validation avec les trois camps pilotés par les mêmes contrôleurs IA.

Les scénarios courts sont **préparés avec des fonds et des unités de test**, puis utilisent de vrais paiements. Ils ne décrivent pas le début normal d’une partie. Recommencer avec la graine rétablit les conditions normales.

## Architecture et vérification

`Controller → GameCommand → GameSimulation → ElectoralState / PollSnapshot → Presentation`.

La simulation tourne à **30 ticks fixes/s**, sans dépendance au navigateur ni à la caméra. Les intentions de mouvement et de présence constituent l’équivalent des commandes de construction/amélioration/Meeting : la simulation revalide le prix, la position, l’implantation, la propriété et les limites au moment du débit. Les IA passent par ces mêmes intentions.

L’IA développe d’abord une base locale : Financement, Tour, Institut, Meeting. Elle préserve les ouvriers nécessaires et n’active les achats que pour une dépense choisie. Elle sait ensuite utiliser les Meetings et améliorer sa Tour. Les combats et fermetures peuvent interrompre ce développement. Il s’agit toujours d’une IA simple de test.

- `territory.js` : implantation et débits détaillés.
- `electoral-state.js` : conversion, contrôle, agrégation et sondages par camp.
- `electoral-buildings.js` : interaction du Meeting et impulsion.
- `electoral-snapshots.js` : validation des données électorales importées.
- `presentation/electoral.js` : cercle, arrondis, drapeaux et lieux greybox ; aucune mutation de simulation.

L’état `actualGameState` contient les scores nationaux réels. Chaque `polls[camp].lastPollSnapshot` conserve une mesure distincte. Support, voisinages, poids, sources, contrôles, niveaux, horloges et mesures sont sérialisés. Les sauvegardes utilisent le **format 4** et l’empreinte des réglages : les anciens fichiers incompatibles sont refusés sans modifier la partie.

```powershell
npm test
npm run test:parcours
npm run test:conflits
npm run test:conquete
```

Les réglages sont dans `Présidentielles 2027/game_balance.json`, `world_layout.json`, `building_catalog.json` et `prototype_config.json`. Le prompt courant est conservé dans `JALON_4_SPEC.md`. Les guides précédents restent dans `GUIDE_JALON_2.md` et `GUIDE_JALON_3.md`.

La campagne reste à **J-1** après le compte à rebours. J0, plateau médiatique, élimination, second tour, résultat final, réseau et graphismes finaux restent réservés au prochain jalon.
