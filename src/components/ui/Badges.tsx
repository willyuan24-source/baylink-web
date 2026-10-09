import type { ReactNode } from 'react';
import './ui.css';
import { cx } from './ui-copy';

/** Top-left provenance badge. The text must come from getImageProvenance() / typeCoverProvenance(). */
export function ProvenanceBadge({ label, className }: { label: string; className?: string }) {
  return <span className={cx('ui-provenance', className)} data-provenance>{label}</span>;
}

export type StickerTone = 'date' | 'free' | 'mixed' | 'price' | 'paid' | 'danger' | 'warning' | 'success' | 'neutral';
/** A decision fact printed on an image: date bottom-left, price bottom-right (13/700, tabular). */
export function Sticker({ tone = 'date', slot, children, className }: { tone?: StickerTone; slot?: 'start' | 'end'; children: ReactNode; className?: string }) {
  return <span className={cx('ui-sticker', className)} data-tone={tone} data-slot={slot}>{children}</span>;
}

/** The bottom sticker row on a cover. Put the date first and the price second. */
export function StickerRow({ children }: { children: ReactNode }) {
  return <span className="ui-stickers">{children}</span>;
}

export type StatusTone = 'neutral' | 'success' | 'info' | 'warning' | 'danger' | 'ended';
/** A fact about the item (免费, 即将开始, 已结束, 待确认). Not a control. */
export function StatusChip({ tone = 'neutral', icon, children, className }: { tone?: StatusTone; icon?: ReactNode; children: ReactNode; className?: string }) {
  return <span className={cx('ui-status', className)} data-tone={tone}>{icon}{children}</span>;
}
