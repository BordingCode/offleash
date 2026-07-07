// Offline contact-sheet renderer: bakes every grid to RGBA and writes a PNG
// (pure node, zlib only) so the art can be eyeballed without a browser.
import { readFileSync, writeFileSync } from 'fs';
import { deflateSync } from 'zlib';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const { PAL } = await import(join(root, 'js/data/palette.js'));
const src = readFileSync(join(root, 'js/data/sprites.js'), 'utf8');
const grids = {};
for (const m of src.matchAll(/const (\w+) = \[([\s\S]*?)\];/g)) {
  grids[m[1]] = [...m[2].matchAll(/'([^']*)'/g)].map((r) => r[1]);
}
const SCALE = +process.argv[2] || 4;
const layout = [
  ['SNIG_IDLE_A','SNIG_IDLE_B','SNIG_RUN_A','SNIG_RUN_B','SNIG_ATK_A','SNIG_ATK_B','SNIG_ATK_UP','SNIG_AIR'],
  ['GROWLER_IDLE_A','GROWLER_IDLE_B','GROWLER_TELL','GROWLER_LUNGE','GROWLER_DOWN'],
  ['SKITTER_IDLE_A','SKITTER_IDLE_B','SKITTER_RUSH','PROP_BIN','PROP_CRATE','PROP_PUDDLE','PROP_LAMP'],
];
const GAP = 8;
const rowH = layout.map((r) => Math.max(...r.map((n) => grids[n].length)) * SCALE + GAP);
const rowW = layout.map((r) => r.reduce((a, n) => a + grids[n][0].length * SCALE + GAP, GAP));
const W = Math.max(...rowW), H = rowH.reduce((a, b) => a + b, GAP);
const px = new Uint8Array(W * H * 4);
const bg = [0x1b, 0x15, 0x23];
for (let i = 0; i < W * H; i++) { px.set(bg, i * 4); px[i * 4 + 3] = 255; }
const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
let oy = GAP;
layout.forEach((row, ri) => {
  let ox = GAP;
  for (const name of row) {
    const g = grids[name];
    // ground line under sprite (subtle)
    for (let y = 0; y < g.length; y++) for (let x = 0; x < g[0].length; x++) {
      const ch = g[y][x];
      if (ch === '.' || ch === ' ') continue;
      const [r, gg, b] = hex(PAL[ch]);
      for (let sy = 0; sy < SCALE; sy++) for (let sx = 0; sx < SCALE; sx++) {
        const i = ((oy + y * SCALE + sy) * W + ox + x * SCALE + sx) * 4;
        px[i] = r; px[i + 1] = gg; px[i + 2] = b; px[i + 3] = 255;
      }
    }
    ox += g[0].length * SCALE + GAP;
  }
  oy += rowH[ri];
});
// PNG encode
const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc = (buf) => { let c = 0xffffffff; for (const b of buf) c = crcTable[(c ^ b) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
const chunk = (type, data) => { const t = Buffer.from(type); const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const cc = Buffer.alloc(4); cc.writeUInt32BE(crc(Buffer.concat([t, data]))); return Buffer.concat([len, t, data, cc]); };
const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(W); ihdr.writeUInt32BE(H, 4); ihdr[8] = 8; ihdr[9] = 6;
const raw = Buffer.alloc(H * (W * 4 + 1));
for (let y = 0; y < H; y++) { raw[y * (W * 4 + 1)] = 0; px.subarray(y * W * 4, (y + 1) * W * 4).forEach((v, i) => { raw[y * (W * 4 + 1) + 1 + i] = v; }); }
const png = Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
const out = process.argv[3] || '/tmp/claude-1000/-home-mathias/4d30cd7f-877f-4e23-9980-6c36c22b1d89/scratchpad/sheet.png';
writeFileSync(out, png);
console.log(`wrote ${out} (${W}x${H}, scale ${SCALE})`);
