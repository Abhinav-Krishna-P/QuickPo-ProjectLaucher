// Generates build/icon.ico (256px PNG inside ICO) and build/icon.png:
// blue rounded square with a white play triangle. Run: node build/make-icon.js
const fs = require('fs');
const zlib = require('zlib');
const path = require('path');

const N = 256;
const px = Buffer.alloc(N * N * 4);
const inRect = (x, y) => {
  const r = 48, m = 12;
  const cx = Math.min(Math.max(x, m + r), N - m - r);
  const cy = Math.min(Math.max(y, m + r), N - m - r);
  return (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
};
const inTri = (x, y) => {
  const x0 = 92, x1 = 188, y0 = 64, y1 = 192;
  if (x < x0 || x > x1) return false;
  const t = (x - x0) / (x1 - x0);
  const half = ((1 - t) * (y1 - y0)) / 2;
  return Math.abs(y - (y0 + y1) / 2) <= half;
};
for (let y = 0; y < N; y++) {
  for (let x = 0; x < N; x++) {
    const i = (y * N + x) * 4;
    if (!inRect(x, y)) continue;
    if (inTri(x, y)) px.set([255, 255, 255, 255], i);
    else px.set([79, 140, 255, 255], i);
  }
}
const rows = Buffer.alloc((N * 4 + 1) * N);
for (let y = 0; y < N; y++) {
  rows[y * (N * 4 + 1)] = 0;
  px.copy(rows, y * (N * 4 + 1) + 1, y * N * 4, (y + 1) * N * 4);
}
const crcT = [];
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  crcT[n] = c >>> 0;
}
const crc = (b) => {
  let c = 0xffffffff;
  for (const v of b) c = crcT[(c ^ v) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (t, d) => {
  const l = Buffer.alloc(4);
  l.writeUInt32BE(d.length);
  const td = Buffer.concat([Buffer.from(t), d]);
  const c = Buffer.alloc(4);
  c.writeUInt32BE(crc(td));
  return Buffer.concat([l, td, c]);
};
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(N, 0);
ihdr.writeUInt32BE(N, 4);
ihdr[8] = 8;
ihdr[9] = 6;
const png = Buffer.concat([
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  chunk('IHDR', ihdr),
  chunk('IDAT', zlib.deflateSync(rows)),
  chunk('IEND', Buffer.alloc(0)),
]);
const hdr = Buffer.alloc(6);
hdr.writeUInt16LE(0, 0);
hdr.writeUInt16LE(1, 2);
hdr.writeUInt16LE(1, 4);
const ent = Buffer.alloc(16);
ent.writeUInt16LE(1, 4);
ent.writeUInt16LE(32, 6);
ent.writeUInt32LE(png.length, 8);
ent.writeUInt32LE(22, 12);
fs.writeFileSync(path.join(__dirname, 'icon.png'), png);
fs.writeFileSync(path.join(__dirname, 'icon.ico'), Buffer.concat([hdr, ent, png]));
console.log('icon written', png.length);
