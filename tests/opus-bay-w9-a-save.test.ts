import assert from 'node:assert/strict';
import test from 'node:test';

/**
 * Wave 9 · lane A (5): storage refused → one notice (review R§6 技术: "存档只在 localStorage：存储被拦截时静默丢档",
 * gapfill/robust-nostorage: `saveBefore: THROWS: The operation is insecure`, no message on screen). data/save.ts
 * onWriteFailure is the one hook (the play layer's notice 这次的进度无法保存（浏览器禁止了存储） listens); its own file: the
 * hook's state is per visit (module scope), so the steps run in order in one test.
 */

let blocked = true;
let search = '?save=off';
const win = {
  location: { get search() { return search; } },
  addEventListener: () => {},
  get localStorage(): Storage { if (blocked) throw new Error('SecurityError: The operation is insecure.'); return undefined as unknown as Storage; },
};
(globalThis as unknown as Record<string, unknown>).window = win;

const save = await import('../src/opus-bay/data/save');
const wish = await import('../src/opus-bay/data/wishlist');

test('W9-A5: a refused write is told once a visit — ?save=off never; the progress / wishlist writes and the save v2 writes both report it; a listener added later hears it at once (red before: memory-only in silence)', () => {
  let heard = 0;
  const off = save.onWriteFailure(() => { heard++; });
  // ?save=off (QA): no notice, even with the storage blocked
  save.patchSave(s => { s.unlocked = { glide: true }; });
  assert.equal(heard, 0, '?save=off: no notice');
  search = '';
  // the save v2 write with the storage getter throwing (Chrome with site data blocked)
  save.patchSave(s => { s.unlocked = { glide: false }; });
  assert.equal(heard, 1, 'the first refused write');
  save.flushSave();
  // the progress v1 write (data/wishlist.ts) into a full storage: already told
  wish.setStorageForTests({ getItem: () => null, setItem: () => { throw new Error('QuotaExceededError'); }, removeItem: () => {} });
  wish.writeProgress({ postcards: [] } as unknown as Parameters<typeof wish.writeProgress>[0]);
  wish.setStorageForTests(undefined);
  assert.equal(heard, 1, 'once a visit');
  let late = 0;
  save.onWriteFailure(() => { late++; });
  assert.equal(late, 1, 'a listener added after the failure hears it at once');
  off();
  assert.equal(save.readSave()?.unlocked?.glide, false, 'the game keeps playing from memory');
});

test('W9-A5: a page whose storage getter throws is "blocked"; a stub window without storage (node tests) is not', async () => {
  blocked = true;
  assert.equal(save.storageBlocked(), true);
  blocked = false;
  assert.equal(save.storageBlocked(), false, 'undefined storage = no storage here, not a refusal');
  // data/wishlist.ts reports through the same hook (a blocked getter, a throwing setItem)
  const { readFileSync } = await import('node:fs');
  const w = readFileSync(new URL('../src/opus-bay/data/wishlist.ts', import.meta.url), 'utf8');
  assert.ok(w.includes('if (!s) { if (storageOverride === undefined && storageBlocked()) noteWriteFailure(); return; }'), 'a blocked getter');
  assert.ok(w.includes('catch { noteWriteFailure();'), 'a throwing setItem');
});
