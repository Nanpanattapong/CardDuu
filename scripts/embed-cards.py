#!/usr/bin/env python3
# ฝังภาพการ์ดทั้งหมดด้วย DINOv2-small → public/data/card-emb.bin (int8, 384 มิติ/ใบ) + card-emb-codes.json
# ใช้คู่กับ public/models/card-embed.onnx (export ด้วย --export) ให้หน้าเว็บค้นการ์ดด้วย cosine similarity
# รัน: D:\yolo-venv\Scripts\python scripts/embed-cards.py [--export | --yugioh]
# --onepiece = รูปจาก scripts/fetch-onepiece.py (public/onepiece/*.jpg) → card-emb-onepiece.bin
# --football = รูปจาก public/football/*.jpg → card-emb-football.bin
import json, sys
from pathlib import Path
import numpy as np, timm, torch
from PIL import Image

SRC = Path('D:/pokemon_dataset_ready/content/pokemon_dataset_temp')
OUT = Path('D:/carddex/public/data')
YGO = '--yugioh' in sys.argv
OP = '--onepiece' in sys.argv
FB = '--football' in sys.argv
MEAN, STD = np.array([0.485, 0.456, 0.406], np.float32), np.array([0.229, 0.224, 0.225], np.float32)

def model():
    return timm.create_model('vit_small_patch14_dinov2.lvd142m', pretrained=True, num_classes=0, img_size=224).eval()

# การ์ด → บีบเป็น 224×224 (หน้าเว็บทำแบบเดียวกันใน src/lib/scan.js)
def prep(im):
    x = np.asarray(im.convert('RGB').resize((224, 224), Image.BILINEAR), np.float32) / 255
    return ((x - MEAN) / STD).transpose(2, 0, 1)

@torch.no_grad()
def embed(m, ims):
    e = m(torch.from_numpy(np.stack([prep(i) for i in ims]))).numpy()
    return e / np.linalg.norm(e, axis=1, keepdims=True)

if __name__ == '__main__':
    torch.set_num_threads(12)
    m = model()
    if '--export' in sys.argv:
        torch.onnx.export(m, torch.zeros(1, 3, 224, 224), 'public/models/card-embed.onnx',
                          input_names=['images'], output_names=['emb'], opset_version=17, dynamo=False)
        print('exported'); sys.exit()
    if YGO:
        files = sorted(Path('D:/carddex/public/ygo').glob('*.jpg'))
    elif OP:
        files = sorted(Path('D:/carddex/public/onepiece').glob('*.jpg'))
    elif FB:
        files = sorted(Path('D:/carddex/public/football').glob('*.jpg'))
    else:
        files = sorted(f for d in SRC.iterdir() if d.is_dir() for f in d.glob('*.png'))

    print(f'found {len(files)} files to embed', flush=True)
    codes, embs = [], []
    for i in range(0, len(files), 64):
        batch = files[i:i + 64]
        embs.append(embed(m, [Image.open(f) for f in batch]))
        if YGO: prefix = 'ygo-'
        elif OP: prefix = 'op-'
        elif FB: prefix = 'fb-'
        else: prefix = ''
        codes += [prefix + f.stem for f in batch]
        if i % 1280 == 0: print(f'{i}/{len(files)}', flush=True)
    E = np.concatenate(embs)
    if YGO: sfx = '-yugioh'
    elif OP: sfx = '-onepiece'
    elif FB: sfx = '-football'
    else: sfx = ''
    np.save(f'D:/yolo-venv/card-emb{sfx}-f32.npy', E)  # float32 ไว้ทดสอบเทียบกับ int8
    (OUT / f'card-emb{sfx}.bin').write_bytes(np.clip(np.round(E * 127), -127, 127).astype(np.int8).tobytes())
    (OUT / f'card-emb-codes{sfx}.json').write_text(json.dumps(codes))
    print(f'saved {len(codes)} x {E.shape[1]}')
