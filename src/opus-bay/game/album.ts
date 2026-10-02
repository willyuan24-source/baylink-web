import { createElement } from 'react';
import { lazyChunk } from './lazyChunk';
import { Images } from 'lucide-react';
import type { Bilingual } from '../core/types';
import { registerMoreItem, registerOverlay, openOverlay } from '../ui/slots';
import { importRetry } from './importRetry';
import { bootMetrics } from './metricsBoot';

/**
 * Wave 5 · lane C · W5-C7 (plan sf-w5-plan.md §3.5 "Photo album"): every shutter in the city goes into an album on
 * this device instead of forcing a PNG download (the owner's phone asked "download?" at every picture). LAZY: the city
 * chunk (game/cityContent.ts) runs `initAlbum()`; game/photo.ts hands its finished cards here; the sheet is
 * ui/Album.tsx (its own chunk). District mode is unchanged (its shutter still downloads the PNG).
 *
 *   storage       IndexedDB `opus-bay-album` (v1): store `meta` (id, time, caption, place, tags and the ≈ 30 KB JPEG
 *                 thumbnail as bytes) and store `full` (the card as a JPEG, q .92); listing reads `meta` only. Bytes, not
 *                 Blobs, are stored (older iOS Safari failed to store Blobs). Without IndexedDB (a private window,
 *                 blocked storage, node) the album lives in memory for the page. ALBUM_MAX photos; the oldest goes.
 *   API           addPhoto(full, thumb, meta) · listPhotos() newest first · photoFile(id) · deletePhoto(id) ·
 *                 subscribeAlbum(fn) · albumCount() · photosTagged(tag) (lane A's view cards, lane D's nature page:
 *                 tags come from game/photoFrames.ts registerPhotoTagger, e.g. `view:twin-peaks`) · openAlbum(id?)
 *   UI            the More item 相册 (phones: the bar's 更多; desktop: the 更多 button) and photo mode's thumbnail open
 *                 the overlay ALBUM_ID; a photo opens large with 保存 · 分享 · 删除 (ui/Album.tsx: Web Share with the file
 *                 where the browser can — iOS 15+: 存储图像 puts it in Photos —, else a download + the game's link copied)
 */

export const ALBUM_ID = 'c-album';
export const ALBUM_MAX = 60;
export const ALBUM_LABEL: Bilingual = { zh: '相册', en: 'Album' };
const DB_NAME = 'opus-bay-album';

export interface AlbumMeta {
  id: string;
  /** when it was taken (ms since the epoch) */
  at: number;
  caption: string;
  stamp: string;
  /** the card's size in px */
  w: number;
  h: number;
  /** where the player stood, and the area id */
  x?: number;
  z?: number;
  area?: string;
  /** registered taggers' tags (`view:twin-peaks`, …) */
  tags: string[];
  /** W9-S2: the `?at=` value of the spot (game/photoCard.ts photoSpot) the card's QR code and its share open */
  spot?: string;
}
export interface AlbumPhoto extends AlbumMeta {
  /** an object URL of the thumbnail (valid while the photo is in the album) */
  thumbUrl: string;
}

interface StoredMeta extends AlbumMeta { thumb: ArrayBuffer; thumbType: string }
interface StoredFull { id: string; data: ArrayBuffer; type: string }

// --- the store: IndexedDB, else memory ----------------------------------------------------------------------------------

interface Backend {
  metas(): Promise<StoredMeta[]>;
  full(id: string): Promise<StoredFull | undefined>;
  put(meta: StoredMeta, full: StoredFull): Promise<void>;
  remove(id: string): Promise<void>;
}

function memoryBackend(): Backend {
  const metas = new Map<string, StoredMeta>(), fulls = new Map<string, StoredFull>();
  return {
    metas: async () => [...metas.values()],
    full: async id => fulls.get(id),
    put: async (m, f) => { metas.set(m.id, m); fulls.set(f.id, f); },
    remove: async id => { metas.delete(id); fulls.delete(id); },
  };
}

const req = <T>(r: IDBRequest<T>) => new Promise<T>((resolve, reject) => { r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); });
const done = (tx: IDBTransaction) => new Promise<void>((resolve, reject) => { tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error); });

/**
 * W7-Q4 · how long the album waits for IndexedDB to open. iOS sometimes never answers an open (neither success nor
 * error): the album used to stay empty for the page. After this the page's album lives in memory (the sheet says so).
 */
export const ALBUM_OPEN_TIMEOUT_MS = 3000;
let openTimeoutMs = ALBUM_OPEN_TIMEOUT_MS;

function openDb(idb: IDBFactory): Promise<IDBDatabase | null> {
  return new Promise<IDBDatabase | null>(resolve => {
    let settled = false;
    const finish = (d: IDBDatabase | null) => { if (settled) { d?.close(); return; } settled = true; clearTimeout(timer); resolve(d); };
    const timer = setTimeout(() => finish(null), openTimeoutMs);
    let r: IDBOpenDBRequest;
    try { r = idb.open(DB_NAME, 1); } catch { finish(null); return; }
    r.onupgradeneeded = () => {
      const d = r.result;
      if (!d.objectStoreNames.contains('meta')) d.createObjectStore('meta', { keyPath: 'id' });
      if (!d.objectStoreNames.contains('full')) d.createObjectStore('full', { keyPath: 'id' });
    };
    r.onsuccess = () => finish(r.result);
    r.onerror = () => finish(null);
    r.onblocked = () => finish(null);
  });
}

/**
 * The IndexedDB store. W7-Q4: the connection is not kept forever — after a while in the background iOS drops it
 * (`InvalidStateError` / "Connection to Indexed Database server lost" from `transaction()`), which used to turn a saved
 * photo into 这张照片找不到了 and switch the page to memory. Now an operation that fails reopens the database once and
 * runs again; `onclose` / `onversionchange` drop the handle so the next operation reopens it. Only a failed reopen
 * (or a failed retry) reaches the caller.
 */
async function idbBackend(): Promise<Backend | null> {
  const idb = typeof indexedDB !== 'undefined' ? indexedDB : null;
  if (!idb) return null;
  let db: IDBDatabase | null = null;
  const adopt = (d: IDBDatabase | null) => {
    db = d;
    if (d) {
      d.onclose = () => { if (db === d) db = null; };
      d.onversionchange = () => { try { d.close(); } catch { /* closed */ } if (db === d) db = null; };
    }
    return d;
  };
  if (!adopt(await openDb(idb))) return null;
  const run = async <T>(op: (d: IDBDatabase) => Promise<T>): Promise<T> => {
    const d = db ?? adopt(await openDb(idb));
    if (!d) throw new Error('album: IndexedDB would not reopen');
    try { return await op(d); } catch (error) {
      try { d.close(); } catch { /* already gone */ }
      if (db === d) db = null;
      const again = adopt(await openDb(idb));
      if (!again) throw error;
      return op(again);
    }
  };
  return {
    metas: () => run(d => req(d.transaction('meta').objectStore('meta').getAll() as IDBRequest<StoredMeta[]>)),
    full: id => run(d => req(d.transaction('full').objectStore('full').get(id) as IDBRequest<StoredFull | undefined>)),
    put: (m, f) => run(async d => { const tx = d.transaction(['meta', 'full'], 'readwrite'); tx.objectStore('meta').put(m); tx.objectStore('full').put(f); await done(tx); }),
    remove: id => run(async d => { const tx = d.transaction(['meta', 'full'], 'readwrite'); tx.objectStore('meta').delete(id); tx.objectStore('full').delete(id); await done(tx); }),
  };
}

let backend: Promise<Backend> | null = null;
/** 'idb' | 'memory' once the store is open (the sheet tells a memory album that it goes with the page) */
let kind: 'idb' | 'memory' | null = null;
function store(): Promise<Backend> {
  backend ??= idbBackend().catch(() => null).then(b => { kind = b ? 'idb' : 'memory'; return b ?? memoryBackend(); });
  return backend;
}
/**
 * W7-Q4 · ask once per page for persistent storage after the first photo went into IndexedDB: Safari (ITP) deletes a
 * site's storage after 7 days of Safari use without a visit; a persisted origin is exempt where the browser grants it
 * (Safari 17+, Chrome by engagement). Never throws; the answer only goes to the ?debug line.
 */
let persistAsked = false;
let albumPersisted: boolean | null = null;
/** null until the browser answered (or when it cannot be asked) */
export const albumPersistedNow = () => albumPersisted;
function askPersist() {
  if (persistAsked) return;
  persistAsked = true;
  try {
    // (W7-Q-review) Gecko (Firefox desktop / Android) answers with a permission popup at the first photo — not asked
    // there; FxiOS is WebKit ("like Gecko" has no "Gecko/<n>") and decides silently like Safari and Chromium
    if (typeof navigator !== 'undefined' && /\bGecko\/\d/.test(navigator.userAgent ?? '')) return;
    const st = typeof navigator !== 'undefined' ? (navigator as Navigator & { storage?: StorageManager }).storage : undefined;
    void st?.persist?.().then(ok => { albumPersisted = ok; }, () => { /* not allowed */ });
  } catch { /* no StorageManager */ }
}
export const albumKind = () => kind;

// --- the album ---------------------------------------------------------------------------------------------------------

let photos: AlbumPhoto[] | null = null;
const listeners = new Set<() => void>();
let version = 0;
const changed = () => { version++; for (const fn of [...listeners]) { try { fn(); } catch { /* a listener */ } } };
export function subscribeAlbum(fn: () => void): () => void { listeners.add(fn); return () => { listeners.delete(fn); }; }
export const albumVersion = () => version;

const toUrl = (data: ArrayBuffer, type: string) => (typeof URL !== 'undefined' && URL.createObjectURL ? URL.createObjectURL(new Blob([data], { type })) : '');
const revoke = (url: string) => { if (url && typeof URL !== 'undefined' && URL.revokeObjectURL) URL.revokeObjectURL(url); };
const strip = (m: StoredMeta): AlbumMeta => ({ id: m.id, at: m.at, caption: m.caption, stamp: m.stamp, w: m.w, h: m.h, x: m.x, z: m.z, area: m.area, tags: m.tags ?? [], ...(m.spot ? { spot: m.spot } : {}) });

/** Every photo, newest first (loads the thumbnails once per page). */
export async function listPhotos(): Promise<AlbumPhoto[]> {
  if (photos) return photos;
  let metas: StoredMeta[];
  try { metas = await (await store()).metas(); } catch { metas = []; }
  // (a second caller may have filled it while we waited)
  photos ??= metas.sort((a, b) => b.at - a.at).map(m => ({ ...strip(m), thumbUrl: toUrl(m.thumb, m.thumbType) }));
  return photos;
}
/** The list as loaded so far (null before the first listPhotos) — for renders. */
export const photosNow = (): readonly AlbumPhoto[] | null => photos;
export async function albumCount(): Promise<number> { return (await listPhotos()).length; }
/** Photos carrying a tag (lane A's view cards: `view:<spot>`; lane D's nature page), newest first. */
export async function photosTagged(tag: string): Promise<AlbumPhoto[]> { return (await listPhotos()).filter(p => p.tags.includes(tag)); }

let seq = 0;
/** A new id: the time and a counter (ids sort by time). */
export const newPhotoId = (at: number) => `p${at.toString(36)}${(seq++ % 1296).toString(36).padStart(2, '0')}`;

/**
 * Keep a photo: the card (`full`) and its thumbnail. Returns the new id, or null when it could not be kept at all.
 * Past ALBUM_MAX the oldest photos leave the album.
 */
export async function addPhoto(full: Blob, thumb: Blob, meta: Omit<AlbumMeta, 'id'>): Promise<string | null> {
  const list = await listPhotos();
  const id = newPhotoId(meta.at);
  try {
    const [fullData, thumbData] = await Promise.all([full.arrayBuffer(), thumb.arrayBuffer()]);
    const m: StoredMeta = { ...meta, id, thumb: thumbData, thumbType: thumb.type || 'image/jpeg' };
    try { await (await store()).put(m, { id, data: fullData, type: full.type || 'image/jpeg' }); if (kind === 'idb') askPersist(); } catch {
      // quota or a closed database: this page keeps it in memory from now on
      backend = Promise.resolve(memoryBackend()); kind = 'memory';
      await (await backend).put(m, { id, data: fullData, type: full.type || 'image/jpeg' });
    }
    list.unshift({ ...strip(m), thumbUrl: toUrl(thumbData, m.thumbType) });
  } catch { return null; }
  while (list.length > ALBUM_MAX) { const old = list.pop()!; revoke(old.thumbUrl); try { await (await store()).remove(old.id); } catch { /* gone */ } }
  changed();
  return id;
}

/** The card as a File (for 保存 / 分享), or null when it is gone. */
export async function photoFile(id: string): Promise<File | null> {
  let f: StoredFull | undefined;
  try { f = await (await store()).full(id); } catch { f = undefined; }
  if (!f) return null;
  const p = (photos ?? []).find(item => item.id === id);
  return new File([f.data], photoFileName(p?.at ?? Date.now(), f.type), { type: f.type });
}

/** `little-bay-trip-2026-09-28-14-03-22.jpg` (the Bay date and time it was taken; W9-S2: the game's visible name). */
export function photoFileName(at: number, type = 'image/jpeg'): string {
  const d = new Date(at);
  let stamp: string;
  try {
    const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).formatToParts(d).map(p => [p.type, p.value]));
    stamp = `${parts.year}-${parts.month}-${parts.day}-${parts.hour}-${parts.minute}-${parts.second}`;
  } catch { stamp = d.toISOString().slice(0, 19).replace(/[:T]/g, '-'); }
  return `little-bay-trip-${stamp}.${type === 'image/png' ? 'png' : 'jpg'}`;
}

export async function deletePhoto(id: string): Promise<void> {
  const list = await listPhotos();
  const i = list.findIndex(p => p.id === id);
  if (i < 0) return;
  const [gone] = list.splice(i, 1);
  revoke(gone.thumbUrl);
  try { await (await store()).remove(id); } catch { /* already gone */ }
  changed();
}

/** Open the album (on a photo when `id` is given). */
export function openAlbum(id?: string) { openOverlay(ALBUM_ID, id ? { photo: id } : undefined); }

/** Tests: a fresh memory album (or, with `idb`, one that opens the global `indexedDB` on first use). */
export function resetAlbumForTests(opts: { idb?: boolean; openTimeoutMs?: number } = {}) {
  for (const p of photos ?? []) revoke(p.thumbUrl);
  photos = null; version = 0; listeners.clear();
  if (opts.idb) { backend = null; kind = null; } else { backend = Promise.resolve(memoryBackend()); kind = 'memory'; }
  openTimeoutMs = opts.openTimeoutMs ?? ALBUM_OPEN_TIMEOUT_MS;
  persistAsked = false; albumPersisted = null;
}

const Album = lazyChunk(() => importRetry(() => import('../ui/Album')));
const AlbumIcon = () => createElement(Images, { size: 18, 'aria-hidden': true });

/**
 * The city chunk's boot: the 相册 More item and the overlay. Returns the disposer.
 * W9-S3: it also boots the metrics (game/metricsBoot.ts: the runner loads after the first frame) — this chunk is the
 * city's lazy boot already (game/cityContent.ts), so the metrics cost GameRoot nothing.
 */
export function initAlbum(): () => void {
  const offOverlay = registerOverlay({ id: ALBUM_ID, Component: Album });
  const offMore = registerMoreItem({ id: ALBUM_ID, order: 20, label: ALBUM_LABEL, icon: AlbumIcon, onSelect: () => openAlbum() });
  const offMetrics = bootMetrics();
  return () => { offOverlay(); offMore(); offMetrics(); };
}
