#!/usr/bin/env python3
# สร้าง perceptual hash ของการ์ดทั้ง 20,670 ใบ → public/data/card-hashes.json
# phash ใช้กำลังการคำนวณน้อย, stable ต่อการบีบอัด/crop, เหมาะสำหรับหา 5 ใบใกล้เคียง

import json
import os
from pathlib import Path
from PIL import Image
import imagehash

SRC = Path('D:/pokemon_dataset_ready/content/pokemon_dataset_temp')
OUT = Path('public/data')
OUT.mkdir(parents=True, exist_ok=True)

hashes = {}
for i, folder in enumerate(sorted(SRC.iterdir())):
    if not folder.is_dir(): continue
    for f in folder.glob('*.png'):
        code = f.stem
        try:
            h = str(imagehash.phash(Image.open(f)))
            hashes[code] = h
        except Exception as e:
            print(f'skip {code}: {e}')
    if (i + 1) % 500 == 0: print(f'{i+1} done')

with open(OUT / 'card-hashes.json', 'w') as f:
    json.dump(hashes, f)
print(f'saved {len(hashes)} hashes')
