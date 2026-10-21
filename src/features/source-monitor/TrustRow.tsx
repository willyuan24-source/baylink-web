import { Check } from 'lucide-react';
import { getReaderFreshness, type ReaderFreshnessItem } from '../../lib/content-review';
import { translateText, useLocale } from '../../i18n/locale';
import { checkedText, checkedWords, pressSource } from './checked-line';
import { readerDate, useContentReviewToday, useSourceFreshness } from './content-review-runtime';

/** A no-break space keeps the dot on the line it ends; the following space is the only break point. */
const SEPARATOR = '\u00a0· ';

/**
 * "✓ 官方来源 · 官网核对 9/29 · 自动比对 10/7 无变化" (D11). `verifiedAt` is the day the official page was read and the
 * listing checked against it, as the cards say ("官网核对 10/2"). That read is often an AI agent's, so the row never calls
 * it 编辑核对 / 人工核对 (HANDOFF §3.9, tests/agent-read-wording.test.tsx). The comparison date comes from the source
 * monitor and only appears when every
 * source was read and matched; with the API unreachable the row simply omits it. When the next date is within a week and
 * the monitor could read none of the sources, the row says 未能自动核对 (H02). A source that is not the official page, or
 * is a press report (pressSource: the label rule the facts card and the rails use), is labelled 来源, not 官方来源, and a
 * press source's date reads "媒体报道 · 9/28 核对" like the facts card's check line (owner decision 17).
 */
export function TrustRow({ contentId, item, sourceUrl, sourceLabel, official = true, today }: { contentId: string; item: ReaderFreshnessItem; sourceUrl: string; sourceLabel: string; official?: boolean; today?: string }) {
  const locale = useLocale(), day = useContentReviewToday(today), { rows, receivedAt } = useSourceFreshness(contentId);
  const t = (zh: string, en: string) => locale === 'en' ? en : translateText(zh, locale);
  const { verifiedAt, comparedAt, unread } = getReaderFreshness(item, rows, { today: day, now: receivedAt });
  const press = pressSource(sourceLabel), [checkedBefore, checkedAfter] = checkedWords(press, locale);
  // Inline text, not flex items: each "label date" pair stays whole and the separator ends the
  // previous pair, so a long source name on a phone never strands the check mark or starts a line with "·".
  return <div className="trust-row" role="note" aria-label={t('来源与核对', 'Source and checks')} translate="no">
    <span className="trust-row-item"><Check size={16} aria-hidden="true" />{official && !press ? t('官方来源', 'Official source') : t('来源', 'Source')}</span> <a href={sourceUrl} target="_blank" rel="noopener noreferrer">{translateText(sourceLabel, locale)}</a>
    {verifiedAt && <>{SEPARATOR}<span className="trust-row-item">{checkedBefore}<time dateTime={verifiedAt}>{readerDate(verifiedAt, locale, day)}</time>{checkedAfter}</span></>}
    {comparedAt && <>{SEPARATOR}<span className="trust-row-item">{t('自动比对', 'Auto-compared')} <time dateTime={new Date(comparedAt).toISOString()}>{readerDate(comparedAt, locale, day)}</time>{t(' 无变化', ', no change')}</span></>}
    {unread && <>{SEPARATOR}<span className="trust-row-item">{t('未能自动核对', 'Not auto-checked')}</span></>}
  </div>;
}

/**
 * "✓ 官网核对 10/15" at the end of the facts card, so the check is on the first screen (UI9-DETAIL; text: checked-line.ts).
 * It reads the same source label as the trust row, so the two never call one source two things.
 */
export function CheckedLine({ verifiedAt, sourceLabel, today }: { verifiedAt?: string; sourceLabel: string; today?: string }) {
  const locale = useLocale(), day = useContentReviewToday(today), press = pressSource(sourceLabel);
  const text = checkedText(verifiedAt, press, locale, day);
  return text ? <p className="detail-facts-check" translate="no">{!press && <Check size={16} aria-hidden="true" />}{text}</p> : null;
}
