-- CardDex D1 schema — รัน: npx wrangler d1 execute carddex-db --remote --file=schema.sql
-- เวลาเก็บเป็น ms (Date.now()) ฝั่งหน้าเว็บแปลงเป็นเวลาไทยเอง

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  pass_hash TEXT NOT NULL,
  pass_salt TEXT NOT NULL,
  avatar TEXT NOT NULL,          -- ตัวอักษรแรก หรือ 'img:<url>'
  contact TEXT NOT NULL DEFAULT '', -- LINE/เบอร์ โชว์ในหน้าติดต่อผู้ขาย (DB เดิม: ALTER TABLE users ADD COLUMN contact TEXT NOT NULL DEFAULT '')
  created_at INTEGER NOT NULL DEFAULT (CAST(strftime('%s','now') AS INTEGER) * 1000)
);

-- รูปที่อัปโหลด (data URL ย่อแล้วจากหน้าเว็บ ~100-200KB) เสิร์ฟผ่าน GET /api/img/:id
CREATE TABLE IF NOT EXISTS images (
  id TEXT PRIMARY KEY,
  data TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS posts (
  id TEXT PRIMARY KEY,
  author_id TEXT NOT NULL REFERENCES users(id),
  text TEXT NOT NULL,
  image TEXT,
  created_at INTEGER NOT NULL DEFAULT (CAST(strftime('%s','now') AS INTEGER) * 1000)
);
CREATE INDEX IF NOT EXISTS posts_created ON posts(created_at);

CREATE TABLE IF NOT EXISTS likes (
  post_id TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id),
  PRIMARY KEY (post_id, user_id)
);

CREATE TABLE IF NOT EXISTS comments (
  id TEXT PRIMARY KEY,
  post_id TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  author_id TEXT NOT NULL REFERENCES users(id),
  text TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (CAST(strftime('%s','now') AS INTEGER) * 1000)
);
CREATE INDEX IF NOT EXISTS comments_post ON comments(post_id);

CREATE TABLE IF NOT EXISTS listings (
  id TEXT PRIMARY KEY,
  seller_id TEXT NOT NULL REFERENCES users(id),
  name TEXT NOT NULL,
  price INTEGER NOT NULL,
  era TEXT NOT NULL,
  description TEXT NOT NULL,
  image TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (CAST(strftime('%s','now') AS INTEGER) * 1000)
);

CREATE TABLE IF NOT EXISTS saved (
  user_id TEXT NOT NULL REFERENCES users(id),
  listing_id TEXT NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, listing_id)
);

CREATE TABLE IF NOT EXISTS checks (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  name TEXT NOT NULL,
  kind TEXT NOT NULL,
  score INTEGER NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (CAST(strftime('%s','now') AS INTEGER) * 1000)
);
CREATE INDEX IF NOT EXISTS checks_user ON checks(user_id, created_at);

-- ─── กราฟราคา + คอลเลกชัน (เพิ่ม 2026-10-02) ───
CREATE TABLE IF NOT EXISTS price_points (
  id TEXT PRIMARY KEY,
  card_key TEXT NOT NULL,   -- 3 คำแรกของชื่อการ์ด (lowercase) ใช้จับคู่ใบเดียวกัน
  price INTEGER NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (CAST(strftime('%s','now') AS INTEGER) * 1000)
);
CREATE INDEX IF NOT EXISTS prices_key ON price_points(card_key, created_at);

CREATE TABLE IF NOT EXISTS collection (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  name TEXT NOT NULL,
  image TEXT,
  note TEXT NOT NULL DEFAULT '',
  value INTEGER NOT NULL DEFAULT 0,   -- มูลค่าประเมินโดยเจ้าของ (บาท)
  created_at INTEGER NOT NULL DEFAULT (CAST(strftime('%s','now') AS INTEGER) * 1000)
);
CREATE INDEX IF NOT EXISTS collection_user ON collection(user_id);

-- seed จุดราคาย้อนหลัง 30 วันจาก listing ตัวอย่าง (key ต้องตรงกับ cardKey() ใน index.js)
INSERT OR IGNORE INTO price_points (id,card_key,price,created_at) VALUES
  ('pp-cs1','charizard ex sir',19800,CAST(strftime('%s','now') AS INTEGER)*1000-30*86400000),
  ('pp-cs2','charizard ex sir',17600,CAST(strftime('%s','now') AS INTEGER)*1000-20*86400000),
  ('pp-cs3','charizard ex sir',18900,CAST(strftime('%s','now') AS INTEGER)*1000-12*86400000),
  ('pp-cs4','charizard ex sir',18200,CAST(strftime('%s','now') AS INTEGER)*1000-5*86400000),
  ('pp-cs5','charizard ex sir',18500,CAST(strftime('%s','now') AS INTEGER)*1000-86400000),
  ('pp-pk1','pikachu ir pok',3900,CAST(strftime('%s','now') AS INTEGER)*1000-30*86400000),
  ('pp-pk2','pikachu ir pok',4500,CAST(strftime('%s','now') AS INTEGER)*1000-18*86400000),
  ('pp-pk3','pikachu ir pok',4100,CAST(strftime('%s','now') AS INTEGER)*1000-9*86400000),
  ('pp-pk4','pikachu ir pok',4200,CAST(strftime('%s','now') AS INTEGER)*1000-2*86400000),
  ('pp-mw1','mew ex sir',13200,CAST(strftime('%s','now') AS INTEGER)*1000-30*86400000),
  ('pp-mw2','mew ex sir',11800,CAST(strftime('%s','now') AS INTEGER)*1000-21*86400000),
  ('pp-mw3','mew ex sir',12700,CAST(strftime('%s','now') AS INTEGER)*1000-10*86400000),
  ('pp-mw4','mew ex sir',12500,CAST(strftime('%s','now') AS INTEGER)*1000-3*86400000),
  ('pp-ch1','charizard ex hr',3500,CAST(strftime('%s','now') AS INTEGER)*1000-30*86400000),
  ('pp-ch2','charizard ex hr',3100,CAST(strftime('%s','now') AS INTEGER)*1000-15*86400000),
  ('pp-ch3','charizard ex hr',3300,CAST(strftime('%s','now') AS INTEGER)*1000-6*86400000),
  ('pp-ch4','charizard ex hr',3200,CAST(strftime('%s','now') AS INTEGER)*1000-86400000),
  ('pp-ev1','eevee ex sir',9400,CAST(strftime('%s','now') AS INTEGER)*1000-25*86400000),
  ('pp-ev2','eevee ex sir',8600,CAST(strftime('%s','now') AS INTEGER)*1000-14*86400000),
  ('pp-ev3','eevee ex sir',8900,CAST(strftime('%s','now') AS INTEGER)*1000-4*86400000),
  ('pp-gv1','gardevoir ex sir',2600,CAST(strftime('%s','now') AS INTEGER)*1000-25*86400000),
  ('pp-gv2','gardevoir ex sir',2950,CAST(strftime('%s','now') AS INTEGER)*1000-12*86400000),
  ('pp-gv3','gardevoir ex sir',2800,CAST(strftime('%s','now') AS INTEGER)*1000-4*86400000);

-- ─── seed: บัญชีทดลอง demo@example.com / demo1234 + ข้อมูลตัวอย่าง ───
-- user-1 ตั้งรหัสสุ่มไว้ (ล็อกอินไม่ได้) มีไว้เป็นผู้ขาย/ผู้โพสต์ตัวอย่างเท่านั้น
INSERT OR IGNORE INTO users (id,name,email,pass_hash,pass_salt,avatar) VALUES
  ('demo','บัญชีทดลอง','demo@example.com','779cf08f5b825c1867c02caab7f3333c2e82af0301254e24e70f8c8426898c59','2873efa4f2d50e24168eb3c7cb40ae03','บ'),
  ('user-1','สมชายเทรนเนอร์','somchai@example.com','7f4cc7ee503106233a9a8f9cd4a978a8bd3023d1e8200b165df3396892796bbb','384acfea2a5ae7d4b415147d22120792','ส');

INSERT OR IGNORE INTO listings (id,seller_id,name,price,era,description,image,created_at) VALUES
  ('mkt-1','user-1','Charizard ex SIR — Obsidian Flames',18500,'SV3 · SIR · NM','มุมคม ขอบขาวน้อยมาก ผิวโฮโลแกรมสวย แถมสลีฟ+ท็อปโหลดเดอร์','/assets/charizard-ex-sir-sv3-223.png',CAST(strftime('%s','now') AS INTEGER)*1000-60000),
  ('mkt-2','demo','Pikachu IR — Pokémon 151',4200,'SV3.5 · IR · NM','อาร์ตน่ารัก เก็บสะสม ผิวสะอาด','/assets/pikachu-ir-sv3pt5-173.png',CAST(strftime('%s','now') AS INTEGER)*1000-120000),
  ('mkt-3','user-1','Mew ex SIR — Paldean Fates',12500,'SV4.5 · SIR · NM','ยอดนิยม สีพาสเทล ลายเต็มใบ สภาพดี','/assets/mew-ex-sir-sv4pt5-232.png',CAST(strftime('%s','now') AS INTEGER)*1000-180000),
  ('mkt-4','demo','Charizard ex HR (Gold) — Obsidian Flames',3200,'SV3 · HR · EX+','การ์ดทอง มุมมีรอยนิดเดียว ขายราคามิตรภาพ','/assets/charizard-ex-hr-sv3-228.png',CAST(strftime('%s','now') AS INTEGER)*1000-240000),
  ('mkt-5','user-1','Eevee ex SIR — Prismatic Evolutions',8900,'SV8.5 · SIR · NM','อาร์ตหายาก เก็บในซองตลอด','/assets/eevee-ex-sir-sv8pt5-167.png',CAST(strftime('%s','now') AS INTEGER)*1000-300000),
  ('mkt-6','demo','Gardevoir ex SIR — Scarlet & Violet',2800,'SV1 · SIR · NM','อาร์ตสวยมาก เหมาะตั้งโชว์','/assets/gardevoir-ex-sir-sv1-245.png',CAST(strftime('%s','now') AS INTEGER)*1000-360000);

INSERT OR IGNORE INTO posts (id,author_id,text,image,created_at) VALUES
  ('post-1','user-1','เพิ่งเปิด Obsidian Flames ได้ Charizard SIR ใบนี้ มุมคมกริบเลยครับ ควรส่งเกรด PSA ไหม?','/assets/charizard-ex-sir-sv3-223.png',CAST(strftime('%s','now') AS INTEGER)*1000-7200000),
  ('post-2','demo','ใครมี Pikachu IR เหลือแบ่งบ้างครับ หาให้ลูกชาย สะสมเซ็ต 151 อยู่ ขอสภาพ NM นะ',NULL,CAST(strftime('%s','now') AS INTEGER)*1000-21600000),
  ('post-3','user-1','Trade โซนกรุงเทพ — ปล่อย Mew ex SAR หา Umbreon SAR ครับ นัดเจอ BTS ได้ สภาพ NM ทั้งคู่',NULL,CAST(strftime('%s','now') AS INTEGER)*1000-86400000);

INSERT OR IGNORE INTO comments (id,post_id,author_id,text,created_at) VALUES
  ('cm-1','post-1','demo','สวยมาก! ส่งเลยครับ โอกาสได้ 10 สูง',CAST(strftime('%s','now') AS INTEGER)*1000-3600000),
  ('cm-2','post-3','demo','ผมมี Umbreon ครับ ทัก DM ไปแล้ว',CAST(strftime('%s','now') AS INTEGER)*1000-80000000);
