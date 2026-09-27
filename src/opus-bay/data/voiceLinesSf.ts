import type { ChirpKind } from '../audio/sfx';
import type { Mood } from '../core/types';
import type { VoiceClip } from './assets';

/**
 * BAYBAY's recorded city lines (lane H2b owns this file from wave 2; plan H2b-6..9). Type-only imports: this module is
 * data (the title chunk may reach it through data/assets.ts).
 *
 *   SF_VOICE_LINES[id]     a line: the spoken phrase (G2's bubble text must START with it), mood, and the synth chirp
 *                          played when the clip is missing or not loaded within 700 ms
 *   SF_VOICE_CLIPS         clip id (`<lang>-<lineId>`, e.g. 'zh-first-bike') → files; data/assets.ts merges it into
 *                          ASSETS.voice (the player only plays listed ids) and listAssetUrls. An entry may also override
 *                          a district clip id (the re-records of 'zh-yay', 'zh-think', 'zh-arrived').
 *   SF_VOICE_UNMUTE        ids removed from audio/voice.ts MUTED_CLIPS once their re-record passed the owner's ear
 *
 * Play one with `emit({ type: 'voice-line', id: '<lineId>' })` (core/events.ts); audio/audio.ts → voice.line(id, fallback).
 *
 * Wave 3 (H2b-6..9): G2's BARK_SCRIPT was not on the branch when these were recorded, so this table was the script (the
 * plan's list: 8 mode firsts + 12 neighbourhood greetings with real far.zones ids); G2 then froze it word for word
 * (data/sf/lines.ts BARK_SCRIPT_RECORDED) plus a not-recorded block, recorded the same day as SF_VOICE_EXTRA.
 * qwen_audio_tts, preset "Pixie" (0178ef57-…), wav 48 kHz, the shipped instruction + a mood; 3 takes per clip (+ 3
 * speech rates where a clip ran long; 8–10 for the re-records), trimmed, two-pass loudnorm −18 LUFS / TP −1.5, AAC 64k
 * .m4a + Opus 48k .ogg, every clip ≤ 2 s, picked by measurable checks (scripts/opus-sf/voice/voice_post.py).
 * Takes, checks and picks: docs/opus-bay/h2b/voice-report.json; the owner's listening sheet: docs/opus-bay/h2b/listening.md.
 */

export interface SfVoiceLine {
  zh: string;
  en: string;
  mood?: Mood;
  /** chirp when there is no clip */
  fallback: ChirpKind;
}

/** far.zones ids with a recorded greeting (line `zone-<id>`), for G2's first-arrival bubbles */
export const SF_VOICE_ZONES = [
  'chinatown', 'north-beach', 'mission', 'castro-upper-market', 'haight-ashbury', 'marina',
  'twin-peaks', 'golden-gate-park', 'financial-district-south-beach', 'presidio', 'nob-hill', 'sunset-parkside',
] as const;

export const SF_VOICE_LINES: Record<string, SfVoiceLine> = {
  // the first time on / in each way of moving (G2: once per save, next to the bubble)
  'first-bike': { zh: '骑车出发！', en: 'Bike time!', mood: 'excited', fallback: 'yay' },
  'first-car': { zh: '开车兜风咯！', en: "Let's go for a drive!", mood: 'excited', fallback: 'yay' },
  'first-cable-car': { zh: '坐上叮当车啦！', en: 'Cable car! Ding ding!', mood: 'excited', fallback: 'wow' },
  'first-streetcar': { zh: '坐老电车咯！', en: 'All aboard the streetcar!', mood: 'happy', fallback: 'yay' },
  'first-ferry': { zh: '开船啦！', en: 'All aboard the ferry!', mood: 'excited', fallback: 'yay' },
  'first-glide': { zh: '抓稳，飞咯！', en: "Hold on, we're flying!", mood: 'excited', fallback: 'wow' },
  'first-hill': { zh: '呼…这坡好陡！', en: 'Phew, what a hill!', mood: 'happy', fallback: 'wow' },
  'first-crest': { zh: '哇，飞过坡顶！', en: 'Whee, over the top!', mood: 'excited', fallback: 'wow' },
  // the first arrival in a neighbourhood (far.zones id; G2: once per zone per save)
  'zone-chinatown': { zh: '你好，唐人街！', en: 'Hello, Chinatown!', mood: 'wave', fallback: 'arrived' },
  'zone-north-beach': { zh: '你好，北滩！', en: 'Hello, North Beach!', mood: 'wave', fallback: 'arrived' },
  'zone-mission': { zh: '你好，教会区！', en: 'Hello, the Mission!', mood: 'wave', fallback: 'arrived' },
  'zone-castro-upper-market': { zh: '你好，卡斯特罗！', en: 'Hello, the Castro!', mood: 'wave', fallback: 'arrived' },
  'zone-haight-ashbury': { zh: '你好，海特街！', en: 'Hello, Haight-Ashbury!', mood: 'wave', fallback: 'arrived' },
  'zone-marina': { zh: '你好，马里纳区！', en: 'Hello, the Marina!', mood: 'wave', fallback: 'arrived' },
  'zone-twin-peaks': { zh: '登上双峰啦！', en: 'Twin Peaks — we made it!', mood: 'proud', fallback: 'yay' },
  'zone-golden-gate-park': { zh: '你好，金门公园！', en: 'Hello, Golden Gate Park!', mood: 'wave', fallback: 'arrived' },
  'zone-financial-district-south-beach': { zh: '你好，金融区！', en: 'Hello, downtown!', mood: 'wave', fallback: 'arrived' },
  'zone-presidio': { zh: '你好，要塞公园！', en: 'Hello, the Presidio!', mood: 'wave', fallback: 'arrived' },
  'zone-nob-hill': { zh: '你好，诺布山！', en: 'Hello, Nob Hill!', mood: 'wave', fallback: 'arrived' },
  'zone-sunset-parkside': { zh: '你好，日落区！', en: 'Hello, the Sunset!', mood: 'wave', fallback: 'arrived' },
};

/**
 * G2's BARK_SCRIPT_TODO block (data/sf/lines.ts, frozen with G2-4 after the lines above were recorded), recorded word
 * for word in the same part. Their clips are in SF_VOICE_CLIPS, so `voice.line` already plays them (G2 emits these ids;
 * a clip not yet loaded gets LINE_WAIT). They are kept out of SF_VOICE_LINES only because G2's test pins
 * SF_VOICE_LINES to BARK_SCRIPT_RECORDED: when G2 moves them into its recorded block, spread this table into
 * SF_VOICE_LINES in the same commit (then they preload with the others). Request in docs/opus-bay/sf-w3-H2b.md.
 */
export const SF_VOICE_EXTRA: Record<string, SfVoiceLine> = {
  // reactions (G2: repeat, 60 s per key)
  'bump-hard': { zh: '哎呀！', en: 'Oops!', mood: 'thinking', fallback: 'think' },
  stairs: { zh: '楼梯上不去！', en: 'No stairs on wheels!', mood: 'thinking', fallback: 'think' },
  pant: { zh: '呼…歇口气！', en: 'Phew, catch your breath!', mood: 'happy', fallback: 'hi' },
  'crest-again': { zh: '再飞一个！', en: 'Wheee, again!', mood: 'excited', fallback: 'wow' },
  'glide-again': { zh: '起飞！', en: 'Up we go!', mood: 'excited', fallback: 'wow' },
  'glide-land': { zh: '安全降落！', en: 'Safe landing!', mood: 'proud', fallback: 'yay' },
  'glide-no-landing': { zh: '这儿降落不了！', en: "Can't land here!", mood: 'thinking', fallback: 'think' },
  // transit
  'cable-bell': { zh: '叮叮！叮当车来啦！', en: 'Ding ding! A cable car!', mood: 'excited', fallback: 'wow' },
  'turntable-push': { zh: '一起推！嘿咻！', en: 'Push together! Heave!', mood: 'excited', fallback: 'yay' },
  // more neighbourhoods, and the opener of G2's greeting template for the rest
  'zone-new': { zh: '新街区！', en: 'New neighbourhood!', mood: 'wave', fallback: 'arrived' },
  'zone-hayes-valley': { zh: '你好，海斯谷！', en: 'Hello, Hayes Valley!', mood: 'wave', fallback: 'arrived' },
  'zone-japantown': { zh: '你好，日本城！', en: 'Hello, Japantown!', mood: 'wave', fallback: 'arrived' },
  'zone-russian-hill': { zh: '你好，俄罗斯山！', en: 'Hello, Russian Hill!', mood: 'wave', fallback: 'arrived' },
  'zone-south-of-market': { zh: '你好，南市场！', en: 'Hello, SoMa!', mood: 'wave', fallback: 'arrived' },
  'zone-potrero-hill': { zh: '你好，波特雷罗山！', en: 'Hello, Potrero Hill!', mood: 'wave', fallback: 'arrived' },
  'zone-lincoln-park': { zh: '你好，林肯公园！', en: 'Hello, Lincoln Park!', mood: 'wave', fallback: 'arrived' },
  'zone-mission-bay': { zh: '你好，米慎湾！', en: 'Hello, Mission Bay!', mood: 'wave', fallback: 'arrived' },
  'zone-outer-richmond': { zh: '你好，外列治文！', en: 'Hello, the Outer Richmond!', mood: 'wave', fallback: 'arrived' },
};

const DIR = '/opus-bay/voice/sf';
const clip = (id: string, text: string, duration: number): VoiceClip => ({
  m4a: `${DIR}/${id}.m4a`,
  ogg: `${DIR}/${id}.ogg`,
  lang: id.startsWith('en-') ? 'en' : 'zh',
  text,
  duration,
});

/** seconds of each shipped pick [zh, en] (docs/opus-bay/h2b/voice-report.json; the asset test keeps them in step) */
const LINE_SECONDS: Record<string, [number, number]> = {
  'first-bike': [1.13, 0.88],
  'first-car': [1.97, 1.81],
  'first-cable-car': [1.65, 1.98],
  'first-streetcar': [1.72, 2.0],
  'first-ferry': [1.19, 1.98],
  'first-glide': [1.98, 1.53],
  'first-hill': [1.69, 1.75],
  'first-crest': [1.96, 1.64],
  'zone-chinatown': [1.49, 1.94],
  'zone-north-beach': [1.31, 1.57],
  'zone-mission': [1.69, 2.0],
  'zone-castro-upper-market': [1.95, 1.96],
  'zone-haight-ashbury': [1.58, 1.94],
  'zone-marina': [1.71, 1.96],
  'zone-twin-peaks': [1.31, 1.92],
  'zone-golden-gate-park': [1.58, 1.8],
  'zone-financial-district-south-beach': [1.54, 1.65],
  'zone-presidio': [1.96, 1.51],
  'zone-nob-hill': [1.38, 1.79],
  'zone-sunset-parkside': [1.37, 1.32],
  // SF_VOICE_EXTRA
  'bump-hard': [0.51, 0.9],
  stairs: [1.61, 1.92],
  pant: [1.94, 1.99],
  'crest-again': [0.82, 1.96],
  'glide-again': [0.57, 0.92],
  'glide-land': [1.13, 1.18],
  'glide-no-landing': [1.79, 1.18],
  'cable-bell': [1.94, 1.98],
  'turntable-push': [1.69, 1.97],
  'zone-new': [1.34, 1.22],
  'zone-hayes-valley': [1.39, 1.96],
  'zone-japantown': [1.4, 1.43],
  'zone-russian-hill': [1.76, 1.57],
  'zone-south-of-market': [1.54, 1.46],
  'zone-potrero-hill': [1.72, 1.72],
  'zone-lincoln-park': [1.65, 1.59],
  'zone-mission-bay': [1.78, 1.96],
  'zone-outer-richmond': [1.64, 1.9],
};

/**
 * Re-records of the three district clips listeners mis-heard. They override the district ids in ASSETS.voice but stay
 * in audio/voice.ts MUTED_CLIPS until the owner approves them by ear (docs/opus-bay/h2b/listening.md) and lists them
 * in SF_VOICE_UNMUTE. zh-yay says 好耶好耶！: every single "好耶！" take was still heard as 讨厌 by the recognizer.
 */
export const SF_VOICE_REDOS: Record<string, VoiceClip> = {
  'zh-yay': clip('zh-yay', '好耶好耶！', 1.11),
  'zh-think': clip('zh-think', '嗯…让我想想', 1.83),
  'zh-arrived': clip('zh-arrived', '到啦！', 0.88),
};

export const SF_VOICE_CLIPS: Record<string, VoiceClip> = {
  ...Object.fromEntries(Object.entries({ ...SF_VOICE_LINES, ...SF_VOICE_EXTRA }).flatMap(([id, line]) => {
    const [zh, en] = LINE_SECONDS[id] ?? [0, 0];
    return zh > 0 ? [[`zh-${id}`, clip(`zh-${id}`, line.zh, zh)], [`en-${id}`, clip(`en-${id}`, line.en, en)]] : [];
  })),
  ...SF_VOICE_REDOS,
};

/** re-records the owner approved by ear (removed from MUTED_CLIPS); empty until then */
export const SF_VOICE_UNMUTE: readonly string[] = [];
