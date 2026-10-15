#!/usr/bin/env python3
import json, urllib.request, io, pathlib
from PIL import Image, ImageDraw, ImageFont, ImageFilter

OUT_IMG = pathlib.Path('D:/carddex/public/football')
DATA_FILE = pathlib.Path('D:/carddex/public/data/football-meta.json')
OUT_IMG.mkdir(parents=True, exist_ok=True)

PLAYERS = [
    {
        "code": "messi-10",
        "wiki": "Lionel_Messi",
        "name": "Lionel Messi",
        "rarity": "Legend",
        "club": "Inter Miami CF",
        "season": "2024-25",
        "number": "10",
        "theme": (230, 240, 255),
        "border": (30, 100, 200)
    },
    {
        "code": "ronaldo-7",
        "wiki": "Cristiano_Ronaldo",
        "name": "Cristiano Ronaldo",
        "rarity": "Legend",
        "club": "Al Nassr",
        "season": "2024-25",
        "number": "7",
        "theme": (255, 240, 220),
        "border": (220, 160, 20)
    },
    {
        "code": "haaland-9",
        "wiki": "Erling_Haaland",
        "name": "Erling Haaland",
        "rarity": "Rare",
        "club": "Manchester City",
        "season": "2024-25",
        "number": "9",
        "theme": (220, 245, 255),
        "border": (80, 160, 230)
    },
    {
        "code": "mbappe-9",
        "wiki": "Kylian_Mbappé",
        "name": "Kylian Mbappé",
        "rarity": "Rare",
        "club": "Real Madrid",
        "season": "2024-25",
        "number": "9",
        "theme": (250, 250, 250),
        "border": (70, 70, 100)
    },
    {
        "code": "bellingham-5",
        "wiki": "Jude_Bellingham",
        "name": "Jude Bellingham",
        "rarity": "Rare",
        "club": "Real Madrid",
        "season": "2024-25",
        "number": "5",
        "theme": (245, 245, 255),
        "border": (90, 80, 140)
    },
    {
        "code": "de-bruyne-10",
        "wiki": "Kevin_De_Bruyne",
        "name": "Kevin De Bruyne",
        "rarity": "Rare",
        "club": "Manchester City",
        "season": "2024-25",
        "number": "17",
        "theme": (220, 245, 255),
        "border": (80, 160, 230)
    },
    {
        "code": "griezmann-7",
        "wiki": "Antoine_Griezmann",
        "name": "Antoine Griezmann",
        "rarity": "Common",
        "club": "Atlético_Madrid",
        "season": "2024-25",
        "number": "7",
        "theme": (255, 230, 230),
        "border": (200, 40, 40)
    },
    {
        "code": "pedri-8",
        "wiki": "Pedri",
        "name": "Pedri",
        "rarity": "Common",
        "club": "FC Barcelona",
        "season": "2024-25",
        "number": "8",
        "theme": (230, 230, 255),
        "border": (150, 20, 50)
    },
    {
        "code": "salah-11",
        "wiki": "Mohamed_Salah",
        "name": "Mohamed Salah",
        "rarity": "Rare",
        "club": "Liverpool",
        "season": "2024-25",
        "number": "11",
        "theme": (255, 230, 230),
        "border": (200, 30, 30)
    },
    {
        "code": "vene-23",
        "wiki": "Vinícius_Júnior",
        "name": "Vinícius Júnior",
        "rarity": "Rare",
        "club": "Real Madrid",
        "season": "2024-25",
        "number": "7",
        "theme": (250, 250, 250),
        "border": (70, 70, 100)
    }
]

def fetch_wiki_image(title):
    try:
        url = f"https://en.wikipedia.org/w/api.php?action=query&titles={urllib.parse.quote(title)}&prop=pageimages&format=json&pithumbsize=600"
        req = urllib.request.Request(url, headers={'User-Agent': 'CardDexBot/1.0 (contact@carddex.app)'})
        with urllib.request.urlopen(req, timeout=12) as r:
            data = json.loads(r.read().decode())
            pages = data.get("query", {}).get("pages", {})
            for pid in pages:
                src = pages[pid].get("thumbnail", {}).get("source")
                if src:
                    img_req = urllib.request.Request(src, headers={'User-Agent': 'CardDexBot/1.0 (contact@carddex.app)'})
                    with urllib.request.urlopen(img_req, timeout=15) as img_r:
                        return Image.open(io.BytesIO(img_r.read())).convert('RGB')
    except Exception as e:
        print(f"Failed to fetch wiki image for {title}: {e}")
    return None

meta = {}
card_w, card_h = 360, 500

for p in PLAYERS:
    code = p["code"]
    clean_code = f"fb-{code}"
    print(f"Processing {p['name']} ({clean_code})...", flush=True)

    photo = fetch_wiki_image(p["wiki"])

    # Render card
    card = Image.new('RGB', (card_w, card_h), color=p["theme"])
    draw = ImageDraw.Draw(card)

    # Outer Card Frame
    border_col = p["border"]
    draw.rectangle([8, 8, card_w - 9, card_h - 9], outline=border_col, width=4)
    draw.rectangle([14, 14, card_w - 15, card_h - 15], outline=(200, 200, 200), width=1)

    # Header area
    draw.rectangle([16, 16, card_w - 17, 60], fill=border_col)
    draw.text((26, 26), p["name"].upper(), fill=(255, 255, 255))
    draw.text((card_w - 60, 26), f"#{p['number']}", fill=(255, 255, 255))

    # Photo area
    photo_box = (20, 70, card_w - 20, 360)
    pw = photo_box[2] - photo_box[0]
    ph = photo_box[3] - photo_box[1]

    if photo:
        # Aspect crop
        aspect = photo.width / photo.height
        target_aspect = pw / ph
        if aspect > target_aspect:
            nw = int(photo.height * target_aspect)
            x0 = (photo.width - nw) // 2
            photo = photo.crop((x0, 0, x0 + nw, photo.height))
        else:
            nh = int(photo.width / target_aspect)
            y0 = (photo.height - nh) // 4 # bias towards head
            photo = photo.crop((0, y0, photo.width, y0 + nh))
        photo = photo.resize((pw, ph), Image.LANCZOS)
        card.paste(photo, (photo_box[0], photo_box[1]))
    else:
        draw.rectangle(photo_box, fill=(180, 180, 180))
        draw.text((photo_box[0] + 40, photo_box[1] + 100), "NO PHOTO", fill=(50, 50, 50))

    draw.rectangle(photo_box, outline=border_col, width=2)

    # Stats / Meta footer
    draw.rectangle([16, 370, card_w - 17, card_h - 17], fill=(245, 245, 245))
    draw.text((26, 380), f"Club: {p['club']}", fill=(30, 30, 30))
    draw.text((26, 405), f"Season: {p['season']} · {p['rarity']}", fill=(60, 60, 60))
    draw.text((26, 440), f"CODE: {clean_code}", fill=(120, 120, 120))

    # Corner code for OCR simulation
    draw.text((card_w - 110, card_h - 38), f"{p['number']}/100", fill=(50, 50, 50))

    # Save standard size
    final_card = card.resize((268, 374), Image.LANCZOS)
    img_dest = OUT_IMG / f"{clean_code}.jpg"
    final_card.save(img_dest, 'JPEG', quality=90)
    print(f"Saved {img_dest}", flush=True)

    meta[code] = [p["name"], p["rarity"], p["club"], p["season"]]

DATA_FILE.write_text(json.dumps(meta, ensure_ascii=False, indent=2), encoding='utf-8')
print("Successfully generated real football card photos and metadata!", flush=True)
