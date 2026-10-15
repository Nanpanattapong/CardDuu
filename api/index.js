// ══ CardDex API — Hono + D1 ══
// deploy: npx wrangler deploy   (ในโฟลเดอร์ api/)

import { Hono } from 'hono';
import { cors } from 'hono/cors';

const app = new Hono();
const enc = new TextEncoder();
const uid = () => crypto.randomUUID();
const bad = (msg, status = 400) => Object.assign(new Error(msg), { status });

/* ─── CORS ─── */
app.use('*', cors({
  origin: (origin, c) => {
    const list = (c.env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim());
    // "*.example.com" = ตรงกับซับโดเมนทั้งหมด (Pages ออก URL ใหม่ทุก deploy)
    const ok = list.some((a) => a.startsWith('*.')
      ? origin?.endsWith(a.slice(1)) || origin === 'https://' + a.slice(2)
      : a === origin);
    return ok ? origin : undefined;
  },
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
}));

app.onError((err, c) => {
  if (!err.status) console.error(err);
  return c.json({ error: err.status ? err.message : 'เซิร์ฟเวอร์ขัดข้อง ลองใหม่อีกครั้ง' }, err.status || 500);
});

/* ─── base64url / hex ─── */
function b64uEncode(bytes) {
  const b = new Uint8Array(bytes); let s = '';
  for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function b64uDecode(str) {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) str += '=';
  return Uint8Array.from(atob(str), (ch) => ch.charCodeAt(0));
}
const hex = (bytes) => [...new Uint8Array(bytes)].map((x) => x.toString(16).padStart(2, '0')).join('');
const unhex = (s) => Uint8Array.from(s.match(/../g).map((h) => parseInt(h, 16)));

/* ─── รหัสผ่าน (PBKDF2-SHA256, 100k รอบ — Workers ไม่มี bcrypt) ─── */
async function hashPass(pass, saltHex) {
  const key = await crypto.subtle.importKey('raw', enc.encode(pass), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: unhex(saltHex), iterations: 100000 }, key, 256);
  return hex(bits);
}
async function createPass(pass) {
  const salt = hex(crypto.getRandomValues(new Uint8Array(16)));
  return { salt, hash: await hashPass(pass, salt) };
}

/* ─── session token (HMAC ลายเซ็น — ไม่ต้องมีตาราง sessions) ─── */
function secret(c) {
  if (!c.env.SESSION_SECRET) throw bad('ยังไม่ได้ตั้ง SESSION_SECRET', 500);
  return c.env.SESSION_SECRET;
}
async function hmacKey(s) {
  return crypto.subtle.importKey('raw', enc.encode(s), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
}
async function signToken(c, userId) {
  const payload = enc.encode(`${userId}.${Date.now() + +(c.env.SESSION_TTL_DAYS || 30) * 864e5}`);
  const sig = await crypto.subtle.sign('HMAC', await hmacKey(secret(c)), payload);
  return `${b64uEncode(payload)}.${b64uEncode(sig)}`;
}
async function verifyToken(c, token) {
  const parts = String(token || '').split('.');
  if (parts.length !== 2) return null;
  let payload;
  try { payload = b64uDecode(parts[0]); } catch { return null; }
  const want = b64uEncode(await crypto.subtle.sign('HMAC', await hmacKey(secret(c)), payload));
  if (want.length !== parts[1].length) return null;
  let diff = 0; // เทียบแบบ constant-time กัน timing attack
  for (let i = 0; i < want.length; i++) diff |= want.charCodeAt(i) ^ parts[1].charCodeAt(i);
  if (diff) return null;
  const [userId, exp] = new TextDecoder().decode(payload).split('.');
  return userId && +exp > Date.now() ? userId : null;
}

/* ─── middleware ─── */
const USER_COLS = 'id,name,email,avatar,contact';
async function maybeAuth(c, next) {
  const h = c.req.header('Authorization') || '';
  if (h.startsWith('Bearer ')) {
    const id = await verifyToken(c, h.slice(7));
    if (id) {
      const user = await c.env.DB.prepare(`SELECT ${USER_COLS} FROM users WHERE id=?`).bind(id).first();
      if (user) c.set('user', user);
    }
  }
  await next();
}
async function auth(c, next) {
  await maybeAuth(c, () => {});
  if (!c.get('user')) return c.json({ error: 'กรุณาเข้าสู่ระบบใหม่' }, 401);
  await next();
}

const body = (c) => c.req.json().catch(() => ({}));
const str = (v, max) => String(v ?? '').trim().slice(0, max);
const emailOk = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
// key จับคู่ "การ์ดใบเดียวกัน" จากชื่อที่พิมพ์ฟรี: 3 คำแรก lowercase (ponytail: จับผิดถ้าชื่อสะกดต่างกันมาก — ค่อยทำ alias ตอนมีข้อมูลจริง)
const cardKey = (name) => String(name || '').toLowerCase().replace(/[—–-]/g, ' ')
  .replace(/[^a-z0-9ก-๙ ]/g, ' ').split(/\s+/).filter(Boolean).slice(0, 3).join(' ');

/* ─── รูป: data URL จากหน้าเว็บ → ตาราง images คืน URL ถาวร / path /assets/ ของหน้าเว็บผ่านได้เลย ─── */
const IMG_RE = /^data:image\/(jpeg|png|webp|gif);base64,[A-Za-z0-9+/]+=*$/;
async function storeImage(c, src) {
  if (!src) return null;
  if (/^\/assets\/[\w.-]+$/.test(src)) return src;
  // รูปการ์ดจาก CDN / dataset ของหน้าเว็บ / รูปที่เก็บไว้แล้ว → เก็บเป็นลิงก์ ไม่ต้องอัปซ้ำ
  if (typeof src === 'string' && src.length < 300 && (
    /^https:\/\/images\.pokemontcg\.io\/[\w.-]+\/[\w./-]+\.png$/.test(src) ||
    /^\/cards\/[\w.-]+\.png$/.test(src) ||
    src.startsWith(`${new URL(c.req.url).origin}/api/img/`))) return src;
  if (typeof src !== 'string' || src.length > 1_500_000 || !IMG_RE.test(src)) throw bad('ไฟล์รูปไม่ถูกต้องหรือใหญ่เกินไป');
  const id = uid();
  await c.env.DB.prepare('INSERT INTO images (id,data) VALUES (?,?)').bind(id, src).run();
  return `${new URL(c.req.url).origin}/api/img/${id}`;
}

app.get('/api/img/:id', async (c) => {
  const row = await c.env.DB.prepare('SELECT data FROM images WHERE id=?').bind(c.req.param('id')).first();
  if (!row) return c.notFound();
  const comma = row.data.indexOf(',');
  const type = row.data.slice(5, row.data.indexOf(';'));
  const bin = Uint8Array.from(atob(row.data.slice(comma + 1)), (ch) => ch.charCodeAt(0));
  return new Response(bin, { headers: { 'Content-Type': type, 'Cache-Control': 'public, max-age=31536000, immutable' } });
});

/* ═════════ AUTH ═════════ */
app.post('/api/auth/register', async (c) => {
  const b = await body(c);
  const name = str(b.name, 60), email = str(b.email, 120).toLowerCase(), pass = String(b.pass || '');
  if (!name || !emailOk(email) || pass.length < 8) throw bad('กรอกชื่อ อีเมล และรหัสผ่าน (≥8 ตัวอักษร)');
  if (await c.env.DB.prepare('SELECT 1 FROM users WHERE email=?').bind(email).first()) throw bad('อีเมลนี้ถูกใช้แล้ว', 409);
  const id = uid();
  const { salt, hash } = await createPass(pass);
  await c.env.DB.prepare('INSERT INTO users (id,name,email,pass_hash,pass_salt,avatar,created_at) VALUES (?,?,?,?,?,?,?)')
    .bind(id, name, email, hash, salt, name.charAt(0), Date.now()).run();
  return c.json({ token: await signToken(c, id), user: { id, name, email, avatar: name.charAt(0) } }, 201);
});

app.post('/api/auth/login', async (c) => {
  const b = await body(c);
  const row = await c.env.DB.prepare('SELECT * FROM users WHERE email=?').bind(str(b.email, 120).toLowerCase()).first();
  if (!row || !row.pass_hash || (await hashPass(String(b.pass || ''), row.pass_salt)) !== row.pass_hash) throw bad('อีเมลหรือรหัสผ่านไม่ถูกต้อง', 401);
  return c.json({ token: await signToken(c, row.id), user: { id: row.id, name: row.name, email: row.email, avatar: row.avatar } });
});

app.post('/api/auth/google', async (c) => {
  const { credential } = await body(c);
  if (!credential) throw bad('ไม่มีรหัสยืนยันจาก Google');
  // ponytail: ใช้ tokeninfo API ของ Google ตรงๆ แทนการแกะ JWT เอง → ลดโค้ด ประหยัด CPU ใน Worker
  const res = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`);
  if (!res.ok) throw bad('Google Token ไม่ถูกต้องหรือหมดอายุ', 401);
  const info = await res.json();
  if (info.aud !== c.env.GOOGLE_CLIENT_ID) throw bad('Client ID ไม่ตรงกัน', 403);
  // ผูกบัญชีด้วยอีเมล → ต้องเป็นอีเมลที่ Google ยืนยันแล้วเท่านั้น
  if (info.email_verified !== 'true' || !info.email) throw bad('อีเมล Google ยังไม่ได้ยืนยัน', 403);
  const email = info.email.toLowerCase();
  let row = await c.env.DB.prepare('SELECT * FROM users WHERE email=?').bind(email).first();
  if (!row) {
    const id = uid();
    const name = info.name || email.split('@')[0];
    const avatar = info.picture ? 'img:' + info.picture : name.charAt(0);
    // สมัครผ่าน Google ไม่มีรหัสผ่าน → pass_hash ว่าง (login ด้วยรหัสผ่านจะถูกปัดตก)
    await c.env.DB.prepare("INSERT INTO users (id,name,email,pass_hash,pass_salt,avatar,created_at) VALUES (?,?,?,'','',?,?)")
      .bind(id, name, email, avatar, Date.now()).run();
    row = { id, name, email, avatar };
  }
  return c.json({ token: await signToken(c, row.id), user: { id: row.id, name: row.name, email: row.email, avatar: row.avatar } });
});

app.get('/api/me', auth, (c) => c.json({ user: c.get('user') }));

app.put('/api/me', auth, async (c) => {
  const u = c.get('user');
  const b = await body(c);
  const name = b.name === undefined ? u.name : str(b.name, 60);
  const email = b.email === undefined ? u.email : str(b.email, 120).toLowerCase();
  const contact = b.contact === undefined ? (u.contact ?? '') : str(b.contact, 200);
  if (!name || !emailOk(email)) throw bad('กรอกชื่อและอีเมลให้ถูกต้อง');
  if (email !== u.email && await c.env.DB.prepare('SELECT 1 FROM users WHERE email=?').bind(email).first()) throw bad('อีเมลนี้มีผู้ใช้แล้ว', 409);
  let avatar = u.avatar.startsWith('img:') ? u.avatar : name.charAt(0);
  if (b.avatar) avatar = 'img:' + await storeImage(c, b.avatar);
  await c.env.DB.prepare('UPDATE users SET name=?, email=?, avatar=?, contact=? WHERE id=?').bind(name, email, avatar, contact, u.id).run();
  return c.json({ user: { id: u.id, name, email, avatar, contact } });
});

app.put('/api/me/password', auth, async (c) => {
  const b = await body(c);
  const row = await c.env.DB.prepare('SELECT pass_hash,pass_salt FROM users WHERE id=?').bind(c.get('user').id).first();
  if ((await hashPass(String(b.old || ''), row.pass_salt)) !== row.pass_hash) throw bad('รหัสผ่านเดิมไม่ถูกต้อง');
  if (String(b.pass || '').length < 8) throw bad('รหัสผ่านใหม่อย่างน้อย 8 ตัวอักษร');
  const { salt, hash } = await createPass(String(b.pass));
  await c.env.DB.prepare('UPDATE users SET pass_hash=?, pass_salt=? WHERE id=?').bind(hash, salt, c.get('user').id).run();
  return c.json({ ok: true });
});

/* ═════════ ฟีด ═════════ อ่านได้ไม่ต้องล็อกอิน (หน้าแรกโชว์พรีวิว) — เขียน/like/comment ต้องล็อกอิน */
const person = (r, p = '') => ({ id: r[p + 'uid'], name: r[p + 'uname'], avatar: r[p + 'uavatar'], contact: r[p + 'ucontact'] ?? null });

app.get('/api/posts', maybeAuth, async (c) => {
  const me = c.get('user')?.id || '';
  const author = c.req.query('author');
  const { results } = await c.env.DB.prepare(
    `SELECT p.id,p.text,p.image,p.created_at,u.id AS uid,u.name AS uname,u.avatar AS uavatar,
      (SELECT COUNT(*) FROM likes l WHERE l.post_id=p.id) AS likes,
      EXISTS(SELECT 1 FROM likes l WHERE l.post_id=p.id AND l.user_id=?) AS liked
    FROM posts p JOIN users u ON u.id=p.author_id ${author ? 'WHERE p.author_id=?' : ''}
    ORDER BY p.created_at DESC LIMIT 50`).bind(...(author ? [me, author] : [me])).all();
  let comments = [];
  if (results.length) {
    ({ results: comments } = await c.env.DB.prepare(
      `SELECT cm.post_id,cm.text,cm.created_at,u.id AS uid,u.name AS uname,u.avatar AS uavatar
      FROM comments cm JOIN users u ON u.id=cm.author_id
      WHERE cm.post_id IN (${results.map(() => '?').join(',')}) ORDER BY cm.created_at`)
      .bind(...results.map((r) => r.id)).all());
  }
  return c.json(results.map((r) => ({
    id: r.id, text: r.text, image: r.image, created_at: r.created_at, likes: r.likes, liked: !!r.liked, author: person(r),
    comments: comments.filter((x) => x.post_id === r.id).map((x) => ({ text: x.text, created_at: x.created_at, author: person(x) })),
  })));
});

app.post('/api/posts', auth, async (c) => {
  const b = await body(c);
  const text = str(b.text, 2000);
  if (!text) throw bad('พิมพ์ข้อความก่อนโพสต์');
  const id = 'post-' + uid();
  await c.env.DB.prepare('INSERT INTO posts (id,author_id,text,image,created_at) VALUES (?,?,?,?,?)')
    .bind(id, c.get('user').id, text, await storeImage(c, b.image), Date.now()).run();
  return c.json({ id }, 201);
});

app.post('/api/posts/:id/like', auth, async (c) => {
  const id = c.req.param('id'), me = c.get('user').id;
  const del = await c.env.DB.prepare('DELETE FROM likes WHERE post_id=? AND user_id=?').bind(id, me).run();
  if (del.meta.changes) return c.json({ liked: false });
  if (!await c.env.DB.prepare('SELECT 1 FROM posts WHERE id=?').bind(id).first()) throw bad('ไม่พบโพสต์', 404);
  await c.env.DB.prepare('INSERT INTO likes (post_id,user_id) VALUES (?,?)').bind(id, me).run();
  return c.json({ liked: true });
});

app.post('/api/posts/:id/comments', auth, async (c) => {
  const id = c.req.param('id');
  const text = str((await body(c)).text, 1000);
  if (!text) throw bad('พิมพ์ความคิดเห็นก่อนส่ง');
  if (!await c.env.DB.prepare('SELECT 1 FROM posts WHERE id=?').bind(id).first()) throw bad('ไม่พบโพสต์', 404);
  await c.env.DB.prepare('INSERT INTO comments (id,post_id,author_id,text,created_at) VALUES (?,?,?,?,?)')
    .bind(uid(), id, c.get('user').id, text, Date.now()).run();
  return c.json({ ok: true }, 201);
});

app.delete('/api/posts/:id', auth, async (c) => {
  const id = c.req.param('id'), me = c.get('user').id;
  const row = await c.env.DB.prepare('SELECT author_id FROM posts WHERE id=?').bind(id).first();
  if (!row) throw bad('ไม่พบโพสต์', 404);
  if (row.author_id !== me) throw bad('ไม่มีสิทธิ์ลบโพสต์นี้', 403);
  await c.env.DB.batch([
    c.env.DB.prepare('DELETE FROM likes WHERE post_id=?').bind(id),
    c.env.DB.prepare('DELETE FROM comments WHERE post_id=?').bind(id),
    c.env.DB.prepare('DELETE FROM posts WHERE id=?').bind(id),
  ]);
  return c.json({ ok: true });
});

/* ═════════ ตลาด ═════════ */
const LISTING_SQL = `SELECT l.id,l.name,l.price,l.era,l.description AS "desc",l.image,l.created_at,
  u.id AS uid,u.name AS uname,u.avatar AS uavatar,u.contact AS ucontact FROM listings l JOIN users u ON u.id=l.seller_id`;
const listing = (r) => ({ id: r.id, name: r.name, price: r.price, era: r.era, desc: r.desc, image: r.image, created_at: r.created_at, seller: person(r) });

app.get('/api/listings', async (c) => {
  const seller = c.req.query('seller');
  const { results } = await c.env.DB.prepare(`${LISTING_SQL} ${seller ? 'WHERE l.seller_id=?' : ''} ORDER BY l.created_at DESC LIMIT 100`)
    .bind(...(seller ? [seller] : [])).all();
  return c.json(results.map(listing));
});

app.post('/api/listings', auth, async (c) => {
  const b = await body(c);
  const name = str(b.name, 120), desc = str(b.desc, 2000), era = str(b.era, 80) || 'ไม่ระบุ';
  const price = Math.floor(Number(b.price));
  if (!name || !desc || !(price > 0) || price > 100_000_000) throw bad('กรุณากรอกข้อมูลให้ครบถ้วน');
  const id = 'mkt-' + uid();
  const image = (await storeImage(c, b.image)) || '/assets/charizard-ex-sir-sv3-223.png';
  const now = Date.now();
  await c.env.DB.prepare('INSERT INTO listings (id,seller_id,name,price,era,description,image,created_at) VALUES (?,?,?,?,?,?,?,?)')
    .bind(id, c.get('user').id, name, price, era, desc, image, now).run();
  // เก็บจุดราคาสำหรับกราฟ (ไม่ให้พัง flow หลักถ้า error)
  try {
    await c.env.DB.prepare('INSERT INTO price_points (id,card_key,price,created_at) VALUES (?,?,?,?)')
      .bind(uid(), cardKey(name), price, now).run();
  } catch {}
  return c.json({ id }, 201);
});

app.delete('/api/listings/:id', auth, async (c) => {
  const id = c.req.param('id'), me = c.get('user').id;
  const row = await c.env.DB.prepare('SELECT seller_id FROM listings WHERE id=?').bind(id).first();
  if (!row) throw bad('ไม่พบรายการ', 404);
  if (row.seller_id !== me) throw bad('ไม่มีสิทธิ์ลบรายการนี้', 403);
  await c.env.DB.batch([
    c.env.DB.prepare('DELETE FROM saved WHERE listing_id=?').bind(id),
    c.env.DB.prepare('DELETE FROM listings WHERE id=?').bind(id),
  ]);
  return c.json({ ok: true });
});

app.get('/api/saved', auth, async (c) => {
  const { results } = await c.env.DB.prepare(
    `${LISTING_SQL} JOIN saved s ON s.listing_id=l.id WHERE s.user_id=? ORDER BY l.created_at DESC`).bind(c.get('user').id).all();
  return c.json(results.map(listing));
});

app.post('/api/saved/:id', auth, async (c) => {
  const id = c.req.param('id'), me = c.get('user').id;
  const del = await c.env.DB.prepare('DELETE FROM saved WHERE user_id=? AND listing_id=?').bind(me, id).run();
  if (del.meta.changes) return c.json({ saved: false });
  if (!await c.env.DB.prepare('SELECT 1 FROM listings WHERE id=?').bind(id).first()) throw bad('ไม่พบรายการ', 404);
  await c.env.DB.prepare('INSERT INTO saved (user_id,listing_id) VALUES (?,?)').bind(me, id).run();
  return c.json({ saved: true });
});

/* ═════════ ประวัติการเช็ค ═════════ */
app.get('/api/checks', auth, async (c) => {
  const { results } = await c.env.DB.prepare(
    'SELECT name,kind,score,created_at FROM checks WHERE user_id=? ORDER BY created_at DESC LIMIT 20').bind(c.get('user').id).all();
  return c.json(results);
});

app.post('/api/checks', auth, async (c) => {
  const b = await body(c);
  const name = str(b.name, 120), score = Math.round(Number(b.score));
  if (!name || !['ok', 'bad', 'hold'].includes(b.kind) || !(score >= 0 && score <= 100)) throw bad('ข้อมูลผลเช็คไม่ถูกต้อง');
  await c.env.DB.prepare('INSERT INTO checks (id,user_id,name,kind,score,created_at) VALUES (?,?,?,?,?,?)')
    .bind(uid(), c.get('user').id, name, b.kind, score, Date.now()).run();
  return c.json({ ok: true }, 201);
});

app.delete('/api/checks', auth, async (c) => {
  await c.env.DB.prepare('DELETE FROM checks WHERE user_id=?').bind(c.get('user').id).run();
  return c.json({ ok: true });
});

/* ═════════ กราฟราคา + คอลเลกชัน + TCGplayer live ═════════ */
let priceDb = null;
const loadPriceDb = (c) => priceDb ||= fetch(`${c.env.EMB_BASE}/data/prices.json`)
  .then((r) => r.json()).catch((e) => { priceDb = null; throw e; });

app.get('/api/prices', async (c) => {
  const name = str(c.req.query('name'), 120);
  if (!name) return c.json({ history: [], live: null });
  const key = cardKey(name);
  // code = รหัสการ์ดจาก dataset (เช่น sv3-223) → ราคาตรงใบ; ไม่มี code ค่อยเดาจากชื่อ
  const code = /^[\w.]+-[\w.]+$/.test(c.req.query('code') || '') ? c.req.query('code') : '';
  let history = [];
  try {
    // มี code → ประวัติจาก cron (recordPrices) ที่เก็บตามรหัส; ไม่มี → จุดราคาจาก listing ตามชื่อ
    const { results } = await c.env.DB.prepare(
      'SELECT price,created_at FROM price_points WHERE card_key=? ORDER BY created_at DESC LIMIT 60')
      .bind(code || key).all();
    history = (results || []).reverse();
  } catch {}
  let live = null, info = null;
  try {
    const qname = key.split(' ').slice(0, 2).join(' ');
    const headers = c.env.POKEMONTCG_API_KEY ? { 'X-Api-Key': c.env.POKEMONTCG_API_KEY } : {};
    const sel = 'select=id,name,number,rarity,artist,set,tcgplayer,cardmarket';
    const url = code
      ? `https://api.pokemontcg.io/v2/cards/${code}?${sel}`
      : `https://api.pokemontcg.io/v2/cards?q=name:${encodeURIComponent(qname + '*')}&${sel}&pageSize=1`;
    // ponytail: pokemontcg.io ตอบ 5xx เป็นพักๆ → retry 1 ครั้ง; ถ้ายังพังบ่อยค่อย cache ลง D1
    let res = await fetch(url, { signal: AbortSignal.timeout(8000), headers });
    if (res.status >= 500) res = await fetch(url, { signal: AbortSignal.timeout(8000), headers });
    if (res.ok) {
      const j = await res.json();
      const card = code ? j?.data : j?.data?.[0];
      if (card) {
        const s = card.set || {};
        info = {
          id: card.id, name: card.name, number: card.number ?? null, rarity: card.rarity ?? null, artist: card.artist ?? null,
          set: { id: s.id ?? null, name: s.name ?? null, series: s.series ?? null, releaseDate: s.releaseDate ?? null, total: s.printedTotal ?? s.total ?? null, logo: s.images?.logo ?? null },
        };
      }
      const tp = card?.tcgplayer?.prices;
      const marketUsd = tp?.holofoil?.market ?? tp?.normal?.market ?? tp?.reverseHolofoil?.market ?? tp?.unlimitedHolofoil?.market ?? null;
      const cm = card?.cardmarket?.prices;
      const cmEur = cm?.averageSellPrice ?? cm?.trendPrice ?? null;
      if (marketUsd || cmEur) {
        const USD = Number(c.env.THB_PER_USD || 35);
        const EUR = Number(c.env.THB_PER_EUR || 38);
        const thb = (v, rate) => (v ? Math.round(v * rate) : null);
        live = {
          cardId: card?.id ?? null,
          marketUsd: marketUsd ?? null,
          marketThb: thb(marketUsd, USD),
          cardmarketThb: thb(cmEur, EUR),
          // ทุก variant ของ TCGplayer (normal/holofoil/reverseHolofoil/1stEdition…)
          tcgplayer: Object.entries(tp || {}).map(([variant, p]) => ({
            variant, lowThb: thb(p?.low, USD), marketThb: thb(p?.market, USD), highThb: thb(p?.high, USD),
          })).filter((v) => v.marketThb || v.lowThb),
          cardmarket: cm ? { trendThb: thb(cm.trendPrice, EUR), lowThb: thb(cm.lowPrice, EUR), avgThb: thb(cm.averageSellPrice, EUR) } : null,
          tcgplayerUrl: card?.tcgplayer?.url ?? null,
          cardmarketUrl: card?.cardmarket?.url ?? null,
          updatedAt: card?.tcgplayer?.updatedAt ?? card?.cardmarket?.updatedAt ?? null,
        };
        if (live.marketThb) history = [...history, { price: live.marketThb, created_at: Date.now(), live: true }];
      }
    }
  } catch {}
  // ponytail: pokemontcg.io 500 เป็นพักๆ → ลอง TCGdex ต่อทันที
  if (!info && code) {
    try {
      const cand = (() => {
        const cands = [code];
        const p = code.split('-');
        const setId = p[0] || '', num = p.slice(1).join('-');
        const m = setId.match(/^([a-z]+)(\d+)(.*)$/i);
        if (m) {
          const pad = m[1].toLowerCase() + m[2].padStart(2, '0') + m[3];
          const a = pad + (num ? '-' + num : '');
          if (!cands.includes(a)) cands.push(a);
          const dot = a.replace('pt', '.');
          if (dot !== a && !cands.includes(dot)) cands.push(dot);
        }
        const dot2 = code.replace('pt', '.');
        if (dot2 !== code && !cands.includes(dot2)) cands.push(dot2);
        // TCGdex ใช้เลขการ์ด 3 หลัก (sv03-001)
        if (/^\d{1,2}$/.test(num)) for (const x of [...cands]) { const y = x.replace(/-\d+$/, '-' + num.padStart(3, '0')); if (!cands.includes(y)) cands.push(y); }
        return cands;
      })();
      let d = null;
      for (const cc of cand) {
        const r = await fetch(`https://api.tcgdex.net/v2/en/cards/${cc}`, { signal: AbortSignal.timeout(5000) });
        if (r.ok) { d = await r.json(); break; }
      }
      if (d) {
        let serieName = null, rel = null;
        try {
          const sr = await fetch(`https://api.tcgdex.net/v2/en/sets/${d.set.id}`, { signal: AbortSignal.timeout(4000) });
          if (sr.ok) { const sj = await sr.json(); serieName = sj?.serie?.name ?? null; rel = sj?.releaseDate ?? null; }
        } catch {}
        info = {
          id: d.id, name: d.name, number: d.localId ?? null, rarity: d.rarity ?? null, artist: d.illustrator ?? null,
          set: { id: d.set.id, name: d.set.name, series: serieName, releaseDate: rel, total: d.set?.cardCount?.official ?? d.set?.cardCount?.total ?? null, logo: d.set?.logo ?? null },
        };
        const USD = Number(c.env.THB_PER_USD || 35), EUR = Number(c.env.THB_PER_EUR || 38);
        const thb = (v, rate) => (v ? Math.round(v * rate) : null);
        const tp = d.pricing?.tcgplayer || d.variants_detailed?.[0]?.pricing?.tcgplayer || null;
        const cm = d.pricing?.cardmarket || null;
        const marketUsd = tp ? (tp.holofoil?.marketPrice ?? tp.normal?.marketPrice ?? tp.reverseHolofoil?.marketPrice ?? tp?.marketPrice ?? null) : null;
        const cmEur = cm ? (cm.avg ?? cm.trend ?? null) : null;
        if (marketUsd || cmEur) {
          live = {
            cardId: d.id, marketUsd: marketUsd ?? null, marketThb: thb(marketUsd, USD), cardmarketThb: thb(cmEur, EUR),
            tcgplayer: tp ? Object.entries(tp).filter(([, v]) => v && typeof v === 'object').map(([k, v]) => ({
              variant: k, lowThb: thb(v.lowPrice, USD), marketThb: thb(v.marketPrice ?? v.midPrice, USD), highThb: thb(v.highPrice, USD),
            })).filter((v) => v.marketThb || v.lowThb) : [],
            cardmarket: cm ? { trendThb: thb(cm.trend, EUR), lowThb: thb(cm.low, EUR), avgThb: thb(cm.avg, EUR) } : null,
            tcgplayerUrl: null, cardmarketUrl: null, updatedAt: d.updated ?? null,
          };
          if (live.marketThb) history = [...history, { price: live.marketThb, created_at: Date.now(), live: true }];
        }
      }
    } catch {}
  }
  // ทั้งสองเว็บไม่ให้ราคา (pokemontcg.io 500 บ่อย) → ใช้ราคาที่ดึงเก็บไว้ใน prices.json (scripts/fetch-prices.py)
  if (!live && code) {
    try {
      const { generatedAt, prices } = await loadPriceDb(c);
      const p = prices[code];
      if (p) {
        live = {
          cardId: code, marketUsd: p.usd ?? (p.m ? +(p.m / Number(c.env.THB_PER_USD || 35)).toFixed(2) : null), marketThb: p.m ?? null, cardmarketThb: p.c ?? null,
          tcgplayer: [], cardmarket: null, tcgplayerUrl: null, cardmarketUrl: null, updatedAt: generatedAt?.slice(0, 10) ?? null,
        };
        if (live.marketThb) history = [...history, { price: live.marketThb, created_at: Date.now(), live: true }];
      }
    } catch {}
  }
  // upstream พัง → ไม่ cache ผลว่าง ให้ลองใหม่ได้ทันที
  c.header('Cache-Control', info ? 'public, max-age=300' : 'no-store');
  return c.json({ history, live, card: info });
});

app.get('/api/ja-lookup', async (c) => {
  const num = c.req.query('num')?.split('/')[0];
  const name = c.req.query('name');
  if (!num) return c.json(null);
  try {
    const r = await fetch(`https://api.tcgdex.net/v2/ja/cards?localId=${num}`, { signal: AbortSignal.timeout(5000) });
    const cards = r.ok ? await r.json() : [];
    for (const card of cards.slice(0, 10)) {
      const re = await fetch(`https://api.tcgdex.net/v2/en/cards/${card.id}`);
      if (re.ok) {
        const d = await re.json();
        // ถ้าเลขตรง + ชื่อตรง (หรือไม่ได้ระบุชื่อ) → มั่นใจว่าใช่ใบนี้
        if (!name || d.name.toLowerCase() === name.toLowerCase()) return c.json({ code: d.id, name: d.name });
      }
    }
  } catch {}
  return c.json(null);
});

/* ─── ระบุการ์ดจากเวกเตอร์ DINOv2 (หน้าเว็บคำนวณจากรูปที่ครอปแล้ว) ─── */
// ฐานเวกเตอร์ int8 สร้างด้วย scripts/embed-cards.py แล้ววางไว้บน Pages → โหลดครั้งแรกแล้วเก็บในหน่วยความจำ isolate
// ponytail: ไล่เทียบทุกใบ (20,670×384) ถ้าการ์ดเยอะขึ้นมากค่อยย้ายไป Vectorize
let embDb = {};
const loadEmb = async (c, game = 'pokemon') => {
  if (embDb[game]) return embDb[game];
  const sfx = game === 'yugioh' ? '-yugioh' : game === 'onepiece' ? '-onepiece' : game === 'football' ? '-football' : '';
  try {
    const [bin, codes] = await Promise.all([
      fetch(`${c.env.EMB_BASE}/data/card-emb${sfx}.bin`).then((r) => r.arrayBuffer()),
      fetch(`${c.env.EMB_BASE}/data/card-emb-codes${sfx}.json`).then((r) => r.json()),
    ]);
    return embDb[game] = { E: new Int8Array(bin), codes };
  } catch (e) {
    delete embDb[game];
    throw e;
  }
};

// cosine ต่ำกว่านี้ = ไม่ตรงกับการ์ดใบไหนในฐานข้อมูล (วัดแล้ว: ใบที่ถูก 95% ได้ ≥0.74, การ์ดไทย/ไม่ใช่การ์ดได้ 0.50–0.67)
const KNOWN_SCORE = 0.7;

app.post('/api/identify', async (c) => {
  const { vecs, game } = await body(c);
  if (!Array.isArray(vecs) || !vecs.length || vecs.length > 12 || vecs.some((v) => !Array.isArray(v) || v.length !== 384)) throw bad('ต้องส่ง vecs = [[384 ตัวเลข], ...] ไม่เกิน 12 ชุด');
  const { E, codes } = await loadEmb(c, ['yugioh', 'onepiece', 'football'].includes(game) ? game : 'pokemon');
  const results = vecs.map((v) => {
    const q = Float32Array.from(v, Number);
    const scores = [];
    for (let i = 0, o = 0; i < codes.length; i++, o += 384) {
      let s = 0;
      for (let k = 0; k < 384; k++) s += q[k] * E[o + k];
      scores.push({ code: codes[i], score: Math.round((s / 127) * 1000) / 1000 });
    }
    const top = scores.sort((a, b) => b.score - a.score).slice(0, 5);
    return { ...top[0], candidates: top, known: top[0].score >= KNOWN_SCORE };
  });
  return c.json({ results });
});

app.get('/api/trends', async (c) => {
  try {
    // ponytail: MAX-MIN ต่อ key ใน 7 วัน — หยาบแต่พอสำหรับ "ตัวเปลี่ยนแรง"
    const { results } = await c.env.DB.prepare(`
      SELECT p.card_key, MAX(p.price) AS new_p, MIN(p.price) AS old_p, MAX(p.price)-MIN(p.price) AS diff,
        (SELECT l.image FROM listings l WHERE lower(substr(l.name,1,40)) LIKE '%'||p.card_key||'%' OR p.card_key LIKE '%'||lower(substr(l.name,1,20))||'%' ORDER BY l.created_at DESC LIMIT 1) AS image
      FROM price_points p
      WHERE p.created_at >= CAST(strftime('%s','now') AS INTEGER)*1000 - 30*86400000
        AND instr(p.card_key,'-')=0  -- ข้ามจุดราคาตามรหัส (sv3-223) จาก cron; cardKey() ไม่มี '-'
      GROUP BY p.card_key
      ORDER BY ABS(MAX(p.price)-MIN(p.price)) DESC LIMIT 20
    `).all();
    return c.json(results);
  } catch { return c.json([]); }
});

app.get('/api/collection', auth, async (c) => {
  try {
    const { results } = await c.env.DB.prepare(
      'SELECT id,name,image,note,value,created_at FROM collection WHERE user_id=? ORDER BY created_at DESC LIMIT 100')
      .bind(c.get('user').id).all();
    return c.json(results);
  } catch { return c.json([]); }
});

app.post('/api/collection', auth, async (c) => {
  const b = await body(c);
  const name = str(b.name, 120);
  const value = Math.floor(Number(b.value)) || 0;
  if (!name) throw bad('ระบุชื่อการ์ด');
  const id = 'col-' + uid();
  await c.env.DB.prepare('INSERT INTO collection (id,user_id,name,image,note,value,created_at) VALUES (?,?,?,?,?,?,?)')
    .bind(id, c.get('user').id, name, await storeImage(c, b.image), str(b.note, 500), value, Date.now()).run();
  return c.json({ id }, 201);
});

app.delete('/api/collection/:id', auth, async (c) => {
  await c.env.DB.prepare('DELETE FROM collection WHERE id=? AND user_id=?')
    .bind(c.req.param('id'), c.get('user').id).run();
  return c.json({ ok: true });
});

/* ─── cron: บันทึกราคา TCGplayer ลง D1 ทีละ 2 หน้า (500 ใบ) ทุก 30 นาที → ครบทุกใบวันละรอบ ─── */
// เก็บเฉพาะตอนราคาเปลี่ยนจากจุดล่าสุด ไม่งั้น 20k แถว/วัน จะเต็ม D1 ฟรีในไม่กี่เดือน
// ponytail: 48 รอบ × 500 = 24,000 ใบ ถ้าการ์ดเกินนี้ค่อยเพิ่มหน้าต่อรอบ
const PRICE_SQL = `INSERT INTO price_points (id,card_key,price,created_at)
  SELECT ?1, ?2, ?3, ?4 WHERE NOT EXISTS (
    SELECT 1 FROM price_points WHERE card_key=?2 AND price=?3
      AND created_at=(SELECT MAX(created_at) FROM price_points WHERE card_key=?2))`;

async function recordPrices(env, time) {
  const USD = Number(env.THB_PER_USD || 35);
  const headers = env.POKEMONTCG_API_KEY ? { 'X-Api-Key': env.POKEMONTCG_API_KEY } : {};
  const slot = Math.floor(time / 1800000) % 48;
  for (const page of [slot * 2 + 1, slot * 2 + 2]) {
    const url = `https://api.pokemontcg.io/v2/cards?page=${page}&pageSize=250&orderBy=id&select=id,tcgplayer`;
    let res = await fetch(url, { headers, signal: AbortSignal.timeout(30000) }).catch(() => null);
    if (!res || res.status >= 500) res = await fetch(url, { headers, signal: AbortSignal.timeout(30000) }).catch(() => null);
    if (!res?.ok) { console.log('recordPrices: page', page, res?.status ?? 'timeout'); continue; }
    const { data = [] } = await res.json();
    // เลือก variant ลำดับเดียวกับ /api/prices และ scripts/fetch-prices.py
    const stmts = data.flatMap((card) => {
      const tp = card.tcgplayer?.prices;
      const usd = tp?.holofoil?.market ?? tp?.normal?.market ?? tp?.reverseHolofoil?.market ?? tp?.unlimitedHolofoil?.market;
      return usd ? [env.DB.prepare(PRICE_SQL).bind(uid(), card.id, Math.round(usd * USD), time)] : [];
    });
    if (stmts.length) await env.DB.batch(stmts);
  }
}

export default {
  fetch: app.fetch,
  scheduled: (event, env, ctx) => ctx.waitUntil(recordPrices(env, event.scheduledTime)),
};
