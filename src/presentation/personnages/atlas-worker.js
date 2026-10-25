// Découpes des planches préparées hors du fil du jeu (minor-sprite-images.js) : la lecture des pixels et le détourage
// d'une tenue du service d'ordre bloquaient l'image de sa première apparition (0,2 à 0,5 s sur un téléphone lent).
import { cutAtlasFrame } from './atlas-pixels.js';

self.onmessage = ({ data: { id, image, frames } }) => {
  try {
    const bitmaps = frames.map(({ source, width, height }) => {
      const canvas = new OffscreenCanvas(width, height);
      cutAtlasFrame(canvas.getContext('2d', { willReadFrequently: true }), image, source, width, height);
      return canvas.transferToImageBitmap();
    });
    self.postMessage({ id, frames: bitmaps }, bitmaps);
  } catch {
    // Navigateur sans canevas hors écran : la découpe se fera comme avant, au premier dessin.
    self.postMessage({ id, frames: null });
  } finally { image.close(); }
};
