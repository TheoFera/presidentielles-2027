// Compositions verticales sur fond transparent, toutes dessinées debout.
export const mapWheelAtlas = {
  file: new URL('../../../assets/images/interface/roue-quartiers-verticale-v2.png', import.meta.url),
  width: 1536,
  height: 1024,
};

// Coordonnées en pixels : gauche, haut, largeur, hauteur.
// Les dessins restent de face ici ; map-wheel.js les tourne vers le centre.
export const mapWheelIcons = {
  paris_a: [16, 25, 224, 291],
  paris_b: [16, 372, 224, 278],
  paris_c: [34, 723, 188, 261],
  banlieue_a: [301, 29, 165, 282],
  banlieue_b: [293, 372, 182, 278],
  banlieue_c: [272, 730, 224, 246],
  periurbain_a: [554, 40, 171, 260],
  periurbain_b: [558, 378, 163, 266],
  periurbain_c: [551, 719, 178, 269],
  campagne_a: [784, 34, 224, 272],
  campagne_b: [784, 383, 224, 256],
  campagne_c: [802, 704, 187, 299],
  retraites_a: [1040, 27, 224, 286],
  retraites_b: [1040, 372, 224, 279],
  retraites_c: [1040, 720, 224, 267],
  riches_a: [1322, 33, 172, 274],
  riches_b: [1313, 369, 190, 285],
  riches_c: [1306, 704, 204, 298],
};

// Demi-largeur de la silhouette dans cinq bandes, du haut vers le bas.
// Mesures préparées hors du jeu : elles permettent de garder une marge sans
// couper les dessins ni relire leurs pixels pendant une partie.
export const mapWheelIconWidths = {
  paris_a: [98.0, 103.0, 112.0, 110.0, 111.0],
  paris_b: [57.0, 81.0, 107.0, 111.0, 112.0],
  paris_c: [93, 93, 93, 89, 85],
  banlieue_a: [69.5, 74.5, 74.5, 80.5, 80.5],
  banlieue_b: [45, 52, 82, 90, 81],
  banlieue_c: [96.0, 108.0, 111.0, 110.0, 109.0],
  periurbain_a: [76.5, 78.5, 80.5, 84.5, 84.5],
  periurbain_b: [72.5, 76.5, 71.5, 80.5, 80.5],
  periurbain_c: [52, 82, 88, 86, 84],
  campagne_a: [96.0, 107.0, 107.0, 111.0, 111.0],
  campagne_b: [92.0, 104.0, 112.0, 108.0, 109.0],
  campagne_c: [64.5, 87.5, 91.5, 83.5, 91.5],
  retraites_a: [93.0, 111.0, 110.0, 112.0, 111.0],
  retraites_b: [94.0, 112.0, 111.0, 112.0, 111.0],
  retraites_c: [99.0, 105.0, 102.0, 111.0, 111.0],
  riches_a: [73, 85, 76, 84, 84],
  riches_b: [18, 22, 38, 62, 94],
  riches_c: [77, 77, 89, 98, 101],
};
