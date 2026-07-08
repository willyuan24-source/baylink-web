import { useState, useEffect, useRef } from 'react';
import { BRAND } from '../brandAssets';

type BayBayFloatingLauncherProps = {
  onWriteRent: () => void;
  onLocalHelp: () => void;
  onAskBayBay: () => void;
  onPromoteService: () => void;
  baybayPanelOpen?: boolean;
  /** 帖子详情、发帖、私信、分享等覆盖层打开时隐藏悬浮球，避免遮挡主操作 */
  hidden?: boolean;
};

type ActionRunKey = 'onWriteRent' | 'onLocalHelp' | 'onAskBayBay' | 'onPromoteService';

const QUICK_ACTIONS: { id: string; emoji: string; label: string; runKey: ActionRunKey }[] = [
  { id: 'rent', emoji: '✨', label: '帮我写求租帖', runKey: 'onWriteRent' },
  { id: 'help', emoji: '🆘', label: '发本地求助', runKey: 'onLocalHelp' },
  { id: 'ask', emoji: '💬', label: '问问 BayBay', runKey: 'onAskBayBay' },
  { id: 'promote', emoji: '📣', label: '推广我的服务', runKey: 'onPromoteService' },
];

const ActionButtons = ({
  onAction,
}: {
  onAction: (runKey: ActionRunKey) => void;
}) => (
  <div className="space-y-2">
    {QUICK_ACTIONS.map((action) => (
      <button
        key={action.id}
        type="button"
        onClick={() => onAction(action.runKey)}
        className="flex w-full items-center gap-2 rounded-xl border border-black/[0.04] bg-white px-3 py-2.5 text-left text-[13px] font-medium text-baylink-text transition hover:border-baylink-green/20 hover:bg-baylink-green/[0.04] active:scale-[0.99]"
      >
        <span className="shrink-0 text-base leading-none" aria-hidden>{action.emoji}</span>
        <span>{action.label}</span>
      </button>
    ))}
  </div>
);

const BayBayOrbButton = ({
  expanded,
  onToggle,
  size = 'md',
}: {
  expanded: boolean;
  onToggle: () => void;
  size?: 'md' | 'sm';
}) => {
  const isSm = size === 'sm';
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`relative flex items-center justify-center rounded-full border border-black/[0.04] bg-white shadow-rest transition active:scale-95 ${
        isSm ? 'h-12 w-12 hover:shadow-rest' : 'h-14 w-14 hover:shadow-elevated'
      }`}
      aria-label={expanded ? '关闭 BayBay 快捷菜单' : '打开 BayBay 快捷菜单'}
      aria-expanded={expanded}
    >
      <img
        src={BRAND.baybayAvatar}
        alt="BayBay"
        className={`rounded-full object-cover ${isSm ? 'h-9 w-9' : 'h-11 w-11'}`}
        width={isSm ? 36 : 44}
        height={isSm ? 36 : 44}
      />
    </button>
  );
};

export const BayBayFloatingLauncher = ({
  onWriteRent,
  onLocalHelp,
  onAskBayBay,
  onPromoteService,
  baybayPanelOpen = false,
  hidden = false,
}: BayBayFloatingLauncherProps) => {
  const [desktopExpanded, setDesktopExpanded] = useState(false);
  const [mobileSheetOpen, setMobileSheetOpen] = useState(false);
  const desktopRef = useRef<HTMLDivElement>(null);

  const handlers: Record<ActionRunKey, () => void> = {
    onWriteRent,
    onLocalHelp,
    onAskBayBay,
    onPromoteService,
  };

  useEffect(() => {
    if (baybayPanelOpen || hidden) {
      setDesktopExpanded(false);
      setMobileSheetOpen(false);
    }
  }, [baybayPanelOpen, hidden]);

  useEffect(() => {
    if (!desktopExpanded) return;
    const onPointerDown = (e: MouseEvent | TouchEvent) => {
      if (!desktopRef.current?.contains(e.target as Node)) setDesktopExpanded(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('touchstart', onPointerDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('touchstart', onPointerDown);
    };
  }, [desktopExpanded]);

  useEffect(() => {
    if (!mobileSheetOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mobileSheetOpen]);

  const runDesktopAction = (runKey: ActionRunKey) => {
    setDesktopExpanded(false);
    handlers[runKey]();
  };

  const runMobileAction = (runKey: ActionRunKey) => {
    setMobileSheetOpen(false);
    handlers[runKey]();
  };

  if (hidden) return null;

  return (
    <>
      {/* Desktop: floating card */}
      <div ref={desktopRef} className="fixed bottom-6 right-6 z-[44] hidden lg:block">
        {desktopExpanded && (
          <div
            className="mb-3 w-[280px] rounded-[24px] border border-black/[0.04] bg-white/90 p-4 shadow-elevated backdrop-blur-xl"
            role="dialog"
            aria-label="BayBay 快捷操作"
          >
            <p className="text-[15px] font-semibold leading-snug text-baylink-text">我是 BayBay，需要帮忙吗？</p>
            <div className="mt-3">
              <ActionButtons onAction={runDesktopAction} />
            </div>
          </div>
        )}
        <BayBayOrbButton expanded={desktopExpanded} onToggle={() => setDesktopExpanded((v) => !v)} size="md" />
      </div>

      {/* Mobile: compact orb + bottom action sheet */}
      <div className="lg:hidden">
        <div className="fixed bottom-[88px] right-4 z-[44]">
          <BayBayOrbButton
            expanded={mobileSheetOpen}
            onToggle={() => setMobileSheetOpen((v) => !v)}
            size="sm"
          />
        </div>

        {mobileSheetOpen && (
          <div className="fixed inset-0 z-[43]" role="presentation">
            <button
              type="button"
              className="absolute inset-0 bg-black/40 backdrop-blur-[1px]"
              aria-label="关闭"
              onClick={() => setMobileSheetOpen(false)}
            />
            <div
              className="absolute bottom-0 left-0 right-0 rounded-t-[28px] border-t border-black/[0.06] bg-white/90 px-4 pt-4 pb-safe-bar shadow-elevated backdrop-blur-xl"
              role="dialog"
              aria-label="BayBay 快捷操作"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-baylink-border/80" aria-hidden />
              <p className="text-[15px] font-semibold leading-snug text-baylink-text">我是 BayBay，需要帮忙吗？</p>
              <div className="mt-3 mb-1">
                <ActionButtons onAction={runMobileAction} />
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
};
