import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Nav from '../components/Nav.jsx';
import Avatar from '../components/Avatar.jsx';
import { Auth, api, formatDate, readImage } from '../lib.js';

export default function Feed() {
  const nav = useNavigate();
  const me = Auth.session();
  const [posts, setPosts] = useState(null); // null = loading
  const [text, setText] = useState('');
  const [postImage, setPostImage] = useState('');
  const [toastMsg, setToastMsg] = useState('');
  const [commentText, setCommentText] = useState({});
  const [err, setErr] = useState('');

  useEffect(() => { if (!me) nav('/login?redirect=feed', { replace: true }); }, [me, nav]);
  useEffect(() => {
    let alive = true;
    api('/api/posts').then((data) => { if (alive) setPosts(data); }).catch((e) => { if (alive) setErr(e.message); });
    return () => { alive = false; };
  }, []);
  useEffect(() => {
    const h = (location.hash || '').slice(1);
    if (/^post-/.test(h || '')) {
      const el = document.getElementById(h);
      if (el) { el.classList.add('flash'); window.scrollTo(0, Math.max(0, el.offsetTop - 90)); }
    }
  }, [posts]);

  if (!me) return null;

  const showToast = (m) => { setToastMsg(m); setTimeout(() => setToastMsg(''), 2500); };

  const submit = async (e) => {
    e.preventDefault();
    const t = text.trim();
    if (!t) return;
    try {
      const { id } = await api('/api/posts', { method: 'POST', body: { text: t, image: postImage || undefined } });
      const fresh = await api('/api/posts');
      setPosts(fresh);
      setText(''); setPostImage(''); showToast('โพสต์แล้ว');
      void id;
    } catch (e2) { setErr(e2.message); }
  };

  const toggleLike = async (id) => {
    try {
      const { liked } = await api(`/api/posts/${id}/like`, { method: 'POST' });
      setPosts((prev) => prev.map((p) => p.id === id ? { ...p, liked, likes: liked ? (p.likes || 0) + 1 : Math.max(0, (p.likes || 0) - 1) } : p));
    } catch (e2) { setErr(e2.message); }
  };

  const removePost = async (id) => {
    if (!confirm('ลบโพสต์นี้?')) return;
    try {
      await api(`/api/posts/${encodeURIComponent(id)}`, { method: 'DELETE' });
      setPosts((prev) => prev.filter((p) => p.id !== id));
      showToast('ลบโพสต์แล้ว');
    } catch (e2) { setErr(e2.message); }
  };

  const addComment = async (e, id) => {
    e.preventDefault();
    const t = (commentText[id] || '').trim();
    if (!t) return;
    try {
      await api(`/api/posts/${id}/comments`, { method: 'POST', body: { text: t } });
      const fresh = await api('/api/posts');
      setPosts(fresh); setCommentText((m) => ({ ...m, [id]: '' }));
    } catch (e2) { setErr(e2.message); }
  };

  return (
    <>
      <Nav active="feed" />
      <main className="appmain">
        <style>{`.post.flash{border-color:var(--accent);box-shadow:0 0 0 2px var(--accent-soft)}`}</style>
        <div className="page page-narrow">
          <section className="sect" style={{ borderTop: 0 }} data-od-id="feed-header">
            <div className="sect-head"><div><h1 style={{ fontSize: 28 }}>คอมมูนิตี้เทรนเนอร์</h1><p className="kicker" style={{ marginTop: 6, letterSpacing: '.08em', textTransform: 'none' }}>แลกเปลี่ยนความรู้ เช็คการ์ด โชว์การ์ดหายาก</p></div></div>
          </section>

          <div className="composer" data-od-id="feed-composer">
            <form onSubmit={submit}>
              <div className="composer-head"><Avatar user={me} /><b style={{ font: '600 14px var(--body)' }}>{me.name}</b></div>
              <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="แชร์การ์ดใบโปรด หรือสอบถามเรื่องการ์ด..." required />
              {postImage && (
                <div style={{ marginBottom: 12, maxWidth: 220 }}>
                  <img src={postImage} alt="preview" style={{ width: '100%', borderRadius: 8, border: '1px solid var(--border)', display: 'block' }} />
                  <button type="button" className="btn btn-sm btn-ghost" onClick={() => setPostImage('')}>ลบรูป</button>
                </div>
              )}
              <div className="composer-actions" style={{ justifyContent: 'space-between' }}>
                <label className="btn btn-sm" style={{ cursor: 'pointer' }}>📷 ใส่รูป
                  <input type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (!f) return;
                    readImage(f, (data) => { if (data) setPostImage(data); });
                  }} />
                </label>
                <button type="submit" className="btn btn-primary btn-sm">โพสต์</button>
              </div>
            </form>
          </div>

          {err && <p style={{ color: 'var(--bad)', fontSize: 13, margin: '10px 0' }}>{err}</p>}
          {posts === null && <p style={{ color: 'var(--muted)', fontSize: 13 }}>กำลังโหลด…</p>}

          <div className="stack">
            {posts !== null && posts.length === 0 && <div className="empty"><h3>ยังไม่มีโพสต์</h3><p>เป็นคนแรกที่โพสต์ในคอมมูนิตี้สิ</p></div>}
            {(posts || []).map((p) => (
              <div key={p.id} className="post" id={p.id} data-od-id={`post-${p.id}`}>
                <div className="post-head"><Avatar user={p.author} /><div className="post-meta"><b>{p.author.name}</b><span>{formatDate(p.created_at)}</span></div>
                  {p.author.id === me.id && <button className="btn btn-sm btn-ghost" style={{ marginLeft: 'auto', color: 'var(--bad)' }} onClick={() => removePost(p.id)}>ลบ</button>}
                </div>
                <div className="post-text">{p.text}</div>
                {p.image && <div className="post-thumb"><img src={p.image} alt={`ภาพการ์ดจาก ${p.author.name}`} loading="lazy" /></div>}
                <div className="post-actions">
                  <button className={`post-action ${p.liked ? 'liked' : ''}`} onClick={() => toggleLike(p.id)}>
                    <svg viewBox="0 0 24 24" fill={p.liked ? 'currentColor' : 'none'} stroke="currentColor"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" /></svg>
                    {p.likes || 0}
                  </button>
                  <button className="post-action" onClick={() => document.getElementById(`compose-${p.id}`)?.focus()}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
                    {p.comments ? p.comments.length : 0}
                  </button>
                </div>
                {p.comments?.length > 0 && (
                  <ul className="comments">
                    {p.comments.map((c, i) => (
                      <li key={i} className="comment">
                        <div className="comment-avatar" style={{ overflow: 'hidden', padding: 0 }}>
                          {String(c.author.avatar || 'ท').startsWith('img:') ? <img src={String(c.author.avatar).slice(4)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : String(c.author.avatar || 'ท')}
                        </div>
                        <div className="comment-body"><span className="comment-author">{c.author.name}</span><div className="comment-text">{c.text}</div><div className="comment-when">{formatDate(c.created_at)}</div></div>
                      </li>
                    ))}
                  </ul>
                )}
                <form className="row" style={{ marginTop: 14 }} onSubmit={(e) => addComment(e, p.id)}>
                  <input type="text" id={`compose-${p.id}`} style={{ minHeight: 44, fontSize: 13 }} placeholder="แสดงความคิดเห็น..." required value={commentText[p.id] || ''} onChange={(e) => setCommentText((m) => ({ ...m, [p.id]: e.target.value }))} />
                  <button type="submit" className="btn btn-sm btn-ghost" style={{ padding: 0 }}>ส่ง</button>
                </form>
              </div>
            ))}
          </div>
        </div>
      </main>
      {toastMsg && <div className="toast on">{toastMsg}</div>}
    </>
  );
}
