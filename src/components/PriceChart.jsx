import React from 'react';
import { baht } from '../lib.js';

export default function PriceChart({ data }) {
  const history = data?.history || (Array.isArray(data) ? data : []);
  const live = data?.live;
  const isPokemon = !live?.source || live.source === 'Pokémon TCG API';

  return (
    <div style={{ margin: '14px 0' }}>
      {live && (live.marketThb || live.cardmarketThb) && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
          <div style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 6, padding: '8px 10px' }}>
            <div style={{ font: '500 10px var(--mono)', color: 'var(--muted)' }}>{isPokemon ? 'TCGPLAYER MARKET' : 'MARKET PRICE'}</div>
            <div style={{ font: '600 15px var(--mono)', color: 'var(--accent-deep)' }}>{live.marketThb ? <>฿{baht(live.marketThb)} {live.marketUsd && <span style={{ fontSize: 11, color: 'var(--muted)' }}>(${live.marketUsd})</span>}</> : '—'}</div>
          </div>
          <div style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 6, padding: '8px 10px' }}>
            <div style={{ font: '500 10px var(--mono)', color: 'var(--muted)' }}>CARDMARKET AVG</div>
            <div style={{ font: '600 15px var(--mono)', color: 'var(--fg)' }}>{live.cardmarketThb ? `฿${baht(live.cardmarketThb)}` : (live?.source === 'OPTCG API' ? 'N/A (OPTCG ไม่มี Cardmarket)' : '—')}</div>
          </div>
        </div>
      )}

      {live && (live.tcgplayer?.length > 0 || live.cardmarket) && (
        <table style={{ width: '100%', borderCollapse: 'collapse', font: '500 12px var(--mono)', marginBottom: 10 }}>
          <thead><tr style={{ color: 'var(--muted)', fontSize: 10, textAlign: 'right' }}><th style={{ textAlign: 'left' }}>แหล่ง / แบบ</th><th>ต่ำสุด</th><th>ตลาด</th><th>สูงสุด</th></tr></thead>
          <tbody>
            {(live.tcgplayer || []).map((v) => (
              <tr key={v.variant} style={{ textAlign: 'right', borderTop: '1px solid var(--border)' }}>
                <td style={{ textAlign: 'left', padding: '4px 0' }}>TCGplayer · {v.variant}</td>
                <td>{v.lowThb ? `฿${baht(v.lowThb)}` : '—'}</td><td>{v.marketThb ? `฿${baht(v.marketThb)}` : '—'}</td><td>{v.highThb ? `฿${baht(v.highThb)}` : '—'}</td>
              </tr>
            ))}
            {live.cardmarket && (
              <tr style={{ textAlign: 'right', borderTop: '1px solid var(--border)' }}>
                <td style={{ textAlign: 'left', padding: '4px 0' }}>Cardmarket · trend</td>
                <td>{live.cardmarket.lowThb ? `฿${baht(live.cardmarket.lowThb)}` : '—'}</td><td>{live.cardmarket.trendThb ? `฿${baht(live.cardmarket.trendThb)}` : '—'}</td><td>—</td>
              </tr>
            )}
          </tbody>
        </table>
      )}

      {history.length >= 3 && (() => {
        const pts = [...history].sort((a, b) => a.created_at - b.created_at);
        const vals = pts.map((p) => p.price);
        const min = Math.min(...vals);
        const max = Math.max(...vals);
        const range = max - min || 1;

        const width = 320;
        const height = 100;
        const padX = 10;
        const padY = 16;

        const coords = pts.map((p, i) => {
          const x = padX + (i / (pts.length - 1)) * (width - padX * 2);
          const y = height - padY - ((p.price - min) / range) * (height - padY * 2);
          return { x, y, price: p.price };
        });

        const polyline = coords.map((c) => `${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(' ');
        const latest = pts[pts.length - 1].price;
        const oldest = pts[0].price;
        const diff = latest - oldest;
        const pct = oldest ? ((diff / oldest) * 100).toFixed(1) : '0';

        return (
          <div style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '12px 14px', marginBottom: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
              <span style={{ font: '600 11px var(--mono)', color: 'var(--muted)', textTransform: 'uppercase' }}>ประวัติราคา (อัปเดตล่าสุด)</span>
              <span style={{ font: '600 12px var(--mono)', color: diff >= 0 ? 'var(--ok)' : 'var(--bad)' }}>
                {diff >= 0 ? '+' : ''}{baht(diff)} ({pct}%)
              </span>
            </div>
            <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: 'auto', display: 'block', overflow: 'visible' }}>
              <polyline fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" points={polyline} />
              {coords.map((c, i) => (
                <circle key={i} cx={c.x} cy={c.y} r="3" fill="var(--surface)" stroke="var(--accent)" strokeWidth="2" />
              ))}
            </svg>
            <div style={{ display: 'flex', justifyContent: 'space-between', font: '500 11px var(--mono)', color: 'var(--muted)', marginTop: 6 }}>
              <span>ต่ำสุด ฿{baht(min)}</span>
              <span>ล่าสุด ฿{baht(latest)}</span>
              <span>สูงสุด ฿{baht(max)}</span>
            </div>
          </div>
        );
      })()}
      <div style={{ fontSize: 10, color: 'var(--muted)', textAlign: 'right', marginTop: 4 }}>
        ข้อมูลอ้างอิงจาก {live?.tcgplayerUrl ? <a href={live.tcgplayerUrl} target="_blank" rel="noreferrer">TCGplayer</a> : 'TCGplayer'} / {live?.cardmarketUrl ? <a href={live.cardmarketUrl} target="_blank" rel="noreferrer">Cardmarket</a> : 'Cardmarket'} {live?.source ? <>ผ่าน <a href={live.sourceUrl} target="_blank" rel="noreferrer">{live.source}</a></> : 'ผ่าน Pokémon TCG API'}{live?.updatedAt ? ` · อัปเดต ${live.updatedAt}` : ''}
      </div>
    </div>
  );
}
