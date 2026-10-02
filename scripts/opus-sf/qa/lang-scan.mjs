// W8-Q · the wrong-script scan: open every screen of the city a headless Chrome can reach in one language and list the
// text that is not in that language. English: any Han character in visible DOM text, in an aria-label / title /
// placeholder / alt, in document.title, or painted on a canvas (fillText / strokeText: the map, the world's painted
// labels, the photo frames). 繁體: Simplified-only characters (a text the site's own cn → tw converter would still
// change was never converted).
//
// Usage (a dev server of this worktree must be running; one headless Chrome; respects the PERF-LOCK):
//   node scripts/opus-sf/qa/lang-scan.mjs --port 5802 --lang en [--mobile] [--w 390 --h 844] [--out <dir>] [--shots]
//        [--only title,hud,map,...] [--query '&halloween=1'] [--lock C:/Users/willy/opus-qa/w8/PERF-LOCK]
// Prints one JSON line per screen ({ screen, leaks: [...] }) and writes <out>/lang-<lang>-<size>.json (+ a JPEG per
// screen with --shots). Exit code 0 always (it is a report, not a gate); "leaks" are what to read.
// Screens (--only takes these names): title · start (the ferry arrival, the hello dialogue) · goals (the goals step) ·
// hud · more (the phone bar's 更多) · map (+ its tabs and legend) · search (the map search "coit") · place (a place card)
// · week (这周去哪 + the board) · event (cards of --events a,b,c) · ask (问 BAYBAY) · journal (every tab and every page of
// a tab with its own tablist, e.g. the Notebook's; top and end) · shop · album · settings (top + end) · result (a play
// result card) · postcard (a Halloween postcard) · ride (a cable car card) · metro (an underground Muni Metro ride: the
// subway overlay) · busk (lane M's busker jam) · ferry (lane A's Alcatraz boat from Pier 33: add
// --query '&halloween=1&date=2026-10-02T11:00' for a day crossing) · arrival (Coit Tower) · canvas (every canvas text
// painted during the run).
// W8-Q (2026-09-30): English and 繁體 at 390 × 844 (touch) and 1440 × 900 found the 今天 week row's venue, the event
// card's Where row and the Notebook's "Tap 听一听" (fixed in W8-Q2 / W8-Q3). Node twins of the catalog parts:
// tests/opus-bay-w8-q-lang.test.ts and tests/opus-bay-w8-q-cards.test.ts. Re-run after new overlays land (W8-I, W8-Z).
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const argv = process.argv.slice(2);
const args = {};
for (let i = 0; i < argv.length; i++) if (argv[i].startsWith('--')) args[argv[i].slice(2)] = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true;
const PORT = Number(args.port || 5802);
const LANG = args.lang || 'en';
const MOBILE = !!args.mobile;
const W = Number(args.w || (MOBILE ? 390 : 1440)), H = Number(args.h || (MOBILE ? 844 : 900));
const OUT = path.resolve(args.out || 'lang-scan');
const ONLY = args.only ? new Set(String(args.only).split(',')) : null;
const LOCK = args.lock || 'C:/Users/willy/opus-qa/w8/PERF-LOCK';
const SHOTS = !!args.shots;
const sleep = ms => new Promise(r => setTimeout(r, ms));
fs.mkdirSync(OUT, { recursive: true });
if (fs.existsSync(LOCK)) { console.log(JSON.stringify({ error: `PERF-LOCK present (${LOCK}): no Chrome now` })); process.exit(0); }

// 繁體: the site's own converter decides what is Simplified (a converted text converts to itself)
// (W8-I, W8I-WS-3) opencc's cn→tw is not idempotent ('馬里納區' → '馬裡納區'): a text is Simplified only when a
// round trip through Simplified does not give it back (tw→cn→tw), so a correctly converted transliteration is no leak
// (W9-L) …and on the game page the site adds its Taiwan words (src/i18n/locale.ts TAIWAN_WORDS / TAIWAN_AFTER, read from
// that file: 设置 → 設定, 旅行本里 → 旅行本裡, 227 米 → 227 公尺): a text is right when either round trip gives it back.
// A text that still has the mainland word (設置, 資訊's 信息, 意大利, 視頻 …: the stock cn → tw of a TAIWAN_WORDS key) is a
// leak too, reported with `mainland`.
let toTw = null, mainland = [];
if (LANG === 'zh-Hant') {
  const O = await import('opencc-js');
  const tw = O.Converter({ from: 'cn', to: 'tw' }), cn = O.Converter({ from: 'tw', to: 'cn' });
  const src = fs.readFileSync(path.resolve('src/i18n/locale.ts'), 'utf8');
  const pairs = name => { const i = src.indexOf(`const ${name}`); return i < 0 ? [] : [...src.slice(i, src.indexOf('];', i)).matchAll(/\['([^']+)', '([^']+)'\]/g)].map(m => [m[1], m[2]]); };
  const words = pairs('TAIWAN_WORDS'), after = pairs('TAIWAN_AFTER');
  const pre = words.length ? O.CustomConverter(words) : t => t;
  const twWords = t => after.reduce((x, [a, b]) => x.replaceAll(a, b), tw(pre(t)).replace(/(\d)(\s*)(平方)?米(?![飯色黃粉其糕蘭])/g, '$1$2$3公尺'));
  toTw = t => { const s0 = cn(t), a = tw(s0); return a === t ? a : twWords(s0); };
  mainland = [...new Set(words.map(([k, v]) => [tw(k), v]).filter(([m, v]) => m !== v).map(([m]) => m))];
  if (!words.length) console.log(JSON.stringify({ note: 'TAIWAN_WORDS not found in src/i18n/locale.ts: the stock round trip only' }));
}
const HAN = /\p{Script=Han}/u;
const mainlandIn = text => mainland.filter(w => text.includes(w));
const wrong = text => (LANG === 'en' ? HAN.test(text) : LANG === 'zh-Hant' ? HAN.test(text) && (toTw(text) !== text || mainlandIn(text).length > 0) : false);
const showWrong = text => (LANG === 'zh-Hant' ? [...text].filter(ch => HAN.test(ch) && toTw(ch) !== ch).join('') : '');
// Bilingual on purpose (reported as "allowed", not as leaks): the language switch's own label (the way back for a
// reader who cannot read the current language), the district / city weekly board's painted title, and the shop-sign
// atlas (world/sf/signsAtlas.ts paints every plaque's lines in one 1024² canvas: Chinese first on Irving / Clement,
// Japanese in Japantown, as the real streets are signed; the English line is on the same plaque).
const ALLOW = [
  { re: /^Language · 语言$/, why: 'the language switch label (bilingual by design)' },
  { re: /^这周去哪 · THIS WEEK$/, why: 'the weekly board\'s painted title (bilingual sign, world/landmarks.ts)' },
  { kind: 'canvas', where: '1024x1024', re: /^[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana} ]{1,8}$/u, why: 'a shop-sign atlas cell (bilingual plaques, world/sf/signsAtlas.ts)' },
];
const allowed = f => ALLOW.find(a => (!a.kind || a.kind === f.kind) && (!a.where || a.where === f.where) && a.re.test(f.text))?.why;

// --- Chrome over CDP (the opus-shot.mjs pattern: a free port, its own profile) -----------------------------------------
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'lang-scan-'));
const chromePath = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const flags = (process.env.CHROME_FLAGS || '--force_high_performance_gpu').split(' ').filter(Boolean);
const chrome = spawn(chromePath, [...flags, '--headless=new', '--remote-debugging-port=0', `--user-data-dir=${profile}`, '--no-first-run', '--no-default-browser-check', '--enable-gpu', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required', `--window-size=${W},${H}`, 'about:blank'], { stdio: 'ignore' });
let port = 0;
for (let i = 0; i < 150 && !port; i++) { try { port = Number(fs.readFileSync(path.join(profile, 'DevToolsActivePort'), 'utf8').split('\n')[0]) || 0; } catch { /* not yet */ } if (!port) await sleep(100); }
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
const ev = async expr => { const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }); return r.result?.value ?? (r.exceptionDetails ? { error: r.exceptionDetails.exception?.description ?? r.exceptionDetails.text } : undefined); };
const page = body => ev(`(async () => { const ob = window.__opusBay; const imp = p => import('/src/opus-bay/' + p); ${body} })()`);
const touchTap = async (x, y) => { await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 0, radiusX: 8, radiusY: 8, force: 1 }] }); await sleep(60); await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); };
const mouseClick = async (x, y) => { await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y, button: 'none' }); await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 }); await sleep(50); await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 }); };
const tap = (x, y) => (MOBILE ? touchTap(x, y) : mouseClick(x, y));
const press = async code => { const key = code === 'Escape' ? 'Escape' : code; await send('Input.dispatchKeyEvent', { type: 'keyDown', code, key }); await sleep(60); await send('Input.dispatchKeyEvent', { type: 'keyUp', code, key }); };
/** the centre of the first visible element matching a selector whose text matches `re` */
const centre = (sel, re = '.') => ev(`(() => { const re = new RegExp(${JSON.stringify(re)}, 'i'); for (const el of document.querySelectorAll(${JSON.stringify(sel)})) { if (!el.checkVisibility?.({ opacityProperty: true, visibilityProperty: true })) continue; if (!re.test((el.textContent || '') + ' ' + (el.getAttribute('aria-label') || ''))) continue; const r = el.getBoundingClientRect(); if (r.width && r.height) return [r.x + r.width / 2, r.y + r.height / 2]; } return null; })()`);
const tapSel = async (sel, re) => { const c = await centre(sel, re); if (!c) return false; await tap(c[0], c[1]); return true; };
const waitFor = async (cond, ms = 30000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await ev(`(() => { try { return !!(${cond}); } catch { return false; } })()`) === true) return true; await sleep(250); } return false; };

// --- in the page: the canvas recorder (before any script) and the DOM collector -----------------------------------------
await send('Runtime.enable'); await send('Page.enable');
await send('Page.addScriptToEvaluateOnNewDocument', { source: `(() => {
  const seen = window.__langCanvas = new Map();
  for (const C of [window.CanvasRenderingContext2D, window.OffscreenCanvasRenderingContext2D]) {
    if (!C) continue;
    for (const fn of ['fillText', 'strokeText']) { const orig = C.prototype[fn]; C.prototype[fn] = function (text, ...rest) { try { const s = String(text); if (/\\p{Script=Han}/u.test(s) && !seen.has(s)) seen.set(s, (this.canvas && this.canvas.className) || (this.canvas && this.canvas.width + 'x' + this.canvas.height) || ''); } catch { /* never break drawing */ } return orig.call(this, text, ...rest); }; }
  }
})();` });
const COLLECT = `(() => {
  const HAN = /\\p{Script=Han}/u, out = new Map(), lang = document.documentElement.lang;
  const own = el => { const l = el.closest('[lang]'); return !l || l === document.documentElement || l.getAttribute('lang') === lang; };
  const visible = el => el.checkVisibility ? el.checkVisibility({ opacityProperty: true, visibilityProperty: true }) : true;
  const where = el => { const parts = []; for (let e = el; e && e !== document.body && parts.length < 4; e = e.parentElement) { const c = typeof e.className === 'string' ? e.className.trim().split(/\\s+/).filter(x => x.startsWith('ob-') || x.startsWith('mw-') || x.startsWith('h-') || x.startsWith('e-')).slice(0, 2).join('.') : ''; parts.unshift(e.tagName.toLowerCase() + (c ? '.' + c : '')); } return parts.join(' > '); };
  const add = (text, el, kind) => { const t = text.replace(/\\s+/g, ' ').trim(); if (!t || !HAN.test(t)) return; const k = kind + '|' + t; if (!out.has(k)) out.set(k, { kind, text: t.slice(0, 240), where: where(el) }); };
  const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n = walk.nextNode(); n; n = walk.nextNode()) {
    const el = n.parentElement; if (!el || /^(SCRIPT|STYLE|NOSCRIPT)$/.test(el.tagName) || el.closest('.ob-debug')) continue;
    if (!HAN.test(n.nodeValue) || !own(el) || !visible(el)) continue;
    const r = document.createRange(); r.selectNodeContents(n); const b = r.getBoundingClientRect(); if (!b.width && !b.height) continue;
    add(n.nodeValue, el, 'text');
  }
  for (const el of document.querySelectorAll('[aria-label],[title],[placeholder],[alt]')) {
    if (el.closest('.ob-debug') || !own(el) || !visible(el)) continue;
    for (const a of ['aria-label', 'title', 'placeholder', 'alt']) { const v = el.getAttribute(a); if (v) add(v, el, a); }
  }
  add(document.title, document.body, 'document.title');
  return [...out.values()];
})()`;

const report = { lang: LANG, size: `${W}x${H}`, mobile: MOBILE, url: '', screens: [] };
const allWrong = new Map(), allAllowed = new Map();
/** wrong-script finds → leaks, minus the ALLOW list (kept apart, with the reason) */
const sortOut = finds => { const leaks = []; for (const f0 of finds) { if (!wrong(f0.text)) continue; const f = LANG === 'zh-Hant' ? { ...f0, simplified: showWrong(f0.text), ...(mainlandIn(f0.text).length ? { mainland: mainlandIn(f0.text) } : {}) } : f0; const why = allowed(f); if (why) { if (!allAllowed.has(f.text)) allAllowed.set(f.text, { ...f, why }); } else leaks.push(f); } return leaks; };
async function scan(screen, { shot = SHOTS } = {}) {
  await sleep(250);
  const found = (await ev(COLLECT)) || [];
  const leaks = sortOut(Array.isArray(found) ? found : []);
  for (const l of leaks) { const k = `${l.kind}|${l.text}`; if (!allWrong.has(k)) allWrong.set(k, { ...l, screens: [] }); allWrong.get(k).screens.push(screen); }
  report.screens.push({ screen, leaks: leaks.length });
  console.log(JSON.stringify({ screen, leaks }));
  if (shot) { const r = await send('Page.captureScreenshot', { format: 'jpeg', quality: 70 }); fs.writeFileSync(path.join(OUT, `lang-${LANG}-${W}x${H}-${screen.replace(/[^a-z0-9-]+/gi, '_')}.jpg`), Buffer.from(r.data, 'base64')); }
}
const want = name => !ONLY || ONLY.has(name) || ONLY.has(name.split(':')[0]);
const closeAll = async () => { await page(`ob?.game?.set?.({ panel: { kind: null } }); const s = await imp('ui/slots.ts'); for (const o of s.openOverlays?.() ?? []) { if (!/^(play-chip|first-flight)/.test(o.id)) s.closeOverlay?.(o.id); } return 1;`); await sleep(300); };

try {
  await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: MOBILE ? 2 : 1, mobile: MOBILE });
  if (MOBILE) await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
  report.url = `http://localhost:${PORT}/opus-bay?world=city&save=off&lang=${LANG}${MOBILE ? '&quality=mid' : ''}${args.query || '&halloween=1'}`;
  await send('Page.navigate', { url: report.url });
  await waitFor(`document.querySelector('.ob-title-start') && window.__opusBay?.game`, 90000);
  await sleep(1500);
  if (want('title')) await scan('title');

  // Start → the ferry arrival → the hello dialogue → choices → the goals step
  await tapSel('.ob-title-start');
  await waitFor(`window.__opusBay?.game?.get?.().phase === 'playing'`, 60000);
  await sleep(2500);
  if (want('start')) await scan('start');
  for (let k = 0; k < 16; k++) {
    const st = await ev(`({ d: !!document.querySelector('.ob-dialogue-box'), g: !!document.querySelector('.ob-gstep'), ch: document.querySelectorAll('.ob-choice').length })`);
    if (st?.g) break;
    if (st?.ch) { if (want('start')) await scan(`dialogue-choices-${k}`); if (!(await tapSel('.ob-choice', 'wander|explore|自己|随便|隨便|先逛|free'))) await tapSel('.ob-choice'); await sleep(1500); continue; }
    if (st?.d) { if (want('start') && k < 3) await scan(`dialogue-${k}`); await tapSel('.ob-dialogue-box'); await sleep(1300); continue; }
    await sleep(1200);
  }
  if (want('goals')) await scan('goals');
  if (!(await tapSel('.ob-gstep button', 'my own|wander|自己|explore'))) await tapSel('.ob-gstep button');
  await sleep(2500);
  await page(`ob.flow?.closeDialogue?.(); return 1`);
  if (want('hud')) await scan('hud');
  if (MOBILE && want('more')) { if (await tapSel('.ob-bar button', 'More|更多')) { await sleep(600); await scan('more'); await press('Escape'); await sleep(400); } }

  // the map, its search, a place card
  if (want('map') || want('search')) {
    await page(`ob.game.set({ panel: { kind: 'map' } }); return 1`); await sleep(2500);
    if (want('map')) {
      await scan('map');
      // the map's own tabs / modes (list, legend, filters …): every one once
      const n = (await ev(`document.querySelectorAll('.ob-map [role=tab], .ob-citymap [role=tab], .ob-sheet [role=tab]').length`)) || 0;
      for (let i = 0; i < Math.min(n, 8); i++) {
        const name = await ev(`(() => { const b = document.querySelectorAll('.ob-map [role=tab], .ob-citymap [role=tab], .ob-sheet [role=tab]')[${i}]; if (!b) return null; b.click(); return (b.textContent || 'tab${i}').trim().slice(0, 20); })()`);
        if (!name) break;
        await sleep(1200); await scan(`map:${name}`);
      }
      const legend = await ev(`(() => { const b = [...document.querySelectorAll('button')].find(el => el.checkVisibility?.() && /legend|图例|圖例/i.test((el.getAttribute('aria-label') || '') + el.textContent)); if (!b) return false; b.click(); return true; })()`);
      if (legend) { await sleep(900); await scan('map:legend'); }
    }
    if (want('search')) {
      const type = q => ev(`(() => { const i = [...document.querySelectorAll('input')].find(el => el.checkVisibility?.() && /search|搜|find|找/i.test((el.placeholder || '') + (el.getAttribute('aria-label') || '') + el.type)); if (!i) return false; const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; i.focus(); set.call(i, ${JSON.stringify(q)}); i.dispatchEvent(new Event('input', { bubbles: true })); return true; })()`);
      const typed = await type('coit');
      await sleep(1200);
      if (typed) await scan('search'); else console.log(JSON.stringify({ screen: 'search', note: 'no search input found' }));
      // (W9-L) the games and the season's events the search finds (data/sf/searchSpots.ts), in the reader's language
      if (typed) for (const [name, q] of [['search:games', LANG === 'en' ? 'crab' : '螃蟹'], ['search:events', LANG === 'en' ? 'Halloween' : '萬聖'], ['search:empty', 'zzzz']]) { await type(q); await sleep(1200); await scan(name); }
    }
    await closeAll();
  }
  if (want('place')) { await page(`(await imp('game/flow.ts')).openPanel('poi', 'sf:coit-tower'); return 1`); await sleep(1800); await scan('place'); await closeAll(); }
  if (want('week')) {
    await page(`(await imp('game/flow.ts')).openPanel('week'); return 1`); await sleep(1800); await scan('week');
    for (let k = 0; k < 4; k++) { if (!(await tapSel('.ob-week .ob-chips button'))) break; await sleep(1200); }
    await sleep(2500);
    await scan('week-board'); await closeAll();
  }
  // event cards: --events a,b,c (default: three whose venue / title mix scripts in the catalog)
  if (want('event')) {
    for (const id of String(args.events || 'hardly-strictly-bluegrass-2026,ferry-plaza-farmers-market-2026-autumn,sf-downtown-first-thursday-oct-2026').split(',')) {
      await page(`(await imp('game/flow.ts')).openEvent(${JSON.stringify(id)}); return 1`); await sleep(1500); await scan(`event:${id}`); await closeAll();
    }
  }
  // 问 BAYBAY: the ask dialogue and its choices
  if (want('ask')) {
    const asked = await ev(`(() => { const b = [...document.querySelectorAll('button')].find(el => el.checkVisibility?.() && /^(ask|问|問)/i.test(((el.getAttribute('aria-label') || '') + ' ' + el.textContent).trim())); if (!b) return false; b.click(); return true; })()`);
    await sleep(1500);
    await scan(asked ? 'ask' : 'ask (no ask button)');
    await page(`ob.flow?.closeDialogue?.(); return 1`); await sleep(500);
  }

  // the journal: every top tab, and every page of a tab that has its own tablist (the Notebook's stamps / finds / views /
  // sounds / steps), each at its top and scrolled to its end
  if (want('journal')) {
    await page(`ob.game.set({ panel: { kind: 'journal', id: 'cards' } }); return 1`); await sleep(1500);
    const TOP = '.ob-journal .ob-tabs > [role=tab]';
    const tabs = (await ev(`[...document.querySelectorAll('${TOP}')].map((b, i) => i)`)) || [];
    const end = async name => { await ev(`(() => { for (const e of document.querySelectorAll('.ob-sheet-body, [role=tabpanel]')) e.scrollTop = 99999; return 1; })()`); await sleep(500); await scan(`${name}:end`, { shot: false }); };
    for (const i of tabs) {
      await ev(`document.querySelectorAll('${TOP}')[${i}]?.click()`); await sleep(1600);
      const name = await ev(`(document.querySelectorAll('${TOP}')[${i}]?.textContent || 'tab${i}').replace(/[0-9/]+/g, '').trim()`);
      await scan(`journal:${name}`);
      await end(`journal:${name}`);
      const sub = (await ev(`[...document.querySelectorAll('.ob-journal [role=tablist]:not(.ob-tabs) [role=tab]')].length`)) || 0;
      for (let j = 0; j < Math.min(sub, 10); j++) {
        const page2 = await ev(`(() => { const b = document.querySelectorAll('.ob-journal [role=tablist]:not(.ob-tabs) [role=tab]')[${j}]; if (!b) return null; b.click(); return (b.textContent || 'page${j}').replace(/[0-9/]+/g, '').trim().slice(0, 20); })()`);
        if (!page2) break;
        await sleep(1000); await scan(`journal:${name}:${page2}`, { shot: false }); await end(`journal:${name}:${page2}`);
      }
    }
    await closeAll();
  }
  if (want('shop')) { await page(`(await imp('economy/shopRun.ts')).openShop('more'); return 1`); await sleep(2000); await scan('shop'); await closeAll(); }
  if (want('album')) { await page(`(await imp('game/album.ts')).openAlbum(); return 1`); await sleep(1800); await scan('album'); await closeAll(); }
  if (want('settings')) {
    await page(`ob.game.set({ panel: { kind: 'settings' } }); return 1`); await sleep(1500); await scan('settings');
    await ev(`(() => { for (const e of document.querySelectorAll('.ob-sheet-body')) e.scrollTop = 99999; return 1; })()`); await sleep(500);
    await scan('settings:end', { shot: false }); await closeAll();
  }
  if (want('result')) { await page(`const k = await imp('play/kit.ts'); k.ensureResultOverlay(); k.showResult({ activity: 'slides', name: { zh: '滑梯', en: 'Slides' }, tier: 2, detail: { zh: '12.4 秒', en: '12.4 s' }, best: { zh: '最好 11.0 秒', en: 'Best 11.0 s' }, coins: 5 }); return 1`); await sleep(1500); await scan('result'); await closeAll(); }
  if (want('postcard')) { const r = await page(`if (!ob.g?.card) return 'no g'; ob.g.card('halloween-big-night'); return 1`); await sleep(1800); await scan(`postcard${r === 1 ? '' : ' (' + JSON.stringify(r) + ')'}`); await closeAll(); }
  if (want('ride')) {
    const r = await page(`const t = ob.transit; const d = t.data(); const lines = d.cable?.lines ?? d.lines ?? []; const l = lines.find(x => /hyde/i.test(x.id)) ?? lines[0]; if (!l) return 'no line'; t.ride(l.id, l.stops[0].station, l.stops[Math.min(3, l.stops.length - 1)].station); return l.id;`);
    await sleep(5000); await scan(`ride (${r})`); await page(`ob.transit.finish?.(); return 1`); await sleep(2000);
  }
  if (want('metro')) {
    // an underground Muni Metro ride (Embarcadero → Castro, all inside the Market St subway): the subway overlay
    await page(`ob.transit.rideLine('m-ocean-view', 'muni-embarcadero', 'muni-castro'); return 1`);
    const on = await waitFor(`document.querySelector('.ob-subway.is-on')`, 90000);
    await sleep(1500);
    await scan(`metro${on ? '' : ' (no subway overlay)'}`);
    await page(`ob.transit.finish?.(); return 1`); await sleep(2500);
  }
  // wave 8's new overlays: the busker jam (lane M) and the Alcatraz boat's ride card from Pier 33 (lane A; by day)
  if (want('busk')) {
    // stand on the Haight St busker's spot (lane M's ring; the jam stops at once away from it), 11:00–19:00 Bay time
    await page(`const m = await imp('play/sfgames8.ts'); (await imp('game/flow.ts')).teleportPlayer(m.buskAt(m.BUSK_HAIGHT)); return 1`); await sleep(5000);
    const ok = await page(`(await imp('game/flow.ts')).closeDialogue(); return (await imp('play/busk.ts')).startBusk('haight')`);
    if (ok === true) await waitFor(`document.querySelector('.ob-sfg-panel.is-busk')`, 20000); await sleep(1500); await scan(ok === true ? 'busk' : `busk (not started: ${JSON.stringify(ok)})`);
    await page(`(await imp('ui/slots.ts')).closeOverlay('play-busk'); return 1`); await sleep(1200);
  }
  if (want('ferry')) {
    await page(`(await imp('game/flow.ts')).teleportPlayer({ x: -94.0, z: -21.8 }); return 1`); await sleep(4000);
    await page(`(await imp('game/flow.ts')).closeDialogue(); (await imp('game/transit.ts')).rideFerry('pier-33', 'alcatraz-dock'); return 1`);
    await sleep(3000); await scan('ferry');
    await page(`ob.transit.finish?.(); return 1`); await sleep(2500);
  }
  if (want('arrival')) {
    // stand just outside Coit Tower's arrival spot, then step in (the arrival watcher wants an entry)
    const r = await page(`const { ATTRACTIONS } = await imp('data/sf/attractions.ts'); const a = ATTRACTIONS.find(x => x.id === 'coit-tower'); if (!a) return 'no coit'; const f = await imp('game/flow.ts'); const x = a.arrival?.x ?? a.x, z = a.arrival?.z ?? a.z; f.teleportPlayer({ x: x + 40, z }); await new Promise(r => setTimeout(r, 2500)); f.teleportPlayer({ x, z }); return 'coit'`);
    for (let i = 0; i < 40; i++) { if (await ev(`!!document.querySelector('.ob-arrival, .ob-arrive, [class*=arrival]')`)) break; await sleep(1000); }
    await scan(`arrival (${String(r).slice(0, 40)})`);
  }
  if (want('canvas')) {
    const painted = (await ev(`[...(window.__langCanvas || new Map()).entries()].map(([text, where]) => ({ kind: 'canvas', text, where }))`)) || [];
    const leaks = sortOut(painted);
    for (const l of leaks) allWrong.set(`canvas|${l.text}`, { ...l, screens: ['canvas'] });
    report.screens.push({ screen: 'canvas', leaks: leaks.length, painted: painted.length });
    console.log(JSON.stringify({ screen: 'canvas', painted: painted.length, leaks }));
  }
} catch (error) {
  console.log(JSON.stringify({ error: String(error?.stack || error) }));
} finally {
  report.errors = errors.slice(0, 20);
  report.leaks = [...allWrong.values()];
  report.allowed = [...allAllowed.values()];
  const file = path.join(OUT, `lang-${LANG}-${W}x${H}.json`);
  fs.writeFileSync(file, JSON.stringify(report, null, 1));
  console.log(JSON.stringify({ done: file, screens: report.screens.length, distinctLeaks: report.leaks.length, allowed: report.allowed.length, pageErrors: errors.length }));
  try { ws.close(); } catch { /* closed */ }
  chrome.kill(); await sleep(400);
  try { fs.rmSync(profile, { recursive: true, force: true }); } catch { /* locked */ }
  process.exit(0);
}
