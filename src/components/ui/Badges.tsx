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
  // Two children, no fragment: the split adds no react import to this primitive's chunk (route JS budgets).
  const dated = !plain && DATED.exec(label);
  return <span className={cx('ui-provenance', className)} data-provenance data-chip={plain ? undefined : ''} data-tier={tier}>
    {dated && <span className="ui-provenance__lead">{dated[1]}</span>}{dated ? dated[2] : label}
  </span>;
}

/**
 * A dated ①② badge ("官方图 · 2025 往届" / "Official image · 2025 edition"): its edition stands alone on a cover ≤ 120px wide
 * (covers.css hides the lead there; #62 live check: the full words wrapped to 2–3 lines over a thumbnail). The full words stay
 * on larger covers and in the page's image credits.
 */
const DATED = /^(.+ · )(\d{4} ?(?:往[届屆]|edition))$/;

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
