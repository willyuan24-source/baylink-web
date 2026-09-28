import type { Bilingual } from '../core/types';
import { bayNow } from '../game/bayNow';

/**
 * Wave 5 · lane R (W5-R1 hook, plan §4.3 `moonPhase`; the sky moon is lane V's should item W5-V10).
 *
 * The phase is the Moon–Sun elongation: the mean elongation plus its seven largest periodic terms (Meeus ch. 48), a
 * dozen lines instead of the plan's plain mean synodic month (whose quarters drift more than a day). Checked against the
 * US Naval Observatory's moon phases on 2026-09-28 (tests: within 6 h of all 16 phases from September to December
 * 2026). Lines about it still say 约 / about.
 */

export const SYNODIC_DAYS = 29.530588853;
export const MOON_SOURCE = { sourceUrl: 'https://aa.usno.navy.mil/data/MoonPhases', verifiedAt: '2026-09-28' } as const;

export type MoonName = 'new' | 'waxing-crescent' | 'first-quarter' | 'waxing-gibbous' | 'full' | 'waning-gibbous' | 'last-quarter' | 'waning-crescent';

export interface MoonPhase {
  /** 0 = new, 0.25 = first quarter, 0.5 = full, 0.75 = last quarter */
  phase: number;
  /** days since the (mean) new moon, 0 … 29.53 */
  age: number;
  /** lit fraction of the disc, 0 … 1 */
  illumination: number;
  /** waxing (the lit side on the right, seen from San Francisco) */
  waxing: boolean;
  name: MoonName;
}

const NAMES: MoonName[] = ['new', 'waxing-crescent', 'first-quarter', 'waxing-gibbous', 'full', 'waning-gibbous', 'last-quarter', 'waning-crescent'];

export const MOON_LABELS: Record<MoonName, Bilingual> = {
  new: { zh: '新月', en: 'New moon' },
  'waxing-crescent': { zh: '蛾眉月', en: 'Waxing crescent' },
  'first-quarter': { zh: '上弦月', en: 'First quarter' },
  'waxing-gibbous': { zh: '盈凸月', en: 'Waxing gibbous' },
  full: { zh: '满月', en: 'Full moon' },
  'waning-gibbous': { zh: '亏凸月', en: 'Waning gibbous' },
  'last-quarter': { zh: '下弦月', en: 'Last quarter' },
  'waning-crescent': { zh: '残月', en: 'Waning crescent' },
};

const RAD = Math.PI / 180;

/**
 * The Moon–Sun elongation (0 … 1 of a turn) at `ms`: the mean elongation plus the seven largest periodic terms of the
 * phase angle (Meeus, Astronomical Algorithms ch. 48, low accuracy): within a few hours of the true phases.
 */
export function moonElongation(ms: number): number {
  const T = (ms / 864e5 + 2440587.5 - 2451545) / 36525;
  const D = (297.8501921 + 445267.1114034 * T) * RAD;
  const M = (357.5291092 + 35999.0502909 * T) * RAD;
  const Mp = (134.9633964 + 477198.8675055 * T) * RAD;
  const i = 180 - D / RAD - 6.289 * Math.sin(Mp) + 2.1 * Math.sin(M) - 1.274 * Math.sin(2 * D - Mp) - 0.658 * Math.sin(2 * D) - 0.214 * Math.sin(2 * Mp) - 0.11 * Math.sin(D);
  const e = 180 - i;
  return (((e % 360) + 360) % 360) / 360;
}

/** The moon's phase at `date`. */
export function moonPhase(date: Date = bayNow()): MoonPhase {
  const phase = moonElongation(date.getTime());
  // the age counts from the last (mean-spaced) new moon: the phase times the mean synodic month
  const age = phase * SYNODIC_DAYS;
  const illumination = (1 - Math.cos(phase * 2 * Math.PI)) / 2;
  // eight names, each centred on its phase (new ± 1/16 …)
  const name = NAMES[Math.floor(phase * 8 + 0.5) % 8];
  return { phase, age, illumination, waxing: phase < 0.5, name };
}
