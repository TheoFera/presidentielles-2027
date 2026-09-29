# Fresque : éléments à peindre par Codex / ChatGPT

La fresque visible avec `http://localhost:2027/?decor=maquette` (et en travelling automatique avec
`http://localhost:2027/src/presentation/world-v3/balade.html?decor=maquette`) est **entièrement dessinée par le code**,
dans un seul style (`src/presentation/world-v3/fresque/`). Les seules images du jeu utilisées sont les estrades
provisoires de meeting (`building-meeting_stage-*`). Aucun ancien sprite de bâtiment ni ancien fond peint.

Chaque élément se contrôle seul, à côté d'un personnage pour l'échelle, sur les planches :
`SET=paris node scripts/world-v3-export.mjs planche` (ensembles : paris, banlieue, periurbain, campagne, littoral,
beaux, sites, nature, lointain) → `artifacts/world-v3/planche/`. Ces planches servent de maquettes à joindre à ChatGPT :
l'image peinte doit reprendre exactement la silhouette, les proportions et les détails du dessin.

Règle d'écriture : **aucun texte** dans le décor. Les commerces se reconnaissent à leur vitrine et à un pictogramme
(baguette et épi, part de fromage, tête de bœuf, tasse, croix verte, losange du tabac…). Seuls les bâtiments
interactifs portent un panneau crème, vierge, où le jeu écrit leur nom.

## Règles communes (à joindre à chaque demande)

- **Style** : celui du jeu (dessin animé peint, contours sombres, couleurs chaudes). Références à joindre :
  `assets/generated/buildings/building-campaign_local-bobo.png` et `assets/generated/biomes/street-bobo.png`.
- **Échelle** (image livrée en ×2) : un personnage mesure **162 px**, une porte **184 px**, un étage courant **168 px**,
  un rez-de-chaussée commerçant **256 px**. Une unité de jeu vaut **80 px** (largeurs indiquées en unités).
- **Fond** : transparent (ou magenta `#FF00FF` uni, retiré au calage). Le **pied du bâtiment touche le bord bas** de l'image.
- **Aucun texte, aucun nom de ville, aucune marque, aucun panneau d'entrée d'agglomération.** Les commerces se
  reconnaissent visuellement (vitrine, pictogramme peint sur le bandeau).
- Vue de face, depuis le trottoir, sans perspective plongeante ; lumière venant de la gauche.
- Nom de fichier : `assets/generated/fresque/<nom>.png`.

## 1. Rue jouable (priorité haute)

| Fichier | Contenu | Largeur | Où |
|---|---|---|---|
| `haussmann-r2-a.png` … `-d.png` | Immeuble haussmannien R+2 + mansarde zinc à lucarnes, balcons filants au 1er et au dernier étage, rez-de-chaussée **sans devanture** (porte cochère) | 5 à 7 u | Paris, beaux quartiers |
| `haussmann-r3-a.png`, `-b.png` | Même chose en R+3 | 5 à 6 u | Beaux quartiers |
| `faubourg-a.png` … `-c.png` | Immeuble de faubourg parisien enduit (ocre, rose, gris), R+2, volets | 3 à 6 u | Paris 19e, transitions |
| `devanture-boulangerie.png` | Boulangerie : baguettes, viennoiseries, store jaune | 3 u | Paris B, Banlieue B |
| `devanture-fromagerie.png` | Fromagerie : meules et tommes, store crème | 3 u | Paris B |
| `devanture-boucherie.png` | Boucherie : tête de bœuf dorée, carrelage blanc, store rouge et blanc | 3 u | Paris B |
| `devanture-cafe-terrasse.png` | Café-terrasse avec tables bistrot et chaises cannées devant | 3,5 u | Paris A |
| `devanture-*.png` | Tabac-presse (losange rouge), pharmacie (croix verte), fleuriste, primeur, kebab, coiffure, librairie, épicerie fine, concept store, boutiques de luxe, start-up, glacier | 2,5 à 3 u | Voir `scene.js` |
| `site-permanence.png`, `site-atelier-velo.png`, `site-garage-scooters.png`, `site-studio.png`, `site-local-so.png`, `site-institut.png` | Devantures des bâtiments interactifs (planche « sites ») avec leur panneau crème vierge | 4 u | Tous les quartiers |
| `immeuble-banlieue-a.png`, `-b.png` | Immeuble des années 60, R+3/R+4, loggias colorées, paraboles, rez-de-chaussée commerçant vide | 4 à 5 u | Banlieue |
| `tour-cite.png` + `tour-cite-bande.png` | Tour de cité : pied avec hall, puis une **bande d'étages répétable** vers le haut | 5 u | Banlieue A |
| `tour-nuage.png` + bande | Tour « nuage » à hublots et mosaïque | 5,5 u | Banlieue A |
| `pavillon-modeste.png`, `-brique.png`, `-meuliere.png`, `-impeccable.png`, `-balneaire.png` | Maisons individuelles (avec leur jardinet et clôture) | 3 à 5 u | Banlieue C, Retraités |
| `pavillon-lotissement.png` | Maison « French Dream » : enduit crème, toit d'ardoise, garage, grillage, boîte aux lettres (voir `src/presentation/world-v3/references/`) | 4 u | Périurbain A |
| `jardin-barbecue.png` | Jardin clos avec **barbecue**, trampoline, pelouse (la fumée reste animée par le code) | 2,5 u | Périurbain A |
| `jardin-*.png` | Salon de jardin et parasol, nain de jardin, balançoire, potager, fil à linge | 1,5 à 3 u | Retraités, Banlieue C |
| `rond-point.png` | Îlot de rond-point : butte gazonnée, pavés, fleurs, herbes de la pampa, roue de tracteur géante sur socle, panneau « Toutes directions ». **Centre libre** (estrade de meeting) | 9 u | Périurbain B |
| `grande-surface-bricolage.png`, `-supermarche.png` | Bâtiment de zone commerciale, bardage, enseigne générique, caddies | 5 à 7 u | Périurbain |
| `usine-decolletage.png` | Usine en brique à sheds et haute cheminée | 5 u | Périurbain C |
| `caravanes.png` | Camp de caravanes derrière un portail et un grillage, linge | 7 u | Banlieue → Périurbain |
| `ferme-grange.png`, `hangar-agricole.png`, `serres-tunnels.png`, `silo.png` | Bâtiments agricoles (bottes de paille, tracteur, tomates) | 4 à 8 u | Campagne |
| `mairie.png` | Mairie de village : fronton, horloge, drapeaux français et européen, « Liberté · Égalité · Fraternité » | 5 u | Campagne B |
| `monument-aux-morts.png`, `calvaire.png` | Petits monuments | 1 à 2 u | Campagne |
| `vaches-montbeliardes.png` | 3 vaches (robe pie rouge), dont une qui broute | 2 u chacune | Périurbain C |
| `residence-front-de-mer.png`, `galerie-arcades.png`, `promenade-balustrade.png` | Front de mer (type Les Sables-d'Olonne, sans nom) | 4 à 9 u | Retraités B |
| `hotel-particulier.png`, `rotonde-radio.png`, `kiosque-journaux.png`, `fontaine-wallace.png` | Beaux quartiers | 1 à 6,5 u | Riches |
| `quai-canal.png`, `escalier-butte.png`, `place-paves.png`, `marche-etals.png` | Espaces ouverts de Paris et de banlieue | 1,5 à 9 u | Paris, Banlieue B |

## 2. Fond proche (plan « back », vitesse 0,72, objets vus à ~60 %)

- `passerelle-canal.png` : passerelle métallique verte et écluse au-dessus de l'eau (7 u).
- `periph-viaduc.png` : périphérique sur viaduc bas avec voitures (20 u, bande répétable).
- `metro-aerien.png` : viaduc de la ligne aérienne avec une rame (24 u).
- `plage.png` : sable, cabines rayées, parasols, serviettes (34 u, bande répétable).
- `lotissement-lointain.png`, `villas-lointaines.png` : rangées de maisons vues de plus loin.

## 3. Lointain et horizon (plans « far » et « horizon »)

- `alpes-mont-blanc.png` : massif alpin en deux rangs, Mont-Blanc en dôme enneigé au centre, pentes qui redescendent
  en collines de chaque côté (**aucun bord coupé**) ; teintes bleutées de lointain. Environ 2400 × 700 px.
- `mer-horizon.png` : mer jusqu'à l'horizon avec phare sur sa jetée et voiliers (bande répétable).
- Monuments en silhouette peinte, fond transparent : `basilique-saint-denis.png`, `mosquee-contemporaine.png`,
  `grands-moulins.png`, `la-defense-grande-arche.png`, `grand-palais.png`, `eoliennes.png`, `ville-de-vallee-usines.png`,
  `entrepot-logistique.png` (enseigne « LOGISTIQUE », aucune marque), `autoroute.png`, `toits-de-paris.png`.

## Remplacement

Les emplacements, largeurs et échelles sont fixés dans `src/presentation/world-v3/fresque/scene.js` (tableaux `STREET`,
`BACKDROP`, `IMAGES`). Une image peinte remplacera le dessin du même élément sans changer la carte : il suffira de
l'enregistrer dans `src/presentation/fixed-world-assets.js` et de dire au rendu de la fresque d'utiliser l'image au
lieu du peintre correspondant.
