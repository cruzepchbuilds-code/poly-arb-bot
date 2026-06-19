import http from "http";

export function startWebServer(getState, port = 3000) {
  const server = http.createServer((req, res) => {
    if (req.url === "/api/state") {
      res.writeHead(200, {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "no-cache",
      });
      try { res.end(JSON.stringify(getState())); }
      catch (e) { res.end(JSON.stringify({ error: e.message })); }
      return;
    }
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(HTML);
  });
  server.listen(port, "0.0.0.0", () => {
    console.error(`[web] Dashboard → http://0.0.0.0:${port}`);
  });
  return server;
}

const HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Poly Arb Bot</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{background:#0d0d0d;color:#e0e0e0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:14px;min-height:100vh}

  /* Header */
  .header{background:#111;border-bottom:1px solid #222;padding:14px 20px;display:flex;align-items:center;gap:16px;flex-wrap:wrap}
  .header h1{font-size:16px;font-weight:600;color:#fff;letter-spacing:.5px}
  .badge{padding:3px 10px;border-radius:20px;font-size:11px;font-weight:600;letter-spacing:.5px}
  .badge.sim{background:#2a2000;color:#f59e0b;border:1px solid #f59e0b44}
  .badge.live{background:#0a2000;color:#22c55e;border:1px solid #22c55e44}
  .badge.ws-on{background:#0a2000;color:#22c55e;border:1px solid #22c55e44}
  .badge.ws-off{background:#200a0a;color:#ef4444;border:1px solid #ef444444}
  .balance{margin-left:auto;font-size:22px;font-weight:700;color:#fff}
  .balance span{font-size:12px;color:#666;margin-right:4px}
  .pnl-pos{color:#22c55e}.pnl-neg{color:#ef4444}.pnl-zero{color:#666}
  .last-update{font-size:11px;color:#444}
  .refresh-dot{width:7px;height:7px;background:#22c55e;border-radius:50%;display:inline-block;margin-right:5px;animation:pulse 2s infinite}
  @keyframes pulse{0%,100%{opacity:1}50%{opacity:.3}}

  /* Layout */
  .main{padding:16px 20px;display:grid;gap:14px;max-width:1400px;margin:0 auto}

  /* Price bar */
  .prices-bar{background:#111;border:1px solid #1e1e1e;border-radius:10px;padding:12px 16px;display:flex;gap:20px;flex-wrap:wrap;align-items:center}
  .price-item{display:flex;flex-direction:column;align-items:center;gap:2px;min-width:60px}
  .price-label{font-size:10px;color:#666;font-weight:600;letter-spacing:.5px}
  .price-value{font-size:13px;font-weight:600;color:#e0e0e0}
  .price-mom{font-size:10px}
  .mom-up{color:#22c55e}.mom-dn{color:#ef4444}.mom-flat{color:#555}

  /* Strategy cards */
  .cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(155px,1fr));gap:12px}
  .card{background:#111;border:1px solid #1e1e1e;border-radius:10px;padding:14px 16px;position:relative}
  .card-title{font-size:10px;color:#666;font-weight:600;letter-spacing:.8px;text-transform:uppercase;margin-bottom:8px}
  .card-main{font-size:28px;font-weight:700;color:#fff;line-height:1}
  .card-sub{font-size:11px;color:#555;margin-top:5px}
  .card-pnl{font-size:13px;font-weight:600;margin-top:6px}
  .card-wr-bar{margin-top:8px;height:3px;border-radius:2px;background:#1e1e1e;overflow:hidden}
  .card-wr-fill{height:100%;border-radius:2px;transition:width .4s}
  .card.sniper{border-color:#7c3aed33}
  .card.sniper .card-title{color:#7c3aed}
  .card.fade-card{border-color:#0ea5e933}
  .card.fade-card .card-title{color:#0ea5e9}
  .card.lem-card{border-color:#38bdf833}
  .card.lem-card .card-title{color:#38bdf8}

  /* Chart */
  .chart-wrap{background:#111;border:1px solid #1e1e1e;border-radius:10px;overflow:hidden}
  .chart-header{padding:10px 16px;background:#161616;border-bottom:1px solid #1e1e1e;display:flex;align-items:center;justify-content:space-between}
  .chart-header-title{font-size:11px;font-weight:600;color:#888;letter-spacing:.6px;text-transform:uppercase}
  .chart-body{padding:8px 4px 4px}

  /* Sections */
  .section{background:#111;border:1px solid #1e1e1e;border-radius:10px;overflow:hidden}
  .section-header{padding:10px 16px;background:#161616;border-bottom:1px solid #1e1e1e;font-size:11px;font-weight:600;color:#888;letter-spacing:.6px;text-transform:uppercase;display:flex;align-items:center;justify-content:space-between}
  .section-count{background:#222;color:#aaa;padding:2px 8px;border-radius:10px;font-size:11px}

  /* Tables */
  table{width:100%;border-collapse:collapse}
  th{padding:8px 14px;text-align:left;font-size:10px;color:#555;font-weight:600;letter-spacing:.5px;border-bottom:1px solid #1e1e1e;white-space:nowrap}
  td{padding:9px 14px;border-bottom:1px solid #181818;font-size:13px;vertical-align:middle}
  tr:last-child td{border-bottom:none}
  tr:hover td{background:#161616}
  .empty{padding:24px;text-align:center;color:#444;font-size:13px}

  /* Tags */
  .tag{display:inline-block;padding:2px 7px;border-radius:4px;font-size:10px;font-weight:600;letter-spacing:.3px}
  .tag.snipe{background:#3b0764;color:#a855f7}
  .tag.lem{background:#0c2a40;color:#38bdf8}
  .tag.fade{background:#0c1f33;color:#0ea5e9}
  .tag.arb{background:#0a2000;color:#4ade80}
  .tag.sweep{background:#2a1000;color:#fb923c}
  .tag.up{background:#0a2000;color:#4ade80}
  .tag.down{background:#2a0000;color:#f87171}

  /* Results */
  .win{color:#22c55e;font-weight:600}.loss{color:#ef4444;font-weight:600}.pending{color:#f59e0b}
  .time-left{color:#888;font-size:12px}

  /* Pagination */
  .pager{padding:10px 14px;display:flex;align-items:center;gap:10px;justify-content:flex-end;border-top:1px solid #1e1e1e;background:#111}
  .pager-btn{background:#1a1a1a;border:1px solid #2a2a2a;color:#aaa;padding:4px 12px;border-radius:6px;cursor:pointer;font-size:12px}
  .pager-btn:hover:not(:disabled){background:#222;color:#fff}
  .pager-btn:disabled{opacity:.3;cursor:default}
  .pager-info{font-size:12px;color:#555}

  /* Analytics */
  .analytics-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:12px}
  .insight{background:#0a1a00;border:1px solid #22c55e22;border-radius:8px;padding:10px 14px;font-size:12px;color:#86efac}
  .insight.warn{background:#1a0a00;border-color:#f59e0b22;color:#fbbf24}
  .insight.bad{background:#1a0000;border-color:#ef444422;color:#f87171}
  .mini-table{width:100%;border-collapse:collapse;font-size:12px}
  .mini-table th{padding:5px 10px;text-align:left;color:#444;font-size:10px;font-weight:600;letter-spacing:.4px;border-bottom:1px solid #1a1a1a}
  .mini-table td{padding:5px 10px;border-bottom:1px solid #111;color:#ccc}
  .mini-table tr:last-child td{border:none}

  /* WS debug collapsible */
  details summary{padding:10px 16px;background:#161616;border-bottom:1px solid #1e1e1e;font-size:11px;font-weight:600;color:#555;letter-spacing:.6px;text-transform:uppercase;cursor:pointer;list-style:none;display:flex;align-items:center;gap:8px}
  details summary::-webkit-details-marker{display:none}
  details summary::before{content:'▶';font-size:9px;transition:transform .2s}
  details[open] summary::before{transform:rotate(90deg)}

  @media(max-width:600px){
    .header{padding:10px 14px}.main{padding:10px 14px}.balance{font-size:18px}
    .cards{grid-template-columns:repeat(2,1fr)}
    td,th{padding:7px 10px}
  }
</style>
</head>
<body>
<div class="header">
  <h1>Poly Arb Bot</h1>
  <span id="mode-badge" class="badge sim">SIM</span>
  <span id="ws-badge" class="badge ws-off">WS</span>
  <span id="mkts-count" style="color:#555;font-size:12px"></span>
  <div class="balance"><span>Balance</span><span id="balance">—</span></div>
  <div id="pnl-display" style="font-size:13px;color:#555;font-weight:600"></div>
  <span id="last-update" class="last-update"><span class="refresh-dot"></span>connecting...</span>
</div>

<div class="main">

  <!-- Asset prices -->
  <div class="prices-bar" id="prices-bar"></div>

  <!-- Strategy cards -->
  <div class="cards" id="cards"></div>

  <!-- P&L Chart -->
  <div class="chart-wrap">
    <div class="chart-header">
      <span class="chart-header-title">Balance Over Time</span>
      <span id="chart-meta" style="font-size:11px;color:#555"></span>
    </div>
    <div class="chart-body" id="chart-body">
      <div class="empty">Collecting data...</div>
    </div>
  </div>

  <!-- Active positions -->
  <div class="section">
    <div class="section-header">
      Active Positions
      <span id="pos-count" class="section-count">0</span>
    </div>
    <div id="positions-body"><div class="empty">No active positions</div></div>
  </div>

  <!-- Analytics -->
  <div class="section" id="analytics-section" style="display:none">
    <div class="section-header">
      Analytics & Insights
      <span id="analytics-updated" style="font-size:10px;color:#555;font-weight:400"></span>
    </div>
    <div style="padding:14px 16px;display:grid;gap:14px">
      <div id="analytics-suggestions"></div>
      <div class="analytics-grid">
        <div>
          <div style="font-size:10px;color:#555;font-weight:600;letter-spacing:.5px;margin-bottom:8px">BY STRATEGY</div>
          <table class="mini-table" id="tbl-strategy"></table>
        </div>
        <div>
          <div style="font-size:10px;color:#555;font-weight:600;letter-spacing:.5px;margin-bottom:8px">BY ASSET</div>
          <table class="mini-table" id="tbl-asset"></table>
        </div>
        <div>
          <div style="font-size:10px;color:#555;font-weight:600;letter-spacing:.5px;margin-bottom:8px">BY ENTRY PRICE</div>
          <table class="mini-table" id="tbl-price"></table>
        </div>
        <div>
          <div style="font-size:10px;color:#555;font-weight:600;letter-spacing:.5px;margin-bottom:8px">ADAPTIVE SIZING</div>
          <table class="mini-table" id="tbl-adaptive"></table>
        </div>
      </div>
    </div>
  </div>

  <!-- Recent trades -->
  <div class="section">
    <div class="section-header">
      Recent Trades
      <span id="trades-count" class="section-count">0</span>
    </div>
    <div id="trades-body"><div class="empty">No completed trades yet</div></div>
    <div class="pager" id="pager" style="display:none">
      <button class="pager-btn" onclick="_prevPage()" id="btn-prev">← Prev</button>
      <span class="pager-info" id="pager-info"></span>
      <button class="pager-btn" onclick="_nextPage()" id="btn-next">Next →</button>
    </div>
  </div>

  <!-- WS debug (collapsed) -->
  <div class="section">
    <details>
      <summary>Live WS Token Prices <span style="color:#444;font-size:10px;margin-left:8px;font-weight:400">click to expand</span></summary>
      <div id="ws-debug-body"><div class="empty">Waiting for WS data...</div></div>
    </details>
  </div>

</div>

<script>
// ── Formatters ──────────────────────────────────────────────────────────────
const fmt    = (n, d=2) => n == null ? '—' : '$' + Number(n).toFixed(d);
const fmtPx  = (p, a) => {
  if (p == null) return '—';
  if (a === 'BTC' || p >= 1000) return '$' + (p/1000).toFixed(1) + 'k';
  if (p >= 1) return '$' + p.toFixed(2);
  return '$' + p.toFixed(4);
};
const pnlCls = v => v > 0.005 ? 'pnl-pos' : v < -0.005 ? 'pnl-neg' : 'pnl-zero';
const fmtPnl = v => (v >= 0 ? '+' : '') + fmt(v);
const fmtPct = v => v == null ? '—' : (v >= 0 ? '+' : '') + (v*100).toFixed(2)+'%';
const ago    = ms => { if (!ms) return '—'; const s=Math.round((Date.now()-ms)/1000); return s<60?s+'s ago':Math.round(s/60)+'m ago'; };
const fmtLeft= ms => { if (!ms) return '—'; const s=Math.max(0,Math.round((ms-Date.now())/1000)); return s<60?s+'s':Math.floor(s/60)+'m'+(s%60?(s%60)+'s':''); };

// ── Strategy tag helper ──────────────────────────────────────────────────────
function stratTag(t) {
  if (!t) return '';
  const strat = t.strategy ?? '';
  if (strat === 'SNIPER') return '<span class="tag snipe">SNIPE</span>';
  if (strat === 'FADE')   return '<span class="tag fade">FADE</span>';
  if (strat.includes('LEM')) return '<span class="tag lem">LEM</span>';
  if (t.type === 'directional') return '<span class="tag lem">LEM</span>';
  if (t.upFilled != null || t.downFilled != null) return '<span class="tag arb">ARB</span>';
  return '<span class="tag lem">LEM</span>';
}

// ── P&L Chart ────────────────────────────────────────────────────────────────
function pnlChart(history, startBal) {
  if (!history || history.length < 3) return '<div class="empty" style="padding:30px">Collecting data — need a few more trades...</div>';
  const W=800, H=130, px=12, py=18;
  const iw=W-px*2, ih=H-py*2;
  const vals=history.map(d=>d.v), times=history.map(d=>d.t);
  const minV=Math.min(startBal*0.88,...vals), maxV=Math.max(startBal*1.12,...vals);
  const minT=times[0], maxT=times[times.length-1];
  const rv=maxV-minV||1, rt=maxT-minT||1;
  const sx=t=>px+((t-minT)/rt)*iw, sy=v=>py+ih-((v-minV)/rv)*ih;
  const lastV=vals[vals.length-1], color=lastV>=startBal?'#22c55e':'#ef4444';
  const pts=history.map(d=>\`\${sx(d.t).toFixed(1)},\${sy(d.v).toFixed(1)}\`).join(' ');
  const startY=sy(startBal).toFixed(1);
  const areaD=\`M \${sx(times[0]).toFixed(1)},\${(py+ih).toFixed(1)} \${history.map(d=>\`L \${sx(d.t).toFixed(1)},\${sy(d.v).toFixed(1)}\`).join(' ')} L \${sx(maxT).toFixed(1)},\${(py+ih).toFixed(1)} Z\`;
  const t0=new Date(minT).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});
  const t1=new Date(maxT).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});
  return \`<svg viewBox="0 0 \${W} \${H}" style="width:100%;height:\${H}px;display:block">
    <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="\${color}" stop-opacity="0.25"/>
      <stop offset="100%" stop-color="\${color}" stop-opacity="0.02"/>
    </linearGradient></defs>
    <line x1="\${px}" y1="\${startY}" x2="\${W-px}" y2="\${startY}" stroke="#252525" stroke-width="1" stroke-dasharray="5,4"/>
    <path d="\${areaD}" fill="url(#g)"/>
    <polyline points="\${pts}" fill="none" stroke="\${color}" stroke-width="1.8" stroke-linejoin="round"/>
    <circle cx="\${sx(maxT).toFixed(1)}" cy="\${sy(lastV).toFixed(1)}" r="4" fill="\${color}"/>
    <text x="\${px+2}" y="\${Number(startY)-5}" fill="#444" font-size="10" font-family="monospace">$\${startBal.toFixed(0)}</text>
    <text x="\${W-px-2}" y="\${Math.max(py+14,sy(lastV)-6)}" fill="\${color}" font-size="11" font-family="monospace" font-weight="bold" text-anchor="end">$\${lastV.toFixed(2)}</text>
    <text x="\${px+2}" y="\${H-4}" fill="#333" font-size="9">\${t0}</text>
    <text x="\${W-px-2}" y="\${H-4}" fill="#333" font-size="9" text-anchor="end">\${t1}</text>
  </svg>\`;
}

// ── Pagination state ─────────────────────────────────────────────────────────
let _page = 0;
const PER_PAGE = 12;
let _allTrades = [];

function _prevPage() { if(_page>0){_page--;_renderTradePage();} }
function _nextPage() { const pages=Math.ceil(_allTrades.length/PER_PAGE); if(_page<pages-1){_page++;_renderTradePage();} }

function _renderTradePage() {
  const total = _allTrades.length;
  const pages = Math.ceil(total/PER_PAGE);
  const slice = _allTrades.slice(_page*PER_PAGE, (_page+1)*PER_PAGE);

  if (slice.length === 0) {
    document.getElementById('trades-body').innerHTML = '<div class="empty">No completed trades yet</div>';
    document.getElementById('pager').style.display = 'none';
    return;
  }

  document.getElementById('trades-body').innerHTML = \`<table>
    <thead><tr><th>Asset</th><th>Strategy</th><th>Side</th><th>Entry</th><th>Spent</th><th>Payout</th><th>Result</th></tr></thead>
    <tbody>\${slice.map(t => {
      const side   = t.side ? \`<span class="tag \${t.side.toLowerCase()}">\${t.side}</span>\` : '<span style="color:#555">BOTH</span>';
      const result = t.won===true ? '<span class="win">WIN</span>' : t.won===false ? '<span class="loss">LOSS</span>' : '<span class="pending">—</span>';
      const pnl    = (t.payout??0)-(t.totalSpent??0);
      return \`<tr>
        <td style="font-weight:600">\${t.asset??'—'}</td>
        <td>\${stratTag(t)}</td>
        <td>\${side}</td>
        <td>\${t.entryPrice!=null?(t.entryPrice*100).toFixed(1)+'¢':'—'}</td>
        <td>\${fmt(t.totalSpent)}</td>
        <td>\${fmt(t.payout)}</td>
        <td>\${result} <span class="\${pnlCls(pnl)}" style="font-size:12px">\${fmtPnl(pnl)}</span></td>
      </tr>\`;
    }).join('')}</tbody>
  </table>\`;

  const pager = document.getElementById('pager');
  if (pages > 1) {
    pager.style.display = 'flex';
    document.getElementById('pager-info').textContent = \`Page \${_page+1} / \${pages}  (\${total} trades)\`;
    document.getElementById('btn-prev').disabled = _page === 0;
    document.getElementById('btn-next').disabled = _page >= pages-1;
  } else {
    pager.style.display = 'none';
  }
}

// ── Main fetch & render ──────────────────────────────────────────────────────
async function refresh() {
  try {
    const r = await fetch('/api/state');
    if (!r.ok) return;
    const d = await r.json();
    render(d);
    document.getElementById('last-update').innerHTML = '<span class="refresh-dot"></span>updated ' + ago(d.timestamp);
  } catch { document.getElementById('last-update').textContent = 'connection lost'; }
}

function render(d) {
  // ── Header ──
  const mb = document.getElementById('mode-badge');
  mb.textContent = d.mode; mb.className = 'badge '+(d.mode==='LIVE'?'live':'sim');
  const wb = document.getElementById('ws-badge');
  wb.className = 'badge '+(d.wsConnected?'ws-on':'ws-off');
  wb.textContent = d.wsConnected ? '● WS LIVE' : '○ WS OFF';
  document.getElementById('mkts-count').textContent = (d.wsMarkets||0)+' markets';
  document.getElementById('balance').textContent = fmt(d.balance??0);

  const sniperPnl = (d.sniper?.totalPayout??0)-(d.sniper?.totalSpent??0);
  const lemPnl    = (d.lem?.totalPayout??0)-(d.lem?.totalSpent??0);
  const fadePnl   = (d.fade?.totalPayout??0)-(d.fade?.totalSpent??0);
  const arbPnl    = d.arb?.guaranteedProfit??0;
  const totalPnl  = sniperPnl+lemPnl+fadePnl+arbPnl;
  const pnlEl = document.getElementById('pnl-display');
  pnlEl.textContent = 'P&L '+fmtPnl(totalPnl);
  pnlEl.className = pnlCls(totalPnl);

  // ── Prices ──
  const prices=d.prices??{}, moms=d.momentums??{}, assets=d.assets??Object.keys(prices);
  document.getElementById('prices-bar').innerHTML = assets.map(a => {
    const p=prices[a], m=moms[a];
    const mc=m==null?'mom-flat':m>0.0005?'mom-up':m<-0.0005?'mom-dn':'mom-flat';
    return \`<div class="price-item">
      <div class="price-label">\${a}</div>
      <div class="price-value">\${fmtPx(p,a)}</div>
      <div class="price-mom \${mc}">\${fmtPct(m)}</div>
    </div>\`;
  }).join('');

  // ── Cards ──
  const s=d.sniper??{}, l=d.lem??{}, arb=d.arb??{}, sw=d.sweep??{}, fd=d.fade??{};
  const lTotal=l.won+l.lost||0, fTotal=fd.won+fd.lost||0, sTotal=s.won+s.lost||0;
  const lWr=lTotal>0?(l.won/lTotal*100).toFixed(0)+'%':'—';
  const fWr=fTotal>0?(fd.won/fTotal*100).toFixed(0)+'%':'—';
  const sWr=sTotal>0?(s.won/sTotal*100).toFixed(0)+'%':(s.winRate?.(s.winRate*100).toFixed(0)+'%*':'—');
  const wrBar=(w,l)=>{ const t=w+l; if(!t)return ''; const p=(w/t*100).toFixed(0); const c=w/t>0.6?'#22c55e':w/t<0.45?'#ef4444':'#f59e0b'; return \`<div class="card-wr-bar"><div class="card-wr-fill" style="width:\${p}%;background:\${c}"></div></div>\`; };
  document.getElementById('cards').innerHTML = \`
    <div class="card lem-card">
      <div class="card-title">LEM</div>
      <div class="card-main">\${l.entered??0}</div>
      <div class="card-sub">\${l.won??0}W · \${l.lost??0}L · \${lWr}</div>
      \${wrBar(l.won??0,l.lost??0)}
      <div class="card-pnl \${pnlCls(lemPnl)}">\${fmtPnl(lemPnl)}</div>
    </div>
    <div class="card fade-card">
      <div class="card-title">Fade (20-45¢)</div>
      <div class="card-main">\${fd.entered??0}</div>
      <div class="card-sub">\${fd.won??0}W · \${fd.lost??0}L · \${fWr}</div>
      \${wrBar(fd.won??0,fd.lost??0)}
      <div class="card-pnl \${pnlCls(fadePnl)}">\${fmtPnl(fadePnl)}</div>
    </div>
    <div class="card">
      <div class="card-title">ARB</div>
      <div class="card-main">\${arb.entered??0}</div>
      <div class="card-sub">Both filled: \${arb.bothFilled??0}</div>
      <div class="card-wr-bar"></div>
      <div class="card-pnl \${pnlCls(arbPnl)}">\${fmtPnl(arbPnl)}</div>
    </div>
    <div class="card">
      <div class="card-title">Sweep</div>
      <div class="card-main">\${sw.followed??0}</div>
      <div class="card-sub">Follows LEM · P&L in LEM</div>
    </div>
    <div class="card sniper">
      <div class="card-title">Sniper (off)</div>
      <div class="card-main" style="color:#444">\${s.entered??0}</div>
      <div class="card-sub" style="color:#333">\${s.won??0}W · \${s.lost??0}L · \${sWr}</div>
      <div class="card-wr-bar"></div>
      <div class="card-pnl \${pnlCls(sniperPnl)}" style="\${!s.entered?'color:#333':''}">\${fmtPnl(sniperPnl)}</div>
    </div>
  \`;

  // ── P&L Chart ──
  const history = d.pnlHistory ?? [];
  const startBal = d.startBalance ?? 100;
  document.getElementById('chart-body').innerHTML = pnlChart(history, startBal);
  const lastV = history.length ? history[history.length-1].v : startBal;
  const pct = ((lastV-startBal)/startBal*100);
  document.getElementById('chart-meta').textContent =
    history.length >= 2 ? \`\${history.length} points · \${pct>=0?'+':''}\${pct.toFixed(1)}% from start\` : '';

  // ── Active positions ──
  const positions = d.activePositions??[];
  document.getElementById('pos-count').textContent = positions.length;
  if (positions.length===0) {
    document.getElementById('positions-body').innerHTML='<div class="empty">No active positions</div>';
  } else {
    document.getElementById('positions-body').innerHTML=\`<table>
      <thead><tr><th>Asset</th><th>Strategy</th><th>Side</th><th>Entry</th><th>Size</th><th>Status</th><th>Time Left</th></tr></thead>
      <tbody>\${positions.map(p=>{
        const side=p.side?\`<span class="tag \${p.side.toLowerCase()}">\${p.side}</span>\`:'<span style="color:#555">BOTH</span>';
        const status=p.filled?'<span class="win">Filled</span>':'<span class="pending">Pending</span>';
        return \`<tr>
          <td style="font-weight:600">\${p.asset??'—'}</td>
          <td>\${stratTag(p)}</td>
          <td>\${side}</td>
          <td>\${p.entryPrice!=null?(p.entryPrice*100).toFixed(1)+'¢':'—'}</td>
          <td>\${fmt(p.totalSpent)}</td>
          <td>\${status}</td>
          <td class="time-left">\${fmtLeft(p.windowEndMs??p.endMs)}</td>
        </tr>\`;
      }).join('')}</tbody>
    </table>\`;
  }

  // ── Analytics ──
  const an=d.analytics;
  const analSection=document.getElementById('analytics-section');
  if (an && an.resolved>=5) {
    analSection.style.display='';
    document.getElementById('analytics-updated').textContent='updated '+ago(an.lastUpdated);
    document.getElementById('analytics-suggestions').innerHTML=(an.suggestions??[]).length
      ? (an.suggestions).map(s=>{
          const cls=s.includes('strong')||s.includes('prioritize')?'insight':s.includes('declining')||s.includes('avoid')||s.includes('reduce')?'insight bad':'insight warn';
          return \`<div class="\${cls}" style="margin-bottom:6px">💡 \${s}</div>\`;
        }).join('')
      : '<div style="color:#444;font-size:12px">Running...</div>';

    const strats=Object.entries(an.byStrategy??{}).sort((a,b)=>(b[1].pnl??0)-(a[1].pnl??0));
    document.getElementById('tbl-strategy').innerHTML=
      '<thead><tr><th>Strategy</th><th>W/L</th><th>WR%</th><th>P&L</th><th>Avg@</th></tr></thead><tbody>'+
      strats.map(([k,v])=>{
        const wr=v.winRate!=null?(v.winRate*100).toFixed(0)+'%':'—';
        const wrc=v.winRate>0.6?'#22c55e':v.winRate<0.45?'#ef4444':'#f59e0b';
        const pnl=v.pnl>=0?\`<span style="color:#22c55e">+$\${v.pnl.toFixed(2)}</span>\`:\`<span style="color:#ef4444">-$\${Math.abs(v.pnl).toFixed(2)}</span>\`;
        return \`<tr><td>\${k}</td><td>\${v.wins}/\${v.losses}</td><td style="color:\${wrc}">\${wr}</td><td>\${pnl}</td><td>\${v.avgEntry!=null?(v.avgEntry*100).toFixed(0)+'¢':'—'}</td></tr>\`;
      }).join('')+'</tbody>';

    const assetRows=Object.entries(an.byAsset??{}).sort((a,b)=>(b[1].pnl??0)-(a[1].pnl??0));
    document.getElementById('tbl-asset').innerHTML=
      '<thead><tr><th>Asset</th><th>W/L</th><th>WR%</th><th>P&L</th></tr></thead><tbody>'+
      assetRows.map(([k,v])=>{
        const wr=v.winRate!=null?(v.winRate*100).toFixed(0)+'%':'—';
        const wrc=v.winRate>0.6?'#22c55e':v.winRate<0.45?'#ef4444':'#f59e0b';
        const pnl=v.pnl>=0?\`<span style="color:#22c55e">+$\${v.pnl.toFixed(2)}</span>\`:\`<span style="color:#ef4444">-$\${Math.abs(v.pnl).toFixed(2)}</span>\`;
        return \`<tr><td>\${k}</td><td>\${v.wins}/\${v.losses}</td><td style="color:\${wrc}">\${wr}</td><td>\${pnl}</td></tr>\`;
      }).join('')+'</tbody>';

    document.getElementById('tbl-price').innerHTML=
      '<thead><tr><th>Range</th><th>W/L</th><th>WR%</th></tr></thead><tbody>'+
      Object.entries(an.priceBuckets??{}).map(([k,v])=>{
        const wr=v.winRate!=null?(v.winRate*100).toFixed(0)+'%':'—';
        const wrc=v.winRate>0.65?'#22c55e':v.winRate<0.45?'#ef4444':'#f59e0b';
        return \`<tr><td>\${k}</td><td>\${v.wins}/\${v.losses}</td><td style="color:\${wrc}">\${wr}</td></tr>\`;
      }).join('')+'</tbody>';

    const adaptive=Object.entries(d.adaptive??{}).sort((a,b)=>b[1].trades-a[1].trades);
    document.getElementById('tbl-adaptive').innerHTML=adaptive.length
      ?'<thead><tr><th>Asset:Strategy</th><th>WR%</th><th>Mult</th></tr></thead><tbody>'+
        adaptive.map(([k,v])=>{
          const wrc=v.winRate>0.6?'#22c55e':v.winRate<0.45?'#ef4444':'#f59e0b';
          const mc=v.multiplier>1.0?'#22c55e':v.multiplier<1.0?'#ef4444':'#888';
          return \`<tr><td>\${k}</td><td style="color:\${wrc}">\${(v.winRate*100).toFixed(0)}%</td><td style="color:\${mc}">\${v.multiplier.toFixed(2)}x</td></tr>\`;
        }).join('')+'</tbody>'
      :'<tr><td colspan="3" style="color:#444;text-align:center;padding:10px">No data yet</td></tr>';
  }

  // ── Recent trades ──
  _allTrades = d.recentTrades ?? [];
  document.getElementById('trades-count').textContent = _allTrades.length;
  _renderTradePage();

  // ── WS debug ──
  const wsSample=d.wsSample??[];
  const wsEl=document.getElementById('ws-debug-body');
  if (!wsSample.length) { wsEl.innerHTML='<div class="empty">No markets loaded yet</div>'; return; }
  const nulls=wsSample.filter(r=>r.up==null&&r.dn==null).length;
  const rows=wsSample.map(r=>{
    const comb=r.up!=null&&r.dn!=null?(r.up+r.dn).toFixed(3):'—';
    const combClr=(r.up!=null&&r.dn!=null&&r.up+r.dn<0.99)?'color:#22c55e;font-weight:600':'color:#555';
    const upClr=r.up!=null&&r.up<0.48&&r.up>=0.20?'color:#22c55e;font-weight:600':'';
    const dnClr=r.dn!=null&&r.dn<0.48&&r.dn>=0.20?'color:#22c55e;font-weight:600':'';
    const left=r.endMs?Math.max(0,Math.round((r.endMs-Date.now())/1000))+'s':'—';
    return \`<tr><td style="font-weight:600">\${r.asset}</td>
      <td style="\${upClr}">\${r.up!=null?(r.up*100).toFixed(1)+'¢':'<span style="color:#333">null</span>'}</td>
      <td style="\${dnClr}">\${r.dn!=null?(r.dn*100).toFixed(1)+'¢':'<span style="color:#333">null</span>'}</td>
      <td style="\${combClr}">\${comb}</td>
      <td class="time-left">\${left}</td></tr>\`;
  }).join('');
  const banner=nulls===wsSample.length
    ?'<div style="padding:8px 14px;color:#ef4444;font-size:12px">⚠ All prices null</div>'
    :nulls>0
    ?\`<div style="padding:8px 14px;color:#f59e0b;font-size:12px">⚠ \${nulls}/\${wsSample.length} null</div>\`
    :\`<div style="padding:8px 14px;color:#22c55e;font-size:12px">✓ All \${wsSample.length} markets live</div>\`;
  wsEl.innerHTML=banner+\`<table><thead><tr><th>Asset</th><th>UP</th><th>DOWN</th><th>Combined</th><th>Expires</th></tr></thead><tbody>\${rows}</tbody></table>\`;
}

refresh();
setInterval(refresh, 2000);
</script>
</body>
</html>`;
