#!/usr/bin/env python3
# วันพีซ D:/onepiece_dataset/cards.json → public/data/onepiece-meta.json  {artId: [ชื่อ, ชุด, ชนิด, ความหายาก, สี, ค่าใช้จ่าย, พลัง, USD]}
import json
from pathlib import Path
cards = json.loads(Path('D:/onepiece_dataset/cards.json').read_text(encoding='utf-8'))
meta = {}
for c in cards:
    cid = c.get('card_image_id') or c.get('card_set_id')
    if not cid: continue
    meta[cid] = [c.get('card_name',''), c.get('set_name',''), c.get('card_type',''), c.get('rarity',''), c.get('card_color',''), c.get('card_cost'), c.get('card_power'), float(c.get('market_price') or 0)]
Path('D:/carddex/public/data/onepiece-meta.json').write_text(json.dumps(meta, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
print('saved', len(meta))
