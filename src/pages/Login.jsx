import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Auth } from '../lib.js';

export default function Login() {
  const nav = useNavigate();
  const [tab, setTab] = useState('login');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', pass: '' });

  const submit = async (e) => {
    e.preventDefault();
    setMsg(''); setBusy(true);
    try {
      if (tab === 'login') {
        await Auth.login(form.email, form.pass);
        nav(new URLSearchParams(location.search).get('redirect') || '/');
      } else {
        if (form.pass.length < 8) { setMsg('รหัสผ่านอย่างน้อย 8 ตัว'); return; }
        await Auth.register(form.name, form.email, form.pass);
        nav('/');
      }
    } catch (err) { setMsg(err.message || 'ทำรายการไม่สำเร็จ'); }
    finally { setBusy(false); }
  };

  useEffect(() => {
    const render = () => {
      const el = document.getElementById('gsi-btn');
      if (!el || !window.google?.accounts) return;
      window.google.accounts.id.initialize({
        client_id: '216672545845-v3leht4u5aotrf31cuvhhg8sice6fo39.apps.googleusercontent.com',
        callback: async (res) => {
          try {
            await Auth.googleLogin(res.credential);
            nav(new URLSearchParams(location.search).get('redirect') || '/');
          } catch (e) { setMsg(e.message); }
        }
      });
      window.google.accounts.id.renderButton(el, { theme: 'outline', size: 'large', text: 'signin_with' });
    };
    // กลับมาหน้านี้อีกรอบ script โหลดไว้แล้ว → วาดปุ่มใหม่เลย
    const old = document.getElementById('gsi-script');
    if (old) { if (window.google?.accounts) render(); else old.addEventListener('load', render); return () => old.removeEventListener('load', render); }
    const s = document.createElement('script');
    s.id = 'gsi-script';
    s.src = 'https://accounts.google.com/gsi/client';
    s.async = true;
    s.onload = render;
    document.body.appendChild(s);
  }, [nav]);

  return (
    <div className="auth">
      <style>{`
        .auth{min-height:100vh;min-height:100dvh;display:grid;grid-template-columns:1fr}.auth-aside{position:relative;background:var(--ink);color:var(--on-ink);padding:34px var(--gut) 30px;overflow:hidden;isolation:isolate}.auth-aside::after{content:'';position:absolute;inset:0;z-index:-1;background:linear-gradient(180deg, oklch(18% 0.012 250 / .65), oklch(18% 0.012 250 / .95) 65%, var(--ink))}.auth-aside img{position:absolute;inset:0;z-index:-2;width:100%;height:100%;object-fit:contain;opacity:.4;filter:blur(2px)}.auth-brand{text-decoration:none;display:block;margin-bottom:26px}.auth-brand b{display:block;font:700 21px/1.2 var(--display);color:var(--on-ink);letter-spacing:-.02em}.auth-brand span{font:400 10.5px/1.5 var(--mono);letter-spacing:.12em;text-transform:uppercase;color:var(--accent)}.auth-aside h1{font:600 28px/1.25 var(--display);color:var(--on-ink);margin-bottom:12px;max-width:16ch}.auth-aside p{font-size:14.5px;line-height:1.7;color:var(--on-ink-mute);max-width:44ch}.auth-main{display:flex;align-items:center;justify-content:center;padding:34px var(--gut) 48px}.auth-card{width:100%;max-width:400px}.auth-card>h2{font-size:22px;margin-bottom:6px}.auth-card>.lede{font-size:14px;margin-bottom:22px}.demo-note{margin-top:20px;padding:14px 15px;border:1px dashed var(--border);border-radius:var(--radius);background:var(--surface)}.demo-note p{font-size:12.5px;line-height:1.6;color:var(--muted);margin-bottom:10px}.demo-note code{font:500 12px/1 var(--mono);color:var(--accent-deep)}.auth-foot{margin-top:22px;text-align:center;font-size:13px;color:var(--muted)}@media(min-width:900px){.auth{grid-template-columns:1fr 1fr}.auth-aside{display:flex;flex-direction:column;justify-content:center;padding:56px 48px}.auth-aside h1{font-size:36px}.auth-main{padding:56px 48px}}
      `}</style>
      <section className="auth-aside">
        <img src="/assets/charizard-ex-sir-sv3-223.png" alt="" aria-hidden="true" />
        <Link to="/" className="auth-brand"><b>CARDDUU</b><span>Card Authenticator</span></Link>
        <h1>เช็คการ์ดให้มั่นใจ ก่อนเริ่มเทรดหรือสะสม</h1>
        <p>สมัครสมาชิกเพื่อบันทึกผลการตรวจการ์ด ลงขายในตลาดการ์ด และแลกเปลี่ยนความรู้กับเทรนเนอร์ในคอมมูนิตี้</p>
      </section>
      <main className="auth-main">
        <div className="auth-card">
          <div className="tabs" role="tablist">
            <button className={`tab-btn ${tab === 'login' ? 'active' : ''}`} onClick={() => setTab('login')}>เข้าสู่ระบบ</button>
            <button className={`tab-btn ${tab === 'register' ? 'active' : ''}`} onClick={() => setTab('register')}>สมัครสมาชิก</button>
          </div>
          <form onSubmit={submit}>
            {tab === 'register' && <div className="field"><label>ชื่อเทรนเนอร์</label><input type="text" required value={form.name} onChange={e=>setForm({...form,name:e.target.value})} /></div>}
            <div className="field"><label>อีเมล</label><input type="email" required value={form.email} onChange={e=>setForm({...form,email:e.target.value})} /></div>
            <div className="field"><label>รหัสผ่าน</label><input type="password" required value={form.pass} onChange={e=>setForm({...form,pass:e.target.value})} /></div>
            {msg && <p style={{ color: 'var(--bad)', fontSize: 13, marginBottom: 10 }}>{msg}</p>}
            <button type="submit" disabled={busy} className="btn btn-primary btn-block">{busy ? 'รอสักครู่…' : tab === 'login' ? 'เข้าสู่ระบบ' : 'สมัครสมาชิก'}</button>
          </form>
          <div style={{ margin: '20px 0', textAlign: 'center' }}>
            <div id="gsi-btn" style={{ display: 'flex', justifyContent: 'center' }}></div>
          </div>
          {tab === 'login' && <div className="demo-note"><p>บัญชีทดลอง <code>demo@example.com</code> / <code>demo1234</code></p><button className="btn btn-sm" disabled={busy} onClick={async () => { setBusy(true); try { await Auth.login('demo@example.com', 'demo1234'); nav('/'); } catch (e) { setMsg(e.message); } finally { setBusy(false); } }}>เข้าใช้</button></div>}
        </div>
      </main>
    </div>
  );
}
