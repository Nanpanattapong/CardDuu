import { useEffect, useRef } from 'react';
import { corners } from '../lib/obb.js';

export default function CardOverlay({ src, detectedCards = [] }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!src || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      ctx.drawImage(img, 0, 0);

      detectedCards.forEach((c, i) => {
        const pts = corners(c.obb);

        // กรอบเขียว = รู้ว่าใบไหน, แดง = ไม่ตรงกับการ์ดโปเกมอนในฐานข้อมูล (แบบโค้ด Python)
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(pts[0][0], pts[0][1]);
        pts.slice(1).forEach((p) => ctx.lineTo(p[0], p[1]));
        ctx.closePath();

        ctx.strokeStyle = !c.known ? '#ef4444' : '#22c55e';
        ctx.lineWidth = Math.max(3, Math.round(img.naturalWidth / 200));
        ctx.shadowColor = 'rgba(0,0,0,0.5)';
        ctx.shadowBlur = 6;
        ctx.stroke();

        // พื้นหลังป้ายข้อความบนหัวกรอบ — เลขตรงกับ "ใบที่ n" ในรายการใต้รูป
        const label = `${i + 1} · ${c.known ? c.name : 'ไม่รู้จัก'}`;
        const fontSize = Math.max(12, Math.round(img.naturalWidth / 40));
        ctx.font = `600 ${fontSize}px sans-serif`;
        const textW = ctx.measureText(label).width;
        const pad = 6;

        // ป้ายอยู่กลางใบตามแนวนอน ชิดขอบบนด้านใน — ถ้าวางที่มุมบนสุด กรอบเอียงนิดเดียวป้ายจะเลื่อนไปทับใบข้างๆ
        const topY = Math.min(...pts.map((p) => p[1]));
        const lx = Math.max(pad, Math.min(c.obb.cx - textW / 2, img.naturalWidth - textW - pad));
        const ly = topY + fontSize + pad * 2;

        ctx.fillStyle = !c.known ? 'rgba(220, 38, 38, 0.9)' : 'rgba(15, 23, 42, 0.85)';
        ctx.beginPath();
        ctx.roundRect(lx - pad, ly - fontSize - pad, textW + pad * 2, fontSize + pad * 2, 6);
        ctx.fill();

        ctx.fillStyle = '#ffffff';
        ctx.fillText(label, lx, ly - pad / 2);
        ctx.restore();
      });
    };
    img.src = src;
  }, [src, detectedCards]);

  return (
    <div style={{ position: 'relative', width: '100%', maxWidth: 520, margin: '0 auto', borderRadius: 12, overflow: 'hidden', border: '1px solid var(--border)' }}>
      <canvas ref={canvasRef} style={{ width: '100%', height: 'auto', display: 'block', background: 'var(--plate)' }} />
    </div>
  );
}
