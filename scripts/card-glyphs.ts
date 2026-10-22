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
/**
 * A small pool of rasterizing workers (scripts/share-card-worker.mjs): the PNG work runs in parallel with the layout.
 * Every card is drawn on the paper token, and the worker keeps that paper exact through the palette (cardPng).
 */
export function createRasterPool(size = Math.max(1, Math.min(4, availableParallelism() - 1))) {
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
