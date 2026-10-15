#!/usr/bin/env python3
# ดึงการ์ดวันพีซทุกชุดจาก OPTCG API (optcgapi.com) → D:/onepiece_dataset/cards.json + public/onepiece/{card_image_id}.jpg
# รูปต้นฉบับ 600×838 (~150KB) → ย่อเหลือกว้าง 268 แบบรูปยูกิ (~25KB) ให้ dist เล็ก
# API ฟรีบน VPS ของคนทำ (ขอให้ไม่ยิงถี่) → ~8 รูป/วินาที, รันซ้ำได้: รูปที่มีแล้วข้าม
# รัน: D:\yolo-venv\Scripts\python scripts/fetch-onepiece.py
import io, json, time, threading, urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from PIL import Image

OUT = Path('D:/onepiece_dataset')
IMG = Path('D:/carddex/public/onepiece')
UA = {'User-Agent': 'CardDuu/1.0 (card scanner; one-time image mirror)'}

def get(url):
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=30) as r:
        return r.read()

lock, last = threading.Lock(), [0.0]
def throttle(gap=0.125):
    with lock:
        wait = last[0] + gap - time.time()
        if wait > 0: time.sleep(wait)
        last[0] = time.time()

def fetch(card):
    p = IMG / f"{card['card_image_id']}.jpg"
    if p.exists() and p.stat().st_size > 1000: return 'skip'
    for attempt in range(3):
        throttle()
        try:
            im = Image.open(io.BytesIO(get(card['card_image']))).convert('RGB')
            im.resize((268, round(268 * im.height / im.width)), Image.LANCZOS).save(p, 'JPEG', quality=85)
            return 'ok'
        except Exception as e:
            err = e; time.sleep(2 * (attempt + 1))
    return f"fail {card['card_image_id']} {err}"

if __name__ == '__main__':
    IMG.mkdir(parents=True, exist_ok=True); OUT.mkdir(exist_ok=True)
    cards = []
    for ep in ['allSetCards', 'allSTCards', 'allPromoCards']:
        try:
            got = json.loads(get(f'https://optcgapi.com/api/{ep}/'))
            print(ep, len(got), flush=True); cards += got
        except Exception as e:
            print(ep, 'FAILED', e, flush=True)  # ตอนเช็ค allPromoCards ตอบไม่ใช่ JSON → ข้ามไปก่อน
    # ใบเดียวกันอาจอยู่หลายชุด (ST/พิมพ์ซ้ำ) → 1 รูป = 1 รายการ; พาราเรล/อาร์ตพิเศษมี card_image_id ของตัวเอง
    cards = list({c['card_image_id']: c for c in cards if c.get('card_image_id') and c.get('card_image')}.values())
    (OUT / 'cards.json').write_text(json.dumps(cards, ensure_ascii=False), encoding='utf-8')
    print(f'artworks {len(cards)}', flush=True)
    done = {'ok': 0, 'skip': 0, 'fail': 0}
    with ThreadPoolExecutor(4) as ex:
        for i, r in enumerate(ex.map(fetch, cards)):
            done[r.split()[0]] += 1
            if r.startswith('fail'): print(r, flush=True)
            if i % 500 == 0: print(f'{i}/{len(cards)} {done}', flush=True)
    print('done', done, flush=True)
