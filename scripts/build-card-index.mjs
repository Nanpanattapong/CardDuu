// สร้าง public/data/card-index.json จาก D:\pokemon_dataset_ready (รันซ้ำได้เมื่อ dataset อัปเดต)
// ponytail: index อย่างเดียว รูป hotlink จาก images.pokemontcg.io ไม่ต้องโฮสต์ 3.2GB เอง
import { readdirSync, writeFileSync, mkdirSync } from 'node:fs';

const SRC = 'D:/pokemon_dataset_ready/content/pokemon_dataset_temp';
const OUT = 'public/data/card-index.json';

const idx = {};
let n = 0;
for (const d of readdirSync(SRC, { withFileTypes: true })) {
  if (!d.isDirectory()) continue;
  const codes = [];
  for (const f of readdirSync(`${SRC}/${d.name}`)) {
    if (/\.png$/i.test(f)) { codes.push(f.replace(/\.png$/i, '')); n++; }
  }
  if (codes.length) idx[d.name] = codes.sort();
}
mkdirSync('public/data', { recursive: true });
const json = JSON.stringify(idx);
writeFileSync(OUT, json);
console.log(`names: ${Object.keys(idx).length}, images: ${n}, json: ${(json.length / 1024).toFixed(0)}KB`);
