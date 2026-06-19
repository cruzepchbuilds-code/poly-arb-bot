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
:root{
  --bg:#0F172A;--surface:#1E293B;--surface2:#263347;--surface3:#2D3A50;
  --border:#334155;--border2:#475569;
  --text1:#F1F5F9;--text2:#94A3B8;--text3:#475569;
  --blue:#3B82F6;--blue-lt:rgba(59,130,246,.12);
  --green:#22C55E;--green-lt:rgba(34,197,94,.12);
  --red:#EF4444;--red-lt:rgba(239,68,68,.12);
  --amber:#F59E0B;--amber-lt:rgba(245,158,11,.12);
  --purple:#A855F7;--purple-lt:rgba(168,85,247,.12);
  --sky:#0EA5E9;--sky-lt:rgba(14,165,233,.12);
  --teal:#14B8A6;--teal-lt:rgba(20,184,166,.12);
  --r:10px;
}
*{box-sizing:border-box;margin:0;padding:0}
body{background:var(--bg);color:var(--text1);font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:14px;min-height:100vh}

/* topbar */
.topbar{background:var(--surface);border-bottom:1px solid var(--border);height:54px;display:flex;align-items:center;padding:0 20px;position:sticky;top:0;z-index:100;box-shadow:0 2px 12px rgba(0,0,0,.5);gap:0}
.logo{font-size:14px;font-weight:700;letter-spacing:-.2px;display:flex;align-items:center;gap:8px;margin-right:28px;white-space:nowrap;flex-shrink:0}
.logo-dot{width:8px;height:8px;border-radius:50%;background:var(--blue);box-shadow:0 0 8px var(--blue)}
.tabs{display:flex;align-items:stretch;height:100%;gap:0}
.tab{height:100%;padding:0 16px;font-size:13px;font-weight:500;color:var(--text2);border:none;background:none;cursor:pointer;border-bottom:2px solid transparent;margin-bottom:-1px;transition:color .15s;white-space:nowrap}
.tab:hover{color:var(--text1)}
.tab.on{color:var(--blue);border-bottom-color:var(--blue)}
.topbar-r{margin-left:auto;display:flex;align-items:center;gap:10px;flex-shrink:0}
.div{width:1px;height:20px;background:var(--border);margin:0 4px}
.badge{display:inline-flex;align-items:center;gap:5px;padding:3px 9px;border-radius:6px;font-size:11px;font-weight:600}
.b-sim{background:rgba(245,158,11,.15);color:var(--amber);border:1px solid rgba(245,158,11,.3)}
.b-live{background:var(--green-lt);color:var(--green);border:1px solid rgba(34,197,94,.3)}
.b-ws-on{background:var(--green-lt);color:var(--green);border:1px solid rgba(34,197,94,.3)}
.b-ws-off{background:var(--red-lt);color:var(--red);border:1px solid rgba(239,68,68,.3)}
.bdot{width:6px;height:6px;border-radius:50%;background:currentColor}
.pulse{animation:pulse 2s infinite}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.35}}
.mkts{font-size:12px;color:var(--text3)}
.bal{font-size:16px;font-weight:700;letter-spacing:-.4px}
.tpnl{font-size:13px;font-weight:700}
.ttime{font-size:11px;color:var(--text3)}

/* pages */
.page{display:none;padding:18px 20px;max-width:1440px;margin:0 auto}
.page.on{display:block}
.grid{display:grid;gap:14px}

/* cards */
.card{background:var(--surface);border:1px solid var(--border);border-radius:var(--r);padding:18px 18px 14px;position:relative;overflow:hidden;transition:border-color .15s}
.card:hover{border-color:var(--border2)}
.acc{position:absolute;top:0;left:0;bottom:0;width:3px;border-radius:var(--r) 0 0 var(--r)}
.acc-b{background:var(--blue)}.acc-s{background:var(--sky)}.acc-t{background:var(--teal)}.acc-a{background:var(--amber)}.acc-p{background:var(--purple)}
.clbl{font-size:10px;color:var(--text3);font-weight:600;letter-spacing:.8px;text-transform:uppercase;margin-bottom:8px;padding-left:10px}
.cval{font-size:26px;font-weight:700;line-height:1;letter-spacing:-1px;padding-left:10px}
.csub{font-size:11px;color:var(--text2);margin-top:5px;padding-left:10px}
.cwrbar{margin:9px 0 0 10px;height:3px;border-radius:2px;background:var(--border);overflow:hidden}
.cwrfill{height:100%;border-radius:2px;transition:width .5s}
.cpnl{font-size:12px;font-weight:700;margin-top:8px;padding-left:10px}
.card-off .cval,.card-off .csub,.card-off .cpnl{opacity:.25}

/* strategy grid */
.scards{display:grid;grid-template-columns:repeat(5,1fr);gap:12px}

/* stat strip */
.sstrip{background:var(--surface);border:1px solid var(--border);border-radius:var(--r);display:grid;grid-template-columns:repeat(5,1fr)}
.scell{padding:14px 16px;border-right:1px solid var(--border)}
.scell:last-child{border-right:none}
.slbl{font-size:10px;color:var(--text3);font-weight:600;letter-spacing:.6px;text-transform:uppercase;margin-bottom:5px}
.sval{font-size:18px;font-weight:700;letter-spacing:-.4px;font-variant-numeric:tabular-nums}

/* chart */
.chartcard{background:var(--surface);border:1px solid var(--border);border-radius:var(--r);overflow:hidden}
.chdr{padding:13px 20px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid var(--border)}
.ctitle{font-size:11px;font-weight:600;color:var(--text2);letter-spacing:.5px;text-transform:uppercase}
.cmeta{font-size:11px;color:var(--text3)}
.cbody{position:relative}
.ctip{position:absolute;pointer-events:none;display:none;z-index:10;background:var(--surface2);border:1px solid var(--border2);border-radius:8px;padding:9px 13px;font-size:11px;white-space:nowrap;box-shadow:0 4px 12px rgba(0,0,0,.5)}
.ctip-d{color:var(--text3);font-size:10px;margin-bottom:3px}
.ctip-v{font-size:15px;font-weight:700}
.ctip-p{font-size:11px;margin-top:2px}

/* perf grid */
.pgrid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}
.pcard{background:var(--surface);border:1px solid var(--border);border-radius:var(--r);padding:16px}
.plbl{font-size:10px;color:var(--text3);font-weight:600;letter-spacing:.6px;text-transform:uppercase;margin-bottom:6px}
.pval{font-size:20px;font-weight:700;letter-spacing:-.4px}

/* section */
.sec{background:var(--surface);border:1px solid var(--border);border-radius:var(--r);overflow:hidden}
.shdr{padding:12px 20px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between}
.stitle{font-size:11px;font-weight:600;color:var(--text2);letter-spacing:.5px;text-transform:uppercase}
.scnt{background:var(--blue-lt);color:var(--blue);padding:2px 9px;border-radius:20px;font-size:11px;font-weight:600}

/* table */
table{width:100%;border-collapse:collapse}
thead{background:var(--surface2)}
th{padding:9px 16px;text-align:left;font-size:10px;color:var(--text3);font-weight:600;letter-spacing:.5px;text-transform:uppercase;border-bottom:1px solid var(--border);white-space:nowrap}
td{padding:11px 16px;border-bottom:1px solid var(--border);font-size:13px;vertical-align:middle}
tbody tr:last-child td{border-bottom:none}
tbody tr:hover td{background:var(--surface2)}
.empty{padding:36px;text-align:center;color:var(--text3);font-size:13px}

/* tags */
.tag{display:inline-flex;align-items:center;padding:2px 8px;border-radius:4px;font-size:10px;font-weight:700;letter-spacing:.3px;text-transform:uppercase}
.tlem{background:var(--blue-lt);color:var(--blue)}
.tfade{background:var(--sky-lt);color:var(--sky)}
.tsnipe{background:var(--purple-lt);color:var(--purple)}
.tarb{background:var(--teal-lt);color:var(--teal)}
.tsweep{background:var(--amber-lt);color:var(--amber)}
.tup{background:var(--green-lt);color:var(--green)}
.tdn{background:var(--red-lt);color:var(--red)}
.rwin{background:var(--green-lt);color:var(--green);display:inline-flex;padding:2px 8px;border-radius:4px;font-size:10px;font-weight:700}
.rloss{background:var(--red-lt);color:var(--red);display:inline-flex;padding:2px 8px;border-radius:4px;font-size:10px;font-weight:700}
.rpend{background:var(--amber-lt);color:var(--amber);display:inline-flex;padding:2px 8px;border-radius:4px;font-size:10px;font-weight:700}

/* insights */
.ilist{padding:16px 20px;display:grid;gap:8px}
.ins{padding:10px 14px;border-radius:8px;font-size:12px;font-weight:500;border:1px solid}
.ig{background:var(--green-lt);color:#4ADE80;border-color:rgba(34,197,94,.25)}
.iw{background:var(--amber-lt);color:var(--amber);border-color:rgba(245,158,11,.25)}
.ib{background:var(--red-lt);color:#F87171;border-color:rgba(239,68,68,.25)}

/* analytics grid */
.agrid{display:grid;grid-template-columns:1fr 1fr;gap:14px;padding:16px 20px}
.ablk{background:var(--surface2);border:1px solid var(--border);border-radius:8px;overflow:hidden}
.atitle{font-size:10px;font-weight:600;color:var(--text3);letter-spacing:.6px;text-transform:uppercase;padding:10px 14px;border-bottom:1px solid var(--border)}
.atbl{width:100%;border-collapse:collapse;font-size:12px}
.atbl th{padding:7px 12px;color:var(--text3);font-size:10px;font-weight:600;letter-spacing:.4px;border-bottom:1px solid var(--border);text-align:left}
.atbl td{padding:8px 12px;border-bottom:1px solid var(--border);color:var(--text2)}
.atbl tr:last-child td{border-bottom:none}
.atbl tr:hover td{background:rgba(255,255,255,.03)}

/* ticker */
.ticker{background:var(--surface);border:1px solid var(--border);border-radius:var(--r);display:flex;overflow-x:auto;scrollbar-width:none}
.ticker::-webkit-scrollbar{display:none}
.tick{display:flex;flex-direction:column;align-items:center;gap:2px;padding:10px 20px;border-right:1px solid var(--border);min-width:95px}
.tick:last-child{border-right:none}
.tlbl{font-size:10px;color:var(--text3);font-weight:600;letter-spacing:.6px;text-transform:uppercase}
.tpx{font-size:14px;font-weight:700;font-variant-numeric:tabular-nums}
.tmom{font-size:11px;font-weight:600}
.mu{color:var(--green)}.md{color:var(--red)}.mf{color:var(--text3)}

/* pagination */
.pager{padding:12px 20px;display:flex;align-items:center;gap:8px;justify-content:flex-end;border-top:1px solid var(--border)}
.pgbtn{background:var(--surface2);border:1px solid var(--border);color:var(--text2);padding:5px 14px;border-radius:6px;cursor:pointer;font-size:12px;font-weight:500;transition:all .15s}
.pgbtn:hover:not(:disabled){background:var(--blue);border-color:var(--blue);color:#fff}
.pgbtn:disabled{opacity:.3;cursor:default}
.pginfo{font-size:12px;color:var(--text3);margin:0 4px}

/* filter bar */
.fbar{padding:11px 20px;display:flex;gap:8px;border-bottom:1px solid var(--border)}
.fbtn{padding:4px 12px;border-radius:6px;font-size:11px;font-weight:600;cursor:pointer;border:1px solid var(--border);background:transparent;color:var(--text2);transition:all .15s}
.fbtn:hover{border-color:var(--border2);color:var(--text1)}
.fbtn.on{background:var(--blue-lt);border-color:rgba(59,130,246,.4);color:var(--blue)}

/* status */
.son{color:var(--green);font-weight:600;font-size:12px}
.soff{color:var(--text3);font-size:12px}

/* responsive */
@media(max-width:900px){
  .scards{grid-template-columns:repeat(3,1fr)}
  .pgrid{grid-template-columns:repeat(2,1fr)}
  .agrid{grid-template-columns:1fr}
  .sstrip{grid-template-columns:repeat(3,1fr)}
  .scell:nth-child(3){border-right:none}
  .scell:nth-child(4){border-top:1px solid var(--border)}
}
@media(max-width:600px){
  .topbar{padding:0 12px}
  .tab{padding:0 10px;font-size:12px}
  .logo{margin-right:10px}
  .scards{grid-template-columns:repeat(2,1fr)}
  .page{padding:12px 12px}
  .pgrid{grid-template-columns:1fr 1fr}
  td,th{padding:9px 10px;font-size:12px}
  .agrid{padding:12px}
}
</style>
</head>
<body>

<div class="topbar">
  <div class="logo"><div class="logo-dot"></div>Poly Arb</div>
  <div class="tabs">
    <button class="tab on"  onclick="go('ov',this)">Overview</button>
    <button class="tab"     onclick="go('pf',this)">Performance</button>
    <button class="tab"     onclick="go('an',this)">Analytics</button>
    <button class="tab"     onclick="go('tr',this)">Trades</button>
    <button class="tab"     onclick="go('lv',this)">Live</button>
  </div>
  <div class="topbar-r">
    <span id="mb" class="badge b-sim">SIM</span>
    <span id="wb" class="badge b-ws-off"><span class="bdot pulse"></span>WS</span>
    <span id="mc" class="mkts"></span>
    <div class="div"></div>
    <span id="tp" class="tpnl"></span>
    <span id="tb" class="bal">—</span>
    <div class="div"></div>
    <span id="tt" class="ttime">connecting</span>
  </div>
</div>

<!-- Overview -->
<div id="p-ov" class="page on">
  <div class="grid">
    <div class="ticker" id="ticker"></div>
    <div class="scards" id="scards"></div>
    <div class="sstrip" id="sstrip"></div>
    <div class="chartcard">
      <div class="chdr"><span class="ctitle">P&amp;L Over Time</span><span class="cmeta" id="cm-ov"></span></div>
      <div class="cbody">
        <canvas id="cv-ov" style="width:100%;display:block;cursor:crosshair"></canvas>
        <div class="ctip" id="ct-ov"><div class="ctip-d" id="ctd-ov"></div><div class="ctip-v" id="ctv-ov"></div><div class="ctip-p" id="ctp-ov"></div></div>
      </div>
    </div>
  </div>
</div>

<!-- Performance -->
<div id="p-pf" class="page">
  <div class="grid">
    <div class="chartcard">
      <div class="chdr"><span class="ctitle">Balance Over Time</span><span class="cmeta" id="cm-pf"></span></div>
      <div class="cbody">
        <canvas id="cv-pf" style="width:100%;display:block;cursor:crosshair"></canvas>
        <div class="ctip" id="ct-pf"><div class="ctip-d" id="ctd-pf"></div><div class="ctip-v" id="ctv-pf"></div><div class="ctip-p" id="ctp-pf"></div></div>
      </div>
    </div>
    <div class="pgrid" id="pgrid"></div>
  </div>
</div>

<!-- Analytics -->
<div id="p-an" class="page">
  <div class="grid">
    <div class="sec" id="isec" style="display:none">
      <div class="shdr"><span class="stitle">Insights</span></div>
      <div class="ilist" id="ilist"></div>
    </div>
    <div class="agrid" id="agrid"><div class="empty" style="grid-column:1/-1">Waiting for 5+ resolved trades...</div></div>
  </div>
</div>

<!-- Trades -->
<div id="p-tr" class="page">
  <div class="sec">
    <div class="shdr"><span class="stitle">Trade History</span><span id="tcnt" class="scnt">0</span></div>
    <div class="fbar">
      <button class="fbtn on" onclick="sf('all',this)">All</button>
      <button class="fbtn" onclick="sf('win',this)">Wins</button>
      <button class="fbtn" onclick="sf('loss',this)">Losses</button>
      <button class="fbtn" onclick="sf('LEM',this)">LEM</button>
      <button class="fbtn" onclick="sf('FADE',this)">Fade</button>
      <button class="fbtn" onclick="sf('ARB',this)">ARB</button>
    </div>
    <div id="tbody"></div>
    <div class="pager" id="pager" style="display:none">
      <button class="pgbtn" id="pp" onclick="pp()">&#8592; Prev</button>
      <span class="pginfo" id="pi"></span>
      <button class="pgbtn" id="pn" onclick="pn()">Next &#8594;</button>
    </div>
  </div>
</div>

<!-- Live -->
<div id="p-lv" class="page">
  <div class="grid">
    <div class="sec">
      <div class="shdr"><span class="stitle">Active Positions</span><span id="pcnt" class="scnt">0</span></div>
      <div id="pbody"><div class="empty">No open positions</div></div>
    </div>
    <div class="sec">
      <div class="shdr"><span class="stitle">Market Feed</span></div>
      <div id="wsbody"><div class="empty">Waiting...</div></div>
    </div>
  </div>
</div>

<script>
// utils
const fmt     = (n,d=2) => n==null?'—':'$'+Number(n).toFixed(d);
const fmtPx   = (p,a) => { if(p==null) return '—'; if(a==='BTC'||p>=1000) return '$'+(p/1000).toFixed(1)+'k'; return p>=1?'$'+p.toFixed(2):'$'+p.toFixed(4); };
const fmtPct  = v => v==null?'—':(v>=0?'+':'')+(v*100).toFixed(2)+'%';
const fmtPnl  = v => (v>=0?'+':'')+fmt(v);
const pS      = v => v>0.005?'color:var(--green)':v<-0.005?'color:var(--red)':'color:var(--text3)';
const ago     = ms => { if(!ms) return '—'; const s=Math.round((Date.now()-ms)/1000); return s<60?s+'s ago':s<3600?Math.round(s/60)+'m ago':Math.round(s/3600)+'h ago'; };
const fmtL    = ms => { if(!ms) return '—'; const s=Math.max(0,Math.round((ms-Date.now())/1000)); return s<60?s+'s':Math.floor(s/60)+'m'+(s%60?s%60+'s':''); };
const fmtD    = ms => ms?new Date(ms).toLocaleString([],{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}):'—';

function stag(t) {
  const s=t?.strategy??'';
  if(s==='SNIPER') return '<span class="tag tsnipe">Snipe</span>';
  if(s==='FADE')   return '<span class="tag tfade">Fade</span>';
  if(s.includes('LEM')) return '<span class="tag tlem">LEM</span>';
  if(t?.type==='directional') return '<span class="tag tlem">LEM</span>';
  if(t?.upFilled!=null||t?.downFilled!=null) return '<span class="tag tarb">ARB</span>';
  return '<span class="tag tlem">LEM</span>';
}

// tab switching
function go(id, btn) {
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('on'));
  document.querySelectorAll('.tab').forEach(b=>b.classList.remove('on'));
  document.getElementById('p-'+id).classList.add('on');
  btn.classList.add('on');
  if(id==='pf') setTimeout(()=>draw('cv-pf','ct-pf',320),50);
}

// chart
let _cd=[], _cs=100;

function draw(cvId, tipId, h, hr) {
  const cv=document.getElementById(cvId); if(!cv) return null;
  const dpr=window.devicePixelRatio||1, W=cv.offsetWidth, H=h;
  cv.width=W*dpr; cv.height=H*dpr; cv.style.height=H+'px';
  const ctx=cv.getContext('2d'); ctx.scale(dpr,dpr);
  const PL=54,PR=14,PT=18,PB=30, iw=W-PL-PR, ih=H-PT-PB;
  const data=_cd, sb=_cs;

  if(!data||data.length<2){
    ctx.fillStyle='#475569'; ctx.font='12px sans-serif'; ctx.textAlign='center';
    ctx.fillText('Collecting data...', W/2, H/2); return null;
  }

  const vs=data.map(d=>d.v), ts=data.map(d=>d.t);
  const mnV=Math.min(...vs,sb)*0.97, mxV=Math.max(...vs,sb)*1.03;
  const rv=mxV-mnV||1, rt=(ts[ts.length-1]-ts[0])||1;
  const sx=t=>PL+((t-ts[0])/rt)*iw;
  const sy=v=>PT+ih-((v-mnV)/rv)*ih;
  const last=vs[vs.length-1], up=last>=sb;
  const lc=up?'#3B82F6':'#EF4444';

  // grid
  for(let i=0;i<=5;i++){
    const v=mnV+(rv/5)*i, y=sy(v);
    ctx.strokeStyle='rgba(255,255,255,0.04)'; ctx.lineWidth=1;
    ctx.beginPath(); ctx.moveTo(PL,y); ctx.lineTo(W-PR,y); ctx.stroke();
    ctx.fillStyle='#475569'; ctx.font='9px monospace'; ctx.textAlign='right';
    ctx.fillText('$'+v.toFixed(0),PL-4,y+3);
  }

  // baseline
  const sy0=sy(sb);
  ctx.strokeStyle='rgba(255,255,255,.1)'; ctx.lineWidth=1; ctx.setLineDash([4,4]);
  ctx.beginPath(); ctx.moveTo(PL,sy0); ctx.lineTo(W-PR,sy0); ctx.stroke();
  ctx.setLineDash([]);

  // fill
  const g=ctx.createLinearGradient(0,PT,0,PT+ih);
  g.addColorStop(0, up?'rgba(59,130,246,.18)':'rgba(239,68,68,.18)');
  g.addColorStop(1, up?'rgba(59,130,246,.01)':'rgba(239,68,68,.01)');
  ctx.beginPath(); ctx.moveTo(sx(ts[0]),PT+ih);
  data.forEach(d=>ctx.lineTo(sx(d.t),sy(d.v)));
  ctx.lineTo(sx(ts[ts.length-1]),PT+ih);
  ctx.closePath(); ctx.fillStyle=g; ctx.fill();

  // line
  ctx.beginPath(); ctx.strokeStyle=lc; ctx.lineWidth=2; ctx.lineJoin='round'; ctx.lineCap='round';
  data.forEach((d,i)=>i?ctx.lineTo(sx(d.t),sy(d.v)):ctx.moveTo(sx(d.t),sy(d.v)));
  ctx.stroke();

  // end dot
  const ex=sx(ts[ts.length-1]),ey=sy(last);
  ctx.beginPath(); ctx.arc(ex,ey,4,0,Math.PI*2); ctx.fillStyle=lc; ctx.fill();
  ctx.beginPath(); ctx.arc(ex,ey,2,0,Math.PI*2); ctx.fillStyle='#0F172A'; ctx.fill();

  // time labels
  ctx.fillStyle='#475569'; ctx.font='9px monospace';
  ctx.textAlign='left'; ctx.fillText(fmtD(ts[0]),PL,H-10);
  ctx.textAlign='right'; ctx.fillText(fmtD(ts[ts.length-1]),W-PR,H-10);

  // hover
  if(hr!=null){
    const tgt=ts[0]+hr*rt; let cl=data[0];
    for(const d of data) if(Math.abs(d.t-tgt)<Math.abs(cl.t-tgt)) cl=d;
    const cx=sx(cl.t),cy=sy(cl.v);
    ctx.strokeStyle='rgba(255,255,255,.15)'; ctx.lineWidth=1; ctx.setLineDash([4,3]);
    ctx.beginPath(); ctx.moveTo(cx,PT); ctx.lineTo(cx,PT+ih); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(PL,cy); ctx.lineTo(W-PR,cy); ctx.stroke();
    ctx.setLineDash([]);
    ctx.beginPath(); ctx.arc(cx,cy,5,0,Math.PI*2); ctx.fillStyle=lc; ctx.fill();
    ctx.beginPath(); ctx.arc(cx,cy,2.5,0,Math.PI*2); ctx.fillStyle='#0F172A'; ctx.fill();
    return cl;
  }
  return null;
}

function initChart(cvId, tipId, h) {
  const cv=document.getElementById(cvId); if(!cv||cv._i) return; cv._i=true;
  function mv(cx){
    const r=cv.getBoundingClientRect(), ratio=(cx-r.left-54)/(r.width-68);
    const cl=draw(cvId,tipId,h,Math.max(0,Math.min(1,ratio))); if(!cl) return;
    const pnl=cl.v-_cs;
    document.getElementById('ctd-'+tipId.slice(3)).textContent=fmtD(cl.t);
    document.getElementById('ctv-'+tipId.slice(3)).textContent='$'+cl.v.toFixed(2);
    document.getElementById('ctp-'+tipId.slice(3)).innerHTML='<span style="'+pS(pnl)+'">'+fmtPnl(pnl)+'</span>';
    const tip=document.getElementById(tipId);
    tip.style.display='block';
    tip.style.left=Math.min(cx-r.left+14,r.width-170)+'px';
    tip.style.top='16px';
  }
  cv.addEventListener('mousemove',e=>mv(e.clientX));
  cv.addEventListener('mouseleave',()=>{ document.getElementById(tipId).style.display='none'; draw(cvId,tipId,h); });
  cv.addEventListener('touchmove',e=>{ e.preventDefault(); mv(e.touches[0].clientX); },{passive:false});
  cv.addEventListener('touchend',()=>{ document.getElementById(tipId).style.display='none'; draw(cvId,tipId,h); });
}

function drawOv(){ initChart('cv-ov','ct-ov',200); draw('cv-ov','ct-ov',200); }
function drawPf(){ initChart('cv-pf','ct-pf',320); draw('cv-pf','ct-pf',320); }

// trades pagination
let _pg=0, _all=[], _fl='all';
const PER=20;

function sf(f,btn){
  _fl=f; _pg=0;
  document.querySelectorAll('.fbtn').forEach(b=>b.classList.remove('on'));
  btn.classList.add('on');
  rTrades();
}
function pp(){ if(_pg>0){_pg--;rTrades();} }
function pn(){ if(_pg<Math.ceil(filt().length/PER)-1){_pg++;rTrades();} }

function filt(){
  return _all.filter(t=>{
    if(_fl==='win')  return t.won===true;
    if(_fl==='loss') return t.won===false;
    if(_fl==='LEM')  return (t.strategy??'').includes('LEM');
    if(_fl==='FADE') return t.strategy==='FADE';
    if(_fl==='ARB')  return t.type==='arb'||(t.upFilled!=null&&t.downFilled!=null);
    return true;
  });
}

function rTrades(){
  const fl=filt(), tot=fl.length, pgs=Math.ceil(tot/PER)||1;
  _pg=Math.min(_pg,pgs-1);
  const sl=fl.slice(_pg*PER,(_pg+1)*PER);
  document.getElementById('tcnt').textContent=_all.length;
  if(!sl.length){
    document.getElementById('tbody').innerHTML='<div class="empty">No trades match this filter</div>';
    document.getElementById('pager').style.display='none'; return;
  }
  let rows='';
  for(const t of sl){
    const side=t.side?'<span class="tag '+(t.side==='UP'?'tup':'tdn')+'">'+t.side+'</span>':'<span style="color:var(--text3)">Both</span>';
    const res=t.won===true?'<span class="rwin">WIN</span>':t.won===false?'<span class="rloss">LOSS</span>':'<span class="rpend">—</span>';
    const pnl=(t.payout??0)-(t.totalSpent??0);
    const ps=t.won!=null?'<span style="'+pS(pnl)+';font-size:11px;margin-left:5px">'+fmtPnl(pnl)+'</span>':'';
    rows+='<tr><td style="color:var(--text3);font-size:11px;white-space:nowrap">'+fmtD(t.enteredAt??t.loggedAt)+'</td>'
      +'<td style="font-weight:600">'+(t.asset??'—')+'</td>'
      +'<td>'+stag(t)+'</td><td>'+side+'</td>'
      +'<td style="font-variant-numeric:tabular-nums">'+(t.entryPrice!=null?(t.entryPrice*100).toFixed(1)+'¢':'—')+'</td>'
      +'<td>'+fmt(t.totalSpent)+'</td><td>'+fmt(t.payout)+'</td><td>'+res+ps+'</td></tr>';
  }
  document.getElementById('tbody').innerHTML='<table><thead><tr><th>Time</th><th>Asset</th><th>Strategy</th><th>Side</th><th>Entry</th><th>Spent</th><th>Payout</th><th>Result</th></tr></thead><tbody>'+rows+'</tbody></table>';
  const pg=document.getElementById('pager');
  if(pgs>1){
    pg.style.display='flex';
    document.getElementById('pi').textContent='Page '+(_pg+1)+' of '+pgs+' · '+tot+' trades';
    document.getElementById('pp').disabled=_pg===0;
    document.getElementById('pn').disabled=_pg>=pgs-1;
  } else pg.style.display='none';
}

// perf metric card
function pm(lbl,val,style){
  return '<div class="pcard"><div class="plbl">'+lbl+'</div><div class="pval" style="'+style+'">'+val+'</div></div>';
}

// main render
async function refresh(){
  try{
    const r=await fetch('/api/state'); if(!r.ok) return;
    const d=await r.json(); render(d);
    document.getElementById('tt').textContent=ago(d.timestamp);
  } catch { document.getElementById('tt').textContent='disconnected'; }
}

function render(d){
  // topbar
  const mb=document.getElementById('mb');
  mb.textContent=d.mode; mb.className='badge '+(d.mode==='LIVE'?'b-live':'b-sim');
  const wb=document.getElementById('wb');
  wb.className='badge '+(d.wsConnected?'b-ws-on':'b-ws-off');
  wb.innerHTML='<span class="bdot'+(d.wsConnected?' pulse':'')+'"></span>'+(d.wsConnected?'WS Live':'WS Off');
  document.getElementById('mc').textContent=(d.wsMarkets||0)+' markets';
  const pnl=(d.balance??0)-(d.startBalance??100);
  document.getElementById('tb').textContent=fmt(d.balance??0);
  const tp=document.getElementById('tp');
  tp.textContent=fmtPnl(pnl); tp.setAttribute('style',pS(pnl)+';font-size:13px;font-weight:700');

  // ticker
  const prices=d.prices??{},moms=d.momentums??{},assets=d.assets??Object.keys(prices);
  document.getElementById('ticker').innerHTML=assets.map(a=>{
    const p=prices[a],m=moms[a],mc=m==null?'mf':m>0.0005?'mu':m<-0.0005?'md':'mf';
    return '<div class="tick"><div class="tlbl">'+a+'</div><div class="tpx">'+fmtPx(p,a)+'</div><div class="tmom '+mc+'">'+fmtPct(m)+'</div></div>';
  }).join('');

  // strategy cards
  const l=d.lem??{},fd=d.fade??{},arb=d.arb??{},sw=d.sweep??{},sn=d.sniper??{};
  const lp=(l.totalPayout??0)-(l.totalSpent??0), fp=(fd.totalPayout??0)-(fd.totalSpent??0), ap=arb.guaranteedProfit??0;
  const wb2=(w,lo)=>{ const t=w+lo; if(!t) return ''; const p=(w/t*100); const c=w/t>0.62?'var(--green)':w/t<0.45?'var(--red)':'var(--amber)'; return '<div class="cwrbar"><div class="cwrfill" style="width:'+p+'%;background:'+c+'"></div></div>'; };
  function sc(lbl,acc,w,lo,p){
    const t=w+lo,wr=t?(w/t*100).toFixed(1)+'%':'—',wc=t&&w/t>0.62?'color:var(--green)':t&&w/t<0.45?'color:var(--red)':'color:var(--text2)';
    return '<div class="card"><div class="acc '+acc+'"></div><div class="clbl">'+lbl+'</div><div class="cval">'+(t||0)+'</div><div class="csub">'+w+'W &nbsp;'+lo+'L &nbsp;<span style="'+wc+';font-weight:700">'+wr+'</span></div>'+wb2(w,lo)+'<div class="cpnl" style="'+pS(p)+'">'+fmtPnl(p)+'</div></div>';
  }
  document.getElementById('scards').innerHTML=
    sc('LEM','acc-b',l.won??0,l.lost??0,lp)+
    sc('Fade','acc-s',fd.won??0,fd.lost??0,fp)+
    '<div class="card"><div class="acc acc-t"></div><div class="clbl">ARB</div><div class="cval">'+(arb.entered??0)+'</div><div class="csub">Both filled: '+(arb.bothFilled??0)+'</div><div class="cpnl" style="'+pS(ap)+'">'+fmtPnl(ap)+'</div></div>'+
    '<div class="card"><div class="acc acc-a"></div><div class="clbl">Sweep</div><div class="cval">'+(sw.followed??0)+'</div><div class="csub">Follows LEM</div></div>'+
    '<div class="card card-off"><div class="acc acc-p"></div><div class="clbl">Sniper (off)</div><div class="cval">'+(sn.entered??0)+'</div><div class="csub">'+(sn.won??0)+'W &nbsp;'+(sn.lost??0)+'L</div></div>';

  // stat strip
  const all=d.recentTrades??[], res=all.filter(t=>t.won!=null);
  const wins=res.filter(t=>t.won===true).length;
  const wr=res.length?(wins/res.length*100).toFixed(1)+'%':'—';
  const wrs=res.length?(wins/res.length>0.62?'color:var(--green)':wins/res.length<0.45?'color:var(--red)':'color:var(--amber)'):'';
  const avgE=res.length?(res.reduce((s,t)=>s+(t.entryPrice??0),0)/res.length*100).toFixed(1)+'¢':'—';
  document.getElementById('sstrip').innerHTML=
    '<div class="scell"><div class="slbl">Total Trades</div><div class="sval">'+res.length+'</div></div>'+
    '<div class="scell"><div class="slbl">Win Rate</div><div class="sval" style="'+wrs+'">'+wr+'</div></div>'+
    '<div class="scell"><div class="slbl">Total P&L</div><div class="sval" style="'+pS(pnl)+'">'+fmtPnl(pnl)+'</div></div>'+
    '<div class="scell"><div class="slbl">Avg Entry</div><div class="sval">'+avgE+'</div></div>'+
    '<div class="scell"><div class="slbl">Active</div><div class="sval" style="color:var(--blue)">'+(d.activePositions??[]).length+'</div></div>';

  // overview chart
  _cd=d.pnlHistory??[]; _cs=d.startBalance??100;
  drawOv();
  if(_cd.length>=2){
    const pct=(_cd[_cd.length-1].v-_cs)/_cs*100;
    document.getElementById('cm-ov').textContent=res.length+' trades · '+(pct>=0?'+':'')+pct.toFixed(1)+'% from start';
  }

  // performance tab
  if(document.getElementById('p-pf').classList.contains('on')) drawPf();
  const bv=_cd.map(p=>p.v), peak=bv.length?Math.max(...bv):_cs;
  const perfPct=_cd.length>=2?(_cd[_cd.length-1].v-_cs)/_cs*100:0;
  document.getElementById('cm-pf').textContent=_cd.length>=2?res.length+' trades · '+(perfPct>=0?'+':'')+perfPct.toFixed(1)+'% total return':'';
  const maxDD=bv.length>1?(()=>{ let dd=0,hi=bv[0]; for(const v of bv){if(v>hi)hi=v; dd=Math.max(dd,(hi-v)/hi*100);} return dd; })():0;
  const avgT=res.length?res.reduce((s,t)=>s+((t.payout??0)-(t.totalSpent??0)),0)/res.length:0;
  const best=res.length?Math.max(...res.map(t=>(t.payout??0)-(t.totalSpent??0))):0;
  const worst=res.length?Math.min(...res.map(t=>(t.payout??0)-(t.totalSpent??0))):0;
  document.getElementById('pgrid').innerHTML=
    pm('Starting Balance',fmt(_cs),'color:var(--text1)')+
    pm('Current Balance',fmt(d.balance??_cs),pS(pnl))+
    pm('Peak Balance',fmt(peak),'color:var(--green)')+
    pm('Total Return',(perfPct>=0?'+':'')+perfPct.toFixed(2)+'%',pS(pnl))+
    pm('Max Drawdown','-'+maxDD.toFixed(1)+'%',maxDD>15?'color:var(--red)':maxDD>8?'color:var(--amber)':'color:var(--green)')+
    pm('Total Trades',String(res.length),'color:var(--text1)')+
    pm('Win Rate',wr,wrs)+
    pm('Avg Trade P&L',fmtPnl(avgT),pS(avgT))+
    pm('Best Trade',fmtPnl(best),'color:var(--green)')+
    pm('Worst Trade',fmtPnl(worst),'color:var(--red)')+
    pm('Avg Entry Price',avgE,'color:var(--text1)')+
    pm('Active Now',String((d.activePositions??[]).length),'color:var(--blue)');

  // analytics
  const an=d.analytics;
  if(an&&an.resolved>=5){
    const sug=an.suggestions??[];
    if(sug.length){
      document.getElementById('isec').style.display='';
      document.getElementById('ilist').innerHTML=sug.map(s=>{
        const c=s.includes('strong')||s.includes('prioritize')?'ig':s.includes('declining')||s.includes('avoid')||s.includes('reduce')?'ib':'iw';
        return '<div class="ins '+c+'">'+s+'</div>';
      }).join('');
    }
    function anTbl(title, ents, hasPnl){
      const rows=ents.map(([k,v])=>{
        const wc=v.winRate>0.62?'color:var(--green)':v.winRate<0.45?'color:var(--red)':'color:var(--amber)';
        const ps2=v.pnl>=0?'<span style="color:var(--green)">+$'+v.pnl.toFixed(2)+'</span>':'<span style="color:var(--red)">-$'+Math.abs(v.pnl).toFixed(2)+'</span>';
        return '<tr><td style="font-weight:600">'+k+'</td><td>'+v.wins+'/'+v.losses+'</td><td style="'+wc+';font-weight:700">'+(v.winRate!=null?(v.winRate*100).toFixed(0)+'%':'—')+'</td>'+(hasPnl?'<td>'+ps2+'</td>':'')+'</tr>';
      }).join('');
      const hdr=hasPnl?'<tr><th>Name</th><th>W/L</th><th>WR</th><th>P&L</th></tr>':'<tr><th>Name</th><th>W/L</th><th>WR</th></tr>';
      return '<div class="ablk"><div class="atitle">'+title+'</div><table class="atbl"><thead>'+hdr+'</thead><tbody>'+rows+'</tbody></table></div>';
    }
    const priceRows=Object.entries(an.priceBuckets??{}).map(([k,v])=>{
      const wc=v.winRate>0.65?'color:var(--green)':v.winRate<0.45?'color:var(--red)':'color:var(--amber)';
      return '<tr><td>'+k+'</td><td>'+v.wins+'/'+v.losses+'</td><td style="'+wc+';font-weight:700">'+(v.winRate!=null?(v.winRate*100).toFixed(0)+'%':'—')+'</td></tr>';
    }).join('');
    const adapRows=Object.entries(d.adaptive??{}).sort((a,b)=>b[1].trades-a[1].trades).map(([k,v])=>{
      const wc=v.winRate>0.62?'color:var(--green)':v.winRate<0.45?'color:var(--red)':'color:var(--amber)';
      const mc=v.multiplier>1.0?'color:var(--green)':v.multiplier<1.0?'color:var(--red)':'color:var(--text3)';
      return '<tr><td style="font-size:11px">'+k+'</td><td style="'+wc+';font-weight:700">'+(v.winRate*100).toFixed(0)+'%</td><td style="'+mc+';font-weight:700">'+v.multiplier.toFixed(2)+'x</td></tr>';
    }).join('');
    document.getElementById('agrid').innerHTML=
      anTbl('By Strategy',Object.entries(an.byStrategy??{}).sort((a,b)=>(b[1].pnl??0)-(a[1].pnl??0)),true)+
      anTbl('By Asset',Object.entries(an.byAsset??{}).sort((a,b)=>(b[1].pnl??0)-(a[1].pnl??0)),true)+
      '<div class="ablk"><div class="atitle">By Entry Price</div><table class="atbl"><thead><tr><th>Range</th><th>W/L</th><th>WR</th></tr></thead><tbody>'+priceRows+'</tbody></table></div>'+
      '<div class="ablk"><div class="atitle">Adaptive Sizing</div><table class="atbl"><thead><tr><th>Key</th><th>WR</th><th>Mult</th></tr></thead><tbody>'+(adapRows||'<tr><td colspan="3" style="text-align:center;padding:12px;color:var(--text3)">No data yet</td></tr>')+'</tbody></table></div>';
  }

  // trades
  _all=(d.recentTrades??[]).slice().sort((a,b)=>(b.enteredAt??b.loggedAt??0)-(a.enteredAt??a.loggedAt??0));
  rTrades();

  // live — positions
  const pos=d.activePositions??[];
  document.getElementById('pcnt').textContent=pos.length;
  document.getElementById('pbody').innerHTML=pos.length===0
    ?'<div class="empty">No open positions</div>'
    :'<table><thead><tr><th>Time Left</th><th>Asset</th><th>Strategy</th><th>Side</th><th>Entry</th><th>Size</th><th>Status</th></tr></thead><tbody>'+
      pos.map(p=>{
        const side=p.side?'<span class="tag '+(p.side==='UP'?'tup':'tdn')+'">'+p.side+'</span>':'<span style="color:var(--text3)">Both</span>';
        const st=p.filled?'<span class="son">&#9679; Filled</span>':'<span class="soff">Pending</span>';
        return '<tr><td style="font-variant-numeric:tabular-nums">'+fmtL(p.windowEndMs??p.endMs)+'</td><td style="font-weight:600">'+(p.asset??'—')+'</td><td>'+stag(p)+'</td><td>'+side+'</td><td>'+(p.entryPrice!=null?(p.entryPrice*100).toFixed(1)+'¢':'—')+'</td><td>'+fmt(p.totalSpent)+'</td><td>'+st+'</td></tr>';
      }).join('')+'</tbody></table>';

  // live — ws feed
  const ws=d.wsSample??[];
  if(ws.length){
    const nulls=ws.filter(r=>r.up==null&&r.dn==null).length;
    const banner=nulls>0?'<div style="padding:10px 16px;color:'+(nulls===ws.length?'var(--red)':'var(--amber)')+';font-size:12px">'+nulls+'/'+ws.length+' prices null</div>':'';
    document.getElementById('wsbody').innerHTML=banner+'<table><thead><tr><th>Asset</th><th>UP</th><th>DOWN</th><th>Combined</th><th>Expires</th></tr></thead><tbody>'+
      ws.map(r=>{
        const c=r.up!=null&&r.dn!=null?(r.up+r.dn).toFixed(3):'—';
        const cc=r.up!=null&&r.dn!=null&&r.up+r.dn<0.99?'color:var(--green);font-weight:600':'color:var(--text3)';
        const uc=r.up!=null&&r.up<0.48&&r.up>=0.20?'color:var(--blue);font-weight:600':'';
        const dc=r.dn!=null&&r.dn<0.48&&r.dn>=0.20?'color:var(--blue);font-weight:600':'';
        return '<tr><td style="font-weight:600">'+r.asset+'</td><td style="'+uc+'">'+(r.up!=null?(r.up*100).toFixed(1)+'¢':'<span style="color:var(--text3)">null</span>')+'</td><td style="'+dc+'">'+(r.dn!=null?(r.dn*100).toFixed(1)+'¢':'<span style="color:var(--text3)">null</span>')+'</td><td style="'+cc+'">'+c+'</td><td style="color:var(--text3)">'+(r.endMs?Math.max(0,Math.round((r.endMs-Date.now())/1000))+'s':'—')+'</td></tr>';
      }).join('')+'</tbody></table>';
  }
}

refresh();
setInterval(refresh,2000);
window.addEventListener('resize',()=>{
  draw('cv-ov','ct-ov',200);
  if(document.getElementById('p-pf').classList.contains('on')) draw('cv-pf','ct-pf',320);
});
</script>
</body>
</html>`;
