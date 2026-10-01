/**
 * W7-P3 · a lazy chunk that failed to load, loaded again (lane P; sf-w6-P.md Review: the tap-to-drive chunk).
 *
 * Chrome keeps a failed dynamic `import()` failed for the page's life: once a chunk's request is lost (a network blip on
 * a phone, a deploy between two requests), calling the same `import('./x')` again rejects at once without fetching —
 * W6-P-review measured it on the production build (the file back, `fetch` 200, `import` still failing), while the same
 * URL with a query string loads. So `importRetry(() => import('./x'))`:
 *
 *   1. runs the import as usual;
 *   2. on a *loading* failure (not an error thrown by the module's own code) waits RETRY_MS[0] and asks again — the URL
 *      the browser names in its error (Chrome / Firefox do), with `?retry=n` so the module map fetches it anew; without
 *      a URL in the message (Safari) the same import once more;
 *   3. up to RETRY_MS.length retries, then rejects with the last error (the caller's own fallback applies, as before).
 *
 * A retried chunk is a new module instance only because the first one never loaded (nothing ran twice); its own imports
 * resolve to the page's instances as before (a failed shared dependency stays failed: the caller's fallback).
 *
 * W8-P5 (lane P) · **one instance per lost chunk, and a visible state**:
 *
 *   - every call that meets the same lost URL shares one retry (in flight) and, once it landed, its module (`memo`):
 *     two call sites of one chunk (the Overlay's boot and a resume both load discovery) used to retry on their own and
 *     could land on two `?retry=n` URLs — two instances of one module, each with its own state;
 *   - a chunk still lost after every retry (the network is down, a deploy removed it, or one of its *shared
 *     dependencies* was lost — Chrome names the importing chunk, and `?retry=n` of it imports the same failed dependency
 *     URL again: only a reload brings it back) tells `onChunkLost` listeners: game/chunkLost.ts shows the reload card.
 *     `quiet: true` (a prefetch nobody waits for) tells nobody.
 *
 * W8-P-review (Ultra) · three holes closed:
 *
 *   - (P-RP-2) each retry asks for a `?retry=n` the page has never asked for: `n` counts on per URL across chains (a
 *     chain that failed left its `?retry=1..3` failed in Chrome's module map for good, so a later chain — the network
 *     back, 先继续玩, the panel opened again — used to fail on the very same three URLs and the part stayed dead);
 *   - (P-RC-2) an error that already names a `?retry=` URL is another chain's last word (a top-level await of an
 *     importRetry inside the module `load` imports — data/sf/cityData.ts): it is thrown on, never "retried" under a
 *     URL that is not the module `load` imports (that resolved the data chunk as GameRoot when it landed);
 *   - (P-RC-5) `quietly(() => …)`: every importRetry started synchronously inside it is `quiet` (the prefetches:
 *     ui/Overlay.tsx's panels, play/zones.ts zonePrefetch) — a speculative fetch lost in a tunnel no longer pops the
 *     reload card over play; the press that needs the part asks loudly, on a fresh URL.
 */

/** waits before each retry (ms) */
export const RETRY_MS = [1000, 3000, 8000] as const;

/** A failure to fetch / link a module (Chrome, Firefox, Safari, Vite's preload helper), not an error its code threw. */
export function isLoadFailure(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e);
  return /Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed|Unable to preload|Load failed|NetworkError/i.test(msg);
}

/** The module URL a browser names in its load-failure message (http(s), .js / .mjs / .ts / .tsx), or null. */
export function failedModuleUrl(e: unknown): string | null {
  const msg = e instanceof Error ? e.message : String(e);
  const m = /(https?:\/\/[^\s'"<>]+?\.(?:m?js|tsx?))(?:\?[^\s'"<>]*)?(?=[\s'"<>]|$)/.exec(msg);
  return m ? m[1] : null;
}

/**
 * (W7-P-review) The stylesheet Vite's preload helper names when a chunk's CSS failed ("Unable to preload CSS for …"), or
 * null. The helper marks that stylesheet as seen before it loads, so a plain second `load()` skips it and the chunk would
 * come in without its CSS (the play layer: an unstyled dialogue box / card for the rest of the visit, where before W7-P3
 * the failure reloaded the page once): the retry puts the stylesheet in itself first.
 */
export function failedCssUrl(e: unknown): string | null {
  const msg = e instanceof Error ? e.message : String(e);
  const m = /Unable to preload CSS for (\S+?\.css)(?:\?\S*)?(?=\s|$)/.exec(msg);
  return m ? m[1] : null;
}

/** (W8-P-review, P-RC-2) The browser's error names a `?retry=` URL: another importRetry chain's final error. */
export function namesRetriedUrl(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e);
  return /https?:\/\/[^\s'"<>]+?\.(?:m?js|tsx?|css)\?(?:[^\s'"<>]*&)?retry=\d/.test(msg);
}

/** `url` with `retry=n` in its query (so the module map treats it as a new module). */
export function bustUrl(url: string, n: number): string {
  return `${url}${url.includes('?') ? '&' : '?'}retry=${n}`;
}

export interface RetryOptions<T> {
  /** waits before each retry (default RETRY_MS) */
  waits?: readonly number[];
  /** (W8-P5) a prefetch nobody waits for: a chunk lost for good tells no `onChunkLost` listener */
  quiet?: boolean;
  /** tests: the timer and the URL import */
  sleep?: (ms: number) => Promise<void>;
  importUrl?: (url: string) => Promise<T>;
  /** tests: put a stylesheet in (resolves once it loaded; rejects with Vite's own message when it did not) */
  loadCss?: (url: string) => Promise<void>;
  /** tests: the per-URL table of retries in flight / chunks recovered (default: the page's one) */
  memo?: Map<string, LostChunk>;
}

const nativeImport = <T>(url: string): Promise<T> => import(/* @vite-ignore */ url) as Promise<T>;
const wait = (ms: number) => new Promise<void>(resolve => { setTimeout(resolve, ms); });
const nativeCss = (url: string): Promise<void> => new Promise<void>((resolve, reject) => {
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = url;
  link.addEventListener('load', () => { resolve(); });
  link.addEventListener('error', () => { link.remove(); reject(new Error(`Unable to preload CSS for ${url}`)); });
  document.head.appendChild(link);
});

/** (W8-P5) a lost chunk: the retry in flight, then the recovered module; `loud` once any caller is not `quiet` */
export interface LostChunk { p: Promise<unknown>; loud: boolean }
/** the page's lost chunks, per URL the browser named */
const MEMO = new Map<string, LostChunk>();
const lostListeners = new Set<(e: unknown) => void>();
let lostCount = 0;
/** (W8-P-review, P-RP-2) the last `?retry=n` asked for, per URL, per memo table: a new chain never reuses a failed URL */
const BUSTS = new WeakMap<Map<string, LostChunk>, Map<string, number>>();
function nextBust(memo: Map<string, LostChunk>, url: string): number {
  let t = BUSTS.get(memo);
  if (!t) BUSTS.set(memo, t = new Map());
  const n = (t.get(url) ?? 0) + 1;
  t.set(url, n);
  return n;
}
/** (W8-P-review, P-RC-5) > 0 while a `quietly` callback runs */
let quietDepth = 0;
/** Every importRetry started synchronously inside `fn` is `quiet` (a prefetch nobody waits for). Returns fn's value. */
export function quietly<T>(fn: () => T): T {
  quietDepth++;
  try { return fn(); } finally { quietDepth--; }
}

/** (W8-P5) Called once per chunk still lost after every retry (not for `quiet` loads). Returns the unsubscribe. */
export function onChunkLost(fn: (e: unknown) => void): () => void {
  lostListeners.add(fn);
  return () => { lostListeners.delete(fn); };
}
/** chunks lost for good on this page (QA, ?debug=1) */
export const chunksLost = (): number => lostCount;

function lost(e: unknown, quiet: boolean | undefined): void {
  lostCount++;
  if (!quiet) for (const fn of [...lostListeners]) { try { fn(e); } catch { /* a listener's own error never hides the load's */ } }
}

/** Run `load` (a dynamic import); retry a loading failure (see above). */
export async function importRetry<T>(load: () => Promise<T>, opts: RetryOptions<T> = {}): Promise<T> {
  const waits = opts.waits ?? RETRY_MS, sleep = opts.sleep ?? wait, importUrl = opts.importUrl ?? nativeImport<T>, loadCss = opts.loadCss ?? nativeCss;
  const memo = opts.memo ?? MEMO;
  const quiet = opts.quiet ?? quietDepth > 0; // read before the first await: `quietly` is synchronous
  let first: unknown;
  try {
    return await load();
  } catch (e) {
    first = e;
  }
  if (!isLoadFailure(first)) throw first;
  // (P-RC-2) a nested chain already retried (and told the listeners): not ours to retry under its URL
  if (namesRetriedUrl(first)) throw first;
  const retry = async (): Promise<T> => {
    let last: unknown = first;
    for (let n = 1; n <= waits.length; n++) {
      if (!isLoadFailure(last)) throw last;
      await sleep(waits[n - 1]);
      const css = failedCssUrl(last), url = css ? null : failedModuleUrl(last);
      try {
        // (W7-P-review) a lost stylesheet first, under a new URL; then the chunk (the helper skips a CSS it has seen)
        if (css) { await loadCss(bustUrl(css, nextBust(memo, css))); return await load(); }
        return url ? await importUrl(bustUrl(url, nextBust(memo, url))) : await load();
      } catch (e) { last = e; }
    }
    throw last;
  };
  // (W8-P5) one retry per lost URL: a second caller joins the one in flight, or takes the module it recovered
  const key = failedCssUrl(first) ? null : failedModuleUrl(first);
  if (key) {
    const known = memo.get(key);
    if (known) { known.loud ||= !quiet; return known.p as Promise<T>; }
    const entry: LostChunk = { p: retry(), loud: !quiet };
    memo.set(key, entry);
    entry.p.catch((e: unknown) => { if (memo.get(key) === entry) memo.delete(key); if (isLoadFailure(e)) lost(e, !entry.loud); });
    return entry.p as Promise<T>;
  }
  try {
    return await retry();
  } catch (e) {
    if (isLoadFailure(e)) lost(e, quiet);
    throw e;
  }
}
