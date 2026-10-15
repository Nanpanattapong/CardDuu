// Module worker: ดาวน์โหลดโมเดล + onnxruntime ครั้งเดียว, เธรดนี้รัน inference → main ไม่ค้าง
import { decodeObb } from './obb.js';

const sess = {};

async function ortSess(model) {
  if (sess[model]) return sess[model];
  const ort = await import('onnxruntime-web/wasm');
  const res = await fetch(model);
  if (!res.ok) throw new Error(`โหลดโมเดลไม่ได้ ${res.status}`);
  const bytes = new Uint8Array(await res.arrayBuffer());
  return (sess[model] = await ort.InferenceSession.create(bytes, { executionProviders: ['wasm'] }));
}

// ค่าเดียวกับ prep() ใน scripts/embed-cards.py
const MEAN = [0.485, 0.456, 0.406], STD = [0.229, 0.224, 0.225];

self.onmessage = async (e) => {
  const { id, type, rgba640, lb, crops } = e.data;
  let ok = true, err = null, data = null;
  try {
    if (type === 'embed') {
      // crops = [RGBA 224×224] → DINOv2-small → เวกเตอร์ 384 มิติ (normalize แล้ว)
      const s = await ortSess('/models/card-embed.onnx');
      const ort = await import('onnxruntime-web/wasm');
      data = [];
      for (const px of crops) {
        const chw = new Float32Array(3 * 224 * 224);
        for (let i = 0; i < 224 * 224; i++) {
          for (let ch = 0; ch < 3; ch++) chw[ch * 224 * 224 + i] = (px[i * 4 + ch] / 255 - MEAN[ch]) / STD[ch];
        }
        const out = await s.run({ images: new ort.Tensor('float32', chw, [1, 3, 224, 224]) });
        const v = out.emb.data;
        let n = 0;
        for (const x of v) n += x * x;
        n = Math.sqrt(n);
        data.push(Array.from(v, (x) => Math.round((x / n) * 1e4) / 1e4));
      }
    } else if (type === 'infer') {
      const s = await ortSess('/models/card-detect.onnx');
      const ort = await import('onnxruntime-web/wasm');
      // RGBA → RGB float32 CHW
      const chw = new Float32Array(3 * 640 * 640);
      for (let i = 0; i < 640 * 640; i++) {
        const j = i * 4;
        chw[i] = rgba640[j] / 255;
        chw[640 * 640 + i] = rgba640[j + 1] / 255;
        chw[2 * 640 * 640 + i] = rgba640[j + 2] / 255;
      }
      const out = await s.run({ images: new ort.Tensor('float32', chw, [1, 3, 640, 640]) });
      const raw = out[s.outputNames[0]].data;
      data = decodeObb(raw, 8400, lb).slice(0, 12);
    } else throw new Error(`unknown ${type}`);
  } catch (ex) {
    ok = false; err = String(ex?.message || ex);
  }
  self.postMessage({ id, ok, err, data });
};
