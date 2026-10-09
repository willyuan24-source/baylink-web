import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, MessageSquareText, RefreshCw, Trash2 } from 'lucide-react';
import { api } from '../../lib/api';
import { useLocale } from '../../i18n/locale';
import { confirmDialog } from '../../components/ui/confirm';
import { REASON_LABELS, say, type Copy } from './feedback-copy';
import { useFeedbackAdminStyles } from './entry-styles';

/**
 * Admin views of the G9 feedback rows and the error beacon (GET /api/admin/feedback, /api/admin/client-errors). The
 * API enforces the admin role; reader text is shown as plain text only (React escapes it, translate="no").
 */
type FeedbackItem = {
  id: string; kind: 'page' | 'content' | 'baybay'; reason: string; route: string; text: string; contact?: string;
  entity?: { kind: string; id: string }; locale: string; readingSize: string; release: string; createdAt: string;
};
type FeedbackList = { items: FeedbackItem[]; nextBefore?: string; retentionDays: number };
type ErrorGroup = { kind: string; route: string; release: string; fp: string; count: number; firstDay: string; lastDay: string };
type ErrorReport = { days: number; from: string; through: string; total: number; groups: ErrorGroup[]; groupsTruncated: boolean; daily: { day: string; kind: string; count: number }[] };

const KIND_LABELS: Record<string, Copy> = {
  page: { zh: '网站反馈', en: 'Site feedback' }, content: { zh: '信息有误', en: 'Content error' }, baybay: { zh: 'BayBay', en: 'BayBay' },
  render: { zh: '页面渲染出错', en: 'Render error' }, error: { zh: '脚本错误', en: 'Script error' }, rejection: { zh: '未处理的异步错误', en: 'Unhandled rejection' }, chunk: { zh: '代码加载失败', en: 'Code failed to load' },
};
const ENTITY_PATHS: Record<string, string> = { event: '/events/', offer: '/offers/', opening: '/openings/', guide: '/guides/' };
const isFeedbackList = (value: unknown): value is FeedbackList => !!value && typeof value === 'object' && Array.isArray((value as FeedbackList).items);
const isErrorReport = (value: unknown): value is ErrorReport => !!value && typeof value === 'object' && Array.isArray((value as ErrorReport).groups) && Array.isArray((value as ErrorReport).daily);

export function ReaderFeedbackPanel() {
  const locale = useLocale();
  useFeedbackAdminStyles();
  const t = (copy: Copy) => say(copy, locale);
  const [kind, setKind] = useState<'' | 'page' | 'content' | 'baybay'>('');
  const [items, setItems] = useState<FeedbackItem[]>([]);
  const [next, setNext] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const request = useRef(0);
  const load = useCallback(async (before?: string) => {
    const sequence = ++request.current;
    setLoading(true); setError(false);
    const query = new URLSearchParams({ limit: '50', ...(kind ? { kind } : {}), ...(before ? { before } : {}) });
    try {
      const result: unknown = await api.request(`/admin/feedback?${query}`);
      if (sequence !== request.current) return;
      if (!isFeedbackList(result)) throw new Error('invalid-feedback-list');
      setItems(previous => before ? [...previous, ...result.items] : result.items);
      setNext(result.nextBefore);
    } catch { if (sequence === request.current) setError(true); }
    finally { if (sequence === request.current) setLoading(false); }
  }, [kind]);
  useEffect(() => { const sequence = request; void load(); return () => { sequence.current++; }; }, [load]);
  const remove = async (item: FeedbackItem) => {
    if (!await confirmDialog({ message: t({ zh: '删除这条反馈？删除后无法恢复。', en: 'Delete this feedback? This cannot be undone.' }), danger: true, confirmText: t({ zh: '删除', en: 'Delete' }) })) return;
    try { await api.request(`/admin/feedback/${encodeURIComponent(item.id)}`, { method: 'DELETE' }); setItems(previous => previous.filter(entry => entry.id !== item.id)); }
    catch { setError(true); }
  };
  const stamp = (value: string) => new Intl.DateTimeFormat(locale === 'en' ? 'en-US' : 'zh-CN', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'America/Los_Angeles' }).format(new Date(value));
  return <section className="feedback-admin" aria-labelledby="reader-feedback-title" aria-busy={loading}>
    <div className="feedback-admin-heading"><div><p className="source-monitor-eyebrow"><MessageSquareText size={15} />{t({ zh: '读者反馈', en: 'Reader feedback' })}</p><h2 id="reader-feedback-title">{t({ zh: '最近 90 天的反馈', en: 'Feedback from the last 90 days' })}</h2></div>
      <button type="button" disabled={loading} onClick={() => void load()}><RefreshCw size={14} />{t({ zh: '刷新', en: 'Refresh' })}</button></div>
    <div className="feedback-admin-filters" role="group" aria-label={t({ zh: '按类型筛选', en: 'Filter by type' })}>
      {(['', 'page', 'content', 'baybay'] as const).map(value => <button key={value || 'all'} type="button" aria-pressed={kind === value} onClick={() => setKind(value)}>{value ? t(KIND_LABELS[value]) : t({ zh: '全部', en: 'All' })}</button>)}
    </div>
    {error && <p role="alert" className="feedback-admin-error">{t({ zh: '暂时无法读取或删除反馈，请稍后重试。', en: 'Feedback could not be loaded or deleted. Please try again.' })}</p>}
    {!loading && !error && !items.length && <p className="feedback-admin-note">{t({ zh: '还没有反馈。', en: 'No feedback yet.' })}</p>}
    <ol className="feedback-admin-list">{items.map(item => <li key={item.id}>
      <div className="feedback-admin-meta"><strong>{t(KIND_LABELS[item.kind] || { zh: item.kind, en: item.kind })} · {t(REASON_LABELS[item.reason] || { zh: item.reason, en: item.reason })}</strong>
        <span><time dateTime={item.createdAt}>{stamp(item.createdAt)}</time> · <code>{item.route}</code> · {item.locale} · {item.readingSize} · <code>{item.release}</code></span></div>
      {item.entity && <p className="feedback-admin-entity">{ENTITY_PATHS[item.entity.kind] ? <a href={`${ENTITY_PATHS[item.entity.kind]}${encodeURIComponent(item.entity.id)}`} target="_blank" rel="noopener" translate="no">{item.entity.kind}/{item.entity.id}</a> : <code>{item.entity.kind}/{item.entity.id}</code>}</p>}
      {item.text && <p className="feedback-admin-text" translate="no">{item.text}</p>}
      {item.contact && <p className="feedback-admin-contact">{t({ zh: '联系方式：', en: 'Contact: ' })}<span translate="no">{item.contact}</span></p>}
      <button type="button" className="feedback-admin-delete" onClick={() => void remove(item)}><Trash2 size={14} aria-hidden="true" />{t({ zh: '删除', en: 'Delete' })}</button>
    </li>)}</ol>
    {next && <button type="button" className="feedback-admin-more" disabled={loading} onClick={() => void load(next)}>{t({ zh: '加载更早的反馈', en: 'Load older feedback' })}</button>}
  </section>;
}

export function ClientErrorsPanel() {
  const locale = useLocale();
  useFeedbackAdminStyles();
  const t = (copy: Copy) => say(copy, locale);
  const [report, setReport] = useState<ErrorReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const request = useRef(0);
  const load = useCallback(async () => {
    const sequence = ++request.current;
    setLoading(true); setError(false);
    try {
      const result: unknown = await api.request('/admin/client-errors');
      if (sequence !== request.current) return;
      if (!isErrorReport(result)) throw new Error('invalid-error-report');
      setReport(result);
    } catch { if (sequence === request.current) setError(true); }
    finally { if (sequence === request.current) setLoading(false); }
  }, []);
  useEffect(() => { const sequence = request; void load(); return () => { sequence.current++; }; }, [load]);
  const recent = report ? report.daily.slice(-14) : [];
  return <section className="feedback-admin" aria-labelledby="client-errors-title" aria-busy={loading}>
    <div className="feedback-admin-heading"><div><p className="source-monitor-eyebrow"><AlertTriangle size={15} />{t({ zh: '前端报错', en: 'Browser errors' })}</p><h2 id="client-errors-title">{t({ zh: '最近 30 天的页面错误', en: 'Page errors in the last 30 days' })}</h2></div>
      <button type="button" disabled={loading} onClick={() => void load()}><RefreshCw size={14} />{t({ zh: '刷新', en: 'Refresh' })}</button></div>
    <p className="feedback-admin-note">{t({ zh: '只有错误类型、页面类型、网站版本和摘要的每日计数，不含错误原文或网址。某个版本上线后突然增多，就该考虑回滚。', en: 'Daily counts of error type, page type, site version and fingerprint only, never the message or address. A jump right after a release is the signal to roll back.' })}</p>
    {error ? <p role="alert" className="feedback-admin-error">{t({ zh: '暂时无法读取错误统计，未将缺失数据记为零。', en: 'Error counts could not be loaded; missing data is not shown as zero.' })}</p> : report && <>
      <p className="feedback-admin-note">{report.from} — {report.through} · {t({ zh: '共', en: 'Total' })} <strong>{report.total.toLocaleString(locale === 'en' ? 'en-US' : 'zh-CN')}</strong></p>
      {recent.length > 0 && <table className="feedback-admin-table"><caption>{t({ zh: '最近 14 天', en: 'Last 14 days' })}</caption><thead><tr><th scope="col">{t({ zh: '日期', en: 'Day' })}</th><th scope="col">{t({ zh: '类型', en: 'Type' })}</th><th scope="col">{t({ zh: '次数', en: 'Count' })}</th></tr></thead>
        <tbody>{recent.map(row => <tr key={`${row.day}-${row.kind}`}><td>{row.day}</td><td>{t(KIND_LABELS[row.kind] || { zh: row.kind, en: row.kind })}</td><td>{row.count}</td></tr>)}</tbody></table>}
      {report.groups.length > 0 ? <table className="feedback-admin-table"><caption>{t({ zh: '最常见的错误', en: 'Most frequent errors' })}{report.groupsTruncated ? ` · ${t({ zh: '只显示前 200 组', en: 'top 200 groups only' })}` : ''}</caption>
        <thead><tr><th scope="col">{t({ zh: '类型', en: 'Type' })}</th><th scope="col">{t({ zh: '页面', en: 'Page' })}</th><th scope="col">{t({ zh: '版本', en: 'Release' })}</th><th scope="col">{t({ zh: '摘要', en: 'Fingerprint' })}</th><th scope="col">{t({ zh: '次数', en: 'Count' })}</th><th scope="col">{t({ zh: '首次 – 最近', en: 'First – last' })}</th></tr></thead>
        <tbody>{report.groups.map(group => <tr key={`${group.kind}-${group.route}-${group.release}-${group.fp}`}><td>{t(KIND_LABELS[group.kind] || { zh: group.kind, en: group.kind })}</td><td><code>{group.route}</code></td><td><code>{group.release}</code></td><td><code>{group.fp}</code></td><td>{group.count}</td><td>{group.firstDay} – {group.lastDay}</td></tr>)}</tbody></table>
        : <p className="feedback-admin-note">{t({ zh: '这段时间没有记录到页面错误。', en: 'No page errors were recorded in this period.' })}</p>}
    </>}
  </section>;
}
