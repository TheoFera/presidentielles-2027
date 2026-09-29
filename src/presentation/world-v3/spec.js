/**
 * Décor v3 : source unique des maquettes, des prompts ChatGPT et du calage des portes.
 *
 * Toutes les mesures sont en pixels de l'image finale (1536 × 1024). La largeur d'une image de rue
 * correspond exactement à une sous-zone (24 unités de jeu, soit 64 px par unité).
 * La ligne de sol (bas des portes) est à y = 990. Un personnage debout mesure environ 200 px.
 */

export const CANVAS = Object.freeze({ width: 1536, height: 1024 });
export const STREET_BASELINE = 990;
export const LAYER_BASELINE = 1000;
export const PX_PER_UNIT = CANVAS.width / 24;
export const CHARACTER_PX = 200;

/**
 * Plans du décor, du plus lointain au plus proche. `parallax` = vitesse relative à la caméra.
 * `base` = hauteur de la ligne de sol de l'image au-dessus des pieds des personnages (fraction de la hauteur d'écran).
 * `content` = hauteur maximale utile de l'image au-dessus de sa ligne de sol, en pixels d'image.
 */
export const LAYERS = Object.freeze({
  far: { parallax: 0.2, base: 0.16, content: 900, label: 'Lointain' },
  middle: { parallax: 0.45, base: 0.05, content: 520, label: 'Plan intermédiaire' },
  street: { parallax: 1, base: 0.022, content: 930, label: 'Rue jouable' },
  front: { parallax: 1.35, label: 'Avant-plan (dessiné par le jeu)' },
});

/** Palette des maquettes : chaque matière a une couleur plate reconnaissable. */
export const MATERIALS = Object.freeze({
  haussmann: ['#e7d6ae', '#5f7282'], beton: ['#d3cdbf', '#8d9091'], tour: ['#ddd5c4', '#7e8385'],
  brique: ['#b8573d', '#6c4a3c'], pierre: ['#d9c39a', '#b8603c'], stuc: ['#f3eee2', '#c4683f'],
  villa: ['#eadbc0', '#5d6b78'], meuliere: ['#cfa877', '#5d6b78'], hangar: ['#a9b2b2', '#7c8586'],
  bois: ['#a0754c', '#6d4c33'], verre: ['#a8cfdb', '#7aa0ad'], moderne: ['#c9cfd2', '#6f7a80'],
  pavillon: ['#e9dcc2', '#b9613f'], delabre: ['#cdbd9f', '#9d5a3d'], usine: ['#b4654a', '#6b6f70'],
});

const bat = (x, w, h, mat, roof, floors, desc, extra = {}) => ({ t: 'bat', x, w, h, mat, roof, floors, desc, ...extra });
const site = (site, x, desc, door = [150, 260], sign = [230, 58]) => ({ t: 'site', site, x, door, sign, desc });
const vitrine = (x, w, kind, desc, h = 250) => ({ t: 'vitrine', x, w, h, kind, desc });
const bas = (x, w, h, kind, desc) => ({ t: 'bas', x, w, h, kind, desc });
const objet = (x, w, h, kind, desc, extra = {}) => ({ t: 'objet', x, w, h, kind, desc, ...extra });
const tour = (x, w, floors, desc) => ({ t: 'tour', x, w, floors, desc });
const place = (x, w, desc) => ({ t: 'place', x, w, desc });
const arbre = (x, h, shape = 0) => ({ t: 'arbre', x, h, shape });

/**
 * Les 18 rues jouables. Chaque bâtiment « site » a une porte au centre `x` et une enseigne crème vierge
 * juste au-dessus : le jeu y écrit la fonction et la couleur du propriétaire. Les `arbre` ne sont PAS peints :
 * le jeu les dessine selon la saison.
 */
export const STREETS = {
  paris_a: {
    biome: 'paris_19e', title: 'Paris 19e — café et boutique de créateurs, sur la butte',
    scene: 'Upper Paris 19th arrondissement on a gentle hill (Buttes-Chaumont feeling): cream Haussmann stone buildings with zinc mansard roofs, a trendy chain-style coffee shop and a designer concept store. Bobo, cosy, plants everywhere.',
    elements: [
      bas(0, 90, 110, 'grille', 'low garden wall with black iron railing, continues past the left edge'),
      bat(90, 350, 860, 'haussmann', 'mansarde', 4, 'Haussmann corner building, ornate balconies, zinc mansard roof with chimneys'),
      vitrine(105, 320, 'cafe', 'trendy take-away coffee shop: big windows, green-grey awning, bistro terrace chairs outside, no logo', 290),
      objet(450, 110, 330, 'escalier', 'stone stairway climbing between the buildings toward a hilltop park, black lamp post'),
      arbre(505, 230, 1),
      bat(570, 400, 900, 'haussmann', 'mansarde', 4, 'Haussmann building, wrought-iron balconies with flower boxes'),
      site('site:paris_a', 768, 'CAMPAIGN OFFICE (permanence) in the ground floor: navy-blue wooden shopfront, glass double door, posters inside'),
      arbre(1035, 250, 0),
      bat(1100, 330, 700, 'haussmann', 'mansarde', 3, 'lower Haussmann building with climbing ivy'),
      vitrine(1115, 300, 'concept', 'designer concept store: pale green frame, minimalist lamps and vases in the window, a vintage bicycle leaning in front', 280),
      bas(1450, 86, 120, 'jardiniere', 'wooden planters with lavender, continue past the right edge'),
    ],
  },
  paris_b: {
    biome: 'paris_19e', title: 'Paris 19e — place du marché bio et garage à vélo',
    scene: 'Lively bobo neighbourhood square in Paris: Haussmann buildings, an organic market, a bicycle repair garage. The square in the middle stays open for political meetings. Sacré-Cœur is visible far away through the open square (distant layer, do not paint it).',
    elements: [
      bas(0, 90, 120, 'jardiniere', 'wooden planters with herbs'),
      bat(90, 510, 880, 'haussmann', 'mansarde', 4, 'Haussmann building with zinc roof'),
      site('site:paris_b', 368, 'BICYCLE GARAGE: wide open workshop door, bikes hanging on the walls, wheels and tools, two bikes parked outside', [230, 260], [260, 58]),
      place(600, 340, 'open paved neighbourhood square with a few black bollards at its edges; empty in the middle'),
      objet(940, 330, 270, 'marche', 'organic market stalls with striped green and cream awnings, crates of vegetables and fruit'),
      bat(930, 350, 640, 'haussmann', 'mansarde', 2, 'lower old Parisian building behind the stalls'),
      vitrine(1280, 180, 'bio', 'organic grocery shop with a painted leaf pictogram (no text)', 250),
      bat(1270, 196, 800, 'haussmann', 'mansarde', 4, 'Haussmann building'),
      bas(1466, 70, 120, 'jardiniere', 'wooden planters, continue past the right edge'),
      arbre(1110, 240, 1),
    ],
  },
  paris_c: {
    biome: 'paris_19e', title: 'Canal Saint-Martin — quartier mixte vers la banlieue',
    scene: 'Canal Saint-Martin in Paris: stone quay, a lock with black gates, the iconic green iron arched footbridge. Mixed modest buildings (brick and stone, fewer ornaments than Haussmann), a polling institute in a converted canal-side workshop. On the right, a wide open green towpath marks a breathing space before the suburbs.',
    elements: [
      objet(70, 360, 380, 'passerelle', 'green iron arched footbridge over the canal lock, stairs on both sides, canal water visible between the quay stones'),
      bas(0, 480, 90, 'grille', 'low black canal railing along the quay'),
      arbre(490, 260, 0),
      bat(560, 420, 760, 'brique', 'pignon', 3, 'modest mixed Parisian building, brick and pale stone, 3 floors'),
      site('site:paris_c', 768, 'CAMPAIGN OFFICE (permanence): green-blue shopfront, glass door, leaflets in the window'),
      bat(990, 300, 520, 'brique', 'shed', 2, 'old brick workshop by the canal, converted into offices with big metal-framed windows'),
      site('site:paris_c:institut_sondage', 1140, 'POLLING INSTITUTE office in the converted workshop: glass door, bar-chart posters in the window', [150, 250], [220, 56]),
      bas(1300, 236, 100, 'cloture', 'wide empty grassy towpath with a low wooden fence and a bench: breathing space before the suburbs'),
      arbre(1400, 230, 2),
    ],
  },
  banlieue_a: {
    biome: 'banlieue', title: 'Banlieue — tours de cité géantes et média associatif',
    scene: 'French suburban housing estate (cité): TWO gigantic concrete tower blocks in the foreground, so tall they leave the top of the image; balconies, satellite dishes, laundry. An associative newsroom (Bondy Blog style) at the foot of the left tower; the right tower only has its plain entrance hall. Absolutely no Haussmann.',
    elements: [
      bas(0, 80, 100, 'talus', 'grassy mound with concrete bollards'),
      tour(80, 540, 16, 'LEFT concrete tower block, cream and grey panels, 16+ floors, leaves the top edge of the image'),
      site('site:banlieue_a', 350, 'ASSOCIATIVE NEWSROOM (local media): wide glass storefront, microphones and laptops inside, colourful mural around the door', [170, 260], [250, 58]),
      objet(640, 250, 210, 'city', 'small fenced multisport pitch (city stadium) with a basketball hoop, benches'),
      arbre(760, 230, 1),
      tour(900, 500, 14, 'RIGHT concrete tower block, different colour (pale ochre), leaves the top edge of the image'),
      objet(1080, 150, 240, 'hall', 'plain entrance hall of the right tower: glass door, rows of letterboxes, no shop and no sign'),
      bas(1400, 136, 110, 'muret', 'low concrete wall with bike racks'),
    ],
    extendsAbove: true,
  },
  banlieue_b: {
    biome: 'banlieue', title: 'Banlieue — marché populaire, boulangerie, basilique au fond',
    scene: 'Central popular market of a suburb like Saint-Denis: plain post-war 3- and 4-storey housing blocks with balconies, a warm bakery, colourful market stalls. The open square in the middle is kept free for meetings; the Saint-Denis basilica is seen far behind (other layer).',
    elements: [
      bas(0, 90, 110, 'jardiniere', 'concrete planters'),
      bat(90, 510, 820, 'beton', 'plat', 4, 'plain post-war 4-storey housing block, flat roof, balconies with plants and a flag'),
      vitrine(105, 170, 'boulangerie', 'warm bakery: golden bread and croissants in the window, red awning, painted wheat pictogram', 260),
      site('site:banlieue_b', 368, 'CAMPAIGN OFFICE (permanence) in the block ground floor: simple blue frame, glass door'),
      place(600, 340, 'open market square, worn paving, empty in the middle'),
      objet(950, 360, 280, 'marche', 'popular market stalls: fruit, spices, clothes, colourful umbrellas and awnings'),
      bat(940, 380, 650, 'beton', 'plat', 3, '3-storey block behind the stalls'),
      bat(1320, 150, 700, 'beton', 'plat', 3, '3-storey corner block, phone repair shop (pictogram)'),
      bas(1470, 66, 110, 'muret', 'low concrete wall'),
    ],
  },
  banlieue_c: {
    biome: 'banlieue', title: 'Banlieue — pavillons pauvres, local SO, vers le camp de voyageurs',
    scene: 'Poor outer suburb: small worn detached houses, cracked render, cheap extensions, overcrowded (many letterboxes, mattress, satellite dishes). A real two-storey security service building. On the right, an open gate toward a travellers camp with a caravan.',
    elements: [
      bas(0, 100, 110, 'muret', 'low cracked wall'),
      bat(100, 220, 520, 'delabre', 'tuiles', 2, 'small worn detached house, cracked render, satellite dish'),
      bat(330, 220, 470, 'delabre', 'tuiles', 2, 'worn house with a cheap corrugated extension'),
      bat(560, 420, 620, 'beton', 'tuiles', 2, 'solid two-storey SECURITY SERVICE premises (local SO): wide metal garage door on the left, entrance door, barred upstairs windows, a French flag'),
      site('site:banlieue_c', 768, 'entrance door of the security service premises', [140, 250], [240, 58]),
      bat(990, 300, 460, 'delabre', 'tuiles', 2, 'worn house with too many letterboxes, laundry hanging'),
      objet(1330, 140, 220, 'caravane', 'white caravan with a red stripe parked on gravel behind an open metal gate'),
      bas(1300, 236, 100, 'cloture', 'open metal gate and low wire fence'),
    ],
  },
  periurbain_a: {
    biome: 'periurbain_usine', title: 'Périurbain — usine et maisons « French Dream » identiques',
    scene: 'Edge of a French small-town industrial area: a brick factory with sawtooth roof and a tall chimney, then a row of identical recent modest houses (French Dream: beige render, grey roller shutters, tiny lawns). Absolutely no Haussmann.',
    elements: [
      bas(0, 80, 100, 'haie', 'low hedge'),
      bat(80, 470, 540, 'usine', 'shed', 1, 'brick factory workshop with sawtooth roof, loading door, factory gate'),
      objet(420, 70, 900, 'cheminee', 'tall brick factory chimney'),
      bat(575, 390, 420, 'moderne', 'plat', 1, 'modest single-storey building by the factory gate'),
      site('site:periurbain_a', 768, 'CAMPAIGN OFFICE (permanence) in this modest building: glass door, posters'),
      bat(990, 150, 440, 'pavillon', 'tuiles', 1, 'recent identical French Dream house #1, grey roller shutters, small lawn'),
      bat(1150, 150, 440, 'pavillon', 'tuiles', 1, 'identical house #2'),
      bat(1310, 150, 440, 'pavillon', 'tuiles', 1, 'identical house #3'),
      bas(980, 556, 90, 'cloture', 'identical low white fences'),
    ],
  },
  periurbain_b: {
    biome: 'periurbain_usine', title: 'Périurbain — zone artisanale et rond-point au premier plan',
    scene: 'French commercial/craft zone: red-brick scooter garage, a warehouse, a red-brick house. In the very FOREGROUND, the ROUNDABOUT: a flattened oval island with low stone curb, flowers and a kitsch local sculpture (giant metal tractor wheel), directly on the playing street, NOT far behind. The island centre stays free for meetings.',
    elements: [
      bas(0, 80, 110, 'panneau', 'grass verge with a blue road direction sign'),
      bat(80, 520, 460, 'brique', 'shed', 1, 'red-brick workshop'),
      site('site:periurbain_b', 368, 'SCOOTER GARAGE: roller door open, scooters inside and two parked outside, oil stains', [240, 260], [260, 58]),
      objet(600, 340, 90, 'rondpoint', 'ROUNDABOUT island in the foreground: low stone curb, flower bed, very flat'),
      objet(770, 150, 380, 'sculpture', 'kitsch roundabout sculpture (giant rusty tractor wheel on a pedestal) standing at the BACK of the island'),
      bat(950, 360, 420, 'hangar', 'plat', 1, 'corrugated metal warehouse with loading bay, empty car park'),
      bat(1320, 150, 480, 'brique', 'tuiles', 2, 'red-brick house'),
      bas(1470, 66, 110, 'haie', 'hedge'),
    ],
  },
  periurbain_c: {
    biome: 'periurbain_usine', title: 'Périurbain — sortie vers les champs, Mont-Blanc au fond',
    scene: 'Exit of the industrial zone toward the fields: a farm shed and silo, a rural stone house with the campaign office, then open cattle pasture. Keep everything LOW on the right so the giant snowy mountain of the distant layer is visible. No Haussmann.',
    elements: [
      bas(0, 120, 100, 'palette', 'end of industrial fence, stacked pallets'),
      bat(120, 330, 360, 'hangar', 'pignon', 1, 'low agricultural shed'),
      objet(390, 90, 640, 'silo', 'metal grain silo'),
      bat(560, 420, 430, 'pierre', 'tuiles', 2, 'low rural stone house with wooden shutters (keeps the mountain visible behind)'),
      site('site:periurbain_c', 768, 'CAMPAIGN OFFICE (permanence) in the ground floor of the stone house'),
      bas(990, 546, 110, 'cloture', 'wooden pasture fence, open meadow'),
      objet(1080, 160, 110, 'foin', 'round hay bales'),
      objet(1290, 180, 150, 'vache', 'one grazing Montbéliarde cow behind the fence, water trough'),
    ],
  },
  campagne_a: {
    biome: 'campagne', title: 'Campagne — ferme maraîchère et ses serres',
    scene: 'Market-gardening farm: glass and plastic greenhouses, neat vegetable rows. The ONLY solid building is the farm barn, whose big door houses a scooter garage. No other houses.',
    elements: [
      bas(0, 100, 100, 'haie', 'field hedge'),
      objet(100, 440, 300, 'serre', 'two glass greenhouses with vegetable rows in front'),
      bat(560, 420, 560, 'bois', 'pignon', 1, 'farm barn, stone base and wooden boards'),
      site('site:campagne_a', 768, 'SCOOTER GARAGE in the barn: big open wooden door, farm scooters and a quad inside', [230, 270], [250, 58]),
      objet(990, 400, 300, 'serre', 'plastic tunnel greenhouse, crates of vegetables, wheelbarrow, water tank'),
      bas(1400, 136, 100, 'haie', 'field hedge'),
    ],
  },
  campagne_b: {
    biome: 'campagne', title: 'Campagne — le village : mairie, clocher, place',
    scene: 'Authentic French village: stone houses with shutters, a café-tabac (red diamond pictogram), the village square with a small war memorial and a pétanque ground, the town hall (mairie) with tricolour flag and clock, and the little church bell tower behind it. Rural scale, red tiles.',
    elements: [
      bas(0, 90, 100, 'muret', 'low dry-stone wall'),
      bat(90, 510, 560, 'pierre', 'tuiles', 2, 'two joined village stone houses, painted shutters'),
      vitrine(100, 170, 'tabac', 'café-tabac with red diamond pictogram, two terrace chairs', 250),
      site('site:campagne_b', 368, 'CAMPAIGN OFFICE (permanence) in a village house ground floor, wooden door and window'),
      place(600, 340, 'village square with a gravel pétanque ground, empty in the middle'),
      objet(610, 60, 330, 'monument', 'small war memorial obelisk at the left edge of the square'),
      bat(950, 380, 600, 'pierre', 'tuiles', 2, 'TOWN HALL (mairie): symmetrical, clock on the pediment, tricolour flag, steps'),
      objet(1260, 110, 960, 'clocher', 'little church bell tower rising behind the town hall'),
      bat(1340, 130, 460, 'pierre', 'tuiles', 2, 'small village house'),
      bas(1470, 66, 100, 'muret', 'low dry-stone wall'),
    ],
  },
  campagne_c: {
    biome: 'campagne', title: 'Campagne — champs de blé et local SO dans un corps de ferme',
    scene: 'Open wheat fields leading to the retirees area. The only building is a solid two-storey converted farmhouse used as security service premises. Wind turbines and a village steeple are far away (other layers).',
    elements: [
      bas(0, 120, 100, 'haie', 'hedge'),
      bas(120, 440, 110, 'ble', 'golden wheat field edge with poppies'),
      objet(270, 190, 200, 'tracteur', 'old red tractor parked at the field edge'),
      bat(560, 420, 560, 'pierre', 'tuiles', 2, 'solid two-storey converted farmhouse = SECURITY SERVICE premises: wide garage door, entrance door, flag'),
      site('site:campagne_c', 768, 'entrance door of the security service farmhouse', [140, 250], [240, 58]),
      bas(990, 546, 110, 'ble', 'wheat field'),
      objet(1150, 160, 110, 'foin', 'hay bales'),
      bas(1400, 136, 120, 'haie', 'hedge toward the retirees houses'),
    ],
  },
  retraites_a: {
    biome: 'retraites', title: 'Retraités — pavillons impeccables et garagiste',
    scene: 'Very tidy middle-class detached houses in the south of France: perfectly clipped hedges and lawns, garden gnomes, terracotta roofs, plus a family car-repair garage. No Haussmann.',
    elements: [
      bas(0, 100, 130, 'haie', 'perfectly clipped hedge'),
      bat(100, 420, 420, 'moderne', 'plat', 1, 'family CAR REPAIR GARAGE: two bays, a car on a lift, stacked tyres, spanner pictogram'),
      bat(560, 420, 480, 'pavillon', 'tuiles', 1, 'neat bungalow with wooden shutters'),
      site('site:retraites_a', 768, 'CAMPAIGN OFFICE (permanence) in the bungalow: glass door, neat lawn, garden gnome'),
      bat(990, 260, 440, 'pavillon', 'tuiles', 1, 'neat bungalow, roller shutters, sprinkler on the lawn'),
      bat(1270, 200, 440, 'pavillon', 'tuiles', 1, 'neat bungalow with a small palm'),
      bas(980, 556, 120, 'haie', 'perfectly clipped low hedges'),
    ],
  },
  retraites_b: {
    biome: 'retraites', title: 'Retraités — centre de station balnéaire, la mer au fond',
    scene: 'Centre of a French seaside resort: low white stucco buildings, terracotta roofs, blue shutters, deep awnings, a beach-goods shop (buoys, inflatable crocodile, beach balls), a pharmacy with a green cross, an open seafront plaza in the middle through which the SEA is visible (distant layers). Absolutely no Haussmann.',
    elements: [
      bas(0, 90, 110, 'muret', 'low white wall with blue railing'),
      bat(90, 510, 560, 'stuc', 'tuiles', 2, 'white stucco seaside building, blue shutters, balcony'),
      vitrine(100, 170, 'plage', 'beach shop: inflatable crocodile, buoys, beach balls, postcards', 260),
      site('site:retraites_b', 368, 'CONSERVATIVE LOCAL NEWSPAPER office: dark green frame, newspapers in the window', [150, 260], [240, 58]),
      place(600, 340, 'open seafront plaza with a low balustrade at the back, empty in the middle'),
      bat(940, 470, 540, 'stuc', 'tuiles', 2, 'seaside building with a pharmacy (glowing green cross) and an office'),
      vitrine(950, 150, 'pharmacie', 'pharmacy shopfront with green cross', 250),
      site('site:retraites_b:institut_sondage', 1198, 'POLLING INSTITUTE office: sober door, charts in the window', [140, 250], [210, 56]),
      bas(1410, 126, 110, 'jardiniere', 'agave planters'),
    ],
  },
  retraites_c: {
    biome: 'retraites', title: 'Retraités — banlieue bourgeoise type Neuilly',
    scene: 'Wealthy bourgeois suburb like Neuilly-sur-Seine: large 19th-century villas in millstone and brick, slate roofs, wrought-iron gates, gravel paths, topiaries. Wealthier as we approach the rich Paris districts. Detached villas, not a continuous Haussmann facade.',
    elements: [
      bas(0, 100, 130, 'haie', 'tall clipped hedge'),
      bat(100, 430, 640, 'meuliere', 'mansarde', 2, 'large millstone bourgeois villa, slate roof, bow window'),
      bat(560, 420, 560, 'villa', 'mansarde', 2, 'villa side wing'),
      site('site:retraites_c', 768, 'CAMPAIGN OFFICE (permanence) in the villa side wing: elegant double door, topiaries'),
      bas(980, 150, 260, 'grille', 'tall wrought-iron gate between stone pillars'),
      bat(1130, 340, 680, 'villa', 'mansarde', 3, 'grand brick-and-stone villa behind a front garden'),
      bas(1470, 66, 130, 'haie', 'tall clipped hedge'),
    ],
  },
  riches_a: {
    biome: 'quartiers_riches', title: 'Quartiers riches — 16e, rédaction nationale et beau parc',
    scene: 'Paris 16th arrondissement: grand Haussmann buildings, calm and wealthy. A national mainstream newsroom (TV/radio) inserted in a refined ground floor. On the right, the gilded gates of a beautiful park.',
    elements: [
      bas(0, 90, 120, 'haie', 'clipped box hedge'),
      bat(90, 470, 940, 'haussmann', 'mansarde', 5, 'grand Haussmann building, carved stone, continuous balcony'),
      bat(560, 420, 900, 'haussmann', 'mansarde', 5, 'Haussmann building with satellite dishes on the roof'),
      site('site:riches_a', 768, 'NATIONAL NEWSROOM (mainstream TV/radio): wide glass entrance, screens and studio lights inside', [180, 270], [260, 60]),
      bas(990, 480, 300, 'grille', 'gilded wrought-iron park gates between stone pillars; park paths behind'),
      bas(1470, 66, 120, 'haie', 'clipped box hedge'),
      arbre(1150, 280, 2), arbre(1400, 260, 2),
    ],
  },
  riches_b: {
    biome: 'quartiers_riches', title: 'Quartiers riches — avenue touristique, vue sur la tour Eiffel',
    scene: 'Elegant tourist avenue: Haussmann buildings with luxury boutiques, a green Parisian newspaper kiosk, café terrace. The square in the middle opens the view to the Eiffel Tower (distant layer, do not paint it).',
    elements: [
      bas(0, 90, 120, 'jardiniere', 'stone planters'),
      bat(90, 510, 940, 'haussmann', 'mansarde', 5, 'Haussmann building, gilded details'),
      vitrine(100, 170, 'luxe', 'luxury boutique window with a handbag pictogram', 260),
      site('site:riches_b', 368, 'CAMPAIGN OFFICE (permanence): dark blue elegant frame, brass handles'),
      place(600, 340, 'elegant square with a stone balustrade at the back, empty in the middle'),
      objet(950, 110, 300, 'kiosque', 'green Parisian newspaper kiosk'),
      bat(1060, 410, 920, 'haussmann', 'mansarde', 5, 'Haussmann building with luxury boutiques'),
      bas(1470, 66, 120, 'jardiniere', 'stone planters'),
    ],
  },
  riches_c: {
    biome: 'quartiers_riches', title: 'Quartiers riches — quartier d’affaires, La Défense au fond',
    scene: 'Business district edge: Haussmann buildings mixed with restrained contemporary glass entrances; a private bank, an administrative cabinet, a polling institute. La Défense towers are in the distant layer. Toward the right, a garden passage back to Paris 19e.',
    elements: [
      bas(0, 90, 120, 'haie', 'clipped hedge'),
      bat(90, 420, 900, 'haussmann', 'mansarde', 5, 'Haussmann building with a private bank (pictogram) on the ground floor'),
      arbre(540, 240, 2),
      bat(580, 380, 860, 'haussmann', 'mansarde', 5, 'Haussmann building with a modern glass ground floor'),
      site('site:riches_c', 768, 'ADMINISTRATIVE CABINET office: glass revolving door, brass plaque, marble'),
      bat(1000, 390, 820, 'moderne', 'plat', 4, 'restrained contemporary office building'),
      site('site:riches_c:institut_sondage', 1183, 'POLLING INSTITUTE office in the office building ground floor', [150, 250], [220, 56]),
      bas(1400, 136, 110, 'grille', 'low garden railing leading to a small urban garden'),
    ],
  },
};

/** Places de meeting : toujours au centre de la sous-zone B (le jeu dessine l'estrade). */
export const MEETINGS = ['paris_b', 'banlieue_b', 'periurbain_b', 'campagne_b', 'retraites_b', 'riches_b'];

/**
 * Plans intermédiaire et lointain, un par biome. Les tiers de l'image correspondent aux sous-zones A, B et C :
 * un repère placé au centre d'un tiers passe au centre de l'écran quand le joueur est au centre de la sous-zone.
 */
const relief = (points, color, desc) => ({ t: 'relief', points, color, desc });
const repere = (kind, x, w, h, desc) => ({ t: 'repere', kind, x, w, h, desc });
const groupe = (x, w, h, mat, desc, count = 4) => ({ t: 'groupe', x, w, h, mat, count, desc });

export const MIDDLES = {
  paris_19e: { title: 'Paris 19e — butte, toits de zinc, canal', ground: '#a3ab88', elements: [
    relief([[0, 1000], [110, 900], [260, 760], [420, 790], [600, 1000]], '#8fae74', 'green hill park with paths and terraces (Buttes-Chaumont)'),
    groupe(70, 430, 330, 'haussmann', 'Haussmann rooftops stepping up the hill', 5),
    groupe(540, 470, 300, 'haussmann', 'zinc roofs, chimney pots and market awnings', 6),
    relief([[1030, 1000], [1120, 935], [1440, 930], [1536, 1000]], '#9dbb7c', 'wide open green canal bank with low walls: breathing space before the suburbs'),
    repere('canal', 1060, 380, 180, 'Canal Saint-Martin with lock gates and a second green footbridge'),
  ] },
  banlieue: { title: 'Banlieue — barres, basilique, cités basses', ground: '#a8a792', elements: [
    groupe(60, 430, 480, 'tour', 'more concrete tower blocks and long housing bars', 4),
    repere('basilique_st_denis', 610, 320, 470, 'Gothic basilica of Saint-Denis (one bell tower) above the rooftops'),
    groupe(520, 480, 260, 'beton', 'plain 4-storey housing blocks', 5),
    groupe(1040, 400, 240, 'beton', 'LOWER and WIDER housing estates', 3),
    repere('caravanes', 1320, 150, 90, 'small travellers camp: caravans, washing line'),
  ] },
  periurbain_usine: { title: 'Périurbain — hangars, jardins ouvriers, prés', ground: '#9cae74', elements: [
    groupe(60, 440, 300, 'usine', 'factory halls, sawtooth roofs, a second chimney, grassy embankments', 4),
    repere('jardins_ouvriers', 70, 370, 70, 'allotment gardens with small sheds'),
    groupe(530, 470, 240, 'hangar', 'craft-zone sheds, warehouses, an electricity pylon', 4),
    relief([[990, 1000], [1150, 900], [1340, 830], [1440, 880], [1536, 1000]], '#94b06a', 'meadows rising toward the mountains, first cattle farms'),
    groupe(1180, 240, 180, 'pierre', 'farmhouse and barn', 2),
  ] },
  campagne: { title: 'Campagne — bocage, toits du village, éoliennes', ground: '#a9bd72', elements: [
    relief([[0, 1000], [120, 900], [500, 810], [1000, 850], [1380, 820], [1536, 1000]], '#a6bf6f', 'patchwork of fields and hedgerows (bocage)'),
    repere('ferme', 120, 300, 180, 'distant farm with barns'),
    groupe(560, 420, 220, 'pierre', 'village roofs with red tiles', 5),
    repere('eoliennes', 1080, 400, 500, 'a row of wind turbines on the hill (the wind farm)'),
  ] },
  retraites: { title: 'Retraités — vergers, promenade de bord de mer, villas', ground: '#a3b879', elements: [
    relief([[0, 1000], [90, 880], [300, 720], [460, 790], [600, 1000]], '#7fa35f', 'wooded hills and orchards (vergers)'),
    groupe(70, 410, 200, 'pavillon', 'small terracotta-roof bungalows among trees', 4),
    repere('plage', 560, 440, 150, 'seafront promenade with striped beach huts, sand and a strip of blue sea; keep it LOW so the sea horizon behind is visible'),
    groupe(1040, 440, 320, 'villa', 'bourgeois villas among big trees', 3),
  ] },
  quartiers_riches: { title: 'Quartiers riches — grand parc, Seine et Trocadéro, bureaux', ground: '#96ad76', elements: [
    relief([[0, 1000], [90, 790], [300, 730], [480, 760], [600, 1000]], '#6f9b58', 'big park with tall trees (Bois de Boulogne feeling)'),
    groupe(70, 430, 340, 'haussmann', 'grand Haussmann rooftops', 4),
    repere('trocadero', 560, 420, 200, 'Trocadéro-like terraces and the Seine with a stone bridge'),
    groupe(1040, 440, 420, 'moderne', 'office buildings getting taller toward the business district', 4),
  ] },
};

export const FARS = {
  paris_19e: { title: 'Paris — Montmartre et le Sacré-Cœur', ground: '#b4bec2', elements: [
    relief([[0, 1000], [220, 960], [520, 900], [690, 720], [768, 650], [846, 720], [1020, 890], [1320, 960], [1536, 1000]], '#a9b9c4', 'Montmartre hill covered with tiny Paris roofs'),
    repere('sacre_coeur', 640, 260, 400, 'Sacré-Cœur basilica on top of Montmartre, white domes'),
  ] },
  banlieue: { title: 'Banlieue — Stade de France et grues', ground: '#b5b9b8', elements: [
    relief([[0, 1000], [140, 972], [1396, 972], [1536, 1000]], '#aeb6bd', 'flat suburban skyline haze'),
    repere('stade', 150, 360, 150, 'Stade de France (big white ring roof)'),
    groupe(560, 500, 330, 'tour', 'distant tower blocks', 7),
    repere('grues', 1150, 300, 420, 'construction cranes (Grand Paris works)'),
  ] },
  periurbain_usine: { title: 'Périurbain — vallée industrielle et Mont-Blanc', ground: '#aab5b2', elements: [
    relief([[0, 1000], [300, 960], [620, 900], [900, 770], [1060, 540], [1240, 90], [1330, 300], [1420, 560], [1490, 850], [1536, 1000]], '#8d9fb0', 'foothills rising to the RIGHT into the highest snowy peak of the whole game (Mont-Blanc like), sloping back down before the right edge'),
    repere('neige', 1080, 330, 910, 'snow cap and glaciers on the summit'),
    repere('cheminees', 150, 260, 300, 'distant factory chimneys with thin smoke'),
  ] },
  campagne: { title: 'Campagne — collines et village au clocher', ground: '#b3bea0', elements: [
    relief([[0, 1000], [180, 930], [400, 860], [800, 900], [1200, 840], [1400, 920], [1536, 1000]], '#9fb482', 'gentle rolling hills, patchwork fields, NOT mountains'),
    repere('village_clocher', 1120, 240, 300, 'tiny distant village with a church steeple'),
    repere('eoliennes', 760, 260, 330, 'a few thin wind turbines'),
  ] },
  retraites: { title: 'Retraités — la mer à l’horizon', ground: '#adbcae', elements: [
    repere('mer', 440, 660, 120, 'OPEN SEA: flat blue band up to the horizon, sailboats, a lighthouse on a rock; both ends hidden behind the coasts'),
    relief([[0, 1000], [70, 900], [300, 730], [440, 850], [560, 1000]], '#8aa27a', 'wooded headland with orchards on the left'),
    relief([[980, 1000], [1080, 880], [1300, 780], [1460, 900], [1536, 1000]], '#96a986', 'coastline and green cape on the right'),
  ] },
  quartiers_riches: { title: 'Quartiers riches — Invalides, tour Eiffel, La Défense', ground: '#b7bfc4', elements: [
    relief([[0, 1000], [130, 960], [1406, 960], [1536, 1000]], '#b3bec7', 'low Paris roofs haze'),
    repere('invalides', 180, 200, 330, 'golden dome of Les Invalides'),
    repere('tour_eiffel', 690, 160, 820, 'the Eiffel Tower, central landmark'),
    repere('defense', 1080, 400, 560, 'La Défense towers and the Grande Arche'),
  ] },
};

export const BIOME_ART = { paris_19e: 'bobo', banlieue: 'banlieue', periurbain_usine: 'periurbain', campagne: 'campagne', retraites: 'retraites', quartiers_riches: 'riches' };

/** Toutes les images à produire, dans l'ordre conseillé. */
export function allDecorImages() {
  return [
    ...Object.entries(STREETS).map(([id, spec]) => ({ layer: 'street', id, file: `street-${id}.png`, spec })),
    ...Object.entries(MIDDLES).map(([id, spec]) => ({ layer: 'middle', id, file: `middle-${BIOME_ART[id]}.png`, spec })),
    ...Object.entries(FARS).map(([id, spec]) => ({ layer: 'far', id, file: `far-${BIOME_ART[id]}.png`, spec })),
  ];
}

/** Position cible (fraction de sous-zone) de chaque porte de la maquette, par identifiant de site. */
export function blockoutSiteTargets() {
  const targets = {};
  for (const [subzone, spec] of Object.entries(STREETS))
    for (const element of spec.elements) if (element.t === 'site') targets[element.site] = { subzone, x_ratio: element.x / CANVAS.width };
  return targets;
}

/** Rectangle de l'enseigne crème d'un site dans l'image de rue [gauche, haut, largeur, hauteur]. */
export function signRect(element) {
  const [, doorH] = element.door, [w, h] = element.sign;
  return [element.x - w / 2, STREET_BASELINE - doorH - 34 - h, w, h];
}
