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
  .last-update{margin-left:8px;font-size:11px;color:#444}

  .main{padding:16px 20px;display:grid;gap:14px}
  .prices-bar{background:#111;border:1px solid #1e1e1e;border-radius:10px;padding:12px 16px;display:flex;gap:20px;flex-wrap:wrap;align-items:center}
  .price-item{display:flex;flex-direction:column;align-items:center;gap:2px;min-width:60px}
  .price-label{font-size:10px;color:#666;font-weight:600;letter-spacing:.5px}
  .price-value{font-size:13px;font-weight:600;color:#e0e0e0}
  .price-mom{font-size:10px}
  .mom-up{color:#22c55e}.mom-dn{color:#ef4444}.mom-flat{color:#555}

  .cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px}
  .card{background:#111;border:1px solid #1e1e1e;border-radius:10px;padding:14px 16px}
  .card-title{font-size:10px;color:#666;font-weight:600;letter-spacing:.8px;text-transform:uppercase;margin-bottom:10px}
  .card-main{font-size:24px;font-weight:700;color:#fff;margin-bottom:4px}
  .card-sub{font-size:12px;color:#555}
  .card-pnl{font-size:13px;font-weight:600;margin-top:6px}
  .card.sniper{border-color:#7c3aed44}
  .card.sniper .card-title{color:#7c3aed}

  .section{background:#111;border:1px solid #1e1e1e;border-radius:10px;overflow:hidden}
  .section-header{padding:10px 16px;background:#161616;border-bottom:1px solid #1e1e1e;font-size:11px;font-weight:600;color:#888;letter-spacing:.6px;text-transform:uppercase;display:flex;align-items:center;justify-content:space-between}
  .section-count{background:#222;color:#aaa;padding:2px 8px;border-radius:10px;font-size:11px}

  table{width:100%;border-collapse:collapse}
  th{padding:8px 14px;text-align:left;font-size:10px;color:#555;font-weight:600;letter-spacing:.5px;border-bottom:1px solid #1e1e1e}
  td{padding:9px 14px;border-bottom:1px solid #181818;font-size:13px;vertical-align:middle}
  tr:last-child td{border-bottom:none}
  tr:hover td{background:#161616}
  .empty{padding:20px;text-align:center;color:#444;font-size:13px}

  .tag{display:inline-block;padding:2px 8px;border-radius:4px;font-size:10px;font-weight:600;letter-spacing:.3px}
  .tag.snipe{background:#3b0764;color:#a855f7}
  .tag.lem{background:#0c2a40;color:#38bdf8}
  .tag.arb{background:#0a2000;color:#4ade80}
  .tag.sweep{background:#2a1000;color:#fb923c}
  .tag.up{background:#0a2000;color:#4ade80}
  .tag.down{background:#2a0000;color:#f87171}
  .win{color:#22c55e;font-weight:600}
  .loss{color:#ef4444;font-weight:600}
  .pending{color:#f59e0b}
  .time-left{color:#888;font-size:12px}

  .refresh-dot{width:7px;height:7px;background:#22c55e;border-radius:50%;display:inline-block;margin-right:5px;animation:pulse 2s infinite}
  @keyframes pulse{0%,100%{opacity:1}50%{opacity:.3}}
  @media(max-width:600px){.header{padding:10px 14px}.main{padding:10px 14px}.balance{font-size:18px}}
</style>
</head>
<body>
<div class="header">
  <h1>Poly Arb Bot</h1>
  <span id="mode-badge" class="badge sim">SIM</span>
  <span id="ws-badge" class="badge ws-off">WS</span>
  <span id="mkts-count" style="color:#555;font-size:12px"></span>
  <div class="balance"><span>Balance</span><span id="balance">—</span></div>
  <div id="pnl-display" style="font-size:13px;color:#555"></div>
  <span id="last-update" class="last-update"><span class="refresh-dot"></span>connecting...</span>
</div>

<div class="main">
  <div class="prices-bar" id="prices-bar"></div>

  <div class="cards" id="cards"></div>

  <div class="section">
    <div class="section-header">
      Active Positions
      <span id="pos-count" class="section-count">0</span>
    </div>
    <div id="positions-body">
      <div class="empty">No active positions</div>
    </div>
  </div>

  <div class="section">
    <div class="section-header">Recent Trades</div>
    <div id="trades-body">
      <div class="empty">No completed trades yet</div>
    </div>
  </div>
</div>

<script>
const fmt = (n, d=2) => n == null ? '—' : '$' + Number(n).toFixed(d);
const fmtPx = (p, a) => {
  if (p == null) return '—';
  if (a === 'BTC' || p >= 1000) return '$' + (p/1000).toFixed(1) + 'k';
  if (p >= 1) return '$' + p.toFixed(2);
  return '$' + p.toFixed(4);
};
const pnlClass = (v) => v > 0.005 ? 'pnl-pos' : v < -0.005 ? 'pnl-neg' : 'pnl-zero';
const fmtPnl = (v) => (v >= 0 ? '+' : '') + fmt(v);
const fmtPct = (v) => v == null ? '—' : (v >= 0 ? '+' : '') + (v * 100).toFixed(2) + '%';
const ago = (ms) => {
  if (!ms) return '—';
  const s = Math.round((Date.now() - ms) / 1000);
  if (s < 60) return s + 's ago';
  return Math.round(s/60) + 'm ago';
};
const fmtLeft = (ms) => {
  if (!ms) return '—';
  const s = Math.max(0, Math.round((ms - Date.now()) / 1000));
  if (s < 60) return s + 's';
  return Math.floor(s/60) + 'm' + (s%60 ? (s%60)+'s' : '');
};

async function refresh() {
  try {
    const r = await fetch('/api/state');
    if (!r.ok) return;
    const d = await r.json();
    render(d);
    document.getElementById('last-update').innerHTML = '<span class="refresh-dot"></span>updated ' + ago(d.timestamp);
  } catch(e) {
    document.getElementById('last-update').textContent = 'connection lost';
  }
}

function render(d) {
  // Header
  const modeBadge = document.getElementById('mode-badge');
  modeBadge.textContent = d.mode;
  modeBadge.className = 'badge ' + (d.mode === 'LIVE' ? 'live' : 'sim');

  const wsBadge = document.getElementById('ws-badge');
  wsBadge.className = 'badge ' + (d.wsConnected ? 'ws-on' : 'ws-off');
  wsBadge.textContent = d.wsConnected ? '● WS LIVE' : '○ WS OFF';
  document.getElementById('mkts-count').textContent = (d.wsMarkets || 0) + ' markets';

  const bal = d.balance ?? 0;
  document.getElementById('balance').textContent = fmt(bal);

  const sniperPnl = (d.sniper?.totalPayout ?? 0) - (d.sniper?.totalSpent ?? 0);
  const lemPnl    = (d.lem?.totalPayout ?? 0) - (d.lem?.totalSpent ?? 0);
  const totalPnl  = sniperPnl + lemPnl;
  const pnlEl = document.getElementById('pnl-display');
  pnlEl.textContent = 'P&L ' + fmtPnl(totalPnl);
  pnlEl.className = pnlClass(totalPnl);

  // Prices
  const prices = d.prices ?? {};
  const moms = d.momentums ?? {};
  const assets = d.assets ?? Object.keys(prices);
  document.getElementById('prices-bar').innerHTML = assets.map(a => {
    const p = prices[a]; const m = moms[a];
    const mc = m == null ? 'mom-flat' : m > 0.0005 ? 'mom-up' : m < -0.0005 ? 'mom-dn' : 'mom-flat';
    return \`<div class="price-item">
      <div class="price-label">\${a}</div>
      <div class="price-value">\${fmtPx(p,a)}</div>
      <div class="price-mom \${mc}">\${fmtPct(m)}</div>
    </div>\`;
  }).join('');

  // Strategy cards
  const s = d.sniper ?? {}, l = d.lem ?? {}, arb = d.arb ?? {}, sw = d.sweep ?? {};
  const sWr = s.tradeCount > 0 ? ((s.won/(s.won+s.lost||1))*100).toFixed(1)+'%' : (s.winRate*100).toFixed(1)+'%*';
  const lWr = (l.won + l.lost) > 0 ? ((l.won/(l.won+l.lost))*100).toFixed(1)+'%' : '—';
  document.getElementById('cards').innerHTML = \`
    <div class="card sniper">
      <div class="card-title">Sniper</div>
      <div class="card-main">\${s.entered ?? 0}</div>
      <div class="card-sub">\${s.won ?? 0}W / \${s.lost ?? 0}L · WR \${sWr}</div>
      <div class="card-pnl \${pnlClass(sniperPnl)}">\${fmtPnl(sniperPnl)}</div>
    </div>
    <div class="card">
      <div class="card-title">LEM</div>
      <div class="card-main">\${l.entered ?? 0}</div>
      <div class="card-sub">\${l.won ?? 0}W / \${l.lost ?? 0}L · WR \${lWr}</div>
      <div class="card-pnl \${pnlClass(lemPnl)}">\${fmtPnl(lemPnl)}</div>
    </div>
    <div class="card">
      <div class="card-title">ARB</div>
      <div class="card-main">\${arb.entered ?? 0}</div>
      <div class="card-sub">Both filled: \${arb.bothFilled ?? 0}</div>
    </div>
    <div class="card">
      <div class="card-title">Sweep Follow</div>
      <div class="card-main">\${sw.followed ?? 0}</div>
      <div class="card-sub">Order-book momentum</div>
    </div>
  \`;

  // Active positions
  const positions = d.activePositions ?? [];
  document.getElementById('pos-count').textContent = positions.length;
  if (positions.length === 0) {
    document.getElementById('positions-body').innerHTML = '<div class="empty">No active positions</div>';
  } else {
    document.getElementById('positions-body').innerHTML = \`<table>
      <thead><tr><th>Asset</th><th>Type</th><th>Side</th><th>Entry</th><th>Size</th><th>Status</th><th>Time Left</th></tr></thead>
      <tbody>\${positions.map(p => {
        const type = p.sniper ? '<span class="tag snipe">SNIPE</span>' : p.type === 'directional' ? '<span class="tag lem">LEM</span>' : '<span class="tag arb">ARB</span>';
        const side = p.side ? \`<span class="tag \${p.side?.toLowerCase()}">\${p.side}</span>\` : '<span style="color:#555">BOTH</span>';
        const status = p.filled ? '<span class="win">Filled</span>' : '<span class="pending">Pending</span>';
        return \`<tr>
          <td style="font-weight:600">\${p.asset ?? '—'}</td>
          <td>\${type}</td>
          <td>\${side}</td>
          <td>\${p.entryPrice != null ? (p.entryPrice*100).toFixed(1)+'¢' : '—'}</td>
          <td>\${fmt(p.totalSpent)}</td>
          <td>\${status}</td>
          <td class="time-left">\${fmtLeft(p.windowEndMs ?? p.endMs)}</td>
        </tr>\`;
      }).join('')}</tbody>
    </table>\`;
  }

  // Recent trades
  const trades = d.recentTrades ?? [];
  if (trades.length === 0) {
    document.getElementById('trades-body').innerHTML = '<div class="empty">No completed trades yet</div>';
  } else {
    document.getElementById('trades-body').innerHTML = \`<table>
      <thead><tr><th>Asset</th><th>Strategy</th><th>Side</th><th>Entry</th><th>Spent</th><th>Payout</th><th>Result</th></tr></thead>
      <tbody>\${trades.map(t => {
        const strat = t.strategy === 'SNIPER' ? '<span class="tag snipe">SNIPE</span>'
          : t.strategy?.includes('LEM') ? '<span class="tag lem">LEM</span>'
          : '<span class="tag arb">ARB</span>';
        const side = t.side ? \`<span class="tag \${t.side?.toLowerCase()}">\${t.side}</span>\` : '—';
        const result = t.won === true ? '<span class="win">WIN</span>' : t.won === false ? '<span class="loss">LOSS</span>' : '<span class="pending">—</span>';
        const pnl = (t.payout ?? 0) - (t.totalSpent ?? 0);
        return \`<tr>
          <td style="font-weight:600">\${t.asset ?? '—'}</td>
          <td>\${strat}</td>
          <td>\${side}</td>
          <td>\${t.entryPrice != null ? (t.entryPrice*100).toFixed(1)+'¢' : '—'}</td>
          <td>\${fmt(t.totalSpent)}</td>
          <td>\${fmt(t.payout)}</td>
          <td>\${result} <span class="\${pnlClass(pnl)}" style="font-size:12px">\${fmtPnl(pnl)}</span></td>
        </tr>\`;
      }).join('')}</tbody>
    </table>\`;
  }
}

refresh();
setInterval(refresh, 2000);
</script>
</body>
</html>`;
