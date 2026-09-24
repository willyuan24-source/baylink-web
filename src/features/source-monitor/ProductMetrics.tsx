import { useCallback, useEffect, useRef, useState } from 'react';
import { BarChart3, RefreshCw } from 'lucide-react';
import { api } from '../../lib/api';
import { translateText, useLocale } from '../../i18n/locale';

const METRICS = [
  ['planner_recommendation', '生成出游建议'],
  ['plan_saved', '保存计划'],
  ['plan_shared', '分享计划'],
  ['official_source_click', '点击官方来源'],
  ['favorite_saved', '加入收藏'],
  ['planner_map_opened', '打开互动地图'],
] as const;
type MetricKey = typeof METRICS[number][0];
type MetricsSummary = { days: number; from: string; through: string; counts: Record<MetricKey, number> };
const isSummary = (value: unknown): value is MetricsSummary => {
  if (!value || typeof value !== 'object') return false;
  const result = value as Partial<MetricsSummary>;
  return result.days === 30 && typeof result.from === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(result.from)
    && typeof result.through === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(result.through) && !!result.counts
    && METRICS.every(([key]) => Number.isSafeInteger(result.counts?.[key]) && result.counts![key] >= 0);
};

/** Embedded only in the admin workspace; authorization is also enforced by the API. */
export function ProductMetrics() {
  const locale = useLocale(); const t = (text: string) => translateText(text, locale);
  const [summary, setSummary] = useState<MetricsSummary | null>(null);
  const [loading, setLoading] = useState(true); const [error, setError] = useState(false);
  const request = useRef<AbortController>();
  const load = useCallback(async () => {
    request.current?.abort(); const controller = new AbortController(); request.current = controller;
    setLoading(true); setError(false);
    try {
      const result: unknown = await api.request('/admin/product-metrics', { signal: controller.signal });
      if (controller.signal.aborted || request.current !== controller) return;
      if (!isSummary(result)) throw new Error('invalid-metrics-response');
      setSummary(result);
    } catch { if (!controller.signal.aborted && request.current === controller) setError(true); }
    finally { if (!controller.signal.aborted && request.current === controller) setLoading(false); }
  }, []);
  useEffect(() => { void load(); return () => request.current?.abort(); }, [load]);
  return <section className="product-metrics" aria-labelledby="product-metrics-title" aria-busy={loading}>
    <div className="product-metrics-heading"><div><p className="source-monitor-eyebrow"><BarChart3 size={15} />{t('功能使用统计')}</p><h2 id="product-metrics-title">{t('最近 30 天的操作次数')}</h2></div><button type="button" disabled={loading} onClick={() => void load()}><RefreshCw size={14} />{t('刷新统计')}</button></div>
    <p className="product-metrics-explainer">{t('仅保存按日汇总的匿名计数，不识别用户。同一人可产生多次操作；这些数值不是用户人数、转化率或回访率。')}</p>
    {loading ? <p role="status" className="product-metrics-note">{t('正在读取使用统计…')}</p> : error ? <div className="product-metrics-error"><p role="alert">{t('暂时无法读取使用统计，未将缺失数据记为零。')}</p><button type="button" onClick={() => void load()}>{t('重试统计')}</button></div> : summary && <>
      <p className="product-metrics-note">{summary.from} — {summary.through} · {t('湾区日期，包含今天')}</p>
      <dl className="product-metrics-grid">{METRICS.map(([key, label]) => <div key={key}><dt>{t(label)}</dt><dd>{summary.counts[key].toLocaleString(locale === 'en' ? 'en-US' : 'zh-CN')}</dd></div>)}</dl>
    </>}
  </section>;
}
