import { readFile } from 'node:fs/promises';
import { availableParallelism } from 'node:os';
import { Worker } from 'node:worker_threads';
import { create as createFont } from 'fontkit';
import { CARD_INK, type TextDrawer } from '../src/lib/share-card-svg';

/**
 * Text → glyph outlines from the bundled Noto Sans SC (both weights), shared by the share cards and the weekly cards.
 * Each card gets a drawer and a `finish` that adds the card's glyphs once as <defs>; every run is a scaled group of
 * <use> references, so a card's SVG stays small and resvg needs no font at all.
 */
export async function createGlyphOutliner() {
  const fonts = await Promise.all(['Regular', 'Bold'].map(async weight => createFont(await readFile(`scripts/fonts/NotoSansSC-${weight}.ttf`))));
  const outlines = new Map<string, string>();
  return () => {
    const defs = new Map<string, string>();
    const draw: TextDrawer = ({ text, x, y, size, weight = 400, fill, spacing = 0 }) => {
      const bold = weight >= 600 ? 1 : 0;
      const font = fonts[bold];
      const scale = size / font.unitsPerEm;
      const run = font.layout(text);
      let advance = 0;
      const uses: string[] = [];
      run.glyphs.forEach((glyph, index) => {
        const id = `g${bold}-${glyph.id}`;
        let outline = outlines.get(id);
        if (outline === undefined) { outline = glyph.path.toSVG(); outlines.set(id, outline); }
        if (outline && !defs.has(id)) defs.set(id, outline);
        const position = run.positions[index];
        if (outline) uses.push(`<use href="#${id}" x="${Math.round(advance + position.xOffset)}" y="${position.yOffset}"/>`);
        advance += position.xAdvance + spacing / scale;
      });
      return `<g fill="${fill}" transform="translate(${x},${y}) scale(${scale.toFixed(5)},${(-scale).toFixed(5)})">${uses.join('')}</g>`;
    };
    const finish = (svg: string) => svg.replace(/<svg\b[^>]*>/, open => `${open}<defs>${[...defs].map(([id, d]) => `<path id="${id}" d="${d}"/>`).join('')}</defs>`);
    return { draw, finish };
  };
}

type Job = { svg: string; out: string };
/** At most this many rasterizing workers (as before): a shared build machine keeps cores for the rest. */
export const MAX_RASTER_WORKERS = 4;
/**
 * How many rasterizing workers: SHARE_CARD_WORKERS when set (a whole number ≥ 1), else one per core, at most
 * MAX_RASTER_WORKERS. The main thread only lays the cards out (~9 s for 3,348 cards on a Mac against minutes of
 * rasterizing) and mostly waits, so the old "cores − 1" left half of a two-core build machine idle — Vercel's is
 * taken to have two (not measured; the generator's log line now prints the core count) (HOTFIX-BUILD-TIME, 10-22:
 * the build passed Vercel's 45-minute limit).
 */
export function rasterWorkerCount(env: Record<string, string | undefined> = process.env, cores = availableParallelism()) {
  const forced = Number(env.SHARE_CARD_WORKERS);
  if (Number.isInteger(forced) && forced >= 1) return forced;
  return Math.max(1, Math.min(MAX_RASTER_WORKERS, cores));
}
/**
 * A pool of rasterizing workers (scripts/share-card-worker.mjs): the PNG work runs in parallel with the layout.
 * Every card is drawn on the paper token, and the worker keeps that paper exact through the palette (cardPng).
 */
export function createRasterPool(size = rasterWorkerCount()) {
  const workers = Array.from({ length: size }, () => new Worker(new URL('./share-card-worker.mjs', import.meta.url)));
  const idle = [...workers];
  const waiting: (() => void)[] = [];
  const pending = new Map<number, { resolve: (bytes: number) => void; reject: (error: Error) => void; worker: Worker }>();
  let next = 0;
  for (const worker of workers) worker.on('message', ({ id, bytes, error }: { id: number; bytes?: number; error?: string }) => {
    const job = pending.get(id)!;
    pending.delete(id);
    idle.push(job.worker);
    waiting.shift()?.();
    if (error) job.reject(new Error(error)); else job.resolve(bytes!);
  });
  const run = async (job: Job): Promise<number> => {
    while (!idle.length) await new Promise<void>(resolve => waiting.push(resolve));
    const worker = idle.pop()!;
    const id = next++;
    return new Promise((resolve, reject) => { pending.set(id, { resolve, reject, worker }); worker.postMessage({ id, paper: CARD_INK.paper, ...job }); });
  };
  const close = () => Promise.all(workers.map(worker => worker.terminate()));
  return { run, close, size };
}
