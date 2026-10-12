import { useState, useCallback, useEffect, useLayoutEffect, useRef } from 'react';
import { ThumbsUp, ThumbsDown, X, Sparkles, Loader2, ArrowUp, Square, RotateCcw, Plus } from 'lucide-react';
import { recordProductEvent } from '../lib/product-events';
import { recordBayBayLatency } from '../lib/baybay-latency';
import { BayBayDownvoteReasons } from '../features/feedback/BayBayDownvoteReasons';
import { API_BASE_URL, authHeaders } from '../lib/api';
import { BRAND } from '../brandAssets';
import { getCategoryFromSlug } from '../routing';
import { BayBaySmartCard } from './BayBaySmartCard';
import { ModalShell } from './ui/Modal';
import { BayBayMatchingPosts } from './BayBayMatchingPosts';
import { BayBayOutingResults } from './BayBayOutingResults';
import { BayBayAssistantPlanCard, BayBayRequirements } from './BayBayAssistantPlan';
import { BayBayAnswer, BayBayCoverageSummary, BayBayDiscoveryResults, BayBaySources, BayBayTaskHandoff } from './BayBayDiscoveryResults';
import {
  bayBayFollowups, bayBayErrorCode, bayBayErrorMessage, bayBayPlanPath, isBayBayPlanRequest, isBayBaySocialRequest, isBayBaySearchContextExpired, isBayBayAssistantContextExpired, conversationHistory, currentBayBayGuide, fetchBayBayReply, safeBayBayPath, bayBayTaskBrief,
  bayBayPageQuestions, isBayBaySchoolGuide, isBayBaySchoolRequest, BAYBAY_SCHOOL_NOTE, BAYBAY_SCHOOL_STARTER,
  type BayBayTurn, type GuideChatAction, type GuideChatResponse, type BayBaySearchMode,
} from '../lib/baybay-conversation';
import { BAYBAY_STARTERS, BAYBAY_ENTITY_QUESTIONS, bayBayPageRef, type BayBayStarter } from '../features/baybay/panel-chips';
import { bayBayAssistantResult } from '../lib/baybay-assistant';
import { BAYBAY_QUOTA_ERRORS, bayBayFullNoticeTurns, parseBayBayAnswerFields, parseBayBayCapabilities, type BayBayCapabilities } from '../lib/baybay-answer';
import { getBayAreaToday } from '../lib/monthly';
import { BayBayAnswerBody, BayBayCardRail, BayBayCallActions, BayBayDraftPreview, BayBayEmergencyCard, BayBayNoticeBanner, BayBayResourceCard, BayBayScheduledNotice } from '../features/baybay/BayBayAnswer';
import { BayBaySaveScope } from '../features/baybay/BayBaySaveScope';
import { bayBayPageTitle } from '../features/baybay/page-title';
import { loadBayBayCards } from '../features/baybay/cards-loader';
import { translateText, useLocale } from '../i18n/locale';
import { useReadingSize, useSimpleDisplay } from '../lib/reading-preferences';
import { bayBayPageSearchContext, isBayBayResetRequest, resolveBayBaySearchState } from '../lib/baybay-context';
import { LocaleFeatureGate } from './LocaleContentGate';

type CreatePostOptions = { postType?: 'client' | 'provider'; category?: string; initialIntent?: string };
/** An explicit guest sign-in carries only this tab's in-memory draft, never account history. */
export type BayBayConversationDraft = { question: string; turns: BayBayTurn[] };
type BayBayAssistantEntryProps = {
  /** The panel only; the page chrome (header, tab bar, home) owns the entry buttons. */
  variant: 'headless';
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

// BayBay's cards show events, offers, openings and guides over any page: it waits for its own dictionaries (WEB-DATA-SPLIT).
export const BayBayAssistantEntry = (props: BayBayAssistantEntryProps) => <LocaleFeatureGate feature="baybay"><BayBayAssistantSession key={JSON.stringify([props.ownerId || 'guest', props.sessionKey])} {...props} /></LocaleFeatureGate>;

const BayBayAssistantSession = ({ onNavigate, onCreatePostClick, categoryHint,
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
  // Pause / reduced mode (API-BB-CUTOVER): a banner with 911 / 211 first. Unknown shapes mean "not paused".
  const [capabilities, setCapabilities] = useState<BayBayCapabilities>({ pause: null, reduced: null, scheduled: null });
  useEffect(() => {
    if (!open) return; const controller = new AbortController();
    void fetch(`${API_BASE_URL}/ai/baybay-capabilities`, { headers: authHeaders(), signal: controller.signal }).then(async response => response.ok ? response.json() : null)
      .then(value => { if (!controller.signal.aborted) setCapabilities(parseBayBayCapabilities(value)); })
      .catch(() => { if (!controller.signal.aborted) setCapabilities({ pause: null, reduced: null, scheduled: null }); });
    return () => controller.abort();
  }, [open, ownerId, usageRevision]);
  // The image-card chunk starts loading with the panel, so it is ready when the first answer arrives.
  useEffect(() => { if (open) void loadBayBayCards().catch(() => {}); }, [open]);
  // "正在看：xx ✕": the page the reader is on goes with each question until they dismiss it on this page.
  const [pageOffPath, setPageOffPath] = useState<string | null>(null);
  const pageRef = bayBayPageRef(currentPath);
  const pageTitle = pageRef ? bayBayPageTitle(pageRef) : null;
  const pageOff = pageOffPath === currentPath;
  const contextPath = pageOff ? '/' : currentPath;
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
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [authRequired, setAuthRequired] = useState(false);
  const memberWebAccess = !!ownerId && !authRequired;
  const effectiveSearchMode = memberWebAccess ? searchMode : 'site';
  const loading = turns.some((turn) => turn.state === 'pending');
  const currentGuide = currentBayBayGuide(contextPath);
  const copy = (zh: string, en: string) => locale === 'en' ? en : translateText(zh, locale);
  const today = getBayAreaToday();

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
      // The answer starts at its pause notice when there is one, else its label; an emergency answer starts at its 911 card.
      target = element?.querySelector(latest.state === 'complete' ? '[data-notice], .member-baybay-answer-label, .bb-emergency' : '.baybay-request-error');
    }
    // Start at the answer, not the controls below it. A reader who scrolled
    // upward while waiting keeps their position when the response arrives.
    target?.scrollIntoView?.({ block: 'start' });
    lastScrollTop.current = scrollRef.current?.scrollTop || 0;
    scrolledTurn.current = { id: latest.id, state: latest.state };
  }, [open, turns]);

  const askBayBay = useCallback((text: string, askedPath = contextPath, keepConversation = false): boolean => {
    const message = text.trim();
    if (message.length < 2 || message.length > 500 || activeRequest.current) return false;
    // After ✕ the dismissed page goes with nothing: not with follow-ups, retries or plan answers of turns asked on it either.
    const requestPath = pageOff && askedPath === currentPath ? '/' : askedPath;
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
      // The lead and each point preview as they stream (unvalidated, outside live regions); the result replaces them.
      onDraft: draft => { if (activeRequest.current?.id === id && turnsRef.current.some(turn => turn.id === id && turn.state === 'pending' && ((turn.draftLead || '') !== draft.lead || (turn.draftPoints || []).join('␞') !== draft.points.join('␞')))) updateTurns(previous => previous.map(turn => turn.id === id ? { ...turn, draftLead: draft.lead, draftPoints: draft.points } : turn)); },
    })
      .then((raw) => {
        if (activeRequest.current?.id !== id) return;
        // The v2 answer and cut-over fields render only after validation (cards, tel: links, notices, safety card).
        const response: GuideChatResponse = { ...raw, lead: undefined, points: undefined, gap: undefined, pageEntity: undefined, safety: undefined, notice: undefined, fallbackHelp: undefined, corrected: undefined, ...parseBayBayAnswerFields(raw) };
        recordBayBayLatency(performance.now() - startedAt);
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
        // A quota refusal reads in the reader's language whatever the server sent (api #37 codes); other errors as before.
        const code = bayBayErrorCode(error), quota = code ? BAYBAY_QUOTA_ERRORS[code] : undefined;
        const message = quota ? completionLocale.current === 'en' ? quota.en : translateText(quota.zh, completionLocale.current) : bayBayErrorMessage(error);
        updateTurns((previous) => previous.map((turn) => turn.id === id ? {
          ...turn, state: 'error', error: message, errorCode: code, restartRequired: isBayBaySearchContextExpired(error), restartAssistant: isBayBayAssistantContextExpired(error),
        } : turn));
      });
    return true;
  }, [categoryHint, contextPath, currentPath, effectiveSearchMode, pageOff, updateTurns]);

  useEffect(() => {
    if (!pendingQuestion) { consumedPending.current = null; pendingContext.current = null; return; }
    const key = pendingQuestionId ?? pendingQuestion;
    if (pendingContext.current?.key !== key) pendingContext.current = { key, path: contextPath };
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
  }, [open, loading, contextPath, pendingQuestion, pendingQuestionMode, pendingQuestionId, askBayBay, onPendingQuestionConsumed]);

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
  const followupPath = pageOff && lastComplete?.currentPath === currentPath ? contextPath : lastComplete?.currentPath || contextPath;
  const schoolContext = isBayBaySchoolGuide(currentGuide) || isBayBaySchoolGuide(currentBayBayGuide(followupPath)) || isBayBaySchoolRequest(question) || isBayBaySchoolRequest(turns[turns.length - 1]?.question || '');
  const outingContext = !!lastComplete?.response?.outingSearch;
  const lastResponse = lastComplete?.response;
  const serviceWorkflow = lastResponse?.responseMode === 'search' || !!lastResponse?.matchingPosts?.length
    || [...lastResponse?.suggestedActions || [], ...lastResponse?.interactiveCards?.flatMap(card => card.actions || []) || []].some(action => action.type === 'post' || action.type === 'postAssist');
  const planHandoffContext = !hasUnconfirmedFoodEvidence(lastResponse) && !serviceWorkflow && !!lastComplete && (['day-plan', 'discover', 'transit'].includes(lastResponse?.taskState?.goal || '')
    || lastResponse?.responseMode === 'catalog' || isBayBayPlanRequest(bayBayTaskBrief(turns)));
  const pageQuestions = turns.length || pageOff || !pageRef ? [] : pageRef.kind === 'guide'
    ? bayBayPageQuestions(contextPath).map(prompt => ({ label: prompt.label, question: translateText(prompt.question, locale) }))
    : BAYBAY_ENTITY_QUESTIONS[pageRef.kind].map(prompt => ({ label: copy(prompt.zh, prompt.en), question: copy(prompt.zh, prompt.en) }));
  const startWith = (starter: BayBayStarter) => {
    if (!('zhQuestion' in starter)) return navigate(starter.action === 'screenshot' ? '/plan?import=event' : question.trim().length >= 2 ? bayBayPlanPath(question, ownerId) : '/plan');
    const text = copy(starter.zhQuestion, starter.enQuestion);
    if (starter.action === 'send') { askBayBay(text); return; }
    setQuestion(text); inputRef.current?.focus();
  };
  const placeholder = schoolContext ? '例如：东湾 Fremont，准备入读三年级' : turns.length ? '继续补充城市、预算或你的想法…' : '例如：周末带 6 岁孩子，东湾有什么免费去处？';
  // The question box fits its text up to four lines (then scrolls), and an empty box is as tall as its whole example
  // at any text size, so the example that teaches what to ask is never cut off (READ-10). Aa (特大) and 简洁显示 change
  // the text size without a resize, so the box fits again when either changes.
  const readingSize = useReadingSize(), simpleDisplay = useSimpleDisplay();
  useLayoutEffect(() => {
    const field = inputRef.current;
    if (!open || !field) return;
    const view = field.ownerDocument.defaultView;
    if (!view) return;
    const fit = () => {
      const style = view.getComputedStyle(field);
      const line = parseFloat(style.lineHeight) || (parseFloat(style.fontSize) || 16) * 1.5;
      const border = (parseFloat(style.borderTopWidth) || 0) + (parseFloat(style.borderBottomWidth) || 0);
      const padding = (parseFloat(style.paddingTop) || 0) + (parseFloat(style.paddingBottom) || 0);
      field.style.height = 'auto';
      let content = field.scrollHeight;
      if (!field.value && field.placeholder) { field.value = field.placeholder; content = field.scrollHeight; field.value = ''; }
      if (!content) { field.style.height = ''; return; }
      const cap = field.value ? line * 4 + padding + border : Infinity;
      field.style.height = `${Math.min(content + border, cap)}px`;
      field.style.overflowY = content + border > cap ? 'auto' : 'hidden';
    };
    fit();
    view.addEventListener('resize', fit);
    return () => view.removeEventListener('resize', fit);
  }, [open, question, placeholder, locale, readingSize, simpleDisplay]);
  const emergencyLast = lastComplete?.response?.safety?.kind === 'emergency';
  const fullNotice = bayBayFullNoticeTurns(turns);

  return <>
    {open && <ModalShell onClose={close} labelledBy="baybay-panel-title" className="member-baybay-overlay" initialFocusRef={pendingQuestionMode === 'draft' ? inputRef : undefined} restoreFocusRef={restoreFocusRef}>
      <div className="member-baybay-dialog baybay-conversation" onClick={(event) => event.stopPropagation()}>
        <div className="member-baybay-header">
          <div className="flex min-w-0 gap-3"><img src={BRAND.baybayAvatar} alt="" className="member-baybay-avatar" width={48} height={48} />
            <div className="min-w-0"><h2 id="baybay-panel-title"><Sparkles size={15} /><span>{copy('问 BayBay', 'Ask BayBay')}</span></h2>
              <p className="bb-header-sub">{copy('有来源的中文答案', 'Bay Area answers, with sources')}</p></div></div>
          <button type="button" onClick={close} className="member-compose-close" aria-label={copy('关闭', 'Close')}><X size={20} /></button>
        </div>
        <p className="sr-only" role="status" aria-live="polite" aria-atomic="true" translate="no" data-baybay-completion data-baybay-completion-turn={completionNotice?.id}>{completionNotice?.text || ''}</p>
        <div ref={scrollRef} className="member-baybay-body baybay-scroll" onScroll={event => {
          const top = event.currentTarget.scrollTop;
          if (top < lastScrollTop.current - 2) followReply.current = false;
          lastScrollTop.current = top;
        }}>
          {/* The pause banner (with 911 · 211) shows once: here until an answer carries the notice, then on the newest such answer. */}
          {capabilities.pause ? fullNotice.pause === undefined && <BayBayNoticeBanner kind={capabilities.pause.kind} text={capabilities.pause.banner[locale]} resumesAt={capabilities.pause.resumesAt} actions={capabilities.pause.actions} />
            : capabilities.reduced && fullNotice.reduced === undefined && <BayBayNoticeBanner kind="ai_budget_reduced" text={capabilities.reduced.banner[locale]} resumesAt={capabilities.reduced.resumesAt} />}
          {/* The AI cutoff, in its last 7 days: a calm line, not an alarm (api #37 pauseScheduled / aiUntil). */}
          {capabilities.scheduled && <BayBayScheduledNotice text={capabilities.scheduled.banner[locale]} />}
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
          {turns.length === 0 && <section className="bb-welcome" aria-labelledby="baybay-welcome-title">
            <h3 id="baybay-welcome-title">{copy('想知道什么，直接问', 'What would you like to know?')}</h3>
            {pageQuestions.length > 0 && <div className="bb-chip-group"><p>{copy('围绕这一页提问', 'Ask about this page')}</p>
              <ul className="bb-chips bb-chips--page" aria-label={copy('围绕这一页提问', 'Ask about this page')}>{pageQuestions.map(prompt => <li key={prompt.label}><button type="button" disabled={loading} onClick={() => askBayBay(prompt.question)}>{prompt.label}<ArrowUp aria-hidden="true" size={16} /></button></li>)}</ul></div>}
            <div className="bb-chip-group"><p>{copy('常用问题', 'Popular questions')}</p>
              <ul className="bb-chips" aria-label={copy('常用问题', 'Popular questions')}>{BAYBAY_STARTERS.map(starter => <li key={starter.id}><button type="button" disabled={loading && starter.action === 'send'} onClick={() => startWith(starter)}>{copy(starter.zh, starter.en)}</button></li>)}</ul></div>
            <p className="bb-also" translate="no"><span>{copy('也可以：', 'You can also:')}</span>
              <button type="button" onClick={() => { const original = question.trim(), social = `${original}${copy('，我想找搭子一起去。', '. I want to find people to go with.')}`; askBayBay(original ? isBayBaySocialRequest(original) || social.length > 500 ? original : social : copy('我想找搭子一起去，请先问我城市和日期。', 'I want to find people to go with. Ask me which city and date first.'), contextPath, true); }}>{copy('找搭子一起去', 'Find a small group')}</button>
              <button type="button" onClick={() => { setQuestion(translateText('我想找本地服务：', locale)); inputRef.current?.focus(); }}>{copy('找本地服务', 'Find a local service')}</button>
              <button type="button" onClick={() => navigate('/tools?tool=communication')}>{copy('沟通帮手', 'Message helper')}</button>
              <button type="button" onClick={() => { setQuestion(translateText(BAYBAY_SCHOOL_STARTER, locale)); inputRef.current?.focus(); }}>{copy('学校与入学', 'Schools and enrollment')}</button>
            </p>
          </section>}
          {!ownerId && turns.some(turn => turn.state === 'complete') && <p className="bb-guest-note" translate="no">{copy('访客模式：BayBay 只用 BAYLINK 站内已收录的资料回答。', 'Guest mode: BayBay answers from information already on BAYLINK.')}</p>}
          <BayBaySaveScope ownerId={ownerId}><div ref={threadRef} className="baybay-thread" aria-label="本次对话">
            {turns.map((turn) => <section className="baybay-turn" key={turn.id} data-turn-id={turn.id} aria-label={`问题：${turn.question}`}>
              <div className="baybay-user-question"><span>你</span><p translate="no">{turn.question}</p></div>
              {turn.state === 'pending' && <p role="status" className="baybay-thinking" translate="no"><Loader2 size={15} className="animate-spin" />{turn.progress ? <span>{({ site: copy('站内资料', 'Site information'), research: copy('问题分析与检索', 'Analysis and research'), sources: copy('来源阅读', 'Source review'), routes: copy('路线估算', 'Route estimates'), answer: copy('答复整理', 'Answer preparation') })[turn.progress.phase]}{turn.progress.status === 'running' ? copy('处理中…', ' in progress…') : copy('阶段结束，正在等待结果…', ' stage ended; waiting for the result…')}</span> : copy('正在等待答复；完成后会显示本次来源。', 'Waiting for the answer; sources will appear when it is ready.')}</p>}
              {turn.state === 'pending' && <BayBayDraftPreview lead={turn.draftLead || ''} legacy={turn.partialAnswer} points={turn.draftPoints || []} cards={turn.quickCards} today={today} onNavigate={navigate} />}
              {(turn.state === 'error' || turn.state === 'cancelled') && <div className="baybay-request-error" data-error-code={turn.errorCode}><p role={turn.state === 'error' ? 'alert' : undefined}>{turn.state === 'cancelled' ? '已停止。问题保留在这里，随时可以重试。' : turn.error}</p>{turn.errorCode && BAYBAY_QUOTA_ERRORS[turn.errorCode]?.daily
                // Today's AI answers are used up: a retry cannot work until tomorrow, the site's own pages still do.
                ? <p className="bb-error-links" translate="no"><button type="button" onClick={() => navigate('/events')}>{copy('看本周末活动', 'This weekend’s events')}</button><button type="button" onClick={() => navigate('/guides')}>{copy('查办事指南', 'Browse guides')}</button></p>
                : turn.restartRequired ?<button type="button" disabled={loading} onClick={() => { const draft = turn.restartAssistant ? (bayBayTaskBrief(turns) || turn.question).slice(0, 500) : copy('我想找搭子一起去。', 'I want to find people to go with.'); stop(); updateTurns(() => []); setQuestion(draft); inputRef.current?.focus(); }} translate="no"><RotateCcw size={13}/>{turn.restartAssistant ? copy('重新开始对话', 'Start a new conversation') : copy('重新开始查找', 'Start a new search')}</button> : <button type="button" disabled={loading} onClick={() => askBayBay(turn.question, turn.currentPath)}><RotateCcw size={13} />重试这个问题</button>}</div>}
              {turn.response && <BayBayTurnAnswer turn={turn} today={today} guest={!ownerId} ownerId={ownerId} sessionKey={sessionKey} loading={loading} lastCompleteId={lastComplete?.id}
                isLatest={turn.id === turns[turns.length - 1]?.id} fullNotice={turn.id === fullNotice.pause || turn.id === fullNotice.reduced} question={question} schoolContext={schoolContext} blockedUserIds={blockedUserIds} composing={composing}
                onAsk={askBayBay} onNavigate={navigate} onAction={action => handleAction(action, turn.question)} />}
            </section>)}
          </div></BayBaySaveScope>
          {lastComplete?.response?.taskState && !schoolContext && !outingContext && <BayBayRequirements key={`requirements:${lastComplete.id}`} state={lastComplete.response.taskState} disabled={loading} onAsk={message => askBayBay(message, followupPath, true)} />}
          {lastComplete && planHandoffContext && !loading && !schoolContext && !outingContext && !lastComplete.response?.assistantPlan && <BayBayTaskHandoff key={lastComplete.id} brief={bayBayTaskBrief(turns)} ownerId={ownerId} onNavigate={navigate} />}
          {lastComplete && !loading && !emergencyLast && !lastComplete.response?.assistantPlan && !turns[turns.length - 1]?.restartRequired && (!hasUnconfirmedFoodEvidence(lastComplete.response) || !!lastComplete.response?.followups?.length) && (outingContext ? <p className="baybay-composer-note" translate="no">{copy('可以继续告诉我城市、日期或想做的事；我会保留你已经说过的条件。这里只帮你查找，不会自动申请或发布。', 'Tell me a city, date or activity to refine your search. I will keep the details you already shared. Searching does not apply to or publish an outing.')}</p> : <div className="baybay-followups"><span>接着聊</span>{bayBayFollowups(lastComplete.question, !!currentBayBayGuide(followupPath), isBayBaySchoolGuide(currentBayBayGuide(followupPath)), lastComplete.response?.followups).slice(0, 2).map((followup) => <button type="button" key={followup} onClick={() => askBayBay(translateText(followup, locale), followupPath)}>{followup}<ArrowUp size={12} /></button>)}</div>)}
        </div>
        <form className="baybay-composer-footer" onSubmit={(event) => { event.preventDefault(); if (!composing.current) askBayBay(question); }}>
          <div className="baybay-search-modes" role="group" aria-label={copy('检索范围', 'Search scope')} translate="no">{memberWebAccess ? <>{([['smart', '智能检索', 'Smart'], ['web', '联网查', 'Web'], ['site', '仅站内', 'Site only']] as const).map(([mode, zh, en]) => <button type="button" key={mode} aria-pressed={effectiveSearchMode === mode} disabled={loading} onClick={() => setSearchMode(mode)}>{copy(zh, en)}</button>)}</> : <><strong className="baybay-access-label">{ownerId ? copy('登录需更新 · 仅站内', 'Sign-in needs updating · Site only') : copy('访客 · 仅站内', 'Guest · Site only')}</strong>{onLoginNeeded && <button type="button" onClick={signIn}>{copy('登录 / 注册，开启联网', 'Sign in / Register for web access')}</button>}</>}</div>
          {pageRef && pageTitle && !pageOff && <div className="bb-capsule"><span className="bb-capsule__text">{copy('正在看：', 'Viewing: ')}<strong>{pageTitle}</strong></span>
            <button type="button" onClick={() => setPageOffPath(currentPath)} aria-label={copy('不再参考这一页', 'Stop using this page')}><X aria-hidden="true" size={18} /></button></div>}
          {/* A box that grows to four lines and always shows its whole example (READ-10, G79). Enter asks; Shift+Enter starts a new line. */}
          <div className="member-baybay-composer"><textarea ref={inputRef} rows={1} aria-label="向 BayBay 提问" value={question} maxLength={500}
            aria-describedby={schoolContext ? 'baybay-school-privacy' : undefined}
            onChange={(event) => setQuestion(event.target.value)} onCompositionStart={() => { composing.current = true; }} onCompositionEnd={() => { composing.current = false; }}
            onKeyDown={(event) => {
              if (event.key !== 'Enter' || event.shiftKey) return;
              // Enter inside an input method confirms the candidate; it is neither a question nor a new line.
              if (composing.current || event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229) return;
              event.preventDefault();
              askBayBay(question);
            }} placeholder={placeholder} className="member-baybay-question-input" />
            {loading ? <button type="button" onClick={stop} className="member-baybay-ask"><Square size={13} />停止</button> : <button type="submit" disabled={question.trim().length < 2} className="member-baybay-ask"><span>问一下</span><ArrowUp size={15} /></button>}
          </div>
        </form>
      </div>
    </ModalShell>}
  </>;
};

type TurnAnswerProps = {
  turn: BayBayTurn; today: string; guest: boolean; ownerId?: string; sessionKey?: string; loading: boolean; lastCompleteId?: number; isLatest: boolean; fullNotice: boolean; question: string; schoolContext: boolean;
  blockedUserIds?: string[]; composing: React.MutableRefObject<boolean>;
  onAsk: (text: string, requestPath?: string, keepConversation?: boolean) => boolean; onNavigate: (path: string) => void; onAction: (action: GuideChatAction) => void;
};

/**
 * One answer (1007 §6.5): the 911 card first; then the pause / reduced notice; then lead → image cards → points (v2) or
 * the legacy text with its cards (v1); the professional resource card; the existing plan, outing, post and source blocks.
 */
function BayBayTurnAnswer({ turn, today, guest, ownerId, sessionKey, loading, lastCompleteId, isLatest, fullNotice, question, schoolContext, blockedUserIds, composing, onAsk, onNavigate, onAction }: TurnAnswerProps) {
  const locale = useLocale();
  const copy = (zh: string, en: string) => locale === 'en' ? en : translateText(zh, locale);
  const response = turn.response!;
  const foodGap = hasUnconfirmedFoodEvidence(response);
  const safety = response.safety;
  const cards = foodGap ? [] : response.localMatches || turn.quickCards || [];
  const sources = bayBayAssistantResult(response)?.sources || [];
  const v2 = !!response.lead && !!response.points && response.outingSearch === undefined;
  if (safety?.kind === 'emergency') return <div className="member-baybay-answer" data-safety="emergency"><BayBayEmergencyCard safety={safety} answer={response.answer} /></div>;
  return <div className="member-baybay-answer" data-safety={safety?.kind}>
    {response.notice && <BayBayNoticeBanner kind={response.notice.kind} text={response.notice.text} resumesAt={response.notice.resumesAt} actions={response.fallbackHelp?.actions} compact={!fullNotice} />}
    <div className="member-baybay-answer-label" translate={foodGap ? 'no' : undefined}><Sparkles size={12} />{foodGap ? locale === 'zh-Hant' ? '餐飲資訊待確認' : copy('餐饮信息待确认', 'Food information unconfirmed') : response.outingSearch ? copy('小队搜索', 'Outing search') : response.degraded ? '参考指引' : 'BayBay 建议'}</div>
    {response.degraded && !response.notice && <p role="status" className="baybay-degraded" translate="no">{copy('本次未能形成完整答复，以下保留已取得的资料与待确认项。请核对来源后再行动。', 'This response is incomplete. Available information and unconfirmed items are retained below. Check the sources before acting.')}</p>}
    {v2 ? <BayBayAnswerBody fields={response} cards={cards} sources={sources} today={today} onNavigate={onNavigate} /> : <>
      {response.outingSearch?.state !== 'needs_clarification' && <BayBayAnswer response={response} onNavigate={onNavigate} />}
      <BayBayCardRail cards={cards} sources={sources} today={today} onNavigate={onNavigate} />
    </>}
    {response.fallbackHelp && !response.notice && <BayBayCallActions actions={response.fallbackHelp.actions} />}
    {safety?.kind === 'professional' && <BayBayResourceCard safety={safety} onNavigate={onNavigate} />}
    <BayBayCoverageSummary response={response} />
    {response.assistantPlan && <BayBayAssistantPlanCard plan={response.assistantPlan} taskState={response.taskState} ownerId={ownerId} evidence={response.evidence || []} disabled={loading || turn.id !== lastCompleteId} onAsk={message => onAsk(message, turn.currentPath, true)} onNavigate={onNavigate} />}
    {response.outingSearch && <BayBayOutingResults search={response.outingSearch} answer={response.answer} blockedUserIds={blockedUserIds} onNavigate={onNavigate}
      onAnswer={isLatest && !loading && !question.trim() && !schoolContext ? answer => { if (!composing.current) onAsk(answer, turn.currentPath, true); } : undefined}/>}
    <BayBayMatchingPosts posts={response.matchingPosts || []} note={response.responseMode === 'catalog' || ['completed', 'unavailable', 'verification_failed'].includes(response.retrieval?.webStatus || '') ? undefined : response.matchNote} onNavigate={onNavigate} />
    {response.interactiveCards?.map((card) => <BayBaySmartCard key={card.id} card={card} onAction={onAction} />)}
    <BayBayDiscoveryResults response={response} ownerId={ownerId} sessionKey={sessionKey} />
    {/* One sources block after the answer (BBL-14): how it was found, the cited sources and the related guides. */}
    <BayBaySources response={response} guest={guest} currentPath={turn.currentPath} onNavigate={onNavigate} />
    <BayBayFeedback turnId={turn.id} />
    {!!response.suggestedActions?.length && <div className="mt-2.5 flex flex-wrap gap-1.5">{response.suggestedActions.map((action, index) => <button type="button" key={`${action.label}-${index}`} onClick={() => onAction(action)} className="member-baybay-action border border-baylink-border/50 bg-white text-baylink-text">{action.label}</button>)}</div>}
    {response.safetyNote && <p className="mt-2.5 text-[0.8125rem] leading-relaxed text-baylink-muted">{response.safetyNote}</p>}
  </div>;
}

function BayBayFeedback({ turnId }: { turnId: number }) {
  const [vote,setVote] = useState<'helpful' | 'unhelpful' | null>(null);
  const english = useLocale() === 'en';
  return <div className="baybay-feedback" aria-label={english ? 'Was this useful?' : '这次回答有帮助吗？'} data-feedback-turn={turnId}><span>{vote ? english ? 'Thanks for your feedback' : '已记录，谢谢反馈' : english ? 'Was this useful?' : '有帮助吗？'}</span><button type="button" aria-pressed={vote==='helpful'} disabled={!!vote} onClick={()=>{setVote('helpful');recordProductEvent('baybay_helpful');}}><ThumbsUp size={18} />{english?'Useful':'有帮助'}</button><button type="button" aria-pressed={vote==='unhelpful'} disabled={!!vote} onClick={()=>{setVote('unhelpful');recordProductEvent('baybay_unhelpful');}}><ThumbsDown size={18} />{english?'Not yet':'没解决'}</button>{vote==='unhelpful'&&<BayBayDownvoteReasons />}</div>;
}
