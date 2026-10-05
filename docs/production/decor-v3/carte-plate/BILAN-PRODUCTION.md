# Carte plate — livraison des 18 sous-zones

Fresque opaque de **34 560 × 1 080 px**, **18 tuiles de 1 920 × 1 080 px** et pilote Paris de **5 760 × 1 080 px** livrés. Les deux vérificateurs officiels se terminent par **« Aucun défaut détecté »**.

**Les 18 raccords ont aussi été inspectés à taille réelle**, dans des vues de 800 × 1 080 px, avec 400 pixels de chaque côté. La fermeture Riches C → Paris A est comprise. Les coupures de silhouettes, de toitures, de murets et les principales marches de bordure ont été reprises. Aucune coupure franche restante n’a été repérée aux 18 jonctions. [Inspection datée liée à l’empreinte du maître](production/controle-visuel-raccords/inspection.json).

Les gabarits sont des repères : ouvertures adaptées à l’architecture et petites places de meeting proches du bâti. Vélo et scooters visibles à l’intérieur des garages. Voitures exclues du premier plan ; train, bateaux lointains et caravanes derrière une clôture conservés. [Précisions utilisateur](DIRECTIVES-UTILISATEUR.md).

## Fichiers produits

- [Maître complet](fresque-plate-maitre.png) et [copie des assets](../../../../assets/generated/masters/fresque-plate-maitre.png), identiques.
- [Pilote Paris](pilote/fresque-plate-maitre.png) et [ses trois tuiles](pilote/tuiles/).
- Les 18 tuiles sont nommées et liées dans la liste de contrôle.
- [Aperçu numéroté](vue-carte-complete.png), [18 vues d’échelle](production/vue-18-tuiles.png), [18 vues natives des raccords](production/controle-visuel-raccords/).
- [Audit](audit-livraison.json), [vérification complète](verification-complete.txt), [vérification pilote](verification-pilote.txt).
- [Calage des entrées](production/controle-geometrie/rapport-calage-carte.json), [21 entrées en vues natives](production/controle-geometrie/index-entrees.json), [six places recadrées](production/controle-meetings/).
- [Prompts et sources des 20 reprises de raccord](production/revision-raccords-finitions.json), [supermarché, école, vitrine et cabinet](production/revision-finitions-finales.json).
- [Historique](production/revisions-composition.json), [extensions initiales](production/generations.json), [restaurations et scooters](production/revision-direction-artistique.json), [intermédiaires et variantes](production/retouches/).

Les silhouettes et repères de contrôle ne figurent pas dans les tuiles livrées. Cette livraison porte sur les images ; elle ne certifie pas leur intégration au moteur.

## Résultats officiels

Carte complète :

```text
18 tuile(s) découpée(s) au pixel près dans docs/production/decor-v3/carte-plate/tuiles.
18 coupes mesurées. Vues rapprochées et rapport dans docs\production\decor-v3\carte-plate\tuiles\controle-raccords.
Aucun défaut détecté. Regarder quand même chaque vue rapprochée à 100 %.
```

Pilote Paris :

```text
3 tuile(s) découpée(s) au pixel près dans docs/production/decor-v3/carte-plate/pilote/tuiles (fresque partielle).
15 tuile(s) pas encore peinte(s) : leurs coupes ne sont pas contrôlées.
2 coupes mesurées. Vues rapprochées et rapport dans docs\production\decor-v3\carte-plate\pilote\tuiles\controle-raccords.
Aucun défaut détecté. Regarder quand même chaque vue rapprochée à 100 %.
```

Les 15 tuiles absentes du contrôle du pilote sont présentes dans l’export complet.

**0 pixel transparent ; 0 pixel incorrect dans les 64 lignes du haut** (#9FCFEE). Maîtres complets de même empreinte SHA-256. 78 retouches avec contrôle des pixels extérieurs au moment de leur application. Aucun fondu, transparence ou mélange de deux images.

38 cellules d’entrée/panneau restent au calage exact ; les quatre cellules de Périurbain B et Campagne A ont des proportions naturelles suivant les précisions utilisateur. Panneaux crème vierges ; silhouettes de 162 px avec pieds à y = 1 004.

## Liste de contrôle du chapitre 16

☑ : critère contrôlé et retenu ; — : sans objet. Ouvertures, meeting et véhicules suivent les précisions utilisateur. Les deux côtés de chaque tuile et la boucle sont contrôlés. Cette appréciation ne promet pas une perfection artistique absolue.

| Tuile | Format opaque | Sol y = 1 004 | Échelle 162 px | Portes/panneaux | Meeting | Raccords sans fondu | Sans texte | Véhicules conformes | Ciel/lumière | Storyboard |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| [01 Paris A](tuiles/tuile-01-paris-a.png) | ☑ | ☑ | ☑ | ☑ | — | ☑ | ☑ | ☑ | ☑ | ☑ |
| [02 Paris B](tuiles/tuile-02-paris-b.png) | ☑ | ☑ | ☑ | ☑ | ☑ | ☑ | ☑ | ☑ | ☑ | ☑ |
| [03 Paris C](tuiles/tuile-03-paris-c.png) | ☑ | ☑ | ☑ | ☑ | — | ☑ | ☑ | ☑ | ☑ | ☑ |
| [04 Banlieue A](tuiles/tuile-04-banlieue-a.png) | ☑ | ☑ | ☑ | ☑ | — | ☑ | ☑ | ☑ | ☑ | ☑ |
| [05 Banlieue B](tuiles/tuile-05-banlieue-b.png) | ☑ | ☑ | ☑ | ☑ | ☑ | ☑ | ☑ | ☑ | ☑ | ☑ |
| [06 Banlieue C](tuiles/tuile-06-banlieue-c.png) | ☑ | ☑ | ☑ | ☑ | — | ☑ | ☑ | ☑ | ☑ | ☑ |
| [07 Périurbain A](tuiles/tuile-07-periurbain-a.png) | ☑ | ☑ | ☑ | ☑ | — | ☑ | ☑ | ☑ | ☑ | ☑ |
| [08 Périurbain B](tuiles/tuile-08-periurbain-b.png) | ☑ | ☑ | ☑ | ☑ | ☑ | ☑ | ☑ | ☑ | ☑ | ☑ |
| [09 Périurbain C](tuiles/tuile-09-periurbain-c.png) | ☑ | ☑ | ☑ | ☑ | — | ☑ | ☑ | ☑ | ☑ | ☑ |
| [10 Campagne A](tuiles/tuile-10-campagne-a.png) | ☑ | ☑ | ☑ | ☑ | — | ☑ | ☑ | ☑ | ☑ | ☑ |
| [11 Campagne B](tuiles/tuile-11-campagne-b.png) | ☑ | ☑ | ☑ | ☑ | ☑ | ☑ | ☑ | ☑ | ☑ | ☑ |
| [12 Campagne C](tuiles/tuile-12-campagne-c.png) | ☑ | ☑ | ☑ | ☑ | — | ☑ | ☑ | ☑ | ☑ | ☑ |
| [13 Retraités A](tuiles/tuile-13-retraites-a.png) | ☑ | ☑ | ☑ | ☑ | — | ☑ | ☑ | ☑ | ☑ | ☑ |
| [14 Retraités B](tuiles/tuile-14-retraites-b.png) | ☑ | ☑ | ☑ | ☑ | ☑ | ☑ | ☑ | ☑ | ☑ | ☑ |
| [15 Retraités C](tuiles/tuile-15-retraites-c.png) | ☑ | ☑ | ☑ | ☑ | — | ☑ | ☑ | ☑ | ☑ | ☑ |
| [16 Riches A](tuiles/tuile-16-riches-a.png) | ☑ | ☑ | ☑ | ☑ | — | ☑ | ☑ | ☑ | ☑ | ☑ |
| [17 Riches B](tuiles/tuile-17-riches-b.png) | ☑ | ☑ | ☑ | ☑ | ☑ | ☑ | ☑ | ☑ | ☑ | ☑ |
| [18 Riches C](tuiles/tuile-18-riches-c.png) | ☑ | ☑ | ☑ | ☑ | — | ☑ | ☑ | ☑ | ☑ | ☑ |

## Éléments vérifiés par sous-zone

| Tuile | Observation |
|---|---|
| 01 | Café, immeubles proches et escalier. Entrée à x = 1294. Raccord avec Riches C contrôlé. |
| 02 | Une seule boulangerie, fromagerie et boucherie ; vélo dans l’atelier. Angle de la boucherie complet. |
| 03 | Pierre ancienne et institut en brique distincts. Canal derrière le muret, Grands Moulins secondaires ; transition avant la coupe. |
| 04 | Tours Nuages complètes, tours rectangulaires variées. Arbres, silhouettes, murets et bordures repris. |
| 05 | Basilique secondaire et marché autour d’une place proche du bâti. |
| 06 | Pavillons, cité, mosquée, terrain et caravanes derrière la clôture. |
| 07 | Rangée French Dream semblable autorisée ; barbecue et supermarché secondaire avec pictogramme de panier. |
| 08 | Large atelier naturel, scooter bleu intérieur. Rond-point, collines progressives vers la montagne. |
| 09 | Mont-Blanc, usines, vaches ; versants raccordés à la colline précédente. |
| 10 | Grange à portail ouvert, scooter crème, établi et outils intérieurs. Serres, pylônes, château d’eau. |
| 11 | Mairie, drapeaux, église, monument, école, préau, tableau vierge, marelle sans chiffres et cour. Maison de fin avec angle et toit complets. |
| 12 | Champs, silo, monument, boulodrome, village et train lointain ; passage vers le bar-tabac repris. |
| 13 | Pavillons et bar-tabac ; bordure vers le quartier balnéaire reprise. |
| 14 | Villa à toit pentu et Art déco à toit plat distincts. Petite promenade, mer, palmiers, pharmacie et bateaux lointains. |
| 15 | Villa en meulière, maison du gardien, bois de Boulogne ; arbre et grille vers le parc repris. |
| 16 | Maison de la Radio petite et secondaire parmi les toits ; bâti urbain proche. |
| 17 | Petite tour Eiffel derrière les façades, vitrines différentes et kiosque ; trace sombre et sol repris. |
| 18 | Cabinet à porte opaque et grilles, bibliothèque et mobilier en bois ; institut à paillasse blanche. Pierre et brique Art nouveau distinctes. La Défense secondaire ; boucle vers Paris A vérifiée. |

## Petits défauts et limites restant visibles

- Certains contours de nuages restent irréguliers.
- De petites variations de grain, d’ombre ou de joints de pavage restent perceptibles près des devantures de Paris B et du garage de Périurbain B.
- Cette inspection artistique ne garantit pas une perfection absolue de chaque pixel.
- Les grandes marches rectangulaires ont été reprises. Le résultat n’est pas présenté comme un 10/10 absolu.

## Méthode

ImageGen intégré avec une référence world-v2 jointe à chaque génération. L’outil ne garantit pas les coordonnées ou les pixels fixes. La méthode technique acceptée conserve les pixels antérieurs dans les scripts, avec 256 px de contexte pour les extensions de gauche à droite. Les corrections sont dessinées par inpainting puis copiées dans le seul rectangle sélectionné, avec opacité complète et comparaison des pixels extérieurs. Certaines sources sont normalisées par redimensionnement ou recadrage ; les variantes mal cadrées sont conservées et rejetées. Aucun fondu ni superposition.

production.mjs assemble ; finition.mjs prépare et contrôle les retouches ; calibrage-ciel.mjs fixe le ciel opaque ; livraison.mjs exporte ; verifier-livraison.mjs découpe et vérifie ; inspecter-raccords-visuels.mjs produit les 18 vues élargies. Aucune dépendance installée.
