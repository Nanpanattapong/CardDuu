#!/usr/bin/env python3
# สร้างชุดข้อมูลการ์ดฟุตบอลจำลอง (Mock Dataset) สำหรับทดสอบระบบ CardDex
import json, pathlib
from PIL import Image, ImageDraw

OUT = pathlib.Path('D:/football_dataset')
IMG = pathlib.Path('D:/carddex/public/football')
DATA = pathlib.Path('D:/carddex/public/data')

IMG.mkdir(parents=True, exist_ok=True)
OUT.mkdir(parents=True, exist_ok=True)
DATA.mkdir(parents=True, exist_ok=True)

players = [
    ("fb-messi-10", "Lionel Messi (Inter Miami)", "Common", "2024-2025", (200, 220, 255)),
    ("fb-ronaldo-7", "Cristiano Ronaldo (Al Nassr)", "Common", "2024-2025", (255, 220, 200)),
    ("fb-haaland-9", "Erling Haaland (Manchester City)", "Rare", "2024-2025", (200, 255, 200)),
    ("fb-mbappe-9", "Kylian Mbappé (Real Madrid)", "Rare", "2024-2025", (255, 255, 200)),
    ("fb-bellingham-5", "Jude Bellingham (Real Madrid)", "Common", "2024-2025", (255, 200, 220))
]

cards = []
meta = {}

for code, name, rarity, season, color in players:
    # สร้างรูปการ์ดจำลองขนาด 268x385 (สัดส่วนประมาณการ์ดจริง 63:88)
    im = Image.new('RGB', (268, 385), color=color)
    d = ImageDraw.Draw(im)
    d.rectangle([10, 10, 258, 375], outline=(0,0,0), width=3)
    d.text((20, 30), name, fill=(0,0,0))
    d.text((20, 60), f"Rarity: {rarity}", fill=(50,50,50))
    d.text((20, 90), f"Season: {season}", fill=(50,50,50))
    d.text((20, 340), code, fill=(100,100,100))

    img_path = IMG / f"{code}.jpg"
    im.save(img_path, 'JPEG', quality=85)

    cards.append({
        "code": code,
        "name": name,
        "rarity": rarity,
        "season": season,
        "image_url": f"/football/{code}.jpg"
    })

    meta[code] = [name, rarity, season, "Football Club"]

(OUT / "cards.json").write_text(json.dumps(cards, ensure_ascii=False, indent=2), encoding='utf-8')
(DATA / "football-meta.json").write_text(json.dumps(meta, ensure_ascii=False, indent=2), encoding='utf-8')

print(f"สร้างการ์ดฟุตบอลจำลองสำเร็จ {len(players)} ใบ พร้อมไฟล์ meta และรูปภาพเรียบร้อย!")
