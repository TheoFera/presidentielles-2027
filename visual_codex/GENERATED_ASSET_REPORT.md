# Assets visuels — 9 septembre 2026

Le registre contient 128 assets : 42 façades (sept familles dans six biomes), 3 candidats, 24 habitants, 2 membres du service d’ordre, 2 CRS, 3 journalistes, 5 végétations, 25 anciens décors et plateau, 10 horizons/nuages, 6 rues attenantes et 6 paysages intermédiaires.

Les exports utilisés par le jeu se trouvent dans assets/generated ; leurs masters sont conservés séparément. Les prompts et chemins sources figurent dans production et generated_asset_registry.json. Le registre conserve aussi les anciennes générations servant de secours : 128 n’est pas le nombre d’images chargées simultanément.

Dernière correction : création des six rues street-* et des six paysages landscape-*. Les rues bobo, périurbain, retraités et riches ont été régénérées après rejet des exports sans alpha. Les six horizons distant-* ont également été régénérés pour obtenir une véritable transparence. Le pipeline refuse un PNG RGB lorsqu’une transparence est requise.

Le 9 septembre, une nouvelle tentative de paysages avec des arbres plus petits a reçu usage_limit_reached. Ces variantes n’existent pas et ne sont pas intégrées. Le rendu utilise les paysages déjà disponibles à une échelle réduite, avec deux panneaux par biome. Aucun remplacement par une greybox n’a été ajouté pour contourner cette limite.

Points artistiques restant à polir : répétition des rues au sein d’un biome ; végétation peinte directement sur les façades qui reste verte en hiver ; richesse des animations, actuellement obtenues à partir de sprites uniques et de transformations liées aux actions.

