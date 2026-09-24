import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { translateText, useLocale } from '../../i18n/locale';

type Freshness = { sourceId: string; lastFetchedAt: number | null; needsReview: boolean; status: string };
/** Optional provenance hint: network availability never blocks the original source link. */
export function SourceFreshness({ contentId }: { contentId: string }) {
  const locale = useLocale(); const [row, setRow] = useState<Freshness | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    setRow(null);
    api.request(`/sources/freshness?ids=${encodeURIComponent(contentId)}`, { signal: controller.signal })
      .then(result => { if (!controller.signal.aborted) setRow(result.sources?.[0] || null); }).catch(() => {});
    return () => controller.abort();
  }, [contentId]);
  if (!row?.lastFetchedAt || row.status === 'expired') return null;
  const date = new Intl.DateTimeFormat(locale === 'en' ? 'en-US' : 'zh-CN', { month: 'short', day: 'numeric', timeZone: 'America/Los_Angeles' }).format(row.lastFetchedAt);
  const text = row.needsReview ? '官方页面有变化，待编辑复核；出发前请查看官方信息。' : ['error', 'manual-required'].includes(row.status) ? '最新自动检查未完成，请查看官方信息。' : '最近成功读取官方页面';
  return <p className={`source-freshness ${row.needsReview ? 'has-change' : ''}`}>{translateText(text, locale)}{!row.needsReview && !['error', 'manual-required'].includes(row.status) ? ` · ${date}` : ''}</p>;
}
