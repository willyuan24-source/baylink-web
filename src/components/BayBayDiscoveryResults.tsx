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
  if (response.responseMode === 'assistant') {
    const sources = bayBayAssistantResult(response)?.sources || [];
    const siteCount = sources.filter(source => source.url.startsWith('/')).length;
    const webCount = sources.length - siteCount;
    const searched = retrieval?.webStatus === 'completed' && retrieval.scope === 'site+web' ? t('已检索站内与站外', 'Searched site and web')
      : retrieval?.webStatus === 'completed' && retrieval.scope === 'web' ? t('已检索站外公开资料', 'Searched public web information')
        : retrieval?.scope === 'site' ? t('已检索站内资料', 'Searched site information')
          : retrieval?.scope === 'none' ? t('本次未检索', 'No search this turn') : t('根据当前条件整理', 'Organized around your requirements');
    return <div className="baybay-retrieval" translate="no"><Globe2 size={13} /><span>{searched}{sources.length > 0 && t(` · 实际引用 ${siteCount} 条站内资料、${webCount} 条站外来源`, ` · Cites ${siteCount} site sources and ${webCount} web sources`)}{retrieval?.webStatus === 'unavailable' && t(' · 本次联网未成功，可稍后重试', ' · Web lookup unavailable; retry later')}{failed && t(' · 部分联网资料未通过核验', ' · Some web information did not pass verification')}</span></div>;
  }
  return <div className="baybay-retrieval" role={failed ? 'status' : undefined} translate="no"><Globe2 size={13} /><span>{failed && t('本次联网答复未通过地点或日期检查，以下显示站内参考资料，可稍后重试。', 'The web answer did not pass location or date checks. Site references are shown below; you can retry later.')}{catalog ? t('站内活动与去处资料', 'Site event and place catalog') : web ? t(`站外来源 ${web.sources.length} 条${retrieval?.scope === 'site+web' ? ' · 结合站内资料' : ''}`, `${web.sources.length} web sources${retrieval?.scope === 'site+web' ? ' · with site information' : ''}`) : retrieval?.scope === 'none' ? t('待补充条件 · 本次未检索', 'More details needed · No search yet') : t('参考站内资料', 'Site references')}{checked && ` · ${checked}`}{web?.cached && t(' · 近期缓存', ' · Recent cached lookup')}{retrieval?.webStatus === 'unavailable' && t(' · 本次联网未成功，可稍后重试', ' · Web lookup unavailable; retry later')}</span></div>;
}

export function BayBayAnswer({ response, onNavigate }: { response: GuideChatResponse; onNavigate?: (path: string) => void }) {
  const result = bayBayAssistantResult(response) || bayBayCatalogResult(response) || bayBayWebResult(response);
  return <p className="member-baybay-answer-text">{result ? plannerWebAnswerParts(result).map((part, index) => part.source ? <a key={index} href={part.source.url} target={part.source.url.startsWith('/') ? undefined : '_blank'} rel="noopener noreferrer" title={part.source.title} className="baybay-inline-citation" onClick={event => { if (part.source!.url.startsWith('/') && onNavigate && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey && event.button === 0) { event.preventDefault(); onNavigate(part.source!.url); } }}>{part.text}</a> : <span key={index}>{part.text}</span>) : response.answer}</p>;
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
