// Shared by scripts/generate-image-variants.ts, scripts/verify-images.mjs and the image tests (plan D8, quality.md §2.1).

/** Per-variant byte budgets, decimal KB so the cap holds whichever way a report counts a kilobyte. */
export const IMAGE_BUDGETS = { medium: 90_000, large: 150_000 };
/** Home first viewport at DPR 3: the images a 390 px phone requests before any scroll. */
export const HOME_FIRST_VIEW_BUDGET = 450_000;

export const MANIFEST_PATH = 'src/data/generated/image-manifest.json';
export const LADDER_PATH = 'src/data/generated/image-ladder.json';
export const EXCEPTIONS_PATH = 'scripts/data/image-budget-exceptions.json';
/** Public-service illustrations ship per-locale siblings next to the zh-Hans file (src/data/guide-media.ts). */
export const LOCALIZED_SERVICE_SUFFIXES = ['-en', '-hant'];

/** Width and height from a complete WebP file header (lossy VP8, lossless VP8L or extended VP8X). */
export function webpSize(data, label = 'image') {
  if (data.toString('ascii', 0, 4) !== 'RIFF' || data.toString('ascii', 8, 12) !== 'WEBP') throw new Error(`${label}: not a WebP file`);
  if (data.readUInt32LE(4) + 8 !== data.length) throw new Error(`${label}: truncated WebP file`);
  const kind = data.toString('ascii', 12, 16);
  if (kind === 'VP8X') return { width: data.readUIntLE(24, 3) + 1, height: data.readUIntLE(27, 3) + 1 };
  if (kind === 'VP8L') {
    if (data[20] !== 0x2f) throw new Error(`${label}: bad VP8L signature`);
    const bits = data.readUInt32LE(21);
    return { width: (bits & 0x3fff) + 1, height: ((bits >>> 14) & 0x3fff) + 1 };
  }
  if (kind !== 'VP8 ' || data[23] !== 0x9d || data[24] !== 0x01 || data[25] !== 0x2a) throw new Error(`${label}: unsupported WebP header`);
  return { width: data.readUInt16LE(26) & 0x3fff, height: data.readUInt16LE(28) & 0x3fff };
}
