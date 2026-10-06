import { useLocale } from '../../i18n/locale';
import { contentReviewQueue, type ContentReviewRecord } from '../../lib/content-review';
import { contentReviewText, contentReviewTextStyle } from './content-review-copy';
import { useContentReviewToday } from './content-review-runtime';

export function ContentReviewNotice({ record, today, sourcesAnchor }: { record: ContentReviewRecord; today?: string; sourcesAnchor?: string }) {
  const locale = useLocale(), day = useContentReviewToday(today);
  const t = (key: Parameters<typeof contentReviewText>[0]) => contentReviewText(key, locale);
  const row = contentReviewQueue([record], day)[0];
  if (row.status === 'scheduled' && row.dateMeaning !== 'content-updated') return null;
  const heading = row.status === 'archived' ? '往期内容' : row.status === 'missing-date' ? '日期待确认' : row.status === 'manual-review' ? '来源需人工确认' : row.status === 'due' ? '内容待复核' : '资料日期说明';
  const note = row.status === 'archived' ? '所列覆盖日期已结束。此页面保留作往期参考，不表示当前仍可参加、领取或办理。'
    : row.status === 'missing-date' ? '资料日期缺失、无效或晚于今天，不能据此认定信息已核对。请查看官方最新说明。'
    : row.status === 'manual-review' ? '部分来源仍需人工确认。请查看官方最新说明，涉及个人资格或专业决定时向对应机构求助。'
    : row.status === 'due' ? '内容已到建议复核时间。费用、规则、开放安排或领取条件可能变化，请核对官方最新说明。' : null;
  const official = record.sourceUrls.find(url => /^https?:\/\//u.test(url));
  return <aside className="content-review-notice rounded-xl border border-baylink-border bg-baylink-bg p-4 my-5" aria-label={t('资料复核状态')} style={contentReviewTextStyle} translate="no">
    <h2 style={{ ...contentReviewTextStyle, fontWeight: 700 }}>{t(heading)}</h2>
    {record.dateMeaning === 'content-updated' && <p style={contentReviewTextStyle}>{t('这篇指南的日期表示内容更新，不表示每个官方来源在当天重新核验。')}</p>}
    {note && <p style={contentReviewTextStyle}>{t(note)}</p>}
    {(sourcesAnchor || official) && <a href={sourcesAnchor || official} {...(!sourcesAnchor ? { target: '_blank', rel: 'noopener noreferrer' } : {})} className="inline-flex items-center underline mt-2" style={{ ...contentReviewTextStyle, minHeight: 'var(--control-height, 2.75rem)' }}>{t(sourcesAnchor ? '查看官方参考资料' : '查看官方最新说明')}</a>}
  </aside>;
}
