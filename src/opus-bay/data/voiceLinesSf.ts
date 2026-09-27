import type { ChirpKind } from '../audio/sfx';
import type { Mood } from '../core/types';
import type { VoiceClip } from './assets';

/**
 * BAYBAY's recorded city lines (lane H2b owns this file from wave 2; plan H2b-6..9). Day-0 stub: empty tables, so every
 * `voice-line` event falls back to its chirp. Type-only imports: this module is data (the title chunk may reach it
 * through data/assets.ts).
 *
 *   SF_VOICE_LINES[id]     a line: the spoken phrase (G2's bubble text must START with it), mood, and the synth chirp
 *                          played when the clip is missing or not loaded within 700 ms
 *   SF_VOICE_CLIPS         clip id (`<lang>-<lineId>`, e.g. 'zh-first-bike') → files; data/assets.ts merges it into
 *                          ASSETS.voice (the player only plays listed ids) and listAssetUrls. An entry may also override
 *                          a district clip id (a re-record of 'zh-yay').
 *   SF_VOICE_UNMUTE        ids removed from audio/voice.ts MUTED_CLIPS once their re-record passed the owner's ear
 *
 * Play one with `emit({ type: 'voice-line', id: '<lineId>' })` (core/events.ts); audio/audio.ts → voice.line(id, fallback).
 */

export interface SfVoiceLine {
  zh: string;
  en: string;
  mood?: Mood;
  /** chirp when there is no clip */
  fallback: ChirpKind;
}

export const SF_VOICE_LINES: Record<string, SfVoiceLine> = {};

export const SF_VOICE_CLIPS: Record<string, VoiceClip> = {};

export const SF_VOICE_UNMUTE: readonly string[] = [];
