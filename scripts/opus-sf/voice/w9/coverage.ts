/**
 * Lane X (W9-X2): BAYBAY's voice coverage — every fixed BAYBAY line (zh + en) and whether it has a clip.
 *
 *   npx tsx --tsconfig tsconfig.app.json scripts/opus-sf/voice/w9/coverage.ts [--json <file>] [--list]
 *
 * The lines, in two families:
 *   1. **Text-matched** (the bubbles the binder game/voiceW5.ts voices by exact zh + en): every line of the voice tables
 *      data/sf/voiceW5.ts … voiceW9.ts that the game still says verbatim (a literal somewhere in src/opus-bay), and every
 *      line the inventories find without a recording (scripts/opus-sf/voice/w9/lines.ts `fresh`). A recorded line whose
 *      words a lane changed is "dead" (its clip never matches again: the bubble went silent) — listed, not counted.
 *      A table line a lane plays by id (`own`) counts as recorded (its text is not matched).
 *   2. **By id** (the lanes play them with a `voice-line` event): the Grand Tour / loop narration (data/sf/voiceTour.ts,
 *      lane C's tourLines), the city lines (data/voiceLinesSf.ts SF_VOICE_LINES), wave 5's paced lines.
 *
 * A line is **voiced** when both languages have a clip and neither is muted (a CHECK list: the owner's ear), **muted** when
 * a clip exists but waits for the owner, **unvoiced** when there is none. Coverage = voiced / all lines.
 * Barks (zh-hi …) and the dialogue blips are not lines. The report's numbers: docs/opus-bay/sf-w9-X.md.
 */
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, TABLES, w9Lines } from './lines';

export interface LineRow { id: string; family: 'text' | 'id'; table: string; zh: string; en: string; status: 'voiced' | 'muted' | 'unvoiced'; source?: string }
export interface Coverage {
  lines: number; voiced: number; muted: number; unvoiced: number; pct: number;
  byFamily: Record<'text' | 'id', { lines: number; voiced: number; muted: number; unvoiced: number }>;
  rows: LineRow[];
  /** recorded lines the game no longer says verbatim (a lane reworded them: silent until re-recorded) */
  dead: { id: string; table: string; zh: string; en: string }[];
}

const load = async <T>(rel: string): Promise<T> => import(new URL(`file:///${path.join(ROOT, rel).replace(/\\/g, '/')}`).href) as Promise<T>;

/** every source file of the game but the generated text tables, one string (a recorded line must be said there) */
export function gameSources(): string {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (/\.tsx?$/.test(e.name) && !/[\\/]data[\\/]sf[\\/]voiceW\d\.ts$/.test(p)) out.push(fs.readFileSync(p, 'utf8'));
    }
  };
  walk(path.join(ROOT, 'src/opus-bay'));
  return out.join('\n');
}
/** said verbatim as a literal: as is, JSON-escaped, or with escaped apostrophes */
export const saidIn = (src: string) => (s: string) => [s, JSON.stringify(s).slice(1, -1), s.replace(/'/g, "\\'")].some(v => src.includes(v));

type TLine = { id: string; lane: string; zh: string; en: string; own?: 1 };

export async function coverage(): Promise<Coverage> {
  const src = gameSources();
  const said = saidIn(src);
  const rows: LineRow[] = [];
  const dead: Coverage['dead'] = [];
  const { ASSETS } = await load<{ ASSETS: { voice: Record<string, string> } }>('src/opus-bay/data/assets.ts');

  // --- 1. text-matched tables
  const muted = new Set<string>();
  const tables: { name: string; lines: readonly TLine[] }[] = [];
  const w5 = await load<{ W5_VOICE_LINES: readonly TLine[]; W5_VOICE_CHECK: readonly string[] }>('src/opus-bay/data/sf/voiceW5.ts');
  const w6 = await load<{ W6_VOICE_LINES: readonly TLine[]; W6_VOICE_CHECK: readonly string[] }>('src/opus-bay/data/sf/voiceW6.ts');
  const w7 = await load<{ W7_VOICE_LINES: readonly TLine[]; W7_VOICE_CHECK: readonly string[] }>('src/opus-bay/data/sf/voiceW7.ts');
  const w8 = await load<{ W8_VOICE_LINES: readonly TLine[]; W8_VOICE_CHECK: readonly string[]; W8_RETAKE_CLIPS: Record<string, unknown> }>('src/opus-bay/data/sf/voiceW8.ts');
  tables.push({ name: 'voiceW5', lines: w5.W5_VOICE_LINES }, { name: 'voiceW6', lines: w6.W6_VOICE_LINES }, { name: 'voiceW7', lines: w7.W7_VOICE_LINES }, { name: 'voiceW8', lines: w8.W8_VOICE_LINES });
  for (const c of [...w5.W5_VOICE_CHECK, ...w6.W6_VOICE_CHECK, ...w8.W8_VOICE_CHECK]) muted.add(c);
  for (const c of w7.W7_VOICE_CHECK) if (!(c in w8.W8_RETAKE_CLIPS)) muted.add(c);
  if (fs.existsSync(path.join(ROOT, 'src/opus-bay/data/sf/voiceW9.ts'))) {
    const w9 = await load<{ W9_VOICE_LINES: readonly TLine[]; W9_VOICE_CHECK: readonly string[] }>('src/opus-bay/data/sf/voiceW9.ts');
    tables.push({ name: 'voiceW9', lines: w9.W9_VOICE_LINES });
    for (const c of w9.W9_VOICE_CHECK) muted.add(c);
  }
  const seenText = new Set<string>();
  const key = (zh: string, en: string) => `${zh.trim()}\n${en.trim()}`;
  for (const t of tables) {
    for (const l of t.lines) {
      const k = key(l.zh, l.en);
      if (seenText.has(k)) continue; // an earlier recording of the same words wins (the binder's rule)
      if (!l.own && !(said(l.zh) && said(l.en))) { dead.push({ id: l.id, table: t.name, zh: l.zh, en: l.en }); continue; }
      seenText.add(k);
      const st = muted.has(`zh-${l.id}`) || muted.has(`en-${l.id}`) ? 'muted' : 'voiced';
      rows.push({ id: l.id, family: 'text', table: t.name, zh: l.zh, en: l.en, status: st });
    }
  }
  const { fresh } = await w9Lines();
  for (const l of fresh) {
    if (seenText.has(key(l.zh, l.en))) continue;
    seenText.add(key(l.zh, l.en));
    rows.push({ id: l.id, family: 'text', table: '—', zh: l.zh, en: l.en, status: 'unvoiced', source: l.source });
  }

  // --- 2. by id: the tour narration, the city lines, wave 5's paced lines (a clip registered in ASSETS.voice = recorded)
  const { MUTED_CLIPS } = await load<{ MUTED_CLIPS: ReadonlySet<string> }>('src/opus-bay/audio/voice.ts');
  const byIdStatus = (id: string) => {
    const has = ['zh', 'en'].map(lang => !!ASSETS.voice[`${lang}-${id}`]);
    if (!has[0] || !has[1]) return 'unvoiced' as const;
    return ['zh', 'en'].some(lang => MUTED_CLIPS.has(`${lang}-${id}`)) ? 'muted' as const : 'voiced' as const;
  };
  const tour = await load<{ TOUR_VOICE_CLIPS: Record<string, { text: string }> }>('src/opus-bay/data/sf/voiceTour.ts');
  const tourLines = await load<Record<string, unknown>>('src/opus-bay/data/sf/tourLines.ts');
  const tourTexts = new Map<string, { zh: string; en: string }>();
  for (const v of Object.values(tourLines)) {
    if (!v || typeof v !== 'object') continue;
    const add = (id: string, t: unknown) => { const b = t as { zh?: unknown; en?: unknown }; if (typeof b?.zh === 'string' && typeof b?.en === 'string') tourTexts.set(id, { zh: b.zh, en: b.en }); };
    if (Array.isArray(v)) for (const l of v) { const o = l as { id?: unknown; text?: unknown }; if (typeof o?.id === 'string') add(o.id, o.text ?? o); }
    else for (const [id, l] of Object.entries(v)) { const o = l as { id?: unknown; text?: unknown }; add(typeof o?.id === 'string' ? o.id : id, o?.text ?? o); }
  }
  const tourIds = new Set([...Object.keys(tour.TOUR_VOICE_CLIPS).map(c => c.slice(3)), ...tourTexts.keys()]);
  for (const id of tourIds) {
    const t = tourTexts.get(id) ?? { zh: tour.TOUR_VOICE_CLIPS[`zh-${id}`]?.text ?? '', en: tour.TOUR_VOICE_CLIPS[`en-${id}`]?.text ?? '' };
    rows.push({ id, family: 'id', table: 'voiceTour', zh: t.zh, en: t.en, status: byIdStatus(id) });
  }
  const sf = await load<{ SF_VOICE_LINES: Record<string, { zh: string; en: string }> }>('src/opus-bay/data/voiceLinesSf.ts');
  for (const [id, l] of Object.entries(sf.SF_VOICE_LINES)) rows.push({ id, family: 'id', table: 'voiceLinesSf', zh: l.zh, en: l.en, status: byIdStatus(id) });

  const count = (rs: LineRow[]) => ({ lines: rs.length, voiced: rs.filter(r => r.status === 'voiced').length, muted: rs.filter(r => r.status === 'muted').length, unvoiced: rs.filter(r => r.status === 'unvoiced').length });
  const all = count(rows);
  return { ...all, pct: all.lines ? Math.round((all.voiced / all.lines) * 1000) / 10 : 0, byFamily: { text: count(rows.filter(r => r.family === 'text')), id: count(rows.filter(r => r.family === 'id')) }, rows, dead };
}

export { TABLES };

const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1'));
if (isMain) {
  const c = await coverage();
  const arg = (k: string) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : undefined; };
  const json = arg('--json');
  if (json) fs.writeFileSync(json, JSON.stringify(c, null, 1) + '\n');
  if (process.argv.includes('--list')) for (const r of c.rows) if (r.status !== 'voiced') console.log(`${r.status.padEnd(8)} ${r.id.padEnd(30)} ${r.zh}  |  ${r.en}${r.source ? `  (${r.source})` : ''}`);
  for (const d of c.dead) console.log(`dead     ${d.id.padEnd(30)} ${d.zh}  (${d.table}: the game no longer says it verbatim)`);
  console.log(`BAYBAY fixed lines: ${c.lines} — voiced ${c.voiced} (${c.pct} %), muted ${c.muted} (the owner's ear), unvoiced ${c.unvoiced}; dead recordings ${c.dead.length}`);
  console.log(`  text-matched ${JSON.stringify(c.byFamily.text)} · by id ${JSON.stringify(c.byFamily.id)}`);
}
