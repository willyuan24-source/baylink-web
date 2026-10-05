import { useEffect, useRef, useState } from 'react';
import { ArrowRight, Bookmark, Check, Globe2, MapPin } from 'lucide-react';
import { useLocale, translateText } from '../i18n/locale';
import { bayBayCatalogResult, bayBayCatalogWebReferences, bayBayPlanPath, bayBayWebResult, type GuideChatResponse } from '../lib/baybay-conversation';
import { GUEST_WEB_CANDIDATES_KEY, loadGuestWebCandidates, plannerWebMapSearchUrl, plannerWebAnswerParts, plannerWebCheckedDate, validPlannerWebDate, saveAccountWebCandidate, type SavedWebCandidate } from '../lib/planner-web-search';
import { getStoredUser } from '../lib/session';
import { bayBayAssistantResult } from '../lib/baybay-assistant';
import { BayBayEvidenceStamp } from './BayBayEvidenceStamp';

function useCopy() {
  const locale = useLocale();
  return (zh: string, en: string) => locale === 'en' ? en : translateText(zh, locale);
}

export function BayBayRetrievalLabel({ response }: { response: GuideChatResponse }) {
  const t = useCopy(), web = bayBayWebResult(response), retrieval = response.retrieval;
  const catalog = response.responseMode === 'catalog' && retrieval && ['site', 'site+web'].includes(retrieval.scope);
  const catalogDay = catalog ? validPlannerWebDate(retrieval.catalogCheckedAt) : null;
  const checked = catalogDay ? t(`资料核对 ${catalogDay}`, `Catalog checked ${catalogDay}`) : web ? (plannerWebCheckedDate(web.checkedAt) || t('查询日期未知', 'Retrieval date unknown')) + (web.checkedAt && web.checkedAt.length !== 10 ? t('（湾区时间）', ' (Bay Area time)') : '') : '';
  const failed = retrieval?.webStatus === 'verification_failed';
  const failureCodes = [retrieval?.failureCode, ...(response.research?.warnings || []), ...(response.research?.steps || []).map(step => step.code)];
  const webNotice = retrieval?.webStatus === 'auth_required' || retrieval?.webAccess?.reason === 'auth_required'
    ? t('本次仅使用站内资料（回答时未登录或登录已失效）', 'Site information only for this reply (not signed in or sign-in had expired)')
    : failureCodes.includes('web_daily_limit') ? t('今日联网额度已用完，已保留站内资料', 'Today’s web lookup limit has been reached; site information remains available')
      : failureCodes.some(code => ['web_rate_limit', 'web_provider_rate_limit'].includes(code || '')) ? t('联网查询暂时过于频繁，请稍后再试；站内资料仍可使用', 'Web lookups are temporarily rate-limited; retry later. Site information remains available')
        : retrieval?.webStatus === 'unavailable' ? t('本次联网未成功，可稍后重试', 'Web lookup unavailable; retry later') : '';
  if (response.responseMode === 'assistant') {
    const sources = bayBayAssistantResult(response)?.sources || [];
    const methods = sources.map(source => response.evidence?.find(item => item.url === source.url)?.verification);
    const sourceSummary = ([
      ['catalog', t('站内快照', 'Site snapshots')],
      ['page-read', t('本次网页读取', 'Pages read this turn')],
      ['api', t('接口获取', 'API retrievals')],
      ['search-result', t('搜索线索（未读正文）', 'Search leads (page not read)')],
      [undefined, t('取得方式未记录', 'Retrieval method not recorded')],
    ] as const).flatMap(([method, label]) => {
      const count = methods.filter(value => value === method).length;
      return count ? [t(`${label} ${count} 条`, `${label}: ${count}`)] : [];
    }).join(' · ');
    const searched = retrieval?.webStatus === 'completed' && retrieval.scope === 'site+web' ? t('已检索站内与站外', 'Searched site and web')
      : retrieval?.webStatus === 'completed' && retrieval.scope === 'web' ? t('已检索站外公开资料', 'Searched public web information')
        : retrieval?.scope === 'site' ? t('已检索站内资料', 'Searched site information')
          : retrieval?.scope === 'none' ? t('本次未检索', 'No search this turn') : t('根据当前条件整理', 'Organized around your requirements');
    return <div className="baybay-retrieval" translate="no"><Globe2 size={13} /><span>{searched}{sourceSummary && t(` · 实际引用：${sourceSummary}`, ` · Cited evidence: ${sourceSummary}`)}{webNotice && ` · ${webNotice}`}{failed && t(' · 部分联网资料未通过核验', ' · Some web information did not pass verification')}</span></div>;
  }
  return <div className="baybay-retrieval" role={failed ? 'status' : undefined} translate="no"><Globe2 size={13} /><span>{failed && t('本次联网答复未通过地点或日期检查，以下显示站内参考资料，可稍后重试。', 'The web answer did not pass location or date checks. Site references are shown below; you can retry later.')}{catalog ? t('站内活动与去处资料', 'Site event and place catalog') : web ? t(`站外来源 ${web.sources.length} 条${retrieval?.scope === 'site+web' ? ' · 结合站内资料' : ''}`, `${web.sources.length} web sources${retrieval?.scope === 'site+web' ? ' · with site information' : ''}`) : retrieval?.scope === 'none' ? t('待补充条件 · 本次未检索', 'More details needed · No search yet') : t('参考站内资料', 'Site references')}{checked && ` · ${checked}`}{web?.cached && t(' · 近期缓存', ' · Recent cached lookup')}{webNotice && ` · ${webNotice}`}</span></div>;
}

export function BayBayAnswer({ response, onNavigate }: { response: GuideChatResponse; onNavigate?: (path: string) => void }) {
  const result = bayBayAssistantResult(response) || bayBayCatalogResult(response) || bayBayWebResult(response);
  const parts = plannerWebAnswerParts(result || { answer: response.answer || '', sources: [] }, true);
  return <p className="member-baybay-answer-text">{parts.map((part, index) => {
    const href = part.source?.url || part.href;
    return href ? <a key={index} href={href} target={href.startsWith('/') ? undefined : '_blank'} rel="noopener noreferrer" title={part.source?.title || href}
      className={part.source ? 'baybay-inline-citation' : 'underline underline-offset-2'} onClick={event => {
        if (href.startsWith('/') && onNavigate && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey && event.button === 0) { event.preventDefault(); onNavigate(href); }
      }}>{part.text}</a> : <span key={index}>{part.text}</span>;
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

export function BayBayDiscoveryResults({ response, ownerId, sessionKey, onNavigate }: { response: GuideChatResponse; ownerId?: string; sessionKey?: string; onNavigate?: (path: string) => void }) {
  if (response.responseMode === 'assistant') return <AssistantSources response={response} onNavigate={onNavigate} />;
  if (response.responseMode === 'catalog') return <CatalogSources response={response} />;
  return <DiscoverySession key={JSON.stringify([ownerId || 'guest', sessionKey])} response={response} ownerId={ownerId} />;
}

function AssistantSources({ response, onNavigate }: { response: GuideChatResponse; onNavigate?: (path: string) => void }) {
  const t = useCopy(), result = bayBayAssistantResult(response);
  const notices = [...new Set((response.research?.warnings || []).flatMap(warning => warning === 'additional_web_lookup_unavailable'
    ? [t('部分补充查询未完成，已保留取得的资料。', 'Some additional lookups could not finish. The information already found is retained.')]
    : warning === 'task_memory_unavailable' ? [t('本次未能保留完整安排条件，继续提问时请再次注明关键需求。', 'The full planning context could not be retained. Please repeat your key requirements in the next question.')]
      : []))];
  if (!result && !notices.length) return null;
  return <section className="baybay-discovery" aria-label={t('本次回答来源', 'Sources for this answer')} translate="no">
    {result && <details className="baybay-web-sources"><summary>{t('本次回答来源', 'Sources for this answer')} · {result.sources.length}</summary><ol>{result.sources.map(source => <li key={source.number} value={source.number}><a href={source.url} target={source.url.startsWith('/') ? undefined : '_blank'} rel="noopener noreferrer" onClick={event => { if (source.url.startsWith('/') && onNavigate && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey && event.button === 0) { event.preventDefault(); onNavigate(source.url); } }}>{source.title}<small>{source.url.startsWith('/') ? t('站内攻略', 'Site guide') : new URL(source.url).hostname.replace(/^www\./, '')}</small><BayBayEvidenceStamp source={response.evidence?.find(item => item.url === source.url)} /></a></li>)}</ol></details>}
    {!!notices.length && <ul className="baybay-plan-notes">{notices.map((notice, index) => <li key={index}>{notice}</li>)}</ul>}
  </section>;
}

function CatalogSources({ response }: { response: GuideChatResponse }) {
  const t = useCopy(), result = bayBayCatalogResult(response), supplements = bayBayCatalogWebReferences(response);
  const webDate = supplements.length ? plannerWebCheckedDate(response.retrieval?.checkedAt) : null;
  if (!result && !supplements.length) return null;
  return <>{result && <section className="baybay-discovery" aria-label={t('站内收录官方来源', 'Official sources in the site catalog')} translate="no">
    <details className="baybay-web-sources" open><summary>{t('站内收录官方来源', 'Official sources in the site catalog')} · {result.sources.length}</summary><ol>{result.sources.map(source => <li key={`${source.number}:${source.url}`} value={source.number}><a href={source.url} target="_blank" rel="noopener noreferrer">{source.title}<small>{new URL(source.url).hostname.replace(/^www\./, '')}</small></a></li>)}</ol></details>
  </section>}{supplements.length > 0 && <section className="baybay-discovery" aria-label={t('联网补充来源', 'Supplementary web sources')} translate="no">
    <details className="baybay-web-sources" open><summary>{t('联网补充来源 · 日期、场次及票价待核实', 'Supplementary web sources · Dates, sessions and prices unverified')}</summary><ul>{supplements.map(source => <li key={`${source.number}:${source.url}`}><a href={source.url} target="_blank" rel="noopener noreferrer">{source.title}<small>{new URL(source.url).hostname.replace(/^www\./, '')}</small></a></li>)}</ul></details>
    {webDate && <p className="baybay-discovery-note">{t(`联网查询日期 ${webDate}（湾区时间）`, `Web lookup date ${webDate} (Bay Area time)`)}</p>}
  </section>}</>;
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
  if (!result) return null;
  return <section className="baybay-discovery" aria-label={t('站外发现与来源', 'Web discoveries and sources')} translate="no">
    {result.candidates.length > 0 && <><div className="baybay-discovery-heading"><span>{t('值得再看一眼', 'A closer look')}</span><small>{t('站外候选 · 待确认', 'Web shortlist · Unconfirmed')}</small></div><div className="baybay-discovery-cards">{result.candidates.map((candidate, index) => <article key={candidate.id}>
      <div className="baybay-discovery-cover" aria-hidden="true"><MapPin size={32} /><span>{String(index + 1).padStart(2, '0')}</span></div>
      <div className="baybay-discovery-content"><small>{candidate.city || t('城市待确认', 'City unconfirmed')}</small><h4>{candidate.name}</h4>{candidate.summary && <p>{candidate.summary}</p>}
        <dl><div><dt>{t('时间', 'When')}</dt><dd>{candidate.timeSummary || t('请查看来源确认', 'Check the source')}</dd></div><div><dt>{t('费用', 'Cost')}</dt><dd>{candidate.priceSummary || t('待确认', 'Unconfirmed')}</dd></div></dl>
        <a href={plannerWebMapSearchUrl(candidate)} target="_blank" rel="noopener noreferrer"><MapPin size={13} />{t('地图查找', 'Find on map')}</a>
        <button type="button" disabled={!!busy || saved.includes(candidate.id)} onClick={() => void save({ ...candidate, checkedAt: result.checkedAt, requestedDate: validPlannerWebDate(response.retrieval?.requestedDate) })}>{saved.includes(candidate.id) ? <Check size={14} /> : <Bookmark size={14} />}{saved.includes(candidate.id) ? t('已存入候选', 'Saved') : busy === candidate.id ? t('保存中…', 'Saving…') : t('存入候选', 'Save to shortlist')}</button>
      </div></article>)}</div><p className="baybay-discovery-note">{ownerId ? t('保存到你的私人候选清单，在计划页继续查看。', 'Saved to your private shortlist. Continue on the planner page.') : t('游客候选保存在这个浏览器，可在计划页继续查看。', 'Guest candidates stay in this browser. Continue on the planner page.')}{t('具体位置、所选日期时段与预约仍需核实。', ' Exact location, date-specific hours and reservations still need checking.')}</p></>}
    {error && <p role="alert">{error}</p>}
    <details className="baybay-web-sources" open={!result.candidates.length}><summary>{t('查看本次联网来源', 'Sources from this lookup')} · {result.sources.length}</summary><ol>{result.sources.map(source => <li key={`${source.number}:${source.url}`} value={source.number}><a href={source.url} target="_blank" rel="noopener noreferrer">{source.title}<small>{new URL(source.url).hostname.replace(/^www\./, '')}</small></a></li>)}</ol></details>
  </section>;
}

export function BayBayTaskHandoff({ brief, onNavigate }: { brief: string; onNavigate: (path: string) => void }) {
  const t = useCopy(), [draft, setDraft] = useState(brief);
  if (!brief) return null;
  return <details className="baybay-task-handoff" translate="no"><summary>{t('带着这些需求，继续做计划', 'Continue to a plan with your needs')}<ArrowRight size={15} /></summary><label>{t('已经说过的条件，可以再修改', 'Your requirements — edit before continuing')}<textarea value={draft} maxLength={800} onChange={event => setDraft(event.target.value)} /></label><button type="button" disabled={draft.trim().length < 2} onClick={() => onNavigate(bayBayPlanPath(draft))}>{t('带入计划', 'Continue to planner')}<ArrowRight size={14} /></button></details>;
}
