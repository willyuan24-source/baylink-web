import { useState, useCallback } from 'react';
import { ChevronRight, X, Sparkles } from 'lucide-react';
import { BRAND } from '../brandAssets';

type BayBayAssistantEntryProps = {
  variant: 'sidebar' | 'inline';
  onNavigate: (path: string) => void;
  onCreatePostClick: () => void;
};

type ShortcutItem = {
  title: string;
  description: string;
  run: () => void;
};

export const BayBayAssistantEntry = ({
  variant,
  onNavigate,
  onCreatePostClick,
}: BayBayAssistantEntryProps) => {
  const [open, setOpen] = useState(false);
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
                onClick={() => setOpen(true)}
                className="mt-2.5 w-full rounded-lg bg-baylink-green py-2 text-xs font-bold text-white transition hover:opacity-95 active:scale-[0.98]"
              >
                开始使用
              </button>
            </div>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
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
            <div className="line-clamp-1 text-[10px] text-baylink-muted">找房、服务、二手、发帖求助</div>
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
            className="flex max-h-[min(88vh,640px)] w-full max-w-lg flex-col overflow-hidden rounded-t-[24px] bg-baylink-bg-alt shadow-2xl lg:max-h-[85vh] lg:rounded-[24px] lg:border lg:border-baylink-border/50"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-labelledby="baybay-panel-title"
          >
            <div className="flex items-start justify-between gap-3 border-b border-baylink-border/40 px-4 py-4 sm:px-5">
              <div className="flex min-w-0 gap-3">
                <img
                  src={BRAND.baybayAvatar}
                  alt=""
                  className="h-12 w-12 shrink-0 rounded-2xl object-cover ring-2 ring-baylink-green/15"
                  width={48}
                  height={48}
                />
                <div className="min-w-0">
                  <h2 id="baybay-panel-title" className="flex items-center gap-1 text-base font-bold text-baylink-text">
                    <Sparkles size={15} className="text-baylink-green shrink-0" />
                    BayBay 湾区生活助手
                  </h2>
                  <p className="mt-0.5 text-xs leading-relaxed text-baylink-muted">
                    先选一个场景，我带你去合适的指南、分类或发帖入口。
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

            <div className="flex-1 overflow-y-auto px-4 py-3 pb-[calc(5.5rem+env(safe-area-inset-bottom,0px))] sm:px-5 lg:pb-4">
              <div className="grid gap-2 sm:grid-cols-2">
                {shortcuts.map((item) => (
                  <button
                    key={item.title}
                    type="button"
                    onClick={() => handleShortcut(item)}
                    className="flex min-h-[72px] w-full cursor-pointer flex-col rounded-xl border border-baylink-border/50 bg-white p-3 text-left transition hover:border-baylink-green/30 hover:bg-baylink-green/[0.03] active:scale-[0.99]"
                  >
                    <span className="text-sm font-semibold text-baylink-text">{item.title}</span>
                    <span className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-baylink-muted">
                      {item.description}
                    </span>
                  </button>
                ))}
              </div>
              <p className="mt-3 text-center text-[10px] text-baylink-muted/80">
                导航助手 · 暂不连接 AI 对话
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
