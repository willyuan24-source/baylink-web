// Headless visual QA for /opus-bay. Launches its own Chrome (unique port + profile), runs actions, screenshots.
// Usage:
//   node scripts/opus-shot.mjs --out shot.png [--url http://localhost:5174/opus-bay?start=free] [--w 1440 --h 900]
//        [--mobile] [--dpr 3] [--wait 6000] [--actions '[{"do":"key","key":"KeyW","ms":1500},{"do":"shot","name":"b.png"}]']
// Actions: {do:'wait',ms} {do:'key',key:'KeyW'|'ShiftLeft'|'Space'|'KeyE'|'Enter'|'Escape'|'Digit1',ms} {do:'keys',keys:[..],ms}
//          {do:'click',x,y} {do:'drag',from:[x,y],to:[x,y]} {do:'wheel',x,y,dy} {do:'eval',expr} {do:'shot',name}  (a name ending in .jpg saves a JPEG at q82)
//          {do:'fps',ms} {do:'throttle',rate}
// Prints console errors/warnings and eval results as JSON lines. Exits non-zero if the page crashed.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const args = Object.fromEntries(process.argv.slice(2).reduce((acc, cur, i, arr) => {
  if (cur.startsWith('--')) acc.push([cur.slice(2), arr[i + 1] && !arr[i + 1].startsWith('--') ? arr[i + 1] : true]);
  return acc;
}, []));
const url = args.url || 'http://localhost:5174/opus-bay?start=free';
const W = Number(args.w || (args.mobile ? 390 : 1440)), H = Number(args.h || (args.mobile ? 844 : 900));
const out = args.out || 'opus-shot.png';
const outDir = path.dirname(path.resolve(out));
const actions = args.actions ? JSON.parse(args.actions) : [];
const port = 9400 + Math.floor(Math.random() * 500);
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'opus-shot-'));
const chromePath = process.env.CHROME || (fs.existsSync('/opt/pw-browsers/chromium-1194/chrome-linux/chrome') ? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' : 'C:/Program Files/Google/Chrome/Application/chrome.exe');
// Linux containers run as root without a GPU: Chrome needs --no-sandbox there, and WebGL falls back to SwiftShader.
const extraFlags = [...(process.getuid?.() === 0 ? ['--no-sandbox'] : []), ...(process.env.CHROME_FLAGS ? process.env.CHROME_FLAGS.split(' ') : [])];
const chrome = spawn(chromePath, [...extraFlags, '--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, '--no-first-run', '--no-default-browser-check', '--enable-gpu', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required', `--window-size=${W},${H}`, 'about:blank'], { stdio: 'ignore' });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const log = obj => console.log(JSON.stringify(obj));
let exitCode = 0;
try {
  let targets;
  for (let i = 0; i < 50; i++) { try { targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); if (targets.find(t => t.type === 'page')) break; } catch { /* retry */ } await sleep(200); }
  const page = targets.find(t => t.type === 'page');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise(r => ws.addEventListener('open', r, { once: true }));
  let id = 0; const pending = new Map();
  ws.addEventListener('message', ev => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) { const p = pending.get(msg.id); pending.delete(msg.id); msg.error ? p.reject(new Error(JSON.stringify(msg.error))) : p.resolve(msg.result); }
    else if (msg.method === 'Runtime.consoleAPICalled' && ['error', 'warning'].includes(msg.params.type)) log({ console: msg.params.type, text: msg.params.args.map(a => a.value ?? a.description ?? '').join(' ').slice(0, 400) });
    else if (msg.method === 'Runtime.exceptionThrown') { exitCode = 2; log({ exception: (msg.params.exceptionDetails.exception?.description || msg.params.exceptionDetails.text || '').slice(0, 600) }); }
  });
  const send = (method, params = {}) => new Promise((resolve, reject) => { const mid = ++id; pending.set(mid, { resolve, reject }); ws.send(JSON.stringify({ id: mid, method, params })); });
  await send('Runtime.enable'); await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: Number(args.dpr || 1), mobile: !!args.mobile });
  if (args.mobile) await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
  await send('Page.navigate', { url });
  await sleep(Number(args.wait || 6000));
  const shot = async name => { const r = await send('Page.captureScreenshot', /\.jpe?g$/i.test(name) ? { format: 'jpeg', quality: 82 } : { format: 'png' }); const file = path.isAbsolute(name) ? name : path.join(outDir, name); fs.writeFileSync(file, Buffer.from(r.data, 'base64')); log({ shot: file }); };
  const key = async (type, code) => {
    const keyName = code.startsWith('Key') ? code.slice(3).toLowerCase() : code.startsWith('Digit') ? code.slice(5) : ({ Space: ' ', ShiftLeft: 'Shift', Enter: 'Enter', Escape: 'Escape', ArrowUp: 'ArrowUp', ArrowDown: 'ArrowDown', ArrowLeft: 'ArrowLeft', ArrowRight: 'ArrowRight', Tab: 'Tab' })[code] || code;
    await send('Input.dispatchKeyEvent', { type, code, key: keyName, text: type === 'keyDown' && keyName.length === 1 ? keyName : undefined });
  };
  const mouse = (type, x, y, extra = {}) => send('Input.dispatchMouseEvent', { type, x, y, button: 'left', clickCount: 1, ...extra });
  for (const a of actions) {
    if (a.do === 'wait') await sleep(a.ms);
    else if (a.do === 'key' || a.do === 'keys') { const ks = a.keys || [a.key]; for (const k of ks) await key('keyDown', k); await sleep(a.ms || 80); for (const k of [...ks].reverse()) await key('keyUp', k); }
    else if (a.do === 'click') { await mouse('mouseMoved', a.x, a.y, { button: 'none' }); await mouse('mousePressed', a.x, a.y); await sleep(50); await mouse('mouseReleased', a.x, a.y); }
    else if (a.do === 'drag') { const [x0, y0] = a.from, [x1, y1] = a.to; await mouse('mousePressed', x0, y0, { button: a.button || 'left', buttons: 1 }); for (let i = 1; i <= 20; i++) { await mouse('mouseMoved', x0 + (x1 - x0) * i / 20, y0 + (y1 - y0) * i / 20, { button: a.button || 'left', buttons: 1 }); await sleep(16); } await mouse('mouseReleased', x1, y1, { button: a.button || 'left' }); }
    else if (a.do === 'wheel') await send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: a.x, y: a.y, deltaX: 0, deltaY: a.dy });
    else if (a.do === 'eval') { const r = await send('Runtime.evaluate', { expression: a.expr, awaitPromise: true, returnByValue: true }); log({ eval: a.label || a.expr.slice(0, 60), value: r.result?.value ?? r.exceptionDetails?.text }); }
    else if (a.do === 'throttle') await send('Emulation.setCPUThrottlingRate', { rate: a.rate });
    else if (a.do === 'fps') { const r = await send('Runtime.evaluate', { expression: `new Promise(r=>{let f=0;const t=performance.now();(function l(){f++;if(performance.now()-t<${a.ms || 3000})requestAnimationFrame(l);else r(Math.round(f*1000/(performance.now()-t)))})()})`, awaitPromise: true, returnByValue: true }); log({ fps: r.result.value }); }
    else if (a.do === 'shot') await shot(a.name);
  }
  if (!actions.some(a => a.do === 'shot')) await shot(path.basename(out));
  ws.close();
} catch (error) { exitCode = 1; log({ error: String(error) }); }
finally { chrome.kill(); await sleep(300); try { fs.rmSync(profile, { recursive: true, force: true }); } catch { /* locked */ } process.exit(exitCode); }
