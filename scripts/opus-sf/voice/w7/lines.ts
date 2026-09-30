/**
 * Lane X (W7-X2): wave 7's BAYBAY lines for the voice — every fixed bubble line the wave-5 / wave-6 inventories find
 * (scripts/opus-sf/voice/w5/lines.ts scans play/, eggs/, economy/ and lane C's tables; w6/lines.ts reads the Halloween
 * tables of lanes G and H) whose exact zh + en text no voice table has yet (data/sf/voiceW5.ts, voiceW6.ts, voiceW7.ts),
 * plus wave 7's retakes of wave-6 clips.
 *
 *   npx tsx --tsconfig tsconfig.app.json scripts/opus-sf/voice/w7/lines.ts                      the inventory: every
 *        unrecorded line with its lane, id and source ("NEW"), the chip hints left out, the retakes
 *   npx tsx --tsconfig tsconfig.app.json scripts/opus-sf/voice/w7/lines.ts --takes <work>/takes.json [--batch <n>] [--start <i>]
 *        the take list: the NEW lines (zh + en, one take each at speech_rate 1.0) and, with --retakes, two takes of each
 *        clip in RETAKES (post.py keeps a retake only when the recogniser hears it right)
 *
 * Wave 7's own new lines (lanes G, H, W2, S) join the same way: G / H through w6Lines() (their tables), W2's activities
 * through w5Lines() (it scans play/). A line keeps its lane's id (`w6g-*`, `w6-h-*`) or wave 5's text hash
 * (`w5-<lane>-<8 hex>`); an id a table already holds for other words gets `-w7`. Templated bubbles (a name, a number)
 * are never literals, so they are never here: split a fixed bubble from the number (sf-w7-lead.md §4).
 */
import fs from 'node:fs';
import path from 'node:path';
import { PIXIE as W5_PIXIE, moodOf as moodW5, w5Lines } from '../w5/lines';
import { BUBBLE_INSTRUCTION, MAX_INSTRUCTION, moodOf as moodW6, w6Lines } from '../w6/lines';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1')), '../../../..');

export const PIXIE = W5_PIXIE;
export interface W7Line { id: string; lane: string; zh: string; en: string; source: string; mood: string; /** a retake of this wave-6 / wave-5 clip language only */ retake?: 'zh' | 'en'; /** the lane plays it itself (a `voice-line` event with this id): the binder never matches its text */ own?: 1 }

/** Chip hints (the activity chip's line, not a BAYBAY bubble): zh text → why. */
export const EXCLUDE_W7: Record<string, string> = {
  '影子变金色时点它，或按 E': 'the ball chip (play/ball.ts)',
  '点地面扔过去，或按 E': 'the frisbee chip (play/frisbee.ts)',
  '点海狮，或按 E': 'the sea-lion chip (play/sealions.ts)',
  // lane W2's 放风筝 chip and the quiz's title (sf-w7-W2.md: "the chip's words are not spoken")
  '起风时按住「放线」，松手爬高': 'the kite chip (play/kiteLines.ts)',
  '起风时按住空格放线，松手爬高': 'the kite chip (play/kiteLines.ts)',
  '起风了！放线！': 'the kite chip (play/kiteLines.ts)',
  '风小了，松手让它爬': 'the kite chip (play/kiteLines.ts)',
  '在往下栽！松手！': 'the kite chip (play/kiteLines.ts)',
  '那是什么？': 'the quiz title SKYLINE_NAME (play/skylineLines.ts)',
};

/**
 * Wave-6 clips the recogniser missed (7) or heard with low confidence (< 0.7, 4) — the day-0 scout's list. Two new
 * takes each; post.py keeps a retake only if the recogniser hears it right, else the wave-6 clip stays.
 */
export const RETAKES: readonly { clip: string; why: string }[] = [
  { clip: 'zh-w6g-street-fair-oaks', why: 'missed' },
  { clip: 'zh-w6g-costume-cat', why: 'missed' },
  { clip: 'zh-w6-h-hunt-sniff', why: 'missed' },
  { clip: 'zh-w6-h-hunt-all', why: 'missed' },
  { clip: 'en-w6g-knock', why: 'missed' },
  { clip: 'en-w6g-costume-pumpkin', why: 'missed' },
  { clip: 'en-w6-h-hunt-sniff', why: 'missed' },
  { clip: 'zh-w6g-street-chenery', why: 'low 0.63' },
  { clip: 'zh-w6g-street-hearst', why: 'low 0.69' },
  { clip: 'zh-w6-h-season-hello', why: 'low 0.54' },
  { clip: 'en-w6-h-hunt-20', why: 'low 0.62' },
];

const textKey = (zh: string, en: string) => `${zh.trim()}\n${en.trim()}`;

/** Every recorded text (zh + en) and id of the three tables, read as text (the tables are generated). */
function recorded(): { texts: Set<string>; ids: Set<string> } {
  const texts = new Set<string>(), ids = new Set<string>();
  for (const f of ['voiceW5.ts', 'voiceW6.ts', 'voiceW7.ts']) {
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

/**
 * Wave 7's own tables: lane G (halloween/lines.ts W7_HALLOWEEN_LINES), lane H (halloween/worldLines.ts W7_WORLD_LINES),
 * lane S's fixed lines it voices itself (realsf/index.ts emits `voice-line` `realsf-<key>` with the bubble: `own`).
 * Lanes W2 and M add play/ files: w5Lines() scans them.
 */
async function w7Tables(): Promise<(W7Line & { voiceId?: string })[]> {
  const out: (W7Line & { voiceId?: string })[] = [];
  const G = await load<{ W7_HALLOWEEN_LINES?: readonly { id: string; zh: string; en: string }[] }>('src/opus-bay/halloween/lines.ts');
  for (const l of G.W7_HALLOWEEN_LINES ?? []) out.push({ id: l.id, lane: 'g', zh: l.zh, en: l.en, source: `halloween/lines.ts ${l.id}`, mood: moodW6(l.id, l.zh) });
  const H = await load<{ W7_WORLD_LINES?: readonly { id: string; zh: string; en: string }[] }>('src/opus-bay/halloween/worldLines.ts');
  for (const l of H.W7_WORLD_LINES ?? []) out.push({ id: l.id, lane: 'h', zh: l.zh, en: l.en, source: `halloween/worldLines.ts ${l.id}`, mood: moodW6(l.id, l.zh) });
  // lane S (sf-w7-S.md "New fixed BAYBAY lines for lane X"): the calendar rows' lines and the Blue Angels line
  // (calendarLines keys a row's line `calendar-<id>`; only rows said as a bubble: a line, a time, no dressing)
  const C = await load<{ CALENDAR?: readonly { id: string; line?: { zh: string; en: string }; lineAt?: unknown; dress?: unknown }[] }>('src/opus-bay/realsf/calendar.ts');
  for (const r of C.CALENDAR ?? []) {
    if (!r.line || !r.lineAt || r.dress) continue;
    out.push({ id: `realsf-calendar-${r.id}`, lane: 's', zh: r.line.zh, en: r.line.en, source: `realsf/calendar.ts ${r.id}`, mood: 'happy', own: 1 });
  }
  const J = await load<{ JETS_BLUE_LINE?: { zh: string; en: string } }>('src/opus-bay/realsf/jets.ts');
  if (J.JETS_BLUE_LINE) out.push({ id: 'realsf-jets-blue', lane: 's', zh: J.JETS_BLUE_LINE.zh, en: J.JETS_BLUE_LINE.en, source: 'realsf/jets.ts JETS_BLUE_LINE', mood: 'secret', own: 1 });
  return out;
}

export async function w7Lines(): Promise<{ fresh: W7Line[]; excluded: W7Line[]; all: number }> {
  const rec = recorded();
  const out: W7Line[] = [], excluded: W7Line[] = [];
  const seen = new Set<string>();
  const w5 = await w5Lines();
  const w6 = await w6Lines();
  const all = [...w5.filter(l => !l.voiceId && !l.paced).map(l => ({ ...l, mood: moodW5(l.zh) })), ...w6.map(l => ({ ...l, mood: moodW6(l.id, l.zh) })), ...await w7Tables()];
  for (const l of all) {
    const k = textKey(l.zh, l.en);
    if (rec.texts.has(k) || seen.has(k)) continue;
    seen.add(k);
    const line: W7Line = { id: rec.ids.has(l.id) ? `${l.id}-w7` : l.id, lane: l.lane, zh: l.zh, en: l.en, source: l.source, mood: l.mood, ...('own' in l && l.own ? { own: 1 as const } : {}) };
    if (EXCLUDE_W7[l.zh]) excluded.push(line); else out.push(line);
  }
  return { fresh: out, excluded, all: all.length };
}

/** The wave-6 lines behind RETAKES (their recorded text, from voiceW6.ts). */
export async function retakeLines(): Promise<W7Line[]> {
  const w6 = await w6Lines();
  return RETAKES.map(r => {
    const lang = r.clip.slice(0, 2) as 'zh' | 'en', id = r.clip.slice(3);
    const l = w6.find(x => x.id === id);
    if (!l) throw new Error(`retake ${r.clip}: no such wave-6 line`);
    return { id, lane: l.lane, zh: l.zh, en: l.en, source: `retake (${r.why}) ${l.source}`, mood: moodW6(l.id, l.zh), retake: lang };
  });
}

const MOOD_NOTE: Record<string, string> = {
  excited: 'Bright and playful.',
  happy: 'Happy and warm, relaxed.',
  ask: 'Curious and playful.',
  calm: 'Calm and warm.',
  secret: 'Sharing a fun local fact.',
  gentle: 'Soft, gentle and respectful.',
  fact: 'Sharing a fun local fact.',
};

export interface Take { index: number; clip: string; line: string; lane: string; text: string; language: 'zh' | 'en'; instruction: string; speechRate: number; retake?: 1 }

export function takesFor(lines: readonly W7Line[], start = 0, retakeRates: readonly number[] = [1.0, 1.1]): Take[] {
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

const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1'));
if (isMain) {
  const { fresh, excluded, all } = await w7Lines();
  const arg = (k: string) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : undefined; };
  const out = arg('--takes');
  if (out) {
    const re = process.argv.includes('--retakes') ? await retakeLines() : [];
    const lines = [...fresh, ...re];
    const takes = takesFor(lines, Number(arg('--start') ?? 0));
    fs.writeFileSync(out, JSON.stringify({ voice: PIXIE, batch: Number(arg('--batch') ?? 1), lines, takes }, null, 1) + '\n');
    console.log(`${fresh.length} new lines + ${re.length} retakes, ${takes.length} takes → ${out}`);
  } else {
    for (const l of fresh) console.log(`NEW  ${l.id.padEnd(26)} ${l.zh}  |  ${l.en}  (${l.source})`);
    for (const l of excluded) console.log(`out  ${l.id.padEnd(26)} ${l.zh}  (${EXCLUDE_W7[l.zh]})`);
    for (const r of RETAKES) console.log(`RETAKE ${r.clip} (${r.why})`);
    console.log(`${all} lines in the inventories; ${fresh.length} without a voice, ${excluded.length} chip hints left out, ${RETAKES.length} retakes`);
  }
}
