// Presentation-only image cache. Missing images always leave the existing renderer usable.
export class VisualAssets {
  constructor(manifest = {}, { createImage = () => new Image(), limit = 64, concurrency = 8, prepareImage = null } = {}) {
    this.manifest = manifest;
    this.createImage = createImage;
    this.limit = limit;
    this.cache = new Map();
    this.failures = new Set();
    this.protectedIds = new Set();
    this.concurrency = Math.max(1, concurrency);
    this.prepareImage = prepareImage;
    this.queue = [];
    this.active = 0;
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

  async loadRequired(ids, onProgress = () => {}) {
    const required = [...new Set(ids)];
    // Only an explicit loading-screen attempt retries failures. Draw calls keep
    // their non-retrying fallback, avoiding a network loop during gameplay.
    for (const id of required) this.failures.delete(id);
    let completed = 0;
    await Promise.all(required.map(async id => {
      const image = await this.load(id);
      if (!image) throw new Error('Certaines images n’ont pas pu être chargées. Réessayez.');
      onProgress(++completed / required.length);
    }));
  }

  load(id) {
    if (this.cache.has(id)) return this.cache.get(id).promise;
    const source = this.manifest[id];
    if (!source || this.failures.has(id)) return Promise.resolve(null);
    const entry = { image: null, ready: false, promise: null, resolve: null };
    entry.promise = new Promise(resolve => { entry.resolve = resolve; });
    this.cache.set(id, entry);
    this.queue.push({ id, source, entry });
    this.pump();
    return entry.promise;
  }

  pump() {
    while (this.active < this.concurrency && this.queue.length) {
      const { id, source, entry } = this.queue.shift();
      this.active++;
      let finished = false;
      const finish = failed => {
        if (finished) return;
        finished = true;
        if (failed) {
          this.failures.add(id);
          this.cache.delete(id);
          console.warn(`Visuel indisponible : ${id}. Rendu de secours conservé.`);
        } else entry.ready = true;
        entry.resolve(failed ? null : entry.image);
        this.active--;
        this.trim();
        this.pump();
      };
      try {
        const image = entry.image = this.createImage();
        image.decoding = 'async';
        image.onload = async () => {
          // Decode before the first draw, outside the animation frame. Some
          // browsers reject decode() for an otherwise usable loaded image.
          try { await image.decode?.(); } catch { /* Keep the loaded image. */ }
          if (this.prepareImage) {
            try { await this.prepareImage(id, image); }
            catch { /* Drawing still has its original lazy preparation path. */ }
          }
          finish(false);
        };
        image.onerror = () => finish(true);
        image.src = source.file;
      } catch { finish(true); }
    }
  }

  keep(ids) {
    this.protectedIds = new Set(ids);
    this.trim();
    return this.preload(ids);
  }

  trim() {
    // Protected artwork may exceed the nominal limit. Keep a small bounded
    // working set alongside it so on-demand images are not immediately evicted.
    const capacity = Math.max(this.limit, this.protectedIds.size + Math.min(16, Math.floor(this.limit / 4)));
    let loaded = 0;
    for (const entry of this.cache.values()) if (entry.ready) loaded++;
    for (const [id, entry] of this.cache) {
      if (loaded <= capacity) break;
      if (entry.ready && !this.protectedIds.has(id)) { this.cache.delete(id); loaded--; }
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
