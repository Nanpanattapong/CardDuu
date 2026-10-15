// ถอดผลโมเดล YOLOv8-OBB (public/models/card-detect.onnx) — output0 [1, 6, 8400] = cx,cy,w,h,conf,angle
// ทำตาม ultralytics: conf ≥ 0.25 → NMS แบบ probiou (iou 0.7) → w ≥ h, มุม ∈ [0,π) → ย้อน letterbox กลับพิกัดภาพจริง

const cov = ({ w, h, r }) => {
  const a = (w * w) / 12, b = (h * h) / 12, c = Math.cos(r), s = Math.sin(r);
  return [a * c * c + b * s * s, a * s * s + b * c * c, (a - b) * c * s];
};

export function probiou(p, q, eps = 1e-7) {
  const [a1, b1, c1] = cov(p), [a2, b2, c2] = cov(q);
  const A = a1 + a2, B = b1 + b2, C = c1 + c2, den = A * B - C * C;
  const t1 = ((A * (p.cy - q.cy) ** 2 + B * (p.cx - q.cx) ** 2) / (den + eps)) * 0.25;
  const t2 = ((C * (q.cx - p.cx) * (p.cy - q.cy)) / (den + eps)) * 0.5;
  const t3 = Math.log(den / (4 * Math.sqrt(Math.max(a1 * b1 - c1 * c1, 0) * Math.max(a2 * b2 - c2 * c2, 0)) + eps) + eps) * 0.5;
  const bd = Math.min(Math.max(t1 + t2 + t3, eps), 100);
  return 1 - Math.sqrt(1 - Math.exp(-bd) + eps);
}

export function decodeObb(data, n, lb, conf = 0.25, iou = 0.7) {
  const cand = [];
  for (let i = 0; i < n; i++) {
    const score = data[4 * n + i];
    if (score < conf) continue;
    cand.push({ cx: data[i], cy: data[n + i], w: data[2 * n + i], h: data[3 * n + i], r: data[5 * n + i], conf: score });
  }
  cand.sort((a, b) => b.conf - a.conf);
  const keep = [];
  for (const c of cand) if (keep.every((k) => probiou(k, c) < iou)) keep.push(c);
  return keep.map((b) => {
    const swap = b.w < b.h;
    let r = (swap ? b.r + Math.PI / 2 : b.r) % Math.PI;
    if (r < 0) r += Math.PI;
    return {
      cx: (b.cx - lb.left) / lb.r, cy: (b.cy - lb.top) / lb.r,
      w: (swap ? b.h : b.w) / lb.r, h: (swap ? b.w : b.h) / lb.r, r, conf: b.conf,
    };
  });
}

// YOLO มักให้กรอบครึ่งใบ (มั่นใจสูง) ซ้อนกับกรอบเต็มใบ → ให้คะแนนตาม conf × ความใกล้สัดส่วนการ์ด 88/63
// แล้วเก็บทีละกรอบ ทิ้งกรอบที่จุดกลางตกอยู่ในกรอบที่เก็บไปแล้ว (= การ์ดใบเดียวกัน)
const inside = (p, o) => {
  const dx = p.cx - o.cx, dy = p.cy - o.cy, c = Math.cos(o.r), s = Math.sin(o.r);
  return Math.abs(dx * c + dy * s) <= o.w / 2 && Math.abs(-dx * s + dy * c) <= o.h / 2;
};
// กรอบยาวเกิน 2:1 = ครึ่งใบ (การ์ดจริง 1.40, เอียง/ในซองวัดได้ถึง ~1.9) → ไม่ใช้ตรงๆ ครอปครึ่งใบไปเทียบจะได้การ์ดผิดใบ
// ไม่เหลือกรอบเลย → detectAndIdentify ใช้ทั้งรูปแทน
const dedupe = (bs, key, keep = []) => {
  for (const b of [...bs].sort((a, b) => key(b) - key(a))) {
    if (!keep.some((k) => inside(b, k) || inside(k, b))) keep.push(b);
  }
  return keep;
};
// การ์ดในซอง/ถือในมือ YOLO ให้แต่กรอบครึ่งใบ (2–4:1) → ยืดด้านสั้นให้เต็มใบ (63:88) ไปทางกลางภาพ
// ponytail: เดาทิศจากกลางภาพ ถูกเกือบทุกรูปถือการ์ด แก้จริง = เทรน YOLO ด้วยรูปการ์ดในซอง/ในมือ
const grow = (t, W, H) => {
  const h = (t.w * 63) / 88, d = (h - t.h) / 2, px = -Math.sin(t.r), py = Math.cos(t.r);
  const k = (W / 2 - t.cx) * px + (H / 2 - t.cy) * py > 0 ? 1 : -1;
  return { ...t, h, cx: t.cx + k * d * px, cy: t.cy + k * d * py };
};
export function pickCards(boxes, W, H) {
  const fit = (o) => o.conf * Math.exp(-3 * Math.abs(Math.log(o.w / o.h / (88 / 63))));
  const keep = dedupe(boxes.filter((o) => o.w / o.h < 2), fit);
  const thin = dedupe(boxes.filter((o) => o.w / o.h >= 2 && o.w / o.h < 4), (o) => o.conf);
  for (const t of thin) {
    const g = grow(t, W, H);
    if (!keep.some((k) => inside(g, k) || inside(k, g))) keep.push(g);
  }
  return keep;
}

// มุมทั้ง 4 ของกรอบเอียง (สำหรับวาด polygon)
export function corners({ cx, cy, w, h, r }) {
  const c = Math.cos(r), s = Math.sin(r);
  const v1 = [(w / 2) * c, (w / 2) * s], v2 = [(-h / 2) * s, (h / 2) * c];
  return [[1, 1], [1, -1], [-1, -1], [-1, 1]].map(([i, j]) => [cx + i * v1[0] + j * v2[0], cy + i * v1[1] + j * v2[1]]);
}
