export const minorUltimateAssets = {
  'ultimate-minor-accessoires': { file: new URL('../../../assets/images/pouvoirs/accessoires-ultimes-mineurs-v2.png', import.meta.url).href },
  'ultimate-minor-arthaud-outils': { file: new URL('../../../assets/images/pouvoirs/arthaud-outils-v1.png', import.meta.url).href },
  'ultimate-minor-glucksmann-appel': { file: new URL('../../../assets/images/pouvoirs/glucksmann-appel-v2.png', import.meta.url).href },
};

// Rectangles mesurés dans les PNG originaux, conservés sans retouche.
export const minorUltimateAtlases = {
  props: { sprite: 'ultimate-minor-accessoires', frames: [[45,142,422,292,318.5,434],[486,128,629,381,943,509],[1184,46,308,497,1339,543],[73,609,439,359,203,968],[689,583,334,392,721.5,975],[1148,582,315,395,1200.5,977]] },
  tools: { sprite: 'ultimate-minor-arthaud-outils', referenceHeight: 377, frames: [[49,50,333,377,192.5,427],[468,53,335,374,617.5,427],[907,70,523,357,1168,427],[1396,54,304,373,1542,427],[36,441,354,420,187,861],[461,535,379,326,609,861],[927,560,400,298,960.5,858],[1450,497,285,310,1550.5,807]] },
  phone: { sprite: 'ultimate-minor-glucksmann-appel', referenceHeight: 686, frames: [[360,25,305,686,515,711],[882,25,368,686,1081,711],[1488,25,435,686,1640.5,711]] },
};
