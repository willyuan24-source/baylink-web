import { useCallback, useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import Avatar from './Avatar';

export type ContactRequestInboxItem = {
  id: string;
  postId: string;
  postTitle?: string;
  status: string;
  requestMessage?: string;
  requester?: { id: string; nickname: string; avatar?: string };
};

type ContactRequestInboxPanelProps = {
  fetchPending: () => Promise<ContactRequestInboxItem[]>;
  onApprove: (id: string) => Promise<void>;
  onDecline: (id: string) => Promise<void>;
  onOpenChat: (userId: string, nickname: string, postTitle: string) => void;
  onOpenPost?: (postId: string) => void;
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
  onCountChange?: (count: number) => void;
  refreshKey?: number;
};

export const ContactRequestInboxPanel = ({
  fetchPending,
  onApprove,
  onDecline,
  onOpenChat,
  onOpenPost,
  showToast,
  onCountChange,
  refreshKey = 0,
}: ContactRequestInboxPanelProps) => {
  const [requests, setRequests] = useState<ContactRequestInboxItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [actingId, setActingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const list = await fetchPending();
      setRequests(list);
      onCountChange?.(list.length);
    } catch {
      setRequests([]);
      onCountChange?.(0);
    } finally {
      setLoading(false);
    }
  }, [fetchPending, onCountChange]);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  if (loading && requests.length === 0) return null;
  if (!loading && requests.length === 0) return null;

  const handleApprove = async (id: string) => {
    setActingId(id);
    try {
      await onApprove(id);
      showToast('已发送联系方式', 'success');
      setRequests((prev) => {
        const next = prev.filter((r) => r.id !== id);
        onCountChange?.(next.length);
        return next;
      });
    } catch (e: any) {
      showToast(e?.error || '操作失败', 'error');
    } finally {
      setActingId(null);
    }
  };

  const handleDecline = async (id: string) => {
    setActingId(id);
    try {
      await onDecline(id);
      showToast('已拒绝请求', 'info');
      setRequests((prev) => {
        const next = prev.filter((r) => r.id !== id);
        onCountChange?.(next.length);
        return next;
      });
    } catch (e: any) {
      showToast(e?.error || '操作失败', 'error');
    } finally {
      setActingId(null);
    }
  };

  return (
    <div className="mx-4 mt-3 mb-1">
      <div className="rounded-2xl border border-amber-200/80 bg-amber-50/90 p-3.5 shadow-rest">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-amber-950">
              你有 {requests.length} 个联系方式请求待处理
            </p>
            <p className="mt-0.5 text-[11px] leading-relaxed text-amber-900/80">
              同意后将通过私信发送联系方式卡片，不会公开在帖子详情。
            </p>
          </div>
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="shrink-0 inline-flex items-center gap-0.5 rounded-lg border border-amber-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-amber-900"
          >
            {expanded ? '收起' : '查看请求'}
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </div>

        {expanded && (
          <div className="mt-3 space-y-2 border-t border-amber-200/60 pt-3">
            {loading ? (
              <p className="flex items-center gap-1 text-xs text-amber-900/70">
                <Loader2 size={12} className="animate-spin" /> 加载中...
              </p>
            ) : (
              requests.map((r) => (
                <div key={r.id} className="rounded-xl border border-amber-100 bg-white/90 p-3">
                  <div className="flex items-center gap-2">
                    <Avatar src={r.requester?.avatar} name={r.requester?.nickname || '用户'} size={8} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-baylink-text">{r.requester?.nickname || '用户'}</p>
                      {r.postTitle ? (
                        <button
                          type="button"
                          onClick={() => onOpenPost?.(r.postId)}
                          className="mt-0.5 truncate text-left text-[11px] text-baylink-green hover:underline"
                        >
                          帖子：{r.postTitle}
                        </button>
                      ) : (
                        <p className="mt-0.5 truncate text-[11px] text-baylink-muted">帖子 ID：{r.postId}</p>
                      )}
                    </div>
                  </div>
                  {r.requestMessage && (
                    <p className="mt-2 text-[11px] leading-relaxed text-baylink-text-secondary">{r.requestMessage}</p>
                  )}
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={actingId === r.id}
                      onClick={() => handleApprove(r.id)}
                      className="rounded-lg bg-baylink-green px-2.5 py-1.5 text-[11px] font-semibold text-white disabled:opacity-60"
                    >
                      {actingId === r.id ? '处理中...' : '同意并发送'}
                    </button>
                    <button
                      type="button"
                      disabled={actingId === r.id}
                      onClick={() => handleDecline(r.id)}
                      className="rounded-lg border border-black/[0.06] px-2.5 py-1.5 text-[11px] font-medium text-baylink-text-secondary disabled:opacity-60"
                    >
                      暂不发送
                    </button>
                    <button
                      type="button"
                      onClick={() => r.requester?.id && onOpenChat(r.requester.id, r.requester.nickname, r.postTitle || '帖子')}
                      className="rounded-lg border border-black/[0.06] px-2.5 py-1.5 text-[11px] font-medium text-baylink-text-secondary"
                    >
                      先私信聊聊
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
};
