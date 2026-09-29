// Mesures du calage des images du décor v3 (utilisées par world-v3-calibrate.mjs et les tests).

/** Fond magenta → transparent (avec atténuation des bords teintés), puis alpha net sans halo sombre. */
export function cleanPixels(image) {
  const { data } = image; let keyed = 0, transparent = 0;
  for (let i = 0; i < data.length; i += 4) if (data[i + 3] < 10) transparent++;
  const hasAlpha = transparent > image.width * image.height * 0.05;
  for (let i = 0; i < data.length; i += 4) {
    const [r, g, b] = [data[i], data[i + 1], data[i + 2]];
    if (!hasAlpha) {
      const magenta = Math.min(r, b) - g;
      if (magenta > 150) { data[i + 3] = 0; keyed++; continue; }
      if (magenta > 60) { data[i + 3] = Math.round(data[i + 3] * (150 - magenta) / 90); data[i] = Math.min(r, g + 40); data[i + 2] = Math.min(b, g + 40); }
    }
    const a = data[i + 3]; data[i + 3] = a < 90 ? 0 : a > 200 ? 255 : Math.round((a - 90) / 110 * 255);
  }
  return { keyed, hasAlpha };
}

/** Ligne la plus basse où au moins `ratio` de la largeur est opaque. */
export function measureBaseline(image, ratio) {
  const { width, height, data } = image;
  for (let y = height - 1; y >= 0; y--) {
    let opaque = 0;
    for (let x = 0; x < width; x++) if (data[(y * width + x) * 4 + 3] > 200) opaque++;
    if (opaque >= width * ratio) return y + 1;
  }
  return null;
}

const isCream = (data, i) => data[i + 3] > 200 && data[i] > 222 && data[i + 1] > 200 && data[i + 1] < 245 && data[i + 2] > 160 && data[i + 2] < 222 && data[i] - data[i + 2] > 18 && data[i] - data[i + 2] < 75;

/** Rectangles crème pleins (enseignes vierges) : composantes connexes sur une grille de 2 px. */
export function findCreamSigns(image) {
  const { width, height, data } = image, step = 2, gw = Math.ceil(width / step), gh = Math.ceil(height / step);
  const grid = new Uint8Array(gw * gh), seen = new Uint8Array(gw * gh), signs = [];
  for (let gy = 0; gy < gh; gy++) for (let gx = 0; gx < gw; gx++) grid[gy * gw + gx] = isCream(data, ((gy * step) * width + gx * step) * 4) ? 1 : 0;
  for (let start = 0; start < grid.length; start++) {
    if (!grid[start] || seen[start]) continue;
    const stack = [start]; seen[start] = 1; let count = 0, x0 = gw, x1 = 0, y0 = gh, y1 = 0;
    while (stack.length) {
      const cell = stack.pop(), cx = cell % gw, cy = (cell - cx) / gw; count++;
      x0 = Math.min(x0, cx); x1 = Math.max(x1, cx); y0 = Math.min(y0, cy); y1 = Math.max(y1, cy);
      for (const next of [cell - 1, cell + 1, cell - gw, cell + gw]) if (next >= 0 && next < grid.length && grid[next] && !seen[next] && Math.abs((next % gw) - cx) <= 1) { seen[next] = 1; stack.push(next); }
    }
    const w = (x1 - x0 + 1) * step, h = (y1 - y0 + 1) * step;
    if (w >= 90 && h >= 26 && w < width * 0.4 && count * step * step >= w * h * 0.72) signs.push([x0 * step, y0 * step, w, h]);
  }
  return signs;
}
