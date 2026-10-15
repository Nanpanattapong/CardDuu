// ตรวจว่า hashFromGray (JS) ให้ผลตรงกับ imagehash.phash (Python) — รัน: node scripts/check-phash.mjs
import { execFileSync } from 'node:child_process';
import assert from 'node:assert';
import { hashFromGray } from '../src/lib/cards.js';

const D = 'D:/pokemon_dataset_ready/content/pokemon_dataset_temp';
const files = [`${D}/AZs Tranquility/me4-106.png`, `${D}/Pikachu`, `${D}/Charizard ex`];
const py = `
import sys, json, os, numpy, imagehash
from PIL import Image
out = []
for p in sys.argv[1:]:
    if os.path.isdir(p): p = os.path.join(p, sorted(os.listdir(p))[0])
    im = Image.open(p)
    g = im.convert('L').resize((32, 32), Image.LANCZOS)
    out.append({'p': p, 'gray': numpy.asarray(g).flatten().tolist(), 'hash': str(imagehash.phash(im))})
print(json.dumps(out))
`;
const res = JSON.parse(execFileSync('python', ['-W', 'ignore', '-c', py, ...files], { encoding: 'utf8' }));
for (const r of res) {
  const js = hashFromGray(r.gray);
  console.log(js === r.hash ? 'ok  ' : 'FAIL', r.hash, js, r.p.split('/').slice(-2).join('/'));
  assert.strictEqual(js, r.hash);
}
console.log('all match');
