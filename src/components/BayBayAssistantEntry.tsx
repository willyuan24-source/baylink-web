import { useState, useCallback } from 'react';
import { ChevronRight, X, Sparkles, Loader2, BookOpen } from 'lucide-react';
import { BRAND } from '../brandAssets';
import { getCategoryFromSlug } from '../routing';
import { BayBaySmartCard, type BayBayInteractiveCard } from './BayBaySmartCard';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://baylink-api.onrender.com/api';

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
  error?: string;
};

type CreatePostOptions = {
  postType?: 'client' | 'provider';
  category?: string;
};

type BayBayAssistantEntryProps = {
  variant: 'sidebar' | 'inline';
  onNavigate: (path: string) => void;
  onCreatePostClick: (opts?: CreatePostOptions) => void;
  categoryHint?: string;
};

type ShortcutItem = {
  title: string;
  description: string;
  run: () => void;
};

const RECOMMENDED_QUESTIONS = [
  '刚来湾区租房要注意什么？',
  '怎么找靠谱室友？',
  '二手交易怎么避免被骗？',
  '搬家前要准备什么？',
];

const resolveCategoryLabel = (cat?: string): string | undefined => {
  if (!cat) return undefined;
  const fromSlug = getCategoryFromSlug(cat);
  if (fromSlug !== '全部') return fromSlug;
  return cat;
};

const fetchGuideChat = async (message: string, categoryHint?: string): Promise<GuideChatResponse> => {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  try {
    const userStr = localStorage.getItem('currentUser');
    if (userStr) {
      const user = JSON.parse(userStr);
      if (user?.token) headers.Authorization = `Bearer ${user.token}`;
    }
  } catch { /* ignore */ }

  const res = await fetch(`${API_BASE_URL}/ai/guide-chat`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      message,
      context: {
        currentPath: window.location.pathname,
        ...(categoryHint ? { categoryHint } : {}),
      },
    }),
  });

  let data: GuideChatResponse = { ok: false };
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
}: BayBayAssistantEntryProps) => {
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [chatError, setChatError] = useState(false);
  const [answer, setAnswer] = useState<string | null>(null);
  const [suggestedGuides, setSuggestedGuides] = useState<GuideChatGuide[]>([]);
  const [suggestedActions, setSuggestedActions] = useState<GuideChatAction[]>([]);
  const [safetyNote, setSafetyNote] = useState<string | null>(null);
  const [interactiveCards, setInteractiveCards] = useState<BayBayInteractiveCard[]>([]);

  const close = useCallback(() => setOpen(false), []);

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
    } catch {
      setChatError(true);
    } finally {
      setLoading(false);
    }
  };

  const handleAsk = () => askBayBay(question);

  const handleChip = (q: string) => {
    setQuestion(q);
    askBayBay(q);
  };

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
      });
      close();
    }
  };

  const openPanel = () => {
    setOpen(true);
  };

  return (
    <>
      {variant === 'sidebar' ? (
        <div className="sidebar-panel mb-3 overflow-hidden border border-baylink-green/15 bg-gradient-to-br from-baylink-green/6 via-white to-[#FFF8F0]/80">
          <div className="flex gap-3">
            <img
              src={BRAND.baybayAvatar}
              alt="BayBay"
              className="h-14 w-14 shrink-0 rounded-2xl object-cover ring-2 ring-baylink-green/15"
              width={56}
              height={56}
            />
            <div className="min-w-0 flex-1">
              <h3 className="text-sm font-bold text-baylink-text leading-tight">BayBay 湾区生活助手</h3>
              <p className="mt-1 text-[11px] leading-snug text-baylink-text-secondary">
                找房、找室友、找服务、刚来湾区？我可以带你开始。
              </p>
              <button
                type="button"
                onClick={openPanel}
                className="mt-2.5 w-full rounded-lg bg-baylink-green py-2 text-xs font-bold text-white transition hover:opacity-95 active:scale-[0.98]"
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
          className="mb-2 flex w-full min-h-[68px] max-h-[86px] items-center gap-2.5 rounded-2xl border border-baylink-green/15 bg-gradient-to-r from-baylink-green/8 via-white to-[#FFF8F0]/90 px-3 py-2.5 text-left shadow-card transition active:scale-[0.99] hover:border-baylink-green/25"
        >
          <img
            src={BRAND.baybayAvatar}
            alt="BayBay"
            className="h-11 w-11 shrink-0 rounded-xl object-cover ring-1 ring-baylink-green/20"
            width={44}
            height={44}
          />
          <div className="min-w-0 flex-1">
            <div className="line-clamp-1 text-sm font-bold text-baylink-text">BayBay 帮你找方向</div>
            <div className="line-clamp-1 text-[10px] text-baylink-muted">问租房、找服务、买卖二手、发帖求助</div>
          </div>
          <ChevronRight size={18} className="shrink-0 text-baylink-green/70" />
        </button>
      )}

      {open && (
        <div
          className="fixed inset-0 z-[105] flex items-end justify-center bg-black/40 p-0 backdrop-blur-[2px] lg:items-center lg:p-4"
          onClick={close}
          role="presentation"
        >
          <div
            className="flex w-full max-w-lg flex-col overflow-hidden rounded-t-[24px] bg-baylink-bg-alt shadow-2xl max-h-[78vh] lg:mb-0 lg:max-h-[min(85vh,640px)] lg:rounded-[24px] lg:border lg:border-baylink-border/50"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-labelledby="baybay-panel-title"
          >
            <div className="flex shrink-0 items-start justify-between gap-2 border-b border-baylink-border/40 px-4 py-3 sm:gap-3 sm:py-4 sm:px-5">
              <div className="flex min-w-0 gap-3">
                <img
                  src={BRAND.baybayAvatar}
                  alt=""
                  className="h-10 w-10 shrink-0 rounded-xl object-cover ring-2 ring-baylink-green/15 sm:h-12 sm:w-12 sm:rounded-2xl"
                  width={48}
                  height={48}
                />
                <div className="min-w-0">
                  <h2 id="baybay-panel-title" className="flex items-center gap-1 text-sm font-bold text-baylink-text sm:text-base">
                    <Sparkles size={14} className="text-baylink-green shrink-0 sm:w-[15px] sm:h-[15px]" />
                    <span className="line-clamp-1">BayBay 湾区生活助手</span>
                  </h2>
                  <p className="mt-0.5 text-[11px] leading-snug text-baylink-muted sm:text-xs sm:leading-relaxed">
                    问租房、找服务、买卖二手、发帖求助，我可以帮你整理方向。
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={close}
                className="shrink-0 rounded-full p-2 text-baylink-muted transition hover:bg-baylink-section"
                aria-label="关闭"
              >
                <X size={20} />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-3 pb-4 sm:px-5 baybay-scroll">
              {/* 问问 BayBay */}
              <section className="mb-4 min-w-0">
                <h3 className="text-[13px] font-bold text-baylink-text">问问 BayBay</h3>
                <p className="mt-0.5 text-[10px] text-baylink-muted leading-snug">
                  租房、室友、二手、搬家、清洁、通勤，都可以先问我。
                </p>

                <div className="mt-2.5 flex gap-2">
                  <input
                    type="text"
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAsk()}
                    placeholder="例如：刚来湾区租房要注意什么？"
                    className="min-w-0 flex-1 rounded-xl border border-baylink-green/25 bg-white px-3 py-2.5 text-sm text-baylink-text outline-none placeholder:text-baylink-muted/70 focus:border-baylink-green/45 focus:ring-1 focus:ring-baylink-green/15"
                    disabled={loading}
                  />
                  <button
                    type="button"
                    onClick={handleAsk}
                    disabled={loading || !question.trim()}
                    className="shrink-0 rounded-xl bg-baylink-green px-3.5 py-2.5 text-xs font-bold text-white transition hover:opacity-95 disabled:opacity-50"
                  >
                    {loading ? (
                      <span className="flex items-center gap-1 whitespace-nowrap">
                        <Loader2 size={13} className="animate-spin" />
                        BayBay 正在想...
                      </span>
                    ) : (
                      '问一下'
                    )}
                  </button>
                </div>

                <div className="mt-2 flex flex-wrap gap-1.5">
                  {RECOMMENDED_QUESTIONS.map((q) => (
                    <button
                      key={q}
                      type="button"
                      onClick={() => handleChip(q)}
                      disabled={loading}
                      className="max-w-full rounded-full border border-baylink-border/50 bg-white/80 px-2.5 py-1 text-[10px] text-baylink-text-secondary transition hover:border-baylink-green/30 hover:bg-baylink-green/[0.04] disabled:opacity-50"
                    >
                      <span className="line-clamp-1">{q}</span>
                    </button>
                  ))}
                </div>

                {chatError && (
                  <p className="mt-2.5 rounded-lg bg-amber-50/80 px-3 py-2 text-[11px] text-amber-800/90">
                    BayBay 暂时没连上，可以先看看下面这些入口。
                  </p>
                )}

                {answer && (
                  <div className="mt-3 rounded-xl border border-baylink-green/15 bg-white p-3 shadow-sm">
                    <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-bold text-baylink-green">
                      <Sparkles size={12} />
                      BayBay 建议
                    </div>
                    <p className="whitespace-pre-wrap text-[12px] leading-[1.45] text-baylink-text-secondary">{answer}</p>

                    {interactiveCards.length > 0 && interactiveCards.map((card) => (
                      <BayBaySmartCard key={card.id} card={card} onAction={handleAction} />
                    ))}

                    {suggestedGuides.length > 0 && (
                      <div className="mt-2.5">
                        <p className="mb-1.5 text-[10px] font-semibold text-baylink-muted">相关指南</p>
                        <div className="flex flex-wrap gap-1.5">
                          {suggestedGuides.map((g) => (
                            <button
                              key={g.slug}
                              type="button"
                              onClick={() => { onNavigate(g.url); close(); }}
                              className="inline-flex max-w-full items-center gap-1 rounded-lg border border-baylink-border/40 bg-baylink-section/40 px-2 py-1 text-[10px] font-medium text-baylink-text transition hover:border-baylink-green/30 hover:bg-baylink-green/[0.06]"
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
                            className={`rounded-lg px-2.5 py-1.5 text-[10px] font-semibold transition active:scale-[0.98] ${
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
                      <p className="mt-2.5 text-[10px] leading-relaxed text-baylink-muted/90">{safetyNote}</p>
                    )}
                  </div>
                )}
              </section>

              <div className="mb-2 border-t border-baylink-border/30 pt-3">
                <p className="mb-2 text-[10px] font-semibold text-baylink-muted">快捷入口</p>
                <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2 sm:gap-2">
                  {shortcuts.map((item) => (
                    <button
                      key={item.title}
                      type="button"
                      onClick={() => handleShortcut(item)}
                      className="flex min-h-[56px] w-full min-w-0 cursor-pointer flex-col justify-center rounded-xl border border-baylink-border/50 bg-white px-3 py-2.5 text-left transition hover:border-baylink-green/30 hover:bg-baylink-green/[0.03] active:scale-[0.99] sm:min-h-[68px] sm:p-3"
                    >
                      <span className="text-[13px] font-semibold text-baylink-text sm:text-sm">{item.title}</span>
                      <span className="mt-0.5 line-clamp-2 text-[10px] leading-snug text-baylink-muted sm:text-[11px]">
                        {item.description}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
