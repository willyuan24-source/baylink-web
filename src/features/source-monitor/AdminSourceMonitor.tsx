import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Check, ExternalLink, RefreshCw, ShieldCheck, X } from 'lucide-react';
import { api } from '../../lib/api';
import { translateText, useLocale } from '../../i18n/locale';
import { ProductMetrics } from './ProductMetrics';
import { EditorialReviewQueue } from './EditorialReviewQueue';
import { MediaCandidateQueue } from './MediaCandidateQueue';
import { changedAtOf, currentTriage, hoursWaiting, isPending, readersSeeIt, triageQueue, TRIAGE_FIELD_LABELS, type AdminSourceRow, type TriageState } from './source-triage-queue';
import './source-monitor-admin.css';
// Reader feedback and browser errors (WEB-FEEDBACK) load only when an admin opens the workspace.
const ReaderFeedbackPanel = lazy(() => import('../feedback/FeedbackAdminPanels').then(module => ({ default: module.ReaderFeedbackPanel })));
const ClientErrorsPanel = lazy(() => import('../feedback/FeedbackAdminPanels').then(module => ({ default: module.ClientErrorsPanel })));

type Copy = (zh: string, en: string) => string;
type Pair = { zh: string; en: string };
type Tab = 'queue' | 'unreadable' | 'images' | 'all';
const STATUS: Record<string, Pair> = {
  'not-checked': { zh: '尚未检查', en: 'Not checked' }, baseline: { zh: '已建立基线', en: 'Baseline saved' }, unchanged: { zh: '正文未变化', en: 'Text unchanged' },
  changed: { zh: '正文有变化', en: 'Text changed' }, 'manual-required': { zh: '需要人工查看', en: 'Manual check needed' }, error: { zh: '抓取失败', en: 'Fetch failed' },
  expired: { zh: '日期已过，停止检查', en: 'Ended; checks stopped' },
};
const TRIAGE_OFF: Record<string, Pair> = {
  'flag-off': { zh: '自动分诊未开启（SOURCE_TRIAGE 为 off）', en: 'Automatic triage is off (SOURCE_TRIAGE=off)' },
  'no-key': { zh: '自动分诊缺少 API 密钥', en: 'Automatic triage has no API key' },
  'anthropic-use-until-passed': { zh: '自动分诊已过 AI 使用截止日期', en: 'Automatic triage passed the AI use-until date' },
};

/**
 * The editor's source desk (WEB-FRESH-ADMIN, plan §3.3). Material-first: possible cancellations, then material changes
 * oldest first (readers see "主办方页面有更新" once one has waited 48 hours), then changes triage has not judged. Each change
 * is confirmed or dismissed in one click through the existing PATCH; the note is optional. The organiser-image queue and
 * the unreadable sources have their own views. Nothing here edits site content or a verified date.
 */
export function AdminSourceMonitor({ onBack }: { onBack?: () => void }) {
  const locale = useLocale();
  const t: Copy = (zh, en) => locale === 'en' ? en : translateText(zh, locale);
  const [sources, setSources] = useState<AdminSourceRow[]>([]);
  const [triage, setTriage] = useState<TriageState | null>(null);
  const [batchLimit, setBatchLimit] = useState(40);
  const [loadedAt, setLoadedAt] = useState(0);
  const [running, setRunning] = useState(false); const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(''); const [message, setMessage] = useState<Pair | null>(null);
  const [tab, setTab] = useState<Tab>('queue');
  const [notes, setNotes] = useState<Record<string, string>>({});
  const requestId = useRef(0);
  const load = useCallback(async () => {
    const sequence = ++requestId.current;
    try {
      const result = await api.request('/admin/source-monitor');
      if (sequence !== requestId.current) return;
      setSources(Array.isArray(result?.sources) ? result.sources : []); setRunning(!!result?.running); setMessage(null); setLoadedAt(Date.now());
      setTriage(result?.triage && typeof result.triage === 'object' ? result.triage : null);
      if (Number.isInteger(result?.batchLimit) && result.batchLimit > 0 && result.batchLimit <= 200) setBatchLimit(result.batchLimit);
    } catch { if (sequence === requestId.current) setMessage({ zh: '无法读取来源监测，请稍后重试。', en: 'Could not load source monitoring. Please try again.' }); }
    finally { if (sequence === requestId.current) setLoading(false); }
  }, []);
  useEffect(() => { void load(); return () => { requestId.current++; }; }, [load]);
  useEffect(() => { if (!running) return; const timer = window.setInterval(() => { void load(); }, 7000); return () => window.clearInterval(timer); }, [load, running]);
  const queue = useMemo(() => triageQueue(sources, loadedAt), [sources, loadedAt]);
  const run = async () => {
    setBusy('run'); setMessage(null);
    try { await api.request('/admin/source-monitor/run', { method: 'POST', body: '{}' }); setRunning(true); await load(); }
    catch { setMessage({ zh: '检查未启动，可能已有批次在运行。请刷新查看。', en: 'The check did not start; a batch may already be running. Refresh to check.' }); }
    finally { setBusy(''); }
  };
  const review = async (row: AdminSourceRow, decision: 'acknowledged' | 'dismissed') => {
    setBusy(row.id); setMessage(null);
    try {
      await api.request(`/admin/source-monitor/${row.id}/review`, { method: 'PATCH', body: JSON.stringify({ expectedHash: row.hash, decision, note: (notes[row.id] || '').trim() }) });
      await load();
    } catch { setMessage({ zh: '复核未保存，内容可能已变化。请刷新后再次查看。', en: 'The review was not saved; the content may have changed. Refresh and review it again.' }); }
    finally { setBusy(''); }
  };
  const seen = queue.material.filter(row => readersSeeIt(row, loadedAt)).length + queue.cancel.length;
  const pendingCount = queue.cancel.length + queue.material.length + queue.untriaged.length;
  const tabs: [Tab, string, number | null][] = [
    ['queue', t('待复核变化', 'Changes to review'), pendingCount], ['unreadable', t('无法读取', 'Unreadable'), queue.unreadable.length],
    ['images', t('官方图片候选', 'Organizer images'), null], ['all', t('全部来源', 'All sources'), sources.length],
  ];
  const card = (row: AdminSourceRow) => <SourceChangeCard key={row.id} row={row} now={loadedAt} t={t} locale={locale} busy={busy} note={notes[row.id] || ''}
    onNote={value => setNotes(previous => ({ ...previous, [row.id]: value }))} onReview={decision => void review(row, decision)} />;

  return <section className="source-monitor" aria-labelledby="source-monitor-title">
    <header className="source-monitor-header">
      <div>{onBack && <button type="button" onClick={onBack} className="source-monitor-back"><ArrowLeft size={16} aria-hidden="true" />{t('返回', 'Back')}</button>}
        <p className="source-monitor-eyebrow"><ShieldCheck size={16} aria-hidden="true" />{t('编辑工作台', 'Editorial desk')}</p>
        <h1 id="source-monitor-title">{t('官方来源监测', 'Official source monitor')}</h1>
        <p>{t(`来源每 6 小时分批检查，每批最多 ${batchLimit} 个。先处理可能取消或改期的，再处理重要变化：重要变化等满 48 小时，读者页面就会出现“主办方页面有更新”。确认或标记无关只记录复核结果，不会修改站内内容或核对日期。`,
          `Sources are checked in batches of up to ${batchLimit} every 6 hours. Handle possible cancellations first, then material changes: once a material change has waited 48 hours, readers see “the organizer’s page was updated”. Confirming or dismissing records the review only; it never edits site content or verified dates.`)}</p>
      </div>
      <div className="source-monitor-actions"><button type="button" onClick={() => void load()} disabled={loading || !!busy}><RefreshCw size={16} aria-hidden="true" />{t('刷新', 'Refresh')}</button>
        <button type="button" className="source-monitor-primary" disabled={running || !!busy || loading} onClick={() => void run()}>{running ? t('正在检查…', 'Checking…') : t('现在检查', 'Check now')}</button></div>
    </header>

    {triage && triage.enabled === false && <p className="source-monitor-banner" role="note">
      <strong>{TRIAGE_OFF[triage.reason || ''] ? t(TRIAGE_OFF[triage.reason || ''].zh, TRIAGE_OFF[triage.reason || ''].en) : t('自动分诊未开启', 'Automatic triage is off')}</strong>
      {t('：变化不会被判断是否重要，读者页面也不会因此出现提示。请逐条复核，或开启自动分诊。', '. Changes are not judged material or cosmetic, so readers see no prompt from them. Review them one by one, or turn triage on.')}
    </p>}
    {triage?.enabled && typeof triage.calls === 'number' && <p className="source-monitor-note">{t(`自动分诊今天已用 ${triage.calls}${triage.dailyLimit ? ` / ${triage.dailyLimit}` : ''} 次。`, `Triage used ${triage.calls}${triage.dailyLimit ? ` of ${triage.dailyLimit}` : ''} calls today.`)}</p>}

    <dl className="source-monitor-summary">
      <div data-tone={queue.cancel.length ? 'danger' : undefined}><dt>{t('可能取消或改期', 'Possible cancellations')}</dt><dd>{queue.cancel.length}</dd></div>
      <div><dt>{t('重要变化', 'Material changes')}</dt><dd>{queue.material.length}</dd></div>
      <div><dt>{t('读者已看到提示', 'Readers see a prompt')}</dt><dd>{seen}</dd></div>
      <div><dt>{t('未分诊', 'Not yet judged')}</dt><dd>{queue.untriaged.length}</dd></div>
      <div><dt>{t('无法读取', 'Unreadable')}</dt><dd>{queue.unreadable.length}</dd></div>
    </dl>

    <div className="source-monitor-filters" role="group" aria-label={t('选择视图', 'Choose a view')}>
      {tabs.map(([id, label, count]) => <button type="button" key={id} aria-pressed={tab === id} onClick={() => setTab(id)}>{label}{count !== null && <span className="source-monitor-count">{count}</span>}</button>)}
    </div>
    {message && <p role="alert" className="source-monitor-error">{t(message.zh, message.en)}</p>}

    {loading ? <p role="status">{t('正在加载…', 'Loading…')}</p> : tab === 'images' ? <MediaCandidateQueue /> : tab === 'queue' ? <>
      {!pendingCount && <p className="source-monitor-empty">{t('目前没有待复核的来源变化。无法读取的来源在“无法读取”里。', 'No source changes need review. Unreadable sources are under “Unreadable”.')}</p>}
      <QueueGroup title={t('可能取消或改期', 'Possible cancellations or new dates')} hint={t('读者页面立即显示提示框。请先打开官方页面核实。', 'Readers see a notice box at once. Check the official page first.')} rows={queue.cancel} card={card} />
      <QueueGroup title={t('重要变化', 'Material changes')} hint={t('按等待时间排列，最久的在前。', 'Oldest first.')} rows={queue.material} card={card} />
      <QueueGroup title={t('未分诊的变化', 'Changes not yet judged')} hint={t('自动分诊还没判断过这些变化（未开启、失败或尚未轮到），读者页面不显示提示。', 'Triage has not judged these (off, failed or not yet run); readers see no prompt.')} rows={queue.untriaged} card={card} />
      {queue.autoDismissed.length > 0 && <details className="source-monitor-auto">
        <summary>{t(`最近 48 小时自动忽略的无关变化（${queue.autoDismissed.length}）`, `Cosmetic changes dismissed automatically in the last 48 hours (${queue.autoDismissed.length})`)}</summary>
        <p className="source-monitor-note">{t('由自动分诊判断为无关变化，不算人工复核，也不显示给读者。抽查时如发现判断错误，请在官方页面核实后修改站内内容。', 'Judged cosmetic by automatic triage. This is not an editor review and readers never see it. If a spot check finds a mistake, verify the official page and update the listing.')}</p>
        <ul>{queue.autoDismissed.map(row => <li key={row.id}><a href={row.url} target="_blank" rel="noopener noreferrer">{row.title}</a>{row.triage?.summaryZh && <span lang="zh-Hans" translate="no"> · {row.triage.summaryZh}</span>}</li>)}</ul>
      </details>}
    </> : <div className="source-monitor-list">
      {(tab === 'unreadable' ? queue.unreadable : sources).length === 0 && <p className="source-monitor-empty">{t('这里暂时没有来源。', 'No sources here yet.')}</p>}
      {(tab === 'unreadable' ? queue.unreadable : sources).map(row => isPending(row) ? card(row) : <SourceRowCard key={row.id} row={row} t={t} locale={locale} />)}
    </div>}

    <ProductMetrics />
    <Suspense fallback={null}><ReaderFeedbackPanel /><ClientErrorsPanel /></Suspense>
    <EditorialReviewQueue />
  </section>;
}

function QueueGroup({ title, hint, rows, card }: { title: string; hint: string; rows: AdminSourceRow[]; card: (row: AdminSourceRow) => JSX.Element }) {
  if (!rows.length) return null;
  return <section className="source-monitor-group" aria-label={title}>
    <h2>{title} <span className="source-monitor-count">{rows.length}</span></h2>
    <p className="source-monitor-note">{hint}</p>
    <div className="source-monitor-list">{rows.map(card)}</div>
  </section>;
}

const stamp = (value: number | null | undefined, locale: string, none: string) => value
  ? new Intl.DateTimeFormat(locale === 'en' ? 'en-US' : 'zh-CN', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'America/Los_Angeles' }).format(value) : none;

function SourceChangeCard({ row, now, t, locale, busy, note, onNote, onReview }: {
  row: AdminSourceRow; now: number; t: Copy; locale: string; busy: string; note: string; onNote: (value: string) => void; onReview: (decision: 'acknowledged' | 'dismissed') => void;
}) {
  const triage = currentTriage(row), hours = hoursWaiting(row, now), seen = readersSeeIt(row, now);
  const cancel = !!triage?.material && !!triage.fields?.includes('cancel');
  const label = cancel ? t('可能取消或改期', 'Possible cancellation') : triage?.material ? t('重要变化', 'Material change') : t('未分诊', 'Not yet judged');
  const fields = triage?.material ? (triage.fields || []).filter(field => field !== 'cancel' && TRIAGE_FIELD_LABELS[field]) : [];
  return <article className="source-monitor-card" data-group={cancel ? 'cancel' : triage?.material ? 'material' : 'untriaged'}>
    <div className="source-monitor-card-top">
      <div>
        <p className="source-monitor-chips"><span className="source-monitor-status is-attention">{label}</span>
          {fields.map(field => <span key={field} className="source-monitor-field">{t(TRIAGE_FIELD_LABELS[field].zh, TRIAGE_FIELD_LABELS[field].en)}</span>)}
          <span className="source-monitor-field">{t((STATUS[row.status] || STATUS['not-checked']).zh, (STATUS[row.status] || STATUS['not-checked']).en)}</span></p>
        <h3>{row.title}</h3>
        {triage?.summaryZh && <p className="source-monitor-triage" lang="zh-Hans" translate="no">{triage.summaryZh}</p>}
        <p className="source-monitor-age">{changedAtOf(row) ? t(`${stamp(changedAtOf(row), locale, '')} 发现变化 · 已等 ${hours} 小时`, `Changed ${stamp(changedAtOf(row), locale, '')} · waiting ${hours} h`) : t('变化时间未知', 'Change time unknown')}
          {seen && <strong>{t(' · 读者已看到提示', ' · readers see a prompt')}</strong>}</p>
      </div>
      <a href={row.url} target="_blank" rel="noopener noreferrer">{t('查看官方页面', 'Open official page')} <ExternalLink size={16} aria-hidden="true" /></a>
    </div>
    <div className="source-monitor-actions source-monitor-decide">
      <button type="button" className="source-monitor-primary" disabled={!!busy} onClick={() => onReview('acknowledged')}><Check size={16} aria-hidden="true" />{t('已查看并确认', 'Reviewed and acknowledged')}</button>
      <button type="button" disabled={!!busy} onClick={() => onReview('dismissed')}><X size={16} aria-hidden="true" />{t('标记为无关变化', 'Dismiss as irrelevant')}</button>
    </div>
    <div className="source-monitor-review">
      <label htmlFor={`note-${row.id}`}>{t('复核备注', 'Review note')}</label>
      <textarea id={`note-${row.id}`} maxLength={500} rows={2} placeholder={t('可选：官网确认了什么、站内哪里要改。', 'Optional: what the official page confirms and what to update on the site.')} value={note} onChange={event => onNote(event.target.value)} />
    </div>
    {row.pendingChange && <details className="source-monitor-evidence" open={cancel || !!triage?.material}>
      <summary>{t('查看正文变化证据', 'View text change evidence')}</summary>
      <div className="source-monitor-diff"><div><h4>{t('之前的内容', 'Before')}</h4>{row.pendingChange.removed.map((line, index) => <p key={index}>{line}</p>)}</div><div><h4>{t('现在的内容', 'After')}</h4>{row.pendingChange.added.map((line, index) => <p key={index}>{line}</p>)}</div></div>
      <details><summary>{t('查看保存的完整正文', 'View the full saved text')}</summary><div className="source-monitor-diff"><pre>{row.pendingChange.before}</pre><pre>{row.pendingChange.after}</pre></div></details>
    </details>}
  </article>;
}

function SourceRowCard({ row, t, locale }: { row: AdminSourceRow; t: Copy; locale: string }) {
  const unreadable = row.status === 'manual-required' || row.status === 'error';
  return <article className="source-monitor-card source-monitor-card--compact">
    <div className="source-monitor-card-top">
      <div><p className="source-monitor-chips"><span className={`source-monitor-status${unreadable ? ' is-attention' : ''}`}>{t((STATUS[row.status] || STATUS['not-checked']).zh, (STATUS[row.status] || STATUS['not-checked']).en)}</span>
        {row.reviewedBy === 'auto-triage' && <span className="source-monitor-field">{t('自动分诊：无关变化', 'Auto-triage: cosmetic')}</span>}</p>
        <h3>{row.title}</h3></div>
      <a href={row.url} target="_blank" rel="noopener noreferrer">{t('查看官方页面', 'Open official page')} <ExternalLink size={16} aria-hidden="true" /></a>
    </div>
    <dl className="source-monitor-dates"><div><dt>{t('最近尝试', 'Last attempt')}</dt><dd>{stamp(row.lastAttemptAt, locale, t('尚无记录', 'No record yet'))}</dd></div>
      <div><dt>{t('最近成功读取', 'Last successful read')}</dt><dd>{stamp(row.lastFetchedAt, locale, t('尚无记录', 'No record yet'))}</dd></div>
      <div><dt>{t('编辑复核', 'Editor review')}</dt><dd>{stamp(row.lastEditorReviewAt ?? (row.reviewedBy === 'auto-triage' ? null : row.lastReviewedAt), locale, t('尚无记录', 'No record yet'))}</dd></div>
      {row.endDate && <div><dt>{t('内容截止日期', 'Content end date')}</dt><dd>{row.endDate}</dd></div>}</dl>
    {unreadable && <p className="source-monitor-note">{t('页面可能阻止自动访问、需要 JavaScript 或暂时不可用，请手动查看。此状态不代表活动取消。', 'The page may block automated access, need JavaScript, or be temporarily down. Check it by hand; this does not mean the event is cancelled.')}{row.errorCode && <> <code>{row.errorCode}</code></>}</p>}
    {row.reviewNote && <p className="source-monitor-note">{t('复核备注', 'Review note')}：<span translate="no">{row.reviewNote}</span></p>}
  </article>;
}
