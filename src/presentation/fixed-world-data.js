// Panoramas v2 (provisoires) : repères mesurés dans les images ; aucune largeur/hauteur ne se règle séparément.
export const PANORAMA_SCALE = 1.08;
export const fixedWorldArt = {
  paris_19e: { art: 'bobo', aspect: 3, baseline: 0.824 },
  banlieue: { art: 'banlieue', aspect: 2161 / 728, baseline: 0.884 },
  periurbain_usine: { art: 'periurbain', aspect: 3, baseline: 0.834 },
  campagne: { art: 'campagne', aspect: 3, baseline: 0.853 },
  retraites: { art: 'retraites', aspect: 3, baseline: 0.843 },
  quartiers_riches: { art: 'riches', aspect: 3, baseline: 0.835 },
};

/** Enseignes peintes dans les panoramas v2 : [porte x, enseigne x, enseigne y, largeur, hauteur] en fraction du panorama. */
export const V2_FACADES = {
  'site:paris_a': [0.245, 0.245, 0.585, 0.05, 0.031], 'site:paris_b': [0.417, 0.416, 0.607, 0.074, 0.037], 'site:paris_c': [0.728, 0.728, 0.615, 0.051, 0.03],
  'site:banlieue_a': [0.153, 0.121, 0.664, 0.087, 0.034], 'site:banlieue_b': [0.349, 0.346, 0.692, 0.07, 0.03], 'site:banlieue_c': [0.789, 0.824, 0.687, 0.085, 0.034],
  'site:periurbain_a': [0.214, 0.21, 0.614, 0.074, 0.035], 'site:periurbain_b': [0.35, 0.332, 0.553, 0.071, 0.045], 'site:periurbain_c': [0.805, 0.805, 0.646, 0.073, 0.038],
  'site:campagne_a': [0.274, 0.276, 0.661, 0.043, 0.027], 'site:campagne_b': [0.358, 0.367, 0.682, 0.041, 0.025], 'site:campagne_c': [0.765, 0.765, 0.725, 0.025, 0.02],
  'site:retraites_a': [0.239, 0.237, 0.637, 0.057, 0.043], 'site:retraites_b': [0.406, 0.406, 0.645, 0.052, 0.035], 'site:retraites_c': [0.859, 0.859, 0.655, 0.05, 0.025],
  'site:riches_a': [0.205, 0.207, 0.638, 0.067, 0.032], 'site:riches_b': [0.355, 0.35, 0.638, 0.076, 0.03], 'site:riches_c': [0.724, 0.726, 0.645, 0.062, 0.029],
  'site:retraites_b:institut_sondage': [0.648, 0.667, 0.654, 0.044, 0.025],
  'site:riches_c:institut_sondage': [0.829, 0.83, 0.648, 0.052, 0.029],
};
