const CACHE='carddex-v3';
const CORE=['/','/index.html','/manifest.webmanifest','/assets/logo-96.png','/assets/icon-192.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(CORE)).then(()=>self.skipWaiting()))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
// โมเดล/ข้อมูลเปลี่ยนได้โดยชื่อไฟล์ไม่เปลี่ยน → ไม่ cache-first (เคยค้างโมเดล YOLO ตัวเก่า) ให้ HTTP cache + ETag จัดการแทน
self.addEventListener('fetch',e=>{const r=e.request;if(r.method!=='GET'||!r.url.startsWith(self.location.origin))return;const p=new URL(r.url).pathname;if(p.startsWith('/models/')||p.startsWith('/data/'))return;if(r.mode==='navigate'){e.respondWith(fetch(r).catch(()=>caches.match('/index.html')));return}e.respondWith(caches.match(r).then(h=>h||fetch(r).then(res=>{const cp=res.clone();caches.open(CACHE).then(c=>c.put(r,cp));return res}).catch(()=>h)))});
