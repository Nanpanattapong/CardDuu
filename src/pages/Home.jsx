import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import Nav from '../components/Nav.jsx';
import Avatar from '../components/Avatar.jsx';
import { Auth, api, baht, formatDate } from '../lib.js';
import { imgUrl, hasImage, loadIndex, loadPrices, loadGameDb } from '../lib/cards.js';

function Orbit({ listings }) {
  const stageRef = useRef(null);
  const [pausedCard, setPaused] = useState(null);
  const cards = (listings || []).slice(0, 6);
  const nodesRef = useRef([]);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage || !cards.length) return;

    let radius = Math.min(340, window.innerWidth * 0.42);
    const onResize = () => { radius = Math.min(340, window.innerWidth * 0.42); };
    window.addEventListener('resize', onResize);

    const TILT_K = 0.31;
    let last = performance.now();
    let isPaused = false;
    let rafId = 0;

    // Build node elements list from refs
    const els = nodesRef.current.slice(0, cards.length).filter(Boolean);
    const nodes = els.map((el, i) => ({
      el,
      angle: (i * (360 / cards.length)) * Math.PI / 180,
      speed: 0.00035,
    }));

    function paint(item) {
      const R = radius;
      const x = Math.cos(item.angle) * R;
      const y = Math.sin(item.angle) * R * TILT_K;
      const depth = (Math.sin(item.angle) + 1) / 2; // 0 (back) -> 1 (front)
      item.el.style.transform = `translate(-50%, -50%) translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
      item.el.style.zIndex = String(Math.round(depth * 100));
      item.el.style.opacity = (0.45 + depth * 0.55).toFixed(2);
    }

    function tick(now) {
      const dt = Math.min(now - last, 100);
      last = now;
      if (!isPaused) {
        nodes.forEach((item) => {
          item.angle += item.speed * dt;
          paint(item);
        });
      }
      rafId = requestAnimationFrame(tick);
    }

    stage._setPaused = (v) => { isPaused = v; };
    nodes.forEach(paint);
    rafId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', onResize);
    };
  }, [cards.length]);

  return (
    <div className="orbit-stage" ref={stageRef} id="orbit-stage" data-od-id="home-hero-orbit">
      <div className="orbit-ring"></div>
      <div className="orbit-core" title="Poké Ball — ศูนย์กลางจักรวาลการ์ด!">
        <img src="/assets/pokeball.svg" alt="Poké Ball" width="200" height="200" />
      </div>
      {cards.map((l, i) => (
        <Link
          key={l.id}
          to={`/market?item=${encodeURIComponent(l.id)}`}
          className={`orbit-card ${pausedCard === l.id ? 'is-active' : ''}`}
          ref={(el) => { nodesRef.current[i] = el; }}
          onMouseEnter={() => { setPaused(l.id); if (stageRef.current) stageRef.current._setPaused?.(true); }}
          onMouseLeave={() => { setPaused(null); if (stageRef.current) stageRef.current._setPaused?.(false); }}
          onTouchStart={() => { setPaused(l.id); if (stageRef.current) stageRef.current._setPaused?.(true); }}
        >
          <div className="orbit-card-frame"><img src={l.image} alt={l.name} loading="lazy" /></div>
          <div className="orbit-tip">
            <b>{l.name}</b>
            <span className="orbit-tip-meta">{l.era}</span>
            <span className="orbit-tip-price">฿{baht(l.price)} · ดูในตลาด →</span>
          </div>
        </Link>
      ))}
      <p className="orbit-hint">โฮเวอร์เพื่อหยุด — แตะการ์ดเพื่อดูราคา</p>
    </div>
  );
}

export default function Home() {
  const [listings, setListings] = useState([]);
  const [posts, setPosts] = useState([]);
  const [history, setHistory] = useState([]);
  const [top, setTop] = useState([]);
  const [topYgo, setTopYgo] = useState([]);
  const [topOp, setTopOp] = useState([]);
  const [topFb, setTopFb] = useState([]);

  useEffect(() => {
    let alive = true;
    Promise.all([loadPrices(), loadIndex()]).then(([{ prices = {} }, idx]) => {
      const name = {};
      for (const [n, codes] of Object.entries(idx)) for (const c of codes) name[c] = n;
      const list = Object.entries(prices).filter(([c]) => hasImage(c))
        .map(([code, p]) => ({ code, name: name[code] || code, price: p.m || p.c || 0 }))
        .sort((a, b) => b.price - a.price).slice(0, 4);
      if (alive) setTop(list);
    });
    // โหลด metadata เกมอื่นเมื่อ idle เพื่อไม่บล็อก first paint ของหน้าแรก
    const loadSecondary = () => Promise.all(['yugioh', 'onepiece', 'football'].map(loadGameDb)).then(([ygo, op, fb]) => {
      if (!alive) return;
      const getTop = (meta) => Object.entries(meta.priceOf)
        .map(([code, p]) => ({ code, name: meta.nameOf[code] || code, price: p }))
        .sort((a, b) => b.price - a.price).slice(0, 4);
      setTopYgo(getTop(ygo));
      setTopOp(getTop(op));
      setTopFb(getTop(fb));
    });
    if ('requestIdleCallback' in window) requestIdleCallback(loadSecondary, { timeout: 2500 });
    else setTimeout(loadSecondary, 500);
    api('/api/listings', { auth: false }).then((d) => { if (alive) setListings(d); }).catch(() => {});
    api('/api/posts', { auth: false }).then((d) => { if (alive) setPosts(d); }).catch(() => {});
    if (Auth.session()) {
      api('/api/checks').then((d) => { if (alive) setHistory(d); }).catch(() => {});
    }
    return () => { alive = false; };
  }, []);

  return (
    <>
      <Nav active="home" />
      <main className="appmain">
        <section className="hero" data-od-id="home-hero">
          <video className="hero-video" src="/assets/hero-bg.mp4" autoPlay muted loop playsInline />
          <div className="hero-tint" aria-hidden="true" />
          <style>{`
            .hero{padding:0;margin-bottom:0;border-radius:0;position:relative;overflow:hidden;background:oklch(14% 0.012 250)}
            .hero-video{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:.6;pointer-events:none}
            .hero-tint{position:absolute;inset:0;pointer-events:none;background:linear-gradient(180deg,oklch(14% 0.012 250 / .2),oklch(14% 0.012 250 / .4) 60%,oklch(14% 0.012 250 / .65)),radial-gradient(circle at 80% 20%,oklch(62% 0.2 255 / .45),transparent 60%)}
            .hero-grid{display:flex;flex-direction:column;align-items:center;position:relative;z-index:1;padding:12px var(--gut) 32px;text-align:center}
            .hero-copy{max-width:840px;margin:0 auto 32px;display:flex;flex-direction:column;align-items:center}
            .hero-copy h1{font-size:44px;text-shadow:0 2px 10px oklch(0% 0 0 / .3);margin-bottom:16px}
            .hero-copy h1 em{font-size:44px;margin-top:0;display:block;color:var(--accent)}
            .hero-copy p{max-width:60ch;margin-bottom:24px;color:var(--on-ink-mute)}
            .orbit-stage{position:relative;width:100%;max-width:1000px;min-height:560px;margin-top:-56px;display:grid;place-items:center;overflow:visible;perspective:1200px;perspective-origin:50% 42%}
            .orbit-core{position:relative;z-index:50;text-align:center;width:140px;height:140px;filter:drop-shadow(0 0 45px oklch(58% 0.18 255 / .45)) drop-shadow(0 18px 30px oklch(0% 0 0 / .6));animation:core-float 4s ease-in-out infinite alternate}
            .orbit-core img{width:100%;height:100%;display:block;object-fit:contain}
            @keyframes core-float{from{transform:translateY(-6px)}to{transform:translateY(6px)}}
            .orbit-ring{position:absolute;top:50%;left:50%;width:min(680px,92vw);height:min(680px,92vw);border:1px dashed oklch(100% 0 0 / .18);border-radius:50%;transform:translate(-50%,-50%) rotateX(72deg);pointer-events:none}
            .orbit-card{position:absolute;top:50%;left:50%;display:block;width:132px;padding:0;border:0;background:none;cursor:pointer;text-decoration:none;will-change:transform,filter;z-index:5}
            .orbit-card-frame{position:relative;border-radius:10px;transition:transform .35s cubic-bezier(.16,1,.3,1),box-shadow .35s}
            .orbit-card img{width:100%;height:auto;aspect-ratio:63/88;object-fit:contain;display:block;border-radius:10px;filter:drop-shadow(0 16px 32px oklch(0% 0 0 / .75));transition:filter .3s}
            .orbit-card:hover .orbit-card-frame,.orbit-card.is-active .orbit-card-frame{transform:scale(1.2) translateY(-6px);box-shadow:0 0 35px oklch(58% 0.18 255 / .9),0 25px 50px oklch(0% 0 0 / .85)}
            .orbit-card:hover img,.orbit-card.is-active img{filter:drop-shadow(0 0 30px oklch(58% 0.18 255 / .95))}
            .orbit-tip{position:absolute;z-index:30;bottom:calc(100% + 10px);left:50%;transform:translateX(-50%) scale(.9);min-width:190px;padding:10px 12px;border-radius:10px;background:oklch(10% 0.01 250 / .96);border:1px solid oklch(58% 0.18 255 / .55);color:var(--on-ink);text-align:center;font:600 12px/1.4 var(--body);opacity:0;transition:opacity .2s,transform .22s cubic-bezier(.16,1,.3,1);pointer-events:none;white-space:nowrap}
            .orbit-tip b{display:block;font-size:13px;margin-bottom:2px}
            .orbit-tip-meta{display:block;font:500 11px/1.4 var(--mono);color:var(--on-ink-mute)}
            .orbit-tip-price{display:block;font:600 12px/1.4 var(--mono);color:var(--accent);margin-top:4px}
            .orbit-card:hover .orbit-tip,.orbit-card.is-active .orbit-tip{opacity:1;transform:translateX(-50%) scale(1)}
            .orbit-hint{position:absolute;bottom:6px;left:0;right:0;z-index:2;text-align:center;font:400 11px/1.5 var(--mono);letter-spacing:.06em;color:var(--on-ink-mute)}
            @media(min-width:768px){.hero-copy h1{font-size:56px}.hero-copy h1 em{font-size:56px}.orbit-stage{min-height:600px}.orbit-core{width:180px;height:180px}.orbit-card{width:168px}}
            @media(min-width:1024px){.orbit-stage{min-height:640px}.orbit-core{width:200px;height:200px}.orbit-card{width:188px}}
            @media(max-width:480px){.orbit-stage{min-height:460px}.orbit-card{width:104px}.orbit-core{width:120px;height:120px}}
            .rowlist{display:grid;gap:10px}
            .rowitem{display:flex;align-items:center;gap:13px;width:100%;text-align:left;padding:11px 13px;background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);color:var(--fg);text-decoration:none;cursor:pointer;transition:background .16s,border-color .16s}
            .rowitem:hover{background:var(--hover);border-color:oklch(85% 0.006 250)}
            .rowitem img{width:52px;height:52px;border-radius:4px;object-fit:cover;flex:none;background:var(--plate)}
            .rowitem .rowmain{min-width:0;flex:1}
            .rowitem .rowmain b{display:block;font:600 14px/1.35 var(--body)}
            .rowitem .rowmain span{font:400 12px/1.4 var(--body);color:var(--muted)}
            .rowitem .rowend{font:600 14px/1 var(--mono);color:var(--accent-deep);white-space:nowrap}
            .rowitem .score-ok{color:var(--ok)}.rowitem .score-bad{color:var(--bad)}.rowitem .score-hold{color:var(--hold)}
            .two-col{display:grid;gap:28px;grid-template-columns:1fr}
            @media(min-width:768px){.two-col{grid-template-columns:minmax(0,1fr) minmax(0,1fr)}}
          `}</style>
          <div className="hero-grid">
            <div className="hero-copy">
              <span className="kicker kicker-gold" style={{ letterSpacing: '.16em' }}>POKÉCHECK COLLECTOR CLUB — สัมผัสความแรร์ระดับตำนาน</span>
              <h1>ส่องประกายการ์ดแรร์ในมือคุณ<br /><em>เช็คชื่อ ซีรีส์ ปี พร้อมราคาอ้างอิง</em></h1>
              <p>แค่แชะเดียว AI อ่านลึกถึงโค้ดเซ็ตและชื่อการ์ด เทียบข้อมูลชุด ซีรีส์ ปีที่ออก และดึงตัวอย่างราคาจากเว็บที่เชื่อถือได้ — ไม่ต้องเดาอีกต่อไป</p>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                <Link to="/camera" className="btn btn-onink" data-od-id="home-cta-primary">เช็คการ์ดเลย <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h13M13 6l6 6-6 6" /></svg></Link>
              </div>
            </div>
            <Orbit listings={listings} />
          </div>
        </section>

        <div className="page">
          <div className="quick">
            <div className="actions-grid" data-od-id="home-quick-actions">
              <Link to="/camera" className="action-card" data-od-id="quick-camera"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M3 8.5A1.5 1.5 0 0 1 4.5 7h2.2l1.2-2h8.2l1.2 2h2.2A1.5 1.5 0 0 1 21 8.5v9A1.5 1.5 0 0 1 19.5 19h-15A1.5 1.5 0 0 1 3 17.5z"/><circle cx="12" cy="13" r="3.6"/></svg><b>เช็คการ์ด</b><span>ถ่ายหน้า-หลัง อ่านผลทันที</span></Link>
              <Link to="/market" className="action-card" data-od-id="quick-market"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M4 8h16l-1.3 11.2a1 1 0 0 1-1 .8H6.3a1 1 0 0 1-1-.8z"/><path d="M8.5 8V6.2a3.5 3.5 0 0 1 7 0V8"/></svg><b>ตลาดการ์ด</b><span>ซื้อขาย · เทรด</span></Link>
              <Link to="/feed" className="action-card" data-od-id="quick-feed"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M3 5.5A1.5 1.5 0 0 1 4.5 4h15A1.5 1.5 0 0 1 21 5.5v13a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 18.5z"/><path d="M6 8h12M6 12h12M6 16h8"/></svg><b>คอมมูนิตี้</b><span>โชว์การ์ด · ถามความเห็น</span></Link>
              <Link to="/profile" className="action-card" data-od-id="quick-history"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="8.5"/><path d="M12 7v5.2l3.3 2"/></svg><b>ประวัติการเช็ค</b><span>ย้อนดูผลที่เคยส่ง</span></Link>
            </div>
          </div>

          <section className="sect" style={{ borderTop: 0 }} data-od-id="home-steps">
            <div className="sect-head"><div><span className="kicker">ขั้นตอน</span><h2>ประเมินมูลค่าอย่างไร</h2></div></div>
            <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))' }}>
              <div className="card card-pad" data-od-id="step-capture"><span className="kicker" style={{ marginBottom: 8 }}>๐๑</span><h3 style={{ fontSize: 17, marginBottom: 6 }}>ถ่ายหน้า-หลัง</h3><p className="fine">ในแสงธรรมชาติ ถ่ายให้เห็นขอบ มุม และลวดลายโฮโลแกรมชัดเจน</p></div>
              <div className="card card-pad" data-od-id="step-compare"><span className="kicker" style={{ marginBottom: 8 }}>๐๒</span><h3 style={{ fontSize: 17, marginBottom: 6 }}>ระบุชื่อและชุดการ์ด</h3><p className="fine">ระบบแมตช์การ์ดกับฐานข้อมูลมาตรฐานเพื่อบอกชื่อ ซีรีส์ และปี</p></div>
              <div className="card card-pad" data-od-id="step-report"><span className="kicker" style={{ marginBottom: 8 }}>๐๓</span><h3 style={{ fontSize: 17, marginBottom: 6 }}>ข้อมูลการ์ดและราคาอ้างอิง</h3><p className="fine">แสดงซีรีส์ ปีที่ออก และดึงตัวอย่างราคาจากเว็บที่เชื่อถือได้</p></div>
            </div>
          </section>

          <section className="sect" data-od-id="home-market">
            <div className="sect-head"><div><span className="kicker">ตลาด</span><h2>เพิ่งลงขาย</h2></div><Link to="/market" className="link" data-od-id="home-market-more">ดูทั้งหมด →</Link></div>
            <div className="grid">
              {listings.slice(0, 3).map((l) => (
                <Link key={l.id} className="card-item" to={`/market?item=${encodeURIComponent(l.id)}`} data-od-id={`home-listing-${l.id}`}>
                  <span className="card-thumb" style={{ aspectRatio: '63/88' }}><img src={l.image} alt={l.name} loading="lazy" style={{ objectFit: 'contain' }} /></span>
                  <span className="card-body"><h3>{l.name}</h3><span className="meta"><span>{l.era}</span><span>{l.seller?.name || 'ผู้ขาย'}</span></span><span className="price">฿{baht(l.price)}</span></span>
                </Link>
              ))}
            </div>
          </section>

          <section className="sect" data-od-id="home-community">
            <div className="two-col">
              <div>
                <div className="sect-head"><div><span className="kicker">ฟีด</span><h2>จากเทรนเนอร์</h2></div><Link to="/feed" className="link" data-od-id="home-feed-more">ดูฟีด →</Link></div>
                <div className="rowlist">
                  {posts.slice(0, 3).map((p) => {
                    const full = String(p.text || '');
                    const text = full.length > 64 ? full.slice(0, 64) + '…' : full;
                    return (
                      <Link key={p.id} className="rowitem" to={`/feed#${p.id}`} data-od-id={`home-post-${p.id}`}>
                        <Avatar user={p.author} size="avatar-sm" />
                        <span className="rowmain"><b>{p.author.name}</b><span>{text}</span></span>
                        <span className="rowend">{(p.comments ? p.comments.length : 0)} ตอบ</span>
                      </Link>
                    );
                  })}
                </div>
              </div>
              <div>
                <div className="sect-head"><div><span className="kicker">ของคุณ</span><h2>เช็คล่าสุด</h2></div><Link to="/profile#history" className="link" data-od-id="home-history-more">ดูทั้งหมด →</Link></div>
                <div className="rowlist">
                  {history.length ? history.slice(0, 3).map((r, i) => (
                    <Link key={i} className="rowitem" to="/profile#history" data-od-id={`home-history-row-${i}`}>
                      <span className="avatar avatar-sm avatar-outline">C</span>
                      <span className="rowmain"><b>{r.name}</b><span>{formatDate(r.created_at)}</span></span>
                      <span className={`rowend score-${r.kind}`}>{r.score}</span>
                    </Link>
                  )) : <div className="empty-state"><h3>ยังไม่มีประวัติ</h3><p>เมื่อส่งเช็คครั้งแรก ผลจะมาเก็บไว้ที่นี่</p><Link className="btn btn-sm" to="/camera">เริ่มเช็คการ์ด</Link></div>}
                </div>
              </div>
            </div>
          </section>

          <section className="sect" data-od-id="home-library">
            <div className="sect-head"><div><span className="kicker">ฐานข้อมูลอ้างอิง</span><h2>การ์ดราคาสูงสุด (โปเกมอน)</h2></div><Link to="/datacard" className="link" data-od-id="home-library-more">ดูฐานข้อมูล →</Link></div>
            <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(160px,1fr))' }}>
              {top.map((c) => (
                <Link key={c.code} to={`/datacard?q=${encodeURIComponent(c.code)}`} className="card-item" data-od-id={`home-top-${c.code}`}>
                  <span className="card-thumb" style={{ aspectRatio: '63/88' }}><img src={imgUrl(c.code)} alt={c.name} loading="lazy" style={{ objectFit: 'contain' }} /></span>
                  <span className="card-body"><span className="kicker">{c.code}</span><h3>{c.name}</h3><span className="price">฿{baht(c.price)}</span></span>
                </Link>
              ))}
            </div>
          </section>

          <section className="sect" data-od-id="home-library-ygo">
            <div className="sect-head"><div><h2>การ์ดราคาสูงสุด (ยูกิ)</h2></div><Link to="/datacard?game=yugioh" className="link">ดูฐานข้อมูล →</Link></div>
            <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(160px,1fr))' }}>
              {topYgo.map((c) => (
                <Link key={c.code} to={`/datacard?game=yugioh&q=${encodeURIComponent(c.code)}`} className="card-item">
                  <span className="card-thumb" style={{ aspectRatio: '63/88' }}><img src={imgUrl(c.code)} alt={c.name} loading="lazy" style={{ objectFit: 'contain' }} /></span>
                  <span className="card-body"><span className="kicker">{c.code}</span><h3>{c.name}</h3><span className="price">฿{baht(c.price)}</span></span>
                </Link>
              ))}
            </div>
          </section>

          <section className="sect" data-od-id="home-library-op">
            <div className="sect-head"><div><h2>การ์ดราคาสูงสุด (วันพีซ)</h2></div><Link to="/datacard?game=onepiece" className="link">ดูฐานข้อมูล →</Link></div>
            <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(160px,1fr))' }}>
              {topOp.map((c) => (
                <Link key={c.code} to={`/datacard?game=onepiece&q=${encodeURIComponent(c.code)}`} className="card-item">
                  <span className="card-thumb" style={{ aspectRatio: '63/88' }}><img src={imgUrl(c.code)} alt={c.name} loading="lazy" style={{ objectFit: 'contain' }} /></span>
                  <span className="card-body"><span className="kicker">{c.code}</span><h3>{c.name}</h3><span className="price">฿{baht(c.price)}</span></span>
                </Link>
              ))}
            </div>
          </section>

          <section className="sect" data-od-id="home-library-fb">
            <div className="sect-head"><div><h2>การ์ดราคาสูงสุด (ฟุตบอล)</h2></div><Link to="/datacard?game=football" className="link">ดูฐานข้อมูล →</Link></div>
            <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(160px,1fr))' }}>
              {topFb.map((c) => (
                <Link key={c.code} to={`/datacard?game=football&q=${encodeURIComponent(c.code)}`} className="card-item">
                  <span className="card-thumb" style={{ aspectRatio: '63/88' }}><img src={imgUrl(c.code)} alt={c.name} loading="lazy" style={{ objectFit: 'contain' }} /></span>
                  <span className="card-body"><span className="kicker">{c.code}</span><h3>{c.name}</h3><span className="price">฿{baht(c.price)}</span></span>
                </Link>
              ))}
            </div>
          </section>

          <div className="notice" data-od-id="home-disclaimer"><p><b>ผลเช็คนี้เป็นความเห็นเบื้องต้น</b> ใช้ประกอบการตัดสินใจ ไม่ใช่ใบรับรองการันตี การ์ดที่มีมูลค่าสูงควรส่งเกรดกับ PSA/CGC/BGS ก่อนซื้อขายเสมอ</p></div>
        </div>
      </main>
    </>
  );
}
