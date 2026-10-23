/**
 * lib/cover, the one cover resolver (plan D7; the rules are in cover-core.ts): getCover and the rest from cover-core.ts,
 * resolveCovers for a list from cover-list.ts. Two modules behind one import path (UI9-R2), so a page that resolves one
 * cover at a time, /plan's weekend picks, does not load a list's dealing: the bundle binds each import to the module that
 * defines it and leaves this file out (measured 10-23: /plan zh-Hans route JS 189.9 → 189.5 KiB on the Mac, ceiling 192.0).
 * Pages import from here; cover-list.ts imports cover-core.ts directly, so no two of these modules import each other.
 */
export * from './cover-core';
export { resolveCovers } from './cover-list';
