/**
 * Images prêtes à dessiner, pour l'application Android.
 *
 * Une partie utilise environ 650 Mo d'images une fois décompressées. Chrome en garde l'essentiel
 * en mémoire ; la WebView de l'application en garde moins : elle jette des planches d'animation
 * et les décompresse de nouveau au moment de les dessiner (60 à 280 ms : une saccade), par exemple
 * quand une attaque ou un personnage apparaît.
 *
 * Dans l'application, chaque image du jeu est donc :
 * - décompressée une seule fois, hors du fil du jeu (createImageBitmap), puis gardée telle quelle :
 *   elle n'est plus jamais décompressée en pleine partie ;
 * - réduite pour les planches des personnages : elles étaient dessinées pour 350 à 520 pixels de haut,
 *   alors qu'un personnage en mesure environ 150 sur un téléphone. Réduites de moitié, elles restent
 *   plus grandes qu'à l'écran (aucune perte visible) et pèsent 4 fois moins en mémoire.
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
 * Réduction des planches selon l'écran : un personnage de débat (le plus grand) mesure environ
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
    bitmap = await createImageBitmap(full, { resizeWidth: w, resizeHeight: h, resizeQuality: 'high' });
    full.close();
    bitmap.spriteScaleX = w / width;
    bitmap.spriteScaleY = h / height;
  }
  // Taille d'origine, comme pour une image ordinaire : toutes les coordonnées du jeu s'y rapportent.
  bitmap.naturalWidth = width;
  bitmap.naturalHeight = height;
  return bitmap;
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
