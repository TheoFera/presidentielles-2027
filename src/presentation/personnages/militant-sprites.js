// Les portraits militants gardent le même dessin ; seule la teinte magenta
// temporaire de leur unique paquet de tracts devient celle du candidat.
const recolored = new WeakMap();

export function recolorTractPixels(pixels, factionColor) {
  const red = Number.parseInt(factionColor.slice(1, 3), 16);
  const green = Number.parseInt(factionColor.slice(3, 5), 16);
  const blue = Number.parseInt(factionColor.slice(5, 7), 16);
  for (let i = 0; i < pixels.length; i += 4) {
    const originalRed = pixels[i], originalGreen = pixels[i + 1], originalBlue = pixels[i + 2];
    const chroma = Math.min(originalRed, originalBlue);
    if (pixels[i + 3] < 8 || chroma < 72 || originalGreen >= chroma * 0.68
      || Math.abs(originalRed - originalBlue) > 96) continue;
    const shade = Math.min(1, (originalRed + originalBlue) / 490);
    pixels[i] = Math.round(red * shade);
    pixels[i + 1] = Math.round(green * shade);
    pixels[i + 2] = Math.round(blue * shade);
  }
  return pixels;
}

export function militantSpriteForFaction(source, factionColor) {
  if (!/^#[0-9a-f]{6}$/i.test(factionColor)) return source;
  const width = source.naturalWidth || source.width;
  const height = source.naturalHeight || source.height;
  if (!width || !height) return source;
  let variants = recolored.get(source);
  if (!variants) { variants = new Map(); recolored.set(source, variants); }
  if (variants.has(factionColor)) return variants.get(factionColor);
  const canvas = typeof OffscreenCanvas !== 'undefined'
    ? new OffscreenCanvas(width, height)
    : typeof document !== 'undefined' ? document.createElement('canvas') : null;
  if (!canvas) return source;
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) return source;
  context.drawImage(source, 0, 0);
  const image = context.getImageData(0, 0, canvas.width, canvas.height);
  recolorTractPixels(image.data, factionColor);
  context.putImageData(image, 0, 0);
  variants.set(factionColor, canvas);
  return canvas;
}
