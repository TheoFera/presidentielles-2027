// Quatre vagues complètes : les marges transparentes conservent l'écume et les gouttes.
export const waveEffectAtlas = {
  sprite: 'ultimate-wave-v2',
  frames: [[0, 0, 768, 512], [768, 0, 768, 512], [0, 512, 768, 512], [768, 512, 768, 512]],
};

export function waveEffectBounds(metrics) {
  const height = metrics.characterHeight * 1.65;
  // Une seule échelle pour les deux axes, même lorsque le cadrage du jeu change.
  // Compenser aussi la marge transparente sous l'écume pour la poser sur le sol.
  return { width: height * 1.5, height, bottom: metrics.groundY + metrics.characterHeight * .31 };
}
