import { useEffect, useId, useRef, useState } from 'react';
import { Globe2, LoaderCircle } from 'lucide-react';
import { api } from '../lib/api';
import { recordProductEvent } from '../lib/product-events';
import { parsePlannerWebResult, plannerWebAnswerParts, type PlannerWebResult } from '../lib/planner-web-search';

type PlannerWebSearchProps = {
  query: string;
  date: string;
  region: string;
  city?: string;
  locale: 'zh-Hans' | 'zh-Hant' | 'en';
};

/** Changing any search input discards the previous instance and aborts its request. */
export function PlannerWebSearch(props: PlannerWebSearchProps) {
  const key = JSON.stringify([props.query, props.date, props.region, props.city || '', props.locale]);
  return <PlannerWebSearchRequest key={key} {...props} />;
}

function PlannerWebSearchRequest({ query, date, region, city, locale }: PlannerWebSearchProps) {
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
      <p className="planner-web-checked">{text('资料查询时间：', 'Retrieved: ', '資料查詢時間：')}<time dateTime={result.checkedAt || undefined}>{checkedLabel}</time>{result.checkedAt?.length !== 10 && result.checkedAt ? text('（湾区时间）', ' (Bay Area time)', '（灣區時間）') : ''}{result.cached ? text(' · 缓存结果', ' · Cached result', ' · 快取結果') : ''}</p>
      <p className="planner-web-caution">{text('这是网页搜索摘要，并非 BAYLINK 逐项官方核实。营业时间、价格、名额与优惠资格以来源最新说明为准；未写明的条件仍待确认。', 'This is a web-search summary, not individually verified official information from BAYLINK. Check the sources for current hours, prices, availability and offer eligibility; missing details remain unconfirmed.', '這是網頁搜尋摘要，並非 BAYLINK 逐項官方核實。營業時間、價格、名額與優惠資格以來源最新說明為準；未寫明的條件仍待確認。')}</p>
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
