// W8-Q · the phone overlap scan: at the sizes Safari really gives the page on an iPhone (its bars never collapse: the
// game does not scroll) open each surface and list every visible control whose centre is COVERED (elementFromPoint hits
// something else) or OFF the screen outside any scroller — at the top and with every scroller of the surface at its end.
// Wave 7's lane Q ran it from scratch (vscan.mjs); this is the reusable copy with wave 8's new overlays.
//
// Usage (a dev server of this worktree running; ONE headless Chrome; respects the PERF-LOCK):
//   node scripts/opus-sf/qa/overlap-scan.mjs --port 5802 [--sizes 390x664,375x553,667x320,844x340] [--only hud,ferry,...]
//        [--lang zh-Hans|zh-Hant|en] [--out <dir>] [--shots]
// Surfaces: hud · gstep (the goals step, a fresh save) · skyline (the 那是什么 quiz at Twin Peaks) · metro (an underground
// Muni Metro ride and its 设置) · ferry (the Alcatraz boat from Pier 33: the ride card, ?date by day) · grip (the cable-car
// grip game on a Powell–Hyde ride, from its first stop's station: it waits up to 90 s for a car) · busk (the busker jam) ·
// settings (top and end). A canvas (a game's board) counts as a control: its centre covered is a defect (W8-Q-review Q-PL-4).
// Before each surface an open dialogue is closed (a goal done on the way, e.g. the pelican's at Twin Peaks, opens one).
// Each size starts from cleared site storage, so the goals step opens at every size; a surface asked for that did not open
// is a row with missing: true (W8-Q-review Q-RC-4).
// Prints one JSON line per surface ({ size, surface, n, covered, off }) and writes <out>/overlap-<lang>.json. Exit 0 always
// (a report): what is "covered" or "off" is what to read — a sticky header passing over a scrolled list is not a defect.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const argv = process.argv.slice(2);
const args = {};
for (let i = 0; i < argv.length; i++) if (argv[i].startsWith('--')) args[argv[i].slice(2)] = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true;
const PORT = Number(args.port || 5802);
const SIZES = String(args.sizes || '390x664,375x553,667x320,844x340').split(',').map(s => s.split('x').map(Number));
const ONLY = args.only ? new Set(String(args.only).split(',')) : null;
const LANG = args.lang || 'zh-Hans';
const OUT = path.resolve(args.out || 'overlap-scan');
const LOCK = args.lock || 'C:/Users/willy/opus-qa/w8/PERF-LOCK';
const SHOTS = !!args.shots;
const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Mobile/15E148 Safari/604.1';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const want = s => !ONLY || ONLY.has(s);
fs.mkdirSync(OUT, { recursive: true });
if (fs.existsSync(LOCK)) { console.log(JSON.stringify({ error: `PERF-LOCK present (${LOCK}): no Chrome now` })); process.exit(0); }

// --- in the page: covered / off controls of one surface (wave 7's lane-Q scan) ------------------------------------------
const SCAN = String.raw`(root, label) => {
  const W = innerWidth, H = innerHeight;
  const vis = el => { const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return r.width > 2 && r.height > 2 && cs.visibility !== 'hidden' && cs.display !== 'none' && +cs.opacity > 0.05; };
  const scroller = el => { for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) { const cs = getComputedStyle(p); if (/(auto|scroll)/.test(cs.overflowY + ' ' + cs.overflowX) && (p.scrollHeight > p.clientHeight + 1 || p.scrollWidth > p.clientWidth + 1)) return p; } return null; };
  const name = el => (el.getAttribute('aria-label') || el.textContent || el.tagName).replace(/\s+/g, ' ').trim().slice(0, 28);
  const cls = el => String(el.className && el.className.baseVal !== undefined ? el.className.baseVal : el.className || el.tagName).split(' ').slice(0, 2).join('.');
  const roots = [...document.querySelectorAll(root)].filter(vis);
  if (!roots.length) return { label, root, missing: true };
  const out = { label, root, covered: [], off: [], n: 0 };
  for (const rootEl of roots) {
    const els = [...rootEl.querySelectorAll('button, a[href], input, select, [role=button], [role=switch], [role=radio], summary, canvas')].filter(vis);
    for (const el of els) {
      out.n++;
      const r = el.getBoundingClientRect();
      const sc = scroller(el);
      let clip = { l: 0, t: 0, r: W, b: H };
      if (sc) { const s = sc.getBoundingClientRect(); clip = { l: Math.max(0, s.left), t: Math.max(0, s.top), r: Math.min(W, s.right), b: Math.min(H, s.bottom) }; }
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      if (!(cx >= clip.l && cx <= clip.r && cy >= clip.t && cy <= clip.b)) { if (!sc) out.off.push(name(el) + ' @' + [r.left, r.top, r.right, r.bottom].map(Math.round).join(',')); continue; }
      const top = document.elementFromPoint(cx, cy);
      if (top && top !== el && !el.contains(top) && !top.contains(el)) out.covered.push(name(el) + ' <- ' + cls(top));
    }
  }
  return out;
}`;

const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'overlap-scan-'));
const flags = (process.env.CHROME_FLAGS || '--force_high_performance_gpu').split(' ').filter(Boolean);
const chrome = spawn(process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe', [...flags, '--headless=new', '--remote-debugging-port=0', `--user-data-dir=${profile}`, '--no-first-run', '--no-default-browser-check', '--enable-gpu', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required', '--window-size=844,844', 'about:blank'], { stdio: 'ignore' });
const report = { lang: LANG, results: [], errors: [] };
let ws = null;
try {
  let port = 0;
  for (let i = 0; i < 400 && !port; i++) { try { port = Number(fs.readFileSync(path.join(profile, 'DevToolsActivePort'), 'utf8').split('\n')[0]) || 0; } catch { /* not yet */ } if (!port) await sleep(100); }
  let targets = [];
  for (let i = 0; i < 150; i++) { try { targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); if (targets.find(t => t.type === 'page')) break; } catch { /* retry */ } await sleep(200); }
  ws = new WebSocket(targets.find(t => t.type === 'page').webSocketDebuggerUrl);
  await new Promise(r => ws.addEventListener('open', r, { once: true }));
  let mid = 0; const pending = new Map();
  ws.addEventListener('message', e => {
    const msg = JSON.parse(e.data);
    if (msg.id && pending.has(msg.id)) { const p = pending.get(msg.id); pending.delete(msg.id); if (msg.error) p.reject(new Error(JSON.stringify(msg.error))); else p.resolve(msg.result); }
    else if (msg.method === 'Runtime.exceptionThrown') report.errors.push((msg.params.exceptionDetails.exception?.description || msg.params.exceptionDetails.text || '').slice(0, 300));
  });
  const send = (method, params = {}) => new Promise((resolve, reject) => { const id = ++mid; pending.set(id, { resolve, reject }); ws.send(JSON.stringify({ id, method, params })); });
  const ev = async expr => { const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }); return r.result?.value ?? (r.exceptionDetails ? { error: r.exceptionDetails.exception?.description ?? r.exceptionDetails.text } : undefined); };
  const page = body => ev(`(async () => { const ob = window.__opusBay; const imp = p => import('/src/opus-bay/' + p); ${body} })()`);
  const waitFor = async (cond, ms = 30000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await ev(`(() => { try { return !!(${cond}); } catch { return false; } })()`) === true) return true; await sleep(300); } return false; };
  await send('Runtime.enable'); await send('Page.enable');
  await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
  await send('Emulation.setUserAgentOverride', { userAgent: IPHONE, platform: 'iPhone' });

  for (const [W, H] of SIZES) {
    const size = `${W}x${H}`;
    await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 2, mobile: true });
    const scan = async (root, surface, { bottom = true } = {}) => {
      const a = await ev(`(${SCAN})(${JSON.stringify(root)}, ${JSON.stringify(surface + ':top')})`);
      const rows = [a];
      if (bottom && a && !a.missing) {
        await ev(`(() => { let n = 0; for (const r of document.querySelectorAll(${JSON.stringify(root)})) for (const el of [r, ...r.querySelectorAll('*')]) { const cs = getComputedStyle(el); if (/(auto|scroll)/.test(cs.overflowY) && el.scrollHeight > el.clientHeight + 1) { el.scrollTop = el.scrollHeight; n++; } } return n; })()`);
        await sleep(500);
        rows.push(await ev(`(${SCAN})(${JSON.stringify(root)}, ${JSON.stringify(surface + ':end')})`));
      }
      for (const r of rows) { const row = { size, surface: r?.label ?? surface, n: r?.n ?? 0, missing: !!r?.missing, covered: r?.covered ?? [], off: r?.off ?? [] }; report.results.push(row); console.log(JSON.stringify(row)); }
      if (SHOTS) { const s = await send('Page.captureScreenshot', { format: 'jpeg', quality: 70 }); fs.writeFileSync(path.join(OUT, `overlap-${size}-${surface.replace(/[^a-z0-9-]+/gi, '_')}.jpg`), Buffer.from(s.data, 'base64')); }
    };
    // one page per size: free roam on a fresh save (the goals step first), by day, Halloween on
    const load = async (q = '') => {
      // a fresh player at every size: the goals step's seen mark (and any other) must not carry over from the last size
      await send('Storage.clearDataForOrigin', { origin: `http://localhost:${PORT}`, storageTypes: 'all' }).catch(() => {});
      await send('Page.navigate', { url: `http://localhost:${PORT}/opus-bay?world=city&start=free&save=off&lang=${LANG}&quality=mid&halloween=1&date=2026-10-02T11:00${q}` });
      await waitFor(`window.__opusBay?.game?.get?.().phase === 'playing'`, 120000);
      await sleep(3000);
    };
    try {
      await load();
      const gstep = await waitFor(`document.querySelector('.ob-gstep-wrap')`, 10000);
      if (gstep && want('gstep')) { await sleep(800); await scan('.ob-gstep-wrap', 'gstep'); }
      else if (want('gstep')) { const row = { size, surface: 'gstep (did not open)', n: 0, missing: true, covered: [], off: [] }; report.results.push(row); console.log(JSON.stringify(row)); }
      await ev(`(() => { const e = [...document.querySelectorAll('.ob-gstep button')].pop(); e?.click(); return !!e; })()`);
      await sleep(2000);
      await page(`(await imp('game/flow.ts')).closeDialogue(); return 1`);
      if (want('hud')) await scan('.ob-overlay', 'hud', { bottom: false });
      if (want('settings')) { await page(`ob.game.set({ panel: { kind: 'settings' } }); return 1`); await sleep(1500); await scan('.ob-sheet', 'settings'); await page(`ob.game.set({ panel: { kind: null }, paused: false }); return 1`); await sleep(700); }
      if (want('skyline')) {
        await page(`const { ATTRACTIONS } = await imp('data/sf/attractions.ts'); const a = ATTRACTIONS.find(x => x.id === 'twin-peaks'); (await imp('game/flow.ts')).teleportPlayer({ x: a.arrival?.x ?? a.x, z: a.arrival?.z ?? a.z }); return 1`);
        await sleep(5000);
        // the pelican's goal is done up here (a fresh save): its dialogue opens a moment after the arrival — close it twice
        for (let k = 0; k < 2; k++) { await page(`(await imp('game/flow.ts')).closeDialogue(); return 1`); await sleep(1500); }
        const ok = await page(`const g = (await imp('core/store.ts')).game; if (g.get().mode !== 'free') g.set({ mode: 'free' }); (await imp('game/flow.ts')).closeDialogue(); return (await imp('play/skyline.ts')).startSkyline()`);
        await sleep(3000); await scan('.ob-overlay', ok === true ? 'skyline' : 'skyline (not started)', { bottom: false });
        await page(`(await imp('play/skyline.ts')).skylineLive()?.run.cancel(); (await imp('game/flow.ts')).closeDialogue(); return 1`); await sleep(1200);
      }
      if (want('busk')) {
        // stand on the Haight St busker's spot (lane M's ring; the jam stops at once away from it), 11:00–19:00 Bay time
    await page(`const m = await imp('play/sfgames8.ts'); (await imp('game/flow.ts')).teleportPlayer(m.buskAt(m.BUSK_HAIGHT)); return 1`); await sleep(5000);
    const ok = await page(`(await imp('game/flow.ts')).closeDialogue(); return (await imp('play/busk.ts')).startBusk('haight')`);
        if (ok === true) await waitFor(`document.querySelector('.ob-sfg-panel.is-busk')`, 20000); await sleep(1500); await scan('.ob-overlay', ok === true ? 'busk' : `busk (${JSON.stringify(ok)})`, { bottom: false });
        await page(`const s = await imp('ui/slots.ts'); s.closeOverlay('play-busk'); return 1`); await sleep(1200);
      }
      if (want('metro')) {
        await page(`(await imp('game/flow.ts')).closeDialogue(); ob.transit.rideLine('m-ocean-view', 'muni-embarcadero', 'muni-castro'); return 1`);
        const on = await waitFor(`document.querySelector('.ob-subway.is-on')`, 90000);
        await sleep(1200); await scan('.ob-subway', on ? 'metro' : 'metro (no subway layer)', { bottom: false });
        await page(`ob.transit.finish?.(); return 1`); await sleep(2500);
      }
      if (want('ferry')) {
        await page(`const f = await imp('game/flow.ts'); f.teleportPlayer({ x: -94.0, z: -21.8 }); return 1`); await sleep(4000);
        await page(`(await imp('game/flow.ts')).closeDialogue(); const t = await imp('game/transit.ts'); t.rideFerry('pier-33', 'alcatraz-dock'); return 1`);
        await waitFor(`!!window.__opusBay.flow?.get?.()?.ride || !!document.querySelector('.ob-ride')`, 20000);
        await sleep(2500); await scan('.ob-overlay', 'ferry', { bottom: false });
        await page(`ob.transit.finish?.(); return 1`); await sleep(2500);
      }
      if (want('grip')) {
        await page(`(await imp('game/flow.ts')).closeDialogue(); const d = ob.transit.data(); const l = (d.cable?.lines ?? d.lines ?? []).find(x => /powell-hyde/.test(x.id)); if (!l) return 'no line'; const st = ob.transit.station(l.stops[0].station); if (st) (await imp('game/flow.ts')).teleportPlayer({ x: st.x, z: st.z }); await new Promise(r => setTimeout(r, 5000)); ob.transit.ride(l.id, l.stops[0].station, l.stops[Math.min(4, l.stops.length - 1)].station); return l.id`);
        const riding = await waitFor(`window.__opusBay.flow?.get?.()?.ride?.stage === 'riding'`, 90000);
        await sleep(2000);
        const ok = riding ? await page(`return (await imp('play/grip.ts')).startGrip()`) : 'no ride';
        await sleep(2500); await scan('.ob-overlay', ok === true ? 'grip' : `grip (${JSON.stringify(ok)})`, { bottom: false });
        await page(`ob.transit.finish?.(); return 1`); await sleep(2000);
      }
    } catch (error) { report.errors.push(`${size}: ${String(error?.stack || error).slice(0, 400)}`); }
  }
} catch (error) {
  report.errors.push(String(error?.stack || error).slice(0, 400));
} finally {
  const file = path.join(OUT, `overlap-${LANG}.json`);
  fs.writeFileSync(file, JSON.stringify(report, null, 1));
  console.log(JSON.stringify({ done: file, rows: report.results.length, withCovered: report.results.filter(r => r.covered.length).length, withOff: report.results.filter(r => r.off.length).length, errors: report.errors.length }));
  try { ws?.close(); } catch { /* closed */ }
  chrome.kill(); await sleep(400);
  try { fs.rmSync(profile, { recursive: true, force: true }); } catch { /* locked */ }
  process.exit(0);
}
