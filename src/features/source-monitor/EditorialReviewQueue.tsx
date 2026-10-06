import { useEffect, useMemo, useState } from 'react';
import { useLocale } from '../../i18n/locale';
import { parseContentReviewManifest, type ContentReviewRow } from '../../lib/content-review';
import { useContentReviewToday, readEditorialReviewManifest } from './content-review-runtime';
import { contentReviewText, contentReviewTextStyle } from './content-review-copy';

export function EditorialReviewQueue({ today }: { today?: string }) {
  const locale = useLocale(), day = useContentReviewToday(today);
  const t = (key: Parameters<typeof contentReviewText>[0]) => contentReviewText(key, locale);
  const [manifest, setManifest] = useState<unknown>(), [failed, setFailed] = useState(false);
  const [filter, setFilter] = useState<'attention' | 'all'>('attention'), [limit, setLimit] = useState(24);
  useEffect(() => {
    const controller = new AbortController();
    void readEditorialReviewManifest(controller.signal).then(value => { if (!controller.signal.aborted) setManifest(value); }).catch(() => { if (!controller.signal.aborted) setFailed(true); });
    return () => controller.abort();
  }, []);
  const parsed = useMemo(() => { try { return manifest ? { rows: parseContentReviewManifest(manifest, day), failed: false } : null; } catch { return { rows: [], failed: true }; } }, [manifest, day]);
  const rows = parsed?.rows || [], needsReview = (row: ContentReviewRow) => ['due', 'manual-review', 'missing-date'].includes(row.status);
  const attention = rows.filter(needsReview), selected = filter === 'all' ? rows : attention;
  const statuses = { 'manual-review': '人工确认', 'missing-date': '日期缺失或无效', due: '到期复核', scheduled: '尚未到期', archived: '已归档' } as const;
  const risks = { 'health-legal-financial': '涉及医疗、法律或财务', 'time-sensitive': '日期和条件易变化', evergreen: '常青资料' } as const;
  return <section className="editorial-review-queue my-8 rounded-xl border border-baylink-border p-4" aria-label={t('内容复核队列')} style={contentReviewTextStyle} translate="no">
    <h2 style={{ ...contentReviewTextStyle, fontWeight: 700 }}>{t('内容复核队列')}</h2>
    <p style={contentReviewTextStyle}>{t('按湾区今天重新计算复核状态；排期与网页读取均不自动更新原核对日期。指南日期只表示内容更新。')} <time dateTime={day}>{day}</time></p>
    {failed || parsed?.failed ? <p role="alert">{t('复核队列暂时无法读取，请刷新重试；不能据此认定内容都已复核。')}</p> : !parsed ? <p role="status">{t('读取复核队列…')}</p> : <>
      <p style={contentReviewTextStyle}>{rows.length} {t('记录')} · {attention.length} {t('需要复核')}</p>
      <div role="group" aria-label={t('筛选复核队列')} className="flex flex-wrap gap-3 my-4">{(['attention', 'all'] as const).map(value => <button type="button" key={value} aria-pressed={filter === value} onClick={() => { setFilter(value); setLimit(24); }} className="rounded-lg border border-baylink-border px-4" style={{ ...contentReviewTextStyle, minHeight: 'var(--control-height, 2.75rem)' }}>{t(value === 'attention' ? '需要复核' : '全部记录')}</button>)}</div>
      {!selected.length ? <p>{t('当前筛选没有待处理记录；这不表示所有事实已经重新核验。')}</p> : <ol className="space-y-4">{selected.slice(0, limit).map(row => <li key={`${row.kind}:${row.id}`} className="border-b border-baylink-border pb-4">
        <p style={contentReviewTextStyle}><strong>{t(statuses[row.status])}</strong> · {t(risks[row.risk])}</p>
        <p style={contentReviewTextStyle}>{t('原始发布标题')}：<a className="underline" href={row.path}>{row.title}</a></p>
        <p style={contentReviewTextStyle}>{t(row.dateMeaning === 'content-updated' ? '内容更新日期' : '原资料核对日期')}：{row.verifiedAt || t('日期未提供')} · {t('建议下次复核')}：{row.nextReviewAt || t('日期未提供')}</p>
        <details><summary style={{ ...contentReviewTextStyle, minHeight: 'var(--control-height, 2.75rem)' }}>{t('查看官方参考资料')}</summary><ul>{row.sourceUrls.map(url => <li key={url}><a href={url} target="_blank" rel="noopener noreferrer" className="underline" style={contentReviewTextStyle}>{url}</a></li>)}</ul></details>
      </li>)}</ol>}
      {selected.length > limit && <button type="button" onClick={() => setLimit(value => value + 24)} className="rounded-lg border border-baylink-border px-4 mt-4" style={{ ...contentReviewTextStyle, minHeight: 'var(--control-height, 2.75rem)' }}>{t('显示更多复核记录')}</button>}
    </>}
  </section>;
}
