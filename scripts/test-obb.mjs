// node scripts/test-obb.mjs — ถอด output ONNX ด้วย src/lib/obb.js แล้วเทียบกับผล ultralytics (fixture)
import { readFileSync } from 'node:fs';
import assert from 'node:assert';
import { decodeObb, pickCards } from '../src/lib/obb.js';

const f = JSON.parse(readFileSync(new URL('./fixtures/obb-sample.json', import.meta.url)));
const n = f.cols.length, data = new Float32Array(6 * n);
f.cols.forEach((c, i) => c.forEach((v, k) => { data[k * n + i] = v; }));

const got = decodeObb(data, n, f);
assert.equal(got.length, f.expected.length, `ได้ ${got.length} กรอบ ควรได้ ${f.expected.length}`);
for (const [cx, cy, w, h, r] of f.expected) {
  const m = got.find((g) => Math.hypot(g.cx - cx, g.cy - cy) < 2);
  assert.ok(m, `ไม่เจอกรอบที่ ${cx.toFixed(1)},${cy.toFixed(1)}`);
  assert.ok(Math.abs(m.w - w) < 2 && Math.abs(m.h - h) < 2 && Math.abs(m.r - r) < 0.02, `กรอบที่ ${cx.toFixed(1)} ขนาด/มุมไม่ตรง`);
}
console.log(`ok — ${got.length} กรอบตรงกับ ultralytics`);

// ลิซาร์ดอนในซองใส: YOLO ให้ครึ่งซ้าย (0.95) + เต็มใบ (0.80) + ครึ่งขวา (0.57) → ต้องได้กรอบเต็มใบกรอบเดียว
const zard = pickCards([
  { cx: 274.5, cy: 403.3, w: 569.2, h: 272.6, r: 1.59, conf: 0.95 },
  { cx: 352.4, cy: 402.0, w: 579.1, h: 440.6, r: 1.50, conf: 0.80 },
  { cx: 412.8, cy: 390.3, w: 580.6, h: 273.6, r: 1.57, conf: 0.57 },
], 700, 800);
assert.deepEqual(zard.map((b) => b.conf), [0.80], 'ควรเลือกกรอบเต็มใบ');
// การ์ดวางเรียงกันหลายใบ ไม่ซ้อนกัน → ต้องเก็บครบ
assert.equal(pickCards(got, f.W ?? 1e4, f.H ?? 1e4).length, got.length, 'การ์ดหลายใบที่ไม่ซ้อนกันต้องไม่ถูกตัด');
// การ์ด 2 ใบในมือ (รูป Dialga): YOLO ให้แต่ครึ่งซีก (ผ่าตามยาว) ของแต่ละใบ → ยืดด้านข้างไปทางกลางภาพจนเต็มใบ ได้ 2 กรอบ
const hand = pickCards([
  { cx: 300, cy: 250, w: 400, h: 160, r: 1.57, conf: 0.92 },
  { cx: 700, cy: 250, w: 400, h: 152, r: 1.57, conf: 0.91 },
], 1000, 800);
assert.equal(hand.length, 2, 'ครึ่งใบ 2 ใบต้องได้ 2 กรอบ');
assert.ok(hand.every((b) => Math.abs(b.w / b.h - 88 / 63) < 0.01), 'ต้องยืดเป็นสัดส่วนการ์ด');
assert.ok(hand[0].cx > 300 && hand[1].cx < 700, 'ต้องยืดไปทางกลางภาพ');
console.log('ok — pickCards');
