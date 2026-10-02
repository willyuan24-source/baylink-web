/**
 * Lane X (W9-X2): wave 9's BAYBAY lines for the voice — every fixed bubble line the earlier inventories find
 * (scripts/opus-sf/voice/w8/lines.ts: waves 5–8's scans and tables) whose exact zh + en text no voice table has yet
 * (data/sf/voiceW5.ts … voiceW9.ts), plus wave 9's own new tables (W9_SOURCES, added as the lanes push them; the lanes
 * list their new or changed lines in C:/Users/willy/opus-qa/w9/new-lines.md), plus redo takes of wave 9's own muted clips.
 *
 *   npx tsx --tsconfig tsconfig.app.json scripts/opus-sf/voice/w9/lines.ts                      the inventory: every
 *        unrecorded line with its lane, id and source ("NEW") and what is left out and why
 *   npx tsx --tsconfig tsconfig.app.json scripts/opus-sf/voice/w9/lines.ts --takes <work>/takes.json [--batch <n>] [--start <i>] [--redo] [--only <id,id>]
 *        the take list: the NEW lines (zh + en, one take each at speech_rate 1.0; `--only`: just these line ids) and,
 *        with --redo, two faster takes of each clip in W9_VOICE_CHECK (post.py replaces the pick when one passes)
 *
 * A line keeps its lane's id or wave 5's text hash (`w5-<lane>-<8 hex>`); an id a table already holds for other words gets
 * `-w9`. Templated bubbles (a name, a number) are never literals, so they are never here: a fixed bubble + a toast / pin.
 */
import fs from 'node:fs';
import path from 'node:path';
import { isSentence, lineId, moodOf as moodW5 } from '../w5/lines';
import { BUBBLE_INSTRUCTION, MAX_INSTRUCTION, moodOf as moodW6 } from '../w6/lines';
import { PIXIE, requestsFor as requestsW8, w8Lines, type W8Line } from '../w8/lines';

export const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1')), '../../../..');

export { PIXIE };
export type W9Line = W8Line;

/** Single texts that are not bubbles (chip hints, titles, labels, a card's own words): zh text → why. */
export const EXCLUDE_W9: Record<string, string> = {};

/**
 * Wave 9's own new line tables: a file (relative to src/opus-bay) and the exported constants that hold BAYBAY's fixed
 * lines — a `{ key: { zh, en } }` record, an array of `{ id?, zh, en }`, or one `{ zh, en }`. `own`: the lane plays the
 * line itself with a `voice-line` event of `own(key)` (never matched by text). Without `only`, every `{ zh: '…', en: '…' }`
 * literal of the file that reads as a sentence (w5's rule), or just the `pick`ed zh texts.
 */
export interface W9Source {
  lane: string; file: string; only?: readonly string[]; pick?: readonly string[]; own?: (key: string) => string;
  /** an array of `{ id, zh, en }`: keep the lane's own ids */ ids?: true;
  /** the mood note for every line of the source (e.g. 'gentle' for Alcatraz) */ mood?: string;
}
export const W9_SOURCES: readonly W9Source[] = [
  // lane X (surgical, w8 W8I-WS-1): the today line BAYBAY says is fixed (the names / time on a toast)
  { lane: 'r', file: 'realsf/todayLine.ts', only: ['TODAY_EVENT_LINE', 'TODAY_SUNSET_LINE', 'TODAY_PLAIN_LINE'] },
  // (the pelican's fixed later line, game/pelicanFirst.ts PELICAN_LATER_LINE, is found by wave 5's scan of that file)
  // lane H (W9-H2): the big Halloween days' greeting (halloween/today.ts; the welcome back and a first visit's invitation)
  { lane: 'h', file: 'halloween/worldLines.ts', only: ['W9_WORLD_LINES'], ids: true },
  // lane N (W9-N): the stuck card's question, BAYBAY's dialogue node (the binder voices her nodes by text since W9-X6)
  // and (W9-N3) the Grand Tour's resume card on return, her dialogue node too
  { lane: 'n', file: 'game/tripRun.ts', pick: ['这段路被挡住了，我们怎么走？', '上次的一日游还没走完，接着走吗？'] },
  // (lane G's hide & seek crossing line, play/hideSeek.ts HIDE_LINES.crosswalk, is found by wave 5's scan of that file)
];

const textKey = (zh: string, en: string) => `${zh.trim()}\n${en.trim()}`;
export const TABLES = ['voiceW5.ts', 'voiceW6.ts', 'voiceW7.ts', 'voiceW8.ts', 'voiceW9.ts'] as const;

/** Every recorded text (zh + en) and id of the text tables (voiceW5 … voiceW9), read as text (the tables are generated). */
export function recorded(): { texts: Set<string>; ids: Set<string> } {
  const texts = new Set<string>(), ids = new Set<string>();
  for (const f of TABLES) {
    const file = path.join(ROOT, 'src/opus-bay/data/sf', f);
    if (!fs.existsSync(file)) continue;
    for (const m of fs.readFileSync(file, 'utf8').matchAll(/\{ id: "([^"]+)", lane: "[^"]*", zh: ("(?:[^"\\]|\\.)*"), en: ("(?:[^"\\]|\\.)*")/g)) {
      ids.add(m[1]);
      texts.add(textKey(JSON.parse(m[2]) as string, JSON.parse(m[3]) as string));
    }
  }
  return { texts, ids };
}

const load = async <T>(rel: string): Promise<T> => import(new URL(`file:///${path.join(ROOT, rel).replace(/\\/g, '/')}`).href) as Promise<T>;
type Bi = { zh: string; en: string; id?: string };
const isBi = (v: unknown): v is Bi => !!v && typeof v === 'object' && typeof (v as Bi).zh === 'string' && typeof (v as Bi).en === 'string';
const LIT = /\{\s*zh:\s*'((?:[^'\\]|\\.)*)'\s*,\s*en:\s*(?:'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)")\s*\}/g;
const unesc = (s: string) => s.replace(/\\(.)/g, '$1');

/** The lines of W9_SOURCES. */
async function w9Tables(): Promise<W9Line[]> {
  const out: W9Line[] = [];
  for (const s of W9_SOURCES) {
    const push = (zh: string, en: string, where: string, key?: string) => {
      if (!isSentence(zh, en)) return;
      const own = key && s.own ? s.own(key) : undefined;
      const id = own ?? (s.ids && key ? key : lineId(s.lane, zh, en));
      out.push({ id, lane: s.lane, zh, en, source: `${s.file} ${where}`, mood: s.mood ?? (s.ids ? moodW6(id, zh) : moodW5(zh)), ...(own ? { own: 1 as const } : {}) });
    };
    if (s.only) {
      const mod = await load<Record<string, unknown>>(`src/opus-bay/${s.file}`);
      for (const name of s.only) {
        const v = mod[name];
        if (isBi(v)) push(v.zh, v.en, name, name);
        else if (Array.isArray(v)) v.forEach((l, i) => { if (isBi(l)) push(l.zh, l.en, `${name}[${i}]`, l.id); });
        else if (v && typeof v === 'object') for (const [k, l] of Object.entries(v)) if (isBi(l)) push(l.zh, l.en, `${name}.${k}`, k);
        else throw new Error(`${s.file}: no export ${name}`);
      }
    } else {
      const text = fs.readFileSync(path.join(ROOT, 'src/opus-bay', s.file), 'utf8');
      const found = new Set<string>();
      for (const m of text.matchAll(LIT)) {
        const zh = unesc(m[1]);
        if (s.pick && !s.pick.includes(zh)) continue;
        found.add(zh);
        push(zh, unesc(m[2] ?? m[3]), 'literal');
      }
      for (const zh of s.pick ?? []) if (!found.has(zh)) console.warn(`W9_SOURCES: ${s.file} no longer says ${zh}`);
    }
  }
  return out;
}

/** The unrecorded lines (fresh), the ones left out and why, and how many lines the inventories hold in all. */
export async function w9Lines(): Promise<{ fresh: W9Line[]; excluded: (W9Line & { why: string })[]; all: number }> {
  const rec = recorded();
  const w8 = await w8Lines();
  const tables = await w9Tables();
  const out: W9Line[] = [], excluded: (W9Line & { why: string })[] = [...w8.excluded];
  const seen = new Set<string>();
  for (const l of [...w8.fresh, ...tables]) {
    const k = textKey(l.zh, l.en);
    if (rec.texts.has(k) || seen.has(k)) continue;
    seen.add(k);
    // a reworded line whose id a table holds for its old words (its wave-8 inventory id may carry `-w8`): `<id>-w9`
    const base = l.id.replace(/-w8$/, '');
    const line: W9Line = { ...l, id: rec.ids.has(l.id) || (base !== l.id && rec.ids.has(base)) ? `${base}-w9` : l.id };
    const why = EXCLUDE_W9[l.zh];
    if (why) excluded.push({ ...line, why }); else out.push(line);
  }
  return { fresh: out, excluded, all: w8.all + tables.length };
}

/** Wave 9's own muted clips (W9_VOICE_CHECK): two faster takes each, re-taken in place (takes.json `redo`). */
export async function redoLines(): Promise<W9Line[]> {
  const file = path.join(ROOT, 'src/opus-bay/data/sf/voiceW9.ts');
  if (!fs.existsSync(file)) return [];
  const { W9_VOICE_LINES, W9_VOICE_CHECK } = await load<{ W9_VOICE_LINES: readonly { id: string; lane: string; zh: string; en: string }[]; W9_VOICE_CHECK: readonly string[] }>('src/opus-bay/data/sf/voiceW9.ts');
  return W9_VOICE_CHECK.map(clip => {
    const lang = clip.slice(0, 2) as 'zh' | 'en', id = clip.slice(3);
    const l = W9_VOICE_LINES.find(x => x.id === id);
    if (!l) throw new Error(`redo ${clip}: no such wave-9 line`);
    return { id, lane: l.lane, zh: l.zh, en: l.en, source: 'redo (W9_VOICE_CHECK)', mood: 'quick', redo: lang };
  });
}

const MOOD_NOTE: Record<string, string> = {
  excited: 'Bright and playful.',
  happy: 'Happy and warm, relaxed.',
  ask: 'Curious and playful.',
  calm: 'Calm and warm.',
  secret: 'Sharing a fun local fact.',
  fortune: 'Playful.',
  gentle: 'Soft, gentle and respectful.',
  fact: 'Sharing a fun local fact.',
  quick: 'A quick, bright, snappy call.',
};

export interface Take { index: number; clip: string; line: string; lane: string; text: string; language: 'zh' | 'en'; instruction: string; speechRate: number }

export function takesFor(lines: readonly W9Line[], start = 0, redoRates: readonly number[] = [1.1, 1.2]): Take[] {
  const takes: Take[] = [];
  for (const l of lines) {
    const instruction = `${BUBBLE_INSTRUCTION} ${MOOD_NOTE[l.mood] ?? MOOD_NOTE.happy}`;
    if (instruction.length > MAX_INSTRUCTION) throw new Error(`instruction too long for ${l.id}`);
    if (l.redo) {
      for (const rate of redoRates) takes.push({ index: start + takes.length, clip: `${l.redo}-${l.id}`, line: l.id, lane: l.lane, text: l[l.redo], language: l.redo, instruction, speechRate: rate });
      continue;
    }
    for (const language of ['zh', 'en'] as const) takes.push({ index: start + takes.length, clip: `${language}-${l.id}`, line: l.id, lane: l.lane, text: l[language], language, instruction, speechRate: 1.0 });
  }
  return takes;
}

/** The generate_audio_batch requests for a take list, in groups of 12 (one file per group): wave 8's, unchanged. */
export const requestsFor = requestsW8;

const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1'));
if (isMain) {
  const { fresh, excluded, all } = await w9Lines();
  const arg = (k: string) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : undefined; };
  const out = arg('--takes');
  if (out) {
    const only = arg('--only')?.split(',');
    const picked = only ? fresh.filter(l => only.includes(l.id)) : fresh;
    const redo = process.argv.includes('--redo') ? await redoLines() : [];
    const lines = [...picked, ...redo];
    const takes = takesFor(lines, Number(arg('--start') ?? 0));
    fs.writeFileSync(out, JSON.stringify({ voice: PIXIE, batch: Number(arg('--batch') ?? 1), redo: redo.map(l => `${l.redo}-${l.id}`), lines, takes }, null, 1) + '\n');
    requestsFor(takes as never).forEach((g, i) => fs.writeFileSync(out.replace(/\.json$/, `-req-${String(i).padStart(2, '0')}.json`), JSON.stringify(g) + '\n'));
    console.log(`${picked.length} new lines + ${redo.length} redos, ${takes.length} takes → ${out}`);
  } else {
    for (const l of fresh) console.log(`NEW  ${l.id.padEnd(26)} ${l.zh}  |  ${l.en}  (${l.source})${l.own ? ' own' : ''}`);
    for (const l of excluded) console.log(`out  ${l.id.padEnd(26)} ${l.zh}  (${l.why})`);
    console.log(`${all} lines in the inventories; ${fresh.length} without a voice, ${excluded.length} left out`);
  }
}
