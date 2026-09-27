/**
 * Lane V (W4-V6): the TTS take list for lane C's frozen tour narration (data/sf/tourLines.ts TOUR_LINES, frozen
 * 2026-09-27, tag w4-tourlines-frozen): the 16 loop stops × approach / arrive / tip, the Metro lines, the Grand Tour
 * chapter intros and outros, the arrival barks and the quiet lines, zh + en.
 *
 *   npx tsx --tsconfig tsconfig.app.json scripts/opus-sf/voice/w4/takes.ts > C:/Users/willy/opus-qa/w4/w4-v/voice/takes.json
 *
 * One take = one qwen_audio_tts job (preset "Pixie" as every BAYBAY clip, wav 48 kHz), the line text, the language hint,
 * an instruction of ≤ 128 characters (the service's cap): a guide variant of the shipped BAYBAY instruction (these are
 * sentences, not barks: an unhurried storytelling pace) plus one mood note; quiet lines are soft and slow. Two takes per
 * clip at speech_rate 1.0 and 1.08 (wave 3 found the seed ignored for a third of the texts: the rate makes the takes
 * distinct), so the owner's listening sheet always has an alternate.
 */
import { TOUR_LINES, QUIET_LINES } from '../../../../src/opus-bay/data/sf/tourLines';

export const PIXIE = '0178ef57-ada4-43d9-992b-8d9221045bb4';
export const RATES = [1.0, 1.08];
export const MAX_INSTRUCTION = 128;
export const GUIDE_INSTRUCTION = 'Cute otter mascot tour guide: warm, cheerful, clear, friendly storytelling pace.';
const MOOD_NOTE: Record<string, string> = {
  excited: 'Excited and delighted.',
  happy: 'Happy and warm, relaxed.',
  point: 'Pointing something out, curious and bright.',
  proud: 'Proud and happy.',
  thinking: 'Calm and thoughtful.',
  wave: 'A friendly hello.',
};
const QUIET_INSTRUCTION = 'Cute otter mascot: soft, gentle and respectful, quiet and slow, like near a memorial.';

export interface Take { index: number; clip: string; line: string; text: string; language: 'zh' | 'en'; instruction: string; speechRate: number }

const quiet = new Set(Object.values(QUIET_LINES).map(l => l.id));
const takes: Take[] = [];
for (const line of TOUR_LINES) {
  for (const language of ['zh', 'en'] as const) {
    const instruction = quiet.has(line.id) ? QUIET_INSTRUCTION : `${GUIDE_INSTRUCTION} ${MOOD_NOTE[line.mood] ?? MOOD_NOTE.happy}`;
    if (instruction.length > MAX_INSTRUCTION) throw new Error(`instruction too long for ${line.id}`);
    for (const speechRate of RATES) {
      takes.push({ index: takes.length, clip: `${language}-${line.id}`, line: line.id, text: line[language], language, instruction, speechRate });
    }
  }
}
process.stdout.write(JSON.stringify({ voice: PIXIE, lines: TOUR_LINES.length, takes }, null, 1) + '\n');
