export const minorUltimateAssets = {
  'ultimate-minor-accessoires': { file: new URL('../../../assets/images/pouvoirs/accessoires-ultimes-mineurs-v2.png', import.meta.url).href },
  'ultimate-minor-arthaud-outils': { file: new URL('../../../assets/images/pouvoirs/arthaud-outils-v1.png', import.meta.url).href },
  'ultimate-minor-glucksmann-appel': { file: new URL('../../../assets/images/pouvoirs/glucksmann-appel-v3.png', import.meta.url).href },
  'ultimate-minor-attal-lancer': { file: new URL('../../../assets/images/pouvoirs/attal-lancer-cartable-v1.png', import.meta.url).href },
  'ultimate-minor-roussel-lancer': { file: new URL('../../../assets/images/pouvoirs/roussel-lancer-rattraper-v1.png', import.meta.url).href },
  'ultimate-minor-bombardier': { file: new URL('../../../assets/images/pouvoirs/glucksmann-bombardier-v1.png', import.meta.url).href },
  'ultimate-minor-bombe': { file: new URL('../../../assets/images/pouvoirs/glucksmann-bombe-democratie-v1.png', import.meta.url).href },
  'ultimate-minor-barriere': { file: new URL('../../../assets/images/pouvoirs/retailleau-barriere-v1.png', import.meta.url).href },
};

// Rectangles mesurés dans les PNG originaux, conservés sans retouche.
export const minorUltimateAtlases = {
  plane: { sprite: 'ultimate-minor-bombardier', frames: [[11,11,2153,696,1087.5,707]] },
  bomb: { sprite: 'ultimate-minor-bombe', frames: [[542,12,452,1000,768,1012]] },
  barrier: { sprite: 'ultimate-minor-barriere', frames: [[187,11,660,1482,517,1493]] },
  props: { sprite: 'ultimate-minor-accessoires', frames: [[45,142,422,292,318.5,434],[486,128,629,381,943,509],[1184,46,308,497,1339,543],[73,609,439,359,203,968],[689,583,334,392,721.5,975],[1148,582,315,395,1200.5,977]] },
  tools: { sprite: 'ultimate-minor-arthaud-outils', referenceHeight: 377, frames: [[49,50,333,377,192.5,427],[468,53,335,374,617.5,427],[907,70,523,357,1168,427],[1396,54,304,373,1542,427],[36,441,354,420,187,861],[461,535,379,326,609,861],[927,560,400,298,960.5,858],[1450,497,285,310,1550.5,807]] },
  phone: { sprite: 'ultimate-minor-glucksmann-appel', referenceHeight: 685, frames: [[190,25,298,685,336,710],[693,25,293,685,834,710],[1191,25,292,685,1332,710],[1690,25,292,685,1831,710]] },
  satchelThrow: { sprite: 'ultimate-minor-attal-lancer', frames: [[146,21,235,509,262.5,530],[569,56,366,473,762.5,529],[1072,56,364,473,1254.5,529],[88,542,507,458,259.5,1000],[594,543,426,454,764,997],[1089,542,349,452,1262.5,994]],
    hands: [null,[598,338],[1360,380],[548,638],null,null] },
  sausageThrow: { sprite: 'ultimate-minor-roussel-lancer', frames: [[47,31,307,418,200,449],[483,39,336,409,665,448],[915,39,311,410,1070,449],[1323,38,433,411,1486,449],[31,468,324,403,192.5,871],[479,468,390,403,641,871],[917,468,331,405,1082,873],[1376,467,315,406,1533,873]],
    hands: [null,[508,250],[1190,283],[1702,176],null,[825,643],[1189,650],[1655,650]] },
};
