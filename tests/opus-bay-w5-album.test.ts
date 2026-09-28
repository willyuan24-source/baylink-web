import assert from 'node:assert/strict';
import test from 'node:test';

/**
 * Wave 5 · lane C · W5-C7 (plan sf-w5-plan.md §3.5 "Photo album"): the album on this device (game/album.ts; node has no
 * IndexedDB, so this is the in-memory store a private window gets), the photo tags lanes A / D use, the More item and
 * the overlay. The shutter → album path (game/photo.ts, city only) is checked in the game (report, part c).
 */

const g = globalThis as unknown as Record<string, unknown>;
g.window ??= globalThis;

const album = await import('../src/opus-bay/game/album');
const frames = await import('../src/opus-bay/game/photoFrames');
const slots = await import('../src/opus-bay/ui/slots');

const jpeg = (bytes: number, fill = 1) => new Blob([new Uint8Array(bytes).fill(fill)], { type: 'image/jpeg' });
const meta = (at: number, tags: string[] = []) => ({ at, caption: `湾区小旅 · ${at}`, stamp: 'BAYLINK', w: 1520, h: 1048, x: 1, z: 2, area: 'north-beach', tags });

test('W5-C7 album: kept newest first, read back as a File, deleted, found by tag; listeners hear each change', async () => {
  album.resetAlbumForTests();
  let heard = 0;
  const off = album.subscribeAlbum(() => { heard++; });
  const a = await album.addPhoto(jpeg(2000, 1), jpeg(300, 2), meta(1_000_000, ['view:twin-peaks']));
  const b = await album.addPhoto(jpeg(3000, 3), jpeg(400, 4), meta(2_000_000));
  assert.ok(a && b && a !== b);
  assert.equal(album.albumKind(), 'memory', 'no IndexedDB here: the memory album');
  const list = await album.listPhotos();
  assert.deepEqual(list.map(p => p.id), [b, a], 'newest first');
  assert.equal(list[1].caption, '湾区小旅 · 1000000');
  assert.deepEqual(list[1].tags, ['view:twin-peaks']);
  assert.equal(await album.albumCount(), 2);
  const file = await album.photoFile(a!);
  assert.ok(file && file.size === 2000 && file.type === 'image/jpeg');
  assert.match(file!.name, /^opus-bay-\d{4}-\d\d-\d\d-\d\d-\d\d-\d\d\.jpg$/);
  assert.deepEqual((await album.photosTagged('view:twin-peaks')).map(p => p.id), [a]);
  await album.deletePhoto(a!);
  assert.deepEqual((await album.listPhotos()).map(p => p.id), [b]);
  assert.equal(await album.photoFile(a!), null, 'gone');
  assert.equal(heard, 3, 'two adds and a delete');
  off();
});

test('W5-C7 album: past ALBUM_MAX the oldest photos leave; the file name is the Bay date and time', async () => {
  album.resetAlbumForTests();
  for (let i = 0; i < album.ALBUM_MAX + 3; i++) await album.addPhoto(jpeg(10), jpeg(5), meta(1_700_000_000_000 + i * 1000));
  const list = await album.listPhotos();
  assert.equal(list.length, album.ALBUM_MAX);
  assert.equal(list[list.length - 1].at, 1_700_000_000_000 + 3000, 'the three oldest went');
  // 2023-11-14T22:13:20Z = 14:13:20 in San Francisco (PST)
  assert.equal(album.photoFileName(1_700_000_000_000), 'opus-bay-2023-11-14-14-13-20.jpg');
  assert.equal(album.photoFileName(1_700_000_000_000, 'image/png'), 'opus-bay-2023-11-14-14-13-20.png');
});

test('W5-C7 photo tags: registered taggers tag each shot (unique, valid, ≤ 16); a throwing tagger or a bad tag is skipped', () => {
  const ctx = { x: 128.9, z: 929.3, area: 'twin-peaks', at: new Date() };
  const offA = frames.registerPhotoTagger('a-views', c => (c.area === 'twin-peaks' ? ['view:twin-peaks', 'view:twin-peaks'] : null));
  const offB = frames.registerPhotoTagger('bad', () => { throw new Error('boom'); });
  const offC = frames.registerPhotoTagger('d-nature', () => ['nature:raven', 'Not A Tag!', '']);
  try {
    assert.deepEqual(frames.photoTags(ctx), ['view:twin-peaks', 'nature:raven']);
    assert.deepEqual(frames.photoTags({ ...ctx, area: 'mission' }), ['nature:raven']);
  } finally { offA(); offB(); offC(); }
  assert.deepEqual(frames.photoTags(ctx), []);
});

test('W5-C7 album: the city chunk registers the 相册 More item and the overlay; the disposer takes them away', () => {
  const off = album.initAlbum();
  try {
    const item = slots.moreItems.list().find(m => m.id === album.ALBUM_ID);
    assert.ok(item, 'the More item');
    assert.deepEqual(item!.label, { zh: '相册', en: 'Album' });
    assert.ok(slots.overlays.list().some(o => o.id === album.ALBUM_ID), 'the overlay');
    item!.onSelect();
    assert.ok(slots.openOverlays().some(o => o.id === album.ALBUM_ID), 'More → 相册 opens it');
    album.openAlbum('p123');
    assert.deepEqual(slots.openOverlays().find(o => o.id === album.ALBUM_ID)!.props, { photo: 'p123' }, 'on a photo');
    slots.closeOverlay(album.ALBUM_ID);
  } finally { off(); }
  assert.ok(!slots.moreItems.list().some(m => m.id === album.ALBUM_ID));
  assert.ok(!slots.overlays.list().some(o => o.id === album.ALBUM_ID));
});

test('W5-C7 the photo caption fits a narrow (portrait phone) card: unchanged when it fits, else smaller, else cut with …', async () => {
  const { fitCaption } = await import('../src/opus-bay/game/photo');
  // a fake canvas: every character is `size` px wide
  const ctx = { font: '', measureText(t: string) { const size = Number(/(\d+)px/.exec(this.font)![1]); return { width: [...t].length * size } as TextMetrics; } };
  const caption = '湾区小旅 · 渡轮大厦 · 2026年9月28日';
  const n = [...caption].length;
  assert.deepEqual(fitCaption(ctx, caption, 40, n * 40 + 5), { size: 40, text: caption }, 'fits: as before');
  const smaller = fitCaption(ctx, caption, 40, n * 30);
  assert.equal(smaller.text, caption);
  assert.ok(smaller.size < 40 && smaller.size * n <= n * 30, `smaller (${smaller.size})`);
  const cut = fitCaption(ctx, caption, 40, 10 * 20);
  assert.equal(cut.size, 20, 'not below half');
  assert.ok(cut.text.endsWith('…') && [...cut.text].length * 20 <= 200, `cut: ${cut.text}`);
});
