/**
 * Lane X (W8-X1): wave 8's BAYBAY lines for the voice — every fixed bubble line the earlier inventories find
 * (scripts/opus-sf/voice/w7/lines.ts: waves 5–7's scans of play/, eggs/, economy/, lanes G / H's Halloween tables, lane
 * S's own lines) whose exact zh + en text no voice table has yet (data/sf/voiceW5.ts … voiceW8.ts), wave 8's own new
 * tables (W8_SOURCES, added as the lanes push them), and the retakes of wave 7's muted clips.
 *
 *   npx tsx --tsconfig tsconfig.app.json scripts/opus-sf/voice/w8/lines.ts                      the inventory: every
 *        unrecorded line with its lane, id and source ("NEW"), what is left out and why, the retakes
 *   npx tsx --tsconfig tsconfig.app.json scripts/opus-sf/voice/w8/lines.ts --takes <work>/takes.json [--batch <n>] [--start <i>] [--retakes]
 *        the take list: the NEW lines (zh + en, one take each at speech_rate 1.0) and, with --retakes, two faster takes of
 *        each clip in RETAKES_W8 (post.py keeps a retake only when it passes every gate and the recogniser hears it right)
 *
 * A line keeps its lane's id or wave 5's text hash (`w5-<lane>-<8 hex>`); an id a table already holds for other words gets
 * `-w8`. Templated bubbles (a name, a number) are never literals, so they are never here: split a fixed bubble from the
 * number (sf-w8-lead.md §4).
 */
import fs from 'node:fs';
import path from 'node:path';
import { isSentence, lineId, moodOf as moodW5 } from '../w5/lines';
import { BUBBLE_INSTRUCTION, MAX_INSTRUCTION } from '../w6/lines';
import { PIXIE, w7Lines, type W7Line } from '../w7/lines';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1')), '../../../..');

export { PIXIE };
export type W8Line = W7Line;

/** Sources whose literals are not BAYBAY's bubbles: source prefix → why. */
export const EXCLUDE_SOURCES_W8: Record<string, string> = {
  // lane M (W7): the fortune teller's card (FortunePanel.tsx shows `luck` + `fact` on a printed card; nobody says it)
  'play/fortune.ts': 'the fortune card (paper, play/FortunePanel.tsx)',
};

/** Single texts that are not bubbles (chip hints, titles, labels): zh text → why. */
export const EXCLUDE_W8: Record<string, string> = {};

/**
 * Wave 8's own new line tables (fetched from origin at ≈ 23:15 and ≈ 00:15): a file (relative to src/opus-bay) and the
 * exported constants that hold BAYBAY's fixed lines — a `{ key: { zh, en } }` record, an array of `{ id?, zh, en }`, or
 * one `{ zh, en }`. `own`: the lane plays the line itself with a `voice-line` event of `idOf(key)` (never matched by
 * text). Without `only`, every `{ zh: '…', en: '…' }` literal of the file that reads as a sentence (w5's rule).
 */
export interface W8Source { lane: string; file: string; only?: readonly string[]; /** only the literals with these zh texts */ pick?: readonly string[]; own?: (key: string) => string }
export const W8_SOURCES: readonly W8Source[] = [
  // part a: plain BAYBAY bubbles (bubble() / offerLine() with a literal) no inventory scanned — lane K's game/ files
  { lane: 'k', file: 'game/tripRun.ts', pick: ['这条线今天没开，我们走过去吧！', '提前下车啦，我们走过去！', '就在这儿降落啦，我们走过去！', '有车来，我们先让一让～', '这段路有点难走，你来带路吧！'] },
  { lane: 'k', file: 'game/transit.ts', pick: ['坐过一站再下车，才算坐过哦', '坐到下一站再下车，才算坐过 F 线电车哦'] },
  { lane: 'k', file: 'game/flow.ts', pick: ['当——当——当！', '嗯～好吃！', '差一点！再来一竿，这次一定行～', '还没咬钩，再等等～'] },
  { lane: 'k', file: 'game/lineRides.ts', pick: ['上车啦！上层前排视野最好，每一站我都给你讲', '叮当车在等我们让路呢，往路边站一站吧', '电车在等我们让路呢，往路边站一站吧', '观光巴士在等我们让路呢，往路边站一站吧', '轻轨在等我们让路呢，往路边站一站吧'] },
  { lane: 'k', file: 'game/cityTour.ts', pick: ['拍得真好！这张可以当明信片了。', '这段地铁比较长，想快点可以点「直接到站」。'] },
];

const textKey = (zh: string, en: string) => `${zh.trim()}\n${en.trim()}`;

/** Every recorded text (zh + en) and id of the four tables, read as text (the tables are generated). */
function recorded(): { texts: Set<string>; ids: Set<string> } {
  const texts = new Set<string>(), ids = new Set<string>();
  for (const f of ['voiceW5.ts', 'voiceW6.ts', 'voiceW7.ts', 'voiceW8.ts']) {
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

/** The lines of W8_SOURCES. */
async function w8Tables(): Promise<W8Line[]> {
  const out: W8Line[] = [];
  for (const s of W8_SOURCES) {
    const push = (zh: string, en: string, where: string, key?: string) => {
      if (!isSentence(zh, en)) return;
      const own = key && s.own ? s.own(key) : undefined;
      out.push({ id: own ?? lineId(s.lane, zh, en), lane: s.lane, zh, en, source: `${s.file} ${where}`, mood: moodW5(zh), ...(own ? { own: 1 as const } : {}) });
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
      // a picked line whose words changed is reported, not silently dropped
      for (const zh of s.pick ?? []) if (!found.has(zh)) console.warn(`W8_SOURCES: ${s.file} no longer says ${zh}`);
    }
  }
  return out;
}

export async function w8Lines(): Promise<{ fresh: W8Line[]; excluded: (W8Line & { why: string })[]; all: number }> {
  const rec = recorded();
  const out: W8Line[] = [], excluded: (W8Line & { why: string })[] = [];
  const seen = new Set<string>();
  const w7 = await w7Lines();
  const all = [...w7.fresh, ...await w8Tables()];
  for (const l of all) {
    const k = textKey(l.zh, l.en);
    if (rec.texts.has(k) || seen.has(k)) continue;
    seen.add(k);
    const line: W8Line = { ...l, id: rec.ids.has(l.id) ? `${l.id}-w8` : l.id };
    const why = EXCLUDE_W8[l.zh] ?? Object.entries(EXCLUDE_SOURCES_W8).find(([src]) => l.source.startsWith(src))?.[1];
    if (why) excluded.push({ ...line, why }); else out.push(line);
  }
  return { fresh: out, excluded, all: w7.all + all.length - w7.fresh.length };
}

/**
 * Wave 7's muted clips (W7_VOICE_CHECK: short calls read too slowly for the rate gate). Two faster takes each; post.py
 * keeps a retake only if it passes every gate and the recogniser hears it right — it then plays under the wave-7 clip id
 * (data/sf/voiceW8.ts W8_RETAKE_CLIPS, registered first) and is no longer muted.
 */
export const RETAKES_W8: readonly { clip: string; why: string }[] = [
  { clip: 'zh-w5-a-5d9dcf9c', why: 'rate 2.20 < 2.4' },
  { clip: 'zh-w5-a-6807a93e', why: 'rate 2.37 < 2.4' },
  { clip: 'zh-w5-a-b95c4fe2', why: 'rate 2.38 < 2.4' },
  { clip: 'en-w5-a-b95c4fe2', why: 'rate 1.32 < 1.4, not heard' },
  { clip: 'en-w5-a-0b992197', why: 'rate 1.27 < 1.4' },
  { clip: 'zh-w5-a-420d6131', why: 'rate 2.33 < 2.4' },
  { clip: 'zh-w5-a-6c4f2c8f', why: 'rate 2.33 < 2.4' },
  { clip: 'en-w5-a-9a2d1075', why: 'rate 1.28 < 1.4 (batch 2)' },
];

/** The wave-7 lines behind RETAKES_W8 (their recorded text, from voiceW7.ts). */
export async function retakeLines(): Promise<W8Line[]> {
  const { W7_VOICE_LINES } = await load<{ W7_VOICE_LINES: readonly { id: string; lane: string; zh: string; en: string }[] }>('src/opus-bay/data/sf/voiceW7.ts');
  return RETAKES_W8.map(r => {
    const lang = r.clip.slice(0, 2) as 'zh' | 'en', id = r.clip.slice(3);
    const l = W7_VOICE_LINES.find(x => x.id === id);
    if (!l) throw new Error(`retake ${r.clip}: no such wave-7 line`);
    return { id, lane: l.lane, zh: l.zh, en: l.en, source: `retake (${r.why})`, mood: 'quick', retake: lang };
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

export interface Take { index: number; clip: string; line: string; lane: string; text: string; language: 'zh' | 'en'; instruction: string; speechRate: number; retake?: 1 }

export function takesFor(lines: readonly W8Line[], start = 0, retakeRates: readonly number[] = [1.15, 1.3]): Take[] {
  const takes: Take[] = [];
  for (const l of lines) {
    const instruction = `${BUBBLE_INSTRUCTION} ${MOOD_NOTE[l.mood] ?? MOOD_NOTE.happy}`;
    if (instruction.length > MAX_INSTRUCTION) throw new Error(`instruction too long for ${l.id}`);
    if (l.retake) {
      for (const rate of retakeRates) takes.push({ index: start + takes.length, clip: `${l.retake}-${l.id}`, line: l.id, lane: l.lane, text: l[l.retake], language: l.retake, instruction, speechRate: rate, retake: 1 });
      continue;
    }
    for (const language of ['zh', 'en'] as const) takes.push({ index: start + takes.length, clip: `${language}-${l.id}`, line: l.id, lane: l.lane, text: l[language], language, instruction, speechRate: 1.0 });
  }
  return takes;
}

/** The generate_audio_batch requests for a take list, in groups of 12 (one file per group). */
export function requestsFor(takes: readonly Take[]): { index: number; params: Record<string, unknown> }[][] {
  const groups: { index: number; params: Record<string, unknown> }[][] = [];
  takes.forEach((t, i) => {
    if (i % 12 === 0) groups.push([]);
    groups[groups.length - 1].push({ index: t.index, params: { model: 'qwen_audio_tts', prompt: t.text, voice_type: 'preset', voice_id: PIXIE, instruction: t.instruction, language: t.language, format: 'wav', sample_rate: 48000, speech_rate: t.speechRate } });
  });
  return groups;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1'));
if (isMain) {
  const { fresh, excluded, all } = await w8Lines();
  const arg = (k: string) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : undefined; };
  const out = arg('--takes');
  if (out) {
    const re = process.argv.includes('--retakes') ? await retakeLines() : [];
    const lines = [...fresh, ...re];
    const takes = takesFor(lines, Number(arg('--start') ?? 0));
    fs.writeFileSync(out, JSON.stringify({ voice: PIXIE, batch: Number(arg('--batch') ?? 1), lines, takes }, null, 1) + '\n');
    requestsFor(takes).forEach((g, i) => fs.writeFileSync(out.replace(/\.json$/, `-req-${String(i).padStart(2, '0')}.json`), JSON.stringify(g) + '\n'));
    console.log(`${fresh.length} new lines + ${re.length} retakes, ${takes.length} takes → ${out}`);
  } else {
    for (const l of fresh) console.log(`NEW  ${l.id.padEnd(26)} ${l.zh}  |  ${l.en}  (${l.source})${l.own ? ' own' : ''}`);
    for (const l of excluded) console.log(`out  ${l.id.padEnd(26)} ${l.zh}  (${l.why})`);
    for (const r of RETAKES_W8) console.log(`RETAKE ${r.clip} (${r.why})`);
    console.log(`${all} lines in the inventories; ${fresh.length} without a voice, ${excluded.length} left out, ${RETAKES_W8.length} retakes`);
  }
}
