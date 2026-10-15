// CardImage: ลดรูปจาก 3.2GB dataset ให้เป็น cdn hotlink + client cache
import { useEffect, useState } from 'react';
import React from 'react';

import { localCodes, noImageCodes } from './cdnMissing.js';

// CDN ไม่มีเซ็ตใหม่ (me*, mcd*) — ส่งรูปหลังการ์ดมาแทน → ใช้รูปจาก dataset ที่โฮสต์เองใน /cards/
export const imgUrl = (code) => {
  if (!code) return '';
  if (code.startsWith('ygo-')) return `/ygo/${code.slice(4)}.jpg`;
  if (code.startsWith('op-')) return `/onepiece/${code.slice(3)}.jpg`;
  if (code.startsWith('fb-')) return `/football/${code}.jpg`;
  return localCodes.has(code)
    ? `/cards/${code}.png`
    : `https://images.pokemontcg.io/${code.split('-')[0]}/${code.split('-').slice(1).join('/')}.png`;
};

// ไม่มีรูปจริงทั้ง CDN และ dataset (mcd14/15/17/18 ฯลฯ) → หน้าเว็บโชว์กล่อง "ไม่มีรูป" แทนรูปหลังการ์ด
export const hasImage = (code) => !noImageCodes.has(code);

// รหัสแรกที่มีรูปจริง (ถ้าไม่มีเลยก็คืนตัวแรก)
export const bestCode = (codes) => codes.find((c) => !noImageCodes.has(c)) || codes[0];

export const loadPrices = (() => {
  let p = null;
  return () => (p ??= fetch('/data/prices.json').then(r => r.json()).catch(() => ({ prices: {} })));
})();

export const loadIndex = (() => {
  let p = null;
  return () => (p ??= fetch('/data/card-index.json').then(r => r.json()).catch(() => ({})));
})();

// ยูกิ: {artId: [ชื่อ, ประเภท, ชุด, รหัสชุด, ความหายาก, ราคา USD]} จาก scripts/build-yugioh-meta.py
export const loadYgoMeta = (() => {
  let p = null;
  return () => (p ??= fetch('/data/yugioh-meta.json').then(r => r.json()).catch(() => { p = null; return {}; }));
})();

// วันพีซ: {artId: [ชื่อ, ชุด, ชนิด, ความหายาก, สี, ค่าใช้จ่าย, พลัง, ราคา USD]} จาก scripts/build-onepiece-meta.py
export const loadOpMeta = (() => {
  let p = null;
  return () => (p ??= fetch('/data/onepiece-meta.json').then(r => r.json()).catch(() => { p = null; return {}; }));
})();

// ฟุตบอล: {artId: [ชื่อ, ความหายาก, สโมสร, ฤดูกาล]}
export const loadFbMeta = (() => {
  let p = null;
  return () => (p ??= fetch('/data/football-meta.json').then(r => r.json()).catch(() => { p = null; return {}; }));
})();

export const THB_PER_USD = 35;
const META = {
  yugioh: { pre: 'ygo-', load: loadYgoMeta, set: (m) => m[2], type: (m) => m[1], rarity: (m) => m[4], usd: (m) => m[5] },
  onepiece: { pre: 'op-', load: loadOpMeta, set: (m) => m[1], type: (m) => [m[2], m[4]].filter(Boolean).join(' · '), rarity: (m) => m[3], usd: (m) => m[7] },
  football: { pre: 'fb-', load: loadFbMeta, set: (m) => m[2], type: (m) => m[0], rarity: (m) => m[1], usd: (m) => null },
};
export const gameOf = (code) => code?.startsWith('ygo-') ? 'yugioh' : code?.startsWith('op-') ? 'onepiece' : code?.startsWith('fb-') ? 'football' : 'pokemon';

// ยูกิ/วันพีซ/ฟุตบอล → รูปแบบเดียวกับโปเกมอนในหน้า /datacard
export const loadGameDb = (() => {
  const cache = {};
  return (game) => (cache[game] ??= META[game].load().then((meta) => {
    const g = META[game], db = { index: {}, setOf: {}, typeOf: {}, rarityOf: {}, priceOf: {}, nameOf: {} };
    for (const [id, m] of Object.entries(meta)) {
      const c = g.pre + id;
      (db.index[m[0]] ??= []).push(c);
      db.nameOf[c] = m[0];
      db.setOf[c] = g.set(m); db.typeOf[c] = g.type(m); db.rarityOf[c] = g.rarity(m);
      if (g.usd(m)) db.priceOf[c] = Math.round(g.usd(m) * THB_PER_USD);
    }
    const uniq = (o) => [...new Set(Object.values(o).filter(Boolean))].sort();
    return { ...db, sets: uniq(db.setOf), typeList: uniq(db.typeOf), rarityList: uniq(db.rarityOf) };
  }));
})();

// ข้อมูล + ราคาของการ์ดยูกิ/วันพีซ/ฟุตบอล ในรูปแบบเดียวกับ /api/prices
export async function metaCardInfo(code) {
  const game = gameOf(code), g = META[game];
  const id = code.slice(g.pre.length), m = (await g.load())[id] || [];
  const usd = g.usd(m);
  let number = id.split('_')[0], rarity = m[1];
  if (game === 'yugioh') { number = m[3]; rarity = m[4]; }
  else if (game === 'onepiece') { number = id.split('_')[0]; rarity = m[3]; }
  return {
    history: [],
    card: { number, rarity, set: { series: g.type(m), name: g.set(m) } },
    live: usd ? { marketUsd: usd, marketThb: Math.round(usd * THB_PER_USD) } : null,
  };
}

export const loadSets = (() => {
  let p = null;
  return () => (p ??= fetch('/data/sets.json').then(r => r.json()).catch(() => []));
})();

export const loadHashes = (() => {
  let p = null;
  return () => (p ??= fetch('/data/card-hashes.json').then(r => r.json()).catch(() => ({})));
})();

/* ─── pHash ให้ตรงกับ imagehash.phash ของ Python (scripts/hash-cards.py) ─── */
// gray = 32×32 ค่าเทา (row-major) → DCT-II 2 มิติ เอามุม 8×8 → bit = ค่า > มัธยฐาน → hex 16 ตัว
export function hashFromGray(gray) {
  const N = 32, K = 8;
  const cos = (k, n) => Math.cos((Math.PI * k * (2 * n + 1)) / (2 * N));
  const rows = []; // DCT ตามแกน x ของแต่ละแถว (แค่ K ค่าแรก)
  for (let y = 0; y < N; y++) {
    const r = [];
    for (let v = 0; v < K; v++) { let s = 0; for (let x = 0; x < N; x++) s += gray[y * N + x] * cos(v, x); r.push(s); }
    rows.push(r);
  }
  const d = [];
  for (let u = 0; u < K; u++) for (let v = 0; v < K; v++) { let s = 0; for (let y = 0; y < N; y++) s += rows[y][v] * cos(u, y); d.push(s); }
  const sorted = [...d].sort((a, b) => a - b);
  const med = (sorted[31] + sorted[32]) / 2;
  let hex = '';
  for (let i = 0; i < 64; i += 4) hex += ((d[i] > med) << 3 | (d[i + 1] > med) << 2 | (d[i + 2] > med) << 1 | (d[i + 3] > med)).toString(16);
  return hex;
}

// รูป (data URL / path) → ครอปกลางเป็น 63:88 → ย่อทีละครึ่ง → 32×32 เทา → hash
export function phash(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onerror = reject;
    img.onload = () => {
      let w = img.naturalWidth, h = img.naturalHeight, sx = 0, sy = 0;
      if (w / h > 63 / 88) { const nw = h * 63 / 88; sx = (w - nw) / 2; w = nw; } else { const nh = w * 88 / 63; sy = (h - nh) / 2; h = nh; }
      let c = document.createElement('canvas');
      c.width = w; c.height = h;
      let ctx = c.getContext('2d');
      ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, h);
      ctx.drawImage(img, sx, sy, w, h, 0, 0, w, h);
      // ponytail: ย่อทีละครึ่งแทน Lanczos ของ PIL — ใกล้พอสำหรับ Hamming ≤ ~10
      while (c.width > 64 || c.height > 64) {
        const n = document.createElement('canvas');
        n.width = Math.max(32, Math.round(c.width / 2)); n.height = Math.max(32, Math.round(c.height / 2));
        const nctx = n.getContext('2d');
        nctx.imageSmoothingQuality = 'high';
        nctx.drawImage(c, 0, 0, n.width, n.height);
        c = n;
      }
      const f = document.createElement('canvas');
      f.width = f.height = 32;
      ctx = f.getContext('2d');
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(c, 0, 0, 32, 32);
      const px = ctx.getImageData(0, 0, 32, 32).data;
      const gray = new Array(1024);
      for (let i = 0; i < 1024; i++) gray[i] = Math.round((px[i * 4] * 299 + px[i * 4 + 1] * 587 + px[i * 4 + 2] * 114) / 1000);
      resolve(hashFromGray(gray));
    };
    img.src = src;
  });
}

const popcount = (x) => { x -= (x >>> 1) & 0x55555555; x = (x & 0x33333333) + ((x >>> 2) & 0x33333333); return (((x + (x >>> 4)) & 0x0f0f0f0f) * 0x01010101) >>> 24; };
export function matchCards(hash, hashes, n = 5) {
  const hi = parseInt(hash.slice(0, 8), 16), lo = parseInt(hash.slice(8), 16);
  const out = [];
  for (const [code, h] of Object.entries(hashes)) {
    if (noImageCodes.has(code)) continue; // รูปหลังการ์ด ไม่ใช่การ์ดจริง
    out.push({ code, dist: popcount((hi ^ parseInt(h.slice(0, 8), 16)) >>> 0) + popcount((lo ^ parseInt(h.slice(8), 16)) >>> 0) });
  }
  return out.sort((a, b) => a.dist - b.dist).slice(0, n);
}

// โมเดลของเพื่อน: POST {image} → {candidates:[{code, name?, score 0–1}]}
// ตั้ง VITE_IDENTIFY_URL ตอน build แล้วใช้ได้ทันที ถ้าไม่ได้ตั้ง หรือเรียกพัง จะ fallback ไป pHash
const IDENTIFY_URL = import.meta.env?.VITE_IDENTIFY_URL;

// score แปลงเป็น dist (0–64) เพื่อให้ UI ใช้เกณฑ์ ≤10 / ≤18 / >22 แบบเดียวกัน
export const scoreToDist = (s) => Math.round((1 - Math.min(1, Math.max(0, +s || 0))) * 64);

// ใช้โมเดล OBB ตรวจจับกรอบการ์ด แล้ว crop+pHash แต่ละใบ เพื่อระบุว่าเป็นการ์ดใบไหน
export async function identifyCard(src, n = 5) {
  const idx = await loadIndex();
  const codeToName = {};
  for (const [name, codes] of Object.entries(idx)) for (const c of codes) codeToName[c] = name;
  const named = (list) => list.map((r) => ({ ...r, name: r.name || codeToName[r.code] || r.code }));

  // ถ้าจำเป็น แล้วค่อยใช้ IDENTIFY_URL (ต้อง host model backend ที่ไหนสักแห่ง)
  if (IDENTIFY_URL) {
    try {
      const ctl = new AbortController();
      const t = setTimeout(() => ctl.abort(), 8000);
      const res = await fetch(IDENTIFY_URL, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: src }), signal: ctl.signal,
      }).finally(() => clearTimeout(t));
      const { candidates } = await res.json();
      if (res.ok && Array.isArray(candidates) && candidates.length) {
        return named(candidates.filter((c) => c?.code).slice(0, n)
          .map((c) => ({ code: c.code, name: c.name, dist: scoreToDist(c.score), source: 'model' })));
      }
    } catch { /* fallback ด้านล่าง */ }
  }

  const [hash, hashes] = await Promise.all([phash(src), loadHashes()]);
  return named(matchCards(hash, hashes, n).map((r) => ({ ...r, source: 'phash' })));
}

export function useCardImage(pokemonName) {
  const [codes, setCodes] = useState(null);
  useEffect(() => {
    loadIndex().then(idx => setCodes(idx[pokemonName] ?? []));
  }, [pokemonName]);
  return codes;
}

export function CardImage({ pokemonName, code, alt, ...imgProps }) {
  const codes = useCardImage(pokemonName);
  const chosen = code || (codes?.length ? bestCode(codes) : null);
  if (!chosen) return null;
  return React.createElement('img', { src: imgUrl(chosen), alt: alt ?? pokemonName, loading: 'lazy', decoding: 'async', ...imgProps });
}
