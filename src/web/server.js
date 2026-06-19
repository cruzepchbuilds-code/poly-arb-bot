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
<title>Poly Arb</title>
<style>
:root{
  --bg:#07101F;--s0:#0C1828;--s1:#101E30;--s2:#172538;--s3:#1E2F45;
  --br:#1A2D45;--br2:#24405E;--br3:#2E5070;
  --t1:#D8E8F8;--t2:#5E80A8;--t3:#2E4560;
  --blue:#4080FF;--blue2:#2860E0;--blue-a:rgba(64,128,255,.12);
  --gn:#16C784;--gn-a:rgba(22,199,132,.12);
  --rd:#EA3943;--rd-a:rgba(234,57,67,.12);
  --am:#F5A623;--am-a:rgba(245,166,35,.12);
  --pu:#9B6DFF;--pu-a:rgba(155,109,255,.12);
  --tl:#00C0B0;--tl-a:rgba(0,192,176,.12);
  --r:10px;--r2:7px;
}
*{box-sizing:border-box;margin:0;padding:0}
body{background:var(--bg);color:var(--t1);font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:13px;min-height:100vh}

/* ── topbar ── */
.top{background:var(--s0);border-bottom:1px solid var(--br);height:52px;display:flex;align-items:center;padding:0 18px;position:sticky;top:0;z-index:100;gap:0}
.logo{font-size:13px;font-weight:700;letter-spacing:.2px;display:flex;align-items:center;gap:7px;margin-right:24px;flex-shrink:0;color:var(--t1)}
.logo-mark{width:24px;height:24px;border-radius:6px;background:linear-gradient(135deg,var(--blue),var(--pu));display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;color:#fff;letter-spacing:-.5px}
.tabs{display:flex;align-items:stretch;height:100%}
.tab{height:100%;padding:0 14px;font-size:12px;font-weight:600;color:var(--t2);border:none;background:none;cursor:pointer;border-bottom:2px solid transparent;transition:color .15s;letter-spacing:.2px}
.tab:hover{color:var(--t1)}
.tab.on{color:var(--blue);border-bottom-color:var(--blue)}
.top-r{margin-left:auto;display:flex;align-items:center;gap:8px;flex-shrink:0}
.vd{width:1px;height:18px;background:var(--br);margin:0 3px}
.badge{display:inline-flex;align-items:center;gap:5px;padding:3px 9px;border-radius:5px;font-size:10px;font-weight:700;letter-spacing:.4px}
.b-sim{background:var(--am-a);color:var(--am);border:1px solid rgba(245,166,35,.25)}
.b-live{background:var(--gn-a);color:var(--gn);border:1px solid rgba(22,199,132,.25)}
.b-ws-on{background:var(--gn-a);color:var(--gn);border:1px solid rgba(22,199,132,.25)}
.b-ws-off{background:var(--rd-a);color:var(--rd);border:1px solid rgba(234,57,67,.25)}
.bdot{width:6px;height:6px;border-radius:50%;background:currentColor}
.pulse{animation:pulse 2s infinite}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.3}}
.tr-bal{font-size:17px;font-weight:700;letter-spacing:-.5px;font-variant-numeric:tabular-nums}
.tr-pnl{font-size:12px;font-weight:700}
.tr-time{font-size:10px;color:var(--t3);letter-spacing:.3px}
.tr-mkts{font-size:11px;color:var(--t3)}

/* ── pages ── */
.page{display:none;padding:16px 18px;max-width:1500px;margin:0 auto}
.page.on{display:block}
.g{display:grid;gap:12px}

/* ── top stat cards ── */
#top-stats{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}
.tsc{background:var(--s1);border:1px solid var(--br);border-radius:var(--r);padding:16px 18px;position:relative;overflow:hidden}
.tsc::before{content:'';position:absolute;top:0;left:0;right:0;height:2px}
.tsc-b::before{background:var(--blue)}.tsc-g::before{background:var(--gn)}.tsc-a::before{background:var(--am)}.tsc-p::before{background:var(--pu)}
.tsc-lbl{font-size:10px;color:var(--t3);font-weight:600;letter-spacing:.8px;text-transform:uppercase;margin-bottom:10px}
.tsc-val{font-size:28px;font-weight:800;letter-spacing:-1.2px;line-height:1;font-variant-numeric:tabular-nums}
.tsc-sub{font-size:11px;color:var(--t2);margin-top:6px}

/* ── ticker ── */
.ticker{background:var(--s1);border:1px solid var(--br);border-radius:var(--r);display:flex;overflow-x:auto;scrollbar-width:none}
.ticker::-webkit-scrollbar{display:none}
.tick{display:flex;flex-direction:column;align-items:center;gap:3px;padding:10px 18px;border-right:1px solid var(--br);min-width:90px;transition:background .15s}
.tick:hover{background:var(--s2)}
.tick:last-child{border-right:none}
.t-lbl{font-size:9px;color:var(--t3);font-weight:700;letter-spacing:.8px;text-transform:uppercase}
.t-px{font-size:13px;font-weight:700;font-variant-numeric:tabular-nums}
.t-mom{font-size:10px;font-weight:700}
.mu{color:var(--gn)}.md{color:var(--rd)}.mn{color:var(--t3)}

/* ── strategy cards ── */
#scards{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}
.sc{background:var(--s1);border:1px solid var(--br);border-radius:var(--r);padding:18px 20px;position:relative;overflow:hidden;transition:border-color .15s}
.sc:hover{border-color:var(--br2)}
.sc-bar{position:absolute;top:0;left:0;right:0;height:2px}
.sc-bar-b{background:linear-gradient(90deg,var(--blue),var(--pu))}.sc-bar-t{background:linear-gradient(90deg,var(--tl),var(--blue))}.sc-bar-a{background:linear-gradient(90deg,var(--am),var(--rd))}
.sc-lbl{font-size:9px;color:var(--t3);font-weight:700;letter-spacing:.8px;text-transform:uppercase;margin-bottom:10px}
.sc-val{font-size:32px;font-weight:800;letter-spacing:-1.5px;line-height:1;font-variant-numeric:tabular-nums}
.sc-row{display:flex;align-items:center;justify-content:space-between;margin-top:10px}
.sc-sub{font-size:11px;color:var(--t2)}
.sc-pnl{font-size:12px;font-weight:700}
.sc-wr{background:var(--s2);border:1px solid var(--br);border-radius:4px;padding:2px 8px;font-size:10px;font-weight:700}
.wr-h{color:var(--gn)}.wr-m{color:var(--am)}.wr-l{color:var(--rd)}
.wbar{margin-top:10px;height:3px;background:var(--br);border-radius:3px;overflow:hidden}
.wfill{height:100%;border-radius:3px;transition:width .6s}

/* ── stat strip ── */
#sstrip{background:var(--s1);border:1px solid var(--br);border-radius:var(--r);display:grid;grid-template-columns:repeat(5,1fr)}
.ss-cell{padding:14px 16px;border-right:1px solid var(--br)}
.ss-cell:last-child{border-right:none}
.ss-lbl{font-size:9px;color:var(--t3);font-weight:700;letter-spacing:.8px;text-transform:uppercase;margin-bottom:6px}
.ss-val{font-size:19px;font-weight:800;letter-spacing:-.5px;font-variant-numeric:tabular-nums}

/* ── chart ── */
.chart-card{background:var(--s1);border:1px solid var(--br);border-radius:var(--r);overflow:hidden}
.ch-hdr{padding:12px 18px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid var(--br)}
.ch-title{font-size:10px;font-weight:700;color:var(--t2);letter-spacing:.6px;text-transform:uppercase}
.ch-meta{font-size:10px;color:var(--t3)}
.ch-body{position:relative}
.ctip{position:absolute;pointer-events:none;display:none;z-index:10;background:var(--s2);border:1px solid var(--br2);border-radius:8px;padding:10px 14px;font-size:11px;white-space:nowrap;box-shadow:0 8px 24px rgba(0,0,0,.6)}
.ctip-d{color:var(--t3);font-size:9px;font-weight:600;letter-spacing:.4px;text-transform:uppercase;margin-bottom:4px}
.ctip-v{font-size:16px;font-weight:800;letter-spacing:-.5px}
.ctip-p{font-size:11px;font-weight:700;margin-top:3px}

/* ── perf grid ── */
.pgrid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}
.pcard{background:var(--s1);border:1px solid var(--br);border-radius:var(--r);padding:14px 16px}
.plbl{font-size:9px;color:var(--t3);font-weight:700;letter-spacing:.8px;text-transform:uppercase;margin-bottom:7px}
.pval{font-size:20px;font-weight:800;letter-spacing:-.5px;font-variant-numeric:tabular-nums}

/* ── section ── */
.sec{background:var(--s1);border:1px solid var(--br);border-radius:var(--r);overflow:hidden}
.shdr{padding:11px 18px;border-bottom:1px solid var(--br);display:flex;align-items:center;justify-content:space-between}
.stitle{font-size:10px;font-weight:700;color:var(--t2);letter-spacing:.6px;text-transform:uppercase}
.scnt{background:var(--blue-a);color:var(--blue);padding:2px 8px;border-radius:12px;font-size:10px;font-weight:700}

/* ── table ── */
table{width:100%;border-collapse:collapse}
thead{background:var(--s2)}
th{padding:9px 14px;text-align:left;font-size:9px;color:var(--t3);font-weight:700;letter-spacing:.6px;text-transform:uppercase;border-bottom:1px solid var(--br)}
td{padding:10px 14px;border-bottom:1px solid var(--br);font-size:12px;vertical-align:middle}
tbody tr:last-child td{border-bottom:none}
tbody tr:hover td{background:var(--s2)}
.empty{padding:40px;text-align:center;color:var(--t3);font-size:12px}

/* ── tags ── */
.tag{display:inline-flex;align-items:center;padding:2px 7px;border-radius:4px;font-size:9px;font-weight:700;letter-spacing:.4px;text-transform:uppercase}
.t-lem{background:var(--blue-a);color:var(--blue)}
.t-arb{background:var(--tl-a);color:var(--tl)}
.t-sweep{background:var(--am-a);color:var(--am)}
.t-up{background:var(--gn-a);color:var(--gn)}
.t-dn{background:var(--rd-a);color:var(--rd)}
.rwin{background:var(--gn-a);color:var(--gn);display:inline-flex;padding:2px 8px;border-radius:4px;font-size:9px;font-weight:700}
.rloss{background:var(--rd-a);color:var(--rd);display:inline-flex;padding:2px 8px;border-radius:4px;font-size:9px;font-weight:700}
.rpend{background:var(--s3);color:var(--t3);display:inline-flex;padding:2px 8px;border-radius:4px;font-size:9px;font-weight:700}

/* ── insights ── */
.ilist{padding:14px 16px;display:grid;gap:7px}
.ins{padding:9px 13px;border-radius:7px;font-size:12px;font-weight:500;border:1px solid}
.ig{background:var(--gn-a);color:#38D897;border-color:rgba(22,199,132,.2)}
.iw{background:var(--am-a);color:var(--am);border-color:rgba(245,166,35,.2)}
.ib{background:var(--rd-a);color:#FF6B75;border-color:rgba(234,57,67,.2)}

/* ── analytics ── */
.agrid{display:grid;grid-template-columns:1fr 1fr;gap:12px;padding:14px 16px}
.ablk{background:var(--s2);border:1px solid var(--br);border-radius:var(--r2);overflow:hidden}
.atitle{font-size:9px;font-weight:700;color:var(--t3);letter-spacing:.7px;text-transform:uppercase;padding:9px 12px;border-bottom:1px solid var(--br)}
.atbl{width:100%;border-collapse:collapse;font-size:12px}
.atbl th{padding:6px 11px;color:var(--t3);font-size:9px;font-weight:700;letter-spacing:.5px;border-bottom:1px solid var(--br);text-align:left}
.atbl td{padding:8px 11px;border-bottom:1px solid var(--br);color:var(--t2)}
.atbl tr:last-child td{border-bottom:none}
.atbl tr:hover td{background:rgba(255,255,255,.03)}

/* ── pagination ── */
.pager{padding:10px 16px;display:flex;align-items:center;gap:7px;justify-content:flex-end;border-top:1px solid var(--br)}
.pgbtn{background:var(--s2);border:1px solid var(--br);color:var(--t2);padding:5px 13px;border-radius:6px;cursor:pointer;font-size:11px;font-weight:600;transition:all .15s}
.pgbtn:hover:not(:disabled){background:var(--blue);border-color:var(--blue);color:#fff}
.pgbtn:disabled{opacity:.25;cursor:default}
.pginfo{font-size:11px;color:var(--t3);margin:0 4px}

/* ── filter bar ── */
.fbar{padding:10px 16px;display:flex;gap:7px;border-bottom:1px solid var(--br)}
.fbtn{padding:4px 11px;border-radius:5px;font-size:10px;font-weight:700;cursor:pointer;border:1px solid var(--br);background:transparent;color:var(--t2);transition:all .15s;letter-spacing:.3px}
.fbtn:hover{border-color:var(--br2);color:var(--t1)}
.fbtn.on{background:var(--blue-a);border-color:rgba(64,128,255,.35);color:var(--blue)}

/* ── status ── */
.son{color:var(--gn);font-weight:700;font-size:11px}
.soff{color:var(--t3);font-size:11px}

/* ── ws card grid ── */
.wsgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:8px;padding:12px}
.ws-cell{background:var(--s2);border:1px solid var(--br);border-radius:var(--r2);padding:11px 13px}
.ws-cell.ws-arb{border-color:rgba(0,192,176,.35);background:rgba(0,192,176,.06)}
.ws-asset{font-size:10px;font-weight:700;letter-spacing:.6px;color:var(--t2);text-transform:uppercase;margin-bottom:7px}
.ws-row{display:flex;align-items:center;justify-content:space-between;margin-bottom:3px}
.ws-side{font-size:9px;color:var(--t3);font-weight:600;letter-spacing:.4px}
.ws-px{font-size:13px;font-weight:700;font-variant-numeric:tabular-nums}
.ws-comb{display:flex;align-items:center;justify-content:space-between;margin-top:8px;padding-top:7px;border-top:1px solid var(--br)}
.ws-comb-lbl{font-size:9px;color:var(--t3);font-weight:600}
.ws-comb-val{font-size:12px;font-weight:800}
.ws-exp{font-size:9px;color:var(--t3);margin-top:5px}
.ws-null{color:var(--t3);font-size:12px}

/* ── responsive ── */
@media(max-width:1100px){
  #top-stats{grid-template-columns:repeat(2,1fr)}
  #scards{grid-template-columns:repeat(3,1fr)}
  .pgrid{grid-template-columns:repeat(2,1fr)}
  .agrid{grid-template-columns:1fr}
}
@media(max-width:700px){
  #top-stats{grid-template-columns:repeat(2,1fr)}
  #scards{grid-template-columns:1fr 1fr}
  #sstrip{grid-template-columns:repeat(3,1fr)}
  .ss-cell:nth-child(3){border-right:none}
  .ss-cell:nth-child(n+4){border-top:1px solid var(--br)}
  .page{padding:10px 10px}
  .top{padding:0 10px}
  .tab{padding:0 10px;font-size:11px}
}
@media(max-width:480px){
  #top-stats,#scards{grid-template-columns:1fr 1fr}
  td,th{padding:8px 10px;font-size:11px}
}
</style>
</head>
<body>

<div class="top">
  <div class="logo"><div class="logo-mark">PA</div>Poly Arb</div>
  <div class="tabs">
    <button class="tab on"  onclick="go('ov',this)">Overview</button>
    <button class="tab"     onclick="go('pf',this)">Performance</button>
    <button class="tab"     onclick="go('an',this)">Analytics</button>
    <button class="tab"     onclick="go('tr',this)">Trades</button>
    <button class="tab"     onclick="go('lv',this)">Live</button>
  </div>
  <div class="top-r">
    <span id="mb" class="badge b-sim">SIM</span>
    <span id="wb" class="badge b-ws-off"><span class="bdot pulse"></span>WS</span>
    <span id="mc" class="tr-mkts"></span>
    <div class="vd"></div>
    <span id="tp" class="tr-pnl"></span>
    <span id="tb" class="tr-bal">—</span>
    <div class="vd"></div>
    <span id="tt" class="tr-time">connecting…</span>
  </div>
</div>

<!-- Overview -->
<div id="p-ov" class="page on">
  <div class="g">
    <div id="top-stats"></div>
    <div class="ticker" id="ticker"></div>
    <div id="scards"></div>
    <div id="sstrip"></div>
    <div class="chart-card">
      <div class="ch-hdr"><span class="ch-title">P&amp;L History</span><span class="ch-meta" id="cm-ov"></span></div>
      <div class="ch-body">
        <canvas id="cv-ov" style="width:100%;display:block;cursor:crosshair"></canvas>
        <div class="ctip" id="ct-ov"><div class="ctip-d" id="ctd-ov"></div><div class="ctip-v" id="ctv-ov"></div><div class="ctip-p" id="ctp-ov"></div></div>
      </div>
    </div>
  </div>
</div>

<!-- Performance -->
<div id="p-pf" class="page">
  <div class="g">
    <div class="chart-card">
      <div class="ch-hdr"><span class="ch-title">Balance Over Time</span><span class="ch-meta" id="cm-pf"></span></div>
      <div class="ch-body">
        <canvas id="cv-pf" style="width:100%;display:block;cursor:crosshair"></canvas>
        <div class="ctip" id="ct-pf"><div class="ctip-d" id="ctd-pf"></div><div class="ctip-v" id="ctv-pf"></div><div class="ctip-p" id="ctp-pf"></div></div>
      </div>
    </div>
    <div class="pgrid" id="pgrid"></div>
  </div>
</div>

<!-- Analytics -->
<div id="p-an" class="page">
  <div class="g">
    <div class="sec" id="isec" style="display:none">
      <div class="shdr"><span class="stitle">Insights</span></div>
      <div class="ilist" id="ilist"></div>
    </div>
    <div class="agrid" id="agrid"><div class="empty" style="grid-column:1/-1">Waiting for 5+ resolved trades…</div></div>
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
  <div class="g">
    <div class="sec">
      <div class="shdr"><span class="stitle">Active Positions</span><span id="pcnt" class="scnt">0</span></div>
      <div id="pbody"><div class="empty">No open positions</div></div>
    </div>
    <div class="sec">
      <div class="shdr"><span class="stitle">Market Feed</span></div>
      <div id="wsbody"><div class="empty">Waiting…</div></div>
    </div>
  </div>
</div>

<script>
const $ = id => document.getElementById(id);
const fmt    = (n,d=2) => n==null?'—':'$'+Number(n).toFixed(d);
const fmtPx  = (p,a) => { if(p==null) return '—'; if(a==='BTC'||p>=1000) return '$'+(p/1000).toFixed(1)+'k'; return p>=1?'$'+p.toFixed(2):'$'+p.toFixed(4); };
const fmtPct = v => v==null?'—':(v>=0?'+':'')+(v*100).toFixed(2)+'%';
const fmtPnl = v => v==null?'—':(v>=0?'+':'')+fmt(v);
const pC     = v => v>0.005?'var(--gn)':v<-0.005?'var(--rd)':'var(--t3)';
const pS     = v => 'color:'+pC(v);
const ago    = ms => { if(!ms) return '—'; const s=Math.round((Date.now()-ms)/1000); return s<60?s+'s':s<3600?Math.round(s/60)+'m':Math.round(s/3600)+'h'; };
const fmtL   = ms => { if(!ms) return '—'; const s=Math.max(0,Math.round((ms-Date.now())/1000)); return s<60?s+'s':Math.floor(s/60)+'m'+(s%60?s%60+'s':''); };
const fmtD   = ms => ms?new Date(ms).toLocaleString([],{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}):'—';

function stag(t){
  const s=t?.strategy??'';
  if(s.includes('LEM')||t?.type==='directional') return '<span class="tag t-lem">LEM</span>';
  if(t?.type==='arb'||t?.upFilled!=null||t?.downFilled!=null) return '<span class="tag t-arb">ARB</span>';
  if(s==='SWEEP') return '<span class="tag t-sweep">Sweep</span>';
  return '<span class="tag t-lem">LEM</span>';
}

// ── tab switching ──
function go(id,btn){
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('on'));
  document.querySelectorAll('.tab').forEach(b=>b.classList.remove('on'));
  $('p-'+id).classList.add('on');
  btn.classList.add('on');
  if(id==='pf') setTimeout(()=>draw('cv-pf','ct-pf',310),50);
}

// ── charts ──
let _cd=[], _cs=100;

function draw(cvId, tipId, h, hr){
  const cv=$(cvId); if(!cv) return null;
  const dpr=window.devicePixelRatio||1, W=cv.offsetWidth, H=h;
  cv.width=W*dpr; cv.height=H*dpr; cv.style.height=H+'px';
  const ctx=cv.getContext('2d'); ctx.scale(dpr,dpr);
  const PL=52,PR=12,PT=16,PB=28, iw=W-PL-PR, ih=H-PT-PB;
  const data=_cd, sb=_cs;

  if(!data||data.length<2){
    ctx.fillStyle='var(--t3)'; ctx.font='11px sans-serif'; ctx.textAlign='center';
    ctx.fillText('Collecting data…', W/2, H/2); return null;
  }

  const vs=data.map(d=>d.v), ts=data.map(d=>d.t);
  const mnV=Math.min(...vs,sb)*0.974, mxV=Math.max(...vs,sb)*1.026;
  const rv=mxV-mnV||1, rt=ts[ts.length-1]-ts[0]||1;
  const sx=t=>PL+((t-ts[0])/rt)*iw;
  const sy=v=>PT+ih-((v-mnV)/rv)*ih;
  const last=vs[vs.length-1], up=last>=sb;
  const lc=up?'#4080FF':'#EA3943';
  const lc2=up?'rgba(64,128,255,':'rgba(234,57,67,';

  // grid lines
  for(let i=0;i<=4;i++){
    const v=mnV+(rv/4)*i, y=sy(v);
    ctx.strokeStyle='rgba(255,255,255,.04)'; ctx.lineWidth=1;
    ctx.beginPath(); ctx.moveTo(PL,y); ctx.lineTo(W-PR,y); ctx.stroke();
    ctx.fillStyle='#2E4560'; ctx.font='9px monospace'; ctx.textAlign='right';
    ctx.fillText('$'+v.toFixed(0),PL-4,y+3);
  }

  // baseline
  const sy0=sy(sb);
  ctx.strokeStyle='rgba(255,255,255,.08)'; ctx.lineWidth=1; ctx.setLineDash([4,4]);
  ctx.beginPath(); ctx.moveTo(PL,sy0); ctx.lineTo(W-PR,sy0); ctx.stroke();
  ctx.setLineDash([]);

  // fill
  const g=ctx.createLinearGradient(0,PT,0,PT+ih);
  g.addColorStop(0,lc2+'0.15)');
  g.addColorStop(.6,lc2+'0.04)');
  g.addColorStop(1,lc2+'0.0)');
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
  ctx.beginPath(); ctx.arc(ex,ey,5,0,Math.PI*2); ctx.fillStyle=lc; ctx.fill();
  ctx.beginPath(); ctx.arc(ex,ey,2.5,0,Math.PI*2); ctx.fillStyle='#07101F'; ctx.fill();

  // time labels
  ctx.fillStyle='#2E4560'; ctx.font='9px monospace';
  ctx.textAlign='left'; ctx.fillText(fmtD(ts[0]),PL,H-8);
  ctx.textAlign='right'; ctx.fillText(fmtD(ts[ts.length-1]),W-PR,H-8);

  if(hr!=null){
    const tgt=ts[0]+hr*rt; let cl=data[0];
    for(const d of data) if(Math.abs(d.t-tgt)<Math.abs(cl.t-tgt)) cl=d;
    const cx=sx(cl.t),cy=sy(cl.v);
    ctx.strokeStyle='rgba(255,255,255,.1)'; ctx.lineWidth=1; ctx.setLineDash([3,3]);
    ctx.beginPath(); ctx.moveTo(cx,PT); ctx.lineTo(cx,PT+ih); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(PL,cy); ctx.lineTo(W-PR,cy); ctx.stroke();
    ctx.setLineDash([]);
    ctx.beginPath(); ctx.arc(cx,cy,5,0,Math.PI*2); ctx.fillStyle=lc; ctx.fill();
    ctx.beginPath(); ctx.arc(cx,cy,2.5,0,Math.PI*2); ctx.fillStyle='#07101F'; ctx.fill();
    return cl;
  }
  return null;
}

function initChart(cvId,tipId,h){
  const cv=$(cvId); if(!cv||cv._i) return; cv._i=true;
  const sfx=tipId.slice(3);
  function mv(cx){
    const r=cv.getBoundingClientRect(), ratio=(cx-r.left-52)/(r.width-64);
    const cl=draw(cvId,tipId,h,Math.max(0,Math.min(1,ratio))); if(!cl) return;
    const pnl=cl.v-_cs;
    $('ctd-'+sfx).textContent=fmtD(cl.t);
    $('ctv-'+sfx).textContent='$'+cl.v.toFixed(2);
    $('ctp-'+sfx).innerHTML='<span style="'+pS(pnl)+'">'+fmtPnl(pnl)+'</span>';
    const tip=$(tipId);
    tip.style.display='block';
    tip.style.left=Math.min(cx-r.left+14,r.width-160)+'px';
    tip.style.top='14px';
  }
  cv.addEventListener('mousemove',e=>mv(e.clientX));
  cv.addEventListener('mouseleave',()=>{ $(tipId).style.display='none'; draw(cvId,tipId,h); });
  cv.addEventListener('touchmove',e=>{ e.preventDefault(); mv(e.touches[0].clientX); },{passive:false});
  cv.addEventListener('touchend',()=>{ $(tipId).style.display='none'; draw(cvId,tipId,h); });
}

function drawOv(){ initChart('cv-ov','ct-ov',200); draw('cv-ov','ct-ov',200); }
function drawPf(){ initChart('cv-pf','ct-pf',310); draw('cv-pf','ct-pf',310); }

// ── pagination ──
let _pg=0, _all=[], _fl='all';
const PER=20;
function sf(f,btn){ _fl=f; _pg=0; document.querySelectorAll('.fbtn').forEach(b=>b.classList.remove('on')); btn.classList.add('on'); rTrades(); }
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
  $('tcnt').textContent=_all.length;
  if(!sl.length){
    $('tbody').innerHTML='<div class="empty">No trades match this filter</div>';
    $('pager').style.display='none'; return;
  }
  let rows='';
  for(const t of sl){
    const side=t.side?'<span class="tag '+(t.side==='UP'?'t-up':'t-dn')+'">'+t.side+'</span>':'<span style="color:var(--t3)">Both</span>';
    const res=t.won===true?'<span class="rwin">WIN</span>':t.won===false?'<span class="rloss">LOSS</span>':'<span class="rpend">OPEN</span>';
    const pnl=(t.payout??0)-(t.totalSpent??0);
    const ps=t.won!=null?'<span style="'+pS(pnl)+';font-size:11px;margin-left:5px">'+fmtPnl(pnl)+'</span>':'';
    rows+='<tr>'
      +'<td style="color:var(--t3);font-size:10px;white-space:nowrap">'+fmtD(t.enteredAt??t.loggedAt)+'</td>'
      +'<td style="font-weight:700">'+( t.asset??'—')+'</td>'
      +'<td>'+stag(t)+'</td><td>'+side+'</td>'
      +'<td style="font-variant-numeric:tabular-nums">'+(t.entryPrice!=null?(t.entryPrice*100).toFixed(1)+'¢':'—')+'</td>'
      +'<td>'+fmt(t.totalSpent)+'</td><td>'+fmt(t.payout)+'</td><td>'+res+ps+'</td></tr>';
  }
  $('tbody').innerHTML='<table><thead><tr><th>Time</th><th>Asset</th><th>Strategy</th><th>Side</th><th>Entry</th><th>Spent</th><th>Payout</th><th>Result</th></tr></thead><tbody>'+rows+'</tbody></table>';
  const pg=$('pager');
  if(pgs>1){
    pg.style.display='flex';
    $('pi').textContent='Page '+(_pg+1)+' of '+pgs+' · '+tot+' trades';
    $('pp').disabled=_pg===0;
    $('pn').disabled=_pg>=pgs-1;
  } else pg.style.display='none';
}

function pm(lbl,val,style){
  return '<div class="pcard"><div class="plbl">'+lbl+'</div><div class="pval" style="'+style+'">'+val+'</div></div>';
}

function anTbl(title,ents,hasPnl){
  const rows=ents.map(([k,v])=>{
    const wc=v.winRate>0.62?'color:var(--gn)':v.winRate<0.45?'color:var(--rd)':'color:var(--am)';
    const ps2=v.pnl>=0?'<span style="color:var(--gn)">+$'+v.pnl.toFixed(2)+'</span>':'<span style="color:var(--rd)">-$'+Math.abs(v.pnl).toFixed(2)+'</span>';
    return '<tr><td style="font-weight:600">'+k+'</td><td>'+v.wins+'/'+v.losses+'</td><td style="'+wc+';font-weight:700">'+(v.winRate!=null?(v.winRate*100).toFixed(0)+'%':'—')+'</td>'+(hasPnl?'<td>'+ps2+'</td>':'')+'</tr>';
  }).join('');
  const hdr=hasPnl?'<tr><th>Name</th><th>W/L</th><th>WR</th><th>P&L</th></tr>':'<tr><th>Name</th><th>W/L</th><th>WR</th></tr>';
  return '<div class="ablk"><div class="atitle">'+title+'</div><table class="atbl"><thead>'+hdr+'</thead><tbody>'+rows+'</tbody></table></div>';
}

// ── main render ──
async function refresh(){
  try{
    const r=await fetch('/api/state'); if(!r.ok) return;
    const d=await r.json(); render(d);
    $('tt').textContent=ago(d.timestamp)+' ago';
  } catch { $('tt').textContent='disconnected'; }
}

function render(d){
  // topbar
  const mb=$('mb');
  mb.textContent=d.mode; mb.className='badge '+(d.mode==='LIVE'?'b-live':'b-sim');
  const wb=$('wb');
  wb.className='badge '+(d.wsConnected?'b-ws-on':'b-ws-off');
  wb.innerHTML='<span class="bdot'+(d.wsConnected?' pulse':'')+'"></span>'+(d.wsConnected?'Live':'Off');
  $('mc').textContent=(d.wsMarkets||0)+' mkts';
  const bal=d.balance??0, start=d.startBalance??100;
  const pnl=bal-start;
  $('tb').textContent=fmt(bal);
  const tp=$('tp');
  tp.textContent=fmtPnl(pnl);
  tp.style.cssText=pS(pnl)+';font-size:12px;font-weight:700';

  // top stat cards
  const all=d.recentTrades??[], res=all.filter(t=>t.won!=null);
  const wins=res.filter(t=>t.won===true).length;
  const wr=res.length?wins/res.length:null;
  const pnlPct=start>0?(pnl/start*100):0;
  const active=(d.activePositions??[]).length;
  $('top-stats').innerHTML=
    '<div class="tsc tsc-b"><div class="tsc-lbl">Balance</div><div class="tsc-val" style="color:var(--t1)">'+fmt(bal)+'</div><div class="tsc-sub" style="'+pS(pnl)+'">'+fmtPnl(pnl)+' ('+(pnlPct>=0?'+':'')+pnlPct.toFixed(1)+'%)</div></div>'+
    '<div class="tsc tsc-g"><div class="tsc-lbl">Total P&amp;L</div><div class="tsc-val" style="'+pS(pnl)+'">'+fmtPnl(pnl)+'</div><div class="tsc-sub">since start</div></div>'+
    '<div class="tsc tsc-a"><div class="tsc-lbl">Win Rate</div><div class="tsc-val" style="'+(wr!=null?pS(wr-0.5):'')+'">'+( wr!=null?(wr*100).toFixed(0)+'%':'—')+'</div><div class="tsc-sub">'+wins+' wins / '+res.length+' resolved</div></div>'+
    '<div class="tsc tsc-p"><div class="tsc-lbl">Active Now</div><div class="tsc-val" style="color:var(--pu)">'+active+'</div><div class="tsc-sub">open positions</div></div>';

  // ticker
  const prices=d.prices??{}, moms=d.momentums??{}, assets=d.assets??Object.keys(prices);
  $('ticker').innerHTML=assets.map(a=>{
    const p=prices[a], m=moms[a], mc=m==null?'mn':m>0.0005?'mu':m<-0.0005?'md':'mn';
    return '<div class="tick"><div class="t-lbl">'+a+'</div><div class="t-px">'+fmtPx(p,a)+'</div><div class="t-mom '+mc+'">'+fmtPct(m)+'</div></div>';
  }).join('');

  // strategy cards
  const l=d.lem??{}, arb=d.arb??{}, sw=d.sweep??{};
  const lp=(l.totalPayout??0)-(l.totalSpent??0), ap=arb.guaranteedProfit??0;
  function sc(lbl,bar,cnt,sub,pnl2,w,lo){
    const tot=w+lo;
    const wrPct=tot?(w/tot*100):0;
    const wrCls=tot?(w/tot>0.62?'wr-h':w/tot<0.45?'wr-l':'wr-m'):'';
    const wrTxt=tot?'<span class="sc-wr '+wrCls+'">'+wrPct.toFixed(0)+'% WR</span>':'';
    const bar2=tot?'<div class="wbar"><div class="wfill" style="width:'+wrPct+'%;background:'+(w/tot>0.62?'var(--gn)':w/tot<0.45?'var(--rd)':'var(--am)')+'"></div></div>':'';
    return '<div class="sc"><div class="sc-bar '+bar+'"></div><div class="sc-lbl">'+lbl+'</div><div class="sc-val">'+cnt+'</div>'+bar2+
      '<div class="sc-row"><div class="sc-sub">'+sub+'</div>'+wrTxt+'</div>'+
      '<div class="sc-pnl" style="'+pS(pnl2)+'">'+fmtPnl(pnl2)+'</div></div>';
  }
  $('scards').innerHTML=
    sc('LEM Strategy','sc-bar-b',l.won+l.lost??0,(l.won??0)+'W  '+(l.lost??0)+'L',lp,l.won??0,l.lost??0)+
    '<div class="sc"><div class="sc-bar sc-bar-t"></div><div class="sc-lbl">ARB</div><div class="sc-val">'+(arb.entered??0)+'</div><div class="wbar" style="background:var(--br)"></div><div class="sc-row"><div class="sc-sub">Both filled: '+(arb.bothFilled??0)+'</div></div><div class="sc-pnl" style="'+pS(ap)+'">'+fmtPnl(ap)+'</div></div>'+
    '<div class="sc"><div class="sc-bar sc-bar-a"></div><div class="sc-lbl">Sweep</div><div class="sc-val">'+(sw.followed??0)+'</div><div class="wbar" style="background:var(--br)"></div><div class="sc-row"><div class="sc-sub">Follows LEM signals</div></div><div class="sc-pnl" style="color:var(--t3)">—</div></div>';

  // stat strip
  const avgE=res.length?(res.reduce((s,t)=>s+(t.entryPrice??0),0)/res.length*100).toFixed(1)+'¢':'—';
  const wrStyle=wr!=null?pS(wr-0.5):'';
  $('sstrip').innerHTML=
    '<div class="ss-cell"><div class="ss-lbl">Trades</div><div class="ss-val">'+res.length+'</div></div>'+
    '<div class="ss-cell"><div class="ss-lbl">Win Rate</div><div class="ss-val" style="'+wrStyle+'">'+(wr!=null?(wr*100).toFixed(1)+'%':'—')+'</div></div>'+
    '<div class="ss-cell"><div class="ss-lbl">Total P&amp;L</div><div class="ss-val" style="'+pS(pnl)+'">'+fmtPnl(pnl)+'</div></div>'+
    '<div class="ss-cell"><div class="ss-lbl">Avg Entry</div><div class="ss-val">'+avgE+'</div></div>'+
    '<div class="ss-cell"><div class="ss-lbl">Active</div><div class="ss-val" style="color:var(--blue)">'+active+'</div></div>';

  // overview chart
  _cd=d.pnlHistory??[]; _cs=start;
  drawOv();
  if(_cd.length>=2){
    const pct=(_cd[_cd.length-1].v-_cs)/_cs*100;
    $('cm-ov').textContent=res.length+' trades · '+(pct>=0?'+':'')+pct.toFixed(1)+'% return';
  }

  // performance tab
  if($('p-pf').classList.contains('on')) drawPf();
  const bv=_cd.map(p=>p.v), peak=bv.length?Math.max(...bv):_cs;
  const perfPct=_cd.length>=2?(_cd[_cd.length-1].v-_cs)/_cs*100:0;
  $('cm-pf').textContent=_cd.length>=2?res.length+' trades · '+(perfPct>=0?'+':'')+perfPct.toFixed(1)+'% total return':'';
  const maxDD=bv.length>1?(()=>{ let dd=0,hi=bv[0]; for(const v of bv){if(v>hi)hi=v; dd=Math.max(dd,(hi-v)/hi*100);} return dd; })():0;
  const avgT=res.length?res.reduce((s,t)=>s+((t.payout??0)-(t.totalSpent??0)),0)/res.length:0;
  const best=res.length?Math.max(...res.map(t=>(t.payout??0)-(t.totalSpent??0))):0;
  const worst=res.length?Math.min(...res.map(t=>(t.payout??0)-(t.totalSpent??0))):0;
  $('pgrid').innerHTML=
    pm('Starting Balance',fmt(_cs),'color:var(--t1)')+
    pm('Current Balance',fmt(bal),pS(pnl))+
    pm('Peak Balance',fmt(peak),'color:var(--gn)')+
    pm('Total Return',(perfPct>=0?'+':'')+perfPct.toFixed(2)+'%',pS(pnl))+
    pm('Max Drawdown','-'+maxDD.toFixed(1)+'%',maxDD>15?'color:var(--rd)':maxDD>8?'color:var(--am)':'color:var(--gn)')+
    pm('Total Trades',String(res.length),'color:var(--t1)')+
    pm('Win Rate',wr!=null?(wr*100).toFixed(1)+'%':'—',wr!=null?pS(wr-0.5):'')+
    pm('Avg Trade P&L',fmtPnl(avgT),pS(avgT))+
    pm('Best Trade',fmtPnl(best),'color:var(--gn)')+
    pm('Worst Trade',fmtPnl(worst),'color:var(--rd)')+
    pm('Avg Entry Price',avgE,'color:var(--t1)')+
    pm('Active Now',String(active),'color:var(--pu)');

  // analytics
  const an=d.analytics;
  if(an&&an.resolved>=5){
    const sug=an.suggestions??[];
    if(sug.length){
      $('isec').style.display='';
      $('ilist').innerHTML=sug.map(s=>{
        const c=s.includes('strong')||s.includes('prioritize')?'ig':s.includes('declining')||s.includes('avoid')||s.includes('reduce')?'ib':'iw';
        return '<div class="ins '+c+'">'+s+'</div>';
      }).join('');
    }
    const priceRows=Object.entries(an.priceBuckets??{}).map(([k,v])=>{
      const wc=v.winRate>0.65?'color:var(--gn)':v.winRate<0.45?'color:var(--rd)':'color:var(--am)';
      return '<tr><td>'+k+'</td><td>'+v.wins+'/'+v.losses+'</td><td style="'+wc+';font-weight:700">'+(v.winRate!=null?(v.winRate*100).toFixed(0)+'%':'—')+'</td></tr>';
    }).join('');
    const adapRows=Object.entries(d.adaptive??{}).sort((a,b)=>b[1].trades-a[1].trades).map(([k,v])=>{
      const wc=v.winRate>0.62?'color:var(--gn)':v.winRate<0.45?'color:var(--rd)':'color:var(--am)';
      const mc=v.multiplier>1.0?'color:var(--gn)':v.multiplier<1.0?'color:var(--rd)':'color:var(--t3)';
      return '<tr><td style="font-size:10px">'+k+'</td><td style="'+wc+';font-weight:700">'+(v.winRate*100).toFixed(0)+'%</td><td style="'+mc+';font-weight:700">'+v.multiplier.toFixed(2)+'x</td></tr>';
    }).join('');
    $('agrid').innerHTML=
      anTbl('By Strategy',Object.entries(an.byStrategy??{}).sort((a,b)=>(b[1].pnl??0)-(a[1].pnl??0)),true)+
      anTbl('By Asset',Object.entries(an.byAsset??{}).sort((a,b)=>(b[1].pnl??0)-(a[1].pnl??0)),true)+
      '<div class="ablk"><div class="atitle">By Entry Price</div><table class="atbl"><thead><tr><th>Range</th><th>W/L</th><th>WR</th></tr></thead><tbody>'+priceRows+'</tbody></table></div>'+
      '<div class="ablk"><div class="atitle">Adaptive Sizing</div><table class="atbl"><thead><tr><th>Key</th><th>WR</th><th>Mult</th></tr></thead><tbody>'+(adapRows||'<tr><td colspan="3" style="text-align:center;padding:12px;color:var(--t3)">No data yet</td></tr>')+'</tbody></table></div>';
  }

  // trades
  _all=(d.recentTrades??[]).slice().sort((a,b)=>(b.enteredAt??b.loggedAt??0)-(a.enteredAt??a.loggedAt??0));
  rTrades();

  // live — positions
  const pos=d.activePositions??[];
  $('pcnt').textContent=pos.length;
  $('pbody').innerHTML=pos.length===0
    ?'<div class="empty">No open positions</div>'
    :'<table><thead><tr><th>Left</th><th>Asset</th><th>Strategy</th><th>Side</th><th>Entry</th><th>Size</th><th>Status</th></tr></thead><tbody>'+
      pos.map(p=>{
        const side=p.side?'<span class="tag '+(p.side==='UP'?'t-up':'t-dn')+'">'+p.side+'</span>':'<span style="color:var(--t3)">Both</span>';
        const st=p.filled?'<span class="son">&#9679; Filled</span>':'<span class="soff">Pending</span>';
        return '<tr><td style="font-variant-numeric:tabular-nums">'+fmtL(p.windowEndMs??p.endMs)+'</td><td style="font-weight:700">'+(p.asset??'—')+'</td><td>'+stag(p)+'</td><td>'+side+'</td><td>'+(p.entryPrice!=null?(p.entryPrice*100).toFixed(1)+'¢':'—')+'</td><td>'+fmt(p.totalSpent)+'</td><td>'+st+'</td></tr>';
      }).join('')+'</tbody></table>';

  // live — ws feed (card grid)
  const ws=d.wsSample??[];
  if(ws.length){
    const nullCount=ws.filter(r=>r.up==null&&r.dn==null).length;
    const banner=nullCount>0&&nullCount===ws.length?'<div style="padding:10px 14px;color:var(--rd);font-size:11px;border-bottom:1px solid var(--br)">'+nullCount+' markets have null prices</div>':'';
    const cards=ws.map(r=>{
      const comb=r.up!=null&&r.dn!=null?r.up+r.dn:null;
      const isArb=comb!=null&&comb<0.97;
      const combC=comb!=null&&comb<0.97?'var(--gn)':comb!=null&&comb<0.99?'var(--am)':'var(--t2)';
      const upC=r.up!=null&&r.up<0.48&&r.up>=0.20?'var(--blue)':'var(--t1)';
      const dnC=r.dn!=null&&r.dn<0.48&&r.dn>=0.20?'var(--blue)':'var(--t1)';
      return '<div class="ws-cell'+(isArb?' ws-arb':'')+'">'+
        '<div class="ws-asset">'+r.asset+'</div>'+
        '<div class="ws-row"><span class="ws-side">UP</span><span class="ws-px" style="color:'+upC+'">'+(r.up!=null?(r.up*100).toFixed(1)+'¢':'<span class="ws-null">null</span>')+'</span></div>'+
        '<div class="ws-row"><span class="ws-side">DOWN</span><span class="ws-px" style="color:'+dnC+'">'+(r.dn!=null?(r.dn*100).toFixed(1)+'¢':'<span class="ws-null">null</span>')+'</span></div>'+
        '<div class="ws-comb"><span class="ws-comb-lbl">COMB</span><span class="ws-comb-val" style="color:'+combC+'">'+(comb!=null?comb.toFixed(3):'—')+'</span></div>'+
        '<div class="ws-exp">'+(r.endMs?'exp '+fmtL(r.endMs):'—')+'</div>'+
        '</div>';
    }).join('');
    $('wsbody').innerHTML=banner+'<div class="wsgrid">'+cards+'</div>';
  }
}

refresh();
setInterval(refresh,2000);
window.addEventListener('resize',()=>{
  draw('cv-ov','ct-ov',200);
  if($('p-pf').classList.contains('on')) draw('cv-pf','ct-pf',310);
});
</script>
</body>
</html>`;
