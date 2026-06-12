import { useState } from 'react';
import { Copy, Link2, Share2, X } from 'lucide-react';
import { BRAND } from '../brandAssets';
import {
  buildPostShareUrl,
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

const SharePreviewCard = ({ post }: { post: ShareablePost }) => {
  const category = post.category?.trim() || '本地信息';
  const area = post.city?.trim() || '湾区';
  const budget = post.budget?.trim();
  const timeInfo = post.timeInfo?.trim();

  return (
    <div className="mx-auto w-full max-w-[280px] rounded-2xl border border-black/[0.06] bg-white p-4 shadow-rest">
      <div className="text-left">
        <span className="inline-flex rounded-full bg-baylink-green/[0.1] px-2.5 py-0.5 text-[10px] font-semibold text-baylink-green">
          {category}
        </span>
        <h4 className="mt-2.5 line-clamp-2 text-[15px] font-semibold leading-snug text-baylink-text">
          {post.title?.trim() || '本地信息'}
        </h4>
        <div className="mt-2.5 space-y-1">
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

  const btnBase = 'flex w-full max-w-[280px] items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold transition active:scale-[0.98] disabled:opacity-60';

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-black/40 p-0 backdrop-blur-sm animate-in fade-in md:items-center md:p-6"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm overflow-hidden rounded-t-[28px] border border-black/[0.04] bg-baylink-bg-alt/98 shadow-elevated backdrop-blur-xl animate-in slide-in-from-bottom-full duration-300 md:rounded-[28px]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-center pt-2.5 md:hidden">
          <div className="h-1 w-10 rounded-full bg-black/10" />
        </div>

        <div className="border-b border-black/[0.04] px-6 pb-4 pt-3 md:px-6 md:pt-5">
          <div className="relative mb-4 flex items-center justify-center">
            <div className="flex items-center gap-2">
              <img src={BRAND.baybayAvatar} alt="" className="h-7 w-7 rounded-lg object-cover ring-1 ring-baylink-green/15" width={28} height={28} />
              <span className="text-sm font-bold tracking-tight text-baylink-text">BAYLINK</span>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="absolute right-0 rounded-full p-2 text-baylink-muted hover:bg-baylink-section/60"
              aria-label="关闭"
            >
              <X size={18} />
            </button>
          </div>
          <div className="text-center">
            <h3 className="text-base font-semibold text-baylink-text">分享这条帖子</h3>
            <p className="mx-auto mt-1 max-w-[260px] text-[11px] leading-relaxed text-baylink-muted">
              可以发给微信好友、微信群、短信或其他 App。
            </p>
          </div>
        </div>

        <div className="px-6 pb-safe-bar pt-1 md:pb-6">
          <div className="flex justify-center">
            <SharePreviewCard post={post} />
          </div>

          <div className="mx-auto mt-6 flex w-full max-w-[280px] flex-col gap-2.5">
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
              className={`${btnBase} border border-black/[0.08] bg-white text-baylink-text hover:bg-baylink-section/30`}
            >
              <Copy size={16} />
              {busy === 'text' ? '复制中…' : '复制分享文案'}
            </button>
            <button
              type="button"
              disabled={!!busy}
              onClick={handleCopyLink}
              className={`${btnBase} border border-black/[0.08] bg-white text-baylink-text-secondary hover:bg-baylink-section/30`}
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
