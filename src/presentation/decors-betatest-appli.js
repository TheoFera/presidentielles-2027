// Version de decors-betatest.js copiée dans l'application (node scripts/build-pages.mjs --app).
// L'application n'affiche que la carte plate : les décors du profil betatest n'y sont pas embarqués.
// Mêmes noms que decors-betatest.js, mais vides. Ce code n'est jamais appelé dans l'application.
const none = () => null;
const nothing = () => [];

export const BIOME_ART = {}, CANVAS = { width: 1, height: 1 }, FARS = {}, LAYERS = {}, MIDDLES = {}, STREETS = {};
export const CALIBRATION = { far: {}, middle: {}, street: {} };
export const drawStreetGround = none, zoneScreenLeft = none, drawFrontProps = none;
export const drawFresque = none, fresqueSignFrame = none;
export const paintedAssetIds = nothing, completePaintedAssetIds = nothing, expandedWorldAssetIds = nothing;
export const drawPaintedWorld = none, drawPaintedFront = none, paintedSignFrame = none, preparePaintedAtlas = none;
export const drawExpandedWorld = () => false, prepareExpandedAtlas = none;
export const betatestDecorAssets = {};
