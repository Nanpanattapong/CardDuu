import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import Nav from '../components/Nav.jsx';
import { Auth, Store, api } from '../lib.js';

export default function Settings() {
  const me = Auth.session();
  if (!me) return <Navigate to="/login?redirect=settings" replace />;
  return <SettingsForm me={me} />;
}

function SettingsForm({ me }) {
  const nav = useNavigate();
  const [oldPass, setOldPass] = useState('');
  const [newPass, setNewPass] = useState('');
  const [name, setName] = useState(me.name);
  const [email, setEmail] = useState(me.email);
  const [contact, setContact] = useState(me.contact || '');
  const [prefs, setPrefs] = useState(Store.get('prefs', { comments: true, likes: true, market: false, pub: true, showEmail: false }));
  const [toast, setToast] = useState('');
  const [err, setErr] = useState('');

  const showToast = (m) => { setToast(m); setTimeout(() => setToast(''), 3000); };
  const updatePref = (k, v) => { const next = { ...prefs, [k]: v }; setPrefs(next); Store.set('prefs', next); showToast('บันทึกแล้ว'); };

  const saveProfile = async (e) => {
    e.preventDefault(); setErr('');
    try {
      await Auth.updateProfile({ name, email, contact });
      showToast('บันทึกบัญชีแล้ว');
    } catch (ex) { setErr(ex.message); }
  };

  const changePass = async (e) => {
    e.preventDefault(); setErr('');
    try {
      await api('/api/me/password', { method: 'PUT', body: { old: oldPass, pass: newPass } });
      setOldPass(''); setNewPass('');
      showToast('เปลี่ยนรหัสผ่านแล้ว');
    } catch (ex) { setErr(ex.message); }
  };

  const clearHistory = async () => {
    if (!confirm('ล้างประวัติการเช็คทั้งหมด?')) return;
    try {
      await api('/api/checks', { method: 'DELETE' });
      showToast('ล้างประวัติแล้ว');
    } catch (ex) { setErr(ex.message); }
  };

  return (
    <>
      <Nav active="settings" />
      <main className="appmain">
        <style>{`.settings-card{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:20px;margin-bottom:16px}.settings-card h2{font-size:17px;margin-bottom:14px}.settings-card h3{font-size:14px;margin:18px 0 10px}.settings-meta{font:400 12px/1.4 var(--mono);color:var(--muted);margin-top:6px}.divider{height:1px;background:var(--border);border:0;margin:16px 0}.danger-zone{border-color:oklch(50% 0.19 25 / .28)}`}</style>
        <div className="page page-narrow">
          <section className="sect" style={{ borderTop: 0 }}><h1>ตั้งค่า</h1><p className="kicker" style={{ marginTop: 6, letterSpacing: '.08em', textTransform: 'none' }}>บัญชี ความเป็นส่วนตัว และข้อมูล</p></section>
          {err && <p style={{ color: 'var(--bad)', fontSize: 13, marginBottom: 12 }}>{err}</p>}
          <div className="settings-card">
            <h2>บัญชี</h2>
            <form onSubmit={saveProfile}>
              <div className="field"><label>ชื่อเทรนเนอร์</label><input value={name} onChange={e=>setName(e.target.value)} required /></div>
              <div className="field"><label>อีเมล</label><input type="email" value={email} onChange={e=>setEmail(e.target.value)} required /></div>
              <div className="field"><label>ช่องทางติดต่อซื้อขาย (แสดงในหน้าติดต่อ เช่น LINE ID / เบอร์โทร)</label><input value={contact} onChange={e=>setContact(e.target.value)} placeholder="เช่น LINE: carddex, โทร 08x-xxx-xxxx" /></div>
              <button type="submit" className="btn btn-primary btn-sm">บันทึกบัญชี</button>
            </form>
            <h3>เปลี่ยนรหัสผ่าน</h3>
            <form onSubmit={changePass}>
              <div className="field"><label>รหัสผ่านเดิม</label><input type="password" autoComplete="current-password" value={oldPass} onChange={e=>setOldPass(e.target.value)} required /></div>
              <div className="field"><label>รหัสผ่านใหม่ (อย่างน้อย 8 ตัว)</label><input type="password" autoComplete="new-password" minLength={8} value={newPass} onChange={e=>setNewPass(e.target.value)} required /></div>
              <button type="submit" className="btn btn-sm">เปลี่ยนรหัสผ่าน</button>
            </form>
          </div>
          <div className="settings-card">
            <h2>การแจ้งเตือน</h2>
            {[['คอมเมนต์ใหม่', 'comments'], ['มีคนถูกใจโพสต์', 'likes'], ['ข่าวตลาดการ์ด', 'market']].map(([l, k]) => (
              <div key={k} className="setting-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 0', borderBottom: '1px solid var(--border)' }}>
                <div className="setting-label"><b>{l}</b></div>
                <label className="switch"><input type="checkbox" checked={prefs[k]} onChange={(e)=>updatePref(k, e.target.checked)} /><span className="track"><span className="knob"></span></span></label>
              </div>
            ))}
          </div>
          <div className="settings-card">
            <h2>ความเป็นส่วนตัว</h2>
            {[['โปรไฟล์สาธารณะ', 'pub'], ['แสดงอีเมลบนโปรไฟล์', 'showEmail']].map(([l, k]) => (
              <div key={k} className="setting-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 0', borderBottom: '1px solid var(--border)' }}>
                <div className="setting-label"><b>{l}</b></div>
                <label className="switch"><input type="checkbox" checked={prefs[k]} onChange={(e)=>updatePref(k, e.target.checked)} /><span className="track"><span className="knob"></span></span></label>
              </div>
            ))}
          </div>
          <div className="settings-card">
            <h2>ข้อมูล</h2>
            <div className="btn-row" style={{ display: 'flex', gap: 10 }}>
              <button className="btn btn-sm btn-danger" onClick={clearHistory}>ล้างประวัติการเช็ค</button>
            </div>
          </div>
          <div className="settings-card danger-zone">
            <h2>ออกจากระบบ</h2>
            <button className="btn btn-danger-solid" onClick={() => { Auth.logout(); nav('/login'); }}>ออกจากระบบ</button>
          </div>
        </div>
      </main>
      {toast && <div className="toast on">{toast}</div>}
    </>
  );
}
