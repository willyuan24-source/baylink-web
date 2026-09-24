import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, Check, ExternalLink, RefreshCw, ShieldCheck } from 'lucide-react';
import { api } from '../../lib/api';
import { translateText, useLocale } from '../../i18n/locale';
import { ProductMetrics } from './ProductMetrics';

type SourceRow = {
  id: string; title: string; url: string; kind: string; endDate?: string;
  status: string; errorCode: string; lastFetchedAt: number | null; lastAttemptAt: number | null;
  reviewStatus: string; lastReviewedAt: number | null; reviewNote: string; hash: string;
  pendingChange: null | { before: string; after: string; removed: string[]; added: string[]; summary: string; detectedAt: number };
};
const STATUS: Record<string, string> = {
  'not-checked': '尚未检查', baseline: '已建立基线', unchanged: '正文未变化', changed: '正文有变化',
  'manual-required': '需要人工查看', error: '抓取失败', expired: '日期已过，停止检查',
};

export function AdminSourceMonitor({ onBack }: { onBack?: () => void }) {
  const locale = useLocale(); const t = (text: string) => translateText(text, locale);
  const [sources, setSources] = useState<SourceRow[]>([]);
  const [running, setRunning] = useState(false); const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(''); const [message, setMessage] = useState('');
  const [filter, setFilter] = useState<'attention' | 'all'>('attention');
  const [notes, setNotes] = useState<Record<string, string>>({});
  const requestId = useRef(0);
  const load = useCallback(async () => {
    const sequence = ++requestId.current;
    try {
      const result = await api.request('/admin/source-monitor');
      if (sequence !== requestId.current) return;
      setSources(result.sources); setRunning(result.running); setMessage('');
    } catch { if (sequence === requestId.current) setMessage('无法读取来源监测，请稍后重试。'); }
    finally { if (sequence === requestId.current) setLoading(false); }
  }, []);
  useEffect(() => { void load(); return () => { requestId.current++; }; }, [load]);
  useEffect(() => { if (!running) return; const timer = window.setInterval(() => { void load(); }, 7000); return () => window.clearInterval(timer); }, [load, running]);
  const stamp = (value: number | null) => value ? new Intl.DateTimeFormat(locale === 'en' ? 'en-US' : 'zh-CN', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'America/Los_Angeles' }).format(value) : t('尚无记录');
  const needsAttention = (row: SourceRow) => row.status !== 'expired' && (row.reviewStatus === 'pending' || ['manual-required', 'error'].includes(row.status));
  const attention = sources.filter(needsAttention);
  const displayed = filter === 'all' ? sources : attention;
  const run = async () => {
    setBusy('run'); setMessage('');
    try { await api.request('/admin/source-monitor/run', { method: 'POST', body: '{}' }); setRunning(true); await load(); }
    catch { setMessage('检查未启动，可能已有批次在运行。请刷新查看。'); }
    finally { setBusy(''); }
  };
  const review = async (row: SourceRow, decision: 'acknowledged' | 'dismissed') => {
    setBusy(row.id); setMessage('');
    try {
      await api.request(`/admin/source-monitor/${row.id}/review`, { method: 'PATCH', body: JSON.stringify({ expectedHash: row.hash, decision, note: notes[row.id] || '' }) });
      await load();
    } catch { setMessage('复核未保存，内容可能已变化。请刷新后再次查看。'); }
    finally { setBusy(''); }
  };
  return <section className="source-monitor" aria-labelledby="source-monitor-title">
    <header className="source-monitor-header">
      <div>{onBack && <button onClick={onBack} className="source-monitor-back"><ArrowLeft size={16} />{t('返回')}</button>}
        <p className="source-monitor-eyebrow"><ShieldCheck size={16} />{t('编辑工作台')}</p>
        <h1 id="source-monitor-title">{t('官方来源监测')}</h1>
        <p>{t('每 6 小时检查已登记来源。抓取成功仅表示页面可读，事实与条款仍由编辑复核。')}</p>
      </div>
      <div className="source-monitor-actions"><button onClick={() => void load()} disabled={loading || !!busy}><RefreshCw size={15} />{t('刷新')}</button>
        <button className="source-monitor-primary" disabled={running || !!busy || loading} onClick={() => void run()}>{running ? t('正在检查…') : t('现在检查')}</button></div>
    </header>
    <ProductMetrics />
    <div className="source-monitor-summary"><span><strong>{sources.length}</strong> {t('个官方来源')}</span><span><strong>{attention.length}</strong> {t('项需处理')}</span><span>{running ? t('后台批次运行中，可稍后回来查看。') : t('首次抓取建立基线，不自动更新内容核查日期。')}</span></div>
    <div className="source-monitor-filters" aria-label={t('筛选来源')}><button aria-pressed={filter === 'attention'} onClick={() => setFilter('attention')}>{t('需要处理')}</button><button aria-pressed={filter === 'all'} onClick={() => setFilter('all')}>{t('全部来源')}</button></div>
    {message && <p role="alert" className="source-monitor-error">{t(message)}</p>}
    {loading ? <p role="status">{t('正在加载…')}</p> : !displayed.length ? <p className="source-monitor-empty">{t('目前没有待处理的来源变化。尚未抓取的来源可在全部来源中查看。')}</p> : <div className="source-monitor-list">{displayed.map(row => <article className="source-monitor-card" key={row.id}>
      <div className="source-monitor-card-top"><div><span className={`source-monitor-status ${needsAttention(row) ? 'is-attention' : ''}`}>{t(STATUS[row.status] || '尚未检查')}{row.reviewStatus === 'pending' && row.status !== 'changed' ? ` · ${t('有变化待复核')}` : ''}</span><h2>{t(row.title)}</h2></div><a href={row.url} target="_blank" rel="noopener noreferrer">{t('查看官方页面')} <ExternalLink size={14} /></a></div>
      <dl className="source-monitor-dates"><div><dt>{t('最近尝试')}</dt><dd>{stamp(row.lastAttemptAt)}</dd></div><div><dt>{t('最近成功抓取')}</dt><dd>{stamp(row.lastFetchedAt)}</dd></div><div><dt>{t('编辑复核')}</dt><dd>{stamp(row.lastReviewedAt)}</dd></div>{row.endDate && <div><dt>{t('内容截止日期')}</dt><dd>{row.endDate}</dd></div>}</dl>
      {row.errorCode && <p className="source-monitor-note">{t('页面可能阻止自动访问、需要 JavaScript 或暂时不可用，请手动查看。此状态不代表活动取消。')} <code>{row.errorCode}</code></p>}
      {row.pendingChange && <details className="source-monitor-evidence" open={row.reviewStatus === 'pending'}><summary>{t('查看正文变化证据')}</summary><div className="source-monitor-diff"><div><h3>{t('之前的内容')}</h3>{row.pendingChange.removed.map((line, index) => <p key={index}>{line}</p>)}</div><div><h3>{t('现在的内容')}</h3>{row.pendingChange.added.map((line, index) => <p key={index}>{line}</p>)}</div></div><details><summary>{t('查看保存的完整正文')}</summary><div className="source-monitor-diff"><pre>{row.pendingChange.before}</pre><pre>{row.pendingChange.after}</pre></div></details></details>}
      {row.reviewStatus === 'pending' && <div className="source-monitor-review"><label htmlFor={`note-${row.id}`}>{t('复核备注')}</label><textarea id={`note-${row.id}`} maxLength={500} rows={2} placeholder={t('记录官网确认结果，以及需要修改的站内内容。')} value={notes[row.id] || ''} onChange={event => setNotes(previous => ({ ...previous, [row.id]: event.target.value }))} /><p>{t('确认复核只记录处理结果，不会自动修改站内活动、优惠或原核查日期。')}</p><div className="source-monitor-actions"><button className="source-monitor-primary" disabled={!!busy} onClick={() => void review(row, 'acknowledged')}><Check size={15} />{t('已查看并确认')}</button><button disabled={!!busy} onClick={() => void review(row, 'dismissed')}>{t('标记为无关变化')}</button></div></div>}
      {row.reviewStatus !== 'pending' && row.reviewNote && <p className="source-monitor-note">{t('复核备注')}：{row.reviewNote}</p>}
    </article>)}</div>}
  </section>;
}
