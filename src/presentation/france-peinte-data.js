/** Quatrième décor : éléments peints neufs, composés autour des sites réels. */
export const paintedAssets = {
  'peint-paris': { file: new URL('../../assets/generated/france-peinte/paris.png', import.meta.url).href },
  'peint-banlieue': { file: new URL('../../assets/generated/france-peinte/banlieue.png', import.meta.url).href },
  'peint-periurbain': { file: new URL('../../assets/generated/france-peinte/periurbain.png', import.meta.url).href },
  'peint-campagne': { file: new URL('../../assets/generated/france-peinte/campagne.png', import.meta.url).href },
  'peint-retraites': { file: new URL('../../assets/generated/france-peinte/retraites.png', import.meta.url).href },
  'peint-riches': { file: new URL('../../assets/generated/france-peinte/riches.png', import.meta.url).href },
  'peint-nature': { file: new URL('../../assets/generated/france-peinte/nature.png', import.meta.url).href },
  'peint-basilique': { file: new URL('../../assets/generated/france-peinte/basilique.png', import.meta.url).href },
  'peint-montblanc': { file: new URL('../../assets/generated/france-peinte/montblanc.png', import.meta.url).href },
  'peint-mer': { file: new URL('../../assets/generated/france-peinte/mer.png', import.meta.url).href },
  'peint-tour': { file: new URL('../../assets/generated/france-peinte/tour.png', import.meta.url).href },
  'peint-hiver': { file: new URL('../../assets/generated/france-peinte/hiver.png', import.meta.url).href },
};
export const paintedAssetIds = () => Object.keys(paintedAssets);
export const PAINTED_PLANES = Object.freeze({
  horizon: { speed: 0.2, base: 118, haze: 0.27 },
  far: { speed: 0.3, base: 92, haze: 0.22 },
  mid: { speed: 0.5, base: 58, haze: 0.12 },
  back: { speed: 0.72, base: 30, haze: 0.05 },
  street: { speed: 1, base: 12, haze: 0 },
});

// N° de cellule (0 à 11) dans chaque planche. Les portes ne sont jamais couvertes par des arbres.
export const PAINTED_SITES = {
  'site:paris_a': ['paris', 2, 5.3, 340],
  'site:paris_b': ['paris', 3, 4.6, 330],
  'site:paris_c': ['paris', 2, 4.8, 340],
  'site:paris_c:institut_sondage': ['paris', 4, 6.6, 320],
  'site:banlieue_a': ['tour', 0, 9.8, 1280],
  'site:banlieue_b': ['banlieue', 3, 5, 350],
  'site:banlieue_c': ['banlieue', 4, 4.4, 210],
  'site:periurbain_a': ['periurbain', 3, 4.2, 240],
  'site:periurbain_b': ['periurbain', 4, 4.6, 220],
  'site:periurbain_c': ['periurbain', 5, 4.4, 250],
  'site:campagne_a': ['campagne', 1, 4.8, 240],
  'site:campagne_b': ['campagne', 2, 4.2, 250],
  'site:campagne_c': ['campagne', 3, 3.8, 210],
  'site:retraites_a': ['retraites', 2, 4.4, 250],
  'site:retraites_b': ['retraites', 3, 5, 350],
  'site:retraites_b:institut_sondage': ['retraites', 4, 4.2, 300],
  'site:retraites_c': ['retraites', 5, 4.6, 300],
  'site:riches_a': ['riches', 1, 5.4, 350],
  'site:riches_b': ['riches', 2, 4.6, 360],
  'site:riches_c': ['riches', 3, 4.6, 330],
  'site:riches_c:institut_sondage': ['riches', 4, 4.2, 330],
};

// [plan, planche, cellule, position dans la sous-zone, largeur en unités, hauteur de référence].
// Les marchés des sous-zones B sont derrière la place, qui reste libre pour le meeting.
export const PAINTED_ZONES = {
  paris_a: [['street','paris',0,.23,6,350], ['back','paris',6,.47,5,300], ['mid','paris',11,.45,18,170]],
  paris_b: [['street','paris',1,.83,7,350], ['back','paris',9,.5,6,150], ['back','paris',8,.74,1.8,165], ['far','paris',10,.5,12,240]],
  paris_c: [['back','paris',5,.45,13,160], ['mid','paris',11,.55,18,150], ['far','banlieue',10,.84,8,160]],
  banlieue_a: [['street','tour',0,.85,9,1220], ['back','banlieue',1,.63,10,280], ['mid','banlieue',0,.4,6,270]],
  banlieue_b: [['street','banlieue',8,.82,5,300], ['back','banlieue',7,.5,6,145], ['far','basilique',0,.5,8,245]],
  banlieue_c: [['street','banlieue',5,.14,4,220], ['street','banlieue',5,.73,4,210], ['back','banlieue',11,.9,7,130], ['mid','banlieue',1,.5,12,180]],
  periurbain_a: [['street','periurbain',2,.2,5,215], ['street','periurbain',9,.37,3,95], ['street','periurbain',2,.85,4.8,215], ['back','periurbain',0,.18,9,250], ['mid','periurbain',1,.6,18,180]],
  periurbain_b: [['street','periurbain',7,.85,5.8,220], ['back','periurbain',6,.5,7,115], ['mid','periurbain',1,.35,13,160]],
  periurbain_c: [['street','periurbain',10,.8,7,90], ['back','periurbain',0,.16,7,230], ['horizon','montblanc',0,.5,62,265], ['mid','nature',6,.5,20,140]],
  campagne_a: [['street','campagne',8,.32,10,150], ['back','campagne',0,.46,13,160], ['mid','campagne',10,.35,20,150]],
  campagne_b: [['street','campagne',4,.81,5,275], ['back','campagne',9,.47,1.8,125], ['back','campagne',6,.64,3,250], ['mid','campagne',5,.17,5,165]],
  campagne_c: [['back','campagne',7,.5,18,120], ['far','campagne',11,.47,17,220], ['mid','campagne',10,.6,17,170]],
  retraites_a: [['street','retraites',0,.15,4.5,230], ['street','retraites',1,.37,4.5,195], ['back','retraites',8,.48,4,75]],
  retraites_b: [['back','retraites',6,.9,4.5,185], ['back','retraites',7,.5,10,100], ['horizon','mer',0,.5,34,165]],
  retraites_c: [['street','retraites',10,.25,5.7,290], ['back','retraites',9,.46,6,155], ['mid','nature',9,.5,18,180]],
  riches_a: [['street','riches',0,.2,5.5,355], ['street','riches',0,.86,5.5,355], ['back','riches',6,.35,8,205], ['mid','paris',11,.6,18,180]],
  riches_b: [['street','riches',5,.85,7,345], ['back','riches',8,.5,2.8,180], ['far','riches',9,.55,6,310]],
  riches_c: [['street','riches',5,.85,6,345], ['back','riches',7,.43,5,290], ['far','riches',10,.63,14,260], ['mid','paris',11,.88,10,170]],
};

const scenes = new WeakMap();
export function paintedScene(world, buildings) {
  if (scenes.has(world)) return scenes.get(world);
  const planes = Object.fromEntries(Object.keys(PAINTED_PLANES).map(id => [id, []]));
  const sites = {};
  for (const zone of world.subzones) {
    for (const [plane, atlas, cell, ratio, w, h] of PAINTED_ZONES[zone.id]) {
      const x = zone.start + ratio * zone.width;
      const blocked = plane === 'street' && buildings.some(b => {
        const bw = b.type === 'meeting' ? zone.width * .3 : (PAINTED_SITES[b.site_id]?.[2] || 0) + .6;
        return Math.abs(b.x - x) < (bw + w) / 2;
      });
      if (!blocked) planes[plane].push({ atlas, cell, x, w, h, zone, solid: plane === 'street' });
    }
    // Collines et végétation de raccord, sans rectangle de fond ni superposition de panoramas.
    if (zone.biome_index === 2 || zone.biome_index === 3) planes.horizon.push({ atlas:'nature', cell:5, x:zone.center, w:zone.width + 4, h:85, zone });
    for (const ratio of [.06, .94]) {
      const x = zone.start + ratio * zone.width;
      if (buildings.some(b => Math.abs(b.x - x) < (b.type === 'meeting' ? 5 : 3.5))) continue;
      planes.back.push({ atlas:'nature', cell:zone.biome_index === 4 ? 2 : 0, x, w:3.3, h:210, zone, tree:true });
    }
  }
  for (const building of buildings) {
    if (building.type === 'meeting') continue;
    const [atlas, cell, w, h] = PAINTED_SITES[building.site_id];
    const zone = world.subzones.find(z => z.id === building.subzone_id);
    const item = { atlas, cell, x:building.x, w, h, zone, building, solid:true };
    planes.street.push(item); sites[building.site_id] = item;
  }
  // Relief derrière les autres horizons : le mont Blanc reste le sommet culminant.
  planes.horizon.sort((a,b) => b.h - a.h);
  const scene = { planes, sites, length:world.length };
  scenes.set(world, scene); return scene;
}
