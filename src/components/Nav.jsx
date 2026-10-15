import { useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { Auth } from '../lib.js';

const icons = {
  home: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M4 10.5 12 4l8 6.5V19a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1z"/></svg>,
  market: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M9 4H5a1 1 0 0 0-1 1v3M9 4h6M9 4v14a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V8M15 4h4a1 1 0 0 1 1 1v3M3 8h18M12 12v8M8 16h8M5 20h14"/></svg>,
  camera: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M3 8.5A1.5 1.5 0 0 1 4.5 7h2.2l1.2-2h8.2l1.2 2h2.2A1.5 1.5 0 0 1 21 8.5v9A1.5 1.5 0 0 1 19.5 19h-15A1.5 1.5 0 0 1 3 17.5z"/><circle cx="12" cy="13" r="3.6"/></svg>,
  feed: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M3 5.5A1.5 1.5 0 0 1 4.5 4h15A1.5 1.5 0 0 1 21 5.5v13a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 18.5z"/><path d="M6 8h12M6 12h12M6 16h8"/></svg>,
  db: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><ellipse cx="12" cy="5.5" rx="7.5" ry="2.8"/><path d="M4.5 5.5v6c0 1.5 3.4 2.8 7.5 2.8s7.5-1.3 7.5-2.8v-6M4.5 11.5v6c0 1.5 3.4 2.8 7.5 2.8s7.5-1.3 7.5-2.8v-6"/></svg>,
  profile: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="10" r="4"/><path d="M4 20c0-3.5 3.5-6 8-6s8 2.5 8 6"/></svg>,
  settings: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="3.2"/><path d="M12 3.5v2M12 18.5v2M5.5 12h-2M20.5 12h-2M7.4 7.4L6 6M18 18l-1.4-1.4M16.6 7.4L18 6M6 18l1.4-1.4"/></svg>,
};

export default function Nav({ active }) {
  const user = Auth.session();
  const [menuOpen, setMenuOpen] = useState(false);
  const link = (to, key, label, icon, cls = '') => (
    <NavLink key={key} to={to} className={({ isActive }) => `${cls} ${(isActive || active === key) ? 'on' : ''}`} data-od-id={`nav-${key}`}>
      {icon}<span>{label}</span>
    </NavLink>
  );
  return (
    <>
      <header className="topbar topnav">
        <Link to="/" className="brand-logo"><img src="/assets/logo-96.png" alt="" width="40" height="40" /></Link>
        <Link to="/" className="brand-mini"><b>CARDDUU</b><span>TCG Hub</span></Link>
        <nav className="topnav-links" aria-label="เมนูหลัก">
          {link('/', 'home', 'หน้าแรก', icons.home)}
          {link('/market', 'market', 'ตลาดการ์ด', icons.market)}
          {link('/camera', 'camera', 'เช็คการ์ด', icons.camera)}
          {link('/datacard', 'datacard', 'ฐานข้อมูล', icons.db)}
          {link('/feed', 'feed', 'คอมมูนิตี้', icons.feed)}
          {link('/profile', 'profile', 'โปรไฟล์', icons.profile)}
          {link('/settings', 'settings', 'ตั้งค่า', icons.settings)}
        </nav>
        <div className="spacer"></div>
        {user ? (
          <div style={{ position: 'relative' }}>
            <button onClick={() => setMenuOpen(!menuOpen)} style={{ background: 'none', border: 0, padding: 0, cursor: 'pointer' }}>
              {String(user.avatar || '').startsWith('img:')
                ? <img src={user.avatar.slice(4)} alt={user.name} style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover', display: 'block' }} />
                : <div className="avatar" style={{ width: 36, height: 36, fontSize: 15 }}>{user.avatar}</div>}
            </button>
            {menuOpen && (
              <div style={{ position: 'absolute', top: '110%', right: 0, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 0', minWidth: 140, boxShadow: 'var(--shadow-lg)' }}>
                <Link to="/profile" className="btn btn-ghost" style={{ justifyContent: 'flex-start', width: '100%' }} onClick={() => setMenuOpen(false)}>โปรไฟล์</Link>
                <Link to="/settings" className="btn btn-ghost" style={{ justifyContent: 'flex-start', width: '100%' }} onClick={() => setMenuOpen(false)}>ตั้งค่า</Link>
                <button className="btn btn-ghost" style={{ justifyContent: 'flex-start', width: '100%', color: 'var(--bad)' }} onClick={() => { Auth.logout(); window.location.reload(); }}>ออกจากระบบ</button>
              </div>
            )}
          </div>
        ) : <Link to="/login" className="login-pill">เข้าสู่ระบบ</Link>}
      </header>
      <nav className="tabbar" data-od-id="tab-bar" aria-label="เมนูหลัก">
        <NavLink to="/" className={({ isActive }) => `tab ${(isActive || active === 'home') ? 'on' : ''}`} data-od-id="tab-home">{icons.home}<span>หน้าแรก</span></NavLink>
        <NavLink to="/market" className={({ isActive }) => `tab ${(isActive || active === 'market') ? 'on' : ''}`} data-od-id="tab-market">{icons.market}<span>ตลาด</span></NavLink>
        <NavLink to="/camera" className={({ isActive }) => `tab tab-cam ${(isActive || active === 'camera') ? 'on' : ''}`} data-od-id="tab-camera" aria-label="ตรวจการ์ด">
          <span className="tab-cam-btn" data-od-id="tab-camera-button">{icons.camera}</span>
        </NavLink>
        <NavLink to="/feed" className={({ isActive }) => `tab ${(isActive || active === 'feed') ? 'on' : ''}`} data-od-id="tab-feed">{icons.feed}<span>ฟีด</span></NavLink>
        <NavLink to="/datacard" className={({ isActive }) => `tab ${(isActive || active === 'datacard') ? 'on' : ''}`} data-od-id="tab-datacard">{icons.db}<span>ฐานข้อมูล</span></NavLink>
      </nav>
    </>
  );
}

export function useGuard() {
  const nav = useNavigate();
  const user = Auth.session();
  if (!user) { nav('/login', { replace: true }); return null; }
  return user;
}
