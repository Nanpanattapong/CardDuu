// ขั้น 1 (เครื่องผู้ใช้): YOLOv8-OBB (public/models/card-detect.onnx) หากรอบการ์ด → ครอปตั้งตรง → DINOv2 (card-embed.onnx) เป็นเวกเตอร์
// ขั้น 2 (API): POST /api/identify เทียบเวกเตอร์กับการ์ด 20,670 ใบ → ใบไหน / ไม่รู้จัก
// ORT WASM รันใน web worker → main thread ไม่ค้าง
import { api } from '../lib.js';
import { loadIndex, loadYgoMeta, loadOpMeta } from './cards.js';
import { pickCards } from './obb.js';
import { createWorker } from 'tesseract.js';
import ScanWorker from './scan.worker.js?worker';

let _worker = null, _nextId = 1;
const _pend = new Map();
function workerCall(payload, transfer) {
  if (!_worker) {
    _worker = new ScanWorker();
    _worker.onmessage = (e) => {
      const { id, ok, err, data } = e.data;
      const p = _pend.get(id);
      if (!p) return;
      _pend.delete(id);
      ok ? p.resolve(data) : p.reject(new Error(err));
    };
  }
  const id = String(_nextId++);
  return new Promise((resolve, reject) => {
    _pend.set(id, { resolve, reject });
    _worker.postMessage({ id, type: 'infer', ...payload }, transfer);
  });
}

function loadImg(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onerror = () => reject(new Error('อ่านภาพไม่ได้'));
    img.onload = () => resolve(img);
    img.src = src;
  });
}

// letterbox แบบ ultralytics: ย่อให้ด้านยาว = 640 แล้วเติมขอบสีเทา 114
function to640(image) {
  const w = image.naturalWidth, h = image.naturalHeight;
  const r = Math.min(640 / w, 640 / h);
  const nw = Math.round(w * r), nh = Math.round(h * r);
  const left = Math.round((640 - nw) / 2 - 0.1), top = Math.round((640 - nh) / 2 - 0.1);
  const g = new OffscreenCanvas(640, 640).getContext('2d');
  g.fillStyle = '#727272';
  g.fillRect(0, 0, 640, 640);
  g.drawImage(image, left, top, nw, nh);
  return { rgba640: g.getImageData(0, 0, 640, 640).data, lb: { r, left, top } };
}

// ครอปกรอบเอียงให้เป็นการ์ดตั้งตรง 63:88 (แบบ getPerspectiveTransform ในโค้ด Python แต่กรอบเป็นสี่เหลี่ยมผืนผ้า affine ก็พอ)
// flip=true = หมุน 180° (การ์ดวางกลับหัว) — กรอบ OBB ไม่รู้ว่าด้านไหนคือหัวการ์ด เลยต้องลองทั้งสองทิศ
export function cropObb(img, obb, outW = 252, flip = false) {
  const outH = Math.round((outW * 88) / 63);
  // ด้านยาว (w) = แนวตั้งของการ์ด, หันขึ้นด้านบนของรูป (หรือลงถ้า flip)
  let ux = Math.cos(obb.r), uy = Math.sin(obb.r);
  if ((uy > 0) !== flip) { ux = -ux; uy = -uy; }
  const rx = -uy, ry = ux; // ขวามือของการ์ด
  const tl = [obb.cx + ux * obb.w / 2 - rx * obb.h / 2, obb.cy + uy * obb.w / 2 - ry * obb.h / 2];
  // canvas(u,v) → รูป: p = tl + u·(ขวา·h/outW) + v·(ลง·w/outH)  แล้วกลับด้านเป็น รูป → canvas
  const m00 = rx * obb.h / outW, m10 = ry * obb.h / outW, m01 = -ux * obb.w / outH, m11 = -uy * obb.w / outH;
  const det = m00 * m11 - m01 * m10;
  const a = m11 / det, b = -m10 / det, c = -m01 / det, d = m00 / det;
  const g = new OffscreenCanvas(outW, outH).getContext('2d');
  g.imageSmoothingQuality = 'high';
  g.setTransform(a, b, c, d, -(a * tl[0] + c * tl[1]), -(b * tl[0] + d * tl[1]));
  g.drawImage(img, 0, 0);
  return g.canvas;
}

// บีบเป็น 224×224 แบบเดียวกับ prep() ใน scripts/embed-cards.py
function rgba224(cv) {
  const g = new OffscreenCanvas(224, 224).getContext('2d');
  g.imageSmoothingQuality = 'high';
  g.drawImage(cv, 0, 0, 224, 224);
  return g.getImageData(0, 0, 224, 224).data;
}

const toDataUrl = (cv) => cv.convertToBlob({ type: 'image/jpeg', quality: 0.85 })
  .then((b) => new Promise((r) => { const f = new FileReader(); f.onload = () => r(f.result); f.readAsDataURL(b); }));

// อ่านเลขเฉพาะใบที่ DINOv2 ไม่มั่นใจ: ลดเวลารอบปกติ แต่เก็บทางช่วยแยกใบคล้ายกันไว้
let _ocrWorkerP = null;
async function ocrWorker() {
  if (_ocrWorkerP) return _ocrWorkerP;
  const w = await createWorker('eng');
  try { await w.setParameters({ tessedit_char_whitelist: '0123456789/ ', tessedit_pageseg_mode: '7' }); } catch {}
  _ocrWorkerP = w;
  return w;
}

async function ocrCardNumber(cv) {
  const w = cv.width, h = cv.height, zoneH = Math.round(h * 0.20), zoneW = Math.round(w * 0.55), scale = 3;
  const src = new OffscreenCanvas(zoneW, zoneH);
  src.getContext('2d').drawImage(cv, 0, h - zoneH, zoneW, zoneH, 0, 0, zoneW, zoneH);
  const up = new OffscreenCanvas(zoneW * scale, zoneH * scale);
  const g = up.getContext('2d');
  g.imageSmoothingEnabled = false;
  g.drawImage(src, 0, 0, zoneW * scale, zoneH * scale);
  const { data: { text } } = await (await ocrWorker()).recognize(up);
  const clean = String(text || '').replace(/[oO]/g, '0').replace(/(\d)\!/g, '$1/').replace(/\!(\d)/g, '/$1');
  const m = clean.match(/(\d{1,3})\s*[\/\!]\s*(\d{1,3})/);
  return m ? `${m[1].padStart(3, '0')}/${m[2].padStart(3, '0')}` : null;
}

// ทุกกรอบลอง 2 ทิศ (ตั้งตรง/กลับหัว) → เก็บทิศที่คะแนนสูงกว่า; API รับได้ 12 เวกเตอร์ = 6 กรอบ
// ponytail: รวมทุก crop ทั้งหมดส่งรอบเดียว ลดเวลา latency ของเครือข่ายมือถือ
async function identify(img, boxes, game) {
  if (!boxes.length) return [];
  const crops = boxes.flatMap((o) => [cropObb(img, o), cropObb(img, o, 252, true)]);
  const px = crops.map(rgba224);
  const vecs = await workerCall({ type: 'embed', crops: px }, px.map((p) => p.buffer));
  const { results } = await api('/api/identify', { method: 'POST', body: { vecs, game }, auth: false });

  const needsOcr = game === 'pokemon' && results.some((r, i) => r.score < 0.82 || (results[i ? i - 1 : i].code === r.code));
  const ocrCrops = needsOcr ? boxes.flatMap((o) => [cropObb(img, { ...o, w: o.w * 1.28 }), cropObb(img, { ...o, w: o.w * 1.28 }, 252, true)]) : [];

  // ชื่อสำหรับแมปเลขญี่ปุ่น→อังกฤษผ่าน TCGdex (API ส่งมาแค่รอบ OCR)
  let nameOf = () => '';
  if (needsOcr) {
    try {
      const idx = await loadIndex();
      const m = {};
      for (const [name, codes] of Object.entries(idx)) for (const c of codes) m[c] = name;
      nameOf = (c) => m[c] || c;
    } catch {}
  }

  return Promise.all(boxes.map(async (obb, i) => {
    const k0 = 2 * i, k1 = 2 * i + 1;
    let k = results[k1].score > results[k0].score + 0.05 ? k1 : k0;

    // ใบที่ DINOv2 มั่นใจแล้วข้าม OCR ไปเลย; ที่เหลืออ่านเลขบนการ์ดเพื่อแยกใบที่ภาพเหมือนกัน
    if (needsOcr && results[k].score < 0.82) {
      try {
        const num = await ocrCardNumber(ocrCrops[k]);
        if (num) {
          const hit = await api(`/api/ja-lookup?num=${encodeURIComponent(num)}&name=${encodeURIComponent(nameOf(results[k].code))}`, { auth: false });
          if (hit?.code) {
            const cand = results[k].candidates || [results[k]];
            const pos = cand.findIndex((c) => c.code === hit.code);
            const base = pos >= 0 ? cand[pos] : { code: hit.code, score: results[k].score };
            results[k] = { ...base, name: hit.name, score: Math.max(base.score, 0.8), candidates: cand, known: true, ocrMatch: true };
          }
        }
      } catch {}
    }

    return { obb, crop: crops[k], result: results[k] };
  }));
}

// → [{obb, crop, code, name, score, known}] เรียงตามตำแหน่งในรูป; known=false = ไม่ตรงกับการ์ดในฐานข้อมูล
// วัดบนภาพสังเคราะห์ 120 ภาพ (การ์ดไทยบนพื้นลาย สุ่มขนาด/มุม): แบบเดิม 57% → แบบนี้ 78%
// game = 'pokemon' | 'yugioh' | 'onepiece' → เทียบกับฐานเวกเตอร์ของเกมนั้น (YOLO/DINOv2 ใช้ตัวเดียวกัน)
export async function detectAndIdentify(src, game = 'pokemon') {
  const img = await loadImg(src);
  const { rgba640, lb } = to640(img);
  const namesP = game === 'yugioh' ? loadYgoMeta().then((m) => (c) => m[c.slice(4)]?.[0])
    : game === 'onepiece' ? loadOpMeta().then((m) => (c) => m[c.slice(3)]?.[0])
    : loadIndex().then((idx) => {
    const codeToName = {};
    for (const [name, codes] of Object.entries(idx)) for (const c of codes) codeToName[c] = name;
    return (c) => codeToName[c];
  });
  let found = await identify(img, pickCards(await workerCall({ rgba640, lb }, [rgba640.buffer]), img.naturalWidth, img.naturalHeight).slice(0, 6), game);
  // ถ้า YOLO ไม่เจอกรอบเลย (found.length === 0) ถึงค่อยลองครอปกลางภาพ ไม่ใช่ไปทับตอนที่เจอแล้วแต่คะแนนยังไม่สูง
  if (found.length === 0) {
    const W = img.naturalWidth, H = img.naturalHeight, long = Math.min(H, (W * 88) / 63);
    const c = (f, r) => ({ cx: W / 2, cy: H / 2, w: long * f, h: (long * f * 63) / 88, r, whole: true });
    const fb = await identify(img, [
      { cx: W / 2, cy: H / 2, w: Math.max(W, H), h: Math.min(W, H), r: W > H ? 0 : Math.PI / 2, whole: true },
      c(0.5, Math.PI / 2), c(0.6, Math.PI / 2), c(0.7, Math.PI / 2), c(0.85, Math.PI / 2), c(0.6, 0), // c(…, 0) = การ์ดวางนอน
    ], game);
    const best = fb.reduce((b, f) => (f.result.score > b.result.score ? f : b));
    if (!found.length || best.result.score > Math.max(...found.map((f) => f.result.score))) found = [best];
  }
  const nameOf = await namesP;
  const out = await Promise.all(found.map(async ({ obb, crop, result }) => {
    const { code, score, known, candidates } = result;
    const candList = candidates || [{ code, score }];
    return {
      obb,
      crop: await toDataUrl(crop),
      code,
      name: nameOf(code) || code,
      score,
      known,
      candidates: candList.map((c) => ({ code: c.code, name: nameOf(c.code) || c.code, score: c.score }))
    };
  }));
  // เรียงแบบอ่านหนังสือ: แถวบน→ล่าง ในแถวซ้าย→ขวา → "ใบที่ 1" ในรายการ = ใบซ้ายบนในรูป
  // แถวเดียวกัน = จุดกลางสูงต่างกันไม่เกินครึ่งด้านสั้นของกรอบ
  out.sort((a, b) => a.obb.cy - b.obb.cy);
  const rows = [];
  for (const c of out) {
    const row = rows.at(-1);
    if (row && c.obb.cy - row[0].obb.cy < row[0].obb.h / 2) row.push(c);
    else rows.push([c]);
  }
  return rows.flatMap((r) => r.sort((a, b) => a.obb.cx - b.obb.cx));
}
