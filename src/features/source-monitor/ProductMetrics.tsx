import { useCallback, useEffect, useRef, useState } from 'react';
import { BarChart3, RefreshCw } from 'lucide-react';
import { api } from '../../lib/api';
import { translateText, useLocale } from '../../i18n/locale';

const REQUIRED_METRICS = [
  ['planner_recommendation', '生成出游建议'],
  ['plan_saved', '保存计划'],
  ['plan_shared', '分享计划'],
  ['official_source_click', '点击官方来源'],
  ['favorite_saved', '加入收藏'],
  ['planner_map_opened', '打开互动地图'],
  ['planner_outing_adopted', '采用完整出游方案'],
  ['planner_edit_applied', '采用一句话修改'],
  ['planner_web_search', '完成站外搜索'],
] as const;
const METRICS = [...REQUIRED_METRICS,
  ['page_view', '页面访问次数'], ['site_source_direct', '直接访问入口'],
  ['site_source_search', '搜索引擎入口'], ['site_source_wechat', '微信入口'],
  ['site_source_social', '社交平台入口'], ['site_source_card', '分享卡入口'],
  ['site_source_opus', '游戏入口'], ['site_source_other', '其他入口'],
  ['nav_click', '点击导航'], ['home_module_click', '点击首页模块'],
  ['search_submitted', '提交搜索'], ['search_zero_result', '搜索无结果'],
  ['event_detail_open', '打开活动详情'], ['ics_download', '下载日历'],
  ['share_card_download', '下载分享卡'], ['baybay_ask', '向 BayBay 提问'],
  ['baybay_degraded', 'BayBay 降级回答'], ['baybay_fast', 'BayBay 快速回答'],
  ['baybay_slow', 'BayBay 较慢回答'], ['baybay_helpful', '回答有帮助'],
  ['baybay_unhelpful', '回答没有帮助'], ['signup_gate', '遇到登录入口'],
  ['signup_completed', '成功创建账号'],
  ['contact_click', '点击联系'], ['message_first_sent', '首次发送消息'],
  ['message_request_started', '新增真实联系对话'], ['owner_reply_24h', '发布者在 24 小时内回复'],
  ['newsletter_signup', '提交邮件订阅意向'],
  ['opus_title', '打开游戏标题页'], ['opus_first_card', '取得首张游戏卡'],
  ['opus_visit_new', '游戏记录的新访客'], ['opus_tour_done', '完成游戏导览'],
  ['opus_share_photo', '分享游戏照片'], ['opus_share_card', '分享游戏卡'],
] as const;
/** WEB-FEEDBACK counters: BayBay answer time buckets and the feedback funnel (labels carry their English). */
const FEEDBACK_METRICS = [
  { key: 'baybay_latency_lt3', zh: 'BayBay 3 秒内答完', en: 'BayBay answered within 3 s' },
  { key: 'baybay_latency_3to8', zh: 'BayBay 3–8 秒答完', en: 'BayBay answered in 3–8 s' },
  { key: 'baybay_latency_8to15', zh: 'BayBay 8–15 秒答完', en: 'BayBay answered in 8–15 s' },
  { key: 'baybay_latency_gt15', zh: 'BayBay 超过 15 秒', en: 'BayBay took over 15 s' },
  { key: 'feedback_open', zh: '打开反馈表', en: 'Feedback form opened' },
  { key: 'feedback_sent', zh: '发送反馈', en: 'Feedback sent' },
] as const;
/**
 * Retired: page errors were counted here until the error beacon took over (the 前端报错 panel below). The tile stays only while
 * the 30-day window still holds old counts, so it can never read as "no errors" next to the panel.
 */
const RETIRED_METRICS = [
  { key: 'client_error', zh: '客户端错误（旧计数，已停用；现见下方「前端报错」）', en: 'Client errors (old counter, retired; see Browser errors below)' },
] as const;
type MetricKey = typeof METRICS[number][0] | typeof FEEDBACK_METRICS[number]['key'] | typeof RETIRED_METRICS[number]['key'];
const isCount = (value: unknown) => value === undefined || (Number.isSafeInteger(value) && (value as number) >= 0);
type RouteRow = { event: string; route: string; count: number };
type MetricsSummary = { days: number; from: string; through: string; counts: Partial<Record<MetricKey, number>>; routes?: RouteRow[] | null; routesTruncated?: boolean };
const isSummary = (value: unknown): value is MetricsSummary => {
  if (!value || typeof value !== 'object') return false;
  const result = value as Partial<MetricsSummary>;
  return result.days === 30 && typeof result.from === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(result.from)
    && typeof result.through === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(result.through) && !!result.counts
    && REQUIRED_METRICS.every(([key]) => Number.isSafeInteger(result.counts?.[key]) && result.counts![key]! >= 0)
    && [...METRICS.map(([key]) => key), ...FEEDBACK_METRICS.map(metric => metric.key), ...RETIRED_METRICS.map(metric => metric.key)].every(key => isCount(result.counts?.[key]))
    && (result.routes == null || (Array.isArray(result.routes) && result.routes.every(row => !!row && typeof row.event === 'string' && typeof row.route === 'string' && Number.isSafeInteger(row.count))));
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
    <p className="product-metrics-note">{t('新增的访问、来源与回复指标自此次上线开始记录；此前未记录的数据不会补造。')}</p>
    {loading ? <p role="status" className="product-metrics-note">{t('正在读取使用统计…')}</p> : error ? <div className="product-metrics-error"><p role="alert">{t('暂时无法读取使用统计，未将缺失数据记为零。')}</p><button type="button" onClick={() => void load()}>{t('重试统计')}</button></div> : summary && <>
      <p className="product-metrics-note">{summary.from} — {summary.through} · {t('湾区日期，包含今天')}</p>
      <dl className="product-metrics-grid">{METRICS.map(([key, label]) => <div key={key}><dt>{t(label)}</dt><dd>{summary.counts[key]?.toLocaleString(locale === 'en' ? 'en-US' : 'zh-CN') ?? '—'}</dd></div>)}
        {[...FEEDBACK_METRICS, ...RETIRED_METRICS.filter(metric => (summary.counts[metric.key] ?? 0) > 0)].map(metric => <div key={metric.key}><dt>{locale === 'en' ? metric.en : t(metric.zh)}</dt><dd>{summary.counts[metric.key]?.toLocaleString(locale === 'en' ? 'en-US' : 'zh-CN') ?? '—'}</dd></div>)}</dl>
      <PageViewsByRoute rows={summary.routes} truncated={!!summary.routesTruncated} />
    </>}
  </section>;
}

/** Page views per route template (G10). Absent until the API reports routes; never a per-URL list. */
function PageViewsByRoute({ rows, truncated }: { rows?: RouteRow[] | null; truncated: boolean }) {
  const locale = useLocale();
  const copy = (zh: string, en: string) => locale === 'en' ? en : translateText(zh, locale);
  if (!rows) return null;
  const views = rows.filter(row => row.event === 'page_view').sort((a, b) => b.count - a.count).slice(0, 30);
  return <table className="feedback-admin-table product-metrics-routes"><caption>{copy('按页面类型的浏览次数（前 30）', 'Page views by page type (top 30)')}{truncated ? ` · ${copy('按日明细已截断', 'daily detail truncated')}` : ''}</caption>
    <thead><tr><th scope="col">{copy('页面类型', 'Page type')}</th><th scope="col">{copy('浏览次数', 'Views')}</th></tr></thead>
    <tbody>{views.length ? views.map(row => <tr key={row.route}><td><code>{row.route}</code></td><td>{row.count.toLocaleString(locale === 'en' ? 'en-US' : 'zh-CN')}</td></tr>) : <tr><td colSpan={2}>{copy('还没有按页面记录的浏览。', 'No page views by page type yet.')}</td></tr>}</tbody>
  </table>;
}
