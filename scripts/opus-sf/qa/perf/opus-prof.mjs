// CPU profile of the running page: node opus-prof.mjs --url <u> [--go "<expr>"] [--ms 8000] [--walk] [--throttle 4] [--out prof.json]
// Prints the top self-time functions and files (ms and %) and saves the raw .cpuprofile.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const args = Object.fromEntries(process.argv.slice(2).reduce((acc, cur, i, arr) => {
  if (cur.startsWith('--')) acc.push([cur.slice(2), arr[i + 1] && !arr[i + 1].startsWith('--') ? arr[i + 1] : true]);
  return acc;
}, []));
const W = Number(args.w || 1440), H = Number(args.h || 900);
// The debugging port: Chrome picks a free one (--remote-debugging-port=0) and writes it to <profile>/DevToolsActivePort,
// as scripts/opus-shot.mjs does (a random fixed port collided between lanes: the second Chrome failed to bind and the
// script profiled another lane's page; lead-merge sf-w4-lead.md §8.4).
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'opus-prof-'));
const chromePath = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const chrome = spawn(chromePath, ['--force_high_performance_gpu', '--headless=new', '--remote-debugging-port=0', `--user-data-dir=${profile}`, '--no-first-run', '--enable-gpu', '--ignore-gpu-blocklist', `--window-size=${W},${H}`, 'about:blank'], { stdio: 'ignore' });
const sleep = ms => new Promise(r => setTimeout(r, ms));
try {
  let port = 0;
  const portFile = path.join(profile, 'DevToolsActivePort');
  for (let i = 0; i < 100 && !port; i++) { try { port = Number(fs.readFileSync(portFile, 'utf8').split('\n')[0]) || 0; } catch { /* not written yet */ } if (!port) await sleep(100); }
  if (!port) throw new Error(`Chrome wrote no ${portFile} (did it start?)`);
  let targets;
  for (let i = 0; i < 50; i++) { try { targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); if (targets.find(t => t.type === 'page')) break; } catch { /* retry */ } await sleep(200); }
  const page = targets?.find(t => t.type === 'page');
  if (!page) throw new Error(`no page target on the debugging port ${port}`);
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise(r => ws.addEventListener('open', r, { once: true }));
  let id = 0; const pending = new Map();
  ws.addEventListener('message', ev => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.reject(new Error(JSON.stringify(m.error))) : p.resolve(m.result); } });
  const send = (method, params = {}) => new Promise((resolve, reject) => { const mid = ++id; pending.set(mid, { resolve, reject }); ws.send(JSON.stringify({ id: mid, method, params })); });
  const ev = async expr => (await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true })).result?.value;
  await send('Runtime.enable'); await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: args.url });
  await sleep(30000);
  await ev(fs.readFileSync(new URL('./perf-helpers.js', import.meta.url), 'utf8'));
  if (args.go) { console.log('go', await ev(args.go)); await sleep(20000); }
  if (args.throttle) await send('Emulation.setCPUThrottlingRate', { rate: Number(args.throttle) });
  await sleep(2000);
  if (args.warm) { await ev(`window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW', key: 'w' }))`); await sleep(3000); await ev(`window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyW', key: 'w' }))`); await sleep(2000); }
  await send('Profiler.enable'); await send('Profiler.setSamplingInterval', { interval: 200 });
  await send('Profiler.start');
  if (args.walk) await ev(`window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW', key: 'w' }))`);
  await sleep(Number(args.ms || 8000));
  const { profile: prof } = await send('Profiler.stop');
  if (args.walk) await ev(`window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyW', key: 'w' }))`);
  fs.writeFileSync(args.out || 'prof.cpuprofile', JSON.stringify(prof));
  // self time per node from samples
  const dt = new Map(); const byId = new Map(prof.nodes.map(n => [n.id, n]));
  for (let i = 0; i < prof.samples.length; i++) dt.set(prof.samples[i], (dt.get(prof.samples[i]) || 0) + (prof.timeDeltas[i] || 0) / 1000);
  const total = [...dt.values()].reduce((a, b) => a + b, 0);
  const fn = new Map(), file = new Map();
  for (const [nid, ms] of dt) {
    const cf = byId.get(nid).callFrame; const f = (cf.url || '').replace(/^.*\/(src|node_modules)\//, '$1/').replace(/\?.*$/, '');
    const k = `${cf.functionName || '(anon)'}  ${f}:${cf.lineNumber + 1}`;
    fn.set(k, (fn.get(k) || 0) + ms); file.set(f || cf.functionName, (file.get(f || cf.functionName) || 0) + ms);
  }
  const top = (m, n) => [...m].sort((a, b) => b[1] - a[1]).slice(0, n).map(([k, v]) => `${v.toFixed(0).padStart(6)} ms ${(100 * v / total).toFixed(1).padStart(5)}%  ${k}`).join('\n');
  console.log(`total sampled ${total.toFixed(0)} ms over ${args.ms || 8000} ms`);
  console.log('--- top files\n' + top(file, 25));
  console.log('--- top functions\n' + top(fn, 40));
  ws.close();
} catch (e) { console.log('error', String(e)); }
finally { chrome.kill(); await sleep(300); try { fs.rmSync(profile, { recursive: true, force: true }); } catch { /* locked */ } process.exit(0); }
