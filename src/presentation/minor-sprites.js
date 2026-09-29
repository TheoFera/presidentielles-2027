/**
 * Planches finales des candidats mineurs (ChatGPT), à déclarer ici une fois déposées :
 *   <id>: 'assets/generated/minor-candidates/<id>.png' (fait automatiquement par scripts/world-v3-calibrate.mjs).
 * Tant qu'une planche manque, le jeu dessine le candidat par le code (minor-characters.js).
 *
 * Format d'une planche : 1536 × 1024 px, fond transparent (ou magenta #FF00FF), 4 colonnes × 3 lignes de cases
 * de 384 × 341 px ; le personnage regarde vers la droite, pieds sur la ligne y = 320 de sa case, environ 280 px de haut.
 */
export const MINOR_SPRITES = {};

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
