/**
 * W7-Q4 · the album on phones: 保存 shares the file only; in-app browsers (WeChat …) get the long-press photo instead of
 * a download that never happens (and no false 已保存); the IndexedDB connection reopens after an iOS background kill;
 * a 3 s open timeout; navigator.storage.persist() once.
 */
import assert from 'node:assert/strict';
import test from 'node:test';

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Mobile/15E148 Safari/604.1';
const WECHAT = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 MicroMessenger/8.0.49(0x18003137) NetType/WIFI Language/zh_CN';
const WIN_CHROME = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36';

const jpeg = () => new File([new Uint8Array([0xff, 0xd8, 0xff, 1, 2, 3])], 'p.jpg', { type: 'image/jpeg' });
const sharer = (accept: (d: ShareData) => boolean) => ({ share: async () => {}, canShare: accept });

test('W7-Q4 saveRoute: the share sheet where files can be shared; WeChat / iOS without it: the long-press photo; desktop 保存: a download', async () => {
  const { saveRoute, inAppBrowser } = await import('../src/opus-bay/ui/shareFile');
  const f = jpeg();
  const files = (d: ShareData) => !!d.files?.length;
  // iPhone Safari 15+: both buttons open the sheet (存储图像 is in it)
  assert.equal(saveRoute({ userAgent: IPHONE, ...sharer(files) }, f, true, true), 'share');
  assert.equal(saveRoute({ userAgent: IPHONE, ...sharer(files) }, f, false, true), 'share');
  // WeChat's WKWebView: no navigator.share with files — was a dead <a download> + 照片已保存
  assert.equal(saveRoute({ userAgent: WECHAT }, f, true, true), 'longpress');
  assert.equal(saveRoute({ userAgent: WECHAT }, f, false, true), 'longpress');
  // an iOS without file sharing takes the same path
  assert.equal(saveRoute({ userAgent: IPHONE }, f, true, true), 'longpress');
  // desktop Chrome: 保存 downloads, 分享 uses the sheet where it exists, else downloads
  assert.equal(saveRoute({ userAgent: WIN_CHROME, ...sharer(files) }, f, true, false), 'download');
  assert.equal(saveRoute({ userAgent: WIN_CHROME, ...sharer(files) }, f, false, false), 'share');
  assert.equal(saveRoute({ userAgent: WIN_CHROME }, f, false, false), 'download');
  for (const ua of ['FBAN/FBIOS', 'Instagram 300.0', 'Line/13.1.0', 'Weibo (iPhone)', 'QQ/8.9']) assert.ok(inAppBrowser(`Mozilla/5.0 ${ua}`), ua);
  assert.ok(!inAppBrowser(IPHONE) && !inAppBrowser(WIN_CHROME));
});

test('W7-Q4 sharePayload: 保存 = the file alone (no text: iOS keeps 存储图像); 分享 adds the words only where accepted', async () => {
  const { sharePayload } = await import('../src/opus-bay/ui/shareFile');
  const f = jpeg();
  const any = sharer(() => true);
  // (W9-S2: the words are the caller's — the game's visible title, never "Opus Bay")
  const words = { title: '湾区小旅', text: 'hi' };
  assert.deepEqual(sharePayload(any, f, words, true), { files: [f] });
  assert.deepEqual(sharePayload(any, f, words, false), { files: [f], title: '湾区小旅', text: 'hi' });
  const filesOnly = sharer(d => !d.text && !d.title);
  assert.deepEqual(sharePayload(filesOnly, f, words, false), { files: [f] });
});

// --- a fake IndexedDB ----------------------------------------------------------------------------------------------

function fakeIdb() {
  const data: Record<string, Map<string, { id: string }>> = { meta: new Map(), full: new Map() };
  const state = { opens: 0, failTx: 0, neverOpen: false };
  const request = <T>(fn: () => T) => {
    const r: { onsuccess: null | (() => void); onerror: null | (() => void); result?: T; error?: unknown } = { onsuccess: null, onerror: null };
    setTimeout(() => { try { r.result = fn(); r.onsuccess?.(); } catch (e) { r.error = e; r.onerror?.(); } }, 0);
    return r;
  };
  const makeDb = () => {
    let closed = false;
    return {
      objectStoreNames: { contains: () => true },
      createObjectStore() {},
      close() { closed = true; },
      onclose: null, onversionchange: null,
      transaction() {
        if (closed) throw Object.assign(new Error('The database connection is closing.'), { name: 'InvalidStateError' });
        if (state.failTx > 0) { state.failTx--; throw Object.assign(new Error('Connection to Indexed Database server lost. Refresh the page to try again'), { name: 'UnknownError' }); }
        const tx: Record<string, unknown> = { oncomplete: null, onerror: null, onabort: null };
        tx.objectStore = (n: string) => {
          const m = data[n];
          return {
            getAll: () => request(() => [...m.values()]),
            get: (id: string) => request(() => m.get(id)),
            put: (v: { id: string }) => { m.set(v.id, v); return request(() => v.id); },
            delete: (id: string) => { m.delete(id); return request(() => undefined); },
          };
        };
        setTimeout(() => (tx.oncomplete as (() => void) | null)?.(), 1);
        return tx;
      },
    };
  };
  const idb = {
    open() {
      state.opens++;
      const r: Record<string, unknown> = { result: null, onsuccess: null, onerror: null, onupgradeneeded: null, onblocked: null };
      if (!state.neverOpen) setTimeout(() => { r.result = makeDb(); (r.onupgradeneeded as (() => void) | null)?.(); (r.onsuccess as (() => void) | null)?.(); }, 0);
      return r;
    },
  };
  return { idb, data, state };
}

async function withIdb(fake: ReturnType<typeof fakeIdb>, fn: () => Promise<void>, nav?: unknown) {
  const g = globalThis as unknown as Record<string, unknown>;
  const saved = { idb: g.indexedDB, nav: Object.getOwnPropertyDescriptor(globalThis, 'navigator') };
  g.indexedDB = fake.idb;
  if (nav) Object.defineProperty(globalThis, 'navigator', { value: nav, configurable: true, writable: true });
  try { await fn(); } finally {
    g.indexedDB = saved.idb;
    if (saved.nav) Object.defineProperty(globalThis, 'navigator', saved.nav);
    const album = await import('../src/opus-bay/game/album');
    album.resetAlbumForTests();
  }
}

const blob = () => new Blob([new Uint8Array([0xff, 0xd8, 0xff, 9])], { type: 'image/jpeg' });
const meta = (at: number) => ({ at, caption: 'Coit Tower', stamp: 'x', w: 4, h: 3, tags: [] });

test('W7-Q4 the IndexedDB connection lost in the background: the photo opens after a reopen (was: 这张照片找不到了 + memory from then on)', async () => {
  const fake = fakeIdb();
  let persists = 0;
  await withIdb(fake, async () => {
    const album = await import('../src/opus-bay/game/album');
    album.resetAlbumForTests({ idb: true });
    const id = await album.addPhoto(blob(), blob(), meta(Date.UTC(2026, 9, 1, 19)));
    assert.ok(id);
    assert.equal(album.albumKind(), 'idb');
    assert.equal(fake.state.opens, 1);
    // iOS dropped the connection while the tab was in the background
    fake.state.failTx = 1;
    const f = await album.photoFile(id!);
    assert.ok(f, 'the photo is found');
    assert.equal(f!.type, 'image/jpeg');
    assert.equal(fake.state.opens, 2, 'reopened once');
    // a new photo after another loss still goes to IndexedDB (was: the whole page switched to memory)
    fake.state.failTx = 1;
    const id2 = await album.addPhoto(blob(), blob(), meta(Date.UTC(2026, 9, 1, 20)));
    assert.ok(id2);
    assert.equal(album.albumKind(), 'idb');
    assert.equal(fake.data.full.size, 2, 'both photos stored in IndexedDB');
    assert.equal(persists, 1, 'navigator.storage.persist() asked once, after the first photo');
    assert.equal(album.albumPersistedNow(), true);
  }, { userAgent: IPHONE, storage: { persist: async () => { persists++; return true; } } });
});

test('W7-Q4 an IndexedDB open that never answers: after the timeout the album works in memory (was: empty for the page)', async () => {
  const fake = fakeIdb();
  fake.state.neverOpen = true;
  await withIdb(fake, async () => {
    const album = await import('../src/opus-bay/game/album');
    album.resetAlbumForTests({ idb: true, openTimeoutMs: 60 });
    const t0 = Date.now();
    const list = await album.listPhotos();
    assert.deepEqual(list, []);
    assert.ok(Date.now() - t0 < 2000);
    assert.equal(album.albumKind(), 'memory');
    const id = await album.addPhoto(blob(), blob(), meta(Date.UTC(2026, 9, 1, 19)));
    assert.ok(id && await album.photoFile(id), 'kept for the page');
    assert.equal(album.ALBUM_OPEN_TIMEOUT_MS, 3000);
  });
});

// W7-Q-review · Firefox (Gecko, desktop and Android) answers navigator.storage.persist() with a permission popup
// ("In Firefox, when a site chooses to use persistent storage, the user is notified with a UI popup" — MDN, Storage
// quotas and eviction criteria, checked 2026-09-30): the first photo raised a browser dialog. Safari and Chromium decide
// silently, so the ask stays there; Firefox on iOS (FxiOS) is WebKit and silent.
test('W7-Q-review persist() is not asked on Gecko (a permission popup at the first photo); still once on WebKit / Chromium', async () => {
  const FIREFOX = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0';
  const FIREFOX_ANDROID = 'Mozilla/5.0 (Android 14; Mobile; rv:143.0) Gecko/143.0 Firefox/143.0';
  const FXIOS = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/143.0 Mobile/15E148 Safari/605.1.15';
  const CHROME = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36';
  for (const [ua, want] of [[FIREFOX, 0], [FIREFOX_ANDROID, 0], [FXIOS, 1], [CHROME, 1], [IPHONE, 1]] as const) {
    const fake = fakeIdb();
    let persists = 0;
    await withIdb(fake, async () => {
      const album = await import('../src/opus-bay/game/album');
      album.resetAlbumForTests({ idb: true });
      assert.ok(await album.addPhoto(blob(), blob(), meta(Date.UTC(2026, 9, 1, 19))));
      await album.addPhoto(blob(), blob(), meta(Date.UTC(2026, 9, 1, 20)));
      assert.equal(album.albumKind(), 'idb');
      assert.equal(persists, want, `persist() asks for ${ua.slice(-40)}`);
    }, { userAgent: ua, storage: { persist: async () => { persists++; return true; } } });
  }
});
