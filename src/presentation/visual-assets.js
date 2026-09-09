// Presentation-only image cache. Missing images always leave the existing renderer usable.
export class VisualAssets {
  constructor(manifest = {}, { createImage = () => new Image(), limit = 64 } = {}) {
    this.manifest = manifest;
    this.createImage = createImage;
    this.limit = limit;
    this.cache = new Map();
    this.failures = new Set();
    this.protectedIds = new Set();
  }

  get(id) {
    const entry = this.cache.get(id);
    if (!entry?.ready) return null;
    this.cache.delete(id);
    this.cache.set(id, entry);
    return entry.image;
  }

  preload(ids) {
    return Promise.all([...new Set(ids)].map(id => this.load(id)));
  }

  load(id) {
    if (this.cache.has(id)) return this.cache.get(id).promise;
    const source = this.manifest[id];
    if (!source || this.failures.has(id)) return Promise.resolve(null);
    const image = this.createImage();
    const entry = { image, ready: false, promise: null };
    entry.promise = new Promise(resolve => {
      image.onload = () => {
        entry.ready = true;
        resolve(image);
        this.trim();
      };
      image.onerror = () => {
        this.failures.add(id);
        this.cache.delete(id);
        console.warn(`Visuel indisponible : ${id}. Rendu de secours conservé.`);
        resolve(null);
      };
    });
    this.cache.set(id, entry);
    image.src = source.file;
    return entry.promise;
  }

  keep(ids) {
    this.protectedIds = new Set(ids);
    this.trim();
    return this.preload(ids);
  }

  trim() {
    for (const [id, entry] of this.cache) {
      if (this.cache.size <= this.limit) break;
      if (entry.ready && !this.protectedIds.has(id)) this.cache.delete(id);
    }
  }

  status() {
    return { loaded: [...this.cache.values()].filter(e => e.ready).length,
      pending: [...this.cache.values()].filter(e => !e.ready).length,
      failed: [...this.failures] };
  }
}

export function neighboringSubzones(subzones, index) {
  if (!subzones.length) return [];
  const count = subzones.length;
  return [...new Set([-1, 0, 1].map(offset => subzones[((index + offset) % count + count) % count]))];
}
