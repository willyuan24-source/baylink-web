import assert from 'node:assert/strict';
import test, { after } from 'node:test';
import { registerHooks } from 'node:module';

// WEB-HOMEPREP review: offline, an English page that searches fails its language load (the English scopes do not load)
// and the search dictionaries do not load either. The gate reports the English failure; the dictionaries' failure is
// handled (exact-character search), never an unhandled rejection that product-observer would report as an error. This
// file runs in its own process and takes the browser's path (the dictionaries are a chunk of their own).
process.env.BAYLINK_LAZY_SEARCH = '1';
const blocked = /(?:\/search-dictionaries|\/english-scope-loaders)$/u;
const hooks = registerHooks({
  resolve(specifier, context, next) {
    if (blocked.test(specifier) && context.parentURL?.includes('/i18n/locale')) throw new Error(`offline: ${specifier}`);
    return next(specifier, context);
  },
});
const { isLocaleReadyForPath, isSearchConversionReady, loadLocaleForFeature, loadLocaleForPath } = await import('../src/i18n/locale');
const unhandled: unknown[] = [];
const onUnhandled = (reason: unknown) => { unhandled.push(reason); };
process.on('unhandledRejection', onUnhandled);
after(() => { process.off('unhandledRejection', onUnhandled); hooks.deregister(); });
const drain = () => new Promise(resolve => setTimeout(resolve, 50));

test('offline, an English searching page reports its own load failure and leaves no unhandled rejection behind', async () => {
  await assert.rejects(loadLocaleForPath('en', '/guides'), /offline: .*english-scope-loaders/u);
  await drain();
  assert.deepEqual(unhandled, []);
  assert.equal(isSearchConversionReady(), false);
  assert.equal(isLocaleReadyForPath('zh-Hans', '/guides'), true, 'after the failed load the 简体 gate stops waiting (exact search)');
});

test('offline, opening search in English does the same', async () => {
  await assert.rejects(loadLocaleForFeature('en', 'search'), /offline: .*english-scope-loaders/u);
  await drain();
  assert.deepEqual(unhandled, []);
});

test('offline in 简体 the gate resolves: the page works with exact-character search', async () => {
  await loadLocaleForPath('zh-Hans', '/guides');
  await loadLocaleForFeature('zh-Hans', 'search');
  await drain();
  assert.deepEqual(unhandled, []);
});
