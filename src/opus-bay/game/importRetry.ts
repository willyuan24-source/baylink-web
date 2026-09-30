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
 * resolve to the page's instances as before (a failed shared dependency stays failed: the caller's fallback). Calls for
 * the same loader share nothing here: each call site keeps its own promise, as it did.
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

/** `url` with `retry=n` in its query (so the module map treats it as a new module). */
export function bustUrl(url: string, n: number): string {
  return `${url}${url.includes('?') ? '&' : '?'}retry=${n}`;
}

export interface RetryOptions<T> {
  /** waits before each retry (default RETRY_MS) */
  waits?: readonly number[];
  /** tests: the timer and the URL import */
  sleep?: (ms: number) => Promise<void>;
  importUrl?: (url: string) => Promise<T>;
}

const nativeImport = <T>(url: string): Promise<T> => import(/* @vite-ignore */ url) as Promise<T>;
const wait = (ms: number) => new Promise<void>(resolve => { setTimeout(resolve, ms); });

/** Run `load` (a dynamic import); retry a loading failure (see above). */
export async function importRetry<T>(load: () => Promise<T>, opts: RetryOptions<T> = {}): Promise<T> {
  const waits = opts.waits ?? RETRY_MS, sleep = opts.sleep ?? wait, importUrl = opts.importUrl ?? nativeImport<T>;
  try {
    return await load();
  } catch (first) {
    let last: unknown = first;
    for (let n = 1; n <= waits.length; n++) {
      if (!isLoadFailure(last)) throw last;
      await sleep(waits[n - 1]);
      const url = failedModuleUrl(last);
      try {
        return url ? await importUrl(bustUrl(url, n)) : await load();
      } catch (e) { last = e; }
    }
    throw last;
  }
}
