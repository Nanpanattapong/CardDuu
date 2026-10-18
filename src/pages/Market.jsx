import { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import Nav from '../components/Nav.jsx';
import Avatar from '../components/Avatar.jsx';
import PriceChart from '../components/PriceChart.jsx';
import { Auth, api, baht, readImage } from '../lib.js';

export default function Market() {
  const [params] = useSearchParams();
  const [listings, setListings] = useState(null);
  const [game, setGame] = useState('all'); // all, pokemon, yugioh, onepiece
  const [savedIds, setSavedIds] = useState(null); // Set ids
  const [filter, setFilter] = useState('all');
  const [setSel, setSetSel] = useState('all');
  const [condFilter, setCondFilter] = useState('all');
  const [sort, setSort] = useState('new');
  const [query, setQuery] = useState('');
  const [detailId, setDetailId] = useState(params.get('item') || null);
  const [showSell, setShowSell] = useState(false);
  const [showContact, setShowContact] = useState(false);
  const [sellImage, setSellImage] = useState('');
  const [sellPreview, setSellPreview] = useState('');
  const [sellPriceHint, setSellPriceHint] = useState(null);
  const [contactInfo, setContactInfo] = useState(null);
  const [toast, setToast] = useState('');
  const [err, setErr] = useState('');
  const showToast = useCallback((m) => { setToast(m); setTimeout(() => setToast(''), 3000); }, []);

  const refreshListings = useCallback(async () => {
    const data = await api('/api/listings', { auth: false });
    setListings(data);
  }, []);
  const refreshSaved = useCallback(async () => {
    if (!Auth.session()) { setSavedIds(new Set()); return; }
    try {
      const data = await api('/api/saved');
      setSavedIds(new Set(data.map((r) => r.id)));
    } catch { setSavedIds(new Set()); }
  }, []);
  const [prices, setPrices] = useState(null); // { history: [], live: {} }
  const [addedId, setAddedId] = useState('');

  useEffect(() => {
    refreshListings().catch((e) => setErr(e.message));
    refreshSaved();
  }, [refreshListings, refreshSaved]);

  useEffect(() => {
    const id = params.get('item');
    if (id) setDetailId(id);
    const q = params.get('q');
    if (q) setQuery(q);
  }, [params]);

  const items = listings || [];
  const condOf = (l) => {
    const s = String(l.era || '').toUpperCase();
    if (s.includes('PSA 10') || s.includes('PSA10')) return 'psa10';
    if (s.includes('PSA 9') || s.includes('PSA9')) return 'psa9';
    if (s.includes('PSA') || s.includes('BGS') || s.includes('CGC')) return 'graded';
    if (s.includes('NM')) return 'nm';
    if (s.includes('EX')) return 'ex';
    if (s.includes('PL')) return 'pl';
    return 'other';
  };
  const setsFromEra = [...new Set(items.map((l) => String(l.era || '').split('·')[0].trim()).filter(Boolean))].sort();
  const gameOfListing = (l) => {
    const text = `${l.name} ${l.era} ${l.desc || ''}`.toLowerCase();
    if (/yugioh|ยูกิ|yu-gi|blue-eyes|dark magician|แบล็คเมจิค/.test(text)) return 'yugioh';
    if (/one piece|วันพีซ|onepiece|op-\d/.test(text)) return 'onepiece';
    return 'pokemon';
  };
  const filtered = items.filter((l) => {
    if (game !== 'all' && gameOfListing(l) !== game) return false;
    if (filter === 'under-5000' && l.price >= 5000) return false;
    if (filter === '5000-15000' && (l.price < 5000 || l.price > 15000)) return false;
    if (filter === 'over-15000' && l.price <= 15000) return false;
    if (setSel !== 'all' && !String(l.era || '').includes(setSel)) return false;
    if (condFilter !== 'all' && condOf(l) !== condFilter) return false;
    if (query) {
      const q = query.toLowerCase();
      if (!l.name.toLowerCase().includes(q) && !l.era.toLowerCase().includes(q) && !(l.desc || '').toLowerCase().includes(q)) return false;
    }
    return true;
  }).sort((a, b) => {
    if (sort === 'low') return a.price - b.price;
    if (sort === 'high') return b.price - a.price;
    return b.created_at - a.created_at;
  });

  const detail = detailId ? items.find((l) => l.id === detailId) : null;
  const listingCode = (l) => {
    const text = `${l?.image || ''} ${l?.name || ''} ${l?.era || ''}`;
    return text.match(/\b([a-z]{2,}\d*(?:pt\d+)?-\d{1,3})\b/i)?.[1]?.toLowerCase() || '';
  };
  useEffect(() => {
    if (!detail) { setPrices(null); return; }
    const code = listingCode(detail);
    const qs = `name=${encodeURIComponent(detail.name)}${code ? `&code=${encodeURIComponent(code)}` : ''}`;
    api(`/api/prices?${qs}`, { auth: false }).then(setPrices).catch(() => setPrices([]));
  }, [detailId, detail?.name, detail?.image]);

  const isSaved = !!(detailId && savedIds?.has(detailId));

  const toggleSave = async () => {
    if (!Auth.session()) return showToast('ต้องเข้าสู่ระบบก่อน');
    try {
      const { saved } = await api(`/api/saved/${detailId}`, { method: 'POST' });
      setSavedIds((prev) => {
        const next = new Set(prev || []);
        if (saved) next.add(detailId); else next.delete(detailId);
        return next;
      });
      showToast(saved ? 'บันทึกไว้ในโปรไฟล์แล้ว' : 'นำออกจากรายการบันทึกแล้ว');
    } catch (e) { setErr(e.message); }
  };

  const isMine = !!(detail && Auth.session()?.id === detail.seller?.id);
  const removeListing = async () => {
    if (!confirm('ลบรายการขายนี้?')) return;
    try {
      await api(`/api/listings/${encodeURIComponent(detailId)}`, { method: 'DELETE' });
      setDetailId(null);
      await refreshListings();
      showToast('ลบรายการแล้ว');
    } catch (e) { showToast(e.message); }
  };

  const onSell = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const name = String(fd.get('name') || '').trim();
    const price = parseInt(String(fd.get('price') || '0'), 10) || 0;
    const series = String(fd.get('series') || '').trim() || 'ไม่ระบุ';
    const condition = String(fd.get('condition') || '').trim() || 'ไม่ระบุ';
    const desc = String(fd.get('desc') || '').trim();
    if (!name || price <= 0 || !desc) return showToast('กรุณากรอกข้อมูลให้ครบถ้วน');
    if (!Auth.session()) return showToast('ต้องเข้าสู่ระบบก่อน');
    try {
      await api('/api/listings', { method: 'POST', body: { name, price, era: `${fd.get('game')} · ${series} · ${condition}`, desc, image: sellImage || undefined } });
      await refreshListings();
      await refreshSaved();
      setShowSell(false); setSellImage(''); setSellPreview(''); e.target.reset();
      showToast('ลงขายสำเร็จ');
    } catch (e2) { setErr(e2.message); }
  };

  return (
    <>
      <Nav active="market" />
      <main className="appmain">
        <style>{`
          .market-bar{display:flex;gap:12px;align-items:center;margin-bottom:24px}
          .market-search{flex:1;min-width:200px;position:relative}
          .market-search input{width:100%;min-height:44px;padding:8px 12px 8px 36px;border:1px solid var(--border);border-radius:6px;background:var(--surface);font:14px var(--body);color:var(--fg)}
          .market-search input:focus{outline:none;border-color:var(--accent)}
          .market-search svg{position:absolute;left:10px;top:50%;transform:translateY(-50%);width:18px;height:18px;color:var(--muted);stroke-width:2;pointer-events:none}
          .listing-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:16px;margin-bottom:40px}
          .listing-card{display:flex;flex-direction:column;background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);overflow:hidden;cursor:pointer;text-decoration:none;color:var(--fg);transition:all .2s}
          .listing-card:hover{border-color:var(--accent);box-shadow:0 8px 24px oklch(18% 0.02 250 / .08)}
          .listing-thumb{display:block;width:100%;aspect-ratio:63/88;background:var(--plate);overflow:hidden;position:relative}
          .listing-thumb img{width:100%;height:100%;object-fit:contain}
          .listing-badge{position:absolute;top:6px;left:6px;background:oklch(18% 0.012 250 / 0.9);color:var(--on-ink);padding:3px 6px;border-radius:4px;font:500 9px var(--mono)}
          .listing-info{padding:10px;display:flex;flex-direction:column;gap:4px;flex:1}
          .listing-name{font:600 13px var(--body);color:var(--fg);line-height:1.3}
          .listing-seller{font:11px var(--body);color:var(--muted)}
          .listing-price{margin-top:auto;font:600 14px var(--mono);color:var(--accent-deep)}
          .modal-image{width:100%;aspect-ratio:63/88;overflow:hidden;background:var(--plate);border-radius:14px 14px 0 0}
          .modal-image img{width:100%;height:100%;object-fit:contain}
          .detail-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin:20px 0;padding:16px 0;border-top:1px solid var(--border);border-bottom:1px solid var(--border)}
          .detail-cell{display:flex;flex-direction:column;gap:4px}
          .detail-cell-label{font:11px var(--mono);text-transform:uppercase;color:var(--muted)}
          .detail-cell-value{font:600 14px var(--body);color:var(--fg)}
          .detail-desc{margin:16px 0;padding:13px 15px;background:var(--surface-2);border:1px solid var(--border);border-radius:var(--radius);font:14px var(--body);line-height:1.6;color:var(--fg)}
          .modal-foot{display:flex;gap:10px;padding:16px var(--gut) 18px;border-top:1px solid var(--border)}
          .modal-foot .btn{flex:1}
          .contact-person{display:flex;align-items:center;gap:12px;padding:13px 15px;border:1px solid var(--border);border-radius:var(--radius);background:var(--surface-2);margin-bottom:16px}
          @media(min-width:768px){.listing-grid{grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:20px}}
          .detail-modal{max-width:1180px;width:min(1180px,96vw);border-radius:16px;max-height:88vh;overflow:hidden;display:flex;flex-direction:column}
          .detail-layout{display:flex;flex-direction:column;flex:1;min-height:0;min-width:0}
          .detail-image-wrap{background:var(--plate);display:grid;place-items:center;padding:16px;min-width:0}
          .detail-image-wrap img{width:100%;height:auto;object-fit:contain;border-radius:12px;box-shadow:var(--shadow-lg);max-height:62vh}
          .detail-content{display:flex;flex-direction:column;overflow-y:auto;overflow-x:hidden;min-width:0;min-height:0}
          .detail-content .modal-head{position:sticky;top:0;flex-shrink:0}
          .detail-content .modal-body{overflow-x:hidden;min-width:0}
          .detail-content .detail-desc{word-break:normal;overflow-wrap:break-word;white-space:normal}
          .detail-modal .modal-head h3{font-size:19px;line-height:1.2;min-width:0}
          @media(min-width:900px){
            [role="dialog"]:has(.detail-modal){align-items:center;justify-content:center;padding:20px 16px}
            .detail-layout{display:grid;grid-template-columns:minmax(0,1.05fr) minmax(360px,0.95fr);flex:1;min-height:0;max-height:88vh}
            .detail-image-wrap{padding:20px;align-content:center;max-height:88vh;overflow:hidden}
            .detail-image-wrap img{max-height:78vh;width:100%}
            .detail-content{max-height:88vh}
            .detail-content .modal-body{padding:18px 22px 20px}
            .detail-content .detail-desc{font-size:14.5px}
          }
          @media(max-width:899px){
            .detail-modal{overflow-y:auto;max-height:92vh}
            .detail-image-wrap{padding:12px 14px}
            .detail-image-wrap img{max-height:58vh}
          }
        `}</style>
        <div className="page">
          <section data-od-id="market-header">
            <h1 style={{ font: '700 28px/1.2 var(--display)', marginBottom: 8 }}>ตลาดการ์ดสะสม</h1>
            <p style={{ font: '14px var(--body)', color: 'var(--muted)', margin: '0 0 16px' }}>ค้นหาและซื้อขายการ์ดสะสมทุกเกม ทุกชุด ทุกสภาพ พร้อมเช็คราคากลางอ้างอิง</p>
            <div className="chip-row" style={{ padding: 0, marginBottom: 14 }}>
              {[['all', 'ทุกเกม'], ['pokemon', 'โปเกมอน'], ['yugioh', 'ยูกิ'], ['onepiece', 'วันพีซ']].map(([k, label]) => (
                <button key={k} className={`chip ${game === k ? 'on' : ''}`} onClick={() => { setGame(k); setSetSel('all'); }}>{label}</button>
              ))}
            </div>
            <div className="market-bar">
              <div className="market-search">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16z"/><path d="M21 21l-4.35-4.35"/></svg>
                <input type="text" placeholder="ค้นหา ชื่อการ์ด, ซีรีส์, ราคา..." value={query} onChange={(e) => setQuery(e.target.value)} />
              </div>
              <button className="btn btn-primary" data-od-id="sell-button" onClick={() => {
                if (!Auth.session()) { showToast('ต้องเข้าสู่ระบบก่อน'); return; }
                setShowSell(true);
              }}>ลงขายการ์ด</button>
            </div>
            <div>
              <div className="field-group" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
                <div className="sel-wrap" style={{ flex: 1, minWidth: 120 }}><select value={setSel} onChange={(e) => setSetSel(e.target.value)}><option value="all">ทุกชุดการ์ด</option>{setsFromEra.map((s) => <option key={s} value={s}>{s}</option>)}</select></div>
                <div className="sel-wrap" style={{ flex: 1, minWidth: 120 }}><select value={condFilter} onChange={(e) => setCondFilter(e.target.value)}><option value="all">ทุกสภาพ</option><option value="psa10">PSA 10</option><option value="psa9">PSA 9</option><option value="graded">Graded (PSA/BGS/CGC)</option><option value="nm">Near Mint (NM)</option><option value="ex">Excellent (EX)</option><option value="pl">Played (PL)</option></select></div>
                <div className="sel-wrap" style={{ flex: 1, minWidth: 120 }}><select value={sort} onChange={(e) => setSort(e.target.value)}><option value="new">ใหม่ล่าสุด</option><option value="low">ราคา: ต่ำ-สูง</option><option value="high">ราคา: สูง-ต่ำ</option></select></div>
              </div>
              <div className="chip-row" style={{ padding: 0 }}>
                {[
                  ['all', 'ทุกราคา'],
                  ['under-5000', '< 5,000'],
                  ['5000-15000', '5,000–15,000'],
                  ['over-15000', '> 15,000'],
                ].map(([k, label]) => (
                  <button key={k} className={`chip ${filter === k ? 'on' : ''}`} data-filter={k} onClick={() => setFilter(k)}>{label}</button>
                ))}
              </div>
            </div>
          </section>

          <section data-od-id="listing-section">
            {listings === null && <p style={{ color: 'var(--muted)', fontSize: 13 }}>กำลังโหลด…</p>}
            {err && <p style={{ color: 'var(--bad)', fontSize: 13 }}>{err}</p>}
            <div className="listing-grid">
              {filtered.map((item) => (
                <a key={item.id} className="listing-card" data-od-id={`listing-${item.id}`} onClick={(e) => { e.preventDefault(); setDetailId(item.id); }} href={`?item=${encodeURIComponent(item.id)}`}>
                  <span className="listing-thumb">
                    <img src={item.image} alt={item.name} loading="lazy" />
                    <span className="listing-badge">{(item.era.split('·')[1] || item.era).trim()}</span>
                  </span>
                  <span className="listing-info">
                    <span className="listing-name">{item.name}</span>
                    <span className="listing-seller">{item.seller?.name || 'เทรนเนอร์'}</span>
                    <span className="listing-price">฿{baht(item.price)}</span>
                  </span>
                </a>
              ))}
            </div>
            {listings !== null && filtered.length === 0 && <div className="empty-state"><p>ไม่พบรายการสินค้า ลองเปลี่ยนการค้นหาหรือตัวกรอง</p></div>}
          </section>
        </div>
      </main>

      {detail && (
        <div role="dialog" onClick={(e) => { if (e.target === e.currentTarget) setDetailId(null); }}>
          <div className="modal-panel detail-modal">
            <div className="detail-layout">
              <div className="detail-image-wrap"><img src={detail.image} alt={detail.name} /></div>
              <div className="detail-content">
                <div className="modal-head">
                  <h3>{detail.name}</h3>
                  <button className="modal-close" data-od-id="detail-close" aria-label="ปิด" onClick={() => setDetailId(null)}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M18 6L6 18M6 6l12 12"/></svg></button>
                </div>
                <div className="modal-body">
                  <span className="kicker">{detail.era}</span>
                  <div className="detail-grid">
                    <div className="detail-cell"><span className="detail-cell-label">ราคา</span><span className="detail-cell-value">{baht(detail.price)} บาท</span></div>
                    <div className="detail-cell"><span className="detail-cell-label">ผู้ขาย</span><span className="detail-cell-value">{detail.seller?.name || '—'}</span></div>
                  </div>
                  <div className="detail-desc">{detail.desc}</div>
                </div>
                <div className="modal-foot">
                  <button className="btn btn-ghost" data-od-id="detail-save" onClick={toggleSave}>{isSaved ? 'นำออก' : 'บันทึก'}</button>
                  <button className="btn btn-ghost" data-od-id="detail-add-collection" onClick={async () => {
                    if (!Auth.session()) return showToast('ต้องเข้าสู่ระบบก่อน');
                    try {
                      await api('/api/collection', { method: 'POST', body: { name: detail.name, image: detail.image, value: detail.price, note: detail.era } });
                      setAddedId(detail.id);
                      showToast('เพิ่มเข้าคอลเลกชันแล้ว');
                    } catch (e) { showToast(e.message); }
                  }}>{addedId === detail.id ? '✓ อยู่ในคอลเลกชัน' : '+ คอลเลกชัน'}</button>
                  <button className="btn btn-ghost" data-od-id="detail-share" onClick={async () => {
                    const url = `${location.origin}/market?item=${encodeURIComponent(detail.id)}`;
                    try { await navigator.clipboard.writeText(url); showToast('คัดลอกลิงก์แล้ว'); }
                    catch { window.prompt('คัดลอกลิงก์:', url); }
                  }}>แชร์</button>
                  {isMine ? <button className="btn btn-danger" data-od-id="detail-delete" onClick={removeListing}>ลบรายการ</button> : <button className="btn btn-primary" data-od-id="detail-contact" onClick={() => {
                    setContactInfo({
                      avatar: detail.seller?.avatar,
                      name: detail.seller?.name || 'เทรนเนอร์',
                      contact: detail.seller?.contact || '',
                      item: detail.name,
                    });
                    setShowContact(true);
                  }}>ติดต่อ</button>}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {showSell && (
        <div role="dialog" onClick={(e) => { if (e.target === e.currentTarget) setShowSell(false); }}>
          <div className="modal-panel">
            <div className="modal-head"><h3>ลงขายการ์ดสะสม</h3><button className="modal-close" data-od-id="sell-close" aria-label="ปิด" onClick={() => setShowSell(false)}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M18 6L6 18M6 6l12 12"/></svg></button></div>
            <form id="sell-form" className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }} onSubmit={onSell}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}><label style={{ font: '600 13px var(--body)' }}>เกมการ์ด *</label>
                <select name="game" defaultValue="pokemon" style={{ padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--surface)', color: 'var(--fg)' }}>
                  <option value="pokemon">โปเกมอน (Pokémon TCG)</option><option value="yugioh">ยูกิ (Yu-Gi-Oh!)</option><option value="onepiece">วันพีซ (One Piece Card Game)</option>
                </select>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}><label style={{ font: '600 13px var(--body)' }}>ชื่อการ์ด *</label>
                <input name="name" required placeholder="เช่น Charizard ex SAR" list="sell-names" style={{ padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 6 }}
                  onChange={async (e) => {
                    const v = e.target.value;
                    if (!v || v.length < 2) return;
                    setSellPriceHint(null);
                    try { api(`/api/prices?name=${encodeURIComponent(v)}`, { auth: false }).then(d => setSellPriceHint(d?.live?.marketThb || null)).catch(()=>{}); } catch {}
                  }} />
                {sellPriceHint && <div style={{ fontSize: 12, color: 'var(--accent)', marginTop: 4 }}>ราคากลางตลาดประมาณ: ฿{baht(sellPriceHint)}</div>}
                <datalist id="sell-names" />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}><label style={{ font: '600 13px var(--body)' }}>ราคา (บาท) *</label><input name="price" type="number" required min="0" placeholder="1500" style={{ padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 6 }} /></div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}><label style={{ font: '600 13px var(--body)' }}>ชุด / ซีรีส์</label><input name="series" placeholder="เช่น SV3, LOB, Romance Dawn" style={{ padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 6 }} /></div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}><label style={{ font: '600 13px var(--body)' }}>สภาพการ์ด</label><select name="condition" defaultValue="NM" style={{ padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--surface)', color: 'var(--fg)' }}><option>NM — Near Mint</option><option>EX — Excellent</option><option>GD — Good</option><option>PL — Played</option><option>PSA 10</option><option>PSA 9</option><option>Graded (BGS/CGC)</option></select></div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}><label style={{ font: '600 13px var(--body)' }}>รายละเอียด *</label><textarea name="desc" required placeholder="สภาพการ์ด ตำหนิ ฯลฯ" style={{ padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 6 }} /></div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ font: '600 13px var(--body)' }}>ภาพการ์ด (ไม่บังคับ)</label>
                <input type="file" accept="image/*" data-od-id="sell-image-input" onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (!f) { setSellImage(''); setSellPreview(''); return; }
                  readImage(f, (data) => {
                    if (!data) { showToast('อ่านภาพไม่สำเร็จ'); return; }
                    setSellImage(data); setSellPreview(data);
                  });
                }} />
                {sellPreview && <div style={{ maxWidth: 140, border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden' }}><img src={sellPreview} alt="preview" style={{ width: '100%', aspectRatio: '63/88', objectFit: 'contain', display: 'block' }} /></div>}
              </div>
              {err && <p style={{ color: 'var(--bad)', fontSize: 13 }}>{err}</p>}
              <div className="modal-foot" style={{ padding: 0, border: 0 }}>
                <button type="button" className="btn btn-ghost" data-od-id="sell-cancel" onClick={() => setShowSell(false)}>ยกเลิก</button>
                <button type="submit" className="btn btn-primary" data-od-id="sell-submit">ลงขาย</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showContact && contactInfo && (
        <div role="dialog" onClick={(e) => { if (e.target === e.currentTarget) setShowContact(false); }}>
          <div className="modal-panel">
            <div className="modal-head"><h3>ติดต่อเทรนเนอร์</h3><button className="modal-close" data-od-id="contact-close" aria-label="ปิด" onClick={() => setShowContact(false)}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M18 6L6 18M6 6l12 12"/></svg></button></div>
            <div className="modal-body">
              <div className="contact-person">
                <Avatar user={contactInfo} />
                <span><b style={{ display: 'block', font: '600 14px var(--body)' }}>{contactInfo.name}</b><span style={{ font: '400 12px var(--mono)', color: 'var(--muted)' }}>{contactInfo.item}</span></span>
                {/* ponytail: ไม่มี field contact บน users/listings — แสดงเมื่อมีคนกรอกไว้ใน Settings */}
                {contactInfo.contact && <span style={{ display: 'block', font: '500 12.5px var(--body)', color: 'var(--accent-deep)', marginTop: 2 }}>{contactInfo.contact}</span>}
              </div>
              {/* ponytail: ยังไม่มีระบบแชทในแอป — โชว์ช่องทางติดต่อที่ผู้ขายกรอกไว้ใน Settings แทน */}
              {contactInfo.contact
                ? <button className="btn btn-primary btn-block" data-od-id="contact-copy" onClick={async () => {
                    try { await navigator.clipboard.writeText(contactInfo.contact); showToast('คัดลอกช่องทางติดต่อแล้ว'); }
                    catch { window.prompt('คัดลอก:', contactInfo.contact); }
                  }}>คัดลอกช่องทางติดต่อ</button>
                : <p style={{ fontSize: 13, color: 'var(--muted)', margin: 0 }}>ผู้ขายยังไม่ได้ใส่ช่องทางติดต่อ ลองทักผ่านโพสต์ในคอมมูนิตี้</p>}
            </div>
          </div>
        </div>
      )}

      {toast && <div className="toast on">{toast}</div>}
    </>
  );
}
