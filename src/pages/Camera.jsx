import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Nav from '../components/Nav.jsx';
import PriceChart from '../components/PriceChart.jsx';
import CardOverlay from '../components/CardOverlay.jsx';
import { Auth, api, baht, readImage } from '../lib.js';
import { imgUrl, identifyCard, loadIndex, loadSets, metaCardInfo, gameOf } from '../lib/cards.js';
import { detectAndIdentify } from '../lib/scan.js';

const SAMPLE = '/assets/charizard-ex-sir-sv3-223.png';

// ผลของการ์ด 1 ใบในรายการ — แต่ละใบเลือก/ดึงราคาของตัวเอง
// det = {code, name, score, known, crop?, candidates:[{code,name,score|dist}]}
function CardResult({ n, det, front, onPrice, showToast }) {
  // ≥0.70 ล็อกเลย, ต่ำกว่านั้น/ไม่รู้จัก → ให้ผู้ใช้กดเลือกจากตัวเลือกก่อน
  const sure = det.known !== false && (det.dist !== undefined ? det.dist <= 10 : det.score >= 0.70);
  const [code, setCode] = useState(sure ? det.code : '');
  const [name, setName] = useState(sure ? det.name : '');
  const [showAlt, setShowAlt] = useState(!sure || (det.score !== undefined && det.score < 0.82));
  const [prices, setPrices] = useState(null);
  const [sets, setSets] = useState([]);
  const cands = det.candidates || [];
  const ygo = code.startsWith('ygo-'), op = code.startsWith('op-');

  useEffect(() => {
    setPrices(null); onPrice(n, 0);
    if (!name) return;
    const got = (p) => { setPrices(p); onPrice(n, p?.live?.marketThb || 0); };
    if (ygo || op) {
      metaCardInfo(code).then(got);
    } else {
      loadSets().then(setSets);
      api(`/api/prices?name=${encodeURIComponent(name)}&code=${encodeURIComponent(code)}`, { auth: false })
        .then(got).catch(() => setPrices([]));
    }
    if (Auth.session()) api('/api/checks', { method: 'POST', body: { name: code ? `${name} [${code}]` : name, kind: 'ok', score: 95 } }).catch(() => {});
  }, [name, code]); // eslint-disable-line -- onPrice ไม่ memo แต่ identity เปลี่ยนทุก render ของ Camera; ใส่ใน deps จะวนลูป fetch ไม่จบ

  // API ไม่มีข้อมูลการ์ด (เซ็ตใหม่ๆ) → ใช้ชื่อชุดจาก sets.json + เลขจาก code แทน
  const setId = code.split('-')[0];
  const cardInfo = prices?.card || (code && prices ? {
    number: code.split('-').slice(1).join('-'),
    set: { name: sets.find((s) => s.id === setId)?.name || setId },
  } : null);

  const pick = (m) => { setName(m.name); setCode(m.code); setShowAlt(false); showToast(`ใบที่ ${n}: เลือก "${m.name} [${m.code}]"`); };

  const share = async () => {
    if (!Auth.session()) { location.href = '/login?redirect=camera'; return; }
    const label = code ? `${name} [${code}]` : name || 'การ์ดนี้';
    try {
      await api('/api/posts', { method: 'POST', body: { text: `ระบุการ์ด "${label}" จากรูป — ดูราคาตลาดใน CardDuu`, image: front || SAMPLE } });
      showToast('แชร์ไปที่ฟีดแล้ว');
    } catch (e) { showToast(e.message); }
  };

  return (
    <div className="card" style={{ padding: '16px 14px', marginTop: 12 }} data-od-id={`card-result-${n}`}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        {det.crop && <img src={det.crop} alt={`ใบที่ ${n} จากรูป`} style={{ width: 72, aspectRatio: '63/88', objectFit: 'cover', borderRadius: 6, border: '1px solid var(--border)' }} />}
        {code && <img src={imgUrl(code)} alt={`${name} ${code}`} loading="lazy" style={{ width: 72, aspectRatio: '63/88', objectFit: 'contain', borderRadius: 6, background: 'var(--plate)' }} />}
        {det.ocrCropUrl && <div style={{ textAlign: 'center' }}><img src={det.ocrCropUrl} alt="OCR Zone" style={{ width: 72, height: 36, objectFit: 'contain', background: '#000', borderRadius: 4, border: '1px solid var(--border)' }} /><span style={{ font: '10px var(--mono)', color: 'var(--muted)', display: 'block' }}>โซนเลข OCR</span></div>}
        <div style={{ flex: 1, minWidth: 0 }}>
          <span className="kicker" style={{ marginBottom: 4 }}>ใบที่ {n}</span>
          {name ? (
            <h3 style={{ font: '600 16px var(--body)', margin: '2px 0 4px' }}>{name}{code && <span style={{ font: '500 11px var(--mono)', color: 'var(--muted)', marginLeft: 6 }}>{code}</span>}</h3>
          ) : (
            <h3 style={{ font: '600 15px var(--body)', margin: '2px 0 4px', color: 'var(--hold)' }}>{det.known === false ? 'ไม่ตรงกับการ์ดในฐานข้อมูล' : 'ไม่ค่อยมั่นใจ'} — เลือกใบที่ตรงด้านล่าง</h3>
          )}
          {prices?.live?.marketThb > 0 && <div style={{ font: '600 15px var(--mono)', color: 'var(--accent-deep)' }}>≈ ฿{baht(prices.live.marketThb)}</div>}
          {name && !prices && <div className="fine">กำลังดึงข้อมูล…</div>}
        </div>
      </div>

      {cands.length > 0 && (showAlt ? (
        <div className="match-grid" style={{ marginTop: 12 }}>
          {cands.map((m) => (
            <button key={m.code} className={`match-card ${code === m.code ? 'sel' : ''}`} onClick={() => pick(m)}>
              <span className="match-thumb"><img src={imgUrl(m.code)} alt={`${m.name} ${m.code}`} loading="lazy" /></span>
              <span style={{ display: 'block', padding: '8px 8px 6px' }}>
                <b style={{ display: 'block', fontSize: 12, lineHeight: 1.25 }}>{m.name}</b>
                <span style={{ font: '500 10px var(--mono)', color: 'var(--muted)' }}>{m.code}</span>
              </span>
            </button>
          ))}
        </div>
      ) : (
        <button className="btn btn-ghost btn-sm" style={{ marginTop: 8 }} onClick={() => setShowAlt(true)}>ไม่ใช่ใบนี้? ดูตัวเลือกที่ใกล้เคียง</button>
      ))}

      {name && (
        <>
          {cardInfo && (
            <div style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 8, padding: '12px 14px', margin: '12px 0' }}>
              <div style={{ font: '600 13px var(--body)', marginBottom: 8, color: 'var(--accent)' }}>📋 ข้อมูลการ์ด</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, font: '12px var(--body)' }}>
                <div><b>{ygo || op ? 'ประเภท' : 'ซีรีส์'}:</b> {cardInfo.set?.series || '—'}</div>
                <div><b>ชุด:</b> {cardInfo.set?.name || '—'}</div>
                <div><b>ปีที่ออก:</b> {cardInfo.set?.releaseDate ? cardInfo.set.releaseDate.slice(0, 4) : '—'}</div>
                <div><b>เลขการ์ด:</b> {cardInfo.number ? `${cardInfo.number}${cardInfo.set?.total ? ' / ' + cardInfo.set.total : ''}` : '—'}</div>
                <div><b>ความหายาก:</b> {cardInfo.rarity || '—'}</div>
                <div><b>นักวาด:</b> {cardInfo.artist || '—'}</div>
              </div>
            </div>
          )}
          <PriceChart data={prices} />
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <a className="btn btn-sm" href={`https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(name + (ygo ? ' yugioh ' + (cardInfo?.number || '') : op ? ' one piece ' + (cardInfo?.number || '') : code ? ' ' + code : ''))}&LH_Sold=1&LH_Complete=1`} target="_blank" rel="noreferrer">eBay ↗</a>
            <a className="btn btn-sm" href={`https://www.pricecharting.com/search-products?q=${encodeURIComponent(name)}&type=prices`} target="_blank" rel="noreferrer">PriceCharting ↗</a>
            <Link className="btn btn-sm" to={`/datacard?game=${gameOf(code)}&q=${encodeURIComponent(name)}`}>ดูในฐานข้อมูล</Link>
            <Link className="btn btn-sm" to={`/market?tab=listings&q=${encodeURIComponent(name)}`}>ดูตลาด</Link>
            <button className="btn btn-sm" onClick={share}>แชร์ไปฟีด</button>
          </div>
        </>
      )}
    </div>
  );
}

export default function Camera() {
  const [front, setFront] = useState(null);
  const [game, setGame] = useState('pokemon');
  const [detectedCards, setDetectedCards] = useState([]); // กรอบที่ YOLO เจอ (วาดบนรูป)
  const [results, setResults] = useState([]); // รายการผลทีละใบ (เรียงซ้ายบน→ขวาล่าง)
  const [totals, setTotals] = useState({}); // ใบที่ n → ราคาตลาด ฿
  const [cardQ, setCardQ] = useState('');
  const [cardNames, setCardNames] = useState([]);
  const [step, setStep] = useState('capture');
  const [checkOn, setCheckOn] = useState(0);
  const [toast, setToast] = useState('');
  const showToast = (m) => { setToast(m); setTimeout(() => setToast(''), 3000); };

  const ready = !!front;
  const nCards = { yugioh: '14,771', onepiece: '4,212' }[game] || '20,670';

  const onPick = (side, file) => {
    if (!file) return;
    readImage(file, (data) => {
      if (!data) return showToast('อ่านภาพไม่สำเร็จ ลองใช้ภาพอื่น');
      if (side === 'front') setFront(data);
    }, 720);
  };

  const startScan = async () => {
    setStep('scanning'); setCheckOn(0); setTotals({});
    for (let i = 0; i < 4; i++) setTimeout(() => setCheckOn(i + 1), 380 + i * 420);
    const t0 = Date.now();
    try {
      let detected = [];
      try {
        detected = await detectAndIdentify(front, game);
      } catch (err) {
        console.warn('scan error:', err);
      }
      setDetectedCards(detected);
      // pHash fallback มีแต่การ์ดโปเกมอน → ยูกิไม่เจอก็คือไม่เจอ
      if (detected.length > 0 || game !== 'pokemon') {
        setResults(detected);
      } else {
        // ไม่มีกรอบเลย → pHash ทั้งรูปเป็น 1 ใบ
        const top = await identifyCard(front, 5);
        setResults(top.length ? [{ ...top[0], candidates: top }] : []);
      }
      const elapsed = Date.now() - t0;
      setTimeout(() => { setStep('result'); }, Math.max(0, 900 - elapsed));
    } catch {
      setResults([]);
      setStep('result');
      showToast('เทียบรูปไม่สำเร็จ ลองพิมพ์ชื่อด้านล่าง');
    }
  };

  const reset = () => {
    setFront(null); setStep('capture'); setCheckOn(0);
    setDetectedCards([]); setResults([]); setTotals({}); setCardQ('');
  };

  const loadCardNames = async () => {
    if (cardNames.length) return;
    try { const idx = await loadIndex(); setCardNames(Object.keys(idx).sort()); } catch {}
  };

  // พิมพ์ชื่อเอง → เพิ่มเป็นรายการใหม่ต่อท้าย
  const addTyped = () => {
    const name = cardQ.trim();
    setResults((r) => [...r, { code: '', name, score: 1, typed: true }]);
    setCardQ(''); showToast(`เพิ่ม "${name}"`);
  };

  const onPrice = (n, thb) => setTotals((t) => (t[n] === thb ? t : { ...t, [n]: thb }));
  const total = Object.values(totals).reduce((a, b) => a + b, 0);

  const Rail = ({ n }) => (
    <div className="rail-steps" style={{ padding: 0, marginBottom: 0 }} data-od-id="camera-progress">
      {['1. ถ่ายภาพ', '2. วิเคราะห์', '3. ผลลัพธ์'].map((label, i) => (
        <div key={i} className={i + 1 === n ? 'on' : i + 1 < n ? 'done' : ''}>{label}</div>
      ))}
    </div>
  );

  const Slot = ({ side, src }) => (
    <label className={`slot ${src ? 'filled' : ''}`} data-od-id={side === 'front' ? 'slot-front' : 'slot-back'}>
      {!src && (
        <>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 8.5A1.5 1.5 0 0 1 4.5 7h2.2l1.2-2h8.2l1.2 2h2.2A1.5 1.5 0 0 1 21 8.5v9A1.5 1.5 0 0 1 19.5 19h-15A1.5 1.5 0 0 1 3 17.5z" /><circle cx="12" cy="13" r="3.6" /></svg>
          <span className="slot-label">{side === 'front' ? 'ด้านหน้า*' : 'ด้านหลัง (ถ้ามี)'}</span>
          <span className="slot-hint">แตะเพื่อถ่าย</span>
        </>
      )}
      {src && <><img src={src} alt="" /><span className="slot-tag">{side === 'front' ? 'ด้านหน้า' : 'ด้านหลัง'}</span></>}
      <input type="file" accept="image/*" aria-label={`อัปโหลดภาพด้าน${side === 'front' ? 'หน้า' : 'หลัง'}ของการ์ด`} onChange={(e) => onPick(side, e.target.files?.[0])} />
    </label>
  );

  return (
    <>
      <Nav active="camera" />
      <main className="appmain">
        <style>{`
          .rail-steps{display:flex;gap:6px;padding:16px var(--gut) 0;max-width:1120px;margin:0 auto}
          .rail-steps>div{flex:1;text-align:center;font:500 11.5px/1 var(--mono);letter-spacing:.04em;padding-bottom:10px;border-bottom:2px solid var(--border);color:var(--muted)}
          .rail-steps>div.on{color:var(--accent-deep);border-color:var(--accent)}
          .rail-steps>div.done{color:var(--fg);border-color:var(--accent)}
          .sanctum{background:var(--ink);color:var(--on-ink);border-radius:var(--radius);margin:16px var(--gut) 0;padding:26px var(--gut)}
          @media(min-width:768px){.sanctum{margin:20px 0 0;padding:34px 40px}}
          .slots{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:22px}
          .slot{position:relative;aspect-ratio:63/88;border:1.5px dashed oklch(98% 0 0 / .3);border-radius:var(--radius);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;cursor:pointer;overflow:hidden;background:oklch(18% 0.012 250 / .4);transition:border-color .16s,background .16s}
          .slot:hover{border-color:var(--accent);background:oklch(22% 0.012 250 / .5)}
          .slot svg{width:30px;height:30px;color:var(--on-ink-mute);stroke-width:1.4;opacity:.8}
          .slot input{position:absolute;inset:0;opacity:0;cursor:pointer}
          .slot-label{font:600 13px/1 var(--body);color:var(--on-ink)}
          .slot-hint{font:400 11px/1 var(--mono);color:var(--on-ink-mute)}
          .slot.filled{border-style:solid;border-color:var(--accent)}
          .slot.filled img{position:absolute;inset:0;width:100%;height:100%;object-fit:contain}
          .slot-tag{position:absolute;left:8px;bottom:8px;z-index:1;background:oklch(18% 0.012 250 / .8);color:var(--on-ink);font:500 10.5px/1 var(--mono);padding:5px 8px;border-radius:4px}
          .scanning{text-align:center;padding:50px var(--gut) 40px;max-width:460px;margin:0 auto}
          .scan-ring{width:96px;height:96px;margin:0 auto 22px;border-radius:50%;border:3px solid oklch(98% 0 0 / .2);border-top-color:var(--accent);animation:spin 1.1s linear infinite}
          @keyframes spin{to{transform:rotate(360deg)}}
          .checks{margin-top:22px;display:grid;gap:10px;text-align:left}
          .check{display:flex;align-items:center;gap:10px;font-size:13.5px;color:var(--on-ink-mute);opacity:.5;transition:opacity .2s}
          .check.on{opacity:1;color:var(--on-ink)}
          .check-dot{width:8px;height:8px;border-radius:50%;background:oklch(50% 0.012 250);flex:none;transition:background .2s}
          .check.on .check-dot{background:var(--accent)}
          .match-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px}
          .match-card{border:1px solid var(--border);border-radius:10px;overflow:hidden;background:var(--surface);cursor:pointer;text-align:left;transition:border-color .15s,box-shadow .15s}
          .match-card:hover{border-color:var(--accent);box-shadow:0 2px 12px oklch(0 0 0 / .08)}
          .match-card.sel{border-color:var(--accent);box-shadow:0 0 0 2px oklch(60% 0.18 250 / .25)}
          .match-thumb{aspect-ratio:63/88;background:var(--plate);overflow:hidden}
          .match-thumb img{width:100%;height:100%;object-fit:contain}
        `}</style>
        <div className="page">
          {step === 'capture' && (
            <section data-od-id="camera-capture">
              <Rail n={1} />
              <div className="sanctum" style={{ marginLeft: 0, marginRight: 0 }}>
                <span className="kicker kicker-gold" style={{ marginBottom: 10 }}>ระบุการ์ดจากรูป</span>
                <h2 style={{ color: 'var(--on-ink)', fontSize: 23, marginBottom: 8 }}>ถ่ายการ์ดให้เต็มกรอบ</h2>
                <div className="btn-row" role="radiogroup" aria-label="ประเภทการ์ด" style={{ marginBottom: 14 }}>
                  {[['pokemon', 'โปเกมอน'], ['yugioh', 'ยูกิ'], ['onepiece', 'วันพีซ']].map(([k, label]) => (
                    <button key={k} role="radio" aria-checked={game === k} className={`btn btn-sm ${game === k ? 'btn-primary' : ''}`} onClick={() => setGame(k)}>{label}</button>
                  ))}
                </div>
                <p style={{ color: 'var(--on-ink-mute)', fontSize: 14, marginBottom: 22 }}>ระบบจะบอกว่าเป็นการ์ดใบไหน ซีรีส์อะไร ออกปีไหน พร้อมตัวอย่างราคาจากเว็บที่เชื่อถือได้</p>
                <div className="slots" style={{ display: 'flex', justifyContent: 'center' }}>
                  <div style={{ width: '100%', maxWidth: 280 }}>
                    <Slot side="front" src={front} />
                  </div>
                </div>
                <p className="fine" style={{ color: 'var(--on-ink-mute)', textAlign: 'center' }}>ยังไม่มีภาพ? ใช้ภาพตัวอย่างได้ <button className="btn btn-ghost" data-od-id="use-sample" onClick={() => { setFront(SAMPLE); }}>ใช้ภาพตัวอย่าง</button></p>
              </div>
              <div className="page-narrow page-center" style={{ paddingTop: 24 }}>
                <button className="btn btn-primary btn-block" disabled={!ready} data-od-id="camera-submit" onClick={startScan}>ระบุการ์ด</button>
                <p className="fine" style={{ textAlign: 'center', marginTop: 12 }}>{ready ? 'พร้อมแล้ว · กดระบุการ์ดได้เลย' : 'ถ่ายด้านหน้าก่อนจึงจะระบุได้'}</p>
              </div>
            </section>
          )}

          {step === 'scanning' && (
            <section data-od-id="camera-scanning">
              <Rail n={2} />
              <div className="sanctum" style={{ marginLeft: 0, marginRight: 0, minHeight: '56vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div className="scanning">
                  <div className="scan-ring"></div>
                  <span className="kicker kicker-gold" style={{ marginBottom: 9 }}>ขั้นที่ ๒</span>
                  <h2 style={{ color: 'var(--on-ink)', fontSize: 23 }}>กำลังเทียบกับฐานข้อมูล</h2>
                  <p style={{ color: 'var(--on-ink-mute)', fontSize: 14, marginTop: 8 }}>{nCards} ใบ · หาใบที่ใกล้ที่สุด</p>
                  <ul className="checks">
                    {['ย่อและครอปรูปให้เป็นสัดส่วนการ์ด', 'จับกรอบการ์ด + แปลงภาพเป็นเวกเตอร์ (DINOv2)', `เทียบกับฐานข้อมูล ${nCards} ใบ`, 'จัดอันดับ 5 ใบที่ใกล้ที่สุด'].map((t, i) => (
                      <li key={i} className={`check ${checkOn > i ? 'on' : ''}`}><span className="check-dot"></span>{t}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </section>
          )}

          {step === 'result' && (
            <section data-od-id="camera-result">
              <Rail n={3} />
              {detectedCards.length > 0 && (
                <div className="card" style={{ padding: '16px 14px', marginTop: 16 }} data-od-id="camera-identify">
                  <h3 style={{ font: '600 15px var(--body)', marginBottom: 8 }}>
                    พบ {detectedCards.length} ใบในภาพ{detectedCards.some((d) => !d.known) ? ` · ไม่รู้จัก ${detectedCards.filter((d) => !d.known).length} ใบ` : ''}
                    {total > 0 && <span style={{ font: '600 13px var(--mono)', color: 'var(--accent-deep)', marginLeft: 8 }}>· รวมราคาตลาด ≈ ฿{baht(total)}</span>}
                  </h3>
                  <CardOverlay src={front} detectedCards={detectedCards} />
                </div>
              )}
              {results.length === 0 && (
                <div className="card" style={{ padding: '16px 14px', marginTop: 16 }}>
                  <p style={{ color: 'var(--muted)', fontSize: 13, margin: 0 }}>ไม่พบการ์ดในรูป — ลองถ่ายให้การ์ดเต็มกรอบ แสงพอดี หรือพิมพ์ชื่อด้านล่าง</p>
                </div>
              )}
              {/* key รวม code → สแกนใหม่แล้ว state ในแต่ละใบรีเซ็ต */}
              {results.map((det, i) => (
                <CardResult key={`${i}-${det.code}-${det.name}`} n={i + 1} det={det} front={front} onPrice={onPrice} showToast={showToast} />
              ))}

              <div className="card" style={{ padding: '16px 14px', marginTop: 12 }}>
                <h3 style={{ font: '600 14px var(--body)', marginBottom: 4 }}>หรือพิมพ์ชื่อเอง</h3>
                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                  <input type="text" placeholder="เช่น Pikachu, Charizard..." value={cardQ} onFocus={loadCardNames} onChange={(e) => setCardQ(e.target.value)} list="camera-names"
                    style={{ flex: 1, padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 6, font: '14px var(--body)' }} />
                  <button className="btn btn-primary" disabled={!cardQ.trim()} onClick={addTyped}>เพิ่ม</button>
                </div>
                <datalist id="camera-names">
                  {cardNames.filter((n) => n.toLowerCase().includes(cardQ.toLowerCase())).slice(0, 30).map((n) => <option key={n} value={n} />)}
                </datalist>
              </div>

              <div className="btn-row" style={{ marginTop: 16 }}><button className="btn btn-primary" data-od-id="result-again" onClick={reset}>ถ่ายใบใหม่</button><Link className="btn" to="/datacard">ดูฐานข้อมูลการ์ด</Link></div>
            </section>
          )}

        </div>
      </main>
      {toast && <div className="toast on">{toast}</div>}
    </>
  );
}
