# Implémentation visuelle — 9 septembre 2026

## Correction des dernières remarques

Le pied des rues est désormais ancré sur la dernière ligne de maçonnerie opaque, détectée et mémorisée pour chaque image. Les quelques pixels transparents du bord PNG ne créent plus de bande entre les façades et le trottoir. Un léger recouvrement sous le sol masque la couture liée au lissage.

La rue est désormais distincte du paysage. Les commerces jouables se placent parmi des façades attenantes, sur la même ligne de sol et avec la même vitesse. Le paysage intermédiaire se déplace à 55 % de la vitesse de la rue et l’horizon à 26 %. Ces coordonnées bouclent sur la carte circulaire.

Les hauteurs des façades et des décors sont calculées à partir de leurs dimensions natives. Les bâtiments et monuments ne sont plus redimensionnés indépendamment en largeur et en hauteur. Seules les dernières lignes de terrain des paysages sont prolongées vers le bas pour éviter de voir le ciel sous un horizon.

Les limites des panoramas se recouvrent avec des contours opaques irréguliers. Aucun fondu de deux façades ni arbre de premier plan géant ne sert de cache à une coupure. Les paysages sont répétés à une échelle plus petite pour que leurs arbres restent derrière les maisons.

## Rendu et chargement

Canvas2D : ciel, horizon, paysage, rue, végétation, sites, sol unique, personnages et effets. Les illustrations sont lissées ; la logique de simulation n’est pas modifiée par cette correction. Les modules illustrated-world, illustrated-buildings, illustrated-characters et illustrated-vegetation concentrent cet habillage.

Le cache protège les assets de la zone et de ses voisines, avec une limite de 80 images hors protection indispensable. Les PNG runtime sont réduits ; les masters ne sont pas embarqués dans dist. Un export indisponible conserve le secours existant. Les contours calculés sont mémorisés par image.

Les enseignes sont ancrées dans le panneau du sprite. Propriété, niveau, QG et fermeture ajoutent leurs indicateurs à la façade existante. Les saisons changent le ciel, le traitement des paysages et les feuillages de premier plan. Les animations de présentation suivent les états de combat, marche et KO.

## Vérifications

- npm test : 41 réussites, aucun échec.
- npm run build : réussi, sortie dist.
- Inspection des 18 sous-zones, des frontières, des quatre saisons, des sites capturés/améliorés/en fermeture/fermés et des trois candidats avec effets.
- Plateau de l’arène médiatique vérifié.
- Format 1280 × 720 et mobile 842 × 445 ; contrôle supplémentaire à 2340 × 1080.
- Défilement automatique dans les deux directions dans l’atelier isolé. Aucun avertissement ou erreur de chargement lors de la lecture du journal.
- Compteur observé autour de 125 images/s sur cet ordinateur à 1280 × 720. Cela ne constitue pas une mesure sur téléphone physique.

## Limites de validation

L’atelier utilise le vrai moteur de rendu avec des états isolés. Il ne remplace pas une partie complète jusqu’au second tour sur téléphone physique. Les animations restent des transformations de sprites, pas des séquences dessinées image par image. Les rues et paysages répètent certains motifs. Les nouvelles variantes artistiques à arbres réduits n’ont pas pu être générées à cause de la limite temporaire du service ; les images disponibles sont utilisées à une échelle corrigée.

La refonte ne doit donc pas être présentée comme une recette finale sans réserve. Les captures et les tests documentent les éléments réellement contrôlés.
