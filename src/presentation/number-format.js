const formats = new Map();

// The values change every frame; the French formatting rules do not.
export function formatNumber(value, maximumFractionDigits = 3, minimumFractionDigits = 0) {
  const key = `${minimumFractionDigits}:${maximumFractionDigits}`;
  if (!formats.has(key)) formats.set(key, new Intl.NumberFormat('fr-FR', { minimumFractionDigits, maximumFractionDigits }));
  return formats.get(key).format(value);
}
