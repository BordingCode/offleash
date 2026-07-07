// Validates every grid in js/data/sprites.js: equal row lengths, expected sizes,
// all chars in PAL (or './space'), then exercises buildSprites() with a stubbed canvas.
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const { PAL } = await import(join(root, 'js/data/palette.js'));

// --- 1. static checks on the authored grids ---
const src = readFileSync(join(root, 'js/data/sprites.js'), 'utf8');
const gridRe = /const (\w+) = \[([\s\S]*?)\];/g;
const expect = (name) => {
  if (name.startsWith('SNIG_') || name.startsWith('GROWLER_')) return [32, 32];
  if (name.startsWith('SKITTER_')) return [24, 24];
  return { PROP_LAMP: [20, 40], PROP_BIN: [18, 16], PROP_CRATE: [16, 14], PROP_PUDDLE: [24, 6] }[name];
};
let errors = 0, grids = 0;
for (const m of src.matchAll(gridRe)) {
  const name = m[1];
  const exp = expect(name);
  if (!exp) continue;
  grids++;
  const rows = [...m[2].matchAll(/'([^']*)'/g)].map((r) => r[1]);
  const [w, h] = exp;
  if (rows.length !== h) { console.log(`FAIL ${name}: ${rows.length} rows, expected ${h}`); errors++; }
  rows.forEach((row, y) => {
    if (row.length !== w) { console.log(`FAIL ${name} row ${y}: ${row.length} chars, expected ${w}: "${row}"`); errors++; }
    for (let x = 0; x < row.length; x++) {
      const ch = row[x];
      if (ch !== '.' && ch !== ' ' && !PAL[ch]) { console.log(`FAIL ${name}: unknown char "${ch}" at ${x},${y}`); errors++; }
    }
  });
}
console.log(`${grids} grids checked, ${errors} errors`);

// --- 2. exercise buildSprites() with a stubbed DOM canvas ---
class Ctx {
  constructor(c) { this.c = c; }
  createImageData(w, h) { return { width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }; }
  putImageData(img) { this.c._img = img; }
  drawImage() {} translate() {} scale() {} fillRect() {}
}
globalThis.document = { createElement: () => { const c = { width: 0, height: 0 }; c.getContext = () => new Ctx(c); return c; } };
const { buildSprites } = await import(join(root, 'js/data/sprites.js'));
const S = buildSprites();
const S2 = buildSprites();
console.log('buildSprites cached:', S === S2);
for (const [mon, anims] of Object.entries(S)) {
  if (mon === 'props') { console.log('props:', Object.keys(anims).map((k) => `${k} ${anims[k].width}x${anims[k].height}`).join(', ')); continue; }
  for (const [a, frames] of Object.entries(anims)) console.log(`${mon}.${a}: ${frames.length} frame(s) ${frames[0].w}x${frames[0].h}`);
}
if (errors) process.exit(1);
