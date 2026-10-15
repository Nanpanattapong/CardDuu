import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Nav from '../components/Nav.jsx';
import PriceChart from '../components/PriceChart.jsx';
import { Auth, api, baht } from '../lib.js';
import { imgUrl, bestCode, hasImage, loadPrices, loadGameDb, metaCardInfo, gameOf } from '../lib/cards.js';

const PAGE = 60;
const GAMES = [['pokemon', 'โปเกมอน'], ['yugioh', 'ยูกิ'], ['onepiece', 'วันพีซ'], ['football', 'ฟุตบอล']];
// ค่าตาม pokemontcg.io (types[0] / supertype) — ดู scripts/fetch-prices.py
const TYPES = [['Fire', 'ไฟ'], ['Water', 'น้ำ'], ['Grass', 'หญ้า'], ['Lightning', 'สายฟ้า'], ['Psychic', 'พลังจิต'], ['Fighting', 'ต่อสู้'],
  ['Darkness', 'ความมืด'], ['Metal', 'เหล็ก'], ['Fairy', 'แฟรี่'], ['Dragon', 'มังกร'], ['Colorless', 'ไร้สี'], ['Trainer', 'เทรนเนอร์'], ['Energy', 'พลังงาน']];

export default function Datacard() {
  const [index, setIndex] = useState({});
  const [sets, setSets] = useState([]);
  const [params] = useSearchParams();
  const nav = useNavigate();
  const [q, setQ] = useState(params.get('q') || '');
  const [setSel, setSetSel] = useState(params.get('set') || 'all');
  const [selected, setSelected] = useState(null);
  const [prices, setPrices] = useState(null);
  const [count, setCount] = useState(PAGE);
  const [priceDb, setPriceDb] = useState({});
  const [types, setTypes] = useState({});
  const [typeSel, setTypeSel] = useState(params.get('type') || 'all');
  const [raritySel, setRaritySel] = useState(params.get('rarity') || 'all');
  const [sort, setSort] = useState(params.get('sort') || 'name');
  const picking = params.get('name');
  const game = GAMES.some(([k]) => k === params.get('game')) ? params.get('game') : 'pokemon';
  const [setOf, setSetOf] = useState(null); // null = โปเกมอน: ชุด = prefix ของ code
  const [rarityOf, setRarityOf] = useState(null);
  const [typeList, setTypeList] = useState(TYPES);
  const [rarityList, setRarityList] = useState([]);

  useEffect(() => {
    let live = true;
    setIndex({}); setSelected(null);
    if (game === 'pokemon') {
      setSetOf(null); setRarityOf(null); setTypeList(TYPES); setRarityList([]); setRaritySel('all');
      fetch('/data/card-index.json').then((r) => r.json()).then((d) => live && setIndex(d)).catch(() => {});
      fetch('/data/card-types.json').then((r) => r.json()).then((d) => live && setTypes(d)).catch(() => {});
      fetch('/data/sets.json').then((r) => r.json()).then((d) => live && setSets(d)).catch(() => {});
      loadPrices().then((d) => live && setPriceDb(d.prices || {}));
    } else {
      // ยูกิ/วันพีซ: แปลง meta เป็นรูปแบบเดียวกับโปเกมอน (src/lib/cards.js loadGameDb)
      loadGameDb(game).then((d) => {
        if (!live) return;
        setIndex(d.index); setTypes(d.typeOf); setPriceDb(d.priceOf); setSetOf(d.setOf); setRarityOf(d.rarityOf);
        setSets(d.sets.map((s) => ({ id: s, name: s }))); setTypeList(d.typeList.map((t) => [t, t])); setRarityList(d.rarityList);
      });
    }
    return () => { live = false; };
  }, [game]);

  // โปเกมอน: public/data/prices.json (scripts/fetch-prices.py) — TCGplayer ก่อน ไม่มีค่อยใช้ Cardmarket; ยูกิ/วันพีซ: ฿ ตรงๆ
  const priceOf = (c) => (typeof priceDb[c] === 'number' ? priceDb[c] : priceDb[c]?.m || priceDb[c]?.c || 0);
  const setKey = (c) => (setOf ? setOf[c] : c.split('-')[0]);
  const priceLabel = (codes) => {
    const ps = codes.map(priceOf).filter(Boolean);
    if (!ps.length) return null;
    const lo = Math.min(...ps), hi = Math.max(...ps);
    return lo === hi ? `฿${baht(lo)}` : `฿${baht(lo)} – ฿${baht(hi)}`;
  };

  const names = useMemo(() => Object.keys(index).sort(), [index]);
  // แต่ละชื่อ → เฉพาะรหัสที่ผ่านเซ็ต/ธาตุ แล้วเรียงตามราคาสูงสุดของชื่อนั้น
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    const rows = names.flatMap((n) => {
      const codes = index[n].filter((c) => (setSel === 'all' || setKey(c) === setSel) && (typeSel === 'all' || types[c] === typeSel) && (raritySel === 'all' || rarityOf?.[c] === raritySel));
      if (!codes.length) return [];
      if (s && !n.toLowerCase().includes(s) && !codes.some((c) => c.toLowerCase().includes(s))) return [];
      return [{ name: n, codes, top: Math.max(0, ...codes.map(priceOf)) }];
    });
    if (sort === 'desc') rows.sort((a, b) => b.top - a.top);
    if (sort === 'asc') rows.sort((a, b) => (a.top || Infinity) - (b.top || Infinity)); // ไม่มีราคาไว้ท้าย
    return rows;
  }, [names, index, q, setSel, typeSel, types, raritySel, rarityOf, sort, priceDb, setOf]);

  const open = (name, code) => { setSelected({ name, code }); setPrices(null); };
  useEffect(() => {
    if (!selected) return;
    (gameOf(selected.code) !== 'pokemon' ? metaCardInfo(selected.code)
      : api(`/api/prices?name=${encodeURIComponent(selected.name)}&code=${encodeURIComponent(selected.code)}`, { auth: false }))
      .then(setPrices).catch(() => setPrices([]));
  }, [selected]);
  const info = prices?.card;
  const word = { yugioh: 'yugioh', onepiece: 'one piece' }[game];

  const listCard = (name, code, onClick, codes = code ? [code] : []) => (
    <button key={code || name} className="card-item" style={{ padding: 10, cursor: 'pointer', textAlign: 'left' }} onClick={onClick}>
      {code && (
        <span className="card-thumb" style={{ aspectRatio: '63/88', marginBottom: 8, display: 'grid', placeItems: 'center' }}>
          {hasImage(code)
            ? <img src={imgUrl(code)} alt={`${name} ${code}`} loading="lazy" style={{ objectFit: 'contain' }} />
            : <span className="fine">ไม่มีรูป</span>}
        </span>
      )}
      <b style={{ display: 'block', fontSize: 13 }}>{name}</b>
      <span className="fine">{codes.length > 1 ? `${codes.length} เวอร์ชัน` : code}</span>
      {priceLabel(codes) && <span style={{ display: 'block', font: '600 13px var(--mono)', color: 'var(--accent-deep)', marginTop: 2 }}>{priceLabel(codes)}</span>}
    </button>
  );

  return (
    <>
      <Nav active="datacard" />
      <main className="appmain">
        <div className="page">
          <section>
            <h1 style={{ font: '700 28px/1.2 var(--display)', marginBottom: 8 }}>ฐานข้อมูลการ์ด</h1>
            <div className="btn-row" role="radiogroup" aria-label="ประเภทการ์ด" style={{ marginBottom: 12 }}>
              {GAMES.map(([k, label]) => (
                <button key={k} role="radio" aria-checked={game === k} className={`btn btn-sm ${game === k ? 'btn-primary' : ''}`}
                  onClick={() => { setSetSel('all'); setTypeSel('all'); setRaritySel('all'); setCount(PAGE); nav(`/datacard?game=${k}`); }}>{label}</button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
              <input type="text" placeholder="ค้นชื่อ..." value={q} onChange={(e) => { setQ(e.target.value); setCount(PAGE); }}
                style={{ flex: 2, minWidth: 180, padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--surface)' }} />
              <div className="sel-wrap" style={{ flex: 1, minWidth: 140 }}>
                <select value={setSel} onChange={(e) => { setSetSel(e.target.value); setCount(PAGE); }}>
                  <option value="all">ทุกซีรีส์</option>
                  {sets.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div className="sel-wrap" style={{ flex: 1, minWidth: 120 }}>
                <select value={typeSel} onChange={(e) => { setTypeSel(e.target.value); setCount(PAGE); }} aria-label={setOf ? 'ประเภท' : 'ธาตุ'}>
                  <option value="all">{setOf ? 'ทุกประเภท' : 'ทุกธาตุ'}</option>
                  {typeList.map(([v, label]) => <option key={v} value={v}>{label}</option>)}
                </select>
              </div>
              {rarityList.length > 0 && <div className="sel-wrap" style={{ flex: 1, minWidth: 120 }}>
                <select value={raritySel} onChange={(e) => { setRaritySel(e.target.value); setCount(PAGE); }} aria-label="ความหายาก">
                  <option value="all">ทุกความหายาก</option>
                  {rarityList.map((rarity) => <option key={rarity} value={rarity}>{rarity}</option>)}
                </select>
              </div>}
              <div className="sel-wrap" style={{ flex: 1, minWidth: 140 }}>
                <select value={sort} onChange={(e) => { setSort(e.target.value); setCount(PAGE); }} aria-label="เรียง">
                  <option value="name">เรียงตามชื่อ A–Z</option>
                  <option value="desc">ราคา สูง → ต่ำ</option>
                  <option value="asc">ราคา ต่ำ → สูง</option>
                </select>
              </div>
            </div>
            <p className="fine" style={{ marginBottom: 12 }}>พบ {filtered.length.toLocaleString()} รายการ</p>
          </section>

          {!selected && picking && index[picking] ? (
            <section data-od-id="datacard-versions">
              <button className="btn btn-ghost" style={{ marginBottom: 12 }} onClick={() => nav(-1)}>← ย้อนกลับ</button>
              <h2 style={{ margin: '0 0 12px' }}>{picking} · {index[picking].length} เวอร์ชัน</h2>
              <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(140px,1fr))' }}>
                {index[picking].map((code) => listCard(picking, code, () => open(picking, code), [code]))}
              </div>
            </section>
          ) : !selected ? (
            <>
              <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(140px,1fr))' }}>
                {filtered.slice(0, count).map(({ name, codes }) => {
                  // เรียงตามราคา → โชว์รูปใบที่แพงสุดของชื่อนั้น
                  const code = sort === 'name' ? bestCode(codes) : bestCode([...codes].sort((a, b) => priceOf(b) - priceOf(a)));
                  return listCard(name, code, () => (codes.length === 1 ? open(name, code) : nav(`/datacard?game=${game}&name=${encodeURIComponent(name)}&set=${encodeURIComponent(setSel)}&type=${encodeURIComponent(typeSel)}`)), codes);
                })}
              </div>
              {filtered.length > count && <div style={{ textAlign: 'center', margin: '20px 0' }}><button className="btn" onClick={() => setCount((c) => c + PAGE)}>แสดงเพิ่ม</button></div>}
            </>
          ) : (
            <section data-od-id="datacard-detail">
              <button className="btn btn-ghost" style={{ marginBottom: 12 }} onClick={() => setSelected(null)}>← ย้อนกลับ</button>
              <div style={{ display: 'grid', gap: 20, gridTemplateColumns: 'minmax(0,320px) 1fr' }}>
                {hasImage(selected.code)
                  ? <img src={imgUrl(selected.code)} alt={`${selected.name} ${selected.code}`} style={{ width: '100%', aspectRatio: '63/88', objectFit: 'contain', background: 'var(--plate)', borderRadius: 12 }} />
                  : <div style={{ width: '100%', aspectRatio: '63/88', display: 'grid', placeItems: 'center', background: 'var(--plate)', borderRadius: 12 }} className="fine">ไม่มีรูปการ์ดใบนี้</div>}
                <div>
                  <h2 style={{ margin: '0 0 8px' }}>{selected.name}</h2>
                  <span className="kicker" style={{ marginBottom: 16, display: 'block' }}>{selected.code}</span>
                  {info && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, font: '12px var(--body)', marginBottom: 12 }}>
                      <div><b>ชุด:</b> {info.set?.name || '—'}</div>
                      <div><b>{word ? 'ประเภท' : 'ซีรีส์'}:</b> {info.set?.series || '—'}</div>
                      <div><b>เลขการ์ด:</b> {info.number || '—'}</div>
                      <div><b>ความหายาก:</b> {info.rarity || '—'}</div>
                    </div>
                  )}
                  <PriceChart data={prices} />
                  <div style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 14px', margin: '12px 0' }}>
                    <div style={{ font: '600 12px var(--body)', marginBottom: 6 }}>🔍 ค้นหาเพิ่มเติมจากแหล่งอ้างอิงภายนอก:</div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      <a className="btn btn-sm" href={`https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(selected.name + ' ' + (word ? `${word} ${info?.number || ''}` : selected.code))}&LH_Sold=1&LH_Complete=1`} target="_blank" rel="noreferrer">eBay (ราคาขายจริง) ↗</a>
                      <a className="btn btn-sm" href={`https://www.pricecharting.com/search-products?q=${encodeURIComponent(selected.name)}&type=prices`} target="_blank" rel="noreferrer">PriceCharting ↗</a>
                      {prices?.card?.set?.name && <a className="btn btn-sm" href={`https://www.google.com/search?q=${encodeURIComponent(prices.card.set.name + ` ${word || 'pokemon'} card list`)}`} target="_blank" rel="noreferrer">Google เช็คเซ็ต ↗</a>}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                    <button className="btn btn-primary" onClick={() => nav(`/market?tab=listings&q=${encodeURIComponent(selected.name)}`)}>ดูในตลาด</button>
                    <button className="btn" onClick={async () => {
                      if (!Auth.session()) { nav('/login?redirect=datacard'); return; }
                      try {
                        await api('/api/collection', { method: 'POST', body: { name: `${selected.name} [${selected.code}]`, image: imgUrl(selected.code), value: prices?.live?.marketThb || 0, note: selected.code } });
                        alert('เพิ่มเข้าคอลเลกชันแล้ว');
                      } catch (e) { alert(e.message); }
                    }}>+ คอลเลกชัน</button>
                  </div>
                </div>
              </div>
            </section>
          )}
        </div>
      </main>
    </>
  );
}
