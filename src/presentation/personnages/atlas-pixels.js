// Traitements de pixels des planches, sans page ni canevas : partagés par le fil du jeu et atlas-worker.js.

/** Retire le halo sombre semi-transparent des images générées (alpha faible → transparent, bords nets). */
export function cleanGeneratedPixels(data) {
  for (let i = 3; i < data.length; i += 4) data[i] = data[i] < 90 ? 0 : data[i] > 200 ? 255 : Math.round((data[i] - 90) / 110 * 255);
}

/**
 * Isole la silhouette principale d'une découpe dont le rectangle croise une pose voisine : seule la plus grande
 * tache de pixels visibles (voisins en diagonale compris ; à égalité, la première rencontrée) est gardée.
 * Chaque tache reçoit un numéro au lieu d'être recopiée : même résultat, environ deux fois plus vite.
 */
export function isolateMinorFigure(data, width, height) {
  const size = width * height, label = new Int32Array(size), queue = new Int32Array(size);
  let best = 0, bestSize = 0, current = 0;
  const visit = (next, tail) => {
    if (label[next] || data[next * 4 + 3] === 0) return tail;
    label[next] = current; queue[tail] = next; return tail + 1;
  };
  for (let start = 0; start < size; start++) {
    if (label[start] || data[start * 4 + 3] === 0) continue;
    current++;
    let head = 0, tail = 1; label[start] = current; queue[0] = start;
    while (head < tail) {
      const pixel = queue[head++], x = pixel % width;
      const left = x > 0, right = x < width - 1;
      if (pixel >= width) {
        const row = pixel - width;
        if (left) tail = visit(row - 1, tail);
        tail = visit(row, tail);
        if (right) tail = visit(row + 1, tail);
      }
      if (left) tail = visit(pixel - 1, tail);
      if (right) tail = visit(pixel + 1, tail);
      if (pixel < size - width) {
        const row = pixel + width;
        if (left) tail = visit(row - 1, tail);
        tail = visit(row, tail);
        if (right) tail = visit(row + 1, tail);
      }
    }
    if (tail > bestSize) { bestSize = tail; best = current; }
  }
  for (let pixel = 0; pixel < size; pixel++) if (!best || label[pixel] !== best) data[pixel * 4 + 3] = 0;
}

/**
 * Découpe d'une planche dans un canevas de travail : même tracé, nettoyage et détourage, ici ou dans atlas-worker.js.
 * `source` : zone de la planche en pixels réels de l'image (planches réduites comprises).
 */
export function cutAtlasFrame(ctx, image, source, width, height) {
  ctx.drawImage(image, source[0], source[1], source[2], source[3], 0, 0, width, height);
  const pixels = ctx.getImageData(0, 0, width, height);
  cleanGeneratedPixels(pixels.data);
  isolateMinorFigure(pixels.data, width, height);
  ctx.putImageData(pixels, 0, 0);
}
