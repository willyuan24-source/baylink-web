import { useEffect, useState } from 'react';
import { ArrowUpRight, CalendarDays, ChevronRight, Loader2, MapPin, RotateCcw, Users } from 'lucide-react';
import { outings, type Outing } from '../lib/outings';
import { getStoredUser } from '../lib/session';
import { bayBayOutingPath, type BayBayOutingSearch } from '../lib/baybay-conversation';
import { useOutingCopy } from '../features/outings/outing-copy';

type Props = { search: BayBayOutingSearch; onNavigate: (path: string) => void; blockedUserIds?: string[]; answer?: string; onAnswer?: (answer: string) => void };
type Result = { state: 'loading' | 'error' | 'ready' | 'expired'; items: Outing[]; more: boolean };
const accountScope = () => { const user = getStoredUser(); return `${user?.id || 'guest'}:${user?.token || ''}`; };
const isEnglishPractice = (query?: string) => query?.trim().toLowerCase() === 'english practice';

export function BayBayOutingResults(props: Props) {
  const { t } = useOutingCopy();
  if (props.search.state === 'needs_clarification') {
    const answer = props.answer?.trim(), question = props.search.question?.trim();
    // Keep all explanatory text. If it already contains the prompt, do not repeat it.
    const normalize = (value: string) => value.replace(/\s+/g, ' ').trim();
    const answeredPrompt = !!answer && !!question && normalize(answer).includes(normalize(question));
    const suggestions = props.search.missing.includes('city')
      ? [{ label:t('全湾区', 'Anywhere in the Bay Area'), reply:t('全湾区都可以。', 'Anywhere in the Bay Area is fine.') }]
      : props.search.missing.includes('date')
        ? [{ label:t('本周末', 'This weekend'), reply:t('本周末。', 'This weekend.') }, { label:t('未来7天', 'Next 7 days'), reply:t('未来7天，包含今天。', 'The next 7 days, including today.') },
          ...(isEnglishPractice(props.search.filters.q) ? [{ label:t('不限日期', 'Any date'), reply:t('不限日期。', 'Any date.') }] : [])]
        : [];
    return <div className="baybay-outing-clarify" translate="no"><Users size={17} aria-hidden="true"/><div><strong>{t('先补充一点，就能查找小队', 'One more detail to find an outing')}</strong>{answer && <p>{answer}</p>}{!answeredPrompt && <p>{question}</p>}<small>{t('直接在下方回答即可，不必重写原来的问题。', 'Reply below; there is no need to repeat your original request.')}</small>
      {props.onAnswer && suggestions.length > 0 && <div className="baybay-outing-quick-replies" role="group" aria-label={t('快捷回答（点选即发送）', 'Quick replies (select to send)')}><span>{t('点选即发送，也可自己输入', 'Select to send, or type your own answer')}</span><div>{suggestions.map(suggestion => <button type="button" key={suggestion.reply} onClick={() => props.onAnswer?.(suggestion.reply)}>{suggestion.label}</button>)}</div></div>}
    </div></div>;
  }
  return <ReadyOutingResults key={JSON.stringify(props.search.filters)} {...props}/>;
}

function ReadyOutingResults({ search, onNavigate, blockedUserIds = [] }: Props) {
  const { t, locale } = useOutingCopy();
  const [scope] = useState(accountScope);
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<Result>({ state:'loading', items:[], more:false });
  const filtersKey = JSON.stringify(search.filters), blockedKey = JSON.stringify(blockedUserIds);
  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    const expire = () => { if (accountScope() !== scope) { controller.abort(); if (active) setResult({ state:'expired', items:[], more:false }); return true; } return false; };
    const check = () => { expire(); };
    window.addEventListener('storage', check); window.addEventListener('session-expired', check); window.addEventListener('focus', check);
    if (!expire()) {
      setResult({ state:'loading', items:[], more:false });
      const blocked = new Set<string>(JSON.parse(blockedKey));
      void outings.list(JSON.parse(filtersKey), controller.signal).then(response => {
        if (!active || expire() || controller.signal.aborted) return;
        const visible = response.outings.filter(item => !blocked.has(item.host.id) && item.status === 'open' && item.startAt > Date.now());
        setResult({ state:'ready', items:visible.slice(0, 3), more:!!response.nextCursor || visible.length > 3 });
      }).catch(() => { if (active && !expire() && !controller.signal.aborted) setResult({ state:'error', items:[], more:false }); });
    }
    return () => { active = false; controller.abort(); window.removeEventListener('storage', check); window.removeEventListener('session-expired', check); window.removeEventListener('focus', check); };
  }, [scope, filtersKey, blockedKey, attempt]);
  // Account transitions unmount the assistant in AppLayout; this also hides a result
  // synchronously if a consumer renders it while the stored session has changed.
  const state = accountScope() === scope ? result.state : 'expired';
  const path = bayBayOutingPath(search.filters);
  const dateLabel = search.filters.date || (search.filters.dateFrom || search.filters.dateTo ? `${search.filters.dateFrom || '…'} — ${search.filters.dateTo || '…'}` : t('不限日期', 'Any date'));
  const follow = (event: React.MouseEvent<HTMLAnchorElement>, destination: string) => { if (!event.button && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey) { event.preventDefault(); onNavigate(destination); } };
  return <section className="baybay-outing-results" aria-label={t('站内真实小队', 'Real BAYLINK outings')} translate="no">
    <header><div><span className="baybay-outing-eyebrow">{t('站内真实查询 · 一起去', 'SITE SEARCH · TOGETHER')}</span><h3>{t('看看谁也想一起去', 'Find people to go with')}</h3></div><Users size={20} aria-hidden="true"/></header>
    <div className="baybay-outing-filters"><span>{search.filters.city || t('全湾区', 'Bay Area')}</span><span>{dateLabel}</span>{search.filters.q && <span>{isEnglishPractice(search.filters.q) ? t('英语练习', 'English practice') : search.filters.q}</span>}{search.filters.language && <span>{search.filters.language === 'zh' ? t('可用中文', 'Chinese welcome') : t('可用英文', 'English welcome')}</span>}{search.filters.seats && <span>{t('只看有空位', 'Open places only')}</span>}</div>
    {state === 'loading' && <p className="baybay-outing-state" role="status"><Loader2 size={16} className="animate-spin"/>{t('正在查询站内小队…', 'Searching BAYLINK outings…')}</p>}
    {state === 'expired' && <p className="baybay-outing-state" role="status">{t('账号已变化。请在新对话中重新查询小队。', 'Your account changed. Search again in a new conversation.')}</p>}
    {state === 'error' && <div className="baybay-outing-state"><p role="alert">{t('暂时无法读取小队；这不代表没有匹配结果。', 'Outings could not be loaded. This does not mean there are no matches.')}</p><button type="button" onClick={() => setAttempt(value => value + 1)}><RotateCcw size={14}/>{t('重试查询', 'Retry search')}</button></div>}
    {state === 'ready' && <>
      {!result.items.length && <p className="baybay-outing-state" role="status">{result.more ? t('这一批暂未找到可显示的小队；可继续查看下一批，确认是否有匹配结果。', 'No visible outings in this batch. Continue to the next batch to check for matches.') : t('这次查询没有找到符合条件的小队。可以调整日期或城市，也可以自己发起。', 'No outings matched this search. Try another date or city, or create your own.')}</p>}
      <div className="baybay-outing-cards">{result.items.filter(item => !blockedUserIds.includes(item.host.id)).map(item => {
        const itemPath = bayBayOutingPath(search.filters, item.id), remaining = item.capacity - item.confirmedCount;
        const day = new Intl.DateTimeFormat(locale === 'en' ? 'en-US' : locale === 'zh-Hant' ? 'zh-TW' : 'zh-CN', { timeZone:'America/Los_Angeles', month:'short', day:'numeric', weekday:'short' }).format(new Date(item.startAt));
        return <a key={item.id} href={itemPath} onClick={event => follow(event, itemPath)} className="baybay-outing-card"><div className="baybay-outing-card-top"><h4>{item.title}</h4><ArrowUpRight size={16} aria-hidden="true"/></div><p><CalendarDays size={14} aria-hidden="true"/><span>{day} · {item.startTime}–{item.endTime}</span></p><p><MapPin size={14} aria-hidden="true"/><span>{item.city} · {item.venue}</span></p><div className="baybay-outing-card-bottom"><strong>{remaining > 0 ? t(`还有 ${remaining} 位`, `${remaining} ${remaining === 1 ? 'place' : 'places'} open`) : t('满员 · 可申请候补', 'Full · waitlist available')}</strong><span>{t('查看安排', 'View plan')} →</span></div></a>;
      })}</div>
      <a className="baybay-outing-all" href={path} onClick={event => follow(event, path)}>{result.more ? t('继续查看全部匹配小队', 'Explore all matching outings') : t('查看完整搜索与筛选', 'Open search and filters')}<ArrowUpRight size={14}/></a>
      {!result.items.length && !result.more && <a className="baybay-outing-all ml-4" href="/this-month" onClick={event => follow(event, '/this-month')}>{t('先看看活动', 'Explore events first')}<ChevronRight size={14}/></a>}
      <p className="baybay-outing-note">{t('这是本次查询结果，时间为湾区当地时间。名额以详情为准；申请须经发起人确认，候补不会自动加入。官方报名和门票另行处理。', 'These are results from this search, in Bay Area time. Check details for current availability. The host must approve requests; waitlisting does not join you automatically. Official registration and tickets are separate.')}</p>
    </>}
  </section>;
}
