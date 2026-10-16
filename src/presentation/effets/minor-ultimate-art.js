export const minorUltimateAssets = {
  'ultimate-minor-accessoires': { file: new URL('../../../assets/images/pouvoirs/accessoires-ultimes-mineurs-v2.png', import.meta.url).href },
  'ultimate-minor-arthaud-outils': { file: new URL('../../../assets/images/pouvoirs/arthaud-outils-v1.png', import.meta.url).href },
  'ultimate-minor-glucksmann-appel': { file: new URL('../../../assets/images/pouvoirs/glucksmann-appel-v4.png', import.meta.url).href },
  'ultimate-minor-attal-lancer': { file: new URL('../../../assets/images/pouvoirs/attal-lancer-cartable-v2.png', import.meta.url).href },
  'ultimate-minor-roussel-lancer': { file: new URL('../../../assets/images/pouvoirs/roussel-lancer-rattraper-v3.png', import.meta.url).href },
  'ultimate-minor-saucisse': { file: new URL('../../../assets/images/pouvoirs/roussel-saucisse-nature-v1.png', import.meta.url).href },
  'ultimate-minor-rafale': { file: new URL('../../../assets/images/pouvoirs/glucksmann-rafale-v1.png', import.meta.url).href },
  'ultimate-minor-missile': { file: new URL('../../../assets/images/pouvoirs/glucksmann-missile-democratie-v1.png', import.meta.url).href },
  'ultimate-minor-barriere': { file: new URL('../../../assets/images/pouvoirs/retailleau-barriere-v1.png', import.meta.url).href },
};

// Rectangles mesurés dans les PNG originaux, conservés sans retouche.
export const minorUltimateAtlases = {
  plane: { sprite: 'ultimate-minor-rafale', headingAngle: .22, frames: [[54,14,1697,757,902.5,771]] },
  missile: { sprite: 'ultimate-minor-missile', frames: [[40,118,2100,487,1090,605]] },
  barrier: { sprite: 'ultimate-minor-barriere', frames: [[187,11,660,1482,517,1493]] },
  sausage: { sprite: 'ultimate-minor-saucisse', frames: [[47,239,1443,575,768.5,814]] },
  props: { sprite: 'ultimate-minor-accessoires', frames: [[45,142,422,292,318.5,434],[486,128,629,381,943,509],[1184,46,308,497,1339,543],[73,609,439,359,203,968],[689,583,334,392,721.5,975],[1148,582,315,395,1200.5,977]] },
  tools: { sprite: 'ultimate-minor-arthaud-outils', referenceHeight: 377, frames: [[49,50,333,377,192.5,427],[468,53,335,374,617.5,427],[907,70,523,357,1168,427],[1396,54,304,373,1542,427],[36,441,354,420,187,861],[461,535,379,326,609,861],[927,560,400,298,960.5,858],[1450,497,285,310,1550.5,807]] },
  phone: { sprite: 'ultimate-minor-glucksmann-appel', referenceHeight: 651,
    anatomicalScales: [1,651/654,651/652,651/652],
    frames: [[28,40,489,651,272,691],[569,37,492,654,814.5,691],[1111,39,493,652,1357,691],[1653,39,493,652,1899,691]] },
  satchelThrow: { sprite: 'ultimate-minor-attal-lancer', referenceHeight: 494,
    anatomicalScales: [1,1,494/496,494/487,494/485,494/486],
    frames: [[115,18,294,494,261.5,512],[534,19,379,494,755.5,513],[1129,19,308,496,1282.5,515],[99,522,407,487,254,1009],[608,523,398,485,764,1008],[1151,523,303,486,1302,1009]],
    hands: [null,[563,302],[1348,333],[454,726],null,null] },
  sausageThrow: { sprite: 'ultimate-minor-roussel-lancer', referenceHeight: 409,
    anatomicalScales: [1,409/408,409/406,409/407,409/410,1,409/411,409/410],
    frames: [[76,37,304,409,227.5,446],[476,38,339,408,653.5,446],[937,39,323,406,1098,445],[1375,39,364,407,1536.5,446],[54,456,338,410,222.5,866],[491,457,347,409,659,866],[938,456,333,411,1104,867],[1373,457,329,410,1537,867]],
    hands: [null,[500,174],[1215,240],[1692,220],null,[790,670],[1224,673],[1537,649]] },
};
