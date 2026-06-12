import { useState } from 'react';
import { Copy, Link2, Share2, X } from 'lucide-react';
import { BRAND } from '../brandAssets';
import {
  canUseNativeShare,
  copyPostShareText,
  copyPostShareUrl,
  sharePost,
  type ShareablePost,
} from '../utils/postShare';

type PostShareSheetProps = {
  post: ShareablePost & { author?: { nickname?: string; avatar?: string }; description?: string; createdAt?: number };
  onClose: () => void;
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
};

const CONTENT_WIDTH = 'mx-auto w-full max-w-[300px]';

const SharePreviewCard = ({ post }: { post: ShareablePost }) => {
  const category = post.category?.trim() || '本地信息';
  const area = post.city?.trim() || '湾区';
  const budget = post.budget?.trim();
  const timeInfo = post.timeInfo?.trim();

  return (
    <div className="w-full rounded-2xl border border-black/[0.06] bg-white p-4 shadow-[0_4px_20px_rgba(23,32,42,0.08)]">
      <span className="inline-flex rounded-full bg-baylink-green/[0.1] px-2.5 py-0.5 text-[10px] font-semibold text-baylink-green">
        {category}
      </span>
      <h4 className="mt-2.5 line-clamp-2 text-left text-[15px] font-semibold leading-snug text-baylink-text">
        {post.title?.trim() || '本地信息'}
      </h4>
      <div className="mt-2.5 space-y-1 text-left">
        <p className="text-[12px] text-baylink-text-secondary">
          <span className="text-baylink-muted">地区</span> · {area}
        </p>
        {budget && (
          <p className="text-[12px] font-medium text-baylink-green">
            <span className="font-normal text-baylink-muted">预算/价格</span> · {budget}
          </p>
        )}
        {timeInfo && (
          <p className="text-[12px] text-baylink-text-secondary">
            <span className="text-baylink-muted">时间</span> · {timeInfo}
          </p>
        )}
      </div>
      <p className="mt-3 border-t border-black/[0.04] pt-2.5 text-center text-[10px] text-baylink-muted">
        来自 BAYLINK｜湾区生活信息站
      </p>
    </div>
  );
};

export const PostShareSheet = ({ post, onClose, showToast }: PostShareSheetProps) => {
  const [busy, setBusy] = useState<'share' | 'text' | 'link' | null>(null);
  const nativeAvailable = canUseNativeShare();

  const handleQuickShare = async () => {
    if (busy) return;
    setBusy('share');
    try {
      const res = await sharePost(post);
      if (res.method === 'clipboard') {
        showToast('已复制分享文案，可以粘贴到微信或短信。', 'success');
      } else if (res.method === 'failed') {
        showToast('暂时无法打开分享，请复制链接后发送。', 'error');
      }
    } finally {
      setBusy(null);
    }
  };

  const handleCopyText = async () => {
    if (busy) return;
    setBusy('text');
    try {
      const ok = await copyPostShareText(post);
      showToast(ok ? '已复制分享文案，可以粘贴到微信或短信。' : '暂时无法打开分享，请复制链接后发送。', ok ? 'success' : 'error');
    } finally {
      setBusy(null);
    }
  };

  const handleCopyLink = async () => {
    if (busy) return;
    setBusy('link');
    try {
      const ok = await copyPostShareUrl(post);
      showToast(ok ? '链接已复制。' : '暂时无法打开分享，请复制链接后发送。', ok ? 'success' : 'error');
    } finally {
      setBusy(null);
    }
  };

  const btnBase =
    'flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold transition active:scale-[0.98] disabled:opacity-60';

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-black/40 backdrop-blur-sm animate-in fade-in md:items-center md:p-6"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-sm overflow-hidden rounded-t-[28px] border border-black/[0.06] bg-[#FFF8F0] shadow-elevated animate-in slide-in-from-bottom-full duration-300 md:rounded-[28px]"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 z-10 rounded-full p-2 text-baylink-muted hover:bg-black/[0.04] md:right-4 md:top-4"
          aria-label="关闭"
        >
          <X size={18} />
        </button>

        <div className="flex justify-center pt-2.5 md:hidden">
          <div className="h-1 w-10 rounded-full bg-black/10" />
        </div>

        <div className={`${CONTENT_WIDTH} px-4 pb-safe-bar pt-4 md:px-5 md:pb-6 md:pt-5`}>
          <div className="mb-5 flex flex-col items-center text-center">
            <div className="mb-4 flex items-center gap-2">
              <img
                src={BRAND.baybayAvatar}
                alt=""
                className="h-7 w-7 rounded-lg object-cover ring-1 ring-baylink-green/15"
                width={28}
                height={28}
              />
              <span className="text-sm font-bold tracking-tight text-baylink-text">BAYLINK</span>
            </div>
            <h3 className="text-base font-semibold text-baylink-text">分享这条帖子</h3>
            <p className="mt-1.5 text-[11px] leading-relaxed text-baylink-muted">
              可以发给微信好友、微信群、短信或其他 App。
            </p>
          </div>

          <SharePreviewCard post={post} />

          <div className="mt-6 flex flex-col gap-2.5">
            <button
              type="button"
              disabled={!!busy}
              onClick={handleQuickShare}
              className={`${btnBase} bg-baylink-green text-white shadow-rest hover:bg-baylink-green-hover`}
            >
              <Share2 size={16} />
              {busy === 'share' ? '处理中…' : nativeAvailable ? '一键分享' : '一键分享（复制文案）'}
            </button>
            <button
              type="button"
              disabled={!!busy}
              onClick={handleCopyText}
              className={`${btnBase} border border-black/[0.08] bg-white text-baylink-text hover:bg-baylink-section/40`}
            >
              <Copy size={16} />
              {busy === 'text' ? '复制中…' : '复制分享文案'}
            </button>
            <button
              type="button"
              disabled={!!busy}
              onClick={handleCopyLink}
              className={`${btnBase} border border-black/[0.08] bg-white text-baylink-text-secondary hover:bg-baylink-section/40`}
            >
              <Link2 size={16} />
              {busy === 'link' ? '复制中…' : '复制链接'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
