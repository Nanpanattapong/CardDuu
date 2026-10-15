import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Nav from '../components/Nav.jsx';
import { Auth, api, baht, readImage, formatDate } from '../lib.js';

export default function Profile() {
  const nav = useNavigate();
  const [me, setMe] = useState(Auth.session());
  const [posts, setPosts] = useState(null);
  const [saved, setSaved] = useState(null);
  const [history, setHistory] = useState(null);
  const [collection, setCollection] = useState(null);
  const [listings, setListings] = useState(null);
  const [marketValues, setMarketValues] = useState({});
  const [avatarTick, setAvatarTick] = useState(0);
  const TABS = ['posts', 'listings', 'collection', 'saved', 'history'];
  const [tab, setTab] = useState(TABS.includes(location.hash.slice(1)) ? location.hash.slice(1) : 'posts');

  useEffect(() => {
    if (!Auth.session()) { nav('/login?redirect=profile', { replace: true }); return; }
    let alive = true;
    Auth.me().then((u) => { if (alive) setMe(u); }).catch(() => {});
    api(`/api/posts?author=${encodeURIComponent(Auth.session().id)}`).then((p) => { if (alive) setPosts(p); }).catch(() => setPosts([]));
    api(`/api/listings?seller=${encodeURIComponent(Auth.session().id)}`).then((l) => { if (alive) setListings(l); }).catch(() => setListings([]));
    api('/api/saved').then((s) => { if (alive) setSaved(s); }).catch(() => setSaved([]));
    api('/api/checks').then((c) => { if (alive) setHistory(c); }).catch(() => setHistory([]));
    api('/api/collection').then((c) => { if (alive) setCollection(c); }).catch(() => setCollection([]));
    return () => { alive = false; };
  }, [nav, avatarTick]);

  useEffect(() => {
    if (!collection || !collection.length) return;
    let alive = true;
    (async () => {
      const batchSize = 5;
      for (let i = 0; i < collection.length; i += batchSize) {
        if (!alive) return;
        const batch = collection.slice(i, i + batchSize);
        await Promise.all(batch.map(async (c) => {
          try {
            const cleanName = c.name.replace(/\[.*?\]/g, '').trim();
            const code = c.name.match(/\[([\w.]+-[\w.]+)\]/)?.[1] || '';
            const d = await api(`/api/prices?name=${encodeURIComponent(cleanName)}&code=${encodeURIComponent(code)}`, { auth: false });
            if (alive && d?.live?.marketThb) {
              setMarketValues((prev) => ({ ...prev, [c.id]: d.live.marketThb }));
            }
          } catch {}
        }));
      }
    })();
    return () => { alive = false; };
  }, [collection]);

  if (!me) return null;

  const removeCard = async (id) => {
    if (!confirm('นำการ์ดนี้ออกจากคอลเลกชัน?')) return;
    try {
      await api(`/api/collection/${encodeURIComponent(id)}`, { method: 'DELETE' });
      setCollection((c) => c.filter((x) => x.id !== id));
    } catch (e) { alert(e.message); }
  };
  const removePost = async (id) => {
    if (!confirm('ลบโพสต์นี้?')) return;
    try {
      await api(`/api/posts/${encodeURIComponent(id)}`, { method: 'DELETE' });
      setPosts((p) => p.filter((x) => x.id !== id));
    } catch (e) { alert(e.message); }
  };
  const removeListing = async (id) => {
    if (!confirm('ลบรายการขายนี้?')) return;
    try {
      await api(`/api/listings/${encodeURIComponent(id)}`, { method: 'DELETE' });
      setListings((l) => l.filter((x) => x.id !== id));
    } catch (e) { alert(e.message); }
  };

  const totalValue = (collection || []).reduce((s, c) => s + (c.value || 0), 0);
  const totalMarketValue = (collection || []).reduce((s, c) => s + (marketValues[c.id] || c.value || 0), 0);
  const diff = totalMarketValue - totalValue;

  const isPhoto = String(me.avatar || '').startsWith('img:');

  return (
    <>
      <Nav active="profile" />
      <main className="appmain">
        <style>{`
          .profile-tabs{display:flex;gap:0;border-bottom:1px solid var(--border);margin-bottom:20px}
          .profile-tab{flex:1;text-align:center;padding:14px 0;border:0;background:none;border-bottom:2px solid transparent;color:var(--muted);cursor:pointer;font:600 14px/1 var(--body);transition:color .16s,border-color .16s}
          .profile-tab:hover{color:var(--fg)}.profile-tab.active{color:var(--accent-deep);border-bottom-color:var(--accent)}
          .tab-pane{display:none}.tab-pane.active{display:block}
          .post-small{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:12px;margin-bottom:10px}
          .post-small-text{font:400 13px/1.5 var(--body);color:var(--fg);margin-bottom:8px}
          .post-small-meta{font:400 11px/1.4 var(--mono);color:var(--muted)}
        `}</style>
        <div className="page page-narrow">
          <div className="profile-header" data-od-id="profile-header" style={{ justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <label className="profile-avatar" title="แตะเพื่อเปลี่ยนรูปโปรไฟล์" style={{ cursor: 'pointer', overflow: 'hidden', padding: 0 }} key={avatarTick}>
                {isPhoto
                  ? <img src={me.avatar.slice(4)} alt={me.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : me.avatar}
                <input type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  readImage(f, async (data) => {
                    if (!data) return;
                    try {
                      const updated = await Auth.updateAvatar(data);
                      setMe(updated);
                      setAvatarTick((t) => t + 1);
                    } catch {}
                  });
                }} />
              </label>
              <div className="profile-meta"><b>{me.name}</b><span>{me.email}</span><span style={{ fontSize: 11 }}>แตะรูปเพื่อเปลี่ยนรูปโปรไฟล์</span></div>
            </div>
            <Link to="/settings" className="btn btn-sm" data-od-id="profile-settings-btn" title="ตั้งค่า">ตั้งค่า</Link>
          </div>

          <div className="profile-tabs">
            <button className={`profile-tab ${tab === 'posts' ? 'active' : ''}`} onClick={() => setTab('posts')} data-tab="posts">โพสต์</button>
            <button className={`profile-tab ${tab === 'listings' ? 'active' : ''}`} onClick={() => setTab('listings')} data-tab="listings">ลงขาย</button>
            <button className={`profile-tab ${tab === 'collection' ? 'active' : ''}`} onClick={() => setTab('collection')} data-tab="collection">คอลเลกชัน</button>
            <button className={`profile-tab ${tab === 'saved' ? 'active' : ''}`} onClick={() => setTab('saved')} data-tab="saved">บันทึกไว้</button>
            <button className={`profile-tab ${tab === 'history' ? 'active' : ''}`} onClick={() => setTab('history')} data-tab="history">ประวัติตรวจ</button>
          </div>

          <div className={`tab-pane ${tab === 'collection' ? 'active' : ''}`} id="tab-collection">
            {collection === null && <p style={{ color: 'var(--muted)', fontSize: 13 }}>กำลังโหลด…</p>}
            {collection !== null && (collection.length ? (
              <>
                <div className="post-small" style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                    <span style={{ font: '600 12px var(--mono)', color: 'var(--muted)' }}>มูลค่าพอร์ตตลาดประเมิน · {collection.length} ใบ</span>
                    <b style={{ font: '700 24px var(--mono)', color: 'var(--accent-deep)' }}>฿{baht(totalMarketValue)}</b>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--muted)', borderTop: '1px solid var(--border)', paddingTop: 6 }}>
                    <span>ทุนบันทึก: ฿{baht(totalValue)}</span>
                    <span style={{ fontWeight: 600, color: diff >= 0 ? 'var(--ok)' : 'var(--bad)' }}>
                      {diff >= 0 ? '+' : ''}฿{baht(diff)} ({totalValue ? ((diff / totalValue) * 100).toFixed(1) : 0}%)
                    </span>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(130px,1fr))', gap: 12 }}>
                  {collection.map((c) => {
                    const mVal = marketValues[c.id];
                    return (
                      <div key={c.id} className="post-small" style={{ padding: 8, margin: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {c.image && <img src={c.image} alt={c.name} style={{ width: '100%', aspectRatio: '63/88', objectFit: 'contain', background: 'var(--plate)', borderRadius: 4 }} />}
                        <span className="post-small-text" style={{ margin: 0, fontSize: 12, lineHeight: 1.2 }}>{c.name}</span>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 'auto' }}>
                          <span className="post-small-meta">฿{baht(c.value)}</span>
                          {mVal && <span style={{ fontSize: 10, color: mVal >= c.value ? 'var(--ok)' : 'var(--bad)', fontWeight: 600 }}>ตลาด: ฿{baht(mVal)}</span>}
                        </div>
                        <button className="btn btn-sm btn-ghost" onClick={() => removeCard(c.id)}>นำออก</button>
                      </div>
                    );
                  })}
                </div>
              </>
            ) : <div className="empty"><h3>คอลเลกชันยังว่าง</h3><p>กด "+ คอลเลกชัน" ในหน้าการ์ดที่ตลาด เพื่อเก็บไว้ที่นี่</p><Link className="btn btn-sm" to="/market">ไปที่ตลาดการ์ด</Link></div>)}
          </div>

          <div className={`tab-pane ${tab === 'posts' ? 'active' : ''}`} id="tab-posts">
            <div className="stack">
              {posts === null && <p style={{ color: 'var(--muted)', fontSize: 13 }}>กำลังโหลด…</p>}
              {posts !== null && (posts.length ? posts.map((p) => (
                <div key={p.id} className="post-small">
                  <div className="post-small-text">{p.text}</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div className="post-small-meta">{formatDate(p.created_at)} · {p.likes || 0} ถูกใจ</div>
                    <button className="btn btn-sm btn-ghost" style={{ color: 'var(--bad)' }} onClick={() => removePost(p.id)}>ลบ</button>
                  </div>
                </div>
              )) : <div className="empty"><h3>ยังไม่มีโพสต์</h3><p>เมื่อโพสต์ในฟีด จะปรากฏตรงนี้</p></div>)}
            </div>
          </div>

          <div className={`tab-pane ${tab === 'listings' ? 'active' : ''}`} id="tab-listings">
            <div className="stack">
              {listings === null && <p style={{ color: 'var(--muted)', fontSize: 13 }}>กำลังโหลด…</p>}
              {listings !== null && (listings.length ? listings.map((l) => (
                <div key={l.id} className="post-small" style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  <Link to={`/market?item=${encodeURIComponent(l.id)}`} style={{ display: 'flex', gap: 12, alignItems: 'center', flex: 1, minWidth: 0, textDecoration: 'none', color: 'inherit' }}>
                    <img src={l.image} alt={l.name} style={{ width: 56, height: 78, borderRadius: 4, objectFit: 'contain', flex: 'none', background: 'var(--plate)' }} />
                    <span style={{ minWidth: 0 }}><span className="post-small-text" style={{ margin: 0 }}>{l.name}</span><span className="post-small-meta">{l.era} · ฿{baht(l.price)}</span></span>
                  </Link>
                  <button className="btn btn-sm btn-ghost" style={{ color: 'var(--bad)' }} onClick={() => removeListing(l.id)}>ลบ</button>
                </div>
              )) : <div className="empty"><h3>ยังไม่มีรายการขาย</h3><p>ลงขายการ์ดในตลาด แล้วจัดการได้ที่นี่</p><Link className="btn btn-sm" to="/market">ไปที่ตลาดการ์ด</Link></div>)}
            </div>
          </div>

          <div className={`tab-pane ${tab === 'saved' ? 'active' : ''}`} id="tab-saved">
            <div className="stack">
              {saved === null && <p style={{ color: 'var(--muted)', fontSize: 13 }}>กำลังโหลด…</p>}
              {saved !== null && (saved.length ? saved.map((l) => (
                <Link key={l.id} className="post-small" style={{ display: 'flex', gap: 12, alignItems: 'center', textDecoration: 'none', color: 'inherit' }} to={`/market?item=${encodeURIComponent(l.id)}`}>
                  <img src={l.image} alt={l.name} style={{ width: 56, height: 78, borderRadius: 4, objectFit: 'contain', flex: 'none', background: 'var(--plate)' }} />
                  <span style={{ minWidth: 0 }}><span className="post-small-text" style={{ margin: 0 }}>{l.name}</span><span className="post-small-meta">{l.era} · ฿{baht(l.price)}</span></span>
                </Link>
              )) : <div className="empty"><h3>ยังไม่มีรายการบันทึก</h3><p>เมื่อกดบันทึกการ์ดในตลาด จะเก็บไว้ที่นี่</p><Link className="btn btn-sm" to="/market">ไปที่ตลาดการ์ด</Link></div>)}
            </div>
          </div>

          <div className={`tab-pane ${tab === 'history' ? 'active' : ''}`} id="tab-history">
            <div className="stack">
              {history === null && <p style={{ color: 'var(--muted)', fontSize: 13 }}>กำลังโหลด…</p>}
              {history !== null && (history.length ? history.map((r, i) => (
                <div key={i} className="post-small">
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 6 }}><b style={{ color: `var(--${r.kind})` }}>{r.score}</b><span style={{ font: '400 13px/1.3 var(--body)', color: 'var(--fg)' }}>{r.name}</span></div>
                  <div className="post-small-meta">{formatDate(r.created_at)}</div>
                </div>
              )) : <div className="empty"><h3>ยังไม่มีประวัติ</h3><p>เมื่อส่งตรวจการ์ดครั้งแรก ผลจะบันทึกตรงนี้</p></div>)}
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
