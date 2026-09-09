import { useState, useCallback, useEffect } from 'react';
import { ChevronRight, X, Sparkles, Loader2, BookOpen, ArrowUpRight, ArrowUp } from 'lucide-react';
import { BRAND } from '../brandAssets';
import { getCategoryFromSlug } from '../routing';
import { BayBaySmartCard, type BayBayInteractiveCard } from './BayBaySmartCard';
import { ModalShell } from './ui/Modal';
import { API_BASE_URL, authHeaders } from '../lib/api';
import { BayBayMatchingPosts } from './BayBayMatchingPosts';

type GuideChatGuide = {
  title: string;
  slug: string;
  url: string;
};

type GuideChatAction = {
  label: string;
  type: 'category' | 'guide' | 'post' | 'postAssist';
  url?: string;
  postType?: 'client' | 'provider';
  category?: string;
};

type GuideChatResponse = {
  ok: boolean;
  answer?: string;
  suggestedGuides?: GuideChatGuide[];
  suggestedActions?: GuideChatAction[];
  safetyNote?: string;
  interactiveCards?: BayBayInteractiveCard[];
  matchingPosts?: unknown[];
  matchNote?: string;
  degraded?: boolean;
  error?: string;
};

type CreatePostOptions = {
  postType?: 'client' | 'provider';
  category?: string;
  initialIntent?: string;
};

type BayBayAssistantEntryProps = {
  variant: 'sidebar' | 'inline' | 'headless';
  onNavigate: (path: string) => void;
  onCreatePostClick: (opts?: CreatePostOptions) => void;
  categoryHint?: string;
  panelOpen?: boolean;
  onPanelOpenChange?: (open: boolean) => void;
  pendingQuestion?: string | null;
  onPendingQuestionConsumed?: () => void;
};

type ShortcutItem = {
  title: string;
  description: string;
  run: () => void;
};

const resolveCategoryLabel = (cat?: string): string | undefined => {
  if (!cat) return undefined;
  const fromSlug = getCategoryFromSlug(cat);
  if (fromSlug !== '全部') return fromSlug;
  return cat;
};

const fetchGuideChat = async (message: string, categoryHint?: string): Promise<GuideChatResponse> => {
  // 走共享 client 的 base URL / 鉴权头，但保留本面板宽松的错误语义（失败返回 ok:false，不触发全局登出）
  const res = await fetch(`${API_BASE_URL}/ai/guide-chat`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({
      message,
      context: {
        currentPath: window.location.pathname,
        ...(categoryHint ? { categoryHint } : {}),
      },
    }),
  });

  let data: GuideChatResponse;
  try {
    data = await res.json();
  } catch {
    return { ok: false, error: '响应解析失败' };
  }

  if (!res.ok) {
    return { ok: false, error: data.error || '请求失败' };
  }
  return data;
};

export const BayBayAssistantEntry = ({
  variant,
  onNavigate,
  onCreatePostClick,
  categoryHint,
  panelOpen,
  onPanelOpenChange,
  pendingQuestion,
  onPendingQuestionConsumed,
}: BayBayAssistantEntryProps) => {
  const [internalOpen, setInternalOpen] = useState(false);
  const isPanelControlled = onPanelOpenChange != null;
  const open = isPanelControlled ? !!panelOpen : internalOpen;
  const setOpen = useCallback((next: boolean) => {
    if (isPanelControlled) onPanelOpenChange(next);
    else setInternalOpen(next);
  }, [isPanelControlled, onPanelOpenChange]);
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [chatError, setChatError] = useState(false);
  const [answer, setAnswer] = useState<string | null>(null);
  const [suggestedGuides, setSuggestedGuides] = useState<GuideChatGuide[]>([]);
  const [suggestedActions, setSuggestedActions] = useState<GuideChatAction[]>([]);
  const [safetyNote, setSafetyNote] = useState<string | null>(null);
  const [interactiveCards, setInteractiveCards] = useState<BayBayInteractiveCard[]>([]);
  const [answerQuestion, setAnswerQuestion] = useState('');
  const [matchingPosts, setMatchingPosts] = useState<unknown[]>([]);
  const [matchNote, setMatchNote] = useState<string | null>(null);
  const [degraded, setDegraded] = useState(false);

  const close = useCallback(() => setOpen(false), [setOpen]);

  const shortcuts: ShortcutItem[] = [
    {
      title: '刚来湾区',
      description: '落地第一个月先看什么',
      run: () => onNavigate('/guides/bay-area-newcomer-first-month-checklist'),
    },
    {
      title: '我要找房',
      description: '看租房信息和求租',
      run: () => onNavigate('/category/rent'),
    },
    {
      title: '我要找室友',
      description: '合租前先避坑',
      run: () => onNavigate('/guides/bay-area-roommate-guide'),
    },
    {
      title: '我要找本地服务',
      description: '搬家、清洁、维修怎么找',
      run: () => onNavigate('/guides/local-service-safety-guide'),
    },
    {
      title: '我要买卖二手',
      description: '看二手信息和交易提醒',
      run: () => onNavigate('/category/used'),
    },
    {
      title: '我要发帖求助',
      description: '把需求发出来，让本地人看到',
      run: () => onCreatePostClick(),
    },
  ];

  const handleShortcut = (item: ShortcutItem) => {
    item.run();
    close();
  };

  const askBayBay = async (text: string) => {
    const msg = text.trim();
    if (!msg || loading) return;

    setQuestion(msg);
    setLoading(true);
    setChatError(false);
    setAnswer(null);
    setSuggestedGuides([]);
    setSuggestedActions([]);
    setSafetyNote(null);
    setInteractiveCards([]);
    setAnswerQuestion(msg);
    setMatchingPosts([]);
    setMatchNote(null);
    setDegraded(false);

    try {
      const res = await fetchGuideChat(msg, categoryHint);
      if (!res.ok || !res.answer) {
        setChatError(true);
        return;
      }
      setAnswer(res.answer);
      setSuggestedGuides(res.suggestedGuides || []);
      setSuggestedActions(res.suggestedActions || []);
      setSafetyNote(res.safetyNote?.trim() || null);
      setInteractiveCards(Array.isArray(res.interactiveCards) ? res.interactiveCards : []);
      setMatchingPosts(Array.isArray(res.matchingPosts) ? res.matchingPosts : []);
      setMatchNote(typeof res.matchNote === 'string' ? res.matchNote : null);
      setDegraded(res.degraded === true);
    } catch {
      setChatError(true);
    } finally {
      setLoading(false);
    }
  };

  const handleAsk = () => askBayBay(question);


  useEffect(() => {
    if (!open || !pendingQuestion?.trim()) return;
    const q = pendingQuestion.trim();
    setQuestion(q);
    askBayBay(q);
    onPendingQuestionConsumed?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fire once when panel opens with a preset question
  }, [open, pendingQuestion]);

  const handleAction = (action: GuideChatAction) => {
    if (action.type === 'category' || action.type === 'guide') {
      if (action.url) {
        onNavigate(action.url);
        close();
      }
      return;
    }
    if (action.type === 'post' || action.type === 'postAssist') {
      onCreatePostClick({
        postType: action.postType || 'client',
        category: resolveCategoryLabel(action.category),
        initialIntent: answerQuestion,
      });
      close();
    }
  };

  const openPanel = () => {
    setOpen(true);
  };

  return (
    <>
      {variant === 'headless' ? null : variant === 'sidebar' ? (
        <div className="member-baybay-entry member-baybay-entry--sidebar">
          <div className="flex gap-2.5">
            <img
              src={BRAND.baybayAvatar}
              alt="BayBay"
              className="h-12 w-12 shrink-0 rounded-xl object-cover ring-1 ring-baylink-green/15"
              width={48}
              height={48}
            />
            <div className="min-w-0 flex-1">
              <h3 className="sidebar-section-title leading-tight">BayBay 生活助手</h3>
              <p className="mt-1 text-[11px] leading-snug text-baylink-muted">
                一句话帮你整理发帖；找房、找服务、刚来湾区都可以先问我。
              </p>
              <button
                type="button"
                onClick={openPanel}
                className="member-primary mt-3 w-full"
              >
                问问 BayBay
              </button>
            </div>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={openPanel}
          className="member-baybay-entry member-baybay-entry--inline"
        >
          <img
            src={BRAND.baybayAvatar}
            alt="BayBay"
            className="h-9 w-9 shrink-0 rounded-lg object-cover ring-1 ring-baylink-green/15"
            width={36}
            height={36}
          />
          <div className="min-w-0 flex-1">
            <div className="line-clamp-1 text-[12px] font-medium text-baylink-text">问问 BayBay · 湾区生活助手</div>
            <div className="line-clamp-1 text-[11px] text-baylink-muted">一句话帮你整理发帖 · 刚来湾区先问我</div>
          </div>
          <ChevronRight size={16} className="shrink-0 text-baylink-muted/70" />
        </button>
      )}

      {open && (
        // ModalShell 让面板加入弹层栈：叠在帖子详情上时 Esc 关的是面板（而不是底下的详情），Tab 焦点也陷在面板内
        <ModalShell
          onClose={close}
          labelledBy="baybay-panel-title"
          className="member-baybay-overlay"
        >
          <div
            className="member-baybay-dialog"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="member-baybay-header">
              <div className="flex min-w-0 gap-3">
                <img
                  src={BRAND.baybayAvatar}
                  alt=""
                  className="member-baybay-avatar"
                  width={48}
                  height={48}
                />
                <div className="min-w-0">
                  <span className="member-compose-eyebrow">A LITTLE HELP, A LOT CLOSER</span>
                  <h2 id="baybay-panel-title">
                    <Sparkles size={15} className="shrink-0" aria-hidden="true" />
                    <span className="line-clamp-1">BayBay 湾区生活助手</span>
                  </h2>
                  <p>
                    问租房、找服务、买卖二手、发帖求助，我可以帮你整理方向。
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={close}
                className="member-compose-close"
                aria-label="关闭"
              >
                <X size={20} />
              </button>
            </div>

            <div className="member-baybay-body baybay-scroll">
              {/* 问问 BayBay */}
              <section className="member-baybay-question-section">
                <h3>湾区生活，有什么想问的？</h3>
                <p className="member-baybay-intro">
                  租房、室友、二手、搬家、清洁、通勤，都可以先问我。
                </p>

                <div className="member-baybay-composer">
                  <input
                    type="text"
                    aria-label="向 BayBay 提问"
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && !e.nativeEvent.isComposing && e.nativeEvent.keyCode !== 229 && handleAsk()}
                    placeholder="例如：刚来湾区租房要注意什么？"
                    className="member-baybay-question-input"
                    disabled={loading}
                  />
                  <button
                    type="button"
                    onClick={handleAsk}
                    disabled={loading || !question.trim()}
                    className="member-baybay-ask"
                  >
                    {loading ? (
                      <span className="flex items-center gap-1 whitespace-nowrap">
                        <Loader2 size={13} className="animate-spin" />
                        BayBay 正在想...
                      </span>
                    ) : (
                      <><span>问一下</span><ArrowUp size={15} aria-hidden="true" /></>
                    )}
                  </button>
                </div>

                {/* 推荐问题 chips 已撤下：后端目前对这些问题只返回固定兜底回复，
                    等 /ai/guide-chat 升级为真 LLM 后再恢复，并确保它们是展示质量的最佳案例 */}

                {chatError && (
                  <p role="alert" className="member-baybay-error">
                    BayBay 暂时没连上，可以先看看下面这些入口。
                  </p>
                )}

                {answer && (
                  <div className="member-baybay-answer" aria-live="polite">
                    <div className="member-baybay-answer-label">
                      <Sparkles size={12} />
                      {degraded ? '参考指引' : 'BayBay 建议'}
                    </div>
                    {degraded && <p role="status" className="mb-3 rounded-lg border border-baylink-border bg-white p-3 text-xs leading-relaxed text-baylink-text-secondary">AI 服务暂时不可用，以下是预设的参考指引。站内帖子以实际查询结果为准。</p>}
                    <p className="member-baybay-answer-text">{answer}</p>

                    <BayBayMatchingPosts posts={matchingPosts} note={matchNote} onNavigate={(path) => { onNavigate(path); close(); }} />

                    {interactiveCards.length > 0 && interactiveCards.map((card) => (
                      <BayBaySmartCard key={card.id} card={card} onAction={handleAction} />
                    ))}

                    {suggestedGuides.length > 0 && (
                      <div className="mt-2.5">
                        <p className="mb-1.5 text-[11px] font-semibold text-baylink-muted">相关指南</p>
                        <div className="flex flex-wrap gap-1.5">
                          {suggestedGuides.map((g) => (
                            <button
                              key={g.slug}
                              type="button"
                              onClick={() => { onNavigate(g.url); close(); }}
                              className="member-baybay-guide-chip"
                            >
                              <BookOpen size={10} className="shrink-0 text-baylink-green/70" />
                              <span className="truncate">{g.title}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {suggestedActions.length > 0 && (
                      <div className="mt-2.5 flex flex-wrap gap-1.5">
                        {suggestedActions.map((action, i) => (
                          <button
                            key={`${action.label}-${i}`}
                            type="button"
                            onClick={() => handleAction(action)}
                            className={`member-baybay-action ${
                              action.type === 'postAssist'
                                ? 'bg-baylink-green text-white shadow-sm hover:opacity-95'
                                : 'border border-baylink-border/50 bg-white text-baylink-text hover:border-baylink-green/30'
                            }`}
                          >
                            {action.label}
                          </button>
                        ))}
                      </div>
                    )}

                    {safetyNote && (
                      <p className="mt-2.5 text-[11px] leading-relaxed text-baylink-muted">{safetyNote}</p>
                    )}
                  </div>
                )}
              </section>

              <div className="member-baybay-shortcuts">
                <div className="member-baybay-shortcuts-heading"><p>也可以，从这里开始</p><span>快捷入口</span></div>
                <div className="member-baybay-shortcut-grid">
                  {shortcuts.map((item) => (
                    <button
                      key={item.title}
                      type="button"
                      onClick={() => handleShortcut(item)}
                      className="member-baybay-shortcut"
                    >
                      <ArrowUpRight size={14} className="member-baybay-shortcut-arrow" aria-hidden="true" />
                      <span className="text-[13px] font-semibold text-baylink-text sm:text-sm">{item.title}</span>
                      <span className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-baylink-muted sm:text-[11px]">
                        {item.description}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </ModalShell>
      )}
    </>
  );
};
