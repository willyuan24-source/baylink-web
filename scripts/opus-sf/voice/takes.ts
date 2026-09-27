/**
 * Lane H2b (H2b-6/7): the TTS take list for BAYBAY's city lines and the three district re-records.
 *
 *   npx tsx --tsconfig tsconfig.app.json scripts/opus-sf/voice/takes.ts > <scratch>/takes.json
 *
 * One take = one qwen_audio_tts job (preset "Pixie", wav 48 kHz): the line text, the language hint, the shipped
 * instruction plus a mood, and a seed. 3 seeds per clip; the re-records get 2 phrasings × 3 seeds, because the first
 * recordings were mis-heard (zh-yay as 讨厌, zh-arrived as 到了, zh-think not understood). The job ids go back into
 * this list by hand (docs/opus-bay/h2b/voice-takes.json) and scripts/opus-sf/voice/voice_post.py picks from it.
 */
import { SF_VOICE_LINES } from '../../../src/opus-bay/data/voiceLinesSf';

export const PIXIE = '0178ef57-ada4-43d9-992b-8d9221045bb4';
export const SEEDS = [11, 22, 33];
/** the instruction of the shipped district barks (ASSETS-LEDGER V1) */
export const BASE_INSTRUCTION = 'Cute otter mascot: warm, cheerful, bright but not shrill; snappy playful delivery.';

/** the service caps an instruction at 128 characters: the base (82) + one note of ≤ 45 */
export const MAX_INSTRUCTION = 128;
const MOOD_NOTE: Record<string, string> = {
  excited: 'Excited and delighted, one quick bright line.',
  happy: 'Happy and warm, relaxed.',
  wave: 'A friendly, happy hello, like a little wave.',
  proud: 'Proud and happy, a bit out of breath.',
};
/** a line's own note replaces its mood note */
const LINE_NOTE: Record<string, string> = {
  'first-hill': 'A bit out of breath, then amused.',
};

export interface Take {
  index: number;
  clip: string;
  text: string;
  language: 'zh' | 'en';
  instruction: string;
  seed: number;
  /** round 2 only: the service's speech_rate (1 = default) */
  speechRate?: number;
}

/**
 * Round 2 (after the first measurements): the service often ignores the seed (identical files for 11 / 22 / 33), and
 * many English lines ran past 2 s. Clips with fewer than two distinct takes that pass, or whose pick the recognizer did
 * not hear right, get three more takes at speech_rate 1.1 / 1.2 / 1.3 (distinct by construction); the re-records also
 * get other phrasings that keep the word ("好耶好耶！", "我们到啦！", "嗯，让我想想。").
 */
export const ROUND2_RATES = [1.1, 1.2, 1.3];
export const ROUND2_CLIPS = [
  'en-first-car', 'en-first-cable-car', 'en-first-ferry', 'zh-first-glide', 'zh-first-hill', 'en-first-hill', 'zh-first-crest',
  'en-zone-north-beach', 'en-zone-mission', 'en-zone-castro-upper-market', 'en-zone-marina', 'en-zone-twin-peaks',
  'en-zone-golden-gate-park', 'en-zone-sunset-parkside',
];
export const ROUND2_REDOS: [string, string, number[]][] = [
  ['zh-yay', '好耶！', [0.9, 1.1]],
  ['zh-yay', '好耶好耶！', [1.0, 1.15]],
  ['zh-think', '嗯…让我想想', [1.15]],
  ['zh-think', '嗯，让我想想。', [1.0, 1.15]],
  ['zh-arrived', '到啦！', [0.9, 1.1]],
  ['zh-arrived', '我们到啦！', [1.0, 1.15]],
];

/** the re-records of three district clips: [clip id, phrasings, note] */
export const REDOS: [string, string[], string][] = [
  ['zh-yay', ['好耶！', '好耶～！'], 'Excited cheer: crisp 好 (hǎo), bright high 耶.'],
  ['zh-think', ['嗯…让我想想', '嗯——让我想想。'], 'A short "mm" hum, a pause, then 让我想想 clearly.'],
  ['zh-arrived', ['到啦！', '到啦～！'], 'Happy: 到啦 (dào la), an open bright "a" in 啦.'],
];

export function takeList(): Take[] {
  const out: Take[] = [];
  const add = (t: Omit<Take, 'index'>) => out.push({ index: out.length, ...t });
  for (const [id, line] of Object.entries(SF_VOICE_LINES)) {
    const note = `${BASE_INSTRUCTION} ${LINE_NOTE[id] ?? MOOD_NOTE[line.mood ?? 'happy']}`;
    for (const language of ['zh', 'en'] as const) {
      for (const seed of SEEDS) add({ clip: `${language}-${id}`, text: line[language], language, instruction: note, seed });
    }
  }
  for (const [clip, texts, note] of REDOS) {
    for (const text of texts) for (const seed of SEEDS) add({ clip, text, language: 'zh', instruction: `${BASE_INSTRUCTION} ${note}`, seed });
  }
  const first = [...out];
  for (const clip of ROUND2_CLIPS) {
    const t = first.find(x => x.clip === clip);
    if (!t) throw new Error(`no such clip: ${clip}`);
    for (const speechRate of ROUND2_RATES) add({ clip, text: t.text, language: t.language, instruction: t.instruction, seed: SEEDS[0], speechRate });
  }
  for (const [clip, text, rates] of ROUND2_REDOS) {
    const t = first.find(x => x.clip === clip);
    if (!t) throw new Error(`no such clip: ${clip}`);
    for (const speechRate of rates) add({ clip, text, language: 'zh', instruction: t.instruction, seed: SEEDS[0], speechRate });
  }
  for (const t of out) if (t.instruction.length > MAX_INSTRUCTION) throw new Error(`instruction too long: ${t.clip}`);
  return out;
}

if (process.argv[1]?.replace(/\\/g, '/').endsWith('voice/takes.ts')) console.log(JSON.stringify(takeList(), null, 1));
