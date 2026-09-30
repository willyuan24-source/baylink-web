import assert from 'node:assert/strict';
import test from 'node:test';

/**
 * W7-P3 · game/importRetry.ts: a lazy chunk whose request was lost is fetched again (Chrome keeps a failed dynamic import
 * failed for the page's life: W6-P-review measured it on the production build; a URL with a query string loads).
 */

const CHROME = (url: string) => new TypeError(`Failed to fetch dynamically imported module: ${url}`);
const FIREFOX = (url: string) => new TypeError(`error loading dynamically imported module: ${url}`);
const SAFARI = () => new TypeError('Importing a module script failed.');

test('W7-P3: the browsers\' load-failure messages are told from errors a module\'s own code throws; the URL is read where the browser names it', async () => {
  const { failedModuleUrl, isLoadFailure, bustUrl } = await import('../src/opus-bay/game/importRetry');
  const url = 'https://www.baylink.us/assets/driveRoute-DxJ3a_9Q.js';
  assert.equal(isLoadFailure(CHROME(url)), true);
  assert.equal(isLoadFailure(FIREFOX(url)), true);
  assert.equal(isLoadFailure(SAFARI()), true);
  assert.equal(isLoadFailure(new TypeError("Cannot read properties of undefined (reading 'x')")), false);
  assert.equal(isLoadFailure(new Error('catalog 500')), false);
  assert.equal(failedModuleUrl(CHROME(url)), url);
  assert.equal(failedModuleUrl(FIREFOX(url)), url);
  assert.equal(failedModuleUrl(CHROME(`${url}?retry=1`)), url, 'a busted URL is read without its query');
  assert.equal(failedModuleUrl(CHROME('http://localhost:5704/src/opus-bay/actors/vehicles/driveRoute.ts?t=123')), 'http://localhost:5704/src/opus-bay/actors/vehicles/driveRoute.ts');
  assert.equal(failedModuleUrl(SAFARI()), null);
  assert.equal(bustUrl(url, 2), `${url}?retry=2`);
  assert.equal(bustUrl(`${url}?v=1`, 1), `${url}?v=1&retry=1`);
});

test('W7-P3: importRetry — a lost chunk is fetched again under a new URL after a wait (before W7-P3 loadDrive asked the same import again, which Chrome rejects for the rest of the page)', async () => {
  const { importRetry, RETRY_MS } = await import('../src/opus-bay/game/importRetry');
  const url = 'https://www.baylink.us/assets/driveRoute-DxJ3a_9Q.js';
  const waits: number[] = [], urls: string[] = [];
  let calls = 0;
  const load = () => { calls++; return Promise.reject(CHROME(url)); };
  const mod = { driveRoute: 'the module' };
  // the request is lost once; the file is there again by the first retry
  const got = await importRetry(load, { sleep: async ms => { waits.push(ms); }, importUrl: async u => { urls.push(u); return mod; } });
  assert.equal(got, mod);
  assert.equal(calls, 1, 'the same import is not asked again (Chrome would reject it at once)');
  assert.deepEqual(urls, [`${url}?retry=1`]);
  assert.deepEqual(waits, [RETRY_MS[0]]);
  // lost for good: every retry, then the last error (the caller's own fallback applies, as before)
  const waits2: number[] = [];
  await assert.rejects(importRetry(load, { sleep: async ms => { waits2.push(ms); }, importUrl: async u => { throw CHROME(u); } }), /Failed to fetch dynamically imported module/);
  assert.deepEqual(waits2, [...RETRY_MS]);
  // the old behaviour (a plain retry of the same import) never lands in Chrome: the helper is what makes it load
  let plain = 0;
  const same = () => { plain++; return Promise.reject(CHROME(url)); };
  await assert.rejects((async () => { try { return await same(); } catch { return await same(); } })());
  assert.equal(plain, 2);
});

test('W7-P3: importRetry — Safari (no URL in the message) asks the same import again; an error the module\'s code threw is never retried', async () => {
  const { importRetry } = await import('../src/opus-bay/game/importRetry');
  let n = 0;
  const flaky = () => (++n === 1 ? Promise.reject(SAFARI()) : Promise.resolve({ ok: n }));
  assert.deepEqual(await importRetry(flaky, { sleep: async () => {}, importUrl: async () => { throw new Error('not used'); } }), { ok: 2 });
  let m = 0;
  const broken = () => { m++; return Promise.reject(new TypeError("Cannot read properties of undefined (reading 'x')")); };
  await assert.rejects(importRetry(broken, { sleep: async () => { throw new Error('no wait'); } }), /Cannot read properties/);
  assert.equal(m, 1, 'evaluated once: nothing runs twice');
  // success at once: no wait
  let slept = 0;
  assert.equal(await importRetry(() => Promise.resolve(7), { sleep: async () => { slept++; } }), 7);
  assert.equal(slept, 0);
});

test('W7-P3: the play layer retries quickly, then (as before) reloads the page once at the title', async () => {
  const { PLAY_PARTS_RETRY_MS } = await import('../src/opus-bay/ui/playLayer');
  assert.deepEqual([...PLAY_PARTS_RETRY_MS], [500, 2000]);
  assert.ok(PLAY_PARTS_RETRY_MS.reduce((a, b) => a + b, 0) < 3000, 'Start waits at most ≈ 2.5 s more before the reload');
});
