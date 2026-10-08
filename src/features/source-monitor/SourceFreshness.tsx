import { Info } from 'lucide-react';
import { getReaderFreshness, type ReaderFreshnessItem } from '../../lib/content-review';
import { translateText, useLocale } from '../../i18n/locale';
import { pageNames, readerDate, useContentReviewToday, useSourceFreshness } from './content-review-runtime';

/**
 * The one-line prompt under the facts: soft for a pending source change (or a near date
 * whose source cannot be read and whose human check is old), hard for likely cancellation
 * wording. OK, archived and guide states render nothing.
 */
export function SourceFreshness({ contentId, item = { kind: 'event' }, officialUrl, include = ['soft', 'hard'], today }: {
  contentId: string; item?: ReaderFreshnessItem; officialUrl?: string; include?: readonly ('soft' | 'hard')[]; today?: string;
}) {
  const locale = useLocale(), day = useContentReviewToday(today), { rows, receivedAt } = useSourceFreshness(contentId);
  const t = (zh: string, en: string) => locale === 'en' ? en : translateText(zh, locale);
  const freshness = getReaderFreshness(item, rows, { today: day, now: receivedAt });
  if ((freshness.state !== 'soft' && freshness.state !== 'hard') || !include.includes(freshness.state)) return null;
  const [pageZh, pageEn] = pageNames[item.kind];
  const changed = freshness.changedAt ? readerDate(freshness.changedAt, locale, day) : null;
  const text = freshness.state === 'hard' ? t(`${pageZh}显示可能改期或取消，`, `${pageEn} suggests a date change or cancellation. `)
    : freshness.reason === 'date-near-unconfirmed' ? t('日期就在这几天，', 'This is coming up soon. ')
    : changed ? t(`${pageZh} ${changed} 有更新，`, `${pageEn} was updated on ${changed}. `) : t(`${pageZh}近期有更新，`, `${pageEn} was updated recently. `);
  const action = freshness.state === 'hard' ? t('出发前务必确认', 'Confirm before you go')
    : item.kind === 'offer' ? t('领取前看一眼官方', 'Check it before you claim') : t('出发前看一眼官方', 'Take a quick look before you go');
  return <div className={`reader-freshness-line${freshness.state === 'hard' ? ' is-hard' : ''}`} role="note" aria-label={t('官方页面提示', 'Official page note')} translate="no">
    <Info size={16} aria-hidden="true" />
    <p>{text}{officialUrl ? <a href={officialUrl} target="_blank" rel="noopener noreferrer">{action} ›</a> : `${action}${locale === 'en' ? '.' : '。'}`}</p>
  </div>;
}
