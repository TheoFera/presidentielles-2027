const checksum = text => {
  let n = 2166136261;
  for (let i = 0; i < text.length; i++) n = Math.imul(n ^ text.charCodeAt(i), 16777619);
  return (n >>> 0).toString(16);
};
export async function qrFrames(text) {
  if (!text.startsWith('P27:') || text.length > 30000) throw new Error('Invitation trop longue ou invalide.');
  let data = text, format = 't';
  if (typeof CompressionStream === 'function' && typeof DecompressionStream === 'function') {
    const bytes = new Uint8Array(await new Response(new Blob([text]).stream().pipeThrough(new CompressionStream('deflate'))).arrayBuffer());
    const compressed = btoa(Array.from(bytes, n => String.fromCharCode(n)).join(''));
    if (compressed.length < data.length) { data = compressed; format = 'z'; }
  }
  const total = Math.ceil(data.length / 240), key = checksum(data);
  return Array.from({ length: total }, (_, i) => `P27Q:1:${format}:${key}:${i}:${total}:${data.slice(i * 240, (i + 1) * 240)}`);
}

export class QrCollector {
  constructor() { this.transfers = new Map(); }
  async add(text) {
    const match = /^P27Q:1:([tz]):([a-f0-9]{1,8}):(\d{1,3}):(\d{1,3}):(.{1,240})$/.exec(text);
    if (!match) throw new Error('Visez un QR code affiché par le jeu.');
    const [, format, key, indexText, totalText, chunk] = match;
    const index = Number(indexText), total = Number(totalText);
    if (total < 1 || total > 125 || index >= total) throw new Error('QR code invalide.');
    const identity = `${format}:${key}:${total}`;
    let item = this.transfers.get(identity);
    if (!item) {
      if (this.transfers.size >= 3) this.transfers.delete(this.transfers.keys().next().value);
      item = new Map(); this.transfers.set(identity, item);
    }
    item.set(index, chunk);
    if (item.size !== total) return { read: item.size, total };
    const data = Array.from({ length: total }, (_, i) => item.get(i)).join('');
    this.transfers.delete(identity);
    if (checksum(data) !== key) throw new Error('Lecture incomplète. Gardez le QR code dans le cadre.');
    let value = data;
    if (format === 'z') {
      if (typeof DecompressionStream !== 'function') throw new Error('Mettez le navigateur à jour ou utilisez la connexion par texte.');
      const bytes = Uint8Array.from(atob(data), c => c.charCodeAt(0));
      const reader = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate')).getReader();
      const chunks = []; let size = 0;
      try {
        while (true) {
          const part = await reader.read(); if (part.done) break;
          size += part.value.length;
          if (size > 30000) throw new Error('QR code trop volumineux.');
          chunks.push(part.value);
        }
      } finally { await reader.cancel().catch(() => {}); }
      value = await new Blob(chunks).text();
    }
    if (!value.startsWith('P27:') || value.length > 30000) throw new Error('QR code invalide.');
    return { read: total, total, value };
  }
}
