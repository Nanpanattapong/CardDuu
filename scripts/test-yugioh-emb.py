#!/usr/bin/env python3
# เช็คฐานเวกเตอร์ยูกิ/วันพีซ: สุ่ม 50 ใบ → ทำให้เพี้ยนแบบรูปถ่าย (ครอปเหลื่อม, สี, เบลอ, JPEG) → ต้องหาเจอ top-1 ≥ 90%
# รัน: D:\yolo-venv\Scripts\python scripts/test-yugioh-emb.py [--onepiece]
import io, json, random, sys
from pathlib import Path
import numpy as np
from PIL import Image, ImageEnhance, ImageFilter
sys.path.insert(0, str(Path(__file__).parent))
from importlib import import_module
ec = import_module('embed-cards')

OP = '--onepiece' in sys.argv
sfx, meta_f, img_dir, cut = ('-onepiece', 'onepiece-meta.json', 'onepiece', 3) if OP else ('-yugioh', 'yugioh-meta.json', 'ygo', 4)
D = Path('D:/carddex/public/data')
E = np.frombuffer((D / f'card-emb{sfx}.bin').read_bytes(), np.int8).reshape(-1, 384).astype(np.float32)
codes = json.loads((D / f'card-emb-codes{sfx}.json').read_text())
meta = json.loads((D / meta_f).read_text(encoding='utf-8'))
assert len(codes) == len(E) and all(c[cut:] in meta for c in codes)

def photo(im):
    w, h = im.size; d = lambda n: random.randint(-n, n)
    im = im.crop((d(8), d(10), w + d(8), h + d(10)))
    im = ImageEnhance.Brightness(im).enhance(random.uniform(.75, 1.25))
    im = ImageEnhance.Color(im).enhance(random.uniform(.7, 1.3)).filter(ImageFilter.GaussianBlur(random.uniform(0, 1.2)))
    b = io.BytesIO(); im.convert('RGB').save(b, 'JPEG', quality=60); return Image.open(b)

random.seed(1)
pick = random.sample(codes, 50)
q = ec.embed(ec.model(), [photo(Image.open(f'D:/carddex/public/{img_dir}/{c[cut:]}.jpg')) for c in pick])
top = (q @ E.T / 127).argmax(1)
# อาร์ตต่างกันของการ์ดชื่อเดียวกันนับว่าถูก (ราคา/ข้อมูลเป็นใบเดียวกัน)
# วันพีซ: OP07-031 / OP07-031_r1 (พิมพ์ซ้ำ) / _p1 (ฟอยล์) รูปเหมือนกัน แต่ชื่อมีวงเล็บต่อท้าย → เทียบเลขการ์ดแทน
same = lambda a, b: meta[a][0] == meta[b][0] or (OP and a.split('_')[0] == b.split('_')[0])
ok = [same(codes[t][cut:], c[cut:]) for t, c in zip(top, pick)]
for t, c, k in zip(top, pick, ok):
    if not k: print('miss', c, meta[c[cut:]][:2], '->', codes[t], meta[codes[t][cut:]][:2])
hit = sum(ok)
print(f'top-1 {hit}/50')
assert hit >= 45
