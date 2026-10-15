import json, pathlib

IMG_DIR = pathlib.Path('D:/carddex/public/football')
DATA_FILE = pathlib.Path('D:/carddex/public/data/football-meta.json')

meta = {}

# แมปชื่อตามรหัสไฟล์ที่มีอยู่ (key ตัด fb- ออก เพราะ cards.js มี prefix 'fb-' ให้อยู่แล้ว)
mappings = {
    "messi-10": ["Lionel Messi", "Legend", "Inter Miami CF", "2024-2025"],
    "ronaldo-7": ["Cristiano Ronaldo", "Legend", "Al Nassr", "2024-2025"],
    "haaland-9": ["Erling Haaland", "Rare", "Manchester City", "2024-2025"],
    "mbappe-9": ["Kylian Mbappé", "Rare", "Real Madrid", "2024-2025"],
    "bellingham-5": ["Jude Bellingham", "Rare", "Real Madrid", "2024-2025"],
    "de-bruyne-10": ["Kevin De Bruyne", "Rare", "Manchester City", "2024-2025"],
    "griezmann-7": ["Antoine Griezmann", "Common", "Atletico Madrid", "2024-2025"],
    "pedri-8": ["Pedri", "Common", "FC Barcelona", "2024-2025"],
    "salah-11": ["Mohamed Salah", "Rare", "Liverpool", "2024-2025"],
    "vene-23": ["Vinícius Júnior", "Rare", "Real Madrid", "2024-2025"]
}

for img_path in IMG_DIR.glob('fb-*.jpg'):
    raw_id = img_path.stem
    clean_id = raw_id.replace('fb-', '')
    if clean_id in mappings:
        meta[clean_id] = mappings[clean_id]
    else:
        name = clean_id.replace('-', ' ').title()
        meta[clean_id] = [name, "Common", "Unknown Club", "2024-2025"]

DATA_FILE.write_text(json.dumps(meta, ensure_ascii=False, indent=2), encoding='utf-8')
print(f"สร้าง {len(meta)} รายการ ใน {DATA_FILE}")
