// Compositions verticales sur fond transparent, toutes dessinées debout.
export const mapWheelAtlas = {
  file: new URL('../../../assets/images/interface/roue-quartiers-verticale-v1.png', import.meta.url),
  width: 1536,
  height: 1024,
};

// Coordonnées en pixels : gauche, haut, largeur, hauteur.
// Les dessins restent de face ici ; map-wheel.js les tourne vers le centre.
export const mapWheelIcons = {
  paris_a: [69, 44, 170, 292],
  paris_b: [62, 360, 183, 283],
  paris_c: [59, 708, 188, 261],
  banlieue_a: [317, 46, 165, 282],
  banlieue_b: [304, 355, 182, 278],
  banlieue_c: [308, 693, 172, 281],
  periurbain_a: [555, 48, 171, 260],
  periurbain_b: [559, 380, 163, 266],
  periurbain_c: [555, 704, 178, 269],
  campagne_a: [803, 69, 166, 267],
  campagne_b: [801, 385, 185, 248],
  campagne_c: [799, 676, 187, 299],
  retraites_a: [1041, 77, 188, 240],
  retraites_b: [1054, 379, 166, 257],
  retraites_c: [1047, 686, 181, 289],
  riches_a: [1307, 54, 172, 274],
  riches_b: [1296, 358, 190, 285],
  riches_c: [1285, 677, 204, 298],
};

// Demi-largeur de la silhouette dans cinq bandes, du haut vers le bas.
// Mesures préparées hors du jeu : elles permettent de garder une marge sans
// couper les dessins ni relire leurs pixels pendant une partie.
export const mapWheelIconWidths = {
  paris_a: [69, 84, 72, 67, 61],
  paris_b: [24.5, 72.5, 87.5, 89.5, 77.5],
  paris_c: [93, 93, 93, 89, 85],
  banlieue_a: [69.5, 74.5, 74.5, 80.5, 80.5],
  banlieue_b: [45, 52, 82, 90, 81],
  banlieue_c: [70, 76, 85, 85, 84],
  periurbain_a: [76.5, 78.5, 80.5, 84.5, 84.5],
  periurbain_b: [72.5, 76.5, 71.5, 80.5, 80.5],
  periurbain_c: [52, 82, 88, 86, 84],
  campagne_a: [75, 82, 82, 79, 74],
  campagne_b: [40.5, 78.5, 79.5, 91.5, 90.5],
  campagne_c: [64.5, 87.5, 91.5, 83.5, 91.5],
  retraites_a: [68, 93, 81, 78, 75],
  retraites_b: [70, 82, 64, 75, 81],
  retraites_c: [73.5, 81.5, 73.5, 89.5, 89.5],
  riches_a: [73, 85, 76, 84, 84],
  riches_b: [18, 22, 38, 62, 94],
  riches_c: [77, 77, 89, 98, 101],
};
