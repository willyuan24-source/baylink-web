// Cold start of /opus-bay as a first-time player meets it (W9-P1, the review's R§5 #4; its method: C:/Users/willy/opus-qa/
// review-1001/gapfill/cold.mjs). One headless Chrome per run, a FRESH profile each run (no shader / HTTP cache), in-page marks.
//
//   node scripts/opus-sf/qa/perf/cold-start.mjs --url http://127.0.0.1:4174/opus-bay [--runs 5] [--mode eager|wait10]
//        [--mobile] [--cpu 4] [--net none|fast4g] [--tag name] [--out dir] [--glq] [--profile dir --warm]
//
//   --mode eager   click Start 300 ms after it shows (most first-time players); while it is disabled (准备中…) the click
//                  is a dead one and the run clicks again as soon as it is enabled (a player tapping again)
//   --mode wait10  click 10 s after the title shows (or as soon as Start is enabled after that)
//   --mobile       390 × 844, dpr 2, touch (the phone the review emulated); with --cpu 4 --net fast4g = "phone 4×"
//   --glq          wrap the WebGL query calls (getProgramInfoLog & co.): how many programs were first used in a render
//                  and how long the main thread waited on links, before and after the click
//   --profile dir --warm   reuse a profile (shader + HTTP cache): a returning player
//
// Per run (ms from navigation start): title (Start visible), ready (Start enabled), firstFrame (the world's first frame,
// performance mark), click (the Start press the game took), titleFreeze (longest rAF gap between the title and that
// press), clickToChoice (press → the 4-way choice = the first control), firstTryToChoice (the first press attempt → the
// choice: what an eager player waits), freeze (sum of rAF gaps > 250 ms after the press), maxGap (longest after the
// press), longTask (longest long task of the run), startInput (the press's event timing: input delay, duration), choiceInput.
// Writes <out>/<tag>-<n>/result.json, appends <out>/summary.jsonl and prints the median / P75 of each number at the end.
// At most one Chrome at a time (the runs are sequential); start none while C:/Users/willy/opus-qa/w9/PERF-LOCK exists.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const argv = process.argv.slice(2); const args = {};
for (let i = 0; i < argv.length; i++) if (argv[i].startsWith('--')) args[argv[i].slice(2)] = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true;
const MODE = args.mode || 'eager'; const NET = args.net || 'none'; const MOBILE = !!args.mobile;
const CPU = Number(args.cpu || 1); const RUNS = Number(args.runs || 1);
const TAG = args.tag || `${MOBILE ? 'phone' : 'desk'}-${MODE}${CPU > 1 ? `-cpu${CPU}` : ''}${NET !== 'none' ? `-${NET}` : ''}`;
const W = MOBILE ? 390 : 1440, H = MOBILE ? 844 : 900;
const URL = args.url || 'http://127.0.0.1:4174/opus-bay';
const OUT = path.resolve(args.out || 'C:/Users/willy/opus-qa/cold-start');
const LOCK = 'C:/Users/willy/opus-qa/w9/PERF-LOCK';
const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const sleep = ms => new Promise(r => setTimeout(r, ms));
fs.mkdirSync(OUT, { recursive: true });

const NETS = { none: null, fast4g: { offline: false, latency: 60, downloadThroughput: 9e6 / 8, uploadThroughput: 1.5e6 / 8 }, slow: { offline: false, latency: 150, downloadThroughput: 1.6e6 / 8, uploadThroughput: 0.75e6 / 8 } };

// In-page recorder: marks, rAF gaps, long tasks, event timing, (--glq) the WebGL query waits.
const RECORDER = `(() => { if (window.top !== window) return;
  const P = window.__cold = { marks: {}, events: [], gaps: [], long: [], dead: 0, glq: { n: 0, ms: 0, slow: [] } };
  const mark = k => { if (P.marks[k] == null) P.marks[k] = Math.round(performance.now()); };
  try { new PerformanceObserver(l => { for (const e of l.getEntries()) P.long.push([Math.round(e.startTime), Math.round(e.duration)]); }).observe({ type: 'longtask', buffered: true }); } catch {}
  try { new PerformanceObserver(l => { for (const e of l.getEntries()) if (/pointer|click|key|touch/.test(e.name)) P.events.push({ name: e.name, start: Math.round(e.startTime), inputDelay: Math.round(e.processingStart - e.startTime), dur: Math.round(e.duration) }); }).observe({ type: 'event', buffered: true, durationThreshold: 16 }); } catch {}
  let lastF = 0; const raf = t => { if (lastF && t - lastF > 150) P.gaps.push([Math.round(lastF), Math.round(t - lastF)]); lastF = t; requestAnimationFrame(raf); }; requestAnimationFrame(raf);
  const visible = el => !!el && el.checkVisibility && el.checkVisibility();
  const check = () => { const b = document.body; if (!b) return;
    if ((b.innerText || '').includes('湾区的日常')) mark('home'); else if (P.marks.home != null) mark('homeGone');
    const st = document.querySelector('.ob-title-start');
    if (visible(st)) { mark('title'); if (!st.disabled && st.getAttribute('aria-disabled') !== 'true' && st.getAttribute('aria-busy') !== 'true') mark('ready'); }
    if (document.querySelector('canvas')) mark('canvas');
    if (P.marks.click != null && document.querySelector('.ob-choices.is-in .ob-choice')) mark('choice');
    if (P.marks.choiceClick != null && document.querySelector('.ob-hud, .ob-stick, .ob-hud-buttons')) mark('hud');
  };
  new MutationObserver(check).observe(document, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['disabled', 'aria-busy', 'class'] });
  addEventListener('pointerdown', e => { const t = e.target.closest && e.target.closest('button');
    if (t && t.classList.contains('ob-title-start')) { if (t.disabled || t.getAttribute('aria-disabled') === 'true' || t.getAttribute('aria-busy') === 'true') P.dead++; else mark('click'); }
    if (t && t.classList.contains('ob-choice')) mark('choiceClick'); }, true);
  // a disabled button gets no pointer event: count the attempt from the window
  addEventListener('pointerdown', e => { const s = document.querySelector('.ob-title-start'); if (s && s.disabled && s.contains(document.elementFromPoint(e.clientX, e.clientY))) P.dead++; }, true);
  if (${!!args.glq}) {
    const proto = window.WebGL2RenderingContext && WebGL2RenderingContext.prototype;
    if (proto) for (const name of ['getProgramInfoLog', 'getProgramParameter', 'getShaderInfoLog', 'getActiveUniform', 'getUniformLocation']) {
      const orig = proto[name];
      proto[name] = function (...a) { const t = performance.now(); const r = orig.apply(this, a); const d = performance.now() - t;
        if (name === 'getProgramInfoLog') P.glq.n++; P.glq.ms += d; if (d > 40) P.glq.slow.push([Math.round(t), Math.round(d), name]); return r; };
    }
  }
})();`;

async function run(n) {
  if (fs.existsSync(LOCK)) { console.error(`PERF-LOCK present (${fs.readFileSync(LOCK, 'utf8').trim()}): no Chrome now`); process.exit(3); }
  const dir = path.join(OUT, `${TAG}-${n}`); fs.mkdirSync(dir, { recursive: true });
  const fresh = !args.profile;
  const profile = fresh ? fs.mkdtempSync(path.join(os.tmpdir(), 'opus-cold-')) : path.resolve(args.profile);
  fs.mkdirSync(profile, { recursive: true });
  try { fs.unlinkSync(path.join(profile, 'DevToolsActivePort')); } catch { /* none */ }
  const extra = process.env.CHROME_FLAGS ? process.env.CHROME_FLAGS.split(' ') : ['--force_high_performance_gpu'];
  const chrome = spawn(CHROME, [...extra, '--enable-gpu', '--ignore-gpu-blocklist', '--headless=new', '--remote-debugging-port=0', `--user-data-dir=${profile}`, '--no-first-run', '--no-default-browser-check', '--autoplay-policy=no-user-gesture-required', `--window-size=${W},${H}`, 'about:blank'], { stdio: 'ignore' });
  let port = 0;
  for (let i = 0; i < 300 && !port; i++) { try { port = Number(fs.readFileSync(path.join(profile, 'DevToolsActivePort'), 'utf8').split('\n')[0]) || 0; } catch { /* not yet */ } if (!port) await sleep(100); }
  let targets = [];
  for (let i = 0; i < 50; i++) { try { targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); if (targets.find(t => t.type === 'page')) break; } catch { /* retry */ } await sleep(200); }
  const ws = new WebSocket(targets.find(t => t.type === 'page').webSocketDebuggerUrl);
  await new Promise(r => ws.addEventListener('open', r, { once: true }));
  let mid = 0; const pending = new Map(); const errors = [];
  ws.addEventListener('message', ev => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) { const p = pending.get(msg.id); pending.delete(msg.id); if (msg.error) p.reject(new Error(JSON.stringify(msg.error))); else p.resolve(msg.result); return; }
    if (msg.method === 'Runtime.exceptionThrown') errors.push((msg.params.exceptionDetails.exception?.description || msg.params.exceptionDetails.text || '').slice(0, 300));
  });
  const send = (method, params = {}) => new Promise((resolve, reject) => { const id = ++mid; pending.set(id, { resolve, reject }); ws.send(JSON.stringify({ id, method, params })); });
  const ev = async expr => { const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }); return r.result?.value; };
  // a screenshot never holds the run up (it waits for a compositor frame): at most 3 s, else skipped
  const shot = async name => { const r = await Promise.race([send('Page.captureScreenshot', { format: 'jpeg', quality: 60 }), sleep(3000).then(() => null)]); if (r) fs.writeFileSync(path.join(dir, name + '.jpg'), Buffer.from(r.data, 'base64')); };
  const tap = async c => {
    if (MOBILE) { await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: c[0], y: c[1], id: 0 }] }); await sleep(60); await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); }
    else { await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: c[0], y: c[1] }); await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: c[0], y: c[1], button: 'left', clickCount: 1 }); await sleep(60); await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: c[0], y: c[1], button: 'left', clickCount: 1 }); }
  };
  const where = sel => ev(`(() => { const b = ${sel}; if (!b || !b.checkVisibility()) return null; const r = b.getBoundingClientRect(); return { c: [r.x + r.width / 2, r.y + r.height / 2], on: !b.disabled && b.getAttribute('aria-disabled') !== 'true' && b.getAttribute('aria-busy') !== 'true' }; })()`).catch(() => null);
  const START = `document.querySelector('.ob-title-start')`;
  const CHOICE = `([...document.querySelectorAll('.ob-choices.is-in .ob-choice')].find(b => /explore on my own|我自己逛逛/.test(b.innerText || '')) || document.querySelectorAll('.ob-choices.is-in .ob-choice')[2])`;

  await send('Runtime.enable'); await send('Page.enable');
  if (fresh || !args.warm) { await send('Network.enable'); await send('Network.setCacheDisabled', { cacheDisabled: !args.warm }); }
  await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: MOBILE ? 2 : 1, mobile: MOBILE });
  if (MOBILE) await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
  if (CPU > 1) await send('Emulation.setCPUThrottlingRate', { rate: CPU });
  if (NETS[NET]) { await send('Network.enable'); await send('Network.emulateNetworkConditions', NETS[NET]); }
  await send('Page.addScriptToEvaluateOnNewDocument', { source: RECORDER });
  const t0 = Date.now();
  await send('Page.navigate', { url: URL });
  let titleAt = null, firstTry = null, clicked = false, choiceDone = false, shotTitle = false;
  while (Date.now() - t0 < Number(args.limit || 180000) && !choiceDone) {
    const m = await ev('window.__cold && window.__cold.marks').catch(() => null) || {};
    if (!clicked) {
      const s = await where(START);
      if (s) {
        if (titleAt == null) titleAt = Date.now();
        const due = MODE === 'wait10' ? 10000 : 300;
        if (Date.now() - titleAt >= due) {
          if (firstTry == null) { firstTry = await ev('Math.round(performance.now())'); await tap(s.c); }
          else if (s.on) await tap(s.c);
          // the title as the press found it (准备中… or Start), after the press: the shot never delays it
          if (!shotTitle) { shotTitle = true; await shot('title'); }
          const mm = await ev('window.__cold.marks').catch(() => ({}));
          if (mm && mm.click != null) clicked = true;
        }
      }
    } else if (m.choice != null) {
      await sleep(600); await shot('choice');
      const c = await where(CHOICE);
      if (c) { await tap(c.c); await sleep(5000); await shot('after-choice'); choiceDone = true; }
    }
    await sleep(100);
  }
  await sleep(300);
  const rec = await ev('window.__cold') || { marks: {}, gaps: [], long: [], events: [], glq: { n: 0, ms: 0, slow: [] }, dead: 0 };
  const ff = await ev(`(() => { const e = performance.getEntriesByName('opus-bay:first-frame')[0]; return e ? Math.round(e.startTime) : null; })()`);
  const warm = await ev('(() => { const w = window.__opusBay && window.__opusBay.warmup; return w ? { before: w.before, after: w.after, ms: Math.round(w.ms), pre: w.pre } : null; })()').catch(() => null);
  const gpu = await ev(`(() => { try { const c = document.createElement('canvas').getContext('webgl2'); const e = c.getExtension('WEBGL_debug_renderer_info'); return { r: e ? c.getParameter(e.UNMASKED_RENDERER_WEBGL) : '?', khr: !!c.getExtension('KHR_parallel_shader_compile') }; } catch (x) { return String(x); } })()`);
  const m = rec.marks; const click = m.click ?? null;
  const after = click == null ? [] : rec.gaps.filter(g => g[0] >= click - 50);
  const big = after.filter(g => g[1] > 250);
  const res = {
    tag: TAG, n, url: URL, mode: MODE, mobile: MOBILE, cpu: CPU, net: NET, fresh,
    title: m.title ?? null, ready: m.ready ?? null, firstFrame: ff, click, firstTry,
    titleFreeze: Math.max(0, ...rec.gaps.filter(g => m.title != null && g[0] >= m.title - 50 && (click == null || g[0] < click)).map(g => g[1])),
    clickToChoice: m.choice != null && click != null ? m.choice - click : null,
    firstTryToChoice: m.choice != null && firstTry != null ? m.choice - firstTry : null,
    freeze: big.reduce((a, g) => a + g[1], 0), maxGap: Math.max(0, ...after.map(g => g[1])),
    afterChoiceGap: Math.max(0, ...rec.gaps.filter(g => m.choiceClick != null && g[0] >= m.choiceClick - 50).map(g => g[1])),
    longTask: Math.max(0, ...rec.long.map(l => l[1])), longBeforeClick: Math.max(0, ...rec.long.filter(l => click == null || l[0] < click).map(l => l[1])),
    deadClicks: rec.dead, homeFlash: m.home != null && m.homeGone != null ? m.homeGone - m.home : null,
    startInput: rec.events.filter(e => click != null && Math.abs(e.start - click) < 400)[0] ?? null,
    choiceInput: rec.events.filter(e => m.choiceClick != null && Math.abs(e.start - m.choiceClick) < 400)[0] ?? null,
    glq: args.glq ? { firstUses: rec.glq.n, waitMs: Math.round(rec.glq.ms), slowBeforeClick: rec.glq.slow.filter(s => click == null || s[0] < click).length, slowAfterClick: rec.glq.slow.filter(s => click != null && s[0] >= click).length, slow: rec.glq.slow.slice(0, 40) } : undefined,
    warm, gaps: rec.gaps, marks: m, gpu, errors: errors.slice(0, 5),
  };
  fs.writeFileSync(path.join(dir, 'result.json'), JSON.stringify(res, null, 1));
  const { gaps: _g, marks: _m, glq, ...line } = res;
  const brief = { ...line, glq: glq && { firstUses: glq.firstUses, waitMs: glq.waitMs, slowBeforeClick: glq.slowBeforeClick, slowAfterClick: glq.slowAfterClick } };
  fs.appendFileSync(path.join(OUT, 'summary.jsonl'), JSON.stringify(brief) + '\n');
  console.log(JSON.stringify(brief));
  try { await send('Browser.close'); } catch { /* gone */ }
  await sleep(800); try { chrome.kill(); } catch { /* gone */ }
  if (fresh) { await sleep(500); try { fs.rmSync(profile, { recursive: true, force: true }); } catch { /* locked: leave it */ } }
  return brief;
}

const rows = [];
for (let i = 1; i <= RUNS; i++) { rows.push(await run(i)); if (i < RUNS) await sleep(3000); }
const pick = (k) => rows.map(r => r[k]).filter(v => typeof v === 'number').sort((a, b) => a - b);
const q = (a, p) => a.length ? a[Math.min(a.length - 1, Math.ceil(p * a.length) - 1)] : null;
const table = {};
for (const k of ['title', 'ready', 'firstFrame', 'titleFreeze', 'clickToChoice', 'firstTryToChoice', 'freeze', 'maxGap', 'afterChoiceGap', 'longTask', 'longBeforeClick', 'deadClicks']) {
  const a = pick(k); table[k] = { median: q(a, 0.5), p75: q(a, 0.75), max: a.length ? a[a.length - 1] : null };
}
console.log(JSON.stringify({ tag: TAG, runs: rows.length, summary: table }));
process.exit(0);
