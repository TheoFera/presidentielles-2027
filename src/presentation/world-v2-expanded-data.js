/** Compléments peints dans le style world-v2. Les originaux restent disponibles comme références. */
export const expandedWorldAssets = {
  'world2-market-street': { file: new URL('../../assets/generated/world-v2/banlieue-b-rue-v3.png', import.meta.url).href },
  'world2-market-background': { file: new URL('../../assets/generated/world-v2/banlieue-b-fond-v3.png', import.meta.url).href },
  'world2-paris': { file: new URL('../../assets/generated/world-v2/expanded-paris.png', import.meta.url).href },
  'world2-banlieue': { file: new URL('../../assets/generated/world-v2/expanded-banlieue.png', import.meta.url).href },
  'world2-periurbain': { file: new URL('../../assets/generated/world-v2/expanded-periurbain.png', import.meta.url).href },
  'world2-campagne': { file: new URL('../../assets/generated/world-v2/expanded-campagne.png', import.meta.url).href },
  'world2-retraites': { file: new URL('../../assets/generated/world-v2/expanded-retraites.png', import.meta.url).href },
  'world2-riches': { file: new URL('../../assets/generated/world-v2/expanded-riches.png', import.meta.url).href },
  'world2-landscapes': { file: new URL('../../assets/generated/world-v2/expanded-landscapes.png', import.meta.url).href },
  'world2-nature': { file: new URL('../../assets/generated/world-v2/expanded-nature.png', import.meta.url).href },
};
export const expandedWorldAssetIds = () => Object.keys(expandedWorldAssets);

// Repères dans les planches de 1254 px. Les découpes suivent leurs gouttières réelles.
export const EXPANDED_ATLASES = {
  landscapes: [[0,336,[0,315,627,942,1254]],[336,644,[0,315,627,942,1254]],[644,941,[0,315,627,942,1254]]],
  nature: [[0,286,[0,313.5,627,940.5,1254]],[286,572,[0,313.5,627,940.5,1254]],[572,836,[0,313.5,627,940.5,1254]]],
  paris: [[0,460,[0,359,655,949,1254]],[460,900,[0,356,670,978,1254]],[900,1254,[0,350,648,949,1254]]],
  banlieue: [[0,532,[0,340,655,939,1254]],[532,912,[0,350,623,947,1254]],[912,1254,[0,336,632,938,1254]]],
  periurbain: [[0,470,[0,322,640,945,1254]],[470,905,[0,321,640,944,1254]],[905,1254,[0,388,605,960,1254]]],
  campagne: [[0,445,[0,341,654,952,1254]],[445,837,[0,345,688,952,1254]],[837,1254,[0,330,645,953,1254]]],
  retraites: [[0,509,[0,313,632,939,1254]],[509,922,[0,280,638,940,1254]],[922,1254,[0,316,631,950,1254]]],
  riches: [[0,490,[0,331,626,919,1254]],[490,872,[0,325,650,956,1254]],[872,1254,[0,332,656,955,1254]]],
};

// [planche, cellule, porte x, pied de porte y, hauteur de porte, panneau x/y/l/h].
// La porte, et non le centre de l'image, est alignée sur le vrai site de la simulation.
export const EXPANDED_SITES = {
  'site:paris_a': ['paris',1,486,431,103,[449,299,92,21]],
  'site:paris_b': ['paris',2,802,432,103,[716,303,152,21]],
  'site:paris_c': ['paris',3,1090,432,99,[1011,307,123,21]],
  'site:paris_c:institut_sondage': ['paris',4,211,838,96,[175,713,74,20]],
  'site:banlieue_a': ['banlieue',1,500,509,77,[441,387,108,18]],
  'site:banlieue_b': ['banlieue',2,767,508,90,[710,382,112,17]],
  'site:banlieue_c': ['banlieue',3,1091,508,90,[1037,386,102,19]],
  'site:periurbain_a': ['periurbain',1,477,435,81,[417,320,119,21]],
  'site:periurbain_b': ['periurbain',2,786,441,123,[716,262,141,28]],
  'site:periurbain_c': ['periurbain',3,1102,435,83,[1041,311,99,22]],
  'site:campagne_a': ['campagne',1,526,402,122,[469,239,112,22]],
  'site:campagne_b': ['campagne',2,795,396,95,[750,274,87,20]],
  'site:campagne_c': ['campagne',3,1097,390,93,[1067,246,70,16]],
  'site:retraites_a': ['retraites',1,497,482,96,[448,336,107,25]],
  'site:retraites_b': ['retraites',2,799,481,98,[726,337,148,28]],
  'site:retraites_c': ['retraites',3,1078,482,101,[1047,348,66,19]],
  'site:retraites_b:institut_sondage': ['retraites',4,139,901,92,[53,753,166,25]],
  'site:riches_a': ['riches',1,477,457,83,[424,342,114,21]],
  'site:riches_b': ['riches',2,781,461,80,[749,351,73,20]],
  'site:riches_c': ['riches',3,1078,460,94,[1044,312,70,21]],
  'site:riches_c:institut_sondage': ['riches',4,164,835,91,[81,710,160,22]],
};

// [plan, cellule, position dans la sous-zone, largeur maximale en unités, hauteur en personnages].
// Les arrière-plans restent derrière les places B ; aucun local ne dépend d'un dessin de décor.
export const EXPANDED_ZONES = {
  paris_a: [['street',0,.20,9,5],['back',5,.43,8,3.7]],
  paris_b: [['street',5,.83,8,3.7],['back',6,.5,10,1.9],['back',7,.68,3,2.5],['far',8,.5,19,3.6]],
  paris_c: [['back',9,.45,13,2.5],['back',5,.5,7,3]],
  banlieue_a: [['street',0,.84,11,15],['back',9,.6,17,3]],
  banlieue_b: [['street',5,.83,7,3.9],['back',6,.5,12,2.2],['far',8,.5,17,4]],
  banlieue_c: [['street',4,.15,6,3.1],['street',4,.8,6,3.1],['far',7,.58,15,3.3]],
  periurbain_a: [['street',0,.18,6,3.2],['street',4,.86,6,3.2],['mid',8,.5,27,3.8]],
  periurbain_b: [['street',0,.83,6,3.2],['back',6,.5,9,1.7],['mid',5,.8,17,3.4]],
  periurbain_c: [['back',7,.8,12,2.3],['mid',9,.2,14,2.8],['horizon',10,.52,48,6.4]],
  campagne_a: [['street',0,.3,16,3.8],['mid',10,.5,26,3.2]],
  campagne_b: [['street',4,.85,6,3.2],['back',5,.68,6,3.7],['back',6,.5,2.8,1.5],['far',8,.5,24,3.8]],
  campagne_c: [['back',7,.7,17,2.2],['far',9,.5,27,3.8],['mid',10,.45,27,3]],
  retraites_a: [['street',0,.18,6,3.7],['back',7,.4,5,2.3],['mid',10,.3,24,3.2]],
  retraites_b: [['street',5,.07,4,3.2],['back',5,.91,4,3.2],['horizon',8,.3,19,1.65],['horizon',8,.75,19,1.65],['far',9,.75,16,1.6]],
  retraites_c: [['street',6,.23,6.5,4.2],['mid',11,.45,26,4]],
  riches_a: [['street',0,.18,7,5],['street',5,.87,6.5,4.5],['far',8,.63,16,4.2]],
  riches_b: [['street',5,.85,7,4.5],['back',6,.66,3,2],['far',8,.5,16,4.8]],
  riches_c: [['street',7,.85,6,4.4],['mid',5,.46,6,3],['far',9,.6,24,4.8]],
};
export const EXPANDED_ART = { paris_19e:'paris',banlieue:'banlieue',periurbain_usine:'periurbain',campagne:'campagne',retraites:'retraites',quartiers_riches:'riches' };
export const EXPANDED_LANDSCAPES = {
  'paris:8':0,'paris:10':8,'banlieue:8':1,'banlieue:10':8,'banlieue:11':9,
  'periurbain:10':2,'periurbain:11':10,'campagne:9':3,'campagne:10':10,
  'retraites:8':4,'retraites:9':5,'retraites:11':11,'riches:8':6,'riches:9':7,'riches:10':11,
};
// Chaque raccord est un paysage à part entière, centré sur la frontière et peint avec les deux territoires.
export const EXPANDED_TRANSITIONS = [
  ['paris','banlieue_a',10,22,3.6], ['banlieue','periurbain_a',11,20,3],
  ['periurbain','campagne_a',11,26,4], ['campagne','retraites_a',11,20,3.6],
  ['retraites','riches_a',11,22,4], ['paris','paris_a',11,20,3.7],
];
export const EXPANDED_PLANES = { horizon:{speed:.2,base:124},far:{speed:.3,base:101},mid:{speed:.5,base:62},back:{speed:.78,base:27},street:{speed:1,base:12} };
