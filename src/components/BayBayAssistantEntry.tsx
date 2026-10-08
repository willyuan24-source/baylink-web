import { useState, useCallback, useEffect, useLayoutEffect, useRef } from 'react';
import { ThumbsUp, ThumbsDown, ChevronRight, X, Sparkles, Loader2, BookOpen, ArrowUp, Square, RotateCcw, Plus, CalendarDays, ImagePlus, MapPin, MessageCircle, GraduationCap, Users } from 'lucide-react';
import { BayBayEntityCards } from './BayBayEntityCards';
import { recordProductEvent } from '../lib/product-events';
import { API_BASE_URL, authHeaders } from '../lib/api';
import { BRAND } from '../brandAssets';
import { getCategoryFromSlug } from '../routing';
import { BayBaySmartCard } from './BayBaySmartCard';
import { ModalShell } from './ui/Modal';
import { BayBayMatchingPosts } from './BayBayMatchingPosts';
import { BayBayOutingResults } from './BayBayOutingResults';
import { BayBayAssistantPlanCard, BayBayRequirements } from './BayBayAssistantPlan';
import { BayBayAnswer, BayBayCoverageSummary, BayBayDiscoveryResults, BayBayRetrievalLabel, BayBayTaskHandoff } from './BayBayDiscoveryResults';
import { getGuideMedia } from '../data/guide-media';
import { GuideFigure } from './GuideVisuals';
import {
  bayBayFollowups, bayBayErrorMessage, bayBayPlanPath, isBayBayPlanRequest, isBayBaySocialRequest, isBayBaySearchContextExpired, isBayBayAssistantContextExpired, conversationHistory, currentBayBayGuide, fetchBayBayReply, safeBayBayPath, bayBayTaskBrief,
  bayBayPageQuestions, bayBayReferenceGuides, bayBayGuideSources, isBayBaySchoolGuide, isBayBaySchoolRequest, BAYBAY_SCHOOL_NOTE, BAYBAY_SCHOOL_STARTER,
  type BayBayTurn, type GuideChatAction, type GuideChatResponse, type BayBaySearchMode,
} from '../lib/baybay-conversation';
import { translateText, useLocale } from '../i18n/locale';
import { bayBayPageSearchContext, isBayBayResetRequest, resolveBayBaySearchState } from '../lib/baybay-context';
import { EnglishOnly } from './EnglishOnly';

type CreatePostOptions = { postType?: 'client' | 'provider'; category?: string; initialIntent?: string };
/** An explicit guest sign-in carries only this tab's in-memory draft, never account history. */
export type BayBayConversationDraft = { question: string; turns: BayBayTurn[] };
type BayBayAssistantEntryProps = {
  variant: 'sidebar' | 'inline' | 'headless';
  onNavigate: (path: string) => void;
  onCreatePostClick: (opts?: CreatePostOptions) => void;
  categoryHint?: string;
  currentPath?: string;
  panelOpen?: boolean;
  onPanelOpenChange?: (open: boolean) => void;
  restoreFocusRef?: React.RefObject<HTMLElement>;
  pendingQuestion?: string | null;
  pendingQuestionMode?: 'send' | 'draft';
  pendingQuestionId?: number;
  onPendingQuestionConsumed?: (id?: number) => void;
  blockedUserIds?: string[];
  ownerId?: string;
  sessionKey?: string;
  onLoginNeeded?: (draft: BayBayConversationDraft) => void;
  initialConversation?: BayBayConversationDraft;
};

const resolveCategoryLabel = (category?: string) => {
  if (!category) return undefined;
  const label = getCategoryFromSlug(category);
  return label === '全部' ? category : label;
};

const hasUnconfirmedFoodEvidence = (response?: GuideChatResponse) => response?.research?.warnings?.includes('food_evidence_unconfirmed') === true;

export const BayBayAssistantEntry = (props: BayBayAssistantEntryProps) => <BayBayAssistantSession key={JSON.stringify([props.ownerId || 'guest', props.sessionKey])} {...props} />;

const BayBayAssistantSession = ({ variant, onNavigate, onCreatePostClick, categoryHint,
  currentPath = typeof window === 'undefined' ? '/' : window.location.pathname + window.location.search,
  panelOpen, onPanelOpenChange, restoreFocusRef, pendingQuestion, pendingQuestionMode = 'send', pendingQuestionId, onPendingQuestionConsumed, blockedUserIds, ownerId, sessionKey, onLoginNeeded, initialConversation,
}: BayBayAssistantEntryProps) => {
  const locale = useLocale();
  const completionLocale = useRef(locale);
  useLayoutEffect(() => { completionLocale.current = locale; }, [locale]);
  const [completionNotice, setCompletionNotice] = useState<{ id: number; text: string } | null>(null);
  const announcedTurns = useRef(new Set((initialConversation?.turns || []).filter(turn => turn.state === 'complete').map(turn => turn.id)));
  const [usage, setUsage] = useState<{remaining:number;limit:number;resetAt?:string}|null>(null);
  const [usageRevision,setUsageRevision] = useState(0);
  const [internalOpen, setInternalOpen] = useState(false);
  const open = onPanelOpenChange ? !!panelOpen : internalOpen;
  useEffect(() => {
    if (!open) return; const controller = new AbortController();
    void fetch(`${API_BASE_URL}/ai/usage`, { headers: authHeaders(), signal: controller.signal }).then(async response => response.ok ? response.json() : null).then(value => {
      if (controller.signal.aborted) return;
      if (value && Number.isInteger(value.remaining) && Number.isInteger(value.limit) && value.remaining >= 0 && value.remaining <= value.limit && value.limit <= 10000) setUsage({remaining:value.remaining,limit:value.limit,...(typeof value.resetAt==='string'?{resetAt:value.resetAt}: {})});
      else setUsage(null);
    }).catch(()=>{ if (!controller.signal.aborted) setUsage(null); });
    return ()=>controller.abort();
  },[open,ownerId,usageRevision]);
  const setOpen = useCallback((value: boolean) => {
    if (onPanelOpenChange) onPanelOpenChange(value); else setInternalOpen(value);
  }, [onPanelOpenChange]);
  const [question, setQuestion] = useState(initialConversation?.question || '');
  const [searchMode, setSearchMode] = useState<BayBaySearchMode>('smart');
  const [turns, setTurns] = useState<BayBayTurn[]>(initialConversation?.turns || []);
  const turnsRef = useRef<BayBayTurn[]>(initialConversation?.turns || []);
  const activeRequest = useRef<{ id: number; controller: AbortController } | null>(null);
  const sequence = useRef(Math.max(0, ...(initialConversation?.turns || []).map(turn => turn.id)));
  const consumedPending = useRef<string | number | null>(null);
  const pendingContext = useRef<{ key: string | number; path: string } | null>(null);
  const composing = useRef(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const threadRef = useRef<HTMLDivElement>(null);
  const scrolledTurn = useRef<{ id: number; state: BayBayTurn['state'] } | null>(null);
  const followReply = useRef(true);
  const lastScrollTop = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const [authRequired, setAuthRequired] = useState(false);
  const memberWebAccess = !!ownerId && !authRequired;
  const effectiveSearchMode = memberWebAccess ? searchMode : 'site';
  const loading = turns.some((turn) => turn.state === 'pending');
  const currentGuide = currentBayBayGuide(currentPath);
  const copy = (zh: string, en: string) => locale === 'en' ? en : translateText(zh, locale);
  const example = isBayBaySchoolGuide(currentGuide) ? BAYBAY_SCHOOL_STARTER : '周六带 5 岁孩子，从 Fremont 出发，每人门票预算 $50，帮我安排一天。';

  const updateTurns = useCallback((update: (previous: BayBayTurn[]) => BayBayTurn[]) => {
    turnsRef.current = update(turnsRef.current);
    setTurns(turnsRef.current);
  }, []);
  const stop = useCallback(() => {
    const request = activeRequest.current;
    if (!request) return;
    activeRequest.current = null;
    request.controller.abort();
    updateTurns((previous) => previous.map((turn) => turn.id === request.id ? { ...turn, state: 'cancelled' } : turn));
  }, [updateTurns]);
  const close = useCallback(() => { stop(); setCompletionNotice(null); setOpen(false); }, [stop, setOpen]);
  useEffect(() => { if (!open) { stop(); setCompletionNotice(null); } }, [open, stop]);
  useEffect(() => () => { activeRequest.current?.controller.abort(); activeRequest.current = null; }, []);
  useEffect(() => {
    if (!open) return;
    const latest = turns.at(-1);
    if (!latest) { scrolledTurn.current = null; return; }
    const previous = scrolledTurn.current;
    const element = threadRef.current?.querySelector(`[data-turn-id="${latest.id}"]`);
    let target: Element | null | undefined;
    if (previous?.id !== latest.id) {
      followReply.current = true;
      target = element?.querySelector('.baybay-user-question');
    } else if (previous.state !== latest.state && followReply.current) {
      target = element?.querySelector(latest.state === 'complete' ? '.member-baybay-answer-label' : '.baybay-request-error');
    }
    // Start at the answer, not the controls below it. A reader who scrolled
    // upward while waiting keeps their position when the response arrives.
    target?.scrollIntoView?.({ block: 'start' });
    lastScrollTop.current = scrollRef.current?.scrollTop || 0;
    scrolledTurn.current = { id: latest.id, state: latest.state };
  }, [open, turns]);

  const askBayBay = useCallback((text: string, requestPath = currentPath, keepConversation = false): boolean => {
    const message = text.trim();
    if (message.length < 2 || message.length > 500 || activeRequest.current) return false;
    // Keep the first request in the conversation, including plans. Moving to the
    // planner is an explicit action after the user has reviewed their needs.
    void keepConversation;
    const id = ++sequence.current;
    const controller = new AbortController();
    const reset = isBayBayResetRequest(message);
    if (reset) updateTurns(() => []);
    const history = conversationHistory(turnsRef.current);
    const previousTurn = [...turnsRef.current].reverse().find(turn => turn.state === 'complete');
    const previousReply = previousTurn?.response;
    const { searchContext: userContext, requestContext: searchContext, searchOverrides } = resolveBayBaySearchState(message, previousTurn, bayBayPageSearchContext(requestPath));
    const outingSearchToken = previousReply?.outingSearch?.continuationToken;
    const assistantSessionToken = previousReply?.assistantSessionToken;
    activeRequest.current = { id, controller };
    setCompletionNotice(null);
    const startedAt = performance.now();
    recordProductEvent('baybay_ask');
    updateTurns((previous) => [...previous, { id, question: message, state: 'pending', currentPath: requestPath, searchContext: userContext, searchOverrides }]);
    setQuestion('');
    void fetchBayBayReply(message, { currentPath: requestPath, searchMode: effectiveSearchMode, ...(assistantSessionToken ? { assistantSessionToken } : {}), ...(Object.keys(searchContext).length ? { searchContext } : {}), ...(categoryHint ? { categoryHint } : {}), ...(outingSearchToken ? { outingSearchToken } : {}) }, history, controller.signal, 100_000, progress => {
      if (activeRequest.current?.id === id) updateTurns(previous => previous.map(turn => turn.id === id && turn.state === 'pending' ? { ...turn, progress } : turn));
    }, {
      onCards: cards => { if (activeRequest.current?.id === id) updateTurns(previous => previous.map(turn => turn.id === id ? { ...turn, quickCards: cards } : turn)); },
      onText: text => { if (activeRequest.current?.id === id) updateTurns(previous => previous.map(turn => turn.id === id ? { ...turn, partialAnswer: (turn.partialAnswer || '') + text } : turn)); },
    })
      .then((response) => {
        if (activeRequest.current?.id !== id) return;
        recordProductEvent(performance.now() - startedAt < 15_000 ? 'baybay_fast' : 'baybay_slow');
        if (response.degraded) recordProductEvent('baybay_degraded');
        activeRequest.current = null;
        setUsageRevision(previous=>previous+1);
        if (response.retrieval?.webAccess?.reason === 'auth_required' || response.retrieval?.webStatus === 'auth_required') setAuthRequired(true);
        updateTurns((previous) => previous.map((turn) => {
          if (turn.id !== id) return turn;
          const nextContext = { ...turn.searchContext }, nextOverrides = { ...turn.searchOverrides }, state = response.taskState;
          // A cleared server condition must not be reintroduced by a stale page filter on the next turn.
          if (state && ('city' in state || 'region' in state)) {
            delete nextContext.city; delete nextContext.region; nextOverrides.location = true;
            if (state.city) nextContext.city = state.city;
            if (state.region) nextContext.region = state.region;
          }
          if (state && 'date' in state) { delete nextContext.date; nextOverrides.date = true; if (state.date) nextContext.date = state.date; }
          return { ...turn, state: 'complete', response, searchContext: nextContext, searchOverrides: nextOverrides };
        }));
        // Only a newly completed request announces. Streaming text and restored
        // history stay readable without becoming live regions.
        if (!announcedTurns.current.has(id)) {
          announcedTurns.current.add(id);
          const text = completionLocale.current === 'en'
            ? `BayBay reply ${id} is ready. Read the answer or continue in the question field.`
            : completionLocale.current === 'zh-Hant'
              ? `BayBay 的第 ${id} 條回答已完成。可以閱讀回答，或繼續在輸入框提問。`
              : `BayBay 的第 ${id} 条回答已完成。可以阅读回答，或继续在输入框提问。`;
          setCompletionNotice({ id, text });
        }
      }).catch((error: unknown) => {
        if (activeRequest.current?.id !== id) return;
        activeRequest.current = null;
        updateTurns((previous) => previous.map((turn) => turn.id === id ? {
          ...turn, state: 'error', error: bayBayErrorMessage(error), restartRequired: isBayBaySearchContextExpired(error), restartAssistant: isBayBayAssistantContextExpired(error),
        } : turn));
      });
    return true;
  }, [categoryHint, currentPath, effectiveSearchMode, updateTurns]);

  useEffect(() => {
    if (!pendingQuestion) { consumedPending.current = null; pendingContext.current = null; return; }
    const key = pendingQuestionId ?? pendingQuestion;
    if (pendingContext.current?.key !== key) pendingContext.current = { key, path: currentPath };
    if (!open || loading || consumedPending.current === key) return;
    if (pendingQuestionMode === 'draft' || pendingQuestion.trim().length < 2 || pendingQuestion.trim().length > 500) {
      setQuestion(pendingQuestion.slice(0, 500));
      if (pendingQuestionMode === 'draft') inputRef.current?.focus();
      consumedPending.current = key;
      onPendingQuestionConsumed?.(pendingQuestionId);
      return;
    }
    if (askBayBay(pendingQuestion, pendingContext.current.path)) {
      consumedPending.current = key;
      onPendingQuestionConsumed?.(pendingQuestionId);
    }
  }, [open, loading, currentPath, pendingQuestion, pendingQuestionMode, pendingQuestionId, askBayBay, onPendingQuestionConsumed]);

  const navigate = (path: string) => { onNavigate(path); close(); };
  const signIn = () => {
    stop();
    onLoginNeeded?.({ question, turns: turnsRef.current });
  };
  const handleAction = (action: GuideChatAction, intent: string) => {
    if (action.type === 'category' || action.type === 'guide') {
      if (safeBayBayPath(action.url)) navigate(action.url);
    } else if (action.type === 'post' || action.type === 'postAssist') {
      onCreatePostClick({ postType: action.postType || 'client', category: resolveCategoryLabel(action.category), initialIntent: intent });
      close();
    }
  };
  const lastComplete = [...turns].reverse().find((turn) => turn.state === 'complete');
  const followupPath = lastComplete?.currentPath || currentPath;
  const schoolContext = isBayBaySchoolGuide(currentGuide) || isBayBaySchoolGuide(currentBayBayGuide(followupPath)) || isBayBaySchoolRequest(question) || isBayBaySchoolRequest(turns[turns.length - 1]?.question || '');
  const outingContext = !!lastComplete?.response?.outingSearch;
  const lastResponse = lastComplete?.response;
  const serviceWorkflow = lastResponse?.responseMode === 'search' || !!lastResponse?.matchingPosts?.length
    || [...lastResponse?.suggestedActions || [], ...lastResponse?.interactiveCards?.flatMap(card => card.actions || []) || []].some(action => action.type === 'post' || action.type === 'postAssist');
  const planHandoffContext = !hasUnconfirmedFoodEvidence(lastResponse) && !serviceWorkflow && !!lastComplete && (['day-plan', 'discover', 'transit'].includes(lastResponse?.taskState?.goal || '')
    || lastResponse?.responseMode === 'catalog' || isBayBayPlanRequest(bayBayTaskBrief(turns)));

  return <>
    {variant !== 'headless' && (variant === 'sidebar' ? <div className="member-baybay-entry member-baybay-entry--sidebar">
      <div className="flex gap-2.5"><img src={BRAND.baybayAvatar} alt="BayBay" className="h-12 w-12 shrink-0 rounded-xl object-cover" width={48} height={48} />
        <div className="min-w-0 flex-1"><h3 className="sidebar-section-title leading-tight">BayBay AI 生活助手</h3>
          <p className="mt-1 text-[11px] leading-snug text-baylink-muted">周末去哪、怎么省钱、刚来湾区怎么安排，一起从攻略找到下一步。</p>
          <button type="button" onClick={() => setOpen(true)} className="member-primary mt-3 w-full">问问 BayBay</button></div></div>
    </div> : <button type="button" onClick={() => setOpen(true)} className="member-baybay-entry member-baybay-entry--inline">
      <img src={BRAND.baybayAvatar} alt="BayBay" className="h-9 w-9 shrink-0 rounded-lg object-cover" width={36} height={36} />
      <span className="min-w-0 flex-1"><span className="block text-[12px] font-medium text-baylink-text">问问 BayBay · AI 湾区生活助手</span><span className="block text-[11px] text-baylink-muted">周末灵感、亲子省钱、生活下一步</span></span><ChevronRight size={16} />
    </button>)}
    {open && <ModalShell onClose={close} labelledBy="baybay-panel-title" className="member-baybay-overlay" initialFocusRef={pendingQuestionMode === 'draft' ? inputRef : undefined} restoreFocusRef={restoreFocusRef}>
      <div className="member-baybay-dialog baybay-conversation" onClick={(event) => event.stopPropagation()}>
        <div className="member-baybay-header">
          <div className="flex min-w-0 gap-3"><img src={BRAND.baybayAvatar} alt="" className="member-baybay-avatar" width={48} height={48} />
            <div className="min-w-0"><EnglishOnly><span className="member-compose-eyebrow">YOUR BAY AREA, A LITTLE EASIER</span></EnglishOnly>
              <h2 id="baybay-panel-title"><Sparkles size={15} /><span>BayBay AI 湾区生活助手</span></h2></div></div>
          <button type="button" onClick={close} className="member-compose-close" aria-label="关闭"><X size={20} /></button>
          <p>BAYLINK 的 AI 助手，陪你安排湾区生活。</p>
        </div>
        <p className="sr-only" role="status" aria-live="polite" aria-atomic="true" translate="no" data-baybay-completion data-baybay-completion-turn={completionNotice?.id}>{completionNotice?.text || ''}</p>
        <div ref={scrollRef} className="member-baybay-body baybay-scroll" onScroll={event => {
          const top = event.currentTarget.scrollTop;
          if (top < lastScrollTop.current - 2) followReply.current = false;
          lastScrollTop.current = top;
        }}>
          <div className="baybay-context-line"><span translate="no">{copy('查资料 · 比较选择 · 接着安排', 'Discover · Compare · Make a plan')}</span>{turns.length > 0 && <button type="button" onClick={() => { stop(); setCompletionNotice(null); updateTurns(() => []); setQuestion(''); }}><Plus size={13} />新对话</button>}</div>
          <details className="baybay-conversation-details" translate="no">
            <summary>{copy('检索、额度与对话说明', 'Search, limits and conversation details')}</summary>
            <p className="baybay-composer-note">{memberWebAccess
              ? searchMode === 'site' ? copy('只参考站内资料', 'Site information only') : copy('已登录 · 可按需联网；额度或服务受限时会说明，并保留站内结果。', 'Signed in · Web lookups are available when needed, subject to limits and availability. Site results remain available.')
              : copy('当前只使用 BAYLINK 已收录资料。登录后可按需联网核实，受查询额度与服务可用性限制。', 'Uses information already collected by BAYLINK. Sign in for web verification, subject to lookup limits and availability.')}</p>
            {usage && <p className="baybay-composer-note">{copy(`今日模型查询剩余 ${usage.remaining} / ${usage.limit}；湾区午夜重置。紧急求助卡与站内资料仍可用。`, `Model queries remaining today: ${usage.remaining} / ${usage.limit}. Resets at Bay Area midnight. Emergency resources and site information remain available.`)}</p>}
            <p className="baybay-composer-note">{copy('对话仅保留在当前标签页，刷新即清除。小队搜索沿用已确认条件；其他问答参考最近 4 轮，并保留你明确的城市与日期条件。小队以详情最新状态为准，活动日期与票价请向主办方核实。', 'This conversation clears on refresh. Outing searches retain confirmed conditions; other replies use the last 4 turns and retain your stated city and date. Check outing details for current status and organizers for event dates and prices.')}</p>
          </details>
          {schoolContext && <p className="baybay-composer-note baybay-school-privacy" id="baybay-school-privacy">{BAYBAY_SCHOOL_NOTE}</p>}
          {currentGuide && <div className="baybay-reading-context"><BookOpen size={16} /><div><small>正在结合你阅读的攻略</small><strong>{currentGuide.title}</strong></div>
            <button type="button" disabled={loading} onClick={() => askBayBay(translateText(bayBayPageQuestions(currentPath)[0].question, locale))}>帮我读</button></div>}
          {currentGuide && <div className="baybay-followups" role="group" aria-label="围绕这篇指南提问"><span>围绕这篇指南提问</span>{bayBayPageQuestions(currentPath).map(prompt => <button type="button" key={prompt.label} disabled={loading} onClick={() => askBayBay(translateText(prompt.question, locale))}>{prompt.label}<ArrowUp size={12} /></button>)}</div>}
          {turns.length === 0 && <section className="baybay-welcome"><h3>今天，想让生活轻松一点？</h3><p>选一件想做的事，或直接在下方告诉我。</p>
            <div className="baybay-action-grid">
              <button type="button" onClick={() => { const original = question.trim(), social = `${original}${copy('，我想找搭子一起去。', '. I want to find people to go with.')}`; askBayBay(original ? isBayBaySocialRequest(original) || social.length > 500 ? original : social : copy('我想找搭子一起去，请先问我城市和日期。', 'I want to find people to go with. Ask me which city and date first.'), currentPath, true); }}><span className="baybay-action-icon"><Users size={20} /></span><span translate="no"><strong>{copy('找搭子一起去', 'Find a small group')}</strong><small>{copy('告诉我城市和日期，查找真实小队', 'Tell me a city and date to find real outings')}</small></span><ChevronRight size={15} /></button>
              <button type="button" onClick={() => navigate(question.trim().length >= 2 ? bayBayPlanPath(question, ownerId) : '/plan')}><span className="baybay-action-icon"><CalendarDays size={20} /></span><span><strong>安排周末</strong><small>说出城市、同行人和预算</small></span><ChevronRight size={15} /></button>
              <button type="button" onClick={() => navigate('/plan?import=event')}><span className="baybay-action-icon"><ImagePlus size={20} /></span><span><strong>读活动截图</strong><small>把海报整理成日历活动</small></span><ChevronRight size={15} /></button>
              <button type="button" onClick={() => { setQuestion(translateText('我想找本地服务：', locale)); inputRef.current?.focus(); }}><span className="baybay-action-icon"><MapPin size={20} /></span><span><strong>找本地服务</strong><small>从需求开始，查找站内信息</small></span><ChevronRight size={15} /></button>
              <button type="button" onClick={() => navigate('/tools?tool=communication')}><span className="baybay-action-icon"><MessageCircle size={20} /></span><span><strong>沟通帮手</strong><small>把想说的话写成中英文</small></span><ChevronRight size={15} /></button>
              <button type="button" className="col-span-2" onClick={() => { setQuestion(translateText(BAYBAY_SCHOOL_STARTER, locale)); inputRef.current?.focus(); }}><span className="baybay-action-icon"><GraduationCap size={20} /></span><span><strong>学校与入学</strong><small>地区、年级与官方核验入口</small></span><ChevronRight size={15} /></button>
            </div>
            <div className="baybay-action-example"><span>试着这样说</span><button type="button" onClick={() => { setQuestion(translateText(example, locale)); inputRef.current?.focus(); }}>{example}</button></div>
            {!isBayBaySchoolGuide(currentGuide) && <div className="baybay-action-example" translate="no"><span>{copy('想认识同行的人', 'Find some company')}</span><button type="button" onClick={() => { setQuestion(copy('这个周末想在旧金山找人一起去，有哪些小队？', 'I want to find people to go with in San Francisco this weekend. Are there any outings?')); inputRef.current?.focus(); }}>{copy('这个周末想在旧金山找人一起去，有哪些小队？', 'I want to find people to go with in San Francisco this weekend. Are there any outings?')}</button></div>}
          </section>}
          <div ref={threadRef} className="baybay-thread" aria-label="本次对话">
            {turns.map((turn) => <section className="baybay-turn" key={turn.id} data-turn-id={turn.id} aria-label={`问题：${turn.question}`}>
              <div className="baybay-user-question"><span>你</span><p>{turn.question}</p></div>
              {turn.state === 'pending' && <p role="status" className="baybay-thinking" translate="no"><Loader2 size={15} className="animate-spin" />{turn.progress ? <span>{({ site: copy('站内资料', 'Site information'), research: copy('问题分析与检索', 'Analysis and research'), sources: copy('来源阅读', 'Source review'), routes: copy('路线估算', 'Route estimates'), answer: copy('答复整理', 'Answer preparation') })[turn.progress.phase]}{turn.progress.status === 'running' ? copy('处理中…', ' in progress…') : copy('阶段结束，正在等待结果…', ' stage ended; waiting for the result…')}</span> : copy('正在等待答复；完成后会显示本次来源。', 'Waiting for the answer; sources will appear when it is ready.')}</p>}
              {turn.state === 'pending' && <><BayBayEntityCards cards={turn.quickCards || []} onNavigate={navigate} />{turn.partialAnswer && <p className="baybay-stream-answer">{turn.partialAnswer}</p>}</>}
              {(turn.state === 'error' || turn.state === 'cancelled') && <div className="baybay-request-error"><p role={turn.state === 'error' ? 'alert' : undefined}>{turn.state === 'cancelled' ? '已停止。问题保留在这里，随时可以重试。' : turn.error}</p>{turn.restartRequired ? <button type="button" disabled={loading} onClick={() => { const draft = turn.restartAssistant ? (bayBayTaskBrief(turns) || turn.question).slice(0, 500) : copy('我想找搭子一起去。', 'I want to find people to go with.'); stop(); updateTurns(() => []); setQuestion(draft); inputRef.current?.focus(); }} translate="no"><RotateCcw size={13}/>{turn.restartAssistant ? copy('重新开始对话', 'Start a new conversation') : copy('重新开始查找', 'Start a new search')}</button> : <button type="button" disabled={loading} onClick={() => askBayBay(turn.question, turn.currentPath)}><RotateCcw size={13} />重试这个问题</button>}</div>}
              {turn.response && <div className="member-baybay-answer">
                <div className="member-baybay-answer-label" translate={hasUnconfirmedFoodEvidence(turn.response) ? 'no' : undefined}><Sparkles size={12} />{hasUnconfirmedFoodEvidence(turn.response) ? locale === 'zh-Hant' ? '餐飲資訊待確認' : copy('餐饮信息待确认', 'Food information unconfirmed') : turn.response.outingSearch ? copy('小队搜索', 'Outing search') : turn.response.degraded ? '参考指引' : 'BayBay 建议'}</div>
                <BayBayRetrievalLabel response={turn.response} />
                <BayBayCoverageSummary response={turn.response} />
                {!hasUnconfirmedFoodEvidence(turn.response) && <BayBayEntityCards cards={turn.response.localMatches || turn.quickCards || []} onNavigate={navigate} />}
                {turn.response.degraded && <p role="status" className="baybay-degraded" translate="no">{copy('本次未能形成完整答复，以下保留已取得的资料与待确认项。请核对来源后再行动。', 'This response is incomplete. Available information and unconfirmed items are retained below. Check the sources before acting.')}</p>}
                {turn.response.outingSearch?.state !== 'needs_clarification' && <BayBayAnswer response={turn.response} onNavigate={navigate} />}
                {turn.response.assistantPlan && <BayBayAssistantPlanCard plan={turn.response.assistantPlan} taskState={turn.response.taskState} ownerId={ownerId} evidence={turn.response.evidence || []} disabled={loading || turn.id !== lastComplete?.id} onAsk={message => askBayBay(message, turn.currentPath, true)} onNavigate={navigate} />}
                {turn.response.outingSearch && <BayBayOutingResults search={turn.response.outingSearch} answer={turn.response.answer} blockedUserIds={blockedUserIds} onNavigate={navigate}
                  onAnswer={turn.id === turns[turns.length - 1]?.id && !loading && !question.trim() && !schoolContext ? answer => { if (!composing.current) askBayBay(answer, turn.currentPath, true); } : undefined}/>}
                <BayBayMatchingPosts posts={turn.response.matchingPosts || []} note={turn.response.responseMode === 'catalog' || ['completed', 'unavailable', 'verification_failed'].includes(turn.response.retrieval?.webStatus || '') ? undefined : turn.response.matchNote} onNavigate={navigate} />
                {turn.response.interactiveCards?.map((card) => <BayBaySmartCard key={card.id} card={card} onAction={(action) => handleAction(action, turn.question)} />)}
                <BayBayDiscoveryResults response={turn.response} ownerId={ownerId} sessionKey={sessionKey} onNavigate={navigate} />
                <BayBayFeedback turnId={turn.id} />
                <BayBayReferences response={turn.response} currentPath={turn.currentPath} onNavigate={navigate} />
                {!!turn.response.suggestedActions?.length && <div className="mt-2.5 flex flex-wrap gap-1.5">{turn.response.suggestedActions.map((action, index) => <button type="button" key={`${action.label}-${index}`} onClick={() => handleAction(action, turn.question)} className="member-baybay-action border border-baylink-border/50 bg-white text-baylink-text">{action.label}</button>)}</div>}
                {turn.response.safetyNote && <p className="mt-2.5 text-[11px] leading-relaxed text-baylink-muted">{turn.response.safetyNote}</p>}
              </div>}
            </section>)}
          </div>
          {lastComplete?.response?.taskState && !schoolContext && !outingContext && <BayBayRequirements key={`requirements:${lastComplete.id}`} state={lastComplete.response.taskState} disabled={loading} onAsk={message => askBayBay(message, followupPath, true)} />}
          {lastComplete && planHandoffContext && !loading && !schoolContext && !outingContext && !lastComplete.response?.assistantPlan && <BayBayTaskHandoff key={lastComplete.id} brief={bayBayTaskBrief(turns)} ownerId={ownerId} onNavigate={navigate} />}
          {lastComplete && !loading && !lastComplete.response?.assistantPlan && !turns[turns.length - 1]?.restartRequired && (!hasUnconfirmedFoodEvidence(lastComplete.response) || !!lastComplete.response?.followups?.length) && (outingContext ? <p className="baybay-composer-note" translate="no">{copy('可以继续告诉我城市、日期或想做的事；我会保留你已经说过的条件。这里只帮你查找，不会自动申请或发布。', 'Tell me a city, date or activity to refine your search. I will keep the details you already shared. Searching does not apply to or publish an outing.')}</p> : <div className="baybay-followups"><span>接着聊</span>{bayBayFollowups(lastComplete.question, !!currentBayBayGuide(followupPath), isBayBaySchoolGuide(currentBayBayGuide(followupPath)), lastComplete.response?.followups).map((followup) => <button type="button" key={followup} onClick={() => askBayBay(translateText(followup, locale), followupPath)}>{followup}<ArrowUp size={12} /></button>)}</div>)}
          {turns.length === 0 && <div className="baybay-start-links"><button type="button" onClick={() => navigate('/guides')}><BookOpen size={14} />自己浏览攻略</button><button type="button" onClick={() => navigate('/tools')}>打开生活工具箱<ChevronRight size={14} /></button></div>}
        </div>
        <form className="baybay-composer-footer" onSubmit={(event) => { event.preventDefault(); if (!composing.current) askBayBay(question); }}>
          <div className="baybay-search-modes" role="group" aria-label={copy('检索范围', 'Search scope')} translate="no">{memberWebAccess ? <>{([['smart', '智能检索', 'Smart'], ['web', '联网查', 'Web'], ['site', '仅站内', 'Site only']] as const).map(([mode, zh, en]) => <button type="button" key={mode} aria-pressed={effectiveSearchMode === mode} disabled={loading} onClick={() => setSearchMode(mode)}>{copy(zh, en)}</button>)}</> : <><strong className="baybay-access-label">{ownerId ? copy('登录需更新 · 仅站内', 'Sign-in needs updating · Site only') : copy('访客 · 仅站内', 'Guest · Site only')}</strong>{onLoginNeeded && <button type="button" onClick={signIn}>{copy('登录 / 注册，开启联网', 'Sign in / Register for web access')}</button>}</>}</div>
          <div className="member-baybay-composer"><input ref={inputRef} type="text" aria-label="向 BayBay 提问" value={question} maxLength={500}
            aria-describedby={schoolContext ? 'baybay-school-privacy' : undefined}
            onChange={(event) => setQuestion(event.target.value)} onCompositionStart={() => { composing.current = true; }} onCompositionEnd={() => { composing.current = false; }}
            onKeyDown={(event) => {
              if (event.key !== 'Enter') return;
              event.preventDefault();
              if (!composing.current && !event.nativeEvent.isComposing && event.nativeEvent.keyCode !== 229) askBayBay(question);
            }} placeholder={schoolContext ? '例如：东湾 Fremont，准备入读三年级' : turns.length ? '继续补充城市、预算或你的想法…' : '例如：周末带 6 岁孩子，东湾有什么免费去处？'} className="member-baybay-question-input" />
            {loading ? <button type="button" onClick={stop} className="member-baybay-ask"><Square size={13} />停止</button> : <button type="submit" disabled={question.trim().length < 2} className="member-baybay-ask"><span>问一下</span><ArrowUp size={15} /></button>}
          </div>
        </form>
      </div>
    </ModalShell>}
  </>;
};

function BayBayReferences({ response, currentPath, onNavigate }: { response: GuideChatResponse; currentPath?: string; onNavigate: (path: string) => void }) {
  const reading = response.responseMode === 'catalog' ? undefined : currentBayBayGuide(currentPath || '');
  const references = bayBayReferenceGuides(response);
  const items = reading ? [reading, ...references.filter(guide => guide.slug !== reading.slug)] : references;
  if (!items.length) return null;
  return <div className="baybay-references"><p>原文与核验来源</p><small className="block text-[11px] leading-relaxed text-baylink-muted">以下是站内指南列出的参考资料，不表示已实时核验。</small>{items.map(guide => <div key={guide.slug} className="mt-2">
    <div className="baybay-reference-image"><GuideFigure image={getGuideMedia(guide).cover} variant="preview" /></div>
    {guide.slug === reading?.slug && <small className="text-[11px] text-baylink-muted">提问时阅读的指南</small>}
    <button type="button" onClick={() => onNavigate(`/guides/${guide.slug}`)}><BookOpen size={13} /><span>{guide.title}</span><ChevronRight size={13} /></button>
    {bayBayGuideSources(guide).length > 0 && <details><summary className="cursor-pointer text-[11px] text-baylink-muted">查看原文来源</summary><ul className="mt-2 space-y-2 pl-4 text-[11px] leading-relaxed">{bayBayGuideSources(guide).map(source => <li key={source.url}><a className="break-words underline underline-offset-2" href={source.url} target="_blank" rel="noopener noreferrer">{source.title}</a></li>)}</ul></details>}
  </div>)}</div>;
}

function BayBayFeedback({ turnId }: { turnId: number }) {
  const [vote,setVote] = useState<'helpful' | 'unhelpful' | null>(null);
  const english = useLocale() === 'en';
  return <div className="baybay-feedback" aria-label={english ? 'Was this useful?' : '这次回答有帮助吗？'} data-feedback-turn={turnId}><span>{vote ? english ? 'Thanks for your feedback' : '已记录，谢谢反馈' : english ? 'Was this useful?' : '有帮助吗？'}</span><button type="button" aria-pressed={vote==='helpful'} disabled={!!vote} onClick={()=>{setVote('helpful');recordProductEvent('baybay_helpful');}}><ThumbsUp size={18} />{english?'Useful':'有帮助'}</button><button type="button" aria-pressed={vote==='unhelpful'} disabled={!!vote} onClick={()=>{setVote('unhelpful');recordProductEvent('baybay_unhelpful');}}><ThumbsDown size={18} />{english?'Not yet':'没解决'}</button></div>;
}
