import { useState } from 'react';
import { Copy, Link2, Share2 } from 'lucide-react';
import { Sheet } from './ui/Sheet';
import { Button } from './ui/Button';
import { BRAND } from '../brandAssets';
import './site-dialogs.css';
import { getLocale, translateText, useLocale } from '../i18n/locale';
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
    <div className="w-full rounded-2xl border border-black/[0.08] bg-baylink-bg-alt/60 p-4 shadow-[0_4px_20px_rgba(23,32,42,0.08)]">
      <span className="inline-flex rounded-full bg-baylink-green/[0.1] px-2.5 py-0.5 text-[0.8125rem] font-semibold text-baylink-green">
        {category}
      </span>
      <h4 translate="no" className="mt-2.5 line-clamp-2 text-left text-[0.9375rem] font-semibold leading-snug text-baylink-text">
        {post.title?.trim() || translateText('本地信息')}
      </h4>
      <div className="mt-2.5 space-y-1 text-left">
        <p className="text-[0.8125rem] text-baylink-text-secondary">
          <span className="text-baylink-muted">地区</span> · <span translate="no">{post.city?.trim() || translateText(area)}</span>
        </p>
        {budget && (
          <p className="text-[0.8125rem] font-normal text-baylink-green">
            <span className="font-normal text-baylink-muted">预算/价格</span> · <span translate="no">{budget}</span>
          </p>
        )}
        {timeInfo && (
          <p className="text-[0.8125rem] text-baylink-text-secondary">
            <span className="text-baylink-muted">时间</span> · <span translate="no">{timeInfo}</span>
          </p>
        )}
      </div>
      <p className="mt-3 border-t border-black/[0.04] pt-2.5 text-center text-[0.8125rem] text-baylink-muted">
        {translateText(getLocale() === 'en' ? 'From BAYLINK · Where to go and how to get it done in the Bay' : '来自 BAYLINK · 湾区去哪、怎么办')}
      </p>
    </div>
  );
};

export const PostShareSheet = ({ post, onClose, showToast }: PostShareSheetProps) => {
  useLocale();
  const [busy, setBusy] = useState<'share' | 'text' | 'link' | null>(null);
  const [manualCopy, setManualCopy] = useState(false);
  const nativeAvailable = canUseNativeShare();

  const handleQuickShare = async () => {
    if (busy) return;
    setManualCopy(false);
    setBusy('share');
    try {
      const res = await sharePost(post);
      if (res.method === 'clipboard') {
        showToast('已复制分享文案，可以粘贴到微信或短信。', 'success');
      } else if (res.method === 'failed') {
        setManualCopy(true);
        showToast('请手动复制下方链接后发送。', 'info');
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
      setManualCopy(!ok);
      showToast(ok ? '已复制分享文案，可以粘贴到微信或短信。' : '请手动复制下方链接后发送。', ok ? 'success' : 'info');
    } finally {
      setBusy(null);
    }
  };

  const handleCopyLink = async () => {
    if (busy) return;
    setBusy('link');
    try {
      const ok = await copyPostShareUrl(post);
      setManualCopy(!ok);
      showToast(ok ? '链接已复制。' : '请手动复制下方链接后发送。', ok ? 'success' : 'info');
    } finally {
      setBusy(null);
    }
  };

  // RC-24: on the WEB-UI Sheet; one primary action, two secondary.
  return (
    <Sheet open onClose={onClose} title="分享这条帖子">
      <p className="site-dialog-brand"><img src={BRAND.baybayAvatar} alt="" width={32} height={32} />BAYLINK</p>
      <p className="site-dialog-intro">可以发给微信好友、微信群、短信或其他 App。</p>
      <SharePreviewCard post={post} />
      <div className="site-dialog-actions">
        <Button variant="primary" disabled={!!busy} onClick={handleQuickShare} icon={<Share2 size={16} aria-hidden="true" />}>
          {busy === 'share' ? '处理中…' : nativeAvailable ? '一键分享' : '一键分享（复制文案）'}
        </Button>
        <Button variant="secondary" disabled={!!busy} onClick={handleCopyText} icon={<Copy size={16} aria-hidden="true" />}>
          {busy === 'text' ? '复制中…' : '复制分享文案'}
        </Button>
        <Button variant="secondary" disabled={!!busy} onClick={handleCopyLink} icon={<Link2 size={16} aria-hidden="true" />}>
          {busy === 'link' ? '复制中…' : '复制链接'}
        </Button>
      </div>
      {manualCopy && <label className="site-dialog-label">
        <span>手动复制链接</span>
        <input className="site-dialog-field mt-2" readOnly value={buildPostShareUrl(post)} onFocus={event => event.currentTarget.select()} />
      </label>}
    </Sheet>
  );
};
