import { Check } from 'lucide-react';
import { getReaderFreshness, type ReaderFreshnessItem } from '../../lib/content-review';
import { translateText, useLocale } from '../../i18n/locale';
import { readerDate, useContentReviewToday, useSourceFreshness } from './content-review-runtime';

/** A no-break space keeps the dot on the line it ends; the following space is the only break point. */
const SEPARATOR = '\u00a0· ';

/**
 * "✓ 官方来源 · 编辑核对 9/29 · 自动比对 10/7 无变化" (D11). The editor date is the human
 * `verifiedAt`. The comparison date comes from the source monitor and only appears when every
 * source was read and matched; with the API unreachable the row simply omits it. A press
 * report linked as the source is labelled 来源, not 官方来源.
 */
export function TrustRow({ contentId, item, sourceUrl, sourceLabel, official = true, today }: { contentId: string; item: ReaderFreshnessItem; sourceUrl: string; sourceLabel: string; official?: boolean; today?: string }) {
  const locale = useLocale(), day = useContentReviewToday(today), { rows, receivedAt } = useSourceFreshness(contentId);
  const t = (zh: string, en: string) => locale === 'en' ? en : translateText(zh, locale);
  const { verifiedAt, comparedAt } = getReaderFreshness(item, rows, { today: day, now: receivedAt });
  // Inline text, not flex items: each "label date" pair stays whole and the separator ends the
  // previous pair, so a long source name on a phone never strands the check mark or starts a line with "·".
  return <div className="trust-row" role="note" aria-label={t('来源与核对', 'Source and checks')} translate="no">
    <span className="trust-row-item"><Check size={16} aria-hidden="true" />{official ? t('官方来源', 'Official source') : t('来源', 'Source')}</span> <a href={sourceUrl} target="_blank" rel="noopener noreferrer">{translateText(sourceLabel, locale)}</a>
    {verifiedAt && <>{SEPARATOR}<span className="trust-row-item">{t('编辑核对', 'Editor checked')} <time dateTime={verifiedAt}>{readerDate(verifiedAt, locale, day)}</time></span></>}
    {comparedAt && <>{SEPARATOR}<span className="trust-row-item">{t('自动比对', 'Auto-compared')} <time dateTime={new Date(comparedAt).toISOString()}>{readerDate(comparedAt, locale, day)}</time>{t(' 无变化', ', no change')}</span></>}
  </div>;
}
