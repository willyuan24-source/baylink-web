import type { ReactNode } from 'react';
import { cx } from './ui-copy';

/**
 * The one status map (UI9-C, N08 / G8; D2 tokens.md §2). Each status has exactly one look, 14 px, wrapping, never cut:
 *   free     免费                   lime fill, deep text
 *   partial  部分免费                lime outline, deep text
 *   soon     即将截止 / 还剩 N 天      red outline, red text
 *   urgent   今天截止 / 明天截止 / 售罄  solid red, white text
 *   open     已开业                  brand tint and a ✓
 *   ended    已结束                  sunken, ink-3
 *   neutral  everything else (安排草案, 待核实, 还需补充, 日期待定 …)
 * No status is amber or indigo (the 市集美食 and 文化 hues). The old tone names still compile (LEGACY_STATUS_TONES), and a
 * chip whose words are one of the statuses above takes that status's look whatever tone it was given.
 */
export type StatusLook = 'free' | 'partial' | 'soon' | 'urgent' | 'open' | 'ended' | 'neutral';
export type LegacyStatusTone = 'success' | 'info' | 'warning' | 'danger';
export type StatusTone = StatusLook | LegacyStatusTone;
export const LEGACY_STATUS_TONES: Readonly<Record<LegacyStatusTone, StatusLook>> = { success: 'open', info: 'neutral', warning: 'neutral', danger: 'urgent' };
const STATUS_WORDS: readonly (readonly [RegExp, StatusLook])[] = [
  [/^(部分免[费費]|Partly free)$/i, 'partial'],
  [/^(免[费費]|Free)$/i, 'free'],
  [/[今明]天截止|Ends to(day|morrow)|售罄|Sold out/i, 'urgent'],
  [/^([还還]剩 ?\d+ ?天|\d+ days? left|即[将將]截止)$/i, 'soon'],
  [/已[开開][业業]$|^Open(ed | now)/, 'open'],
  [/^(已[结結]束|Ended)/, 'ended'],
];
/** The look a status takes: its words first (one look per status), else its tone. */
export function statusLook(tone: StatusTone = 'neutral', text?: string): StatusLook {
  const words = text?.trim();
  if (words) for (const [pattern, look] of STATUS_WORDS) if (pattern.test(words)) return look;
  return Object.hasOwn(LEGACY_STATUS_TONES, tone) ? LEGACY_STATUS_TONES[tone as LegacyStatusTone] : tone as StatusLook;
}
/** A fact about the item (免费, 还剩 3 天, 已开业, 已结束, 待确认). Not a control. */
export function StatusChip({ tone = 'neutral', icon, children, className }: { tone?: StatusTone; icon?: ReactNode; children: ReactNode; className?: string }) {
  return <span className={cx('ui-status', className)} data-tone={statusLook(tone, typeof children === 'string' ? children : undefined)}>{icon}{children}</span>;
}
