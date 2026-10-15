#!/usr/bin/env python3
# ดึงการ์ดยูกิทั้งหมดจาก YGOPRODeck → D:/yugioh_dataset (cards.json + images/{id}.jpg)
# กติกา YGOPRODeck: ห้าม hotlink รูป ต้องโหลดครั้งเดียวแล้วโฮสต์เอง, เกิน 20 req/s โดนแบน → จำกัด ~8 รูป/วินาที
# รันซ้ำได้: รูปที่มีแล้วข้าม
# รัน: D:\yolo-venv\Scripts\python scripts/fetch-yugioh.py
import json, time, threading, urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

OUT = Path('D:/yugioh_dataset')
IMG = OUT / 'images'
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

def fetch(art_id):
    p = IMG / f'{art_id}.jpg'
    if p.exists() and p.stat().st_size > 1000: return 'skip'
    for attempt in range(3):
        throttle()
        try:
            p.write_bytes(get(f'https://images.ygoprodeck.com/images/cards_small/{art_id}.jpg'))
            return 'ok'
        except Exception as e:
            err = e; time.sleep(2 * (attempt + 1))
    return f'fail {err}'

if __name__ == '__main__':
    IMG.mkdir(parents=True, exist_ok=True)
    cards = json.loads(get('https://db.ygoprodeck.com/api/v7/cardinfo.php'))['data']
    (OUT / 'cards.json').write_text(json.dumps(cards, ensure_ascii=False), encoding='utf-8')
    arts = [im['id'] for c in cards for im in c['card_images']]
    print(f'cards {len(cards)}, artworks {len(arts)}', flush=True)
    done = {'ok': 0, 'skip': 0, 'fail': 0}
    with ThreadPoolExecutor(4) as ex:
        for i, r in enumerate(ex.map(fetch, arts)):
            done[r.split()[0]] += 1
            if r.startswith('fail'): print(r, flush=True)
            if i % 500 == 0: print(f'{i}/{len(arts)} {done}', flush=True)
    print('done', done, flush=True)
