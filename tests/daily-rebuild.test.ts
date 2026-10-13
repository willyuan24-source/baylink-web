import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { dailyRebuild } from '../api/daily-rebuild';
import { DAILY_REBUILD_CRON } from '../scripts/sync-public-routes';

const HOOK = 'https://api.vercel.com/v1/integrations/deploy/prj_AbC123/xYz-789';
const SECRET = 'a-long-random-cron-secret';
const cron = (headers: Record<string, string> = { authorization: `Bearer ${SECRET}` }, method = 'GET') => new Request('https://www.baylink.us/api/daily-rebuild', { method, headers });
const recorder = (status = 201) => {
  const calls: { url: string; init?: RequestInit }[] = [];
  const send = (async (url: string | URL | Request, init?: RequestInit) => { calls.push({ url: String(url), init }); return new Response('{}', { status }); }) as typeof fetch;
  return { calls, send };
};

test('the daily rebuild stays inert until the owner sets both the deploy hook and the cron secret', async () => {
  for (const env of [{}, { VERCEL_DEPLOY_HOOK_URL: HOOK }, { CRON_SECRET: SECRET }, { VERCEL_DEPLOY_HOOK_URL: '  ', CRON_SECRET: SECRET }]) {
    const { calls, send } = recorder();
    const response = await dailyRebuild(cron(), env, send);
    assert.equal(response.status, 200, JSON.stringify(env));
    assert.deepEqual(await response.json(), { triggered: false, reason: 'not-configured' });
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.equal(calls.length, 0, 'nothing is requested');
  }
});

test('a configured cron call POSTs the deploy hook once; anyone else is refused', async () => {
  const env = { VERCEL_DEPLOY_HOOK_URL: HOOK, CRON_SECRET: SECRET };
  let { calls, send } = recorder();
  let response = await dailyRebuild(cron(), env, send);
  assert.equal(response.status, 202);
  assert.deepEqual(await response.json(), { triggered: true });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, HOOK);
  assert.equal(calls[0].init?.method, 'POST');
  assert.equal(calls[0].init?.redirect, 'error');
  for (const headers of [{}, { authorization: 'Bearer wrong' }, { authorization: SECRET }, { authorization: `Bearer ${SECRET}x` }]) {
    ({ calls, send } = recorder());
    response = await dailyRebuild(cron(headers), env, send);
    assert.equal(response.status, 401, JSON.stringify(headers));
    assert.equal(calls.length, 0);
  }
  ({ calls, send } = recorder());
  response = await dailyRebuild(cron(undefined, 'POST'), env, send);
  assert.equal(response.status, 405);
  assert.equal(response.headers.get('allow'), 'GET');
  assert.equal(calls.length, 0);
});

test('only a Vercel deploy-hook URL is ever called, and hook failures are reported, not thrown', async () => {
  for (const url of ['https://example.com/v1/integrations/deploy/prj_1/abc', 'http://api.vercel.com/v1/integrations/deploy/prj_1/abc', 'https://api.vercel.com.evil.test/v1/integrations/deploy/prj_1/abc', 'https://api.vercel.com/v1/integrations/deploy/prj_1/abc?next=https://x']) {
    const { calls, send } = recorder();
    const response = await dailyRebuild(cron(), { VERCEL_DEPLOY_HOOK_URL: url, CRON_SECRET: SECRET }, send);
    assert.equal(response.status, 500, url);
    assert.deepEqual(await response.json(), { triggered: false, reason: 'invalid-hook-url' });
    assert.equal(calls.length, 0, url);
  }
  const env = { VERCEL_DEPLOY_HOOK_URL: HOOK, CRON_SECRET: SECRET };
  let response = await dailyRebuild(cron(), env, recorder(500).send);
  assert.equal(response.status, 502);
  assert.deepEqual(await response.json(), { triggered: false, reason: 'hook-status-500' });
  response = await dailyRebuild(cron(), env, (async () => { throw new TypeError('network'); }) as typeof fetch);
  assert.equal(response.status, 502);
  assert.deepEqual(await response.json(), { triggered: false, reason: 'hook-unreachable' });
});

test('vercel.json schedules the rebuild once a day after Pacific midnight in both PST and PDT', () => {
  const config = JSON.parse(readFileSync('vercel.json', 'utf8')) as { crons?: { path: string; schedule: string }[]; functions?: Record<string, unknown> };
  assert.deepEqual(config.crons?.filter(cron => cron.path === '/api/daily-rebuild'), [DAILY_REBUILD_CRON]);
  const [minute, hour, ...rest] = DAILY_REBUILD_CRON.schedule.split(' ');
  assert.deepEqual(rest, ['*', '*', '*'], 'daily');
  // Vercel cron is UTC: PST is UTC-8, PDT UTC-7. The Pacific time must be on the new day in both.
  for (const offset of [8, 7]) {
    const pacificHour = (Number(hour) - offset + 24) % 24;
    assert.ok(pacificHour < 3 && Number(hour) - offset >= 0, `${hour}:${minute} UTC is ${pacificHour}:${minute} at UTC-${offset}`);
  }
});

test('the function compiles strictly for native Node ESM (as Vercel runs api/*.ts)', async () => {
  const ts = (await import('typescript')).default;
  const program = ts.createProgram(['api/daily-rebuild.ts'], {
    target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.NodeNext, moduleResolution: ts.ModuleResolutionKind.NodeNext,
    strict: true, skipLibCheck: true, noEmit: true, types: ['node'],
  });
  assert.deepEqual(ts.getPreEmitDiagnostics(program).map(item => ts.flattenDiagnosticMessageText(item.messageText, '\n')), []);
});
