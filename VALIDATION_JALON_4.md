# Validation du quatrième jalon

Vérification du 3 septembre 2026. Le périmètre implémenté est conservé dans `JALON_4_SPEC.md`. Le guide courant est `README.md` ; les systèmes précédents sont documentés dans les guides archivés.

## Résultats automatisés

**86 tests passent, zéro échec**, avec `npm test`. Sortie complète : `artifacts/tests-jalon4.txt`.

Les tests couvrent notamment :

- Les régressions des jalons 1 à 3 : caméra, proportions, monde bouclé, populations initiales, origines, persuasion, collecte, économie, combo, démobilisation, SO, raids, Cabinet et pouvoirs.
- Les poids électoraux configurables, la moyenne nationale pondérée, le voisinage à la jonction du monde et les bonus initiaux sans PNJ alliés offerts.
- Les seuils exacts de contrôle, les égalités, les changements dans les trois sens, les conversions simultanées et le maintien de 100 % sous des impulsions extrêmes.
- La distinction entre influence brute et gain effectif ; les sources S, M, Permanence, candidat, Tour et Meeting ; l’absence d’influence directe des SO et du Cabinet.
- La Tour : seuil, prix, annulation d’une présence trop courte, trois niveaux, limitation globale, reconstruction soumise à cette limite et multiplicateurs contrôlé/adjacent/distant.
- L’Institut : aucun sondage avant construction, première mesure immédiate, intervalles de 240 ticks, mesures indépendantes par camp, gel après fermeture et reprise à la reconstruction.
- Les Meetings : paiement au podium, absence d’activation à distance, impulsion locale permettant un basculement, trois niveaux, bonus limité aux S/M locaux, durée, coût, délai et interruption par fermeture.
- Les coups : voix des zones contrôlées rendues aux Neutres, contrôle perdu immédiatement, relevé avant/après et changement du cercle au prochain sondage.
- Les snapshots : reprise identique à plusieurs FPS, conservation d’une mesure ancienne et des horloges, refus atomique de données corrompues.
- Les IA : achats choisis sans commande parasite pendant la persuasion ; les trois nouveaux bâtiments, des Meetings payés et la Tour niveau 3 atteints par chaque camp dans un scénario doté de fonds et de travailleurs de test.
- Les arrondis de présentation : total affiché de 100,0 %, sans modification de la mesure enregistrée.

Le test historique de progression IA observe désormais 240 secondes au lieu de 150 : le développement électoral préserve les six ouvriers locaux nécessaires avant d’équiper les unités supplémentaires. Les réglages de recrutement, de spawn et de marche n’ont pas été accélérés pour ce test.

## Parcours des jalons précédents

`npm run test:parcours` réussit avec les réglages normaux, sans fonds ni PNJ ajoutés :

| Étape | Temps simulé | Dépenses cumulées |
|---|---:|---:|
| Billet en cours | 9,37 s | 0 k € |
| Permanence construite | 10,37 s | 35 k € |
| Collecte du tract | 15,00 s | 47 k € |
| Retrait du tract | 18,50 s | 47 k € |
| Financement construit | 73,67 s | 102 k € |

`npm run test:conflits` réussit aussi : Local SO, équipement, collecte, raid, fermeture administrative, reconstruction et scènes de combat. Ces scènes restent explicitement préparées avec des ressources de test. Les fichiers des jalons 2 et 3 ont été régénérés au format de sauvegarde 4, avec les réglages actuels.

## Trois parties depuis un départ normal

Commande : `npm run test:conquete`. Chaque partie dure **900 secondes simulées**, soit **27 000 ticks**. Les trois candidats sont pilotés par le même contrôleur IA, avec les fonds, populations et spawns normaux. Aucun travailleur ni bâtiment n’est offert dans ces parties. Le jour reste à J-1 lorsque le compte à rebours est épuisé.

Les sommes et les bornes des quatre soutiens sont vérifiées dans les 18 sous-zones **à chaque tick**. L’écart numérique maximal observé par rapport à 100 est **1,421 × 10⁻¹⁴ point**, lié à l’arithmétique flottante. Aucun soutien négatif ou supérieur à 100 n’a été observé.

| Graine | Mélenchon | Le Pen | Philippe | Neutres | Contrôles M / LP / EP / contestés |
|---|---:|---:|---:|---:|---|
| 2027 | 22,39 % | 23,31 % | 19,86 % | 34,44 % | 1 / 1 / 1 / 15 |
| 73 | 21,09 % | 23,12 % | 22,57 % | 33,22 % | 1 / 1 / 1 / 15 |
| 31415 | 21,55 % | 23,02 % | 23,12 % | 32,31 % | 1 / 1 / 1 / 15 |

Les valeurs de cette table sont arrondies ; les valeurs complètes sont dans `artifacts/validation-jalon4.json`.

**Dans les trois parties, chacun des trois camps a construit son Financement, sa Tour, son Institut et son Meeting, puis payé au moins un événement.** Ces résultats sont obtenus progressivement avec l’économie normale. Le scénario IA doté de ressources couvre séparément l’accès aux trois niveaux de Tour ; les parties normales de quinze minutes ne donnent pas toutes le même niveau d’amélioration final.

L’IA suit une règle de développement locale, configurable. Pendant cette phase, elle limite ses impressions initiales à deux tracts afin de financer ses infrastructures, organise son premier Meeting et économise ensuite pour les améliorations. Les échanges de coups et les fermetures peuvent interrompre ses projets.

## Vérification visuelle dans le navigateur

Contrôles réalisés sur `http://localhost:2027/`, avec le navigateur intégré :

- Départ sans Institut : argent et J-XX visibles, aucun pourcentage national ni cercle.
- Import du paiement d’Institut à mi-parcours : le billet de 90 k € apparaît ; aucun score avant la fin du maintien. À la reprise, la construction débloque le cercle et les scores.
- Le cercle comporte 18 segments dans l’ordre du monde, avec rouge, bleu marine, blanc/gris et contesté. Les résultats sont compacts, sans bandeau supérieur.
- Meetings observés avec Mélenchon, Le Pen et Philippe : podium, signes de mobilisation, impulsion et couleur du camp. Les unités conservent leurs proportions et les bâtiments déjà validés leur emplacement.
- Institut fermé : le sondage reste visible et grisé. Les valeurs **24,6 / 23,6 / 25,5 / 26,3 %** sont restées inchangées pendant que la campagne avançait de **J-29 à J-27**.
- Aucun message d’erreur dans la console du navigateur lors de ces vérifications.

Les sauvegardes `jalon4-avant-institut`, `jalon4-tour-niveau-3`, `jalon4-sondage-*`, `jalon4-meeting-*` et `jalon4-institut-ferme` sont des scènes préparées pour un test rapide. Leurs achats et fermetures passent par les vraies transactions de présence. Les sauvegardes `jalon4-simulation-*` proviennent des parties normales décrites ci-dessus.

## Équilibrage livré et limites du jalon

La Tour reste faible : au niveau 3, dans une zone contrôlée, elle produit 0,011 point d’influence/s contre 0,035 pour un Militant du même camp. Le Meeting apporte une impulsion de 12/18/26, atténuée par la réserve de Neutres, puis un multiplicateur temporaire des unités locales. Les autres valeurs sont détaillées dans le guide.

La marche des Militants reste à 2,4 unités/s et plafonnée à deux fois celle du candidat. Les modifications de ce jalon concernent les sources électorales, les trois nouveaux lieux, leur information, et les règles minimales d’utilisation par les IA.

La stabilité mathématique et le fonctionnement des systèmes sont vérifiés. Le rythme et l’intérêt stratégique restent à apprécier en jouant, comme demandé avant le jalon suivant. Aucun système de J0, plateau médiatique, élimination, sprint final ou réseau n’a été ajouté.
