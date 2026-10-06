import { readdir } from 'node:fs/promises';
import { spawn } from 'node:child_process';
const lane=process.argv[2]||'all';
if(!['site','opus','all'].includes(lane)) throw new Error('Unknown test lane');
const files=(await readdir('tests')).filter(file=>/\.test\.(ts|tsx|mjs)$/.test(file)).filter(file=>lane==='all'||(lane==='opus' ? /^(opus-|little-bay)/.test(file) : !/^(opus-|little-bay)/.test(file))).sort().map(file=>`tests/${file}`);
if (!files.length) throw new Error('No tests were found for the required release lane');
const child=spawn(process.execPath,['node_modules/tsx/dist/cli.mjs','--tsconfig','tsconfig.app.json','--test','--test-concurrency=1',...files],{stdio:'inherit'});
child.on('error', error => { console.error(error.message); process.exitCode = 1; });
child.on('exit', (code, signal) => { process.exitCode = signal ? 1 : (code ?? 1); });
