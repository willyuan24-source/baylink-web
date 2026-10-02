import { importRetry } from './importRetry';

/**
 * Wave 9 · lane S · W9-S2 — the way back from a shared picture (review R§5 #8, §8 idea 5).
 *
 * WeChat and the other in-app browsers carry a picture, not its link: a photo or a 约家人 card forwarded to a family
 * group was a dead end. Now the city's photo card prints the game's address and a small QR code under the picture, and
 * the code opens the game at the same spot: `https://www.baylink.us/opus-bay?at=<spot>&from=photo` (`from=family` for the
 * 约家人 card). Pure helpers (node-tested) + the QR loader (the `qrcode` package, a lazy chunk of its own).
 *
 *   gameLink(at, from)      the address a QR code / share carries (the canonical host, whatever host took the shot)
 *   photoSpot(x, z, near)   where a photo was taken as an `?at=` value: the nearest landmark / curated place within
 *                           SPOT_R (a short, readable id that game/resume.ts resolves), else `xz:<x>,<z>` (whole units)
 *   bandLayout(w, h)        the band under the picture: caption, `BAYLINK · baylink.us/opus-bay`, the QR box (sized so
 *                           a code survives WeChat's ≈ 1280 px re-encode: ≥ 3 px a module there)
 *   loadQr(text)            the code's modules (null when the chunk cannot load: the card goes without a code)
 *   drawQr(ctx, qr, box)    a white rounded box with the code centred in it, whole pixels a module (crisp)
 */

export const SITE_ORIGIN = 'https://www.baylink.us';
/** printed on the card (short; the code carries the full address) */
export const LINK_TEXT = 'baylink.us/opus-bay';
/** game/qa.ts AT_RE: what `?at=` accepts */
const AT_OK = /^[a-z0-9:.,-]{1,80}$/i;
/** how far a photo looks for a named place to stand for its spot (world units ≈ m) */
export const SPOT_R = 60;

/** The game's address for a QR code or a share (`at` dropped when it is not a valid `?at=` value). */
export function gameLink(at: string | null | undefined, from: 'photo' | 'family'): string {
  // (`:` and `,` stay literal — legal in a query, and a shorter address is a smaller code)
  const spot = at && AT_OK.test(at) ? `at=${at}&` : '';
  return `${SITE_ORIGIN}/opus-bay?${spot}from=${from}`;
}

/** A kept photo's link back (game/album.ts AlbumMeta): its spot, else (older photos) where it was taken in whole units. */
export function photoLink(p: { spot?: string; x?: number; z?: number }): string {
  const xz = Number.isFinite(p.x) && Number.isFinite(p.z) ? `xz:${Math.round(p.x as number)},${Math.round(p.z as number)}` : null;
  return gameLink(p.spot ?? xz, 'photo');
}

export interface SpotPlace { id: string; landmark?: string; curated?: boolean; station?: boolean }

/** The `?at=` value for a photo taken at (x, z): a landmark first, then a curated place, nearest first; else xz. */
export function photoSpot(x: number, z: number, near: (x: number, z: number, r: number) => readonly SpotPlace[] = () => []): string {
  let list: readonly SpotPlace[];
  try { list = near(x, z, SPOT_R).filter(p => !p.station && AT_OK.test(p.id)); } catch { list = []; }
  const best = list.find(p => p.landmark) ?? list.find(p => p.curated);
  return best ? best.id : `xz:${Math.round(x)},${Math.round(z)}`;
}

export interface Box { x: number; y: number; size: number }
export interface BandLayout {
  pad: number;
  /** the band's height under the picture */
  band: number;
  /** the QR box (white, rounded) inside the band, on the right */
  qr: Box;
  /** the text column: left x, width, the caption's and the link line's middles (from the band's top) and sizes */
  textX: number;
  textW: number;
  captionY: number;
  linkY: number;
  captionSize: number;
  linkSize: number;
}

/**
 * The card for a w × h picture: the margin as before (2.8 % of the width, ≥ 18 px); the band at least 160 px, 13 % of
 * the height (phones) and 14 % of the width (wide screens), so the code keeps ≈ 3 px (≥ 2.85) a module at 1280 px; the QR box fills the band's
 * height less a margin that keeps it clear of a shop frame's ring (economy/frames.ts ringWidth ≤ 60 % of the margin).
 */
export function bandLayout(w: number, h: number): BandLayout {
  const pad = Math.round(Math.max(18, w * 0.028));
  const band = Math.round(Math.max(160, h * 0.13, w * 0.14));
  const m = Math.round(Math.max(pad * 0.7, band * 0.09));
  const size = band - 2 * m;
  const cardW = w + pad * 2;
  const qr = { x: cardW - pad - size, y: m, size };
  const textX = pad;
  const textW = Math.max(40, qr.x - pad - textX);
  return { pad, band, qr, textX, textW, captionY: Math.round(band * 0.4), linkY: Math.round(band * 0.7), captionSize: Math.round(band * 0.21), linkSize: Math.round(band * 0.12) };
}

/** A QR code's modules: `size` × `size`, row-major, 1 = dark. */
export interface QrMatrix { size: number; data: ArrayLike<number> }

type QrApi = { create: (text: string, o: { errorCorrectionLevel: string; margin?: number }) => { modules: { size: number; data: ArrayLike<number> } } };

/** The code for `text` (error correction M: a re-encoded JPEG still reads), or null when `qrcode` cannot load. */
export async function loadQr(text: string): Promise<QrMatrix | null> {
  try {
    const m = await importRetry(() => import('qrcode'));
    const api = ((m as unknown as QrApi).create ? m : (m as unknown as { default: QrApi }).default) as unknown as QrApi;
    const { modules } = api.create(text, { errorCorrectionLevel: 'M' });
    return { size: modules.size, data: modules.data };
  } catch { return null; }
}

/** The quiet zone round the code, in modules (the spec asks 4; the white box's own padding adds to it). */
export const QR_QUIET = 2;

/**
 * A white rounded box at `box` with the code centred in it (QR_QUIET modules of white round it). Module edges fall on
 * whole pixels (each module spans from round(start) to round(end)): no hairline gaps, and the code uses the whole box.
 * Returns the module size (px, fractional).
 */
export function drawQr(ctx: Pick<CanvasRenderingContext2D, 'fillStyle' | 'fillRect' | 'beginPath' | 'fill'> & { roundRect?: CanvasRenderingContext2D['roundRect'] }, qr: QrMatrix, box: Box, dark = '#1f3d36'): number {
  const r = Math.round(box.size * 0.08);
  ctx.fillStyle = '#ffffff';
  if (typeof ctx.roundRect === 'function') { ctx.beginPath(); ctx.roundRect(box.x, box.y, box.size, box.size, r); ctx.fill(); }
  else ctx.fillRect(box.x, box.y, box.size, box.size);
  const cell = box.size / (qr.size + QR_QUIET * 2);
  const ox = box.x + cell * QR_QUIET, oy = box.y + cell * QR_QUIET;
  const edge = (o: number, i: number) => Math.round(o + i * cell);
  ctx.fillStyle = dark;
  for (let row = 0; row < qr.size; row++) {
    const y0 = edge(oy, row), y1 = edge(oy, row + 1);
    for (let col = 0; col < qr.size; col++) {
      if (!qr.data[row * qr.size + col]) continue;
      const x0 = edge(ox, col);
      ctx.fillRect(x0, y0, edge(ox, col + 1) - x0, y1 - y0);
    }
  }
  return cell;
}
