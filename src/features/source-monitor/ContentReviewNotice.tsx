import { Check } from 'lucide-react';
import { translateText, useLocale } from '../../i18n/locale';
import { getReaderFreshness, type ContentReviewRecord } from '../../lib/content-review';
import { contentReviewText, contentReviewTextStyle } from './content-review-copy';
import { pageNames, useContentReviewToday, useSourceFreshness } from './content-review-runtime';

/**
 * The reader notice above the actions follows source state (D11). Discovery items show a box
 * only when archived or when the organizer's page carries cancellation wording; the calendar
 * review cadence stays an editor tool. Guides never get a box: a meta line points to the
 * official references and explains what the "updated" date means.
 */
export function ContentReviewNotice({ record, today, sourcesAnchor }: { record: ContentReviewRecord; today?: string; sourcesAnchor?: string }) {
  const locale = useLocale(), day = useContentReviewToday(today);
  const { rows, receivedAt } = useSourceFreshness(record.kind === 'guide' ? null : record.id);
  const t = (zh: string, en: string) => locale === 'en' ? en : translateText(zh, locale);
  const freshness = getReaderFreshness(record, rows, { today: day, now: receivedAt });
  const official = record.sourceUrls.find(url => /^https?:\/\//u.test(url));
  if (freshness.state === 'guide') {
    const count = record.sourceUrls.length, href = sourcesAnchor || official;
    return <div className="guide-date-meta" translate="no">
      {count > 0 && href && <a href={href} {...(!sourcesAnchor ? { target: '_blank', rel: 'noopener noreferrer' } : {})}><Check size={16} aria-hidden="true" />{t(`官方参考资料 ${count} 项`, `${count} official reference${count === 1 ? '' : 's'}`)} ›</a>}
      <details>
        <summary><span aria-hidden="true">ⓘ</span>{t('关于日期', 'About dates')}</summary>
        <p>{t('“更新”日期是这篇指南内容的整理日期，不代表每个官方来源都在当天重新核验。', 'The “updated” date is when this guide’s content was revised, not a re-check of every official source on that day.')}</p>
      </details>
    </div>;
  }
  if (freshness.state === 'archived') {
    const c = (key: Parameters<typeof contentReviewText>[0]) => contentReviewText(key, locale);
    return <aside className="content-review-notice rounded-xl border border-baylink-border bg-baylink-bg p-4 my-5" aria-label={c('资料复核状态')} style={contentReviewTextStyle} translate="no">
      <h2 style={{ ...contentReviewTextStyle, fontWeight: 700 }}>{c('往期内容')}</h2>
      <p style={contentReviewTextStyle}>{c('所列覆盖日期已结束。此页面保留作往期参考，不表示当前仍可参加、领取或办理。')}</p>
      {official && <a href={official} target="_blank" rel="noopener noreferrer" className="inline-flex items-center underline mt-2" style={{ ...contentReviewTextStyle, minHeight: 'var(--control-height, 2.75rem)' }}>{c('查看官方最新说明')}</a>}
    </aside>;
  }
  if (freshness.state !== 'hard') return null;
  const { zh: pageZh, en: pageEn } = pageNames[record.kind];
  return <aside className="content-review-notice reader-freshness-hard" aria-label={t('官方页面变化提示', 'Official page change')} translate="no">
    <h2>{t(`${pageZh}显示可能改期或取消`, `${pageEn} suggests a date change or cancellation`)}</h2>
    <p>{t('出发前务必在官方页面确认日期和安排。', 'Confirm the date and arrangements on the official page before you go.')}</p>
    {official && <a href={official} target="_blank" rel="noopener noreferrer">{t('查看官方页面', 'Open the official page')} ›</a>}
  </aside>;
}
