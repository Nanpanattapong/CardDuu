import json, time, urllib.request, os
from datetime import datetime, timezone

OUT = 'D:/carddex/public/data/prices.json'
TYPES_OUT = 'D:/carddex/public/data/card-types.json'  # ธาตุ/ประเภท ใช้กรองในหน้าฐานข้อมูล
USD, EUR = 35, 38
prices, types = {}, {}
page, total, fetched = 1, 0, 0

print('กำลังดึงราคาทั้งหมดจาก pokemontcg.io...')
while True:
    try:
        url = f'https://api.pokemontcg.io/v2/cards?page={page}&pageSize=250&select=id,tcgplayer,cardmarket,types,supertype'
        req = urllib.request.Request(url, headers={'User-Agent': 'carddex'})
        res = json.load(urllib.request.urlopen(req, timeout=30))
        if not total: total = res.get('totalCount', 0)
        data = res.get('data', [])
        for c in data:
            # โปเกมอนใช้ธาตุแรก, Trainer/Energy ใช้ supertype
            types[c['id']] = (c.get('types') or [c.get('supertype') or ''])[0]
            tp =(c.get('tcgplayer') or {}).get('prices') or {}
            usd = (tp.get('holofoil') or {}).get('market') or (tp.get('normal') or {}).get('market') or (tp.get('reverseHolofoil') or {}).get('market') or (tp.get('unlimitedHolofoil') or {}).get('market')
            cm = (c.get('cardmarket') or {}).get('prices') or {}
            eur = cm.get('averageSellPrice') or cm.get('trendPrice')
            m = round(usd * USD) if usd else None
            c_thb = round(eur * EUR) if eur else None
            if m or c_thb: prices[c['id']] = {'m': m, 'c': c_thb, 'usd': usd}
        fetched += len(data)
        print(f'หน้า {page}: ดึงแล้ว {len(prices)} ใบ ({fetched}/{total})')
        if fetched >= total or not data: break
        page += 1
        time.sleep(0.5)
    except Exception as e:
        print(f'หน้า {page} error: {e}')
        time.sleep(2)

json.dump({'generatedAt': datetime.now(timezone.utc).isoformat(), 'count': len(prices), 'prices': prices}, open(OUT, 'w', encoding='utf-8'), separators=(',', ':'))
json.dump(types, open(TYPES_OUT, 'w', encoding='utf-8'), separators=(',', ':'))
print(f'เสร็จ! ได้ราคา {len(prices)} ใบ เขียนลง {OUT} + ธาตุ {len(types)} ใบ ลง {TYPES_OUT}')
