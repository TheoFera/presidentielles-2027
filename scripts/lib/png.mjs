// Lecture et écriture PNG minimales (8 bits, RGB ou RGBA, non entrelacé), sans dépendance.
import { readFileSync, writeFileSync } from 'node:fs';
import zlib from 'node:zlib';

export function readPng(file) {
  const buffer = readFileSync(file);
  let offset = 8, width = 0, height = 0, colorType = 6, bitDepth = 8; const chunks = [];
  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset), type = buffer.toString('ascii', offset + 4, offset + 8);
    const data = buffer.subarray(offset + 8, offset + 8 + length);
    if (type === 'IHDR') { width = data.readUInt32BE(0); height = data.readUInt32BE(4); bitDepth = data[8]; colorType = data[9]; if (data[12]) throw new Error(`${file} : PNG entrelacé non pris en charge.`); }
    if (type === 'IDAT') chunks.push(data);
    offset += 12 + length;
  }
  if (bitDepth !== 8 || ![2, 6].includes(colorType)) throw new Error(`${file} : format PNG non pris en charge (profondeur ${bitDepth}, type ${colorType}).`);
  const bpp = colorType === 6 ? 4 : 3, stride = width * bpp, raw = zlib.inflateSync(Buffer.concat(chunks));
  const pixels = Buffer.alloc(width * height * 4);
  let previous = Buffer.alloc(stride);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)], line = Buffer.from(raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1)));
    for (let i = 0; i < stride; i++) {
      const a = i >= bpp ? line[i - bpp] : 0, b = previous[i], c = i >= bpp ? previous[i - bpp] : 0;
      let value = line[i];
      if (filter === 1) value += a; else if (filter === 2) value += b; else if (filter === 3) value += (a + b) >> 1;
      else if (filter === 4) { const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); value += pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
      line[i] = value & 255;
    }
    for (let x = 0; x < width; x++) {
      const target = (y * width + x) * 4;
      for (let k = 0; k < bpp; k++) pixels[target + k] = line[x * bpp + k];
      if (bpp === 3) pixels[target + 3] = 255;
    }
    previous = line;
  }
  return { width, height, data: pixels };
}

const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
function crc(buffer) { let c = 0xffffffff; for (const byte of buffer) c = crcTable[(c ^ byte) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
function chunk(type, data) {
  const out = Buffer.alloc(12 + data.length); out.writeUInt32BE(data.length, 0); out.write(type, 4, 'ascii'); data.copy(out, 8);
  out.writeUInt32BE(crc(out.subarray(4, 8 + data.length)), 8 + data.length); return out;
}

export function writePng(file, { width, height, data }) {
  const header = Buffer.alloc(13); header.writeUInt32BE(width, 0); header.writeUInt32BE(height, 4); header[8] = 8; header[9] = 6;
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) data.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  writeFileSync(file, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', header), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]));
}
