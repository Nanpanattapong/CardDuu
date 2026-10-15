// HEAD ทุกรหัสใน card-index → เขียนรายการที่ CDN ไม่มี (404 = รูปหลังการ์ด) ลง scripts/cdn-missing.json
import { readFileSync, writeFileSync } from 'fs';
const idx = JSON.parse(readFileSync('public/data/card-index.json', 'utf8'));
const codes = Object.values(idx).flat();
const url = (c) => `https://images.pokemontcg.io/${c.split('-')[0]}/${c.split('-').slice(1).join('/')}.png`;
const missing = [];
let i = 0, done = 0;
async function worker() {
  while (i < codes.length) {
    const c = codes[i++];
    for (let t = 0; t < 3; t++) {
      try {
        const r = await fetch(url(c), { method: 'HEAD' });
        if (r.status === 404) missing.push(c);
        break;
      } catch { if (t === 2) missing.push(c); }
    }
    if (++done % 2000 === 0) console.log(done, missing.length);
  }
}
await Promise.all(Array.from({ length: 40 }, worker));
writeFileSync('scripts/cdn-missing.json', JSON.stringify(missing.sort()));
console.log('total', codes.length, 'missing', missing.length);
