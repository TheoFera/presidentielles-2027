/**
 * Images prêtes à dessiner, pour les téléphones web et l'application Android.
 *
 * Les images ordinaires peuvent être redécodées pendant une attaque ou un déplacement.
 * Les bitmaps gardent les pixels prêts à dessiner ; les sources des atlas découpés sont ensuite
 * libérées par minor-sprite-images.js. Le web garde la résolution native (scale = 1).
 *
 * L'application Android conserve son réglage antérieur : les grandes planches sont réduites
 * selon l'écran. Aucune réduction n'est appliquée au web, y compris sur iPhone.
 *
 * Le reste du jeu ne change pas : les coordonnées des planches restent celles des fichiers d'origine.
 * naturalWidth / naturalHeight donnent la taille d'origine, et drawImage convertit les coordonnées
 * vers l'image réduite (installSpriteDrawing).
 */

// Décors plein écran : images ordinaires (les tuiles de la carte ont leur propre préparation, carte-plate.js).
const ORDINARY = /^(plate-|debate-|background-)/;
// Gardées à pleine résolution : effets d'ultime parfois dessinés en très grand, habitants déjà petits.
const FULL_SIZE = /^(ultimate-|npc-)/;

export const spriteBitmapsSupported = () => typeof createImageBitmap === 'function' && typeof fetch === 'function'
  && typeof CanvasRenderingContext2D === 'function';

/**
 * Réglage antérieur de l'application Android : un personnage de débat (le plus grand) mesure environ
 * 0,27 × la hauteur du canevas ; les planches les plus hautes font 520 pixels ; 15 % de marge.
 * Téléphone (canevas d'environ 800 pixels de haut) : 0,5. Grande tablette : jusqu'à 1 (aucune réduction).
 */
export function spriteScaleFor(canvasHeight) {
  const needed = Math.ceil(canvasHeight * 0.27 * 1.15 / 520 * 20) / 20;
  return Math.min(1, Math.max(0.5, needed));
}

/** Chargeur pour VisualAssets : image prête à dessiner, ou image ordinaire en cas d'échec. */
export function spriteBitmapLoader(scale, createImage = () => new Image()) {
  return async (id, url) => {
    if (ORDINARY.test(id)) return loadImageElement(url, createImage);
    try {
      return await loadSpriteBitmap(url, FULL_SIZE.test(id) ? 1 : scale);
    } catch {
      return loadImageElement(url, createImage);
    }
  };
}

async function loadSpriteBitmap(url, scale) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Image introuvable : ${url}`);
  // Décompression hors du fil du jeu.
  const full = await createImageBitmap(await response.blob());
  const width = full.width, height = full.height;
  let bitmap = full;
  const w = Math.round(width * scale), h = Math.round(height * scale);
  if (scale < 1 && w >= 32 && h >= 32) {
    try { bitmap = await resizeBitmap(full, w, h); }
    finally { full.close(); }
    bitmap.spriteScaleX = w / width;
    bitmap.spriteScaleY = h / height;
  }
  // Taille d'origine, comme pour une image ordinaire : toutes les coordonnées du jeu s'y rapportent.
  bitmap.naturalWidth = width;
  bitmap.naturalHeight = height;
  return bitmap;
}

async function resizeBitmap(full, width, height) {
  try {
    const bitmap = await createImageBitmap(full, { resizeWidth: width, resizeHeight: height, resizeQuality: 'high' });
    if (bitmap.width === width && bitmap.height === height) return bitmap;
    // Certains navigateurs acceptent les options sans appliquer la réduction.
    bitmap.close();
  } catch { /* Essayer la réduction par canevas avant de revenir à l'image ordinaire. */ }
  const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
  try {
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(full, 0, 0, width, height);
    return await createImageBitmap(canvas);
  } finally { canvas.width = 0; canvas.height = 0; }
}

function loadImageElement(url, createImage) {
  return new Promise((resolve, reject) => {
    const image = createImage();
    image.decoding = 'async';
    image.onload = async () => {
      try { await image.decode?.(); } catch { /* L'image chargée reste utilisable. */ }
      resolve(image);
    };
    image.onerror = () => reject(new Error(`Image introuvable : ${url}`));
    image.src = url;
  });
}

/**
 * drawImage accepte les images réduites avec les coordonnées d'origine : la zone source
 * est convertie vers l'image réduite ; la destination ne change pas. Sans effet sur les autres images.
 */
export function installSpriteDrawing(proto = globalThis.CanvasRenderingContext2D?.prototype) {
  if (!proto || proto.drawImage.spriteAware) return;
  const native = proto.drawImage;
  function drawImage(image, a, b, c, d, e, f, g, h) {
    const scaleX = image?.spriteScaleX;
    const count = arguments.length;
    if (scaleX === undefined) {
      if (count === 3) return native.call(this, image, a, b);
      if (count === 5) return native.call(this, image, a, b, c, d);
      return native.call(this, image, a, b, c, d, e, f, g, h);
    }
    // Image entière à sa taille d'origine.
    if (count === 3) return native.call(this, image, a, b, image.naturalWidth, image.naturalHeight);
    if (count === 5) return native.call(this, image, a, b, c, d);
    const scaleY = image.spriteScaleY;
    return native.call(this, image, a * scaleX, b * scaleY, c * scaleX, d * scaleY, e, f, g, h);
  }
  drawImage.spriteAware = true;
  proto.drawImage = drawImage;
}
