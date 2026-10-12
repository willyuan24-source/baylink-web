import { Check } from 'lucide-react';
import { useUiCopy } from '../../components/ui/ui-copy';
import type { FreebieOffer } from '../../components/FreebieBoard';
import { readerSentences } from './reader-text';
import { PhoneLinked } from './ReaderText';

/** "1. …", "1、…", "第一步…", "Step 1: …": the listing numbers its own steps. */
const STEP_MARKER = /^\s*(?:\d{1,2}\s*[.、)）]\s*|第[一二三四五六七八九十]步[：:，,]?\s*|step\s*\d{1,2}\s*[:.)-]\s*)/i;
/** How current the listing is, not how to use the offer: "截至2026-09-29官网可见", "未公布有效期，不保证未来不变…". */
const LISTING_HEDGE = /^截至\s*\d{4}-\d{2}-\d{2}\s*官网可见|^未公布有效期|^visible on the official (?:site|website) as of|^no validity period is published/i;

/**
 * An offer's two answers (design.md §4.9; the SFMTA 65+ template): "先看领取条件" as a checklist, one condition per line,
 * then "怎么领 · 怎么用". Both come from the listing's own reviewed text, split by sentence in the reader's language, with
 * tap-to-call numbers; no generic "以官方为准" line (CNT-1011-06): the source row says that.
 *
 * Numbers are earned: "怎么领 · 怎么用" is a numbered 1-2-3 only when the listing numbers its own steps (CNT can write them
 * that way); otherwise its sentences are a plain list, since a description sentence is not step 1. Lines about how current
 * the listing is ("截至…官网可见", "未公布有效期…") follow the list as a small note.
 */
export function BenefitSteps({ offer }: { offer: FreebieOffer }) {
  const { t, locale } = useUiCopy();
  const conditions = readerSentences(offer.requirement, locale);
  const sentences = readerSentences(offer.description, locale);
  const items = sentences.filter(line => !LISTING_HEDGE.test(line));
  const hedges = sentences.filter(line => LISTING_HEDGE.test(line));
  const numbered = items.length > 1 && items.every(line => STEP_MARKER.test(line));
  return <>
    {conditions.length > 0 && <section className="detail-conditions" aria-labelledby="offer-conditions-title">
      <h2 id="offer-conditions-title">{t('先看领取条件', 'Check who qualifies')}</h2>
      <ul>{conditions.map(line => <li key={line}><Check aria-hidden="true" strokeWidth={2} /><p><PhoneLinked text={line} /></p></li>)}</ul>
    </section>}
    {sentences.length > 0 && <section className="detail-steps" aria-labelledby="offer-steps-title">
      <h2 id="offer-steps-title">{t('怎么领 · 怎么用', 'How to get and use it')}</h2>
      {numbered
        ? <ol>{items.map((line, index) => <li key={line}><span aria-hidden="true">{index + 1}</span><p><PhoneLinked text={line.replace(STEP_MARKER, '')} /></p></li>)}</ol>
        : items.length > 0 && <ul>{items.map(line => <li key={line}><p><PhoneLinked text={line} /></p></li>)}</ul>}
      {hedges.length > 0 && <p className="detail-steps__note">{hedges.map((line, index) => <span key={line}>{index > 0 && (locale === 'en' ? ' ' : '')}<PhoneLinked text={line} /></span>)}</p>}
    </section>}
  </>;
}
