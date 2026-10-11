import { spawn } from 'node:child_process';
import { testLanes } from './test-lanes.mjs';
const lane=process.argv[2]||'all';
if(!['site','opus','all'].includes(lane)) throw new Error('Unknown test lane');
const files=(await testLanes())[lane];
if (!files.length) throw new Error('No tests were found for the required release lane');
// Components import their own stylesheets (plan D6); the preloaded hook lets tests import them (tests/support/css-stub.mjs).
const child=spawn(process.execPath,['node_modules/tsx/dist/cli.mjs','--tsconfig','tsconfig.app.json','--import','./tests/support/css-stub.mjs','--test','--test-concurrency=1',...files],{stdio:'inherit'});
child.on('error', error => { console.error(error.message); process.exitCode = 1; });
child.on('exit', (code, signal) => { process.exitCode = signal ? 1 : (code ?? 1); });
