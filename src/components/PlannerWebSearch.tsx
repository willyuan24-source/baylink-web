import { useEffect, useId, useRef, useState } from 'react';
import { Globe2, LoaderCircle, MapPin, CalendarDays, Ticket, LockKeyhole, ArrowUpRight } from 'lucide-react';
import { api } from '../lib/api';
import { recordProductEvent } from '../lib/product-events';
import { GUEST_WEB_CANDIDATES_KEY, loadGuestWebCandidates, parsePlannerWebResult, plannerWebAnswerParts, plannerWebMapSearchUrl, plannerWebCheckedDate, type PlannerWebCandidate, type PlannerWebResult, type SavedWebCandidate, webCandidateLibraryApi } from '../lib/planner-web-search';

type PlannerWebSearchProps = {
  query: string;
  date: string;
  region: string;
  city?: string;
  locale: 'zh-Hans' | 'zh-Hant' | 'en';
  ownerId?: string;
};

/** Changing any search input discards the previous instance and aborts its request. */
export function PlannerWebSearch(props: PlannerWebSearchProps) {
  return <PlannerWebWorkspace key={props.ownerId || 'guest'} {...props} />;
}

function PlannerWebWorkspace(props: PlannerWebSearchProps) {
  const [saved, setSaved] = useState<SavedWebCandidate[]>(() => props.ownerId ? [] : loadGuestWebCandidates());
  const [saveError, setSaveError] = useState('');
  const [revision, setRevision] = useState(0);
  const [ready, setReady] = useState(!props.ownerId);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [reload, setReload] = useState(0);
  const mounted = useRef(true);
  const writing = useRef(false);
  const activeSave = useRef<AbortController | null>(null);
  const text = (zh: string, en: string, hant: string) => props.locale === 'en' ? en : props.locale === 'zh-Hant' ? hant : zh;
  useEffect(() => {
    mounted.current = true;
    if (!props.ownerId) return () => { mounted.current = false; };
    const controller = new AbortController();
    writing.current = false; setBusy(false); setReady(false); setSaveError('');
    void webCandidateLibraryApi.load(controller.signal).then(data => {
      if (controller.signal.aborted) return;
      setSaved(data.candidates); setRevision(data.revision); setReady(true);
    }).catch(() => { if (!controller.signal.aborted) setSaveError(props.locale === 'en' ? 'Your saved candidates could not be loaded. Reload before making changes.' : props.locale === 'zh-Hant' ? '暫時無法讀取已保存候選，請重新讀取後再修改。' : '暂时无法读取已保存候选，请重新读取后再修改。'); });
    return () => { mounted.current = false; controller.abort(); activeSave.current?.abort(); };
  }, [props.ownerId, props.locale, reload]);
  async function update(next: SavedWebCandidate[]) {
    if (!ready || writing.current) return;
    writing.current = true; setBusy(true); setSaveError(''); setNotice('');
    const controller = new AbortController(); activeSave.current = controller;
    try {
      if (props.ownerId) {
        const data = await webCandidateLibraryApi.replace(next, revision, controller.signal);
        if (!mounted.current || controller.signal.aborted) return;
        setSaved(data.candidates); setRevision(data.revision);
      } else { localStorage.setItem(GUEST_WEB_CANDIDATES_KEY, JSON.stringify(next)); setSaved(next); }
      setNotice(props.ownerId ? text('已保存到账号，仅自己可见。', 'Saved to your account, visible only to you.', '已保存到帳號，僅自己可見。') : text('已保存在这个浏览器。', 'Saved in this browser.', '已保存在這個瀏覽器。'));
    } catch {
      if (!mounted.current || controller.signal.aborted) return;
      if (props.ownerId) setReady(false);
      setSaveError(props.ownerId ? text('保存未确认。请重新读取最新候选，再决定是否重试；原列表已保留。', 'Save not confirmed. Reload the latest candidates before retrying; your previous list is preserved.', '保存未確認。請重新讀取最新候選，再決定是否重試；原列表已保留。') : text('浏览器未能保存候选，请检查储存空间后重试。', 'The browser could not save your candidates. Check storage and try again.', '瀏覽器未能儲存候選，請檢查儲存空間後重試。'));
    } finally { if (mounted.current && !controller.signal.aborted) { writing.current = false; setBusy(false); } }
  }
  function save(candidate: PlannerWebCandidate, checkedAt: string | null) {
    if (!saved.some(item => item.id === candidate.id) && saved.length >= 20) { setSaveError(text('最多保留 20 个候选，请先移除不需要的项目。', 'Keep up to 20 candidates. Remove one before adding more.', '最多保留 20 個候選，請先移除不需要的項目。')); return; }
    void update([{ ...candidate, checkedAt, requestedDate: props.date || null }, ...saved.filter(item => item.id !== candidate.id)]);
  }
  const key = JSON.stringify([props.query, props.date, props.region, props.city || '', props.locale]);
  return <><PlannerWebSearchRequest key={key} {...props} saved={saved} onSave={save} saveDisabled={!ready || busy} />
    {saveError && <div className="planner-web-error" role="alert"><p>{saveError}</p>{props.ownerId && <button type="button" disabled={busy} onClick={() => setReload(value => value + 1)}>{text('重新读取候选', 'Reload candidates', '重新讀取候選')}</button>}</div>}
    {props.ownerId && !ready && !saveError && <p role="status">{text('正在读取你的私人候选…', 'Loading your private candidates…', '正在讀取你的私人候選…')}</p>}
    {notice && <p className="planner-web-save-notice" role="status">{notice}</p>}
    {saved.length > 0 && <section className="planner-web-saved" translate="no" lang={props.locale} aria-label={text('我的站外候选', 'My web candidates', '我的站外候選')}>
      <h3><LockKeyhole size={17} aria-hidden="true" />{text('我的站外候选', 'My web candidates', '我的站外候選')} · {saved.length}/20</h3>
      <p>{props.ownerId ? text('保存在你的账号，仅自己可见。保留来源和待确认事项，随时继续比较。', 'Saved to your account, visible only to you. Keep sources and open questions together.', '保存在你的帳號，僅自己可見。保留來源和待確認事項，隨時繼續比較。') : text('仅保存在这个浏览器，登录后不会自动导入账号。', 'Saved only in this browser; not automatically imported when you sign in.', '僅儲存在這個瀏覽器，登入後不會自動匯入帳號。')}</p>
      <div className="planner-web-candidates">{saved.map(candidate => <WebCandidateCard key={candidate.id} candidate={candidate} locale={props.locale}>
        <p className="planner-web-checked">{text('搜索日期：', 'Searched for: ', '搜尋日期：')}{candidate.requestedDate || text('未指定', 'Not specified', '未指定')} · {text('资料查询：', 'Retrieved: ', '資料查詢：')}{plannerWebCheckedDate(candidate.checkedAt) || text('未知', 'Unknown', '未知')}{candidate.checkedAt && candidate.checkedAt.length !== 10 ? text('（湾区时间）', ' (Bay Area time)', '（灣區時間）') : ''}</p>
        <button type="button" disabled={!ready || busy} onClick={() => void update(saved.filter(item => item.id !== candidate.id))}>{text('移除候选', 'Remove candidate', '移除候選')}</button>
      </WebCandidateCard>)}</div>
    </section>}</>;
}

function WebCandidateCard({ candidate, locale, children }: { candidate: PlannerWebCandidate; locale: PlannerWebSearchProps['locale']; children?: React.ReactNode }) {
  const text = (zh: string, en: string, hant: string) => locale === 'en' ? en : locale === 'zh-Hant' ? hant : zh;
  return <article className="planner-web-candidate">
    <span className="planner-web-candidate-label">{text('站外候选 · 待确认', 'Web candidate · Unconfirmed', '站外候選 · 待確認')}</span>
    <h4>{candidate.name}</h4><p className="planner-web-city"><MapPin size={14} aria-hidden="true" />{candidate.city || text('城市待确认', 'City unconfirmed', '城市待確認')}</p>
    {candidate.summary && <p>{candidate.summary}</p>}
    <dl><div><dt><CalendarDays size={14} aria-hidden="true" />{text('时间', 'Times', '時間')}</dt><dd>{candidate.timeSummary || text('时段待确认，请查看来源', 'Hours unconfirmed; check the source', '時段待確認，請查看來源')}</dd></div><div><dt><Ticket size={14} aria-hidden="true" />{text('费用', 'Costs', '費用')}</dt><dd>{candidate.priceSummary || text('费用待确认，不能按免费计算', 'Costs unconfirmed; cannot be treated as free', '費用待確認，不能按免費計算')}</dd></div></dl>
    <p className="planner-small-note">{text('尚未核对准确位置、所选日期时段与预约，暂不能自动排入行程。', 'Exact location, date-specific hours and booking conditions need checking before scheduling.', '尚未核對準確位置、所選日期時段與預約，暫不能自動排入行程。')}</p>
    <div className="planner-web-candidate-links"><a href={plannerWebMapSearchUrl(candidate)} target="_blank" rel="noopener noreferrer">{text('在地图查找位置', 'Find location on map', '在地圖查找位置')} ↗</a>{candidate.sourceUrls.map(url => <a key={url} href={url} target="_blank" rel="noopener noreferrer">{new URL(url).hostname.replace(/^www\./, '')} <ArrowUpRight size={13} aria-hidden="true" /></a>)}</div>
    {children}
  </article>;
}

function PlannerWebSearchRequest({ query, date, region, city, locale, saved, onSave, saveDisabled }: PlannerWebSearchProps & { saved: SavedWebCandidate[]; onSave: (candidate: PlannerWebCandidate, checkedAt: string | null) => void; saveDisabled: boolean }) {
  const [result, setResult] = useState<PlannerWebResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const request = useRef<{ sequence: number; controller: AbortController | null }>({ sequence: 0, controller: null });
  const mounted = useRef(false);
  const headingId = useId();
  const text = (zh: string, en: string, hant: string) => locale === 'en' ? en : locale === 'zh-Hant' ? hant : zh;
  const trimmedQuery = query.trim();
  const validQuery = trimmedQuery.length >= 2 && trimmedQuery.length <= 500;

  useEffect(() => {
    mounted.current = true;
    const active = request.current;
    return () => { mounted.current = false; active.sequence++; active.controller?.abort(); active.controller = null; };
  }, []);

  function cancel() {
    request.current.sequence++;
    request.current.controller?.abort();
    request.current.controller = null;
    setLoading(false);
    setResult(null);
    setError('');
  }

  async function search() {
    if (!validQuery || request.current.controller) return;
    const controller = new AbortController();
    const sequence = ++request.current.sequence;
    request.current.controller = controller;
    setLoading(true); setError(''); setResult(null);
    const current = () => mounted.current && !controller.signal.aborted && request.current.sequence === sequence;
    try {
      const data: unknown = await api.request('/planner/web-search', {
        method: 'POST', signal: controller.signal,
        body: JSON.stringify({ query: trimmedQuery, locale, ...(date.trim() ? { date: date.trim() } : {}), ...(region.trim() ? { region: region.trim() } : {}), ...(city?.trim() ? { city: city.trim() } : {}) }),
      });
      if (!current()) return;
      const parsed = parsePlannerWebResult(data);
      if (!parsed) {
        setError(text('这次没有取得带有可用来源的结果，请调整关键词后重试。', 'No result with usable sources was returned. Try different search terms.', '這次沒有取得帶有可用來源的結果，請調整關鍵詞後重試。'));
        return;
      }
      setResult(parsed);
      recordProductEvent('planner_web_search');
    } catch (failure: unknown) {
      if (!current()) return;
      const status = failure && typeof failure === 'object' && 'status' in failure ? failure.status : undefined;
      setError(status === 429
        ? text('站外搜索次数暂时用完，请稍后再试；站内搜索仍可使用。', 'Web search is temporarily at its limit. Try again later; catalog search is still available.', '站外搜尋次數暫時用完，請稍後再試；站內搜尋仍可使用。')
        : status === 503
          ? text('站外搜索暂不可用，请稍后再试；你仍可使用站内已有资料。', 'Web search is temporarily unavailable. Try again later or use the existing catalog.', '站外搜尋暫不可用，請稍後再試；你仍可使用站內已有資料。')
          : text('这次搜索没有完成，请稍后重试。', 'This search could not be completed. Please try again.', '這次搜尋沒有完成，請稍後重試。'));
    } finally {
      if (current()) { request.current.controller = null; setLoading(false); }
    }
  }

  const checkedLabel = result?.checkedAt
    ? result.checkedAt.length === 10 ? result.checkedAt : new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Los_Angeles' }).format(new Date(result.checkedAt))
    : text('未提供', 'Not provided', '未提供');

  return <section className="planner-web-search" aria-labelledby={headingId} translate="no" lang={locale}>
    <h3 id={headingId}><Globe2 size={16} aria-hidden="true" />{text('再找找站外资料', 'Search beyond BAYLINK', '再找找站外資料')}</h3>
    <p className="planner-web-intro">{text('点击后搜索当前关键词、日期与地区。网页资料供你进一步核对，不会自动加入计划。', 'Search the web using these keywords, date and area when you click. Results are references to check and are not added to your plan.', '點擊後搜尋目前關鍵詞、日期與地區。網頁資料供你進一步核對，不會自動加入計畫。')}</p>
    {!validQuery && <p className="planner-web-hint">{text('请先输入 2–500 个字符的搜索内容。', 'Enter a search of 2–500 characters first.', '請先輸入 2–500 個字元的搜尋內容。')}</p>}
    <div className="planner-web-actions"><button type="button" className="planner-web-button" disabled={loading || !validQuery} onClick={() => { void search(); }}>
      {loading && <LoaderCircle size={15} aria-hidden="true" />}{loading ? text('正在搜索…', 'Searching…', '正在搜尋…') : text('搜索站外资料', 'Search the web', '搜尋站外資料')}
    </button>{loading && <button type="button" className="planner-web-cancel" onClick={cancel}>{text('取消', 'Cancel', '取消')}</button>}</div>
    {loading && <p className="planner-web-status" role="status">{text('正在查找网页与来源，可能需要一点时间。', 'Looking up web pages and sources. This may take a moment.', '正在查找網頁與來源，可能需要一點時間。')}</p>}
    {error && <p className="planner-web-error" role="alert">{error}</p>}
    {result && <div className="planner-web-results">
      <p className="planner-web-status" role="status">{text('已取得站外参考资料', 'Web references found', '已取得站外參考資料')}</p>
      {result.coverage && <p className="planner-web-coverage">{text('本次引用', 'Cited this time:', '本次引用')} {result.coverage.sourceCount} {text('个页面', 'pages', '個頁面')} · {result.coverage.domainCount} {text('个来源网站；并非穷尽所有结果。', 'source sites; not an exhaustive search.', '個來源網站；並非窮盡所有結果。')}</p>}
      <p className="planner-web-checked">{text('资料查询时间：', 'Retrieved: ', '資料查詢時間：')}<time dateTime={result.checkedAt || undefined}>{checkedLabel}</time>{result.checkedAt?.length !== 10 && result.checkedAt ? text('（湾区时间）', ' (Bay Area time)', '（灣區時間）') : ''}{result.cached ? text(' · 缓存结果', ' · Cached result', ' · 快取結果') : ''}</p>
      <p className="planner-web-caution">{text('这是网页搜索摘要，并非 BAYLINK 逐项官方核实。营业时间、价格、名额与优惠资格以来源最新说明为准；未写明的条件仍待确认。', 'This is a web-search summary, not individually verified official information from BAYLINK. Check the sources for current hours, prices, availability and offer eligibility; missing details remain unconfirmed.', '這是網頁搜尋摘要，並非 BAYLINK 逐項官方核實。營業時間、價格、名額與優惠資格以來源最新說明為準；未寫明的條件仍待確認。')}</p>
      {result.candidates.length > 0 && <div className="planner-web-candidates">{result.candidates.map(candidate => {
        const previous = saved.find(item => item.id === candidate.id);
        const unchanged = previous && JSON.stringify(previous) === JSON.stringify({ ...candidate, checkedAt: result.checkedAt, requestedDate: date || null });
        return <WebCandidateCard key={candidate.id} candidate={candidate} locale={locale}><button type="button" disabled={!!unchanged || saveDisabled} onClick={() => onSave(candidate, result.checkedAt)}>{unchanged ? text('已保留候选', 'Candidate kept', '已保留候選') : previous ? text('更新已保留候选', 'Update kept candidate', '更新已保留候選') : text('保留候选', 'Keep candidate', '保留候選')}</button></WebCandidateCard>;
      })}</div>}
      <div className="planner-web-answer" style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{plannerWebAnswerParts(result).map((part, index) => part.source
        ? <a key={index} className="planner-web-citation" href={part.source.url} target="_blank" rel="noopener noreferrer" aria-label={`${part.text} ${part.source.title}`}>{part.text}</a>
        : <span key={index}>{part.text}{part.citation !== undefined ? text('（来源未提供）', ' (source unavailable)', '（來源未提供）') : ''}</span>)}</div>
      <h4>{text('来源与原文', 'Sources', '來源與原文')}</h4>
      <ol className="planner-web-sources">{result.sources.map(source => <li key={source.number} value={source.number}>
        <a href={source.url} target="_blank" rel="noopener noreferrer"><span className="planner-web-source-title">{source.title}</span><span className="planner-web-source-url" style={{ display: 'block', overflowWrap: 'anywhere' }}>{source.url}</span></a>
        {source.snippet && <p className="planner-web-snippet">{source.snippet}</p>}
      </li>)}</ol>
    </div>}
  </section>;
}
