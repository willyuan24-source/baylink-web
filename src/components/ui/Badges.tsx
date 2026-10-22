import type { ReactNode } from 'react';
import './ui.css';
import './covers.css';
import './cards.css';
import { cx } from './ui-copy';

/**
 * The provenance chip: one per picture, bottom-left (UI9-IMAGES DECISIONS 23). The words come from tierLabelOf() (cover-labels.ts)
 * or, for a 3D postcard, getImageProvenance(). `tier` (data-tier) keeps a ③ 示意图 / ④ AI 示意图 chip on the picture in every
 * size and mode. `plain`: the badge exactly as it was before UI9-C, without the attribute the chip look keys on (covers.css
 * `.ui-provenance[data-chip]`): the AI 3D postcards only (captain decision 1).
 */
export function ProvenanceBadge({ label, className, plain, tier }: { label: string; className?: string; plain?: boolean; tier?: string }) {
  return <span className={cx('ui-provenance', className)} data-provenance data-chip={plain ? undefined : ''} data-tier={tier}>{label}</span>;
}

export type StickerTone = 'date' | 'free' | 'mixed' | 'price' | 'paid' | 'danger' | 'warning' | 'success' | 'neutral';
/** A fact printed on a member's photo (community posts). Listing covers carry no stickers since UI9-C (N22). */
export function Sticker({ tone = 'date', slot, children, className }: { tone?: StickerTone; slot?: 'start' | 'end'; children: ReactNode; className?: string }) {
  return <span className={cx('ui-sticker', className)} data-tone={tone} data-slot={slot}>{children}</span>;
}

/** The bottom sticker row on a community post's photo. */
export function StickerRow({ children }: { children: ReactNode }) {
  return <span className="ui-stickers">{children}</span>;
}

// The status map lives in ./Status (no stylesheet import of its own: covers.css carries .ui-status), so a page that shows a
// provenance chip but no status does not load it. Its names stay importable from here.
export { LEGACY_STATUS_TONES, StatusChip, statusLook, type LegacyStatusTone, type StatusLook, type StatusTone } from './Status';
