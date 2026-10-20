export const biomeArtId = id => ({ paris_19e: 'bobo', periurbain_usine: 'periurbain', quartiers_riches: 'riches' }[id] || id);
// Même résultat que [...texte].reduce(...), sans créer de tableau (appelé pour chaque personnage dessiné).
const hash = value => { let sum = 0; for (const c of String(value)) sum = (sum * 31 + c.charCodeAt(0)) >>> 0; return sum; };
export const npcVariantCounts = Object.freeze({bobo:20,banlieue:20,periurbain:20,campagne:20,retraites:20,riches:20});
export const npcBiomeOrder = Object.freeze(['bobo', 'banlieue', 'periurbain', 'campagne', 'retraites', 'riches']);

export function npcVisualBiome(entity, homeBiome) {
  const index = npcBiomeOrder.indexOf(homeBiome);
  if (index < 0) return 'bobo';
  const neighborRoll = hash(`${entity.id}:biome`) % 8;
  if (neighborRoll > 1) return homeBiome;
  const direction = neighborRoll === 0 ? -1 : 1;
  return npcBiomeOrder[(index + direction + npcBiomeOrder.length) % npcBiomeOrder.length];
}

const npcSequence = entity => {
  const match = /^npc:(\d+)$/.exec(entity.id);
  return match ? Number(match[1]) : Number.MAX_SAFE_INTEGER;
};

// Rang de chaque habitant dans son quartier d'origine, calculé une fois par pas de simulation :
// avant, chaque personnage dessiné filtrait et triait tous les habitants de son quartier à chaque image.
let zoneRanks = { npcs: null, length: -1, tick: null, byZone: new Map(), results: new Map() };
function zoneRank(state, zoneId, homeBiome, id) {
  const npcs = state.npcs || [];
  if (zoneRanks.npcs !== npcs || zoneRanks.length !== npcs.length || zoneRanks.tick !== state.tick) {
    zoneRanks = { npcs, length: npcs.length, tick: state.tick, byZone: new Map(), results: new Map() };
  }
  const key = `${zoneId}\n${homeBiome}`;
  let ranks = zoneRanks.byZone.get(key);
  if (!ranks) {
    ranks = new Map();
    npcs.filter(npc => (npc.origin_subzone_id || homeBiome) === zoneId)
      .sort((a, b) => npcSequence(a) - npcSequence(b) || String(a.id).localeCompare(String(b.id)))
      .forEach((npc, i) => { if (!ranks.has(npc.id)) ranks.set(npc.id, i); });
    zoneRanks.byZone.set(key, ranks);
  }
  return ranks.get(id) ?? -1;
}

export function npcAppearanceAssetId(entity, state, homeBiome) {
  const zoneId = entity.origin_subzone_id || homeBiome;
  const position = zoneRank(state, zoneId, homeBiome, entity.id);
  // Même pas de simulation, même habitant : même apparence (zoneRank vient de valider le cache).
  const key = `${entity.id}\n${zoneId}\n${homeBiome}`;
  let id = zoneRanks.results.get(key);
  if (id === undefined) { id = appearanceFor(entity, zoneId, homeBiome, position); zoneRanks.results.set(key, id); }
  return id;
}

function appearanceFor(entity, zoneId, homeBiome, position) {
  const count = npcVariantCounts[homeBiome] || 20;
  const cyclePosition = position >= 0 ? position % count : hash(`${entity.id}:slot`) % count;

  // Chaque sous-zone possède un cycle fixe de vingt apparences : quinze
  // locales et cinq empruntées aux deux biomes voisins. Le pas 7 mélange le
  // cycle tout en visitant exactement une fois chacun des vingt emplacements.
  const slot = (cyclePosition * 7 + hash(`${zoneId}:skin-order`)) % count;
  const homeIndex = npcBiomeOrder.indexOf(homeBiome);
  let biome = homeBiome;
  if (homeIndex >= 0 && slot >= 15) {
    const previousShare = 2 + (hash(zoneId) % 2);
    const direction = slot < 15 + previousShare ? -1 : 1;
    biome = npcBiomeOrder[(homeIndex + direction + npcBiomeOrder.length) % npcBiomeOrder.length];
  }
  const variant = (slot + hash(`${zoneId}:skin-variant`)) % (npcVariantCounts[biome] || count);
  return `npc-${biome}-${variant}`;
}


// Sexe des silhouettes existantes, vérifié sur les vingt dessins de chaque biome.
const femaleVariants = {
  bobo: [1,3,5,8,11,14,16,18], banlieue: [1,4,6,9,11,14,16,17],
  periurbain: [4,7,9,10,12,16,19], campagne: [1,4,7,9,10,13,15,17],
  retraites: [1,2,4,6,8,9,11,12,14,16,18,19], riches: [1,3,5,8,10,12,14,18],
};
export function npcGender(entity, state) {
  const origin = state.world?.subzones.find(z => z.id === entity.origin_subzone_id);
  const homeBiome = biomeArtId(origin?.biome_id || entity.origin_biome_id || 'bobo');
  const asset = npcAppearanceAssetId(entity, state, homeBiome);
  const [, biome, variant] = /^npc-(.+)-(\d+)$/.exec(asset);
  return femaleVariants[biome]?.includes(Number(variant)) ? 'f' : 'h';
}
