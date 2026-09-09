import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import Avatar from './Avatar';
import { friendlyErrorMessage } from '../lib/format';

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
  const [error, setError] = useState<string | null>(null);
  const callbacks = useRef({ fetchPending, onCountChange });
  const active = useRef(true);
  const loadSequence = useRef(0);
  const actionPending = useRef(false);
  const completedIds = useRef(new Set<string>());
  const requestsRef = useRef<ContactRequestInboxItem[]>([]);

  useEffect(() => { callbacks.current = { fetchPending, onCountChange }; }, [fetchPending, onCountChange]);
  useEffect(() => { active.current = true; return () => { active.current = false; loadSequence.current += 1; }; }, []);

  const load = useCallback(async () => {
    const sequence = ++loadSequence.current;
    setLoading(true);
    try {
      const response = await callbacks.current.fetchPending();
      if (!Array.isArray(response)) throw new Error('联系方式请求响应格式异常');
      if (!active.current || sequence !== loadSequence.current) return;
      const list = [...new Map(response.filter(request => !completedIds.current.has(request.id)).map(request => [request.id, request])).values()];
      requestsRef.current = list;
      setRequests(list);
      callbacks.current.onCountChange?.(list.length);
      setError(null);
    } catch (err) {
      if (active.current && sequence === loadSequence.current) setError(friendlyErrorMessage(err, '联系方式请求加载失败。'));
    } finally {
      if (active.current && sequence === loadSequence.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  const handleAction = async (id: string, approve: boolean) => {
    if (actionPending.current) return;
    actionPending.current = true;
    setActingId(id);
    try {
      await (approve ? onApprove(id) : onDecline(id));
      if (!active.current) return;
      completedIds.current.add(id);
      const next = requestsRef.current.filter(request => request.id !== id);
      requestsRef.current = next;
      setRequests(next);
      callbacks.current.onCountChange?.(next.length);
      showToast(approve ? '已发送联系方式' : '已拒绝请求', approve ? 'success' : 'info');
    } catch (err) {
      if (active.current) showToast(friendlyErrorMessage(err, '操作失败，请重试。'), 'error');
    } finally {
      if (active.current) { actionPending.current = false; setActingId(null); }
    }
  };

  if (requests.length === 0 && !error) return loading ? <p role="status" className="mx-4 mt-3 text-sm text-baylink-text-secondary">正在加载联系方式请求…</p> : null;

  return (
    <div className="mx-4 mt-3 mb-1">
      <div className="rounded-2xl border border-amber-200/80 bg-amber-50/90 p-3.5 shadow-rest">
        {error && <div role="alert" className="mb-3 text-sm text-baylink-text-secondary"><p>{error}</p><button type="button" onClick={() => void load()} className="mt-1 font-semibold text-baylink-green">重新加载</button></div>}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-amber-950">
              {requests.length ? `你有 ${requests.length} 个联系方式请求待处理` : '联系方式请求'}
            </p>
            <p className="mt-0.5 text-[11px] leading-relaxed text-amber-900/80">
              同意后将通过私信发送联系方式卡片，不会公开在帖子详情。
            </p>
          </div>
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
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
                      <p className="truncate text-sm font-semibold text-baylink-text">{r.requester?.nickname ? <span translate="no">{r.requester.nickname}</span> : '用户'}</p>
                      {r.postTitle ? (
                        <button
                          type="button"
                          onClick={() => onOpenPost?.(r.postId)}
                          className="mt-0.5 truncate text-left text-[11px] text-baylink-green hover:underline"
                        >
                          帖子：<span translate="no">{r.postTitle}</span>
                        </button>
                      ) : (
                        <p className="mt-0.5 truncate text-[11px] text-baylink-muted">帖子 ID：{r.postId}</p>
                      )}
                    </div>
                  </div>
                  {r.requestMessage && (
                    <p className="mt-2 text-[11px] leading-relaxed text-baylink-text-secondary" translate="no">{r.requestMessage}</p>
                  )}
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={actingId !== null}
                      onClick={() => void handleAction(r.id, true)}
                      className="rounded-lg bg-baylink-green px-2.5 py-1.5 text-[11px] font-semibold text-white disabled:opacity-60"
                    >
                      {actingId === r.id ? '处理中...' : '同意并发送'}
                    </button>
                    <button
                      type="button"
                      disabled={actingId !== null}
                      onClick={() => void handleAction(r.id, false)}
                      className="rounded-lg border border-black/[0.06] px-2.5 py-1.5 text-[11px] font-medium text-baylink-text-secondary disabled:opacity-60"
                    >
                      暂不发送
                    </button>
                    <button
                      type="button"
                      disabled={!r.requester?.id}
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
