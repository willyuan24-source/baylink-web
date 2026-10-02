// Wave 9 · lane F · the first-minute gate (review R§5 #5 / §8 idea 4; sf-w9-lead.md §3 F (1), §6 "the first-minute gate").
//
// A fresh Chrome profile per run plays the first minute of each entry like a new player and counts the MESSAGES on screen
// four times a second. Pass = at most 3 at once in every second of the first 60 s (the review saw 7–9 at the Ferry
// Building), on desktop and phone, in zh and en. It also reports when the player first moves on their own.
//
//   node scripts/opus-sf/qa/first-minute.mjs [--base http://localhost:5902] [--out C:/Users/willy/opus-qa/w9/f/fm]
//        [--entries tour,week,free,local] [--langs zh,en] [--views desktop,phone] [--seconds 60] [--shots]
//
// The page must be the DEV server (vite.opus.config.ts) — the probe reads window.__opusBay (game, flow, runtime) — or
// a production preview (then only the DOM is read: no player position, no "first own move").
// Env CHROME_FLAGS (e.g. --force_high_performance_gpu) is passed to Chrome. Never run while
// C:/Users/willy/opus-qa/w9/PERF-LOCK exists (W9-Z is measuring): the script refuses.
//
// What counts as a message (visible: rendered, in the viewport, opacity > 0.1):
//   title   toasts and banners (.ob-toast incl. the arrival banner, .ob-time-offer, .ob-ride, .ob-ribbon), cards
//           (.ob-arrival-card, .ob-goals-card, .ob-gstep, .ob-reward, .ob-trip-card, .ob-coach, [data-attention=title]),
//           the dialogue box (.ob-dialogue) and an open side panel (game.panel)
//   action  the E prompt (.ob-context / .ob-touch-action), the lead / go chips (.ob-lead-chip, .ob-go-chip),
//           [data-attention=action]
//   line    BAYBAY's or a resident's bubble (.ob-bubble)
//   chip    the discovery chip (.ob-found-chip), the objective chip (.ob-objective-chip)
// Not counted (the HUD, always in the same place): the area label, the objective / trip / tour pill, the buttons, the
// coin badge — reported as `hud` for reference.
//
// The bot: Start; waits for the welcome choice and picks the entry (1 tour · 2 week · 3 free · 4 local); answers any later
// choice with its first option after 1.5 s (the week questions; a tour's version choice), except the goals step, where
// it taps 我自己逛 (free) — it never closes a card a player would read; advances a choice-less dialogue after 2.5 s; once
// the player is free (playing, no dialogue / cinematic, not locked, not riding) it waits 1 s and walks for 1.2 s (W on
// desktop, the left stick on the phone) and records when the player first moved under its own input.
//
// Output: <out>/<view>-<lang>-<entry>.json (every sample), <out>/summary.jsonl (one row per run), a table on stdout;
// --shots: a JPEG at the busiest moment and at 20 s.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const argv = process.argv.slice(2);
const args = {};
for (let i = 0; i < argv.length; i++) if (argv[i].startsWith('--')) args[argv[i].slice(2)] = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true;
const BASE = (args.base || 'http://localhost:5902').replace(/\/$/, '');
const OUT = path.resolve(args.out || 'C:/Users/willy/opus-qa/w9/f/first-minute');
const ENTRIES = String(args.entries || 'tour,week,free,local').split(',');
const LANGS = String(args.langs || 'zh,en').split(',');
const VIEWS = String(args.views || 'desktop,phone').split(',');
const SECONDS = Number(args.seconds || 60);
const SHOTS = !!args.shots;
const LIMIT = 3;
const PERF_LOCK = 'C:/Users/willy/opus-qa/w9/PERF-LOCK';
const ENTRY_KEY = { tour: 1, week: 2, free: 3, local: 4 };
const VIEW = { desktop: { w: 1440, h: 900, mobile: false, dpr: 1 }, phone: { w: 390, h: 844, mobile: true, dpr: 2 } };

if (fs.existsSync(PERF_LOCK)) { console.error(`PERF-LOCK present (${fs.readFileSync(PERF_LOCK, 'utf8').trim()}): not starting Chrome.`); process.exit(3); }
fs.mkdirSync(OUT, { recursive: true });
const sleep = ms => new Promise(r => setTimeout(r, ms));

// ---------------------------------------------------------------------------------------------------------------
// The in-page probe (a string: evaluated in the page)
// ---------------------------------------------------------------------------------------------------------------
const PROBE = `(() => {
  const vis = el => {
    if (!el.isConnected) return false;
    if (el.checkVisibility && !el.checkVisibility({ opacityProperty: true, visibilityProperty: true })) return false;
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2 || r.bottom < 0 || r.right < 0 || r.top > innerHeight || r.left > innerWidth) return false;
    for (let e = el; e && e !== document.body; e = e.parentElement) { const cs = getComputedStyle(e); if (Number(cs.opacity) < 0.1) return false; }
    return true;
  };
  const text = el => (el.innerText || el.textContent || '').replace(/\\s+/g, ' ').trim().slice(0, 90);
  const CATS = {
    title: '.ob-toast, .ob-time-offer, .ob-ride, .ob-ribbon, .ob-arrival-card, .ob-goals-card, .ob-gstep, .ob-reward, .ob-trip-card, .ob-coach, .ob-dialogue, [data-attention="title"]',
    action: '.ob-context, .ob-touch-action, .ob-lead-chip, .ob-go-chip, [data-attention="action"]',
    line: '.ob-bubble',
    chip: '.ob-found-chip, .ob-objective-chip',
  };
  const items = [];
  const seen = new Set();
  for (const [cat, sel] of Object.entries(CATS)) {
    for (const el of document.querySelectorAll(sel)) {
      if (seen.has(el)) continue;
      // an element inside an already-counted one (a toast inside a card) is the same message
      let inner = false;
      for (const s of seen) if (s.contains(el)) { inner = true; break; }
      if (inner || !vis(el)) continue;
      seen.add(el);
      items.push({ cat, cls: String(el.className || '').split(/\\s+/).slice(0, 2).join('.'), text: text(el) });
    }
  }
  const o = window.__opusBay;
  const g = o && o.game && o.game.get ? o.game.get() : null;
  const f = o && o.flow && o.flow.get ? o.flow.get() : null;
  const p = o && o.runtime ? o.runtime.player : null;
  if (g && g.panel && g.panel.kind) items.push({ cat: 'title', cls: 'panel:' + g.panel.kind, text: '' });
  const hud = [...document.querySelectorAll('.ob-area, .ob-objective, .ob-trip-pill')].filter(vis).map(el => text(el));
  const choices = [...document.querySelectorAll('.ob-dialogue .ob-choice')].filter(vis).map(el => text(el));
  const gstep = !!document.querySelector('.ob-gstep') && vis(document.querySelector('.ob-gstep'));
  const start = document.querySelector('.ob-title-start');
  return {
    items, hud, choices, gstep,
    dialogue: !!document.querySelector('.ob-dialogue') && vis(document.querySelector('.ob-dialogue')),
    title: !!start && vis(start), startBusy: !!start && start.getAttribute('aria-busy') === 'true',
    hooks: !!g,
    phase: g ? g.phase : null, mode: g ? g.mode : null, dialogueId: g ? g.dialogue.nodeId : null, riding: g ? !!g.riding : null,
    cinematic: f ? f.cinematic : null, trip: f ? !!f.trip : null, moveMode: g && g.move ? g.move.mode : null,
    player: p ? { x: Math.round(p.x * 10) / 10, z: Math.round(p.z * 10) / 10, moving: !!p.moving, speed: Math.round((p.speed || 0) * 100) / 100, locked: !!p.locked } : null,
    timeOfDay: g ? g.timeOfDay : null,
    auto: o && o.c && typeof o.c.auto === 'function' ? !!o.c.auto() : null,
    leadChip: [...document.querySelectorAll('.ob-lead-chip')].some(vis),
    attention: o && o.attention ? o.attention.snapshot() : null,
  };
})()`;

// ---------------------------------------------------------------------------------------------------------------
// One run
// ---------------------------------------------------------------------------------------------------------------
async function run(view, lang, entry) {
  const V = VIEW[view];
  const name = `${view}-${lang}-${entry}`;
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'opus-fm-'));
  const chromePath = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
  const extra = process.env.CHROME_FLAGS ? process.env.CHROME_FLAGS.split(' ').filter(Boolean) : [];
  const acceptLang = lang === 'en' ? 'en-US' : 'zh-CN';
  const chrome = spawn(chromePath, [...extra, '--headless=new', '--remote-debugging-port=0', `--user-data-dir=${profile}`, '--no-first-run', '--no-default-browser-check', '--enable-gpu', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required', `--window-size=${V.w},${V.h}`, `--lang=${acceptLang}`, 'about:blank'], { stdio: 'ignore' });
  const samples = [];
  const result = { run: name, view, lang, entry, ok: false };
  try {
    let port = 0;
    for (let i = 0; i < 150 && !port; i++) { try { port = Number(fs.readFileSync(path.join(profile, 'DevToolsActivePort'), 'utf8').split('\n')[0]) || 0; } catch { /* not yet */ } if (!port) await sleep(100); }
    if (!port) throw new Error('Chrome did not start');
    let targets = [];
    for (let i = 0; i < 50; i++) { try { targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); if (targets.find(t => t.type === 'page')) break; } catch { /* retry */ } await sleep(200); }
    const ws = new WebSocket(targets.find(t => t.type === 'page').webSocketDebuggerUrl);
    await new Promise(r => ws.addEventListener('open', r, { once: true }));
    let mid = 0; const pending = new Map(); const errors = [];
    ws.addEventListener('message', ev => {
      const msg = JSON.parse(ev.data);
      if (msg.id && pending.has(msg.id)) { const p = pending.get(msg.id); pending.delete(msg.id); if (msg.error) p.reject(new Error(JSON.stringify(msg.error))); else p.resolve(msg.result); }
      else if (msg.method === 'Runtime.exceptionThrown') errors.push((msg.params.exceptionDetails.exception?.description || msg.params.exceptionDetails.text || '').slice(0, 300));
    });
    const send = (method, params = {}) => new Promise((resolve, reject) => { const id = ++mid; pending.set(id, { resolve, reject }); ws.send(JSON.stringify({ id, method, params })); });
    const ev = async expr => { const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }); return r.result?.value; };
    await send('Runtime.enable'); await send('Page.enable');
    await send('Emulation.setDeviceMetricsOverride', { width: V.w, height: V.h, deviceScaleFactor: V.dpr, mobile: V.mobile });
    if (V.mobile) await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
    await send('Network.enable').catch(() => {});
    await send('Network.setUserAgentOverride', { userAgent: V.mobile ? 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Mobile Safari/537.36' : 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36', acceptLanguage: acceptLang }).catch(() => {});
    const url = `${BASE}/opus-bay?lang=${lang === 'en' ? 'en' : 'zh-Hans'}`;
    const T0 = Date.now();
    await send('Page.navigate', { url });
    const tap = async (x, y) => {
      if (V.mobile) {
        await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
        await sleep(60);
        await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      } else {
        await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y, button: 'none' });
        await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
        await sleep(50);
        await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 });
      }
    };
    const tapSel = async (sel, nth = 0) => {
      const r = await ev(`(() => { const els = [...document.querySelectorAll(${JSON.stringify(sel)})].filter(e => e.getBoundingClientRect().width > 0); const e = els[${nth}]; if (!e) return null; const b = e.getBoundingClientRect(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; })()`);
      if (!r) return false;
      await tap(r.x, r.y);
      return true;
    };
    const key = async (code, ms = 80) => {
      const k = code.startsWith('Key') ? code.slice(3).toLowerCase() : code.startsWith('Digit') ? code.slice(5) : code === 'Enter' ? 'Enter' : code;
      await send('Input.dispatchKeyEvent', { type: 'keyDown', code, key: k, text: k.length === 1 ? k : undefined, windowsVirtualKeyCode: code === 'Enter' ? 13 : undefined });
      await sleep(ms);
      await send('Input.dispatchKeyEvent', { type: 'keyUp', code, key: k, windowsVirtualKeyCode: code === 'Enter' ? 13 : undefined });
    };
    const walk = async () => {
      if (V.mobile) {
        // the left stick: a drag up from the lower left
        const x = Math.round(V.w * 0.25), y = Math.round(V.h * 0.55);
        await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
        for (let i = 1; i <= 8; i++) { await send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: y - i * 7 }] }); await sleep(40); }
        await sleep(900);
        await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      } else await key('KeyW', 1200);
    };
    // 1) the title, ready
    let probe = null;
    for (;;) {
      probe = await ev(PROBE).catch(() => null);
      if (probe?.title && !probe.startBusy && probe.hooks) break;
      if (Date.now() - T0 > 300_000) throw new Error('the title never got ready');
      await sleep(400);
    }
    result.titleReadyS = +((Date.now() - T0) / 1000).toFixed(1);
    await sleep(1200);
    if (!(await tapSel('.ob-title-start'))) throw new Error('no Start button');
    const tStart = Date.now();
    // 2) the welcome choice
    for (;;) {
      probe = await ev(PROBE).catch(() => null);
      if (probe?.choices?.length >= 4) break;
      if (Date.now() - tStart > 90_000) throw new Error('no welcome choice');
      await sleep(250);
    }
    result.choiceAfterStartS = +((Date.now() - tStart) / 1000).toFixed(1);
    await sleep(1500); // a new player reads the four options
    const n = ENTRY_KEY[entry];
    if (V.mobile) await tapSel('.ob-dialogue .ob-choice', n - 1); else await key(`Digit${n}`);
    const t0 = Date.now();
    // 3) the first minute
    let dialogSince = 0, lastDialog = null, freeAt = null, movedAt = null, walked = false, gstepTapped = false, leadSince = 0, freeRun = 0;
    let busiest = { n: -1, t: 0 };
    let shot20 = false;
    const shoot = async file => { const r = await send('Page.captureScreenshot', { format: 'jpeg', quality: 70 }); fs.writeFileSync(path.join(OUT, file), Buffer.from(r.data, 'base64')); };
    while (Date.now() - t0 < SECONDS * 1000) {
      const t = (Date.now() - t0) / 1000;
      probe = await ev(PROBE).catch(() => null);
      if (!probe) { await sleep(250); continue; }
      const counted = probe.items;
      samples.push({ t: +t.toFixed(2), n: counted.length, items: counted, hud: probe.hud, dialogue: probe.dialogueId, cinematic: probe.cinematic, player: probe.player, mode: probe.mode, moveMode: probe.moveMode, trip: probe.trip, auto: probe.auto, timeOfDay: probe.timeOfDay, attention: probe.attention });
      if (counted.length > busiest.n) {
        busiest = { n: counted.length, t };
        if (SHOTS && counted.length > LIMIT) await shoot(`${name}-busiest.jpg`).catch(() => {});
      }
      if (SHOTS && !shot20 && t >= 20) { shot20 = true; await shoot(`${name}-20s.jpg`).catch(() => {}); }
      // the bot
      const key2 = probe.dialogueId ?? null;
      if (key2 !== lastDialog) { lastDialog = key2; dialogSince = Date.now(); }
      if (probe.gstep && !gstepTapped && Date.now() - t0 > 1500) { gstepTapped = true; if (!(await tapSel('.ob-gstep-self'))) await tapSel('.ob-gstep-go'); }
      else if (probe.dialogue && probe.choices.length && Date.now() - dialogSince > 1500) { if (V.mobile) await tapSel('.ob-dialogue .ob-choice', 0); else await key('Digit1'); dialogSince = Date.now() + 1000; }
      else if (probe.dialogue && !probe.choices.length && Date.now() - dialogSince > 2500) { await key('Enter'); dialogSince = Date.now(); }
      const free = probe.phase === 'playing' && !probe.dialogueId && !probe.cinematic && probe.player && !probe.player.locked && !probe.riding && probe.moveMode === 'foot' && !probe.gstep && !probe.auto;
      // a cooperative player: BAYBAY's lead chip (让 BAYBAY 带我过去 / 自动跟上) is tapped once it has been up 3 s
      if (probe.leadChip) { leadSince ||= Date.now(); if (walked && Date.now() - leadSince > 3000) { await tapSel('.ob-lead-chip'); leadSince = Date.now() + 5000; } } else leadSince = 0;
      // free for two samples in a row (≥ 0.25 s): not the instant between two dialogues
      freeRun = free ? freeRun + 1 : 0;
      if (freeRun >= 2 && freeAt === null) freeAt = t;
      if (freeAt !== null && !walked && t >= freeAt + 1) {
        walked = true;
        const before = probe.player;
        await walk();
        const after = await ev(PROBE).catch(() => null);
        if (after?.player && before && Math.hypot(after.player.x - before.x, after.player.z - before.z) > 0.8) movedAt = +(t + 0.6).toFixed(1);
      }
      await sleep(250);
    }
    // per second: the max at once
    const perSecond = [];
    for (const s of samples) { const i = Math.floor(s.t); perSecond[i] = Math.max(perSecond[i] ?? 0, s.n); }
    const max = Math.max(0, ...perSecond.filter(v => v !== undefined));
    const worst = samples.filter(s => s.n === max).slice(0, 1).map(s => ({ t: s.t, items: s.items.map(i => `${i.cat}:${i.cls}:${i.text}`) }))[0] ?? null;
    Object.assign(result, {
      ok: true, max, pass: max <= LIMIT, overSeconds: perSecond.filter(v => v > LIMIT).length, perSecond,
      firstFreeS: freeAt === null ? null : +freeAt.toFixed(1), firstOwnMoveS: movedAt, worst, errors: errors.slice(0, 5),
      timeOfDay: [...new Set(samples.map(s => s.timeOfDay))],
    });
    fs.writeFileSync(path.join(OUT, `${name}.json`), JSON.stringify({ result, samples }, null, 1));
    ws.close();
  } catch (error) {
    result.error = String(error?.message || error);
  } finally {
    chrome.kill();
    await sleep(500);
    try { fs.rmSync(profile, { recursive: true, force: true }); } catch { /* locked */ }
  }
  fs.appendFileSync(path.join(OUT, 'summary.jsonl'), JSON.stringify({ at: new Date().toISOString(), ...result, perSecond: undefined, worst: result.worst ? { t: result.worst.t, items: result.worst.items } : null }) + '\n');
  return result;
}

const rows = [];
for (const view of VIEWS) for (const lang of LANGS) for (const entry of ENTRIES) {
  if (fs.existsSync(PERF_LOCK)) { console.error('PERF-LOCK appeared: stopping.'); process.exit(3); }
  let r = await run(view, lang, entry);
  // a loaded machine can keep a cold dev server from answering in time: one more try
  if (!r.ok && /never got ready|no welcome choice|Chrome did not start/.test(r.error ?? '')) r = await run(view, lang, entry);
  rows.push(r);
  console.log(`${r.run.padEnd(20)} ${r.ok ? `max ${r.max} ${r.pass ? 'PASS' : 'FAIL'} (${r.overSeconds}s over) · free ${r.firstFreeS ?? '-'} s · own move ${r.firstOwnMoveS ?? '-'} s · choice ${r.choiceAfterStartS} s after Start` : `ERROR ${r.error}`}`);
  if (r.worst) console.log(`   busiest @${r.worst.t}s: ${r.worst.items.join(' | ')}`);
}
const fails = rows.filter(r => !r.ok || !r.pass);
console.log(`\n${rows.length - fails.length}/${rows.length} pass (≤ ${LIMIT} messages at once in every second of the first ${SECONDS} s)`);
process.exit(fails.length ? 1 : 0);
