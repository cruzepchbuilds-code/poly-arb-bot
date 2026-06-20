import http from "http";
import { readFileSync } from "fs";

function readJsonl(path, limit = 0) {
  try {
    const raw = readFileSync(path, "utf8");
    const lines = raw.split("\n").filter(Boolean);
    const slice = limit > 0 ? lines.slice(-limit) : lines;
    return slice.map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
  } catch { return []; }
}

export function startWebServer(getState, port = 3000) {
  const server = http.createServer((req, res) => {
    const cors = { "Access-Control-Allow-Origin": "*", "Cache-Control": "no-cache" };

    if (req.url === "/api/state") {
      res.writeHead(200, { "Content-Type": "application/json", ...cors });
      try { res.end(JSON.stringify(getState())); }
      catch (e) { res.end(JSON.stringify({ error: e.message })); }
      return;
    }

    if (req.url === "/api/journal") {
      res.writeHead(200, { "Content-Type": "application/json", ...cors });
      try { res.end(JSON.stringify(readJsonl("trades.jsonl"))); }
      catch { res.end("[]"); }
      return;
    }

    if (req.url === "/api/findings") {
      res.writeHead(200, { "Content-Type": "application/json", ...cors });
      try { res.end(JSON.stringify(readJsonl("findings.jsonl", 500))); }
      catch { res.end("[]"); }
      return;
    }

    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(HTML);
  });

  server.listen(port, "0.0.0.0", () => console.error("[web] Dashboard → http://0.0.0.0:" + port));
  return server;
}

const HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>PolyArb Dashboard</title>
<style>
:root{
  --bg:#020810;--c2:#08121e;--c3:#0d1a2c;
  --b0:rgba(255,255,255,.04);--b1:rgba(255,255,255,.07);--b2:rgba(255,255,255,.11);--b3:rgba(255,255,255,.18);
  --tx:#c2daf5;--t2:#3d5e80;--t3:#1c3050;
  --bl:#2d8eff;--bla:rgba(45,142,255,.10);
  --gd:#f0a822;--gd2:#ffc547;--gda:rgba(240,168,34,.10);
  --gn:#00cc79;--gna:rgba(0,204,121,.10);
  --rd:#f03252;--rda:rgba(240,50,82,.10);
  --pu:#8b5cf6;--pua:rgba(139,92,246,.10);
  --tl:#00b0a0;--tla:rgba(0,176,160,.10);
  --r:12px;--r2:8px;
}
*{box-sizing:border-box;margin:0;padding:0}
body{background:var(--bg);color:var(--tx);font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:13px;line-height:1.45}
button{font-family:inherit}
.topbar{position:sticky;top:0;z-index:200;background:rgba(2,8,16,.96);backdrop-filter:blur(20px) saturate(180%);border-bottom:1px solid rgba(255,255,255,.05);box-shadow:0 1px 0 rgba(255,255,255,.02),0 8px 32px rgba(0,0,0,.6);height:56px;display:flex;align-items:center;padding:0 24px}
.logo{display:flex;align-items:center;gap:9px;font-size:14px;font-weight:800;letter-spacing:-.3px;color:var(--tx);margin-right:32px;flex-shrink:0}
.logo-icon{width:28px;height:28px;border-radius:8px;background:linear-gradient(135deg,#2d8eff,#8b5cf6);display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:900;color:#fff;box-shadow:0 2px 14px rgba(45,142,255,.4)}
.tabs{display:flex;align-items:stretch;height:100%}
.tab{height:100%;padding:0 18px;font-size:12px;font-weight:600;color:var(--t2);background:none;border:none;cursor:pointer;border-bottom:2px solid transparent;transition:color .15s,border-color .15s;white-space:nowrap;letter-spacing:.2px}
.tab:hover{color:rgba(194,218,245,.7)}
.tab.active{color:var(--bl);border-bottom-color:var(--bl)}
.topright{margin-left:auto;display:flex;align-items:center;gap:12px;flex-shrink:0}
.badge{display:inline-flex;align-items:center;gap:5px;padding:4px 11px;border-radius:6px;font-size:10px;font-weight:700;letter-spacing:.5px}
.b-live{background:rgba(0,204,121,.10);color:var(--gn);border:1px solid rgba(0,204,121,.22);box-shadow:0 0 12px rgba(0,204,121,.08)}
.b-sim{background:rgba(240,168,34,.10);color:var(--gd);border:1px solid rgba(240,168,34,.22)}
.b-ws-on{background:rgba(0,204,121,.10);color:var(--gn);border:1px solid rgba(0,204,121,.22);box-shadow:0 0 12px rgba(0,204,121,.08)}
.b-ws-off{background:rgba(240,50,82,.08);color:var(--rd);border:1px solid rgba(240,50,82,.18)}
.dot{width:6px;height:6px;border-radius:50%;background:currentColor}
.pulse{animation:pulse 2s infinite}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.2}}
.topbal{font-size:22px;font-weight:900;letter-spacing:-.8px;font-variant-numeric:tabular-nums;color:#daf0ff;text-shadow:0 0 30px rgba(100,190,255,.2)}
.toplbl{font-size:9px;color:var(--t2);letter-spacing:.8px;text-transform:uppercase;margin-top:1px}
.vd{width:1px;height:22px;background:rgba(255,255,255,.06)}
.goalbar{background:linear-gradient(180deg,#060e06 0%,#040a04 100%);border-bottom:1px solid rgba(240,168,34,.10);padding:14px 24px 12px;position:relative;overflow:hidden}
.goalbar::before{content:'';position:absolute;top:0;left:0;right:0;height:1px;background:linear-gradient(90deg,transparent 5%,rgba(240,168,34,.35) 25%,#f0a822 50%,rgba(240,168,34,.35) 75%,transparent 95%);box-shadow:0 0 24px rgba(240,168,34,.35),0 0 60px rgba(240,168,34,.10)}
.goal-inner{max-width:1500px;margin:0 auto}
.goal-row{display:flex;align-items:center;justify-content:space-between;margin-bottom:9px}
.goal-title{font-size:11px;font-weight:800;letter-spacing:1.2px;text-transform:uppercase;color:var(--gd);text-shadow:0 0 20px rgba(240,168,34,.4)}
.goal-stats{display:flex;align-items:center;gap:20px}
.gs{font-size:11px;color:var(--t2)}
.gs strong{color:var(--tx);font-variant-numeric:tabular-nums;font-weight:700}
.goaltrack{position:relative;height:14px;background:rgba(0,0,0,.7);border-radius:99px;overflow:hidden;border:1px solid rgba(240,168,34,.12);box-shadow:inset 0 2px 6px rgba(0,0,0,.6)}
.goalfill{height:100%;border-radius:99px;min-width:6px;background:linear-gradient(90deg,#5c3000,#a86000,#f0a822,#ffc547,#f0a822);box-shadow:0 0 20px rgba(240,168,34,.55),0 0 40px rgba(240,168,34,.18),inset 0 1px 0 rgba(255,255,255,.22);transition:width 1.2s cubic-bezier(.4,0,.2,1);position:relative;overflow:hidden}
.goalfill::after{content:'';position:absolute;top:0;left:-200%;right:-200%;height:100%;background:linear-gradient(90deg,transparent,rgba(255,255,255,.28),transparent);animation:shimmer 2.8s infinite}
@keyframes shimmer{to{left:200%}}
.ms-wrap{position:absolute;top:0;left:0;right:0;height:100%;pointer-events:none}
.ms{position:absolute;top:-1px;width:1px;height:16px;background:rgba(255,255,255,.12);transform:translateX(-50%)}
.ms-lbl-row{position:relative;margin-top:4px;height:13px}
.ms-lbl{position:absolute;font-size:9px;color:var(--t3);transform:translateX(-50%);white-space:nowrap;font-weight:600;letter-spacing:.3px;transition:color .4s}
.ms-lbl.reached{color:var(--gd);text-shadow:0 0 8px rgba(240,168,34,.4)}
.page{display:none;padding:16px 24px;max-width:1500px;margin:0 auto}
.page.active{display:block}
.g2{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.g3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px}
.g4{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}
.g52{display:grid;grid-template-columns:3fr 2fr;gap:12px}
.mb10{margin-bottom:10px}.mb14{margin-bottom:14px}
.card{background:linear-gradient(145deg,rgba(255,255,255,.03) 0%,transparent 100%);border:1px solid rgba(255,255,255,.07);border-radius:var(--r);padding:18px;box-shadow:0 2px 10px rgba(0,0,0,.45),inset 0 1px 0 rgba(255,255,255,.04)}
.card-sm{background:linear-gradient(145deg,rgba(255,255,255,.025) 0%,transparent 100%);border:1px solid rgba(255,255,255,.06);border-radius:var(--r);padding:14px 16px;box-shadow:0 2px 8px rgba(0,0,0,.38)}
.card-hd{font-size:10px;font-weight:700;letter-spacing:.9px;text-transform:uppercase;color:var(--t2);margin-bottom:14px;display:flex;align-items:center;justify-content:space-between}
.card-hd-r{font-size:10px;color:var(--t3);font-weight:400;text-transform:none;letter-spacing:0}
.statcard{border:1px solid rgba(255,255,255,.07);border-radius:var(--r);padding:20px;position:relative;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,.5),inset 0 1px 0 rgba(255,255,255,.06);transition:transform .2s,box-shadow .2s}
.statcard:hover{transform:translateY(-2px);box-shadow:0 10px 32px rgba(0,0,0,.55),inset 0 1px 0 rgba(255,255,255,.08)}
.statcard::before{content:'';position:absolute;top:0;left:0;right:0;height:2px}
.sc-bl{background:linear-gradient(145deg,rgba(45,142,255,.08) 0%,rgba(2,8,16,.92) 55%)}
.sc-bl::before{background:linear-gradient(90deg,rgba(45,142,255,.3),#2d8eff,rgba(45,142,255,.3));box-shadow:0 0 16px rgba(45,142,255,.6)}
.sc-gn{background:linear-gradient(145deg,rgba(0,204,121,.08) 0%,rgba(2,8,16,.92) 55%)}
.sc-gn::before{background:linear-gradient(90deg,rgba(0,204,121,.3),#00cc79,rgba(0,204,121,.3));box-shadow:0 0 16px rgba(0,204,121,.6)}
.sc-pu{background:linear-gradient(145deg,rgba(139,92,246,.08) 0%,rgba(2,8,16,.92) 55%)}
.sc-pu::before{background:linear-gradient(90deg,rgba(139,92,246,.3),#8b5cf6,rgba(139,92,246,.3));box-shadow:0 0 16px rgba(139,92,246,.6)}
.sc-tl{background:linear-gradient(145deg,rgba(0,176,160,.08) 0%,rgba(2,8,16,.92) 55%)}
.sc-tl::before{background:linear-gradient(90deg,rgba(0,176,160,.3),#00b0a0,rgba(0,176,160,.3));box-shadow:0 0 16px rgba(0,176,160,.6)}
.sc-lbl{font-size:10px;font-weight:600;letter-spacing:.9px;text-transform:uppercase;color:var(--t2);margin-bottom:10px}
.sc-val{font-size:30px;font-weight:900;letter-spacing:-1.2px;font-variant-numeric:tabular-nums;line-height:1}
.sc-sub{font-size:11px;color:var(--t2);margin-top:9px}
.pos{color:var(--gn);text-shadow:0 0 22px rgba(0,204,121,.3)}
.neg{color:var(--rd);text-shadow:0 0 22px rgba(240,50,82,.3)}
.zero{color:var(--t2)}
.ticker{display:flex;overflow-x:auto;background:linear-gradient(145deg,rgba(255,255,255,.025) 0%,transparent 100%);border:1px solid rgba(255,255,255,.06);border-radius:var(--r);box-shadow:0 2px 10px rgba(0,0,0,.42);scrollbar-width:none;margin-bottom:12px}
.ticker::-webkit-scrollbar{display:none}
.tick{display:flex;flex-direction:column;align-items:center;gap:3px;padding:10px 18px;border-right:1px solid rgba(255,255,255,.04);min-width:90px;flex-shrink:0;transition:background .15s}
.tick:last-child{border-right:none}
.tick:hover{background:rgba(255,255,255,.04)}
.tick-sym{font-size:10px;font-weight:700;color:var(--t2);letter-spacing:.5px}
.tick-px{font-size:13px;font-weight:700;font-variant-numeric:tabular-nums}
.tick-mom{font-size:10px;font-weight:700}
.mom-up{color:var(--gn)}.mom-dn{color:var(--rd)}.mom-flat{color:var(--t3)}
.chart-wrap{position:relative;height:190px;user-select:none}
.chart-svg{width:100%;height:100%;cursor:crosshair;display:block}
.chart-tip{display:none;position:absolute;background:rgba(8,18,32,.96);border:1px solid rgba(255,255,255,.10);backdrop-filter:blur(12px);border-radius:9px;padding:9px 13px;pointer-events:none;white-space:nowrap;z-index:10;box-shadow:0 4px 24px rgba(0,0,0,.6)}
.chart-tip-t{color:var(--t2);margin-bottom:3px;font-size:10px}
.chart-tip-v{font-size:15px;font-weight:800;font-variant-numeric:tabular-nums;color:#e0f0ff}
.chart-tip-p{font-size:11px;font-weight:700;margin-top:2px}
.tbl{width:100%;border-collapse:collapse;font-size:12px}
.tbl th{font-size:9px;font-weight:700;letter-spacing:.8px;text-transform:uppercase;color:var(--t2);padding:9px 12px;text-align:left;border-bottom:1px solid rgba(255,255,255,.05);white-space:nowrap;position:sticky;top:0;background:rgba(4,10,22,.99);z-index:2}
.tbl td{padding:9px 12px;border-bottom:1px solid rgba(255,255,255,.03);font-variant-numeric:tabular-nums;vertical-align:middle}
.tbl tr:last-child td{border-bottom:none}
.tbl tr:hover td{background:rgba(255,255,255,.025)}
.tbl-empty{text-align:center;padding:36px;color:var(--t3);font-size:12px}
.tbl-wrap{overflow-x:auto;overflow-y:auto;border-radius:var(--r);border:1px solid rgba(255,255,255,.06)}
.strat-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}
.sc{border:1px solid rgba(255,255,255,.07);border-radius:14px;padding:18px;position:relative;overflow:hidden;box-shadow:0 3px 12px rgba(0,0,0,.48),inset 0 1px 0 rgba(255,255,255,.05);transition:transform .2s cubic-bezier(.4,0,.2,1),box-shadow .2s,border-color .2s}
.sc:hover{border-color:rgba(255,255,255,.14);box-shadow:0 10px 36px rgba(0,0,0,.58),inset 0 1px 0 rgba(255,255,255,.08);transform:translateY(-2px)}
.sc-t0{background:linear-gradient(145deg,rgba(139,92,246,.09) 0%,rgba(2,8,16,.88) 55%)}
.sc-t1{background:linear-gradient(145deg,rgba(45,142,255,.09) 0%,rgba(2,8,16,.88) 55%)}
.sc-t2{background:linear-gradient(145deg,rgba(0,204,121,.08) 0%,rgba(2,8,16,.88) 55%)}
.sc-t3{background:linear-gradient(145deg,rgba(240,168,34,.08) 0%,rgba(2,8,16,.88) 55%)}
.sc-t4{background:linear-gradient(145deg,rgba(0,176,160,.08) 0%,rgba(2,8,16,.88) 55%)}
.sc-t5{background:linear-gradient(145deg,rgba(60,80,110,.09) 0%,rgba(2,8,16,.88) 55%)}
.sc-ta{background:linear-gradient(145deg,rgba(240,50,82,.08) 0%,rgba(2,8,16,.88) 55%)}
.sc::after{content:'';position:absolute;left:0;top:20px;bottom:20px;width:2px;border-radius:99px}
.sc-t0::after{background:var(--pu);box-shadow:0 0 10px rgba(139,92,246,.7)}
.sc-t1::after{background:var(--bl);box-shadow:0 0 10px rgba(45,142,255,.7)}
.sc-t2::after{background:var(--gn);box-shadow:0 0 10px rgba(0,204,121,.7)}
.sc-t3::after{background:var(--gd);box-shadow:0 0 10px rgba(240,168,34,.7)}
.sc-t4::after{background:var(--tl);box-shadow:0 0 10px rgba(0,176,160,.7)}
.sc-t5::after{background:var(--t2)}
.sc-ta::after{background:var(--rd);box-shadow:0 0 10px rgba(240,50,82,.7)}
.tier{display:inline-block;font-size:9px;font-weight:800;letter-spacing:1px;text-transform:uppercase;padding:2px 8px;border-radius:5px;margin-bottom:10px}
.t0{background:rgba(139,92,246,.15);color:var(--pu)}.t1{background:rgba(45,142,255,.15);color:var(--bl)}
.t2{background:rgba(0,204,121,.13);color:var(--gn)}.t3{background:rgba(240,168,34,.13);color:var(--gd)}
.t4{background:rgba(0,176,160,.13);color:var(--tl)}.t5{background:rgba(60,80,110,.15);color:var(--t2)}
.ta{background:rgba(240,50,82,.13);color:var(--rd)}
.sc-name{font-size:16px;font-weight:800;margin-bottom:4px;padding-left:10px}
.sc-desc{font-size:10px;color:var(--t2);line-height:1.5;margin-bottom:14px;padding-left:10px}
.sc-stats{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.ssi-lbl{font-size:9px;color:var(--t3);font-weight:600;letter-spacing:.5px;text-transform:uppercase}
.ssi-val{font-size:15px;font-weight:700;font-variant-numeric:tabular-nums}
.wr-track{height:3px;background:rgba(255,255,255,.05);border-radius:99px;margin-top:6px;overflow:hidden}
.wr-fill{height:100%;border-radius:99px;background:var(--gn);box-shadow:0 0 8px rgba(0,204,121,.5);transition:width .6s}
.wr-fill.warn{background:var(--gd);box-shadow:0 0 8px rgba(240,168,34,.5)}
.wr-fill.bad{background:var(--rd);box-shadow:0 0 8px rgba(240,50,82,.5)}
.sig-card{background:linear-gradient(145deg,rgba(255,255,255,.025) 0%,transparent 100%);border:1px solid rgba(255,255,255,.07);border-radius:var(--r);padding:16px;box-shadow:0 2px 10px rgba(0,0,0,.38)}
.sig-lbl{font-size:10px;font-weight:700;letter-spacing:.6px;text-transform:uppercase;color:var(--t2);margin-bottom:8px}
.sig-dir{font-size:24px;font-weight:800;margin-bottom:4px}
.sig-sub{font-size:11px;color:var(--t2);line-height:1.4}
.ev-banner{background:rgba(240,168,34,.06);border:1px solid rgba(240,168,34,.18);border-radius:var(--r2);padding:10px 16px;margin-bottom:12px;display:flex;align-items:center;gap:10px;font-size:12px;box-shadow:0 0 20px rgba(240,168,34,.06)}
.fund-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}
.fund-cell{background:rgba(255,255,255,.025);border:1px solid rgba(255,255,255,.05);border-radius:var(--r2);padding:11px 13px;transition:background .15s}
.fund-cell:hover{background:rgba(255,255,255,.04)}
.fund-sym{font-size:10px;font-weight:700;color:var(--t2);margin-bottom:5px}
.fund-rate{font-size:15px;font-weight:700;font-variant-numeric:tabular-nums}
.whale-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}
.whale-cell{background:rgba(255,255,255,.025);border:1px solid rgba(255,255,255,.05);border-radius:var(--r2);padding:11px 13px}
.findings-wrap{display:flex;flex-direction:column;gap:10px}
.finding{background:linear-gradient(145deg,rgba(255,255,255,.025) 0%,transparent 100%);border:1px solid rgba(255,255,255,.06);border-radius:var(--r);padding:16px 18px;border-left:3px solid rgba(255,255,255,.08);box-shadow:0 2px 10px rgba(0,0,0,.32)}
.f-critical{border-left-color:var(--rd);box-shadow:0 2px 10px rgba(0,0,0,.32),-3px 0 18px rgba(240,50,82,.10)}
.f-warning{border-left-color:var(--gd);box-shadow:0 2px 10px rgba(0,0,0,.32),-3px 0 18px rgba(240,168,34,.10)}
.f-opportunity{border-left-color:var(--gn);box-shadow:0 2px 10px rgba(0,0,0,.32),-3px 0 18px rgba(0,204,121,.10)}
.f-info{border-left-color:var(--bl);box-shadow:0 2px 10px rgba(0,0,0,.32),-3px 0 18px rgba(45,142,255,.10)}
.f-hd{display:flex;align-items:center;gap:8px;margin-bottom:8px;flex-wrap:wrap}
.fsev{font-size:9px;font-weight:800;letter-spacing:.8px;text-transform:uppercase;padding:2px 8px;border-radius:5px}
.fsev-critical{background:rgba(240,50,82,.15);color:var(--rd)}
.fsev-warning{background:rgba(240,168,34,.13);color:var(--gd)}
.fsev-opportunity{background:rgba(0,204,121,.13);color:var(--gn)}
.fsev-info{background:rgba(45,142,255,.13);color:var(--bl)}
.fcat{font-size:9px;color:var(--t3);font-weight:600;text-transform:uppercase;letter-spacing:.5px}
.ftitle{font-size:14px;font-weight:700;color:var(--tx);margin-bottom:6px}
.fbody{font-size:12px;color:var(--t2);line-height:1.6;margin-bottom:9px}
.fmetric{display:flex;align-items:center;gap:12px;font-size:11px;color:var(--t2);background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.05);border-radius:7px;padding:7px 12px;margin-bottom:7px}
.ftime{font-size:10px;color:var(--t3)}
.findings-empty{text-align:center;padding:56px;color:var(--t3);font-size:12px;line-height:2}
.agent-hd{display:flex;align-items:flex-start;justify-content:space-between}
.agent-title{font-size:15px;font-weight:700}
.agent-sub{font-size:11px;color:var(--t2);margin-top:4px;line-height:1.5}
.agent-meta{font-size:11px;color:var(--t3);text-align:right;flex-shrink:0;margin-left:16px}
.j-controls{display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap;align-items:center}
.j-sel,.j-search{background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);color:var(--tx);border-radius:var(--r2);padding:7px 11px;font-size:12px;outline:none;font-family:inherit;transition:border-color .15s}
.j-sel:focus,.j-search:focus{border-color:rgba(45,142,255,.4)}
.j-stat{display:inline-flex;gap:5px;align-items:center;padding:6px 13px;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.07);border-radius:var(--r2);font-size:12px;color:var(--t2)}
.j-stat strong{color:var(--tx);font-variant-numeric:tabular-nums}
.j-pages{display:flex;align-items:center;gap:10px;margin-top:12px}
.j-btn{background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);color:var(--t2);border-radius:var(--r2);padding:6px 16px;font-size:12px;cursor:pointer;transition:all .15s}
.j-btn:hover:not(:disabled){color:var(--tx);border-color:rgba(255,255,255,.16);background:rgba(255,255,255,.07)}
.j-btn:disabled{opacity:.25;cursor:default}
.j-page-info{font-size:12px;color:var(--t3);font-variant-numeric:tabular-nums}
.j-wrap{overflow-x:auto;max-height:520px;overflow-y:auto;border-radius:var(--r);border:1px solid rgba(255,255,255,.06)}
.adap-mult{font-size:12px;font-weight:700;padding:3px 9px;border-radius:5px;font-variant-numeric:tabular-nums}
.am-high{background:rgba(0,204,121,.13);color:var(--gn)}
.am-med{background:rgba(240,168,34,.11);color:var(--gd)}
.am-low{background:rgba(240,50,82,.13);color:var(--rd)}
.bar-wrap{height:5px;background:rgba(255,255,255,.05);border-radius:99px;overflow:hidden;margin-top:5px}
.bar-fill{height:100%;border-radius:99px;transition:width .6s}
.tag{display:inline-block;padding:2px 8px;border-radius:5px;font-size:10px;font-weight:700}
.tag-up{background:rgba(0,204,121,.13);color:var(--gn)}
.tag-dn{background:rgba(240,50,82,.13);color:var(--rd)}
.tag-w{background:rgba(0,204,121,.13);color:var(--gn)}
.tag-l{background:rgba(240,50,82,.13);color:var(--rd)}
.tag-p{background:rgba(60,80,110,.15);color:var(--t2)}
.ts{font-size:10px;color:var(--t3)}
</style>
</head>
<body>

<div class="topbar">
  <div class="logo"><div class="logo-icon">PA</div>PolyArb</div>
  <div class="tabs">
    <button class="tab active" data-tab="overview">Overview</button>
    <button class="tab" data-tab="strategies">Strategies</button>
    <button class="tab" data-tab="signals">Signals</button>
    <button class="tab" data-tab="research">Research</button>
    <button class="tab" data-tab="journal">Journal</button>
    <button class="tab" data-tab="analytics">Analytics</button>
  </div>
  <div class="topright">
    <span id="mode-badge" class="badge b-sim"><span class="dot pulse"></span>SIM</span>
    <div class="vd"></div>
    <span id="ws-badge" class="badge b-ws-off"><span class="dot"></span>WS OFF</span>
    <div class="vd"></div>
    <div><div class="topbal" id="top-bal">&mdash;</div><div class="toplbl">USDC BALANCE</div></div>
    <div class="vd"></div>
    <div class="ts" id="last-update">&mdash;</div>
  </div>
</div>

<div class="goalbar">
  <div class="goal-inner">
    <div class="goal-row">
      <div class="goal-title">&#127942;&nbsp; $100,000 GOAL</div>
      <div class="goal-stats">
        <div class="gs">Progress: <strong id="g-pct" style="color:var(--gd)">0.00%</strong></div>
        <div class="gs">Balance: <strong id="g-bal">&mdash;</strong></div>
        <div class="gs">Remaining: <strong id="g-rem">$100,000</strong></div>
        <div class="gs">Total P&amp;L: <strong id="g-pnl">&mdash;</strong></div>
        <div class="gs">Today: <strong id="g-today">&mdash;</strong></div>
        <div class="gs">ETA: <strong id="g-eta" style="color:var(--gd)">&mdash;</strong></div>
      </div>
    </div>
    <div class="goaltrack">
      <div class="goalfill" id="g-fill" style="width:0.2%"></div>
      <div class="ms-wrap" id="g-ms"></div>
    </div>
    <div class="ms-lbl-row" id="g-lbls"></div>
  </div>
</div>

<!-- OVERVIEW -->
<div class="page active" id="pg-overview">
  <div class="g4 mb14">
    <div class="statcard sc-bl"><div class="sc-lbl">Balance</div><div class="sc-val" id="ov-bal">&mdash;</div><div class="sc-sub" id="ov-bal-sub">&mdash;</div></div>
    <div class="statcard sc-gn"><div class="sc-lbl">Total P&amp;L</div><div class="sc-val" id="ov-pnl">&mdash;</div><div class="sc-sub" id="ov-pnl-sub">&mdash;</div></div>
    <div class="statcard sc-pu"><div class="sc-lbl">Active Positions</div><div class="sc-val" id="ov-pos">0</div><div class="sc-sub" id="ov-pos-sub">&mdash;</div></div>
    <div class="statcard sc-tl"><div class="sc-lbl">Win Rate</div><div class="sc-val" id="ov-wr">&mdash;</div><div class="sc-sub" id="ov-wr-sub">&mdash;</div></div>
  </div>
  <div class="ticker mb14" id="ticker"></div>
  <div class="g52 mb14">
    <div class="card">
      <div class="card-hd">P&amp;L History <span class="card-hd-r" id="chart-range">&mdash;</span></div>
      <div class="chart-wrap">
        <svg id="chart-svg" class="chart-svg" viewBox="0 0 800 160" preserveAspectRatio="none"></svg>
        <div id="chart-tip" class="chart-tip"><div class="chart-tip-t" id="tip-t"></div><div class="chart-tip-v" id="tip-v"></div><div class="chart-tip-p" id="tip-p"></div></div>
      </div>
    </div>
    <div class="card">
      <div class="card-hd">Active Positions <span class="card-hd-r" id="pos-count">0</span></div>
      <div class="tbl-wrap" style="max-height:210px"><table class="tbl"><thead><tr><th>Asset</th><th>Side</th><th>Entry</th><th>Bet</th><th>Left</th></tr></thead><tbody id="pos-tbody"></tbody></table></div>
    </div>
  </div>
  <div class="card">
    <div class="card-hd">Recent Trades <span class="card-hd-r" id="recent-count">&mdash;</span></div>
    <div class="tbl-wrap"><table class="tbl"><thead><tr><th>#</th><th>Time</th><th>Asset</th><th>Strategy</th><th>Side</th><th>Entry &#162;</th><th>Bet</th><th>Payout</th><th>Net P&amp;L</th><th>Result</th></tr></thead><tbody id="recent-tbody"></tbody></table></div>
  </div>
</div>

<!-- STRATEGIES -->
<div class="page" id="pg-strategies">
  <div class="strat-grid mb14" id="strat-grid"></div>
  <div class="card"><div class="card-hd">Combined Strategy P&amp;L</div><div class="g4" id="strat-pnl-row"></div></div>
</div>

<!-- SIGNALS -->
<div class="page" id="pg-signals">
  <div id="event-wrap"></div>
  <div class="g4 mb10" id="sig-top"></div>
  <div class="g2 mb10">
    <div class="card"><div class="card-hd">Funding Rates (8h)</div><div class="fund-grid" id="fund-grid"></div></div>
    <div class="card"><div class="card-hd">Whale &amp; Buy Pressure</div><div class="whale-grid" id="whale-grid"></div></div>
  </div>
  <div class="card"><div class="card-hd">Asset Momentum</div><div id="mom-grid" class="g4"></div></div>
</div>

<!-- RESEARCH -->
<div class="page" id="pg-research">
  <div class="card mb10"><div class="agent-hd"><div><div class="agent-title">Research Agent</div><div class="agent-sub">Analyzes trade history every 30 minutes. Surfaces strategy flaws, sizing errors, and new opportunities.</div></div><div class="agent-meta" id="agent-meta">Loading&hellip;</div></div></div>
  <div id="findings-wrap" class="findings-wrap"><div class="findings-empty">Loading research findings&hellip;</div></div>
</div>

<!-- JOURNAL -->
<div class="page" id="pg-journal">
  <div class="j-controls">
    <select class="j-sel" id="jf-strat" onchange="applyFilter()">
      <option value="all">All Strategies</option>
      <option value="OPENSNIPE">OPS &mdash; Opening Snipe</option>
      <option value="ORACLESNIPE">OS &mdash; Oracle Snipe</option>
      <option value="LATENCYBOND">LB &mdash; Latency Bond</option>
      <option value="FUNDINGSNIPE">FS &mdash; Funding Snipe</option>
      <option value="CLOBIMB">CI &mdash; CLOB Imbalance</option>
      <option value="MAKERREBATE">MR &mdash; Maker Rebate</option>
      <option value="LEM">LEM</option>
    </select>
    <select class="j-sel" id="jf-asset" onchange="applyFilter()">
      <option value="all">All Assets</option>
      <option>BTC</option><option>ETH</option><option>SOL</option><option>XRP</option>
      <option>DOGE</option><option>AVAX</option><option>LINK</option><option>MATIC</option>
    </select>
    <select class="j-sel" id="jf-out" onchange="applyFilter()">
      <option value="all">All Outcomes</option>
      <option value="won">Won</option><option value="lost">Lost</option><option value="pending">Pending</option>
    </select>
    <input class="j-search" id="jf-q" type="text" placeholder="Search&hellip;" oninput="applyFilter()">
    <span class="j-stat">Trades: <strong id="j-total">0</strong></span>
    <span class="j-stat">WR: <strong id="j-wr">&mdash;</strong></span>
    <span class="j-stat">P&amp;L: <strong id="j-pnl">&mdash;</strong></span>
  </div>
  <div class="j-wrap">
    <table class="tbl"><thead><tr><th>#</th><th>Time</th><th>Asset</th><th>Strategy</th><th>Side</th><th>Entry &#162;</th><th>Bet</th><th>Payout</th><th>Net P&amp;L</th><th>Result</th></tr></thead><tbody id="j-tbody"></tbody></table>
  </div>
  <div class="j-pages">
    <button class="j-btn" id="j-prev" onclick="jPage(-1)">&#8592; Prev</button>
    <span class="j-page-info" id="j-page-info">&mdash;</span>
    <button class="j-btn" id="j-next" onclick="jPage(1)">Next &#8594;</button>
  </div>
</div>

<!-- ANALYTICS -->
<div class="page" id="pg-analytics">
  <div class="g2 mb10">
    <div class="card">
      <div class="card-hd">Adaptive Sizer &mdash; Per Strategy:Asset</div>
      <div class="tbl-wrap" style="max-height:360px"><table class="tbl"><thead><tr><th>Pair</th><th>Trades</th><th>Win Rate</th><th>Multiplier</th></tr></thead><tbody id="adap-tbody"></tbody></table></div>
    </div>
    <div class="card">
      <div class="card-hd">Per-Strategy Summary</div>
      <div class="tbl-wrap" style="max-height:360px"><table class="tbl"><thead><tr><th>Strategy</th><th>Entered</th><th>Won/Lost</th><th>WR%</th><th>P&amp;L</th></tr></thead><tbody id="strat-tbody"></tbody></table></div>
    </div>
  </div>
  <div class="card"><div class="card-hd">Per-Asset Performance (from recentTrades)</div><div id="asset-grid" class="g4"></div></div>
</div>

<script>
var S = {}, journal = [], findings = [], curTab = 'overview';
var jFiltered = [], jCurPage = 0, J_PER = 50;
var jFilter = { strategy: 'all', asset: 'all', outcome: 'all', q: '' };

document.addEventListener('DOMContentLoaded', function() {
  initTabs();
  initMilestones();
  poll();
  setInterval(poll, 2000);
  setInterval(pollJournal, 30000);
  setInterval(pollFindings, 60000);
  pollJournal();
  pollFindings();
});

function initTabs() {
  document.querySelectorAll('.tab').forEach(function(btn) {
    btn.addEventListener('click', function() { switchTab(btn.getAttribute('data-tab')); });
  });
}

function switchTab(tab) {
  curTab = tab;
  document.querySelectorAll('.tab').forEach(function(b) { b.classList.toggle('active', b.getAttribute('data-tab') === tab); });
  document.querySelectorAll('.page').forEach(function(p) { p.classList.toggle('active', p.id === 'pg-' + tab); });
  if (tab === 'journal') renderJournal();
  if (tab === 'research') renderFindings();
  if (tab === 'overview') drawChart();
}

async function poll() {
  try { var r = await fetch('/api/state'); if (!r.ok) return; S = await r.json(); render(); } catch(e) {}
}
async function pollJournal() {
  try { var r = await fetch('/api/journal'); if (!r.ok) return; journal = await r.json(); applyFilter(); if (curTab==='journal') renderJournal(); } catch(e) {}
}
async function pollFindings() {
  try {
    var r = await fetch('/api/findings'); if (!r.ok) return;
    findings = (await r.json()).sort(function(a,b){ return new Date(b.createdAt)-new Date(a.createdAt); });
    if (curTab==='research') renderFindings();
  } catch(e) {}
}

function g(id) { return document.getElementById(id); }
function set(id, v) { var el=g(id); if(el) el.textContent=v; }
function setHtml(id, v) { var el=g(id); if(el) el.innerHTML=v; }

function fu(n, dec) {
  if (n==null||isNaN(n)) return '—';
  dec = dec!=null ? dec : 2;
  return '$'+Math.abs(n).toLocaleString('en-US',{minimumFractionDigits:dec,maximumFractionDigits:dec});
}
function fuS(n) {
  if (n==null||isNaN(n)) return '—';
  return (n>=0?'+':'-')+'$'+Math.abs(n).toFixed(2);
}
function fp(n) { if (n==null||isNaN(n)) return '—'; return (n*100).toFixed(1)+'%'; }
function wr(won,lost) { var t=(won||0)+(lost||0); return t>0?(won||0)/t:null; }
function pnlOf(s) { if(!s) return 0; return (s.totalPayout||0)-(s.totalSpent||0); }
function pCls(n) { return n>0.005?'pos':n<-0.005?'neg':'zero'; }
function fDur(ms) {
  if(ms==null||ms<0) return '—';
  var s=Math.floor(ms/1000);
  if(s<60) return s+'s'; var m=Math.floor(s/60);
  if(m<60) return m+'m '+(s%60)+'s'; return Math.floor(m/60)+'h '+(m%60)+'m';
}
function fAgo(ts) {
  if(!ts) return '—'; var d=Date.now()-new Date(ts).getTime();
  if(d<60000) return Math.floor(d/1000)+'s ago'; if(d<3600000) return Math.floor(d/60000)+'m ago';
  if(d<86400000) return Math.floor(d/3600000)+'h ago'; return Math.floor(d/86400000)+'d ago';
}
function fTime(ts) {
  if(!ts) return '—'; var d=new Date(ts);
  return d.toLocaleString('en-US',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false});
}
function fPx(n) { if(n==null) return '—'; return (n*100).toFixed(1)+'&#162;'; }
function esc(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

function render() {
  renderTop();
  renderGoal();
  if (curTab==='overview')   renderOverview();
  if (curTab==='strategies') renderStrategies();
  if (curTab==='signals')    renderSignals();
  if (curTab==='analytics')  renderAnalytics();
}

function renderTop() {
  var bal=S.balance;
  set('top-bal', bal!=null ? fu(bal) : '—');
  var mEl=g('mode-badge');
  if(mEl){ mEl.className='badge '+(S.mode==='LIVE'?'b-live':'b-sim'); mEl.innerHTML='<span class="dot'+(S.mode==='LIVE'?' pulse':'')+'"></span>'+(S.mode||'SIM'); }
  var wEl=g('ws-badge');
  if(wEl){ wEl.className='badge '+(S.wsConnected?'b-ws-on':'b-ws-off'); wEl.innerHTML='<span class="dot'+(S.wsConnected?' pulse':'')+'"></span>'+(S.wsConnected?'WS '+(S.wsMarkets||0)+' mkts':'WS OFF'); }
  set('last-update', S.timestamp?fAgo(S.timestamp):'—');
}

function initMilestones() {
  var ms=[1000,2000,5000,10000,25000,50000,100000];
  var mEl=g('g-ms'), lEl=g('g-lbls');
  if(!mEl||!lEl) return;
  var mh='', lh='';
  ms.forEach(function(v){
    var p=v/1000;
    mh+='<div class="ms" style="left:'+p+'%"></div>';
    lh+='<div class="ms-lbl" id="ms-'+v+'" style="left:'+p+'%">'+(v>=1000?'$'+(v/1000)+'k':'$'+v)+'</div>';
  });
  mEl.innerHTML=mh; lEl.innerHTML=lh;
}

function renderGoal() {
  var bal=S.balance||0, start=S.startBalance||bal, GOAL=100000;
  var pct=Math.min(100,(bal/GOAL)*100);
  var fill=g('g-fill'); if(fill) fill.style.width=Math.max(0.2,pct)+'%';
  set('g-pct', pct.toFixed(2)+'%');
  set('g-bal', fu(bal));
  set('g-rem', fu(Math.max(0,GOAL-bal)));
  var tp=bal-start, tEl=g('g-pnl');
  if(tEl){ tEl.textContent=fuS(tp); tEl.className=pCls(tp); }
  var hist=S.pnlHistory||[], dayAgo=Date.now()-86400000, dayStart=null;
  for(var i=0;i<hist.length;i++){ if(hist[i].t>=dayAgo){dayStart=hist[i].v;break;} }
  var todayPnl=dayStart!=null?(bal-dayStart):null, tdEl=g('g-today');
  if(tdEl){ tdEl.textContent=todayPnl!=null?fuS(todayPnl):'—'; if(todayPnl!=null) tdEl.className=pCls(todayPnl); }
  var rate=calcDailyRate(hist,bal), etaEl=g('g-eta');
  if(etaEl){
    var rem=Math.max(0,GOAL-bal);
    if(rate>0&&rem>0){
      var days=rem/rate;
      etaEl.textContent=days<1?Math.round(days*24)+'h':days<7?days.toFixed(1)+'d':days<30?Math.round(days)+'d':Math.round(days/30)+'mo';
    } else { etaEl.textContent=rate<=0?'N/A':'Done!'; }
    etaEl.style.color='var(--gd)';
  }
  [1000,2000,5000,10000,25000,50000,100000].forEach(function(v){
    var el=g('ms-'+v); if(el) el.className='ms-lbl'+(bal>=v?' reached':'');
  });
}

function calcDailyRate(hist,bal) {
  if(!hist||hist.length<2) return 0;
  var cutoff=Date.now()-7*86400000, sl=hist.filter(function(p){return p.t>=cutoff;});
  if(sl.length<2) sl=hist; if(sl.length<2) return 0;
  var dt=sl[sl.length-1].t-sl[0].t, dv=sl[sl.length-1].v-sl[0].v;
  return dt>0?(dv/dt)*86400000:0;
}

function renderOverview() {
  var bal=S.balance||0, start=S.startBalance||bal, tp=bal-start;
  set('ov-bal', fu(bal));
  var bsEl=g('ov-bal-sub'); if(bsEl) bsEl.textContent='Started: '+fu(start);
  var pEl=g('ov-pnl'); if(pEl){ pEl.textContent=fuS(tp); pEl.className='sc-val '+pCls(tp); }
  var psEl=g('ov-pnl-sub'); if(psEl){ var roi=start>0?(tp/start*100).toFixed(1):'0.0'; psEl.textContent=roi+'% ROI'; }
  var pos=S.activePositions||[];
  set('ov-pos', pos.length);
  var posSub=g('ov-pos-sub');
  if(posSub){ var dep=pos.reduce(function(a,p){return a+(p.totalSpent||0);},0); posSub.textContent=dep>0?fu(dep)+' deployed':'None open'; }
  var aw=0,al=0;
  ['opensnipe','oraclesnipe','latencybond','fundingsnipe','clobimb','makerrebate'].forEach(function(k){var s=S[k];if(s){aw+=(s.won||0);al+=(s.lost||0);}});
  var wrv=wr(aw,al);
  var wrEl=g('ov-wr'); if(wrEl){ wrEl.textContent=wrv!=null?fp(wrv):'—'; wrEl.className='sc-val '+(wrv!=null?(wrv>=0.62?'pos':wrv>=0.50?'zero':'neg'):''); }
  var wrSEl=g('ov-wr-sub'); if(wrSEl) wrSEl.textContent=(aw+al)+' resolved';
  renderTicker(); renderPositions(); renderRecentTrades(); drawChart();
}

function renderTicker() {
  var el=g('ticker'); if(!el) return;
  var assets=S.assets||['BTC','ETH','SOL','XRP','DOGE','AVAX','LINK','MATIC'];
  var prices=S.prices||{}, moms=S.momentums||{};
  el.innerHTML=assets.map(function(a){
    var p=prices[a], m=moms[a];
    var px=p!=null?(p>1000?fu(p,0):fu(p,2)):'—';
    var mc=m>0.001?'mom-up':m<-0.001?'mom-dn':'mom-flat';
    var ms=m!=null?(m>0?'+':'')+(m*100).toFixed(2)+'%':'—';
    return '<div class="tick"><div class="tick-sym">'+a+'</div><div class="tick-px">'+px+'</div><div class="tick-mom '+mc+'">'+ms+'</div></div>';
  }).join('');
}

function renderPositions() {
  var tb=g('pos-tbody'), cnt=g('pos-count'); if(!tb) return;
  var pos=S.activePositions||[];
  if(cnt) cnt.textContent=pos.length;
  if(!pos.length){ tb.innerHTML='<tr><td colspan="5" class="tbl-empty">No active positions</td></tr>'; return; }
  tb.innerHTML=pos.map(function(p){
    if(p.type==='directional'){
      var sTag=p.side==='UP'?'<span class="tag tag-up">UP</span>':'<span class="tag tag-dn">DN</span>';
      return '<tr><td>'+p.asset+'</td><td>'+sTag+'</td><td>'+fPx(p.entryPrice)+'</td><td>'+fu(p.totalSpent)+'</td><td>'+fDur(p.remainingMs)+'</td></tr>';
    }
    return '<tr><td>'+p.asset+'</td><td><span class="tag tag-p">ARB</span></td><td>'+fp(p.combined)+'</td><td>'+fu(p.totalSpent)+'</td><td>'+fDur(p.remainingMs)+'</td></tr>';
  }).join('');
}

function renderRecentTrades() {
  var tb=g('recent-tbody'); if(!tb) return;
  var trades=(S.recentTrades||[]).slice().sort(function(a,b){return(b.enteredAt||0)-(a.enteredAt||0);}).slice(0,25);
  set('recent-count','last '+trades.length);
  if(!trades.length){ tb.innerHTML='<tr><td colspan="10" class="tbl-empty">No trades recorded yet</td></tr>'; return; }
  tb.innerHTML=trades.map(function(t,i){ return trRow(t,i+1,trades.length); }).join('');
}

function trRow(t,i,total) {
  var n=t.won===true?'<span class="tag tag-w">WIN</span>':t.won===false?'<span class="tag tag-l">LOSS</span>':'<span class="tag tag-p">&mdash;</span>';
  var side=t.side==='UP'?'<span class="tag tag-up">UP</span>':t.side==='DOWN'?'<span class="tag tag-dn">DN</span>':'&mdash;';
  var net=(t.payout||0)-(t.totalSpent||0);
  var nc=pCls(net);
  var ns=t.won==null?'&mdash;':'<span class="'+nc+'">'+fuS(net)+'</span>';
  return '<tr><td class="zero">'+(total-i+1)+'</td><td class="ts">'+fTime(t.enteredAt)+'</td><td>'+esc(t.asset||'')+'</td>'+
    '<td class="zero" style="font-size:11px">'+esc(t.strategy||'')+'</td><td>'+side+'</td><td>'+fPx(t.entryPrice)+'</td>'+
    '<td>'+fu(t.totalSpent)+'</td><td>'+fu(t.payout)+'</td><td>'+ns+'</td><td>'+n+'</td></tr>';
}

function drawChart() {
  var svg=g('chart-svg'); if(!svg) return;
  var hist=S.pnlHistory||[];
  if(hist.length<2){
    svg.innerHTML='<text x="400" y="80" fill="#2a4060" font-size="12" text-anchor="middle" dominant-baseline="middle">No P&amp;L history yet</text>';
    return;
  }
  var W=800,H=160,pL=6,pR=54,pT=10,pB=22,cw=W-pL-pR,ch=H-pT-pB;
  var ts=hist.map(function(p){return p.t;}), vs=hist.map(function(p){return p.v;});
  var tmin=Math.min.apply(null,ts),tmax=Math.max.apply(null,ts);
  var vmin=Math.min.apply(null,vs),vmax=Math.max.apply(null,vs);
  var vr=vmax-vmin||1, tr2=tmax-tmin||1;
  function tx(t){return pL+((t-tmin)/tr2)*cw;}
  function ty(v){return pT+ch-((v-vmin)/vr)*ch;}
  var pts=hist.map(function(p){return tx(p.t)+','+ty(p.v);}).join(' L ');
  var pathD='M '+pts;
  var startV=S.startBalance||vs[0], lastV=vs[vs.length-1];
  var color=lastV>=startV?'#00d084':'#ff4455';
  var baseY=Math.max(pT,Math.min(pT+ch,ty(startV)));
  var fillD=pathD+' L '+tx(ts[ts.length-1])+','+(pT+ch)+' L '+pL+','+(pT+ch)+' Z';
  function fK(v){return v>=1000?'$'+(v/1000).toFixed(v>=10000?0:1)+'k':'$'+v.toFixed(0);}
  function fDT(t){var d=new Date(t);return (d.getMonth()+1)+'/'+d.getDate()+' '+String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0');}
  var midT=tmin+(tmax-tmin)/2;
  var rangeEl=g('chart-range');
  if(rangeEl){var sp=Math.round((tmax-tmin)/60000);rangeEl.textContent=sp<60?sp+'m':(Math.floor(sp/60)+'h '+(sp%60)+'m');}
  svg.innerHTML=
    '<defs><linearGradient id="cg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="'+color+'" stop-opacity="0.22"/><stop offset="100%" stop-color="'+color+'" stop-opacity="0"/></linearGradient></defs>'+
    '<path d="'+fillD+'" fill="url(#cg)"/>'+
    '<line x1="'+pL+'" y1="'+baseY.toFixed(1)+'" x2="'+(W-pR)+'" y2="'+baseY.toFixed(1)+'" stroke="rgba(255,255,255,0.06)" stroke-width="1" stroke-dasharray="3,3"/>'+
    '<path d="'+pathD+'" fill="none" stroke="'+color+'" stroke-width="1.8"/>'+
    '<circle cx="'+tx(ts[ts.length-1]).toFixed(1)+'" cy="'+ty(lastV).toFixed(1)+'" r="3" fill="'+color+'"/>'+
    '<text x="'+(W-pR+6)+'" y="'+(pT+5)+'" fill="#2a4060" font-size="9" font-family="monospace">'+fK(vmax)+'</text>'+
    '<text x="'+(W-pR+6)+'" y="'+(pT+ch)+'" fill="#2a4060" font-size="9" font-family="monospace">'+fK(vmin)+'</text>'+
    '<text x="'+(W-pR+6)+'" y="'+(ty(lastV)+4).toFixed(1)+'" fill="'+color+'" font-size="9" font-weight="bold" font-family="monospace">'+fK(lastV)+'</text>'+
    '<text x="'+(pL+2)+'" y="'+(H-4)+'" fill="#2a4060" font-size="9" font-family="monospace">'+fDT(tmin)+'</text>'+
    '<text x="'+tx(midT).toFixed(1)+'" y="'+(H-4)+'" fill="#2a4060" font-size="9" text-anchor="middle" font-family="monospace">'+fDT(midT)+'</text>'+
    '<text x="'+(W-pR-2)+'" y="'+(H-4)+'" fill="#2a4060" font-size="9" text-anchor="end" font-family="monospace">'+fDT(tmax)+'</text>'+
    '<rect id="chart-ov" x="'+pL+'" y="'+pT+'" width="'+cw+'" height="'+ch+'" fill="transparent"/>';
  setupCrosshair(svg,hist,tx,ty,startV,W,H,pT,pB,pR,pL);
}

function setupCrosshair(svg,hist,tx,ty,startV,W,H,pT,pB,pR,pL) {
  var ov=svg.querySelector('#chart-ov'), tip=g('chart-tip'); if(!ov||!tip) return;
  ov.addEventListener('mousemove',function(e){
    var rect=svg.getBoundingClientRect(), scX=W/rect.width;
    var mx=(e.clientX-rect.left)*scX;
    var cl=null,md=Infinity;
    hist.forEach(function(p){var d=Math.abs(tx(p.t)-mx);if(d<md){md=d;cl=p;}});
    if(!cl) return;
    svg.querySelectorAll('.ch').forEach(function(el){el.remove();});
    var ns='http://www.w3.org/2000/svg';
    var ln=document.createElementNS(ns,'line'); ln.className='ch';
    ln.setAttribute('x1',tx(cl.t).toFixed(1)); ln.setAttribute('y1',pT);
    ln.setAttribute('x2',tx(cl.t).toFixed(1)); ln.setAttribute('y2',H-pB);
    ln.setAttribute('stroke','rgba(255,255,255,0.2)'); ln.setAttribute('stroke-width','1'); ln.setAttribute('pointer-events','none');
    svg.insertBefore(ln,ov);
    var dot=document.createElementNS(ns,'circle'); dot.className='ch';
    dot.setAttribute('cx',tx(cl.t).toFixed(1)); dot.setAttribute('cy',ty(cl.v).toFixed(1));
    dot.setAttribute('r','4'); dot.setAttribute('fill','white'); dot.setAttribute('stroke','rgba(255,255,255,0.4)'); dot.setAttribute('stroke-width','1.5'); dot.setAttribute('pointer-events','none');
    svg.insertBefore(dot,ov);
    var netPnl=cl.v-startV;
    tip.style.display='block';
    tip.style.left=Math.max(0,Math.min(e.clientX-rect.left-60,rect.width-155))+'px';
    tip.style.top=Math.max(0,e.clientY-rect.top-75)+'px';
    set('tip-t',fTime(cl.t)); set('tip-v',fu(cl.v));
    var pEl=g('tip-p'); if(pEl){pEl.textContent=fuS(netPnl);pEl.className='chart-tip-p '+pCls(netPnl);}
  });
  ov.addEventListener('mouseleave',function(){ tip.style.display='none'; svg.querySelectorAll('.ch').forEach(function(el){el.remove();}); });
}

var STRATS=[
  {key:'opensnipe',   name:'Opening Snipe',   abbr:'OPS', tier:'TIER 0', tc:'t0', ev:'+4–8%',   edge:'STRONG',   bewr:'51%', desc:'First 3–35s of market open. Buy when Binance moves ≥0.8% in 60s + trend confirm. Ask ≤0.52. Stop-loss −30%.'},
  {key:'oraclesnipe', name:'Oracle Snipe',    abbr:'OS',  tier:'TIER 1', tc:'t1', ev:'+6–12%',  edge:'STRONG',   bewr:'84%', desc:'Post-close stale CLOB. UMA on-chain + gamma confirmation = near-100% certainty. 1.75× bet multiplier. Unconfirmed ask ≤0.82, confirmed ask ≤0.90.'},
  {key:'latencybond', name:'Latency Bond',    abbr:'LB',  tier:'TIER 2', tc:'t2', ev:'+3–6%',   edge:'STRONG',   bewr:'58%', desc:'Binance leads Polymarket 30–90s. Enter when BTC moves $70+ (or asset equiv). Ask lag zone 0.45–0.70. Stop-loss −30%.'},
  {key:'fundingsnipe',name:'Funding Snipe',   abbr:'FS',  tier:'TIER 3', tc:'t3', ev:'+5–10%',  edge:'GOOD',     bewr:'60%', desc:'Extreme perp funding (>+0.04%/8h or <−0.02%) predicts short-term squeeze. Ask ≤0.58. Deribit gamma + buy-pressure aligned.'},
  {key:'clobimb',     name:'CLOB Imbalance',  abbr:'CI',  tier:'TIER 4', tc:'t4', ev:'+2–4%',   edge:'GOOD',     bewr:'68%', desc:'Bid depth >80% standalone (>70% with LB confluence) → buy before reprice. Ask ≤0.65 standalone, ≤0.75 confluent. Stop-loss −30%.'},
  {key:'makerrebate', name:'Maker Rebate',    abbr:'MR',  tier:'TIER 5', tc:'t5', ev:'+1.4%',   edge:'MARGINAL', bewr:'N/A', desc:'Market-neutral limit orders on 50/50 markets. Earn +0.45% maker rebate per fill. 30s partial-fill timeout. ~1.4% net per round trip.'},
  {key:'arb',         name:'Cross-Mkt Arb',   abbr:'ARB', tier:'ARB',    tc:'ta', ev:'+0.24%',  edge:'LOCKED',   bewr:'N/A', desc:'Buy YES+NO when combined ask < 0.98. Guaranteed $1 at settlement if both fill. Zero market risk.'},
];

function renderStrategies() {
  var grid=g('strat-grid'); if(!grid) return;
  var edgeCl={'STRONG':'#22c55e','GOOD':'#f59e0b','MARGINAL':'#f97316','LOCKED':'#60a5fa'};
  grid.innerHTML=STRATS.map(function(st){
    var s=S[st.key]||{}, won=s.won||0, lost=s.lost||0, ent=s.entered||0;
    var wrv=wr(won,lost), p=st.key==='arb'?(s.guaranteedProfit||0):pnlOf(s);
    var pCl=pCls(p), wrPct=wrv!=null?fp(wrv):'—';
    var wrW=wrv!=null?(wrv*100):0, wrc=wrv==null?'':wrv>=0.62?'':'wr-fill'+(wrv>=0.50?' warn':' bad');
    var ec=edgeCl[st.edge]||'#888';
    var edgeBadge='<span style="display:inline-block;padding:1px 7px;border-radius:10px;font-size:10px;font-weight:800;letter-spacing:.05em;background:'+ec+'22;color:'+ec+';border:1px solid '+ec+'55">'+st.edge+'</span>';
    var evLine='<div style="display:flex;align-items:center;gap:6px;margin-bottom:6px">'+edgeBadge+'<span style="font-size:11px;color:var(--t2);font-weight:700">EV '+st.ev+'</span><span style="font-size:10px;color:var(--t3)">BE-WR: '+st.bewr+'</span></div>';
    var pLine=st.key==='arb'?
      '<div><div class="ssi-lbl">Guaranteed Profit</div><div class="ssi-val pos">'+fu(s.guaranteedProfit||0)+'</div></div>':
      '<div><div class="ssi-lbl">Net P&amp;L</div><div class="ssi-val '+pCl+'">'+fuS(p)+'</div></div>';
    return '<div class="sc sc-'+st.tc+'">'+
      '<div class="tier '+st.tc+'">'+st.tier+'</div>'+
      '<div class="sc-name">'+st.abbr+' — '+st.name+'</div>'+
      evLine+
      '<div class="sc-desc">'+st.desc+'</div>'+
      '<div class="sc-stats">'+
        '<div><div class="ssi-lbl">Entered</div><div class="ssi-val">'+ent+'</div></div>'+
        '<div><div class="ssi-lbl">Won / Lost</div><div class="ssi-val"><span class="pos">'+won+'</span> / <span class="neg">'+lost+'</span></div></div>'+
        '<div><div class="ssi-lbl">Win Rate</div><div class="ssi-val '+(wrv!=null?(wrv>=0.62?'pos':wrv>=0.50?'zero':'neg'):'')+'">'+wrPct+'</div><div class="wr-track"><div class="wr-fill '+wrc+'" style="width:'+wrW+'%"></div></div></div>'+
        pLine+
        '<div><div class="ssi-lbl">Fee (taker)</div><div class="ssi-val" style="color:var(--t3)">1.80%</div></div>'+
      '</div></div>';
  }).join('');
  var pr=g('strat-pnl-row');
  if(pr){
    pr.innerHTML=STRATS.map(function(st){
      var s=S[st.key]||{}, p=st.key==='arb'?(s.guaranteedProfit||0):pnlOf(s), cl=pCls(p);
      return '<div class="card-sm"><div class="ssi-lbl" style="font-size:9px;color:var(--t3);margin-bottom:4px">'+st.abbr+'</div><div style="font-size:16px;font-weight:800;font-variant-numeric:tabular-nums" class="'+cl+'">'+fuS(p)+'</div></div>';
    }).join('');
  }
}

function renderSignals() {
  var ev=S.event||null, ew=g('event-wrap');
  if(ew) ew.innerHTML=ev&&ev.name?'<div class="ev-banner"><span style="font-size:16px">&#9888;&#65039;</span><strong>'+esc(ev.name)+'</strong>'+(ev.note?' — '+esc(ev.note):'')+(ev.minsUntil!=null?' <span class="ts">in '+ev.minsUntil+'m</span>':'')+'</div>':'';
  var st=g('sig-top');
  if(st){
    var h='';
    ['BTC','ETH'].forEach(function(a){
      var d=(S.deribit||{})[a];
      var dir=d?d.direction:null, str=d?(d.strength*100).toFixed(0)+'%':null;
      var dc=dir==='UP'?'pos':dir==='DOWN'?'neg':'zero';
      h+='<div class="sig-card"><div class="sig-lbl">Deribit '+a+' Gamma</div>'+
        '<div class="sig-dir '+dc+'">'+(dir||'—')+'</div>'+
        '<div class="sig-sub">'+(str?'Strength: '+str:'No near-expiry OI signal')+(d?' <span class="ts">'+fAgo(d.updatedAt)+'</span>':'')+'</div></div>';
    });
    var uma=S.uma||{};
    h+='<div class="sig-card"><div class="sig-lbl">UMA Oracle (Polygon)</div>'+
      '<div class="sig-dir pos">'+(uma.settlementCount||0)+'</div>'+
      '<div class="sig-sub">Settlements cached (±150s tolerance)</div></div>';
    h+='<div class="sig-card"><div class="sig-lbl">Macro Event</div>'+
      (ev&&ev.name?'<div class="sig-dir" style="font-size:15px;font-weight:800">'+esc(ev.name)+'</div><div class="sig-sub">'+(ev.note?esc(ev.note):'Scheduled')+'</div>':
      '<div class="sig-dir zero">None Active</div><div class="sig-sub">All clear</div>')+'</div>';
    st.innerHTML=h;
  }
  var fg=g('fund-grid'), assets=S.assets||['BTC','ETH','SOL','XRP','DOGE','AVAX','LINK','MATIC'];
  if(fg){
    fg.innerHTML=assets.map(function(a){
      var f=(S.funding||{})[a], rate=f?f.rate:null;
      var big=rate!=null&&Math.abs(rate)>0.0003;
      var dir=rate==null?'—':rate>0.0004?'LONG SQUEEZE':rate<-0.0002?'SHORT SQUEEZE':'Normal';
      var cl=big?'pos':'zero';
      return '<div class="fund-cell"><div class="fund-sym">'+a+'</div>'+
        '<div class="fund-rate '+cl+'">'+(rate!=null?(rate*100).toFixed(4)+'%':'—')+'</div>'+
        '<div style="font-size:10px;color:'+(big?'var(--gd)':'var(--t3)')+'">'+dir+'</div></div>';
    }).join('');
  }
  var wg=g('whale-grid');
  if(wg){
    wg.innerHTML=assets.map(function(a){
      var w=(S.whale||{})[a], v=(S.volume||{})[a];
      var dir=w?w.direction:null, bp=v?v.buyPressure:null;
      var wc=dir==='UP'?'pos':dir==='DOWN'?'neg':'zero';
      var bc=bp!=null?(bp>0.6?'pos':bp<0.4?'neg':'zero'):'';
      return '<div class="whale-cell">'+
        '<div class="fund-sym">'+a+'</div>'+
        '<div style="font-size:12px;font-weight:700" class="'+wc+'">Whale: '+(dir||'—')+'</div>'+
        '<div style="font-size:11px;color:var(--t2)">BP: <span class="'+bc+'">'+(bp!=null?(bp*100).toFixed(0)+'%':'—')+'</span>'+(v&&v.spike?' <span class="tag" style="font-size:9px;background:rgba(245,166,35,.15);color:var(--gd)">VOL</span>':'')+'</div>'+
        '</div>';
    }).join('');
  }
  var mg=g('mom-grid');
  if(mg){
    mg.innerHTML=assets.map(function(a){
      var m=(S.momentums||{})[a];
      var cl=m>0.001?'pos':m<-0.001?'neg':'zero';
      var bw=m!=null?Math.min(100,Math.abs(m)*2000):0;
      var bc=m>0?'#00d084':'#ff4455';
      return '<div class="card-sm">'+
        '<div style="font-size:10px;font-weight:700;color:var(--t2);margin-bottom:4px">'+a+'</div>'+
        '<div style="font-size:15px;font-weight:800;font-variant-numeric:tabular-nums" class="'+cl+'">'+(m!=null?(m>0?'+':'')+(m*100).toFixed(3)+'%':'—')+'</div>'+
        '<div class="bar-wrap"><div class="bar-fill" style="width:'+bw+'%;background:'+bc+'"></div></div>'+
        '</div>';
    }).join('');
  }
}

function renderFindings() {
  var wrap=g('findings-wrap'), meta=g('agent-meta'); if(!wrap) return;
  if(!findings.length){
    wrap.innerHTML='<div class="findings-empty">No findings yet. The research agent runs every 30 minutes.<br>Findings appear once enough trade history has accumulated.</div>';
    if(meta) meta.textContent='No findings yet';
    return;
  }
  var sev={critical:0,warning:1,opportunity:2,info:3};
  var sorted=findings.slice().sort(function(a,b){return (sev[a.severity]||4)-(sev[b.severity]||4)||new Date(b.createdAt)-new Date(a.createdAt);});
  wrap.innerHTML=sorted.map(function(f){
    var sc='f-'+(f.severity||'info'), sb='fsev-'+(f.severity||'info');
    var m=f.metric;
    var mh=m?'<div class="fmetric"><strong>'+(m.value!=null?(typeof m.value==='number'?m.value.toFixed(3):esc(m.value)):'—')+'</strong>'+
      (m.comparison!=null?' vs <strong>'+(typeof m.comparison==='number'?m.comparison.toFixed(3):esc(String(m.comparison)))+'</strong>':'')+
      (m.delta!=null?' &nbsp;<span class="'+(m.delta>0?'pos':m.delta<0?'neg':'zero')+'">'+(m.delta>0?'+':'')+(m.delta*100).toFixed(1)+'%</span>':'')+
      '</div>':'';
    return '<div class="finding '+sc+'">'+
      '<div class="f-hd"><span class="fsev '+sb+'">'+(f.severity||'info').toUpperCase()+'</span>'+
      '<span class="fcat">'+(f.category||'')+'</span></div>'+
      '<div class="ftitle">'+esc(f.title||'')+'</div>'+
      '<div class="fbody">'+esc(f.body||'')+'</div>'+
      mh+'<div class="ftime">'+fAgo(f.createdAt)+'</div></div>';
  }).join('');
  if(meta) meta.innerHTML=sorted.length+' findings &bull; latest '+fAgo(sorted[0].createdAt);
}

function applyFilter() {
  jFilter.strategy=g('jf-strat')?g('jf-strat').value:'all';
  jFilter.asset=g('jf-asset')?g('jf-asset').value:'all';
  jFilter.outcome=g('jf-out')?g('jf-out').value:'all';
  jFilter.q=g('jf-q')?g('jf-q').value.toLowerCase():'';
  jFiltered=journal.filter(function(t){
    if(jFilter.strategy!=='all'&&t.strategy!==jFilter.strategy) return false;
    if(jFilter.asset!=='all'&&t.asset!==jFilter.asset) return false;
    if(jFilter.outcome==='won'&&t.won!==true) return false;
    if(jFilter.outcome==='lost'&&t.won!==false) return false;
    if(jFilter.outcome==='pending'&&t.won!=null) return false;
    if(jFilter.q){var hay=[t.asset,t.strategy,t.side].filter(Boolean).join(' ').toLowerCase();if(!hay.includes(jFilter.q)) return false;}
    return true;
  }).sort(function(a,b){return(b.enteredAt||0)-(a.enteredAt||0);});
  jCurPage=0; renderJournal();
}

function renderJournal() {
  var tb=g('j-tbody'); if(!tb) return;
  var won=jFiltered.filter(function(t){return t.won===true;}).length;
  var lost=jFiltered.filter(function(t){return t.won===false;}).length;
  var wrv=wr(won,lost);
  var tp=jFiltered.reduce(function(s,t){return s+(t.payout||0)-(t.totalSpent||0);},0);
  set('j-total',jFiltered.length); set('j-wr',wrv!=null?fp(wrv):'—');
  var pEl=g('j-pnl'); if(pEl){pEl.textContent=fuS(tp);pEl.className=pCls(tp);}
  var pages=Math.ceil(jFiltered.length/J_PER)||1;
  if(jCurPage>=pages) jCurPage=pages-1;
  var start=jCurPage*J_PER, slice=jFiltered.slice(start,start+J_PER);
  set('j-page-info','Page '+(jCurPage+1)+' of '+pages+' ('+jFiltered.length+' trades)');
  var prev=g('j-prev'),next=g('j-next');
  if(prev) prev.disabled=jCurPage===0; if(next) next.disabled=jCurPage>=pages-1;
  if(!slice.length){tb.innerHTML='<tr><td colspan="10" class="tbl-empty">No trades match the current filter.</td></tr>';return;}
  tb.innerHTML=slice.map(function(t,i){return trRow(t,start+i+1,jFiltered.length);}).join('');
}

function jPage(delta) {
  var pages=Math.ceil(jFiltered.length/J_PER)||1;
  jCurPage=Math.max(0,Math.min(pages-1,jCurPage+delta));
  renderJournal();
}

function renderAnalytics() {
  var adap=S.adaptive||{}, atb=g('adap-tbody');
  if(atb){
    var ents=Object.entries(adap).sort(function(a,b){return(b[1].trades||0)-(a[1].trades||0);});
    if(!ents.length){atb.innerHTML='<tr><td colspan="4" class="tbl-empty">No data yet (need 5+ trades per pair)</td></tr>';}
    else{
      atb.innerHTML=ents.map(function(kv){
        var k=kv[0],v=kv[1],mult=v.multiplier||1;
        var mc=mult>=1.3?'am-high':mult>=0.9?'am-med':'am-low';
        var wc=v.winRate!=null?(v.winRate>=0.62?'pos':v.winRate>=0.50?'zero':'neg'):'';
        return '<tr><td><strong>'+esc(k)+'</strong></td><td>'+v.trades+'</td>'+
          '<td class="'+wc+'">'+(v.winRate!=null?fp(v.winRate):'—')+'</td>'+
          '<td><span class="adap-mult '+mc+'">'+mult.toFixed(2)+'&#215;</span></td></tr>';
      }).join('');
    }
  }
  var stb=g('strat-tbody');
  if(stb){
    stb.innerHTML=STRATS.map(function(st){
      var s=S[st.key]||{},won=s.won||0,lost=s.lost||0,ent=s.entered||0;
      var wrv=wr(won,lost),p=pnlOf(s),wc=wrv!=null?(wrv>=0.62?'pos':wrv>=0.50?'zero':'neg'):'';
      return '<tr><td><span class="tier '+st.tc+'" style="margin:0">'+st.abbr+'</span></td>'+
        '<td>'+ent+'</td><td><span class="pos">'+won+'</span>/<span class="neg">'+lost+'</span></td>'+
        '<td class="'+wc+'">'+(wrv!=null?fp(wrv):'—')+'</td>'+
        '<td class="'+pCls(p)+'">'+fuS(p)+'</td></tr>';
    }).join('');
  }
  var ag=g('asset-grid'), assets=S.assets||['BTC','ETH','SOL','XRP','DOGE','AVAX','LINK','MATIC'];
  if(ag){
    var byA={};
    assets.forEach(function(a){byA[a]={won:0,lost:0,pnl:0};});
    (S.recentTrades||[]).forEach(function(t){
      if(!t.asset||!byA[t.asset]) return;
      if(t.won===true) byA[t.asset].won++;
      else if(t.won===false) byA[t.asset].lost++;
      byA[t.asset].pnl+=(t.payout||0)-(t.totalSpent||0);
    });
    ag.innerHTML=assets.map(function(a){
      var b=byA[a],wrv=wr(b.won,b.lost),wc=wrv!=null?(wrv>=0.62?'pos':wrv>=0.50?'zero':'neg'):'',pc=pCls(b.pnl);
      var bw=wrv!=null?(wrv*100):0, bc=wrv&&wrv>=0.62?'#00d084':wrv&&wrv>=0.50?'#f5a623':'#ff4455';
      return '<div class="card-sm">'+
        '<div style="font-size:11px;font-weight:700;color:var(--t2);margin-bottom:6px">'+a+'</div>'+
        '<div style="font-size:17px;font-weight:800;font-variant-numeric:tabular-nums" class="'+wc+'">'+(wrv!=null?fp(wrv):'—')+'</div>'+
        '<div class="bar-wrap" style="margin:4px 0"><div class="bar-fill" style="width:'+bw+'%;background:'+bc+'"></div></div>'+
        '<div style="font-size:11px" class="'+pc+'">'+fuS(b.pnl)+'</div>'+
        '<div class="ts">'+(b.won+b.lost)+' resolved</div>'+
        '</div>';
    }).join('');
  }
}
</script>
</body>
</html>
`;
