const formats = new Map();
// Textes déjà formatés : à chaque image, les mêmes montants (cagnottes, prix, gains) reviennent ;
// le moteur de formatage du navigateur est lent, un tableau de correspondance ne l'est pas.
const texts = new Map();
const MAX_TEXTS = 600;

// The values change every frame; the French formatting rules do not.
export function formatNumber(value, maximumFractionDigits = 3, minimumFractionDigits = 0) {
  // -0 s'affiche « -0 » : il garde sa propre entrée (`${-0}` donnerait « 0 »).
  const key = `${minimumFractionDigits}:${maximumFractionDigits}:${Object.is(value, -0) ? '-0' : value}`;
  let text = texts.get(key);
  if (text !== undefined) return text;
  const format = `${minimumFractionDigits}:${maximumFractionDigits}`;
  if (!formats.has(format)) formats.set(format, new Intl.NumberFormat('fr-FR', { minimumFractionDigits, maximumFractionDigits }));
  text = formats.get(format).format(value);
  if (texts.size >= MAX_TEXTS) texts.clear();
  texts.set(key, text);
  return text;
}

/**
 * Prépare le moteur de formatage pendant l'écran de chargement : sa première utilisation coûte
 * plusieurs dizaines de millisecondes sur téléphone, sinon payées à la première image de la partie.
 */
export function warmNumberFormats() {
  for (const [max, min] of [[0, 0], [1, 0], [2, 0], [3, 0], [1, 1]]) formatNumber(1234.5, max, min);
}
