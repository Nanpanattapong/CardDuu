# ทดสอบ pipeline สแกนแบบเดียวกับหน้าเว็บ (scan.js) บนเครื่อง: python scripts/probe-scan.py รูป.jpg [conf]
# YOLO-OBB → pickCards → ครอปตั้งตรง → DINOv2 → เทียบ card-emb.bin → 5 ใบที่ใกล้สุด
import sys, json, math
import numpy as np, onnxruntime as ort
from PIL import Image

D = 'D:/carddex/public'
img = Image.open(sys.argv[1]).convert('RGB')
CONF = float(sys.argv[2]) if len(sys.argv) > 2 else 0.25
W, H = img.size

r = min(640 / W, 640 / H); nw, nh = round(W * r), round(H * r)
left, top = round((640 - nw) / 2 - 0.1), round((640 - nh) / 2 - 0.1)
canvas = Image.new('RGB', (640, 640), (114, 114, 114)); canvas.paste(img.resize((nw, nh), Image.BILINEAR), (left, top))
x = np.asarray(canvas, np.float32).transpose(2, 0, 1)[None] / 255
det = ort.InferenceSession(f'{D}/models/card-detect.onnx')
out = det.run(None, {'images': x})[0][0]  # 6×8400
cand = [dict(cx=out[0, i], cy=out[1, i], w=out[2, i], h=out[3, i], conf=out[4, i], r=out[5, i]) for i in np.argsort(-out[4]) if out[4, i] >= CONF][:20]
boxes = []
for b in cand:
    if b['w'] < b['h']: b['w'], b['h'], b['r'] = b['h'], b['w'], b['r'] + math.pi / 2
    b['r'] %= math.pi
    boxes.append(dict(cx=(b['cx'] - left) / r, cy=(b['cy'] - top) / r, w=b['w'] / r, h=b['h'] / r, r=b['r'], conf=float(b['conf'])))
print(f'max conf: {round(float(out[4].max()), 3)}')
print(f'boxes: {len(boxes)} ({[(round(b["conf"], 3), round(b["w"] / b["h"], 2)) for b in boxes[:3]]})')

def inside(p, o):
    dx, dy, c, s = p['cx'] - o['cx'], p['cy'] - o['cy'], math.cos(o['r']), math.sin(o['r'])
    return abs(dx * c + dy * s) <= o['w'] / 2 and abs(-dx * s + dy * c) <= o['h'] / 2
fit = lambda o: o['conf'] * math.exp(-3 * abs(math.log(o['w'] / o['h'] / (88 / 63))))
keep = []
for b in sorted([o for o in boxes if o['w'] / o['h'] < 2], key=fit, reverse=True):
    if not any(inside(b, k) or inside(k, b) for k in keep): keep.append(b)
if not keep:
    # ไม่เจอกรอบ → ลองครอปกลางภาพหลายขนาด (สัดส่วน = ความสูงการ์ด / ความสูงภาพ)
    for f in (0.5, 0.6, 0.7, 0.8, 0.9):
        long = min(H, W * 88 / 63) * f
        keep.append(dict(cx=W / 2, cy=H / 2, w=long, h=long * 63 / 88, r=math.pi / 2, f=f))

def crop(o, outW=252):
    outH = round(outW * 88 / 63)
    ux, uy = math.cos(o['r']), math.sin(o['r'])
    if uy > 0: ux, uy = -ux, -uy
    rx, ry = -uy, ux
    tl = (o['cx'] + ux * o['w'] / 2 - rx * o['h'] / 2, o['cy'] + uy * o['w'] / 2 - ry * o['h'] / 2)
    a, b, d, e = rx * o['h'] / outW, -ux * o['w'] / outH, ry * o['h'] / outW, -uy * o['w'] / outH
    return img.transform((outW, outH), Image.AFFINE, (a, b, tl[0], d, e, tl[1]), Image.BILINEAR)

emb = ort.InferenceSession(f'{D}/models/card-embed.onnx')
E = np.fromfile(f'{D}/data/card-emb.bin', np.int8).reshape(-1, 384).astype(np.float32)
codes = json.load(open(f'{D}/data/card-emb-codes.json'))
mean, std = np.array([0.485, 0.456, 0.406], np.float32), np.array([0.229, 0.224, 0.225], np.float32)
for i, o in enumerate(keep):
    c = crop(o)
    t = ((np.asarray(c.resize((224, 224), Image.BILINEAR), np.float32) / 255 - mean) / std).transpose(2, 0, 1)[None]
    v = emb.run(None, {'images': t})[0][0]; v /= np.linalg.norm(v)
    s = E @ v / 127
    print(f'box {i} f={o.get("f")}:', [(codes[j], round(float(s[j]), 3)) for j in np.argsort(-s)[:5]])
