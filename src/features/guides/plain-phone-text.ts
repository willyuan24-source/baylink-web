import { createContext, createElement, useContext, type ReactNode } from 'react';
import { linkifyPhones, type PhoneChipVariant } from '../../lib/phone-links';
import { findPhoneNumbers } from '../../lib/phone-numbers';

/**
 * 简洁显示 on a guide (UI9-GUIDES): each number keeps at most two tap targets — the bar's 拨打 and its contact's — so the other
 * copies on the page (30 秒看懂, step conclusions, prose, sources, diagrams) print as text (linkifyPhones' `except`). Guide-only,
 * so no other route carries it; without a provider every number is a chip as before. GuidePhoneText is in plain-phones.tsx.
 */
const PlainPhones = createContext<ReadonlySet<string> | undefined>(undefined);
export const PlainPhonesProvider = PlainPhones.Provider;
/** The tel numbers that print as text here; undefined outside a provider. */
export const usePlainPhones = () => useContext(PlainPhones);

/**
 * linkifyPhones for a guide: a number in `except` prints as text, but on one line (.gd-nowrap) the way its chip would, never
 * "510-/839-2022" at 简洁 / 家人版 sizes. Without `except` the output is linkifyPhones' own.
 */
export function linkifyGuidePhones(text: string, options: { variant?: PhoneChipVariant; except?: ReadonlySet<string> } = {}): ReactNode[] {
  const parts = linkifyPhones(text, options);
  const except = options.except;
  if (!except?.size) return parts;
  let key = 0;
  return parts.flatMap(part => {
    if (typeof part !== 'string') return [part];
    const out: ReactNode[] = [];
    let at = 0;
    for (const match of findPhoneNumbers(part)) {
      if (!except.has(match.tel)) continue;
      if (match.start > at) out.push(part.slice(at, match.start));
      out.push(createElement('span', { key: `plain-${key++}`, className: 'gd-nowrap' }, match.text));
      at = match.end;
    }
    if (at < part.length) out.push(part.slice(at));
    return out;
  });
}
