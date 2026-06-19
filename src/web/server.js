import http from "http";

export function startWebServer(getState, port = 3000) {
  const server = http.createServer((req, res) => {
    if (req.url === "/api/state") {
      res.writeHead(200, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Cache-Control": "no-cache" });
      try { res.end(JSON.stringify(getState())); }
      catch (e) { res.end(JSON.stringify({ error: e.message })); }
      return;
    }
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(HTML);
  });
  server.listen(port, "0.0.0.0", () => console.error(`[web] Dashboard → http://0.0.0.0:${port}`));
  return server;
}

const HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Poly Arb Bot</title>
<style>
:root {
  --bg:       #F0F4F8;
  --surface:  #FFFFFF;
  --surface2: #F8FAFC;
  --border:   #E2E8F0;
  --border2:  #CBD5E1;
  --text1:    #0F172A;
  --text2:    #475569;
  --text3:    #94A3B8;
  --blue:     #2563EB;
  --blue-dk:  #1D4ED8;
  --blue-lt:  #EFF6FF;
  --blue-mid: #BFDBFE;
  --green:    #059669;
  --green-lt: #ECFDF5;
  --red:      #DC2626;
  --red-lt:   #FEF2F2;
  --amber:    #D97706;
  --amber-lt: #FFFBEB;
  --purple:   #7C3AED;
  --purple-lt:#F5F3FF;
  --sky:      #0EA5E9;
  --sky-lt:   #F0F9FF;
  --shadow:   0 1px 3px rgba(0,0,0,.08), 0 1px 2px rgba(0,0,0,.05);
  --shadow-md:0 4px 6px rgba(0,0,0,.07), 0 2px 4px rgba(0,0,0,.05);
  --r:        10px;
}
*{box-sizing:border-box;margin:0;padding:0}
body{background:var(--bg);color:var(--text1);font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Inter',sans-serif;font-size:14px;min-height:100vh}

/* ── Header ─────────────────────────────────────────── */
.header{background:var(--surface);border-bottom:1px solid var(--border);padding:0 24px;height:60px;display:flex;align-items:center;gap:16px;position:sticky;top:0;z-index:100;box-shadow:var(--shadow)}
.header-logo{font-size:15px;font-weight:700;color:var(--text1);letter-spacing:-.3px;display:flex;align-items:center;gap:8px}
.header-logo-dot{width:8px;height:8px;background:var(--blue);border-radius:50%}
.header-divider{width:1px;height:20px;background:var(--border)}
.badge{display:inline-flex;align-items:center;gap:5px;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:600;letter-spacing:.3px}
.badge-sim{background:var(--amber-lt);color:var(--amber);border:1px solid #FDE68A}
.badge-live{background:var(--green-lt);color:var(--green);border:1px solid #A7F3D0}
.badge-ws-on{background:var(--green-lt);color:var(--green);border:1px solid #A7F3D0}
.badge-ws-off{background:var(--red-lt);color:var(--red);border:1px solid #FCA5A5}
.badge-dot{width:6px;height:6px;border-radius:50%;background:currentColor}
.header-mkts{font-size:12px;color:var(--text3);font-weight:500}
.header-right{margin-left:auto;display:flex;align-items:center;gap:20px}
.header-balance{text-align:right}
.header-balance-label{font-size:11px;color:var(--text3);font-weight:500;letter-spacing:.3px;text-transform:uppercase}
.header-balance-value{font-size:22px;font-weight:700;color:var(--text1);letter-spacing:-.5px;line-height:1.1}
.header-pnl{font-size:13px;font-weight:600}
.pnl-pos{color:var(--green)}.pnl-neg{color:var(--red)}.pnl-zero{color:var(--text3)}
.refresh-dot{width:6px;height:6px;background:var(--green);border-radius:50%;display:inline-block;animation:pulse 2s infinite}
@keyframes pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.5;transform:scale(.8)}}
.header-time{font-size:11px;color:var(--text3)}

/* ── Layout ──────────────────────────────────────────── */
.main{padding:20px 24px;display:grid;gap:16px;max-width:1400px;margin:0 auto}

/* ── Price bar ───────────────────────────────────────── */
.price-bar{background:var(--surface);border:1px solid var(--border);border-radius:var(--r);padding:12px 20px;display:flex;gap:0;align-items:center;box-shadow:var(--shadow);overflow-x:auto}
.price-item{display:flex;flex-direction:column;align-items:center;gap:3px;padding:6px 20px;border-right:1px solid var(--border);min-width:90px}
.price-item:last-child{border-right:none}
.price-label{font-size:10px;color:var(--text3);font-weight:600;letter-spacing:.8px;text-transform:uppercase}
.price-value{font-size:15px;font-weight:700;color:var(--text1);font-variant-numeric:tabular-nums}
.price-mom{font-size:11px;font-weight:600}
.mom-up{color:var(--green)}.mom-dn{color:var(--red)}.mom-flat{color:var(--text3)}

/* ── Cards ───────────────────────────────────────────── */
.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:14px}
.card{background:var(--surface);border:1px solid var(--border);border-radius:var(--r);padding:18px 20px;box-shadow:var(--shadow);position:relative;overflow:hidden;transition:box-shadow .15s}
.card:hover{box-shadow:var(--shadow-md)}
.card::before{content:'';position:absolute;top:0;left:0;right:0;height:3px;border-radius:var(--r) var(--r) 0 0}
.card-lem::before{background:var(--blue)}
.card-fade::before{background:var(--sky)}
.card-arb::before{background:var(--green)}
.card-sweep::before{background:var(--amber)}
.card-sniper::before{background:var(--purple)}
.card-label{font-size:10px;color:var(--text3);font-weight:600;letter-spacing:.8px;text-transform:uppercase;margin-bottom:10px}
.card-value{font-size:30px;font-weight:700;color:var(--text1);line-height:1;letter-spacing:-1px}
.card-sub{font-size:11px;color:var(--text3);margin-top:6px;font-weight:500}
.card-wr{margin-top:10px;height:4px;border-radius:2px;background:var(--border);overflow:hidden}
.card-wr-fill{height:100%;border-radius:2px;transition:width .5s}
.card-pnl{font-size:13px;font-weight:700;margin-top:8px}
.card-disabled .card-value{color:var(--border2)}
.card-disabled .card-label{color:var(--border2)}

/* ── Stats row ───────────────────────────────────────── */
.stats-row{background:var(--surface);border:1px solid var(--border);border-radius:var(--r);padding:14px 20px;display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:0;box-shadow:var(--shadow)}
.stat-item{display:flex;flex-direction:column;gap:4px;padding:4px 16px;border-right:1px solid var(--border)}
.stat-item:first-child{padding-left:0}
.stat-item:last-child{border-right:none}
.stat-label{font-size:10px;color:var(--text3);font-weight:600;letter-spacing:.6px;text-transform:uppercase}
.stat-value{font-size:18px;font-weight:700;color:var(--text1);font-variant-numeric:tabular-nums;letter-spacing:-.5px}

/* ── Chart ───────────────────────────────────────────── */
.chart-card{background:var(--surface);border:1px solid var(--border);border-radius:var(--r);box-shadow:var(--shadow);overflow:hidden}
.chart-header{padding:14px 20px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid var(--border)}
.chart-title{font-size:12px;font-weight:600;color:var(--text2);letter-spacing:.4px;text-transform:uppercase}
.chart-meta{font-size:12px;color:var(--text3)}
.chart-body{position:relative;padding:4px 0 0}
.chart-tooltip{position:absolute;background:var(--text1);border-radius:8px;padding:8px 12px;font-size:11px;color:#fff;pointer-events:none;display:none;white-space:nowrap;z-index:10;box-shadow:var(--shadow-md)}
.chart-tooltip-date{color:#94A3B8;font-size:10px;margin-bottom:3px}
.chart-tooltip-val{font-weight:700;font-size:14px}

/* ── Sections ────────────────────────────────────────── */
.section{background:var(--surface);border:1px solid var(--border);border-radius:var(--r);box-shadow:var(--shadow);overflow:hidden}
.section-header{padding:13px 20px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;background:var(--surface)}
.section-title{font-size:12px;font-weight:600;color:var(--text2);letter-spacing:.4px;text-transform:uppercase}
.section-count{background:var(--blue-lt);color:var(--blue);padding:2px 9px;border-radius:20px;font-size:11px;font-weight:600}

/* ── Tables ──────────────────────────────────────────── */
table{width:100%;border-collapse:collapse}
thead{background:var(--surface2)}
th{padding:9px 16px;text-align:left;font-size:10px;color:var(--text3);font-weight:600;letter-spacing:.6px;text-transform:uppercase;border-bottom:1px solid var(--border);white-space:nowrap}
td{padding:11px 16px;border-bottom:1px solid var(--border);font-size:13px;color:var(--text1);vertical-align:middle}
tbody tr:last-child td{border-bottom:none}
tbody tr:hover td{background:var(--surface2)}
.empty{padding:32px;text-align:center;color:var(--text3);font-size:13px}

/* ── Tags ────────────────────────────────────────────── */
.tag{display:inline-flex;align-items:center;padding:2px 9px;border-radius:20px;font-size:10px;font-weight:700;letter-spacing:.4px;text-transform:uppercase}
.tag-lem   {background:var(--blue-lt);color:var(--blue)}
.tag-fade  {background:var(--sky-lt);color:var(--sky)}
.tag-snipe {background:var(--purple-lt);color:var(--purple)}
.tag-arb   {background:var(--green-lt);color:var(--green)}
.tag-sweep {background:var(--amber-lt);color:var(--amber)}
.tag-up    {background:var(--green-lt);color:var(--green)}
.tag-down  {background:var(--red-lt);color:var(--red)}

/* ── Result badges ───────────────────────────────────── */
.badge-win {display:inline-flex;align-items:center;gap:4px;padding:3px 9px;border-radius:20px;font-size:10px;font-weight:700;background:var(--green-lt);color:var(--green)}
.badge-loss{display:inline-flex;align-items:center;gap:4px;padding:3px 9px;border-radius:20px;font-size:10px;font-weight:700;background:var(--red-lt);color:var(--red)}
.badge-pend{display:inline-flex;align-items:center;gap:4px;padding:3px 9px;border-radius:20px;font-size:10px;font-weight:700;background:var(--amber-lt);color:var(--amber)}
.status-filled{color:var(--green);font-weight:600;font-size:12px}
.status-pending{color:var(--amber);font-weight:600;font-size:12px}

/* ── Pagination ──────────────────────────────────────── */
.pager{padding:12px 20px;display:flex;align-items:center;gap:10px;justify-content:flex-end;border-top:1px solid var(--border);background:var(--surface2)}
.pager-btn{background:var(--surface);border:1px solid var(--border);color:var(--text2);padding:5px 14px;border-radius:7px;cursor:pointer;font-size:12px;font-weight:500;transition:all .15s}
.pager-btn:hover:not(:disabled){background:var(--blue);border-color:var(--blue);color:#fff}
.pager-btn:disabled{opacity:.4;cursor:default}
.pager-info{font-size:12px;color:var(--text3)}

/* ── Analytics ───────────────────────────────────────── */
.analytics-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:16px;padding:16px 20px}
.analytics-table-title{font-size:10px;color:var(--text3);font-weight:600;letter-spacing:.6px;text-transform:uppercase;margin-bottom:8px}
.mini-table{width:100%;border-collapse:collapse;font-size:12px;border:1px solid var(--border);border-radius:8px;overflow:hidden}
.mini-table th{padding:7px 12px;background:var(--surface2);text-align:left;color:var(--text3);font-size:10px;font-weight:600;letter-spacing:.4px;border-bottom:1px solid var(--border)}
.mini-table td{padding:7px 12px;border-bottom:1px solid var(--border);color:var(--text2)}
.mini-table tr:last-child td{border-bottom:none}
.insight{padding:10px 14px;border-radius:8px;font-size:12px;margin-bottom:8px;font-weight:500}
.insight-good{background:var(--green-lt);color:var(--green);border:1px solid #A7F3D0}
.insight-warn{background:var(--amber-lt);color:var(--amber);border:1px solid #FDE68A}
.insight-bad{background:var(--red-lt);color:var(--red);border:1px solid #FCA5A5}

/* ── WS Debug collapsed ──────────────────────────────── */
details summary{padding:13px 20px;font-size:12px;font-weight:600;color:var(--text3);letter-spacing:.4px;text-transform:uppercase;cursor:pointer;list-style:none;display:flex;align-items:center;gap:8px;border-bottom:1px solid transparent;user-select:none}
details[open] summary{border-bottom-color:var(--border)}
details summary::-webkit-details-marker{display:none}
details summary::before{content:'▶';font-size:8px;transition:transform .2s;color:var(--text3)}
details[open] summary::before{transform:rotate(90deg)}

/* ── Mobile ──────────────────────────────────────────── */
@media(max-width:700px){
  .main{padding:12px 14px}
  .header{padding:0 14px;height:54px}
  .header-balance-value{font-size:18px}
  .cards{grid-template-columns:repeat(2,1fr);gap:10px}
  .card{padding:14px 16px}
  .card-value{font-size:24px}
  td,th{padding:9px 12px}
  .price-item{padding:4px 12px;min-width:70px}
  .stats-row{grid-template-columns:repeat(2,1fr)}
  .stat-item{border-right:none;border-bottom:1px solid var(--border);padding:8px 0}
  .stat-item:last-child,.stat-item:nth-last-child(2){border-bottom:none}
}
</style>
</head>
<body>

<!-- Header -->
<div class="header">
  <div class="header-logo">
    <div class="header-logo-dot"></div>
    Poly Arb Bot
  </div>
  <div class="header-divider"></div>
  <span id="mode-badge" class="badge badge-sim">SIM</span>
  <span id="ws-badge" class="badge badge-ws-off"><span class="badge-dot"></span>WS</span>
  <span id="mkts-count" class="header-mkts"></span>
  <div class="header-right">
    <div class="header-pnl" id="pnl-display"></div>
    <div class="header-balance">
      <div class="header-balance-label">Balance</div>
      <div class="header-balance-value" id="balance">—</div>
    </div>
    <div class="header-divider"></div>
    <span class="header-time" id="last-update"><span class="refresh-dot"></span> connecting</span>
  </div>
</div>

<div class="main">

  <!-- Price bar -->
  <div class="price-bar" id="prices-bar"></div>

  <!-- Strategy cards -->
  <div class="cards" id="cards"></div>

  <!-- Summary stats row -->
  <div class="stats-row" id="stats-row"></div>

  <!-- P&L Chart -->
  <div class="chart-card">
    <div class="chart-header">
      <span class="chart-title">Balance Over Time</span>
      <span class="chart-meta" id="chart-meta"></span>
    </div>
    <div class="chart-body">
      <canvas id="pnl-canvas" style="width:100%;display:block;cursor:crosshair"></canvas>
      <div class="chart-tooltip" id="chart-tip">
        <div class="chart-tooltip-date" id="tip-date"></div>
        <div class="chart-tooltip-val" id="tip-val"></div>
      </div>
    </div>
  </div>

  <!-- Active positions -->
  <div class="section">
    <div class="section-header">
      <span class="section-title">Active Positions</span>
      <span id="pos-count" class="section-count">0</span>
    </div>
    <div id="positions-body"><div class="empty">No active positions</div></div>
  </div>

  <!-- Analytics -->
  <div class="section" id="analytics-section" style="display:none">
    <div class="section-header">
      <span class="section-title">Analytics & Insights</span>
      <span id="analytics-updated" style="font-size:11px;color:var(--text3)"></span>
    </div>
    <div id="analytics-suggestions" style="padding:16px 20px 0"></div>
    <div class="analytics-grid">
      <div><div class="analytics-table-title">By Strategy</div><table class="mini-table" id="tbl-strategy"></table></div>
      <div><div class="analytics-table-title">By Asset</div><table class="mini-table" id="tbl-asset"></table></div>
      <div><div class="analytics-table-title">By Entry Price</div><table class="mini-table" id="tbl-price"></table></div>
      <div><div class="analytics-table-title">Adaptive Sizing</div><table class="mini-table" id="tbl-adaptive"></table></div>
    </div>
  </div>

  <!-- Recent trades -->
  <div class="section">
    <div class="section-header">
      <span class="section-title">Trade History</span>
      <span id="trades-count" class="section-count">0</span>
    </div>
    <div id="trades-body"><div class="empty">No completed trades yet</div></div>
    <div class="pager" id="pager" style="display:none">
      <button class="pager-btn" onclick="_prevPage()" id="btn-prev">← Previous</button>
      <span class="pager-info" id="pager-info"></span>
      <button class="pager-btn" onclick="_nextPage()" id="btn-next">Next →</button>
    </div>
  </div>

  <!-- WS debug collapsed -->
  <div class="section">
    <details>
      <summary>Live WS Token Prices <span style="font-size:10px;color:var(--text3);font-weight:400;margin-left:6px">debug — click to expand</span></summary>
      <div id="ws-debug-body"><div class="empty">Waiting for data...</div></div>
    </details>
  </div>

</div>

<script>
// ── Formatters ──────────────────────────────────────────────────────────────
const fmt    = (n,d=2) => n==null?'—':'$'+Number(n).toFixed(d);
const fmtPx  = (p,a) => { if(p==null) return '—'; if(a==='BTC'||p>=1000) return '$'+(p/1000).toFixed(1)+'k'; if(p>=1) return '$'+p.toFixed(2); return '$'+p.toFixed(4); };
const pnlCls = v => v>0.005?'pnl-pos':v<-0.005?'pnl-neg':'pnl-zero';
const fmtPnl = v => (v>=0?'+':'')+fmt(v);
const fmtPct = v => v==null?'—':(v>=0?'+':'')+(v*100).toFixed(2)+'%';
const ago    = ms => { if(!ms) return '—'; const s=Math.round((Date.now()-ms)/1000); return s<60?s+'s ago':s<3600?Math.round(s/60)+'m ago':Math.round(s/3600)+'h ago'; };
const fmtLeft= ms => { if(!ms) return '—'; const s=Math.max(0,Math.round((ms-Date.now())/1000)); return s<60?s+'s':Math.floor(s/60)+'m'+(s%60?(s%60)+'s':''); };
const fmtDate= ms => ms?new Date(ms).toLocaleString([],{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}):'—';

function stratTag(t) {
  if(!t) return '';
  const st=t.strategy??'';
  if(st==='SNIPER') return '<span class="tag tag-snipe">Snipe</span>';
  if(st==='FADE')   return '<span class="tag tag-fade">Fade</span>';
  if(st.includes('LEM')) return '<span class="tag tag-lem">LEM</span>';
  if(t.type==='directional') return '<span class="tag tag-lem">LEM</span>';
  if(t.upFilled!=null||t.downFilled!=null) return '<span class="tag tag-arb">ARB</span>';
  return '<span class="tag tag-lem">LEM</span>';
}

// ── Canvas Chart ──────────────────────────────────────────────────────────────
let _chartData=[], _chartStart=100;

function drawChart(hoverRatio) {
  const canvas=document.getElementById('pnl-canvas');
  if(!canvas) return;
  const data=_chartData, startBal=_chartStart;
  const dpr=window.devicePixelRatio||1;
  const W=canvas.offsetWidth, H=180;
  canvas.width=W*dpr; canvas.height=H*dpr;
  canvas.style.height=H+'px';
  const ctx=canvas.getContext('2d');
  ctx.scale(dpr,dpr);

  const PL=60,PR=16,PT=16,PB=28, iw=W-PL-PR, ih=H-PT-PB;

  if(!data||data.length<2){
    ctx.fillStyle='#94A3B8'; ctx.font='13px sans-serif'; ctx.textAlign='center';
    ctx.fillText('Collecting data — need more trades...',W/2,H/2); return;
  }

  const vals=data.map(d=>d.v), times=data.map(d=>d.t);
  const minV=Math.min(startBal*0.92,...vals)-1;
  const maxV=Math.max(startBal*1.08,...vals)+1;
  const minT=times[0], maxT=times[times.length-1];
  const rv=maxV-minV||1, rt=maxT-minT||1;
  const sx=t=>PL+((t-minT)/rt)*iw;
  const sy=v=>PT+ih-((v-minV)/rv)*ih;
  const lastV=vals[vals.length-1];
  const isUp=lastV>=startBal;
  const lineColor=isUp?'#2563EB':'#DC2626';
  const fillColor=isUp?'rgba(37,99,235,':'rgba(220,38,38,';

  // Grid lines + Y labels
  const gridSteps=4;
  for(let i=0;i<=gridSteps;i++){
    const v=minV+(rv/gridSteps)*i;
    const y=sy(v);
    ctx.strokeStyle='#F1F5F9'; ctx.lineWidth=1;
    ctx.beginPath(); ctx.moveTo(PL,y); ctx.lineTo(W-PR,y); ctx.stroke();
    ctx.fillStyle='#94A3B8'; ctx.font='9px monospace'; ctx.textAlign='right';
    ctx.fillText('$'+v.toFixed(0),PL-5,y+3);
  }

  // Start balance dashed line
  const startY=sy(startBal);
  ctx.strokeStyle='#CBD5E1'; ctx.lineWidth=1; ctx.setLineDash([5,4]);
  ctx.beginPath(); ctx.moveTo(PL,startY); ctx.lineTo(W-PR,startY); ctx.stroke();
  ctx.setLineDash([]);

  // Area fill
  const grad=ctx.createLinearGradient(0,PT,0,PT+ih);
  grad.addColorStop(0,fillColor+'0.15)');
  grad.addColorStop(1,fillColor+'0.01)');
  ctx.beginPath();
  ctx.moveTo(sx(times[0]),PT+ih);
  data.forEach(d=>ctx.lineTo(sx(d.t),sy(d.v)));
  ctx.lineTo(sx(maxT),PT+ih);
  ctx.closePath(); ctx.fillStyle=grad; ctx.fill();

  // Line
  ctx.beginPath(); ctx.strokeStyle=lineColor; ctx.lineWidth=2; ctx.lineJoin='round';
  data.forEach((d,i)=>i===0?ctx.moveTo(sx(d.t),sy(d.v)):ctx.lineTo(sx(d.t),sy(d.v)));
  ctx.stroke();

  // End dot
  ctx.beginPath(); ctx.arc(sx(maxT),sy(lastV),4,0,Math.PI*2);
  ctx.fillStyle=lineColor; ctx.fill();
  ctx.beginPath(); ctx.arc(sx(maxT),sy(lastV),2,0,Math.PI*2);
  ctx.fillStyle='#fff'; ctx.fill();

  // Time labels
  ctx.fillStyle='#94A3B8'; ctx.font='9px monospace';
  ctx.textAlign='left';  ctx.fillText(fmtDate(minT),PL,H-8);
  ctx.textAlign='right'; ctx.fillText(fmtDate(maxT),W-PR,H-8);

  // Hover crosshair
  if(hoverRatio!=null){
    const ratio=Math.max(0,Math.min(1,hoverRatio));
    const targetT=minT+ratio*rt;
    let closest=data[0];
    for(const d of data) if(Math.abs(d.t-targetT)<Math.abs(closest.t-targetT)) closest=d;
    const cx=sx(closest.t), cy=sy(closest.v);
    ctx.strokeStyle='#CBD5E1'; ctx.lineWidth=1; ctx.setLineDash([4,3]);
    ctx.beginPath(); ctx.moveTo(cx,PT); ctx.lineTo(cx,PT+ih); ctx.stroke();
    ctx.setLineDash([]);
    ctx.beginPath(); ctx.arc(cx,cy,5,0,Math.PI*2);
    ctx.fillStyle=lineColor; ctx.fill();
    ctx.beginPath(); ctx.arc(cx,cy,3,0,Math.PI*2);
    ctx.fillStyle='#fff'; ctx.fill();
    return closest;
  }
}

function initChart(){
  const canvas=document.getElementById('pnl-canvas');
  const tip=document.getElementById('chart-tip');
  const tipDate=document.getElementById('tip-date');
  const tipVal=document.getElementById('tip-val');
  if(!canvas||canvas._ready) return;
  canvas._ready=true;

  function onMove(clientX){
    const rect=canvas.getBoundingClientRect();
    const ratio=(clientX-rect.left-60)/(rect.width-76);
    const closest=drawChart(ratio);
    if(!closest) return;
    const pnl=closest.v-_chartStart;
    tipDate.textContent=fmtDate(closest.t);
    tipVal.innerHTML='<span style="font-size:16px">$'+closest.v.toFixed(2)+'</span> <span style="color:'+(pnl>=0?'#6EE7B7':'#FCA5A5');
    tipVal.innerHTML='$'+closest.v.toFixed(2)+' <span style="color:'+(pnl>=0?'#6EE7B7':'#FCA5A5')+';font-size:12px">'+(pnl>=0?'+':'')+pnl.toFixed(2)+'</span>';
    tip.style.display='block';
    const tx=Math.min(clientX-rect.left+14,rect.width-160);
    tip.style.left=tx+'px'; tip.style.top='12px';
  }
  canvas.addEventListener('mousemove',e=>onMove(e.clientX));
  canvas.addEventListener('mouseleave',()=>{ tip.style.display='none'; drawChart(); });
  canvas.addEventListener('touchmove',e=>{ e.preventDefault(); onMove(e.touches[0].clientX); },{passive:false});
  canvas.addEventListener('touchend',()=>{ tip.style.display='none'; drawChart(); });
}

// ── Pagination ────────────────────────────────────────────────────────────────
let _page=0, _allTrades=[];
const PER=15;
function _prevPage(){ if(_page>0){_page--;_renderTrades();} }
function _nextPage(){ if(_page<Math.ceil(_allTrades.length/PER)-1){_page++;_renderTrades();} }

function _renderTrades(){
  const total=_allTrades.length, pages=Math.ceil(total/PER)||1;
  _page=Math.min(_page,pages-1);
  const slice=_allTrades.slice(_page*PER,(_page+1)*PER);
  document.getElementById('trades-count').textContent=total;

  if(!slice.length){ document.getElementById('trades-body').innerHTML='<div class="empty">No completed trades yet</div>'; document.getElementById('pager').style.display='none'; return; }

  document.getElementById('trades-body').innerHTML=\`<table>
    <thead><tr><th>Time</th><th>Asset</th><th>Strategy</th><th>Side</th><th>Entry</th><th>Spent</th><th>Payout</th><th>Result</th></tr></thead>
    <tbody>\${slice.map(t=>{
      const side=t.side?'<span class="tag tag-'+(t.side==='UP'?'up':'down')+'">'+t.side+'</span>':'<span style="color:var(--text3)">Both</span>';
      const res=t.won===true?'<span class="badge-win">Win</span>':t.won===false?'<span class="badge-loss">Loss</span>':'<span class="badge-pend">Pending</span>';
      const pnl=(t.payout??0)-(t.totalSpent??0);
      const pnlStr=t.won!=null?'<span class="'+pnlCls(pnl)+'" style="font-size:11px;margin-left:6px">'+fmtPnl(pnl)+'</span>':'';
      return '<tr><td style="color:var(--text3);font-size:11px">'+fmtDate(t.enteredAt??t.loggedAt)+'</td><td style="font-weight:600">'+( t.asset??'—')+'</td><td>'+stratTag(t)+'</td><td>'+side+'</td><td style="font-variant-numeric:tabular-nums">'+(t.entryPrice!=null?(t.entryPrice*100).toFixed(1)+'¢':'—')+'</td><td>'+fmt(t.totalSpent)+'</td><td>'+fmt(t.payout)+'</td><td>'+res+pnlStr+'</td></tr>';
    }).join('')}</tbody></table>\`;

  const pager=document.getElementById('pager');
  if(pages>1){
    pager.style.display='flex';
    document.getElementById('pager-info').textContent='Page '+(+_page+1)+' of '+pages+' · '+total+' trades';
    document.getElementById('btn-prev').disabled=_page===0;
    document.getElementById('btn-next').disabled=_page>=pages-1;
  } else { pager.style.display='none'; }
}

// ── Main render ───────────────────────────────────────────────────────────────
async function refresh(){
  try{
    const r=await fetch('/api/state'); if(!r.ok) return;
    const d=await r.json(); render(d);
    document.getElementById('last-update').innerHTML='<span class="refresh-dot"></span> '+ago(d.timestamp);
  } catch{ document.getElementById('last-update').textContent='disconnected'; }
}

function render(d){
  // Header
  const mb=document.getElementById('mode-badge');
  mb.textContent=d.mode; mb.className='badge '+(d.mode==='LIVE'?'badge-live':'badge-sim');
  const wb=document.getElementById('ws-badge');
  wb.className='badge '+(d.wsConnected?'badge-ws-on':'badge-ws-off');
  wb.innerHTML='<span class="badge-dot"></span>'+(d.wsConnected?'WS Live':'WS Off');
  document.getElementById('mkts-count').textContent=(d.wsMarkets||0)+' markets';
  document.getElementById('balance').textContent=fmt(d.balance??0);

  const sniperPnl=(d.sniper?.totalPayout??0)-(d.sniper?.totalSpent??0);
  const lemPnl   =(d.lem?.totalPayout??0)-(d.lem?.totalSpent??0);
  const fadePnl  =(d.fade?.totalPayout??0)-(d.fade?.totalSpent??0);
  const arbPnl   =d.arb?.guaranteedProfit??0;
  const totalPnl =sniperPnl+lemPnl+fadePnl+arbPnl;
  const pe=document.getElementById('pnl-display');
  pe.textContent=(totalPnl>=0?'+':'')+fmt(totalPnl)+' total P&L';
  pe.className='header-pnl '+pnlCls(totalPnl);

  // Prices
  const prices=d.prices??{}, moms=d.momentums??{}, assets=d.assets??Object.keys(prices);
  document.getElementById('prices-bar').innerHTML=assets.map(a=>{
    const p=prices[a],m=moms[a];
    const mc=m==null?'mom-flat':m>0.0005?'mom-up':m<-0.0005?'mom-dn':'mom-flat';
    return '<div class="price-item"><div class="price-label">'+a+'</div><div class="price-value">'+fmtPx(p,a)+'</div><div class="price-mom '+mc+'">'+fmtPct(m)+'</div></div>';
  }).join('');

  // Cards
  const s=d.sniper??{},l=d.lem??{},arb=d.arb??{},sw=d.sweep??{},fd=d.fade??{};
  const lT=l.won+l.lost||0, fT=fd.won+fd.lost||0;
  const lWr=lT>0?(l.won/lT*100).toFixed(1)+'%':'—';
  const fWr=fT>0?(fd.won/fT*100).toFixed(1)+'%':'—';
  const wrBar=(w,l)=>{ const t=w+l; if(!t)return ''; const p=(w/t*100); const c=w/t>0.62?'#059669':w/t<0.45?'#DC2626':'#D97706'; return '<div class="card-wr"><div class="card-wr-fill" style="width:'+p+'%;background:'+c+'"></div></div>'; };
  document.getElementById('cards').innerHTML=
    card('LEM','card-lem',l.entered??0,l.won??0,l.lost??0,lWr,wrBar(l.won??0,l.lost??0),lemPnl)+
    card('Fade (20–45¢)','card-fade',fd.entered??0,fd.won??0,fd.lost??0,fWr,wrBar(fd.won??0,fd.lost??0),fadePnl)+
    cardArb(arb,arbPnl)+
    cardSweep(sw)+
    cardSniper(s,sniperPnl);

  // Stats row
  const allTrades=d.recentTrades??[];
  const resolved=allTrades.filter(t=>t.won!=null);
  const wins=resolved.filter(t=>t.won===true).length;
  const overallWR=resolved.length>0?((wins/resolved.length)*100).toFixed(1)+'%':'—';
  const avgEntry=resolved.length>0?(resolved.reduce((s,t)=>s+(t.entryPrice??0),0)/resolved.length*100).toFixed(1)+'¢':'—';
  document.getElementById('stats-row').innerHTML=
    '<div class="stat-item"><div class="stat-label">Total Trades</div><div class="stat-value">'+resolved.length+'</div></div>'+
    '<div class="stat-item"><div class="stat-label">Overall Win Rate</div><div class="stat-value" style="color:'+(wins/resolved.length>0.62?'var(--green)':wins/resolved.length<0.45?'var(--red)':'var(--amber)')+'">'+overallWR+'</div></div>'+
    '<div class="stat-item"><div class="stat-label">Total P&L</div><div class="stat-value '+pnlCls(totalPnl)+'">'+fmtPnl(totalPnl)+'</div></div>'+
    '<div class="stat-item"><div class="stat-label">Avg Entry Price</div><div class="stat-value">'+avgEntry+'</div></div>'+
    '<div class="stat-item"><div class="stat-label">Active Now</div><div class="stat-value" style="color:var(--blue)">'+(d.activePositions??[]).length+'</div></div>';

  // Chart
  _chartData=d.pnlHistory??[]; _chartStart=d.startBalance??100;
  initChart(); drawChart();
  const lastV=_chartData.length?_chartData[_chartData.length-1].v:_chartStart;
  const pct=(lastV-_chartStart)/_chartStart*100;
  document.getElementById('chart-meta').textContent=_chartData.length>=2
    ?resolved.length+' trades · '+(pct>=0?'+':'')+pct.toFixed(1)+'% from start':'';

  // Active positions
  const pos=d.activePositions??[];
  document.getElementById('pos-count').textContent=pos.length;
  document.getElementById('positions-body').innerHTML=pos.length===0
    ?'<div class="empty">No open positions</div>'
    :'<table><thead><tr><th>Time Left</th><th>Asset</th><th>Strategy</th><th>Side</th><th>Entry</th><th>Size</th><th>Status</th></tr></thead><tbody>'
      +pos.map(p=>{
        const side=p.side?'<span class="tag tag-'+(p.side==='UP'?'up':'down')+'">'+p.side+'</span>':'<span style="color:var(--text3)">Both</span>';
        const status=p.filled?'<span class="status-filled">● Filled</span>':'<span class="status-pending">● Pending</span>';
        return '<tr><td class="time-left" style="font-variant-numeric:tabular-nums">'+fmtLeft(p.windowEndMs??p.endMs)+'</td><td style="font-weight:600">'+( p.asset??'—')+'</td><td>'+stratTag(p)+'</td><td>'+side+'</td><td>'+(p.entryPrice!=null?(p.entryPrice*100).toFixed(1)+'¢':'—')+'</td><td>'+fmt(p.totalSpent)+'</td><td>'+status+'</td></tr>';
      }).join('')+'</tbody></table>';

  // Analytics
  const an=d.analytics;
  if(an&&an.resolved>=5){
    document.getElementById('analytics-section').style.display='';
    document.getElementById('analytics-updated').textContent='Updated '+ago(an.lastUpdated);
    document.getElementById('analytics-suggestions').innerHTML=(an.suggestions??[]).map(s=>{
      const cls=s.includes('strong')||s.includes('prioritize')?'insight-good':s.includes('declining')||s.includes('avoid')||s.includes('reduce')?'insight-bad':'insight-warn';
      return '<div class="insight '+cls+'">'+s+'</div>';
    }).join('');

    const strats=Object.entries(an.byStrategy??{}).sort((a,b)=>(b[1].pnl??0)-(a[1].pnl??0));
    document.getElementById('tbl-strategy').innerHTML='<thead><tr><th>Strategy</th><th>W/L</th><th>WR</th><th>P&L</th></tr></thead><tbody>'+
      strats.map(([k,v])=>{const wrc=v.winRate>0.62?'var(--green)':v.winRate<0.45?'var(--red)':'var(--amber)';const pnl=v.pnl>=0?'<span style="color:var(--green)">+$'+v.pnl.toFixed(2)+'</span>':'<span style="color:var(--red)">-$'+Math.abs(v.pnl).toFixed(2)+'</span>';return '<tr><td>'+k+'</td><td>'+v.wins+'/'+v.losses+'</td><td style="color:'+wrc+';font-weight:600">'+(v.winRate!=null?(v.winRate*100).toFixed(0)+'%':'—')+'</td><td>'+pnl+'</td></tr>';}).join('')+'</tbody>';

    const arows=Object.entries(an.byAsset??{}).sort((a,b)=>(b[1].pnl??0)-(a[1].pnl??0));
    document.getElementById('tbl-asset').innerHTML='<thead><tr><th>Asset</th><th>W/L</th><th>WR</th><th>P&L</th></tr></thead><tbody>'+
      arows.map(([k,v])=>{const wrc=v.winRate>0.62?'var(--green)':v.winRate<0.45?'var(--red)':'var(--amber)';const pnl=v.pnl>=0?'<span style="color:var(--green)">+$'+v.pnl.toFixed(2)+'</span>':'<span style="color:var(--red)">-$'+Math.abs(v.pnl).toFixed(2)+'</span>';return '<tr><td style="font-weight:600">'+k+'</td><td>'+v.wins+'/'+v.losses+'</td><td style="color:'+wrc+';font-weight:600">'+(v.winRate!=null?(v.winRate*100).toFixed(0)+'%':'—')+'</td><td>'+pnl+'</td></tr>';}).join('')+'</tbody>';

    document.getElementById('tbl-price').innerHTML='<thead><tr><th>Range</th><th>W/L</th><th>WR</th></tr></thead><tbody>'+
      Object.entries(an.priceBuckets??{}).map(([k,v])=>{const wrc=v.winRate>0.65?'var(--green)':v.winRate<0.45?'var(--red)':'var(--amber)';return '<tr><td>'+k+'</td><td>'+v.wins+'/'+v.losses+'</td><td style="color:'+wrc+';font-weight:600">'+(v.winRate!=null?(v.winRate*100).toFixed(0)+'%':'—')+'</td></tr>';}).join('')+'</tbody>';

    const adap=Object.entries(d.adaptive??{}).sort((a,b)=>b[1].trades-a[1].trades);
    document.getElementById('tbl-adaptive').innerHTML=adap.length
      ?'<thead><tr><th>Key</th><th>WR</th><th>Mult</th></tr></thead><tbody>'+
        adap.map(([k,v])=>{const wrc=v.winRate>0.62?'var(--green)':v.winRate<0.45?'var(--red)':'var(--amber)';const mc=v.multiplier>1.0?'var(--green)':v.multiplier<1.0?'var(--red)':'var(--text3)';return '<tr><td style="font-size:11px">'+k+'</td><td style="color:'+wrc+';font-weight:600">'+(v.winRate*100).toFixed(0)+'%</td><td style="color:'+mc+';font-weight:600">'+v.multiplier.toFixed(2)+'x</td></tr>';}).join('')+'</tbody>'
      :'<tr><td colspan="3" style="color:var(--text3);text-align:center;padding:12px">No data yet</td></tr>';
  }

  // Trades
  _allTrades=d.recentTrades??[];
  _renderTrades();

  // WS debug
  const ws=d.wsSample??[];
  const wsEl=document.getElementById('ws-debug-body');
  if(!ws.length){wsEl.innerHTML='<div class="empty">No markets</div>';return;}
  const nulls=ws.filter(r=>r.up==null&&r.dn==null).length;
  const banner=nulls===ws.length?'<div style="padding:10px 16px;color:var(--red);font-size:12px">⚠ All prices null</div>':nulls>0?'<div style="padding:10px 16px;color:var(--amber);font-size:12px">⚠ '+nulls+'/'+ws.length+' null</div>':'<div style="padding:10px 16px;color:var(--green);font-size:12px">✓ All '+ws.length+' markets live</div>';
  wsEl.innerHTML=banner+'<table><thead><tr><th>Asset</th><th>UP</th><th>DOWN</th><th>Combined</th><th>Expires</th></tr></thead><tbody>'+
    ws.map(r=>{const c=r.up!=null&&r.dn!=null?(r.up+r.dn).toFixed(3):'—';const cc=(r.up!=null&&r.dn!=null&&r.up+r.dn<0.99)?'color:var(--green);font-weight:600':'color:var(--text3)';const uc=r.up!=null&&r.up<0.48&&r.up>=0.20?'color:var(--blue);font-weight:600':'';const dc=r.dn!=null&&r.dn<0.48&&r.dn>=0.20?'color:var(--blue);font-weight:600':'';return '<tr><td style="font-weight:600">'+r.asset+'</td><td style="'+uc+'">'+(r.up!=null?(r.up*100).toFixed(1)+'¢':'<span style="color:var(--border2)">null</span>')+'</td><td style="'+dc+'">'+(r.dn!=null?(r.dn*100).toFixed(1)+'¢':'<span style="color:var(--border2)">null</span>')+'</td><td style="'+cc+'">'+c+'</td><td style="color:var(--text3)">'+(r.endMs?Math.max(0,Math.round((r.endMs-Date.now())/1000))+'s':'—')+'</td></tr>';}).join('')+'</tbody></table>';
}

function card(label,cls,entered,won,lost,wr,wrBar,pnl){
  const wTotal=won+lost;
  const wrColor=wTotal>0&&won/wTotal>0.62?'var(--green)':wTotal>0&&won/wTotal<0.45?'var(--red)':'var(--text2)';
  return '<div class="card '+cls+'"><div class="card-label">'+label+'</div><div class="card-value">'+entered+'</div><div class="card-sub">'+won+'W &nbsp;'+lost+'L &nbsp;<span style="color:'+wrColor+';font-weight:700">'+wr+'</span></div>'+wrBar+'<div class="card-pnl '+pnlCls(pnl)+'">'+fmtPnl(pnl)+'</div></div>';
}
function cardArb(arb,pnl){
  return '<div class="card card-arb"><div class="card-label">ARB</div><div class="card-value">'+( arb.entered??0)+'</div><div class="card-sub">Both filled: '+(arb.bothFilled??0)+'</div><div class="card-wr"></div><div class="card-pnl '+pnlCls(pnl)+'">'+fmtPnl(pnl)+'</div></div>';
}
function cardSweep(sw){
  return '<div class="card card-sweep"><div class="card-label">Sweep</div><div class="card-value">'+(sw.followed??0)+'</div><div class="card-sub">Follows LEM</div></div>';
}
function cardSniper(s,pnl){
  return '<div class="card card-sniper card-disabled"><div class="card-label" style="color:var(--border2)">Sniper (off)</div><div class="card-value" style="color:var(--border2)">'+(s.entered??0)+'</div><div class="card-sub" style="color:var(--border2)">'+(s.won??0)+'W &nbsp;'+(s.lost??0)+'L</div><div class="card-wr"></div><div class="card-pnl" style="color:var(--border2)">'+fmtPnl(pnl)+'</div></div>';
}

refresh();
setInterval(refresh,2000);
window.addEventListener('resize',drawChart);
</script>
</body>
</html>`;
