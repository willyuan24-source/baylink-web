import { useState, useCallback, useEffect, useRef } from 'react';
import { ChevronRight, X, Sparkles, Loader2, BookOpen, ArrowUp, Square, RotateCcw, Plus, CalendarDays, ImagePlus, MapPin, MessageCircle, GraduationCap, Users } from 'lucide-react';
import { BRAND } from '../brandAssets';
import { getCategoryFromSlug } from '../routing';
import { BayBaySmartCard } from './BayBaySmartCard';
import { ModalShell } from './ui/Modal';
import { BayBayMatchingPosts } from './BayBayMatchingPosts';
import {
  bayBayFollowups, bayBayErrorMessage, bayBayPlanPath, isBayBayPlanRequest, conversationHistory, currentBayBayGuide, fetchBayBayReply, safeBayBayPath,
  bayBayPageQuestions, bayBayReferenceGuides, bayBayGuideSources, isBayBaySchoolGuide, isBayBaySchoolRequest, BAYBAY_SCHOOL_NOTE, BAYBAY_SCHOOL_STARTER,
  type BayBayTurn, type GuideChatAction, type GuideChatResponse,
} from '../lib/baybay-conversation';
import { translateText, useLocale } from '../i18n/locale';

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
  const locale = useLocale();
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
  const pendingContext = useRef<{ key: string | number; path: string } | null>(null);
  const composing = useRef(false);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const loading = turns.some((turn) => turn.state === 'pending');
  const currentGuide = currentBayBayGuide(currentPath);
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
  const close = useCallback(() => { stop(); setOpen(false); }, [stop, setOpen]);
  useEffect(() => { if (!open) stop(); }, [open, stop]);
  useEffect(() => () => { activeRequest.current?.controller.abort(); activeRequest.current = null; }, []);
  useEffect(() => { if (open && turns.length) endRef.current?.scrollIntoView?.({ block: 'nearest' }); }, [open, turns]);

  const askBayBay = useCallback((text: string, requestPath = currentPath): boolean => {
    const message = text.trim();
    if (message.length < 2 || message.length > 500 || activeRequest.current) return false;
    if (!turnsRef.current.length && !currentBayBayGuide(requestPath) && isBayBayPlanRequest(message)) {
      setQuestion('');
      onNavigate(bayBayPlanPath(message));
      setOpen(false);
      return true;
    }
    const id = ++sequence.current;
    const controller = new AbortController();
    const history = conversationHistory(turnsRef.current);
    activeRequest.current = { id, controller };
    updateTurns((previous) => [...previous, { id, question: message, state: 'pending', currentPath: requestPath }]);
    setQuestion('');
    void fetchBayBayReply(message, { currentPath: requestPath, ...(categoryHint ? { categoryHint } : {}) }, history, controller.signal)
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
  }, [categoryHint, currentPath, onNavigate, setOpen, updateTurns]);

  useEffect(() => {
    if (!pendingQuestion) { consumedPending.current = null; pendingContext.current = null; return; }
    const key = pendingQuestionId ?? pendingQuestion;
    if (pendingContext.current?.key !== key) pendingContext.current = { key, path: currentPath };
    if (!open || loading || consumedPending.current === key) return;
    if (pendingQuestion.trim().length < 2 || pendingQuestion.trim().length > 500) {
      setQuestion(pendingQuestion.slice(0, 500));
      consumedPending.current = key;
      onPendingQuestionConsumed?.(pendingQuestionId);
      return;
    }
    if (askBayBay(pendingQuestion, pendingContext.current.path)) {
      consumedPending.current = key;
      onPendingQuestionConsumed?.(pendingQuestionId);
    }
  }, [open, loading, currentPath, pendingQuestion, pendingQuestionId, askBayBay, onPendingQuestionConsumed]);

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
  const followupPath = lastComplete?.currentPath || currentPath;
  const schoolContext = isBayBaySchoolGuide(currentGuide) || isBayBaySchoolGuide(currentBayBayGuide(followupPath)) || isBayBaySchoolRequest(question) || isBayBaySchoolRequest(turns[turns.length - 1]?.question || '');

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
    {open && <ModalShell onClose={close} labelledBy="baybay-panel-title" className="member-baybay-overlay">
      <div className="member-baybay-dialog baybay-conversation" onClick={(event) => event.stopPropagation()}>
        <div className="member-baybay-header">
          <div className="flex min-w-0 gap-3"><img src={BRAND.baybayAvatar} alt="" className="member-baybay-avatar" width={48} height={48} />
            <div className="min-w-0"><span className="member-compose-eyebrow">YOUR BAY AREA, A LITTLE EASIER</span>
              <h2 id="baybay-panel-title"><Sparkles size={15} /><span>BayBay AI 湾区生活助手</span></h2>
              <p>BAYLINK 的 AI 助手，陪你安排湾区生活。</p></div></div>
          <button type="button" onClick={close} className="member-compose-close" aria-label="关闭"><X size={20} /></button>
        </div>
        <div className="member-baybay-body baybay-scroll">
          <div className="baybay-context-line"><span>站内资料参考 · 不实时联网</span>{turns.length > 0 && <button type="button" onClick={() => { stop(); updateTurns(() => []); setQuestion(''); }}><Plus size={13} />新对话</button>}</div>
          {currentGuide && <div className="baybay-reading-context"><BookOpen size={16} /><div><small>正在结合你阅读的攻略</small><strong>{currentGuide.title}</strong></div>
            <button type="button" disabled={loading} onClick={() => askBayBay(translateText(bayBayPageQuestions(currentPath)[0].question, locale))}>帮我读</button></div>}
          {currentGuide && <div className="baybay-followups" role="group" aria-label="围绕这篇指南提问"><span>围绕这篇指南提问</span>{bayBayPageQuestions(currentPath).map(prompt => <button type="button" key={prompt.label} disabled={loading} onClick={() => askBayBay(translateText(prompt.question, locale))}>{prompt.label}<ArrowUp size={12} /></button>)}</div>}
          {turns.length === 0 && <section className="baybay-welcome"><h3>今天，想让生活轻松一点？</h3><p>选一件想做的事，或直接在下方告诉我。</p>
            <div className="baybay-action-grid">
              <button type="button" onClick={() => navigate('/together')}><span className="baybay-action-icon"><Users size={20} /></span><span><strong>{locale === 'en' ? 'Find a small group' : locale === 'zh-Hant' ? '找搭子一起去' : '找搭子一起去'}</strong><small>{locale === 'en' ? 'Choose a day or draft a plan with BayBay' : locale === 'zh-Hant' ? '選日期，讓 BayBay 幫你整理邀約' : '选日期，让 BayBay 帮你整理邀约'}</small></span><ChevronRight size={15} /></button>
              <button type="button" onClick={() => navigate(question.trim().length >= 2 ? bayBayPlanPath(question) : '/plan')}><span className="baybay-action-icon"><CalendarDays size={20} /></span><span><strong>安排周末</strong><small>说出城市、同行人和预算</small></span><ChevronRight size={15} /></button>
              <button type="button" onClick={() => navigate('/plan?import=event')}><span className="baybay-action-icon"><ImagePlus size={20} /></span><span><strong>读活动截图</strong><small>把海报整理成日历活动</small></span><ChevronRight size={15} /></button>
              <button type="button" onClick={() => { setQuestion(translateText('我想找本地服务：', locale)); inputRef.current?.focus(); }}><span className="baybay-action-icon"><MapPin size={20} /></span><span><strong>找本地服务</strong><small>从需求开始，查找站内信息</small></span><ChevronRight size={15} /></button>
              <button type="button" onClick={() => navigate('/tools?tool=communication')}><span className="baybay-action-icon"><MessageCircle size={20} /></span><span><strong>沟通帮手</strong><small>把想说的话写成中英文</small></span><ChevronRight size={15} /></button>
              <button type="button" className="col-span-2" onClick={() => { setQuestion(translateText(BAYBAY_SCHOOL_STARTER, locale)); inputRef.current?.focus(); }}><span className="baybay-action-icon"><GraduationCap size={20} /></span><span><strong>学校与入学</strong><small>地区、年级与官方核验入口</small></span><ChevronRight size={15} /></button>
            </div>
            <div className="baybay-action-example"><span>试着这样说</span><button type="button" onClick={() => { setQuestion(translateText(example, locale)); inputRef.current?.focus(); }}>{example}</button></div>
          </section>}
          <div className="baybay-thread" aria-label="本次对话">
            {turns.map((turn) => <section className="baybay-turn" key={turn.id} aria-label={`问题：${turn.question}`}>
              <div className="baybay-user-question"><span>你</span><p>{turn.question}</p></div>
              {turn.state === 'pending' && <p role="status" className="baybay-thinking"><Loader2 size={15} className="animate-spin" />正在整理站内资料和你的需求…</p>}
              {(turn.state === 'error' || turn.state === 'cancelled') && <div className="baybay-request-error"><p role={turn.state === 'error' ? 'alert' : undefined}>{turn.state === 'cancelled' ? '已停止。问题保留在这里，随时可以重试。' : turn.error}</p><button type="button" disabled={loading} onClick={() => askBayBay(turn.question, turn.currentPath)}><RotateCcw size={13} />重试这个问题</button></div>}
              {turn.response && <div className="member-baybay-answer">
                <div className="member-baybay-answer-label"><Sparkles size={12} />{turn.response.degraded ? '参考指引' : 'BayBay 建议'}</div>
                {turn.response.degraded && <p role="status" className="baybay-degraded">AI 服务暂时不可用，以下是站内资料与预设参考指引。站内帖子以实际查询结果为准。</p>}
                <p className="member-baybay-answer-text">{turn.response.answer}</p>
                <BayBayMatchingPosts posts={turn.response.matchingPosts || []} note={turn.response.matchNote} onNavigate={navigate} />
                {!isBayBaySchoolRequest(turn.question) && !isBayBaySchoolGuide(currentBayBayGuide(turn.currentPath || '')) && /周末|出游|活动|去哪|weekend|outing|events?/i.test(turn.question) && <button type="button" className="member-primary" onClick={() => navigate(bayBayPlanPath(turn.question))}>让 BayBay 帮我排一天<ChevronRight size={14} /></button>}
                {turn.response.interactiveCards?.map((card) => <BayBaySmartCard key={card.id} card={card} onAction={(action) => handleAction(action, turn.question)} />)}
                <BayBayReferences response={turn.response} currentPath={turn.currentPath} onNavigate={navigate} />
                {!!turn.response.suggestedActions?.length && <div className="mt-2.5 flex flex-wrap gap-1.5">{turn.response.suggestedActions.map((action, index) => <button type="button" key={`${action.label}-${index}`} onClick={() => handleAction(action, turn.question)} className="member-baybay-action border border-baylink-border/50 bg-white text-baylink-text">{action.label}</button>)}</div>}
                {turn.response.safetyNote && <p className="mt-2.5 text-[11px] leading-relaxed text-baylink-muted">{turn.response.safetyNote}</p>}
              </div>}
            </section>)}
          </div>
          {lastComplete && !loading && <div className="baybay-followups"><span>接着聊</span>{bayBayFollowups(lastComplete.question, !!currentBayBayGuide(followupPath), isBayBaySchoolGuide(currentBayBayGuide(followupPath))).map((followup) => <button type="button" key={followup} onClick={() => askBayBay(translateText(followup, locale), followupPath)}>{followup}<ArrowUp size={12} /></button>)}</div>}
          <div ref={endRef} />
          {turns.length === 0 && <div className="baybay-start-links"><button type="button" onClick={() => navigate('/guides')}><BookOpen size={14} />自己浏览攻略</button><button type="button" onClick={() => navigate('/tools')}>打开生活工具箱<ChevronRight size={14} /></button></div>}
        </div>
        <form className="baybay-composer-footer" onSubmit={(event) => { event.preventDefault(); if (!composing.current) askBayBay(question); }}>
          {schoolContext && <p className="baybay-composer-note" id="baybay-school-privacy">{BAYBAY_SCHOOL_NOTE}</p>}
          <div className="member-baybay-composer"><input ref={inputRef} type="text" aria-label="向 BayBay 提问" value={question} maxLength={500}
            aria-describedby={schoolContext ? 'baybay-school-privacy' : undefined}
            onChange={(event) => setQuestion(event.target.value)} onCompositionStart={() => { composing.current = true; }} onCompositionEnd={() => { composing.current = false; }}
            onKeyDown={(event) => {
              if (event.key !== 'Enter') return;
              event.preventDefault();
              if (!composing.current && !event.nativeEvent.isComposing && event.nativeEvent.keyCode !== 229) askBayBay(question);
            }} placeholder={schoolContext ? '例如：东湾 Fremont，准备入读三年级' : turns.length ? '继续补充城市、预算或你的想法…' : '例如：周末带 6 岁孩子，东湾有什么免费去处？'} className="member-baybay-question-input" />
            {loading ? <button type="button" onClick={stop} className="member-baybay-ask"><Square size={13} />停止</button> : <button type="submit" disabled={question.trim().length < 2} className="member-baybay-ask"><span>问一下</span><ArrowUp size={15} /></button>}
          </div><p className="baybay-composer-note">对话仅保留在当前浏览器标签页，刷新即清除；最近 4 轮用于追问。日期、名额与价格请到官方来源确认。</p>
        </form>
      </div>
    </ModalShell>}
  </>;
};

function BayBayReferences({ response, currentPath, onNavigate }: { response: GuideChatResponse; currentPath?: string; onNavigate: (path: string) => void }) {
  const reading = currentBayBayGuide(currentPath || '');
  const references = bayBayReferenceGuides(response);
  const items = reading ? [reading, ...references.filter(guide => guide.slug !== reading.slug)] : references;
  if (!items.length) return null;
  return <div className="baybay-references"><p>原文与核验来源</p><small className="block text-[11px] leading-relaxed text-baylink-muted">以下是站内指南列出的参考资料，不表示已实时核验。</small>{items.map(guide => <div key={guide.slug} className="mt-2">
    {guide.slug === reading?.slug && <small className="text-[11px] text-baylink-muted">提问时阅读的指南</small>}
    <button type="button" onClick={() => onNavigate(`/guides/${guide.slug}`)}><BookOpen size={13} /><span>{guide.title}</span><ChevronRight size={13} /></button>
    {bayBayGuideSources(guide).length > 0 && <details><summary className="cursor-pointer text-[11px] text-baylink-muted">查看原文来源</summary><ul className="mt-2 space-y-2 pl-4 text-[11px] leading-relaxed">{bayBayGuideSources(guide).map(source => <li key={source.url}><a className="break-words underline underline-offset-2" href={source.url} target="_blank" rel="noopener noreferrer">{source.title}</a></li>)}</ul></details>}
  </div>)}</div>;
}
