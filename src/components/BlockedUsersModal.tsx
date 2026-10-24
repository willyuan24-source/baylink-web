import React, { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Sheet } from './ui/Sheet';
import { Button } from './ui/Button';
import './site-dialogs.css';
import { useUiCopy } from './ui/ui-copy';
import DefaultAvatar from './Avatar';

export type BlockedUserItem = {
  id: string;
  nickname: string;
  avatar?: string;
  isPhoneVerified?: boolean;
  isOfficialVerified?: boolean;
  blockedAt?: number;
};

type BlockedUsersModalProps = {
  isOpen: boolean;
  onClose: () => void;
  loadBlocks: () => Promise<{ blocks: BlockedUserItem[] }>;
  onUnblock: (userId: string) => Promise<void>;
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  /** The site's Avatar unless a caller passes its own (the dialog imports it, so the shell does not). */
  Avatar?: React.ComponentType<{ src?: string; name?: string; size?: number; className?: string }>;
};

export const BlockedUsersModal = ({
  isOpen,
  onClose,
  loadBlocks,
  onUnblock,
  showToast,
  Avatar = DefaultAvatar,
}: BlockedUsersModalProps) => {
  const [blocks, setBlocks] = useState<BlockedUserItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const { t } = useUiCopy();

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await loadBlocks();
        if (!cancelled) setBlocks(Array.isArray(res.blocks) ? res.blocks : []);
      } catch (e: any) {
        if (!cancelled) showToast(e?.error || '加载屏蔽列表失败', 'error');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [isOpen, loadBlocks, showToast]);

  if (!isOpen) return null;

  const handleUnblock = async (userId: string) => {
    setUpdatingId(userId);
    try {
      await onUnblock(userId);
      setBlocks((prev) => prev.filter((b) => b.id !== userId));
      showToast('已取消屏蔽。', 'success');
    } catch (e: any) {
      showToast(e?.error || '取消屏蔽失败', 'error');
    } finally {
      setUpdatingId(null);
    }
  };

  // RC-24: on the WEB-UI Sheet.
  return (
    <Sheet open onClose={onClose} title="已屏蔽用户">
      {loading ? (
        <div className="site-dialog-empty" role="status" aria-label={t('正在加载', 'Loading')}><Loader2 className="mx-auto h-6 w-6 animate-spin text-[var(--color-brand)]" aria-hidden="true" /></div>
      ) : blocks.length === 0 ? (
        <p className="site-dialog-empty">你还没有屏蔽任何用户</p>
      ) : (
        <ul className="site-dialog-list">
          {blocks.map((b) => (
            <li key={b.id}>
              <Avatar src={b.avatar} name={b.nickname} size={10} className="shrink-0" />
              <span>
                <span className="block truncate font-semibold" translate="no">{b.nickname}</span>
                <span className="site-dialog-note block">
                  {b.isPhoneVerified ? '手机验证：已完成' : '手机验证：未完成'}
                  {b.isOfficialVerified ? ' · 官方认证' : ''}
                  {b.blockedAt ? t(` · 屏蔽于 ${new Date(b.blockedAt).toLocaleDateString()}`, ` · blocked ${new Date(b.blockedAt).toLocaleDateString()}`) : ''}
                </span>
              </span>
              <Button variant="secondary" disabled={updatingId === b.id} onClick={() => handleUnblock(b.id)}>取消屏蔽</Button>
            </li>
          ))}
        </ul>
      )}
    </Sheet>
  );
};

export default BlockedUsersModal;
