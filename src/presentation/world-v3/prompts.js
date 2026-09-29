import { CANVAS, CHARACTER_PX, LAYERS, LAYER_BASELINE, STREET_BASELINE, allDecorImages, signRect } from './spec.js';

/** Références de style à joindre à chaque demande, en plus de la maquette. */
export const STYLE_REFERENCES = {
  street: ['assets/generated/characters/character-philippe.png', 'assets/generated/npc-v2/npc-banlieue-0.png', 'assets/generated/biomes/street-retraites.png'],
  middle: ['assets/generated/characters/character-philippe.png', 'assets/generated/biomes/landscape-retraites.png'],
  far: ['assets/generated/biomes/distant-bobo.png', 'assets/generated/biomes/distant-retraites.png'],
};

const STYLE = 'STYLE: the same hand-inked French political cartoon style as the attached character references: bold clean dark ink outlines, simplified and slightly caricatural shapes, flat warm colours with light watercolour/gouache texture, paper grain, cheerful and readable. Consistent light from the upper left. NOT pixel art, NOT photorealistic, NOT 3D, NOT blurry.';
const OUTPUT = (baseline) => `OUTPUT: exactly ${CANVAS.width} × ${CANVAS.height} px, TRANSPARENT background (alpha). If transparency is impossible, use a perfectly flat pure magenta #FF00FF background with no gradient, no shadow and no halo on it. Nothing at all below y = ${baseline} (the game draws the ground there). No sky, no clouds, no text, no letters, no logos, no watermark, no frame.`;

function describeElement(element) {
  const range = element.w ? `x ${Math.round(element.x)}–${Math.round(element.x + element.w)}` : `x ≈ ${Math.round(element.x)}`;
  switch (element.t) {
    case 'bat': return `${range}: ${element.desc} (height ${element.h} px above the ground line).`;
    case 'tour': return `${range}: ${element.desc}.`;
    case 'site': {
      const [sx, sy, sw, sh] = signRect(element);
      return `door centred on x = ${element.x} (door ${element.door[0]} × ${element.door[1]} px, bottom on the ground line): ${element.desc}. Directly above the door, ONE BLANK CREAM SIGN exactly at x ${sx}–${sx + sw}, y ${sy}–${sy + sh} (colour #F3E4C5, thin dark border, completely empty).`;
    }
    case 'vitrine': return `${range}: ${element.desc} (height ${element.h} px). Its shop sign is a painted pictogram only, never a blank cream sign.`;
    case 'bas': return `${range}: ${element.desc} (low, ${element.h} px high).`;
    case 'objet': return `${range}: ${element.desc} (${element.h} px high).`;
    case 'place': return `${range}: ${element.desc}. Keep this area EMPTY above the ground (the game draws the meeting stage in its centre).`;
    case 'arbre': return `x ≈ ${element.x}: leave room for a tree of about ${element.h} px drawn by the game (do not paint it).`;
    case 'relief': return `${element.desc} (shape given by the blockout).`;
    case 'groupe': return `x ${element.x}–${element.x + element.w}: ${element.desc} (up to ${element.h} px high).`;
    case 'repere': return `x ${element.x}–${element.x + element.w}: ${element.desc} (about ${element.h} px high).`;
    default: return '';
  }
}

/** Prompt complet d'une image du décor, prêt à coller dans ChatGPT avec la maquette et les références. */
export function decorPrompt(image) {
  const { layer, spec } = image;
  const baseline = layer === 'street' ? STREET_BASELINE : LAYER_BASELINE;
  const lines = [
    `Transform the attached flat-colour BLOCKOUT (${image.file.replace('.png', '-maquette.png')}) into a finished 2D side-scrolling game ${layer === 'street' ? 'street foreground' : layer === 'middle' ? 'middle-distance background layer' : 'far-distance background layer'} for a satirical French presidential campaign game. Keep every shape of the blockout at EXACTLY the same position, size and proportion; only replace the flat shapes by fully illustrated elements.`,
    STYLE,
    OUTPUT(baseline),
  ];
  if (layer === 'street') lines.push(
    `SCALE: a standing adult character of the game is ${CHARACTER_PX} px tall; doors are about 260 px tall. Strict side view (orthographic), all ground contacts and door thresholds on the horizontal ground line y = ${STREET_BASELINE}.`,
    `EDGES: whatever touches the left edge (x = 0) or right edge (x = ${CANVAS.width}) is low (under 140 px) and simply continues to the edge; the game hides the joint with a tree.`,
    'Do not paint big deciduous trees (the game draws seasonal trees); potted evergreen shrubs are fine. No people. Keep every door clear.',
    `ONLY the cream rectangles of the blockout are blank signs; do not add any other blank sign anywhere.${spec.extendsAbove ? ' The two towers deliberately leave the canvas through the top edge: in the top 120 px, draw only the repeating tower floors (the game repeats this band upward).' : ''}`,
  );
  else lines.push(
    `DEPTH: this layer scrolls at ${LAYERS[layer].parallax} × the camera speed, behind the playable street. ${layer === 'far' ? 'Use lighter, bluish, low-contrast atmospheric colours and thinner outlines.' : 'Slightly softer colours and thinner outlines than the street.'} Everything stands on the ground line y = ${baseline}; below it, nothing (the game draws a continuous ground strip).`,
    'The image is split in three equal thirds matching sub-zones A, B and C of the biome: keep each landmark inside its third as in the blockout.',
    'EDGES: every hill, relief and skyline slopes gently DOWN to the ground line before reaching the left and right edges; the first and last 40 px of the image are fully transparent. No vertical cut anywhere (no cliff or wall cut by the frame), so neighbouring biomes join seamlessly.',
  );
  lines.push(`SCENE: ${spec.scene || spec.title}`, 'ELEMENTS, from left to right:');
  for (const element of [...spec.elements].sort((a, b) => (a.x ?? a.points?.[1]?.[0] ?? 0) - (b.x ?? b.points?.[1]?.[0] ?? 0))) {
    const text = describeElement(element); if (text) lines.push(`- ${text}`);
  }
  return lines.join('\n');
}

/** Document Markdown complet : mode d'emploi puis un prompt par image. */
export function decorPromptsMarkdown() {
  const images = allDecorImages();
  const parts = [
    '# Décor v3 — prompts ChatGPT (généré automatiquement)',
    '',
    '> Ne pas modifier à la main : ce fichier est produit par `node scripts/world-v3-export.mjs` à partir de `src/presentation/world-v3/spec.js`.',
    '',
    '## Mode d’emploi',
    '',
    '1. Pour chaque image ci-dessous, ouvrir une nouvelle conversation ChatGPT (mode image).',
    '2. Joindre **la maquette** (`docs/production/decor-v3/maquettes/<nom>-maquette.png`) puis les **références de style** indiquées.',
    '3. Coller le prompt tel quel. Refaire si une enseigne crème a bougé, si du texte apparaît ou si le fond n’est pas transparent ou magenta.',
    '4. Enregistrer le résultat sous le nom indiqué dans `assets/generated/world-v3/` (écraser l’ancien fichier).',
    '5. Lancer `node scripts/world-v3-calibrate.mjs` : le script retire le fond magenta et le halo, mesure la ligne de sol et les enseignes, cale les portes du jeu et signale les images à refaire.',
    '6. Un biome passe automatiquement au nouveau décor dès que ses 3 rues sont validées. Aperçu à tout moment : `http://localhost:2027/?decor=maquette`.',
    '',
    `Ordre conseillé : les 18 rues, puis les 6 plans intermédiaires, puis les 6 lointains (${images.length} images).`,
    '',
  ];
  for (const image of images) {
    parts.push(`## ${image.file} — ${image.spec.title}`, '',
      `- Maquette : \`docs/production/decor-v3/maquettes/${image.file.replace('.png', '-maquette.png')}\` (légende : \`${image.file.replace('.png', '-legende.png')}\`)`,
      `- Références de style : ${STYLE_REFERENCES[image.layer].map(file => `\`${file}\``).join(', ')}`,
      `- Fichier final : \`assets/generated/world-v3/${image.file}\``, '', '```text', decorPrompt(image), '```', '');
  }
  return parts.join('\n');
}
