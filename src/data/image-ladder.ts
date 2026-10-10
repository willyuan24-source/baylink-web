import ladder from './generated/image-ladder.json';

/**
 * The editorial image ladder (plan D8): a 480 w `-small` file, an 800 w `-800` and a 1200 w `-1200` WebP, plus a
 * dominant-colour placeholder. `npm run images:variants` (scripts/generate-image-variants.ts) writes the files, the full
 * manifest (src/data/generated/image-manifest.json) and this module's compact table; `npm run verify:images` checks them.
 *
 * Which rungs exist depends on each original's bytes (an 800 only when the original is over the 800 budget, a 1200 only
 * when it is over the 1200 budget), so pages read the table instead of guessing file names. The table stores one
 * four-character code per registered source, in sorted order, behind a hash of that source list: a registry that
 * changed without a regenerated table reads as empty, and every image keeps the plain `-small` + original srcset.
 */

export const SMALL_WIDTH = 480;
export const MEDIUM_WIDTH = 800;
export const LARGE_WIDTH = 1200;

export type LadderEntry = {
  /** Dominant colour of the image as a 12-bit CSS hex colour (`#rgb`), for the placeholder behind the photo. */
  lqip: string;
  /** An `-800.webp` exists (800 wide). */
  medium: boolean;
  /** A `-1200.webp` exists (1200 wide, or the original width when smaller); the original then leaves the srcset. */
  large: boolean;
};

/** 32-bit FNV-1a as 8 hex digits: the fingerprint of the registry's source list. */
export function fnv1a(text: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

/** Unique sources in the order the table is written: plain code-unit sort, identical at build time and in the browser. */
export const registrySources = (images: Iterable<{ src: string }>): string[] => [...new Set(Array.from(images, image => image.src))].sort();
export const registryHash = (sources: readonly string[]) => fnv1a(sources.join('\n'));

/** `#rgb` + one flag digit: 0 none, 1 medium, 2 large, 3 both. */
export function encodeLadderEntry(entry: LadderEntry): string {
  return `${entry.lqip.slice(1)}${(entry.medium ? 1 : 0) + (entry.large ? 2 : 0)}`;
}
export function decodeLadderEntry(code: string): LadderEntry | undefined {
  const match = /^([0-9a-f]{3})([0-3])$/.exec(code);
  if (!match) return undefined;
  const flags = Number(match[2]);
  return { lqip: `#${match[1]}`, medium: (flags & 1) === 1, large: (flags & 2) === 2 };
}

export type LadderTable = { hash: string; count: number; codes: string; extra: Record<string, string> };

/** Entries for the given registry, keyed by source; empty when the table was generated for a different source list. */
export function readLadder(sources: readonly string[], table: LadderTable = ladder as LadderTable): Map<string, LadderEntry> {
  const entries = new Map<string, LadderEntry>();
  if (table.count !== sources.length || table.codes.length !== sources.length * 4 || table.hash !== registryHash(sources)) return entries;
  sources.forEach((src, index) => {
    const entry = decodeLadderEntry(table.codes.slice(index * 4, index * 4 + 4));
    if (entry) entries.set(src, entry);
  });
  return entries;
}

/** Sources outside the registry (localized service illustrations, 3D postcards) are keyed by path. */
export function readExtraLadder(src: string, table: LadderTable = ladder as LadderTable): LadderEntry | undefined {
  const code = Object.hasOwn(table.extra, src) ? table.extra[src] : undefined;
  return code ? decodeLadderEntry(code) : undefined;
}

export const variantPath = (src: string, rung: 'small' | typeof MEDIUM_WIDTH | typeof LARGE_WIDTH) =>
  src.replace(/\.webp$/, rung === 'small' ? '-small.webp' : `-${rung}.webp`);

/**
 * The srcset for one image: 480 (`-small`), 800, then the 1200 variant — or the original while it is within the
 * 1200 budget. Never wider than the original (no upscaling): an image at most 480 wide is its own only candidate.
 */
export function ladderSrcSet(src: string, width: number, entry: Pick<LadderEntry, 'medium' | 'large'>): string {
  if (width <= SMALL_WIDTH) return `${src} ${width}w`;
  const candidates = [`${variantPath(src, 'small')} ${SMALL_WIDTH}w`];
  if (entry.medium && width > MEDIUM_WIDTH) candidates.push(`${variantPath(src, MEDIUM_WIDTH)} ${MEDIUM_WIDTH}w`);
  candidates.push(entry.large ? `${variantPath(src, LARGE_WIDTH)} ${Math.min(LARGE_WIDTH, width)}w` : `${src} ${width}w`);
  return candidates.join(', ');
}
