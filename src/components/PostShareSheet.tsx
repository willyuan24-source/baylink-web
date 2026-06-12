import { useState } from 'react';
import { Copy, Link2, Share2, X } from 'lucide-react';
import { BRAND } from '../brandAssets';
import {
  buildPostShareText,
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

export const PostShareSheet = ({ post, onClose, showToast }: PostShareSheetProps) => {
  const [busy, setBusy] = useState<'share' | 'text' | 'link' | null>(null);
  const preview = buildPostShareText(post).split('\n').slice(0, 6).join('\n');
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

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-black/40 p-0 backdrop-blur-sm animate-in fade-in md:items-center md:p-6"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm overflow-hidden rounded-t-[28px] border border-black/[0.04] bg-baylink-bg-alt/98 shadow-elevated backdrop-blur-xl animate-in slide-in-from-bottom-full duration-300 md:rounded-[28px]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-center pt-2 md:hidden">
          <div className="h-1 w-10 rounded-full bg-black/10" />
        </div>
        <div className="border-b border-black/[0.04] px-5 pb-4 pt-3 md:pt-5">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <img src={BRAND.baybayAvatar} alt="" className="h-7 w-7 rounded-lg object-cover ring-1 ring-baylink-green/15" width={28} height={28} />
              <span className="text-sm font-bold tracking-tight text-baylink-text">BAYLINK</span>
            </div>
            <button type="button" onClick={onClose} className="rounded-full p-2 text-baylink-muted hover:bg-baylink-section/60" aria-label="关闭">
              <X size={18} />
            </button>
          </div>
          <h3 className="text-base font-semibold text-baylink-text">分享这条帖子</h3>
          <p className="mt-1 text-[11px] text-baylink-muted">可以发给微信好友、微信群、短信或其他 App。</p>
        </div>
        <div className="p-5 pb-safe-bar md:pb-5">
          <div className="surface-inset mb-4 max-h-28 overflow-y-auto p-3.5">
            <p className="whitespace-pre-wrap text-[12px] leading-relaxed text-baylink-text-secondary">{preview}…</p>
            <p className="mt-1 truncate text-[10px] text-baylink-muted">{buildPostShareUrl(post)}</p>
          </div>
          <div className="space-y-2">
            <button
              type="button"
              disabled={!!busy}
              onClick={handleQuickShare}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-baylink-green py-3 text-sm font-semibold text-white shadow-rest transition hover:bg-baylink-green-hover active:scale-[0.98] disabled:opacity-60"
            >
              <Share2 size={16} />
              {busy === 'share' ? '处理中…' : nativeAvailable ? '一键分享' : '一键分享（复制文案）'}
            </button>
            <button
              type="button"
              disabled={!!busy}
              onClick={handleCopyText}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-black/[0.06] bg-white py-3 text-sm font-semibold text-baylink-text transition hover:bg-baylink-section/40 active:scale-[0.98] disabled:opacity-60"
            >
              <Copy size={16} />
              {busy === 'text' ? '复制中…' : '复制分享文案'}
            </button>
            <button
              type="button"
              disabled={!!busy}
              onClick={handleCopyLink}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-black/[0.06] bg-white py-3 text-sm font-semibold text-baylink-text-secondary transition hover:bg-baylink-section/40 active:scale-[0.98] disabled:opacity-60"
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
