/**
 * Planches ImageGen des six candidats secondaires, dans le style des candidats principaux.
 * Tant qu'une planche manque, le jeu dessine le candidat par le code (minor-characters.js).
 *
 * Format : 1536 × 1024 px, transparent, 4 colonnes × 3 lignes, regard vers la droite.
 * Le cadrage final est mesuré individuellement dans minor-sprite-atlases.js.
 * MINOR_SHEET conserve le format de secours pour les anciennes planches non calibrées.
 */
export const MINOR_SPRITES = {
  glucksmann: 'assets/generated/minor-candidates/glucksmann.png',
  roussel: 'assets/generated/minor-candidates/roussel-v4.png',
  arthaud: 'assets/generated/minor-candidates/arthaud-v2.png',
  dupont_aignan: 'assets/generated/minor-candidates/dupont_aignan-v2.png',
  retailleau: 'assets/generated/minor-candidates/retailleau-v2.png',
  attal: 'assets/generated/minor-candidates/attal.png',
};

/** Ordre des cases, de gauche à droite puis de haut en bas. */
export const MINOR_SHEET_POSES = ['idle', 'walk_a', 'walk_b', 'run', 'attack_light_1', 'attack_light_2', 'attack_heavy', 'charged_attack', 'hurt', 'knockback', 'ko', 'persuade'];
export const MINOR_SHEET = Object.freeze({ width: 1536, height: 1024, columns: 4, rows: 3, feet: 320, figure: 280 });

/** Case de la planche pour une animation du jeu (la marche alterne deux cases). */
export function minorSheetCell(animation, time, airborne = false) {
  if (airborne && !animation.startsWith('attack')) return MINOR_SHEET_POSES.indexOf('run');
  if (animation === 'walk' || animation === 'demobilised_return') return Math.floor(time * 6) % 2 ? 2 : 1;
  const index = MINOR_SHEET_POSES.indexOf(animation === 'special_start' || animation === 'special_recovery' ? 'attack_heavy' : animation === 'persuade_listen' ? 'persuade' : animation);
  return index >= 0 ? index : 0;
}
