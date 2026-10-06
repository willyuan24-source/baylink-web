import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { translateText, useLocale } from '../../i18n/locale';
import { contentReviewTextStyle } from './content-review-copy';

type Freshness = { sourceId: string; lastFetchedAt: number | null; needsReview: boolean; status: string };
/** Optional provenance hint: network availability never blocks the original source link. */
export function SourceFreshness({ contentId }: { contentId: string }) {
  const locale = useLocale(); const [snapshot, setSnapshot] = useState<{ rows: Freshness[]; receivedAt: number }>({ rows: [], receivedAt: 0 });
  useEffect(() => {
    const controller = new AbortController();
    setSnapshot({ rows: [], receivedAt: 0 });
    api.request(`/sources/freshness?ids=${encodeURIComponent(contentId)}`, { signal: controller.signal })
      .then(result => { if (!controller.signal.aborted) setSnapshot({ rows: Array.isArray(result.sources) ? result.sources : [], receivedAt: Date.now() }); }).catch(() => {});
    return () => controller.abort();
  }, [contentId]);
  const active = snapshot.rows.filter(row => row && row.status !== 'expired');
  if (!active.length) return null;
  const needsReview = active.some(row => row.needsReview);
  const uncertain = active.some(row => !['baseline', 'unchanged', 'changed'].includes(row.status) || !Number.isFinite(row.lastFetchedAt) || !row.lastFetchedAt || row.lastFetchedAt < 0 || row.lastFetchedAt > snapshot.receivedAt);
  const text = needsReview
    ? locale === 'en' ? 'Official pages have changed and need editorial review. Check official information before going.' : translateText('官方页面有变化，待编辑复核；出发前请查看官方信息。', locale)
    : uncertain ? locale === 'en' ? 'Some official sources have not been read successfully, or their latest automatic check was incomplete. Consult official information.' : translateText('部分官方来源尚未成功读取或最新自动检查未完成，请查看官方信息。', locale)
    : locale === 'en' ? 'Official page fetch date (oldest across sources; not factual verification)' : translateText('官方页面抓取日期（多来源取最早，不代表事实核验）', locale);
  const earliest = !needsReview && !uncertain ? Math.min(...active.map(row => row.lastFetchedAt!)) : null;
  const date = earliest ? new Intl.DateTimeFormat(locale === 'en' ? 'en-US' : 'zh-CN', { month: 'short', day: 'numeric', timeZone: 'America/Los_Angeles' }).format(earliest) : null;
  return <p className={`source-freshness ${needsReview || uncertain ? 'has-change' : ''}`} style={contentReviewTextStyle} translate="no">{text}{date && <> · <time dateTime={new Date(earliest!).toISOString()}>{date}</time></>}</p>;
}
