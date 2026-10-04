# Bilan de l’essai — carte plate
Date : 4 octobre 2026. Statut : arrêt de la production, essais non validés.

## Résultat
Quatre appels à l’outil intégré imagegen : Paris A, correction de sa géométrie, extension vers Paris B, retouche d’une bande de raccord. Chaque appel a reçu assets/generated/world-v2/panorama-bobo.png comme référence de style. Les prompts exacts sont conservés dans ce dossier.

La conservation des pixels par script fonctionne. L’assemblage bord à bord conserve intégralement Paris A (comparaison de toutes les valeurs RGBA). La retouche conserve intégralement les pixels extérieurs à la bande x = 1856 à 1983 (128 px). Aucune opération ne mélange ou superpose deux sources : le script copie des rectangles opaques, et remplace uniquement la bande autorisée.

Les sorties du générateur n’ont pas les dimensions demandées. Une mise à l’échelle uniforme et un recadrage les normalisent avant toute conservation des pixels : 1920 × 1080 pour les morceaux ; 800 × 1080 pour la vue de raccord.

## Défauts observés
- Le raccord initial présente une différence de ciel et des traits interrompus dans la végétation.
- Après retouche, les deux bords de la bande centrale restent visibles dans le ciel. Certains traits de toiture et de feuillage changent à ces limites.
- La porte et le panneau du QG de Paris A restent décalés par rapport au gabarit. Le dessin se rapproche du sol demandé, mais ses dimensions précises ne sont pas validées.
- Les étals du début de Paris B empiètent sur la zone de meeting réservée.
- Le haut du ciel n’est pas #9FCFEE : les 122880 pixels des 64 premières lignes de chaque morceau normalisé diffèrent de cette couleur.
- Paris B reste incomplet et Paris C n’a pas été peint. Les transitions extérieures du pilote ne sont pas validées.

## Contrôles effectués
Rapport avant retouche :
```json
{"pixels_originaux_identiques":true,"raccord":{"seam":23.618518518518517,"normal":14.63179012345679,"visible":false},"largeur":3584,"hauteur":1080}
```
Rapport après retouche :
```json
{"pixels_hors_bande_identiques":true,"bande":{"x":1856,"largeur":128},"raccord":{"seam":21.258024691358024,"normal":15.49753086419753,"visible":false}}
```
« visible : false » est le résultat du seuil statistique du projet sur la colonne de jonction. Ce résultat ne valide ni la continuité des objets ni les deux limites de la bande retouchée : le contrôle visuel refuse l’essai.

Les trois fichiers contrôlés par audit-pixels.json sont opaques (zéro pixel transparent). L’assemblage mesure 3584 × 1080, et ne constitue pas la fresque pilote demandée.

## Vérification demandée du pilote
Non exécutée : aucune fresque maître conforme de 5760 × 1080 n’a été produite. Aucun fichier n’a été présenté sous le nom fresque-plate-maitre.png. Aucune tuile de livraison n’a été découpée. Il n’existe donc aucun résultat « Aucun défaut détecté » pour le pilote.

## Liste du chapitre 16 appliquée aux brouillons
☑ = vérifié ; ☐ = non validé ; — = sans objet ou image non produite.

| Critère | Paris A, brouillon corrigé | Paris B, extension partielle | Paris C |
|---|---|---|---|
| 1920 × 1080, opaque | ☑ | ☐ (1664 px ajoutés seulement) | — |
| Sol à y = 1004 | ☐ | ☐ | — |
| Échelle vérifiée avec un personnage de 162 px | ☐ | ☐ | — |
| Portes et panneaux crème aux bonnes positions | ☐ | ☐ | — |
| Place de meeting libre | — | ☐ | — |
| Raccords parfaits à gauche et à droite, sans fondu ni dédoublement | ☐ | ☐ | — |
| Aucun texte hors exceptions | ☑ (contrôle visuel) | ☑ (contrôle visuel) | — |
| Aucun véhicule | ☑ (contrôle visuel) | ☑ (contrôle visuel) | — |
| Ciel et lumière conformes | ☐ | ☐ | — |
| Éléments du storyboard présents | ☐ | ☐ | — |

## Fichiers produits
Tous les fichiers restent dans pilote/essai/ ; aucun n’est branché dans le jeu.
- BILAN-ESSAI.md : ce bilan.
- audit-pixels.json : dimensions, opacité et conformité du haut du ciel.
- extension.mjs : préparation, normalisation, assemblage et remplacement local sans fondu.
- prompt-paris-a.txt
- prompt-paris-a-correction.txt
- prompt-extension-paris-b.txt
- prompt-retouche-raccord.txt
- paris-a-brut.png
- paris-a-brouillon.png
- paris-a-correction-brute.png
- paris-a-correction.png
- extension-guide.png
- extension-guide-correction.png
- extension-paris-b-brute.png
- extension-paris-b.png
- assemblage-essai.png
- assemblage-essai-rapport.json
- assemblage-essai-raccord.png
- retouche-raccord-brute.png
- retouche-raccord.png
- assemblage-retouche.png
- assemblage-retouche-rapport.json
- assemblage-retouche-raccord.png

## Décision
Le résultat n’est pas jugé 10/10. Arrêt conformément à la consigne de l’utilisateur, sans peindre le reste de la carte et sans déclarer le pilote réussi.

