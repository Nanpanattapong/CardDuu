/* CardDuu lib — API + auth + helpers */
const API_BASE = (import.meta.env.VITE_API_BASE || '').replace(/\/$/, '');

const TK = 'carddex.token';
const UK = 'carddex.user';

export async function api(path, { method = 'GET', body, auth = true } = {}) {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (auth) {
    const t = localStorage.getItem(TK);
    if (t) headers['Authorization'] = `Bearer ${t}`;
  }
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  // token หมดอายุ/ถูกลบ → เคลียร์ session ไม่งั้นหน้าเว็บคิดว่ายังล็อกอินอยู่แต่ทุกคำขอพัง
  if (res.status === 401 && headers['Authorization']) Auth.logout();
  if (!res.ok) throw Object.assign(new Error(data.error || `HTTP ${res.status}`), { status: res.status, data });
  return data;
}

// ── Auth: เก็บ token+user ไว้ใน localStorage ให้ Nav อ่านแบบ sync ได้ ──
export const Auth = {
  token() { try { return localStorage.getItem(TK) || ''; } catch { return ''; } },
  session() {
    try { const raw = localStorage.getItem(UK); return raw ? JSON.parse(raw) : null; } catch { return null; }
  },
  user() { return null; }, // posts/listings ตอนนี้ฝัง author/seller มาแล้ว
  saveSession(token, user) {
    try { localStorage.setItem(TK, token); localStorage.setItem(UK, JSON.stringify(user)); } catch {}
  },
  async login(email, pass) {
    const { token, user } = await api('/api/auth/login', { method: 'POST', body: { email, pass }, auth: false });
    this.saveSession(token, user);
    return user;
  },
  async googleLogin(credential) {
    const { token, user } = await api('/api/auth/google', { method: 'POST', body: { credential }, auth: false });
    this.saveSession(token, user);
    return user;
  },
  async register(name, email, pass) {
    const { token, user } = await api('/api/auth/register', { method: 'POST', body: { name, email, pass }, auth: false });
    this.saveSession(token, user);
    return user;
  },
  logout() { try { localStorage.removeItem(TK); localStorage.removeItem(UK); } catch {} },
  async me() {
    const { user } = await api('/api/me');
    try { localStorage.setItem(UK, JSON.stringify(user)); } catch {}
    return user;
  },
  async updateProfile(patch) {
    const { user } = await api('/api/me', { method: 'PUT', body: patch });
    try { localStorage.setItem(UK, JSON.stringify(user)); } catch {}
    return user;
  },
  // อัปเดตอวาตาร์: patch = { avatar: dataUrl }
  async updateAvatar(dataUrl) {
    return this.updateProfile({ avatar: dataUrl });
  },
};

// ── Store เหลือไว้เฉพาะ prefs (local-only) ──
export const Store = {
  PREFIX: 'carddex.',
  get(key, fallback) {
    try { const raw = localStorage.getItem(this.PREFIX + key); return raw ? JSON.parse(raw) : fallback; } catch { return fallback; }
  },
  set(key, val) { try { localStorage.setItem(this.PREFIX + key, JSON.stringify(val)); } catch {} return val; },
};

export function readImage(file, cb, max = 900) {
  if (!file || !/^image\//.test(file.type)) { cb(''); return; }
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.onload = () => {
    try {
      const scale = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
      const c = document.createElement('canvas');
      c.width = Math.round(img.naturalWidth * scale) || 1;
      c.height = Math.round(img.naturalHeight * scale) || 1;
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      cb(c.toDataURL('image/jpeg', 0.72));
    } catch { cb(''); }
    URL.revokeObjectURL(url);
  };
  img.onerror = () => { URL.revokeObjectURL(url); cb(''); };
  img.src = url;
}

export function formatDate(v) {
  const d = typeof v === 'number' ? new Date(v) : typeof v === 'string' ? new Date(v) : v;
  if (!(d instanceof Date) || isNaN(d)) return '';
  const diff = Date.now() - d.getTime();
  const m = Math.floor(diff / 60000), h = Math.floor(diff / 3600000), day = Math.floor(diff / 86400000);
  if (m < 1) return 'เมื่อสักครู่';
  if (m < 60) return m + ' นาทีที่แล้ว';
  if (h < 24) return h + ' ชั่วโมงที่แล้ว';
  if (day < 7) return day + ' วันที่แล้ว';
  return d.toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' });
}

export const baht = (n) => Number(n || 0).toLocaleString('th-TH');
