#!/usr/bin/env python3
# cards.json (scripts/fetch-yugioh.py) → public/data/yugioh-meta.json  {artId: [ชื่อ, ประเภท, ชุด, รหัสชุด, ความหายาก, TCGplayer USD, Cardmarket USD]}
# key = art id ให้ตรงกับรหัส "ygo-{artId}" ใน card-emb-codes-yugioh.json (การ์ดอาร์ตสำรองใช้ข้อมูลใบเดียวกัน)
# รัน: D:\yolo-venv\Scripts\python scripts/build-yugioh-meta.py
import json
from pathlib import Path

cards = json.loads(Path('D:/yugioh_dataset/cards.json').read_text(encoding='utf-8'))
meta = {}
for c in cards:
    s = (c.get('card_sets') or [{}])[0]
    price = (c.get('card_prices') or [{}])[0]
    row = [c['name'], c.get('type', ''), s.get('set_name', ''), s.get('set_code', ''), s.get('set_rarity', ''), float(price.get('tcgplayer_price') or 0), float(price.get('cardmarket_price') or 0)]
    for im in c['card_images']: meta[str(im['id'])] = row
Path('D:/carddex/public/data/yugioh-meta.json').write_text(json.dumps(meta, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
assert len(meta) == sum(len(c['card_images']) for c in cards)
print('saved', len(meta))
