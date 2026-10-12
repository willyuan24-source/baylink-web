import { useEffect, useRef, useState } from 'react';
import { ArrowRight, BookOpen, Bookmark, Check, ChevronDown, ChevronRight, Globe2, MapPin } from 'lucide-react';
import { useLocale, translateText } from '../i18n/locale';
import { bayBayCatalogResult, bayBayCatalogWebReferences, bayBayGuideSources, bayBayPlanPath, bayBayReferenceGuides, bayBayWebResult, currentBayBayGuide, type GuideChatResponse } from '../lib/baybay-conversation';
import { GUEST_WEB_CANDIDATES_KEY, loadGuestWebCandidates, plannerWebMapSearchUrl, plannerWebAnswerParts, plannerWebCheckedDate, validPlannerWebDate, saveAccountWebCandidate, type PlannerWebResult, type SavedWebCandidate } from '../lib/planner-web-search';
import { getStoredUser } from '../lib/session';
import { bayBayAssistantResult } from '../lib/baybay-assistant';
import { linkifyPhones } from '../lib/phone-links';
import { BayBayEvidenceStamp } from './BayBayEvidenceStamp';

function useCopy() {
  const locale = useLocale();
  return (zh: string, en: string) => locale === 'en' ? en : translateText(zh, locale);
}
type Copy = ReturnType<typeof useCopy>;
type Navigate = (path: string) => void;
type Sources = PlannerWebResult['sources'];

const hostOf = (url: string) => { try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return ''; } };
const sitePathOf = (url: string) => {
  if (url.startsWith('/') && !url.startsWith('//')) return url.split(/[?#]/, 1)[0];
  try { const parsed = new URL(url); return /(?:^|\.)baylink\.us$/.test(parsed.hostname) ? parsed.pathname : null; } catch { return null; }
};
const openInApp = (url: string, onNavigate?: Navigate) => (event: React.MouseEvent<HTMLAnchorElement>) => {
  if (url.startsWith('/') && onNavigate && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey && event.button === 0) { event.preventDefault(); onNavigate(url); }
};

/**
 * How the answer was found, in one line, and the notices a reader must see (never folded away). The line names the
 * evidence it cites by method: 站内快照 (site records; the API's `site-record` counts as one), 本次网页读取 …; evidence
 * without a recorded method is counted in the list, never labelled "取得方式未记录" (BBL-09).
 */
function retrievalSummary(response: GuideChatResponse, guest: boolean, t: Copy): { line: string; notes: { text: string; status: boolean }[] } {
  const web = bayBayWebResult(response), retrieval = response.retrieval;
  const catalog = response.responseMode === 'catalog' && retrieval && ['site', 'site+web'].includes(retrieval.scope);
  const catalogDay = catalog ? validPlannerWebDate(retrieval.catalogCheckedAt) : null;
  const checked = catalogDay ? t(`资料核对 ${catalogDay}`, `Catalog checked ${catalogDay}`) : web ? (plannerWebCheckedDate(web.checkedAt) || t('查询日期未知', 'Retrieval date unknown')) + (web.checkedAt && web.checkedAt.length !== 10 ? t('（湾区时间）', ' (Bay Area time)') : '') : '';
  const failed = retrieval?.webStatus === 'verification_failed';
  const failureCodes = [retrieval?.failureCode, ...(response.research?.warnings || []), ...(response.research?.steps || []).map(step => step.code)];
  const webNotice = retrieval?.webStatus === 'auth_required' || retrieval?.webAccess?.reason === 'auth_required'
    ? guest ? '' : t('本次仅使用站内资料（回答时未登录或登录已失效）', 'Site information only for this reply (not signed in or sign-in had expired)')
    : failureCodes.includes('web_daily_limit') ? t('今日联网额度已用完，已保留站内资料', 'Today’s web lookup limit has been reached; site information remains available')
      : failureCodes.some(code => ['web_rate_limit', 'web_provider_rate_limit'].includes(code || '')) ? t('联网查询暂时过于频繁，请稍后再试；站内资料仍可使用', 'Web lookups are temporarily rate-limited; retry later. Site information remains available')
        : retrieval?.webStatus === 'unavailable' ? t('本次联网未成功，可稍后重试', 'Web lookup unavailable; retry later') : '';
  const notes: { text: string; status: boolean }[] = [];
  if (webNotice) notes.push({ text: webNotice, status: false });
  if (response.responseMode === 'assistant') {
    if (failed) notes.push({ text: t('部分联网资料未通过核验', 'Some web information did not pass verification'), status: false });
    for (const warning of new Set(response.research?.warnings || [])) {
      if (warning === 'additional_web_lookup_unavailable') notes.push({ text: t('部分补充查询未完成，已保留取得的资料。', 'Some additional lookups could not finish. The information already found is retained.'), status: false });
      if (warning === 'task_memory_unavailable') notes.push({ text: t('本次未能保留完整安排条件，继续提问时请再次注明关键需求。', 'The full planning context could not be retained. Please repeat your key requirements in the next question.'), status: false });
    }
    const sources = bayBayAssistantResult(response)?.sources || [];
    const methods = sources.map(source => response.evidence?.find(item => item.url === source.url)?.verification);
    const sourceSummary = ([
      ['catalog', t('站内快照', 'Site snapshots')],
      ['page-read', t('本次网页读取', 'Pages read this turn')],
      ['api', t('接口获取', 'API retrievals')],
      ['search-result', t('搜索线索（未读正文）', 'Search leads (page not read)')],
    ] as const).flatMap(([method, label]) => {
      const count = methods.filter(value => value === method).length;
      return count ? [t(`${label} ${count} 条`, `${label}: ${count}`)] : [];
    }).join(' · ');
    const searched = retrieval?.webStatus === 'completed' && retrieval.scope === 'site+web' ? t('已检索站内与站外', 'Searched site and web')
      : retrieval?.webStatus === 'completed' && retrieval.scope === 'web' ? t('已检索站外公开资料', 'Searched public web information')
        : retrieval?.scope === 'site' ? t('已检索站内资料', 'Searched site information')
          : retrieval?.scope === 'none' ? t('本次未检索', 'No search this turn') : t('根据当前条件整理', 'Organized around your requirements');
    return { line: [searched, sourceSummary].filter(Boolean).join(' · '), notes };
  }
  if (failed) notes.push({ text: t('本次联网答复未通过地点或日期检查，以下显示站内参考资料，可稍后重试。', 'The web answer did not pass location or date checks. Site references are shown below; you can retry later.'), status: true });
  const what = catalog ? t('站内活动与去处资料', 'Site event and place catalog') : web ? t(`站外来源 ${web.sources.length} 条${retrieval?.scope === 'site+web' ? ' · 结合站内资料' : ''}`, `${web.sources.length} web sources${retrieval?.scope === 'site+web' ? ' · with site information' : ''}`)
    : retrieval?.scope === 'none' ? t('待补充条件 · 本次未检索', 'More details needed · No search yet') : t('参考站内资料', 'Site references');
  return { line: [what, checked, web?.cached ? t('近期缓存', 'Recent cached lookup') : ''].filter(Boolean).join(' · '), notes };
}

function SourceList({ sources, response, onNavigate, siteLabel }: { sources: Sources; response?: GuideChatResponse; onNavigate?: Navigate; siteLabel?: string }) {
  return <ol className="bb-sources__list">{sources.map(source => <li key={`${source.number}:${source.url}`} value={source.number}>
    <a href={source.url} target={source.url.startsWith('/') ? undefined : '_blank'} rel="noopener noreferrer" onClick={openInApp(source.url, onNavigate)}>{source.title}
      <small>{source.url.startsWith('/') ? siteLabel : hostOf(source.url)}</small>{response && <BayBayEvidenceStamp source={response.evidence?.find(item => item.url === source.url)} />}</a>
  </li>)}</ol>;
}

/**
 * One sources block per answer (BBL-14, G79): the retrieval line is its summary; opened, it lists the cited sources
 * (numbered like the answer's [n]), the catalog and supplementary web sources, and the related guides with their own
 * official sources. Notices a reader must act on (web limits, failed checks) stay visible above it.
 */
export function BayBaySources({ response, guest = false, currentPath, onNavigate }: { response: GuideChatResponse; guest?: boolean; currentPath?: string; onNavigate?: Navigate }) {
  const t = useCopy();
  const { line, notes } = retrievalSummary(response, guest, t);
  const assistant = response.responseMode === 'assistant' ? bayBayAssistantResult(response) : null;
  const catalogResult = bayBayCatalogResult(response), catalog = catalogResult?.sources.length ? catalogResult : null;
  const supplements = bayBayCatalogWebReferences(response), web = bayBayWebResult(response);
  const webDate = supplements.length ? plannerWebCheckedDate(response.retrieval?.checkedAt) : null;
  // Related guides: the guide being read (not for catalog answers) and the API's suggestions, minus guides already cited.
  const cited = new Set([...assistant?.sources || [], ...catalog?.sources || [], ...web?.sources || []].flatMap(source => sitePathOf(source.url) || []));
  const reading = response.responseMode === 'catalog' ? undefined : currentBayBayGuide(currentPath || '');
  const guides = (reading ? [reading, ...bayBayReferenceGuides(response).filter(guide => guide.slug !== reading.slug)] : bayBayReferenceGuides(response))
    .filter(guide => guide.slug === reading?.slug || !cited.has(`/guides/${guide.slug}`));
  const lists = !!assistant || !!catalog || supplements.length > 0 || !!web?.sources.length || guides.length > 0;
  if (!line && !notes.length && !lists) return null;
  const guideCount = guides.length ? t(`相关攻略 ${guides.length} 篇`, `${guides.length} related ${guides.length === 1 ? 'guide' : 'guides'}`) : '';
  return <section className="bb-sources" aria-label={t('来源', 'Sources')} translate="no">
    {notes.map(note => <p key={note.text} className="bb-sources__note" role={note.status ? 'status' : undefined}>{note.text}</p>)}
    {lists ? <details className="bb-sources__details" open={!!web && !web.candidates.length}>
      <summary><Globe2 aria-hidden="true" size={16} /><span>{[t('来源', 'Sources'), line, guideCount].filter(Boolean).join(' · ')}</span><ChevronDown aria-hidden="true" className="bb-sources__chevron" size={16} /></summary>
      {assistant && <SourceList sources={assistant.sources} response={response} onNavigate={onNavigate} siteLabel={t('站内攻略', 'Site guide')} />}
      {web && web.sources.length > 0 && <SourceList sources={web.sources} />}
      {catalog && <section aria-label={t('站内收录官方来源', 'Official sources in the site catalog')}><h4>{t('站内收录官方来源', 'Official sources in the site catalog')}</h4><SourceList sources={catalog.sources} /></section>}
      {supplements.length > 0 && <section aria-label={t('联网补充来源', 'Supplementary web sources')}><h4>{t('联网补充来源 · 日期、场次及票价待核实', 'Supplementary web sources · Dates, sessions and prices unverified')}</h4>
        <ul className="bb-sources__list">{supplements.map(source => <li key={`${source.number}:${source.url}`}><a href={source.url} target="_blank" rel="noopener noreferrer">{source.title}<small>{hostOf(source.url)}</small></a></li>)}</ul>
        {webDate && <p className="baybay-discovery-note">{t(`联网查询日期 ${webDate}（湾区时间）`, `Web lookup date ${webDate} (Bay Area time)`)}</p>}</section>}
      {guides.length > 0 && <div className="baybay-references"><h4>{t('相关攻略', 'Related guides')}</h4><small className="bb-references-note">{t('以下是站内指南列出的参考资料，不表示已实时核验。', 'These are the references the site guides list; they have not been checked live.')}</small>
        {guides.map(guide => <div key={guide.slug} className="bb-reference">
          {guide.slug === reading?.slug && <small>{t('提问时阅读的指南', 'The guide you were reading')}</small>}
          <button type="button" onClick={() => onNavigate?.(`/guides/${guide.slug}`)}><span className="bb-reference__mark" aria-hidden="true"><BookOpen size={18} /></span><span>{guide.title}</span><ChevronRight size={16} /></button>
          {bayBayGuideSources(guide).length > 0 && <details><summary>{t('查看原文来源', 'Original sources')}</summary><ul>{bayBayGuideSources(guide).map(source => <li key={source.url}><a href={source.url} target="_blank" rel="noopener noreferrer">{source.title}</a></li>)}</ul></details>}
        </div>)}</div>}
    </details> : line && <p className="bb-sources__line"><Globe2 aria-hidden="true" size={16} /><span>{line}</span></p>}
  </section>;
}

/** The legacy answer text with its [n] citations as links and every phone number tap-to-call (G27). */
export function BayBayAnswer({ response, onNavigate }: { response: GuideChatResponse; onNavigate?: (path: string) => void }) {
  const locale = useLocale();
  const result = bayBayAssistantResult(response) || bayBayCatalogResult(response) || bayBayWebResult(response);
  const parts = plannerWebAnswerParts(result || { answer: response.answer || '', sources: [] }, true);
  return <p className="member-baybay-answer-text">{parts.map((part, index) => {
    const href = part.source?.url || part.href;
    return href ? <a key={index} href={href} target={href.startsWith('/') ? undefined : '_blank'} rel="noopener noreferrer" title={part.source?.title || href}
      className={part.source ? 'baybay-inline-citation' : 'underline underline-offset-2'} onClick={openInApp(href, onNavigate)}>{part.text}</a> : <span key={index}>{linkifyPhones(translateText(part.text, locale))}</span>;
  })}</p>;
}

export function BayBayCoverageSummary({ response }: { response: GuideChatResponse }) {
  const t = useCopy(), coverage = response.answerCoverage;
  if (!coverage || coverage.status === 'unassessed' || !coverage.items.length) return null;
  const unknown = coverage.items.filter(item => item.status === 'unknown').length;
  const needsInput = coverage.items.filter(item => item.status === 'needs_user_input').length;
  const sources = new Map((response.evidence || []).map(source => [source.id, source]));
  return <details className="baybay-coverage" translate="no"><summary>{t(`答复概览 · ${coverage.items.length} 项`, `Response overview · ${coverage.items.length} ${coverage.items.length === 1 ? 'topic' : 'topics'}`)}{unknown > 0 && t(` · ${unknown} 项待确认`, ` · ${unknown} unconfirmed`)}{needsInput > 0 && t(` · ${needsInput} 项需你补充`, ` · ${needsInput} need your input`)}</summary>
    <p>{t('这里显示已识别需求的回应情况，不代表各项事实均已核实。', 'This tracks responses to identified needs, not verification of every fact.')}</p>
    <ul>{coverage.items.map(item => <li key={item.id} data-status={item.status}><strong>{t(item.label, item.label)}</strong><small>{item.status === 'answered' ? t('已回应', 'Addressed') : item.status === 'unknown' ? t('仍待确认', 'Unconfirmed') : t('需要补充条件', 'Needs your input')}</small>{item.summary && <p>{t(item.summary, item.summary)}</p>}{item.sourceIds.flatMap(id => { const source = sources.get(id); return source ? [<a key={id} href={source.url} target={source.url.startsWith('/') ? undefined : '_blank'} rel="noopener noreferrer">{t(source.title, source.title)}<BayBayEvidenceStamp source={source} /></a>] : []; })}</li>)}</ul>
  </details>;
}

/** Web candidates found for this reply (web answers only); their sources are in the answer's one sources block. */
export function BayBayDiscoveryResults({ response, ownerId, sessionKey }: { response: GuideChatResponse; ownerId?: string; sessionKey?: string; onNavigate?: (path: string) => void }) {
  if (response.responseMode === 'assistant' || response.responseMode === 'catalog') return null;
  return <DiscoverySession key={JSON.stringify([ownerId || 'guest', sessionKey])} response={response} ownerId={ownerId} />;
}

function DiscoverySession({ response, ownerId }: { response: GuideChatResponse; ownerId?: string }) {
  const t = useCopy(), result = bayBayWebResult(response);
  const [saved, setSaved] = useState<string[]>([]), [busy, setBusy] = useState(''), [error, setError] = useState('');
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => request.current?.abort(), []);
  const save = async (candidate: SavedWebCandidate) => {
    const session = getStoredUser();
    if (request.current || session?.id !== ownerId) return;
    const sameSession = () => getStoredUser()?.id === ownerId && getStoredUser()?.token === session?.token;
    const controller = new AbortController(); request.current = controller; setBusy(candidate.id); setError('');
    try {
      if (ownerId) await saveAccountWebCandidate(candidate, controller.signal);
      else {
        const previous = loadGuestWebCandidates().filter(item => item.id !== candidate.id);
        if (previous.length >= 20) throw new Error(t('候选清单已满，请到计划页移除不需要的项目。', 'Your shortlist is full. Remove an item on the planner page.'));
        localStorage.setItem(GUEST_WEB_CANDIDATES_KEY, JSON.stringify([candidate, ...previous]));
      }
      if (!controller.signal.aborted && sameSession()) setSaved(previous => [...previous, candidate.id]);
    } catch (reason) {
      if (!controller.signal.aborted && sameSession()) setError(reason instanceof Error ? reason.message : t('未能保存，请重试。', 'Could not save. Please try again.'));
    } finally { if (!controller.signal.aborted) { request.current = null; setBusy(''); } }
  };
  if (!result?.candidates.length) return null;
  return <section className="baybay-discovery" aria-label={t('站外发现', 'Web discoveries')} translate="no">
    <div className="baybay-discovery-heading"><span>{t('值得再看一眼', 'A closer look')}</span><small>{t('站外候选 · 待确认', 'Web shortlist · Unconfirmed')}</small></div><div className="baybay-discovery-cards">{result.candidates.map((candidate, index) => <article key={candidate.id}>
      <div className="baybay-discovery-cover" aria-hidden="true"><MapPin size={32} /><span>{String(index + 1).padStart(2, '0')}</span></div>
      <div className="baybay-discovery-content"><small>{candidate.city || t('城市待确认', 'City unconfirmed')}</small><h4>{candidate.name}</h4>{candidate.summary && <p>{candidate.summary}</p>}
        <dl><div><dt>{t('时间', 'When')}</dt><dd>{candidate.timeSummary || t('请查看来源确认', 'Check the source')}</dd></div><div><dt>{t('费用', 'Cost')}</dt><dd>{candidate.priceSummary || t('待确认', 'Unconfirmed')}</dd></div></dl>
        <a href={plannerWebMapSearchUrl(candidate)} target="_blank" rel="noopener noreferrer"><MapPin size={13} />{t('地图查找', 'Find on map')}</a>
        <button type="button" disabled={!!busy || saved.includes(candidate.id)} onClick={() => void save({ ...candidate, checkedAt: result.checkedAt, requestedDate: validPlannerWebDate(response.retrieval?.requestedDate) })}>{saved.includes(candidate.id) ? <Check size={14} /> : <Bookmark size={14} />}{saved.includes(candidate.id) ? t('已存入候选', 'Saved') : busy === candidate.id ? t('保存中…', 'Saving…') : t('存入候选', 'Save to shortlist')}</button>
      </div></article>)}</div><p className="baybay-discovery-note">{ownerId ? t('保存到你的私人候选清单，在计划页继续查看。', 'Saved to your private shortlist. Continue on the planner page.') : t('游客候选保存在这个浏览器，可在计划页继续查看。', 'Guest candidates stay in this browser. Continue on the planner page.')}{t('具体位置、所选日期时段与预约仍需核实。', ' Exact location, date-specific hours and reservations still need checking.')}</p>
    {error && <p role="alert">{error}</p>}
  </section>;
}

export function BayBayTaskHandoff({ brief, ownerId, onNavigate }: { brief: string; ownerId?: string; onNavigate: (path: string) => void }) {
  const t = useCopy(), [draft, setDraft] = useState(brief);
  if (!brief) return null;
  return <details className="baybay-task-handoff" translate="no"><summary>{t('带着这些需求，继续做计划', 'Continue to a plan with your needs')}<ArrowRight size={15} /></summary><label>{t('已经说过的条件，可以再修改', 'Your requirements — edit before continuing')}<textarea value={draft} maxLength={800} onChange={event => setDraft(event.target.value)} /></label><button type="button" disabled={draft.trim().length < 2} onClick={() => onNavigate(bayBayPlanPath(draft, ownerId))}>{t('带入计划', 'Continue to planner')}<ArrowRight size={14} /></button></details>;
}
