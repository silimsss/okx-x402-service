'use strict';
/**
 * 生成 Crypto Market Pulse 项目 logo（纯 Node，无依赖）
 * 设计：深蓝渐变底 + 白色行情脉冲折线（ECG 风格），256x256 PNG
 */
const zlib = require('zlib');
const fs = require('fs');

function crc32(buf) {
  let table = [];
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; table[n] = c; }
  let crc = 0 ^ -1;
  for (let i = 0; i < buf.length; i++) crc = (crc >>> 8) ^ table[(crc ^ buf[i]) & 0xff];
  return (crc ^ -1) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const t = Buffer.from(type);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([t, data])));
  return Buffer.concat([len, t, data, crc]);
}

const W = 256, H = 256;
// 渐变端色：左上深海军蓝 → 右下亮蓝
const c1 = [11, 31, 75], c2 = [30, 136, 229];
// 脉冲折线顶点
const pts = [[22, 132], [84, 132], [104, 96], [128, 168], [150, 112], [168, 132], [234, 132]];

function distToPolyline(x, y) {
  let min = Infinity;
  for (let i = 0; i < pts.length - 1; i++) {
    const [x1, y1] = pts[i], [x2, y2] = pts[i + 1];
    const dx = x2 - x1, dy = y2 - y1;
    const L2 = dx * dx + dy * dy;
    let t = ((x - x1) * dx + (y - y1) * dy) / L2;
    t = Math.max(0, Math.min(1, t));
    const px = x1 + t * dx, py = y1 + t * dy;
    const d = Math.hypot(x - px, y - py);
    if (d < min) min = d;
  }
  return min;
}

const raw = Buffer.alloc(H * (1 + W * 3));
for (let y = 0; y < H; y++) {
  raw[y * (1 + W * 3)] = 0; // PNG filter: none
  for (let x = 0; x < W; x++) {
    const t = (x / W + y / H) / 2;
    let r = c1[0] + (c2[0] - c1[0]) * t;
    let g = c1[1] + (c2[1] - c1[1]) * t;
    let b = c1[2] + (c2[2] - c1[2]) * t;
    const d = distToPolyline(x, y);
    if (d < 5) { r = g = b = 255; }
    else if (d < 13) {
      const a = 0.5 * (1 - (d - 5) / 8);
      r = r * (1 - a) + 255 * a;
      g = g * (1 - a) + 255 * a;
      b = b * (1 - a) + 255 * a;
    }
    const o = y * (1 + W * 3) + 1 + x * 3;
    raw[o] = Math.round(r); raw[o + 1] = Math.round(g); raw[o + 2] = Math.round(b);
  }
}

const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4); ihdr[8] = 8; ihdr[9] = 2; // 8bit RGB
const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk('IHDR', ihdr),
  chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
  chunk('IEND', Buffer.alloc(0)),
]);
const path = require('path');
fs.writeFileSync(path.join(__dirname, '..', 'logo.png'), png);
console.log('logo.png written:', png.length, 'bytes, base64 len:', png.toString('base64').length);
