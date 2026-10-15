#!/usr/bin/env python3
# ดึงการ์ดฟุตบอลจากหลายแหล่ง (เหมือน fetch-yugioh.py)
# ลอง Sorare API ก่อน → fallback ไปที่ข้อมูลจำลองที่สร้างไว้แล้ว
import json, time, urllib.request, io, pathlib
from PIL import Image
from pathlib import Path

OUT = pathlib.Path('D:/football_dataset')
IMG = pathlib.Path('D:/carddex/public/football')
DATA = pathlib.Path('D:/carddex/public/data')
IMG.mkdir(parents=True, exist_ok=True)
DATA.mkdir(parents=True, exist_ok=True)

UA = {'User-Agent': 'CardDex/1.0 (football card fetcher)'}

# ข้อมูลจำลองสำรอง (เหมือนที่สร้างไว้ก่อนแล้ว)
MOCK_CARDS = [
    {"code": "fb-messi-10", "name": "Lionel Messi", "rarity": "Legend", "club": "Inter Miami CF", "season": "2024-25"},
    {"code": "fb-ronaldo-7", "name": "Cristiano Ronaldo", "rarity": "Legend", "club": "Al Nassr", "season": "2024-25"},
    {"code": "fb-haaland-9", "name": "Erling Haaland", "rarity": "Rare", "club": "Manchester City", "season": "2024-25"},
    {"code": "fb-mbappe-9", "name": "Kylian Mbappe", "rarity": "Rare", "club": "Real Madrid", "season": "2024-25"},
    {"code": "fb-bellingham-5", "name": "Jude Bellingham", "rarity": "Rare", "club": "Real Madrid", "season": "2024-25"},
]

# ลองดึงจาก Sorare API ก่อน (อาจ 403/422 ถ้าจำเป็น)
try:
    req = urllib.request.Request(
        'https://api.sorare.com/graphql',
        data=json.dumps({"query": "query { cards(first: 5) { edges { node { id name rarity displayIds illustration { uri } } } }"}).encode(),
        headers={**UA, "Content-Type": "application/json"}
    )
    with urllib.request.urlopen(req, timeout=15) as r:
        data = json.load(r)
        print("ดึงจาก Sorare สำเร็จ!", flush=True)
        cards = []
        for edge in data.get("data", {}).get("cards", []):
            node = edge.get("node", {})
            code = node.get("displayIds", [None])[0] or f"fb-{node.get('id')}"
            cards.append({
                "code": code,
                "name": node.get("name", "Unknown"),
                "rarity": node.get("rarity", "Unknown"),
                "club": node.get("club", {}).get("name", ""),
                "season": node.get("season", ""),
            })
except Exception as e:
    print(f"Sorare API ไม่พร้อมใช้ (กำลังใช้ข้อมูลจำลอง): {type(e).__name__}", flush=True)
    cards = MOCK_CARDS

# บันทึก cards.json
(OUT / "cards.json").write_text(json.dumps(cards, ensure_ascii=False, indent=2), encoding='utf-8')

# สร้าง football-meta.json (รูปแบบเดียวกับ yugioh/onepiece)
meta = {}
for c in cards:
    code = c.get("code", "")
    meta[code] = [c.get("name", ""), c.get("rarity", ""), c.get("club", ""), c.get("season", "")]
(DATA / "football-meta.json").write_text(json.dumps(meta, ensure_ascii=False, indent=2), encoding='utf-8')

print(f"บันทึกการ์ดฟุตบอล {len(cards)} ใบ เรียบร้อย!", flush=True)
print(f"บันทึก meta เรียบร้อย!", flush=True)

# สร้างรูปการ์ด (ถ้ายังไม่มี)
for c in cards:
    code = c.get("code", "")
    img_path = IMG / f"{code}.jpg"
    if not img_path.exists():
        # สร้างรูปจำลอง
        im = Image.new('RGB', (268, 385), color=(200, 220, 255))
        from PIL import ImageDraw
        d = ImageDraw.Draw(im)
        d.rectangle([8, 8, 260, 377], outline=(40,40,40), width=2)
        d.text((15, 25), c.get("name", code), fill=(30,30,30))
        d.text((15, 50), f"{c.get('club','')} · {c.get('season','')}", fill=(50,50,50))
        d.text((15, 80), f"Rarity: {c.get('rarity','')}", fill=(100,100,100))
        d.text((15, 340), code, fill=(120,120,120))
        im.save(img_path, 'JPEG', quality=85)
        print(f"สร้างรูปจำลอง {code} เรียบร้อย!", flush=True)

print("เสร็จสิ้น!", flush=True)