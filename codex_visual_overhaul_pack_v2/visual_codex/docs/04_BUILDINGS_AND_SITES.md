# 04 — Bâtiments et sites

## Principe fondamental

Les sites stratégiques existent physiquement dès le chargement du monde.

### À INTERDIRE

`vide → achat → spawn d'un bâtiment`

### Comportement attendu

`site neutre visible → capture → même site + habillage faction`

Le footprint et la position de gameplay restent identiques **pour une même famille de site**.

### IMPORTANT — architecture différente selon le biome

L'architecture n'est PAS identique d'un biome à l'autre. Chaque type de site doit avoir une variante architecturale dédiée pour :
- Bobo ;
- Banlieue ;
- Périurbain ;
- Campagne ;
- Retraités ;
- Quartiers riches.

La variante conserve le même gabarit fonctionnel, la même ancre et le même point d'interaction, mais change réellement de façade, matériaux, toit, fenêtres et détails de contexte. **Une simple recoloration d'un bâtiment unique est interdite.**

Voir `14_BUILDING_BIOME_VARIANTS.md` et `config/building_biome_matrix.json`.

## Sites capturables

- Local de campagne / Permanence / QG ;
- Financement ;
- Tour de communication ;
- Local SO / Cabinet administratif selon propriétaire.

## Services neutres

- Imprimerie ;
- Salle de meeting ;
- Institut de sondage.

Ils restent neutres visuellement.

## Composition visuelle d'un site capturable

Séparer autant que possible :

1. `base_neutral`
   - façade ;
   - fenêtres ;
   - porte ;
   - enseigne vide ;
   - éclairage neutre.

2. `owner_overlay`
   - bandeau faction ;
   - drapeau ;
   - affiches ;
   - petits accents.

3. `level_overlay`
   - N1 minimal ;
   - N2 ajout visuel clair ;
   - N3 ajout clair supplémentaire.

4. `state_overlay`
   - capture en cours ;
   - fermeture en cours ;
   - fermé/neutre ;
   - campagne de financement active ;
   - meeting actif ;
   - etc.

Ainsi, un changement de propriétaire ne remplace jamais l'ensemble du bâtiment.

## Local / Permanence / QG

Base : petit local de quartier crédible.

### Neutre
- enseigne vide ;
- intérieur sombre ou discret ;
- aucune couleur politique.

### Permanence N1
- bandeau faction ;
- 1 affiche ;
- lumière allumée.

### N2
- seconde affiche / petit drapeau ;
- intérieur un peu plus actif.

### N3
- façade davantage mobilisée ;
- bannière/élément vertical ;
- sans devenir deux fois plus grande.

### QG
Même base de local mais statut fort :
- grande bannière verticale ;
- petit emblème de campagne ;
- éclairage plus riche ;
- doit être identifiable au premier regard.

Si une permanence devient QG, la façade ne change pas de structure : l'overlay QG s'active.

## Financement

Façade de bureau/collecte.

États :
- neutre ;
- possédé ;
- campagne inactive ;
- campagne active : lumière/compteur décoratif/activité interne ;
- payout : bref effet billets/lumière ;
- fermeture.

## Tour de communication

Ce n'est pas forcément une tour énorme.
Privilégier un local média/antenne avec :
- mât ;
- antennes ;
- petits écrans ;
- amplification visuelle par niveaux.

N1 : petite antenne.
N2 : antenne supplémentaire.
N3 : équipement plus dense.

## Local SO / Cabinet Philippe

Même `site slot` possible, rendu selon faction.

Mélenchon/Le Pen :
- local logistique/service d'ordre ;
- casiers/équipement visibles ;
- niveaux = équipement plus développé.

Philippe :
- cabinet administratif ;
- dossiers, plaque, aspect bureau ;
- niveaux = signalétique/activité administrative.

## Imprimerie neutre

- atelier typographique/imprimerie de quartier ;
- neutralité claire ;
- activité mécanique quand une commande est en cours.

## Salle de meeting neutre

- petite salle polyvalente / salle des fêtes / auditorium de quartier selon biome ;
- aucune couleur permanente ;
- lors d'un meeting : podium + bannières temporaires de la faction + foule décorative.

## Institut de sondage neutre

- bureau d'étude / institut ;
- neutralité ;
- écrans/graphiques stylisés ;
- ne pas rendre de pourcentages illisibles dans l'image : UI par-dessus.

## Fermeture

Quand un site perd son implantation :
- les couleurs se désaturent progressivement ;
- les affiches politiques disparaissent ;
- les lumières s'éteignent ;
- fin : retour au `base_neutral`.

Ne pas faire exploser/détruire le sprite principal sauf événement visuel temporaire.

## Fermeture événementielle

Incendie, dégât, fermeture administrative, etc. :
- overlay temporaire facultatif (fumée légère, ruban, planches, scellé) ;
- après résolution mécanique : retour au neutre si c'est la règle du jeu.

Voir `building_visual_states.json`.
