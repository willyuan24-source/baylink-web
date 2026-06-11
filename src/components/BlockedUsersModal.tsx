import React, { useEffect, useState } from 'react';
import { X, Loader2 } from 'lucide-react';

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
  Avatar: React.ComponentType<{ src?: string; name?: string; size?: number; className?: string }>;
};

export const BlockedUsersModal = ({
  isOpen,
  onClose,
  loadBlocks,
  onUnblock,
  showToast,
  Avatar,
}: BlockedUsersModalProps) => {
  const [blocks, setBlocks] = useState<BlockedUserItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

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

  return (
    <div className="fixed inset-0 z-[120] flex items-end justify-center bg-black/40 px-4 pb-24 pt-6 backdrop-blur-sm sm:items-center sm:pb-6" onClick={onClose}>
      <div className="flex max-h-[80vh] w-full max-w-md flex-col overflow-hidden rounded-2xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-baylink-border/40 px-4 py-3">
          <h3 className="text-base font-bold text-baylink-text">已屏蔽用户</h3>
          <button type="button" onClick={onClose} className="rounded-full p-1.5 text-baylink-muted hover:bg-baylink-section">
            <X size={18} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-3">
          {loading ? (
            <div className="py-12 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin text-baylink-green" /></div>
          ) : blocks.length === 0 ? (
            <p className="py-12 text-center text-sm text-baylink-muted">你还没有屏蔽任何用户</p>
          ) : (
            <div className="space-y-2">
              {blocks.map((b) => (
                <div key={b.id} className="flex items-center gap-3 rounded-xl border border-baylink-border/50 bg-baylink-section/20 p-3">
                  <Avatar src={b.avatar} name={b.nickname} size={10} className="shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold text-baylink-text">{b.nickname}</div>
                    <p className="mt-0.5 text-[10px] text-baylink-muted">
                      {b.isPhoneVerified ? '手机验证：已完成' : '手机验证：未完成'}
                      {b.isOfficialVerified ? ' · 官方认证' : ''}
                    </p>
                    {b.blockedAt ? (
                      <p className="text-[10px] text-baylink-muted">屏蔽于 {new Date(b.blockedAt).toLocaleDateString()}</p>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    disabled={updatingId === b.id}
                    onClick={() => handleUnblock(b.id)}
                    className="shrink-0 rounded-lg border border-baylink-border/60 px-2.5 py-1.5 text-[11px] font-semibold text-baylink-text-secondary hover:bg-white disabled:opacity-50"
                  >
                    取消屏蔽
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default BlockedUsersModal;
