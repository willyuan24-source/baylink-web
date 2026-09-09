import { useState, useCallback, useEffect, useRef } from 'react';
import { ChevronRight, X, Sparkles, Loader2, BookOpen, ArrowUp, Square, RotateCcw, Plus } from 'lucide-react';
import { BRAND } from '../brandAssets';
import { getCategoryFromSlug } from '../routing';
import { BayBaySmartCard } from './BayBaySmartCard';
import { ModalShell } from './ui/Modal';
import { BayBayMatchingPosts } from './BayBayMatchingPosts';
import {
  BAYBAY_SCENARIOS, bayBayFollowups, bayBayErrorMessage, conversationHistory, currentBayBayGuide, fetchBayBayReply, safeBayBayPath,
  type BayBayTurn, type GuideChatAction,
} from '../lib/baybay-conversation';

type CreatePostOptions = { postType?: 'client' | 'provider'; category?: string; initialIntent?: string };
type BayBayAssistantEntryProps = {
  variant: 'sidebar' | 'inline' | 'headless';
  onNavigate: (path: string) => void;
  onCreatePostClick: (opts?: CreatePostOptions) => void;
  categoryHint?: string;
  currentPath?: string;
  panelOpen?: boolean;
  onPanelOpenChange?: (open: boolean) => void;
  pendingQuestion?: string | null;
  pendingQuestionId?: number;
  onPendingQuestionConsumed?: (id?: number) => void;
};

const resolveCategoryLabel = (category?: string) => {
  if (!category) return undefined;
  const label = getCategoryFromSlug(category);
  return label === '全部' ? category : label;
};

export const BayBayAssistantEntry = ({ variant, onNavigate, onCreatePostClick, categoryHint,
  currentPath = typeof window === 'undefined' ? '/' : window.location.pathname,
  panelOpen, onPanelOpenChange, pendingQuestion, pendingQuestionId, onPendingQuestionConsumed,
}: BayBayAssistantEntryProps) => {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = onPanelOpenChange ? !!panelOpen : internalOpen;
  const setOpen = useCallback((value: boolean) => {
    if (onPanelOpenChange) onPanelOpenChange(value); else setInternalOpen(value);
  }, [onPanelOpenChange]);
  const [question, setQuestion] = useState('');
  const [turns, setTurns] = useState<BayBayTurn[]>([]);
  const turnsRef = useRef<BayBayTurn[]>([]);
  const activeRequest = useRef<{ id: number; controller: AbortController } | null>(null);
  const sequence = useRef(0);
  const consumedPending = useRef<string | number | null>(null);
  const composing = useRef(false);
  const endRef = useRef<HTMLDivElement>(null);
  const loading = turns.some((turn) => turn.state === 'pending');
  const currentGuide = currentBayBayGuide(currentPath);

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
  const close = useCallback(() => { stop(); setOpen(false); }, [stop, setOpen]);
  useEffect(() => { if (!open) stop(); }, [open, stop]);
  useEffect(() => () => { activeRequest.current?.controller.abort(); activeRequest.current = null; }, []);
  useEffect(() => { if (open && turns.length) endRef.current?.scrollIntoView?.({ block: 'nearest' }); }, [open, turns]);

  const askBayBay = useCallback((text: string): boolean => {
    const message = text.trim();
    if (message.length < 2 || message.length > 500 || activeRequest.current) return false;
    const id = ++sequence.current;
    const controller = new AbortController();
    const history = conversationHistory(turnsRef.current);
    activeRequest.current = { id, controller };
    updateTurns((previous) => [...previous, { id, question: message, state: 'pending' }]);
    setQuestion('');
    void fetchBayBayReply(message, { currentPath, ...(categoryHint ? { categoryHint } : {}) }, history, controller.signal)
      .then((response) => {
        if (activeRequest.current?.id !== id) return;
        activeRequest.current = null;
        updateTurns((previous) => previous.map((turn) => turn.id === id ? { ...turn, state: 'complete', response } : turn));
      }).catch((error: unknown) => {
        if (activeRequest.current?.id !== id) return;
        activeRequest.current = null;
        updateTurns((previous) => previous.map((turn) => turn.id === id ? {
          ...turn, state: 'error', error: bayBayErrorMessage(error),
        } : turn));
      });
    return true;
  }, [categoryHint, currentPath, updateTurns]);

  useEffect(() => {
    if (!pendingQuestion) { consumedPending.current = null; return; }
    const key = pendingQuestionId ?? pendingQuestion;
    if (!open || loading || consumedPending.current === key) return;
    if (pendingQuestion.trim().length < 2 || pendingQuestion.trim().length > 500) {
      setQuestion(pendingQuestion.slice(0, 500));
      consumedPending.current = key;
      onPendingQuestionConsumed?.(pendingQuestionId);
      return;
    }
    if (askBayBay(pendingQuestion)) {
      consumedPending.current = key;
      onPendingQuestionConsumed?.(pendingQuestionId);
    }
  }, [open, loading, pendingQuestion, pendingQuestionId, askBayBay, onPendingQuestionConsumed]);

  const navigate = (path: string) => { onNavigate(path); close(); };
  const handleAction = (action: GuideChatAction, intent: string) => {
    if (action.type === 'category' || action.type === 'guide') {
      if (safeBayBayPath(action.url)) navigate(action.url);
    } else if (action.type === 'post' || action.type === 'postAssist') {
      onCreatePostClick({ postType: action.postType || 'client', category: resolveCategoryLabel(action.category), initialIntent: intent });
      close();
    }
  };
  const lastComplete = [...turns].reverse().find((turn) => turn.state === 'complete');

  return <>
    {variant !== 'headless' && (variant === 'sidebar' ? <div className="member-baybay-entry member-baybay-entry--sidebar">
      <div className="flex gap-2.5"><img src={BRAND.baybayAvatar} alt="BayBay" className="h-12 w-12 shrink-0 rounded-xl object-cover" width={48} height={48} />
        <div className="min-w-0 flex-1"><h3 className="sidebar-section-title leading-tight">BayBay 生活助手</h3>
          <p className="mt-1 text-[11px] leading-snug text-baylink-muted">周末去哪、怎么省钱、刚来湾区怎么安排，一起从攻略找到下一步。</p>
          <button type="button" onClick={() => setOpen(true)} className="member-primary mt-3 w-full">问问 BayBay</button></div></div>
    </div> : <button type="button" onClick={() => setOpen(true)} className="member-baybay-entry member-baybay-entry--inline">
      <img src={BRAND.baybayAvatar} alt="BayBay" className="h-9 w-9 shrink-0 rounded-lg object-cover" width={36} height={36} />
      <span className="min-w-0 flex-1"><span className="block text-[12px] font-medium text-baylink-text">问问 BayBay · 湾区生活助手</span><span className="block text-[11px] text-baylink-muted">周末灵感、亲子省钱、生活下一步</span></span><ChevronRight size={16} />
    </button>)}
    {open && <ModalShell onClose={close} labelledBy="baybay-panel-title" className="member-baybay-overlay">
      <div className="member-baybay-dialog baybay-conversation" onClick={(event) => event.stopPropagation()}>
        <div className="member-baybay-header">
          <div className="flex min-w-0 gap-3"><img src={BRAND.baybayAvatar} alt="" className="member-baybay-avatar" width={48} height={48} />
            <div className="min-w-0"><span className="member-compose-eyebrow">YOUR BAY AREA, A LITTLE EASIER</span>
              <h2 id="baybay-panel-title"><Sparkles size={15} /><span>BayBay 湾区生活助手</span></h2>
              <p>结合站内攻略，帮你把灵感变成下一步。</p></div></div>
          <button type="button" onClick={close} className="member-compose-close" aria-label="关闭"><X size={20} /></button>
        </div>
        <div className="member-baybay-body baybay-scroll">
          <div className="baybay-context-line"><span>站内资料参考 · 不实时联网</span>{turns.length > 0 && <button type="button" onClick={() => { stop(); updateTurns(() => []); setQuestion(''); }}><Plus size={13} />新对话</button>}</div>
          {currentGuide && <div className="baybay-reading-context"><BookOpen size={16} /><div><small>正在结合你阅读的攻略</small><strong>{currentGuide.title}</strong></div>
            <button type="button" disabled={loading} onClick={() => askBayBay('根据我正在读的这篇攻略，帮我提炼三个重点，再问我需要补充哪些个人需求。')}>帮我读</button></div>}
          {turns.length === 0 && <section className="baybay-welcome"><h3>想把湾区生活安排得更轻松？</h3><p>先选一个方向，也可以直接说说你的城市、预算和同行人。</p>
            <div className="baybay-scenarios">{BAYBAY_SCENARIOS.map((scenario) => <button type="button" key={scenario.label} onClick={() => askBayBay(scenario.question)}><span aria-hidden="true">{scenario.icon}</span>{scenario.label}<ChevronRight size={14} /></button>)}</div>
          </section>}
          <div className="baybay-thread" aria-label="本次对话">
            {turns.map((turn) => <section className="baybay-turn" key={turn.id} aria-label={`问题：${turn.question}`}>
              <div className="baybay-user-question"><span>你</span><p>{turn.question}</p></div>
              {turn.state === 'pending' && <p role="status" className="baybay-thinking"><Loader2 size={15} className="animate-spin" />正在整理站内资料和你的需求…</p>}
              {(turn.state === 'error' || turn.state === 'cancelled') && <div className="baybay-request-error"><p role={turn.state === 'error' ? 'alert' : undefined}>{turn.state === 'cancelled' ? '已停止。问题保留在这里，随时可以重试。' : turn.error}</p><button type="button" disabled={loading} onClick={() => askBayBay(turn.question)}><RotateCcw size={13} />重试这个问题</button></div>}
              {turn.response && <div className="member-baybay-answer">
                <div className="member-baybay-answer-label"><Sparkles size={12} />{turn.response.degraded ? '参考指引' : 'BayBay 建议'}</div>
                {turn.response.degraded && <p role="status" className="baybay-degraded">AI 服务暂时不可用，以下是站内资料与预设参考指引。站内帖子以实际查询结果为准。</p>}
                <p className="member-baybay-answer-text">{turn.response.answer}</p>
                <BayBayMatchingPosts posts={turn.response.matchingPosts || []} note={turn.response.matchNote} onNavigate={navigate} />
                {turn.response.interactiveCards?.map((card) => <BayBaySmartCard key={card.id} card={card} onAction={(action) => handleAction(action, turn.question)} />)}
                {!!turn.response.suggestedGuides?.length && <div className="baybay-references"><p>可以接着读</p>{turn.response.suggestedGuides.filter((guide) => safeBayBayPath(guide.url)).map((guide) => <button type="button" key={guide.slug} onClick={() => navigate(guide.url)}><BookOpen size={13} /><span>{guide.title}</span><ChevronRight size={13} /></button>)}</div>}
                {!!turn.response.suggestedActions?.length && <div className="mt-2.5 flex flex-wrap gap-1.5">{turn.response.suggestedActions.map((action, index) => <button type="button" key={`${action.label}-${index}`} onClick={() => handleAction(action, turn.question)} className="member-baybay-action border border-baylink-border/50 bg-white text-baylink-text">{action.label}</button>)}</div>}
                {turn.response.safetyNote && <p className="mt-2.5 text-[11px] leading-relaxed text-baylink-muted">{turn.response.safetyNote}</p>}
              </div>}
            </section>)}
          </div>
          {lastComplete && !loading && <div className="baybay-followups"><span>接着聊</span>{bayBayFollowups(lastComplete.question, !!currentGuide).map((followup) => <button type="button" key={followup} onClick={() => askBayBay(followup)}>{followup}<ArrowUp size={12} /></button>)}</div>}
          <div ref={endRef} />
          {turns.length === 0 && <div className="baybay-start-links"><button type="button" onClick={() => navigate('/guides')}><BookOpen size={14} />自己浏览攻略</button><button type="button" onClick={() => navigate('/tools')}>打开生活工具箱<ChevronRight size={14} /></button></div>}
        </div>
        <form className="baybay-composer-footer" onSubmit={(event) => { event.preventDefault(); if (!composing.current) askBayBay(question); }}>
          <div className="member-baybay-composer"><input type="text" aria-label="向 BayBay 提问" value={question} maxLength={500}
            onChange={(event) => setQuestion(event.target.value)} onCompositionStart={() => { composing.current = true; }} onCompositionEnd={() => { composing.current = false; }}
            onKeyDown={(event) => {
              if (event.key !== 'Enter') return;
              event.preventDefault();
              if (!composing.current && !event.nativeEvent.isComposing && event.nativeEvent.keyCode !== 229) askBayBay(question);
            }} placeholder={turns.length ? '继续补充城市、预算或你的想法…' : '例如：周末带 6 岁孩子，东湾有什么免费去处？'} className="member-baybay-question-input" />
            {loading ? <button type="button" onClick={stop} className="member-baybay-ask"><Square size={13} />停止</button> : <button type="submit" disabled={question.trim().length < 2} className="member-baybay-ask"><span>问一下</span><ArrowUp size={15} /></button>}
          </div><p className="baybay-composer-note">对话仅保留在当前浏览器标签页，刷新即清除；最近 4 轮用于追问。日期、名额与价格请到官方来源确认。</p>
        </form>
      </div>
    </ModalShell>}
  </>;
};
