import { API_BASE_URL } from './api';
import { trackingAllowed } from './product-events';
import { currentRouteTemplate } from './route-template';
import { releaseLabel } from './release';

/**
 * Error beacon (RUM-lite): anonymous daily counts per kind, page template, build and fingerprint, so a broken page or a
 * bad deploy shows up in admin. The message, stack, URL and anything the reader typed never leave the browser: only a
 * short hash of the error name and the first 60 characters of its message, with URLs and digits removed, is sent.
 * Pages report through error-beacon.ts, which loads this module after boot (it is not part of any page's boot graph).
 */
export type ClientErrorKind = 'render' | 'error' | 'rejection' | 'chunk';

/** One beacon per fingerprint per page load, and a few per page at most, so a loop cannot flood the counters. */
const MAX_BEACONS_PER_PAGE = 8;
const sent = new Set<string>();

const CHUNK_FAILURE = /dynamically imported module|importing a module script failed|failed to load module script|unable to preload css|chunkloaderror|loading (?:css )?chunk/i;
/** Noise no one can act on: cross-origin "Script error.", benign ResizeObserver loops and cancelled requests. */
const IGNORED = /^(?:script error\.?|resizeobserver loop.*)$/i;

const errorParts = (error: unknown): { name: string; message: string } => {
  if (error instanceof Error) return { name: error.name || 'Error', message: error.message || '' };
  if (error && typeof error === 'object' && 'message' in error) return { name: 'Object', message: String((error as { message: unknown }).message ?? '') };
  if (typeof error === 'string') return { name: 'String', message: error };
  return { name: typeof error, message: '' };
};

/** The message part of the fingerprint: no URLs, file names or digits (ids, sizes, line numbers), 60 characters at most. */
export const fingerprintText = (name: string, message: string) => `${name}:${message
  .replace(/(?:https?|blob|file|webpack|chrome-extension):\/\/\S+/gi, '')
  .replace(/\b[\w.-]+\.(?:m?js|css|html?|json)\b/gi, '')
  .replace(/\d+/g, '')
  .replace(/\s+/g, ' ').trim().slice(0, 60)}`;

/** FNV-1a 32-bit as 8 lowercase hex digits: stable across browsers, not reversible to the text. */
export function errorFingerprint(name: string, message: string): string {
  let hash = 0x811c9dc5;
  for (const character of fingerprintText(name, message)) {
    hash ^= character.codePointAt(0)!;
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

export const classifyClientError = (kind: ClientErrorKind, error: unknown): ClientErrorKind | null => {
  const { name, message } = errorParts(error);
  if (name === 'AbortError' || IGNORED.test(message.trim())) return null;
  return name === 'ChunkLoadError' || CHUNK_FAILURE.test(message) ? 'chunk' : kind;
};

/** Send one caught error's beacon; never throws and never waits. `route` is the template when the error happened. */
export function sendClientError(kind: ClientErrorKind, error: unknown, route = currentRouteTemplate()): void {
  try {
    if (!trackingAllowed()) return;
    const resolved = classifyClientError(kind, error);
    if (!resolved) return;
    const { name, message } = errorParts(error);
    const fp = errorFingerprint(name, message);
    const key = `${resolved}:${fp}`;
    if (sent.has(key) || sent.size >= MAX_BEACONS_PER_PAGE) return;
    sent.add(key);
    void fetch(`${API_BASE_URL}/client-errors`, {
      method: 'POST', credentials: 'omit', referrerPolicy: 'no-referrer', keepalive: true,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind: resolved, route, release: releaseLabel(), fp }),
    }).catch(() => { /* A failed beacon is dropped; it must never surface or retry. */ });
  } catch { /* Reporting an error must not cause another one. */ }
}

/** Test hook: forget the beacons sent by this page load. */
export const resetClientErrorBeacons = () => sent.clear();
