// Planche validée, conservée sans retouche. Les rectangles excluent les légendes.
export const mapWheelAtlas = {
  file: new URL('../../../assets/images/interface/roue-quartiers-planche.png', import.meta.url),
  width: 1536,
  height: 1024,
};

// Coordonnées en pixels : gauche, haut, largeur, hauteur.
// Les dessins restent de face ici ; map-wheel.js les tourne vers le centre.
export const mapWheelIcons = {
  paris_a: [34, 157, 232, 188],
  paris_b: [35, 401, 221, 259],
  paris_c: [26, 760, 238, 173],
  banlieue_a: [305, 114, 189, 219],
  banlieue_b: [294, 410, 198, 229],
  banlieue_c: [289, 760, 214, 170],
  periurbain_a: [528, 137, 214, 196],
  periurbain_b: [527, 405, 232, 243],
  periurbain_c: [528, 757, 239, 173],
  campagne_a: [779, 180, 228, 169],
  campagne_b: [778, 429, 224, 211],
  campagne_c: [782, 716, 225, 216],
  retraites_a: [1041, 132, 216, 200],
  retraites_b: [1033, 433, 231, 218],
  retraites_c: [1028, 743, 240, 188],
  riches_a: [1306, 112, 189, 221],
  riches_b: [1304, 395, 188, 261],
  riches_c: [1291, 754, 223, 177],
};
