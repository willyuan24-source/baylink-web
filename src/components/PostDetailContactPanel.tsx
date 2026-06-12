import { useEffect, useState } from 'react';
import { Loader2, MessageCircle, Phone, Sparkles } from 'lucide-react';
import { getBayBayCategoryPrompt, getCategorySafetyTip } from '../utils/categorySafetyTips';

type ContactPreference = {
  mode?: 'dm_first' | 'auto_send' | 'manual_approve';
};

type ContactRequestItem = {
  id: string;
  status: string;
  requestMessage?: string;
  requester?: { id: string; nickname: string; avatar?: string };
};

type PostDetailContactPanelProps = {
  post: { id: string; authorId: string; category: string; title: string; contactPreference?: ContactPreference };
  currentUser?: { id: string } | null;
  isOwner: boolean;
  onLoginNeeded: () => void;
  onOpenChat: (authorId: string, authorName: string, postTitle: string) => void;
  authorName: string;
  requestContact: (postId: string) => Promise<{ status: string; threadId?: string; error?: string }>;
  fetchOwnerPending?: () => Promise<ContactRequestItem[]>;
  approveRequest?: (id: string) => Promise<void>;
  declineRequest?: (id: string) => Promise<void>;
  onAskBayBay: (question: string) => void;
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
};

const REQUEST_STATUS_COPY: Record<string, string> = {
  pending: '请求已发送，等待帖主确认',
  auto_sent: '联系方式已发送到私信',
  approved: '联系方式已发送到私信',
  declined: '帖主暂未发送联系方式，你仍可以通过 BAYLINK 私信联系',
  dm_first: '该帖子仅支持站内私信',
};

export const PostDetailContactPanel = ({
  post,
  currentUser,
  isOwner,
  onLoginNeeded,
  onOpenChat,
  authorName,
  requestContact,
  fetchOwnerPending,
  approveRequest,
  declineRequest,
  onAskBayBay,
  showToast,
}: PostDetailContactPanelProps) => {
  const [requestStatus, setRequestStatus] = useState<string | null>(null);
  const [loadingRequest, setLoadingRequest] = useState(false);
  const [pendingOwner, setPendingOwner] = useState<ContactRequestItem[]>([]);
  const [loadingPending, setLoadingPending] = useState(false);

  const mode = post.contactPreference?.mode || 'dm_first';
  const canRequestContact = mode !== 'dm_first' && !isOwner;

  useEffect(() => {
    if (!isOwner || !fetchOwnerPending) return;
    setLoadingPending(true);
    fetchOwnerPending()
      .then(setPendingOwner)
      .catch(() => setPendingOwner([]))
      .finally(() => setLoadingPending(false));
  }, [isOwner, fetchOwnerPending, post.id]);

  const handleDm = () => {
    if (!currentUser) return onLoginNeeded();
    onOpenChat(post.authorId, authorName, post.title);
  };

  const handleRequest = async () => {
    if (!currentUser) return onLoginNeeded();
    if (mode === 'dm_first') {
      showToast('该帖子仅支持站内私信', 'info');
      return;
    }
    setLoadingRequest(true);
    try {
      const res = await requestContact(post.id);
      if (res.error) {
        showToast(res.error, 'error');
        if (res.status) setRequestStatus(res.status);
        return;
      }
      setRequestStatus(res.status);
      if (res.status === 'auto_sent' || res.status === 'approved') {
        showToast('联系方式已发送到私信', 'success');
        if (res.threadId) onOpenChat(post.authorId, authorName, post.title);
      } else if (res.status === 'pending') {
        showToast('请求已发送，等待帖主确认', 'success');
      }
    } catch (e: any) {
      showToast(e?.error || e?.message || '请求失败', 'error');
    } finally {
      setLoadingRequest(false);
    }
  };

  const categoryPrompt = getBayBayCategoryPrompt(post.category);

  return (
    <div className="mb-5 space-y-3">
      <div className="surface-card p-3.5">
        <p className="mb-2 text-[11px] leading-relaxed text-baylink-muted">{getCategorySafetyTip(post.category)}</p>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={handleDm} className="inline-flex items-center gap-1.5 rounded-xl bg-baylink-green px-3.5 py-2 text-xs font-semibold text-white shadow-rest hover:bg-baylink-green-hover">
            <MessageCircle size={14} /> 私信联系
          </button>
          {canRequestContact && (
            <button
              type="button"
              onClick={handleRequest}
              disabled={loadingRequest || requestStatus === 'pending' || requestStatus === 'auto_sent' || requestStatus === 'approved'}
              className="inline-flex items-center gap-1.5 rounded-xl border border-baylink-green/25 bg-baylink-green-light px-3.5 py-2 text-xs font-semibold text-baylink-green disabled:opacity-60"
            >
              {loadingRequest ? <Loader2 size={14} className="animate-spin" /> : <Phone size={14} />}
              请求联系方式
            </button>
          )}
        </div>
        {requestStatus && (
          <p className="mt-2 text-[11px] text-baylink-text-secondary">{REQUEST_STATUS_COPY[requestStatus] || requestStatus}</p>
        )}
      </div>

      <div className="rounded-2xl border border-baylink-green/15 bg-baylink-green/[0.04] p-3.5">
        <div className="flex items-center gap-1.5 text-sm font-semibold text-baylink-text">
          <Sparkles size={15} className="text-baylink-green" /> 问问 BayBay
        </div>
        <p className="mt-1 text-[11px] text-baylink-muted">不确定怎么联系？BayBay 可以帮你整理要问的问题和安全提醒。</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {['这类帖子联系前要问什么？', '这条信息有什么需要注意？', '帮我整理一段私信开场白'].map((q) => (
            <button key={q} type="button" onClick={() => onAskBayBay(q)} className="rounded-full border border-baylink-green/20 bg-white/80 px-2.5 py-1 text-[10px] font-medium text-baylink-green hover:bg-baylink-green-light/60">
              {q}
            </button>
          ))}
          {categoryPrompt && (
            <button type="button" onClick={() => onAskBayBay(categoryPrompt)} className="rounded-full border border-baylink-green/20 bg-white/80 px-2.5 py-1 text-[10px] font-medium text-baylink-green hover:bg-baylink-green-light/60">
              {categoryPrompt}
            </button>
          )}
        </div>
      </div>

      {isOwner && (
        <div className="surface-card p-3.5">
          <h4 className="text-sm font-semibold text-baylink-text">联系方式请求</h4>
          {loadingPending ? (
            <p className="mt-2 text-xs text-baylink-muted flex items-center gap-1"><Loader2 size={12} className="animate-spin" /> 加载中...</p>
          ) : pendingOwner.length === 0 ? (
            <p className="mt-2 text-[11px] text-baylink-muted">暂无待处理的联系方式请求</p>
          ) : (
            <div className="mt-2 space-y-2">
              {pendingOwner.map((r) => (
                <div key={r.id} className="rounded-xl border border-black/[0.04] bg-white/80 p-3">
                  <div className="text-sm font-medium text-baylink-text">{r.requester?.nickname || '用户'}</div>
                  {r.requestMessage && <p className="mt-1 text-[11px] text-baylink-muted">{r.requestMessage}</p>}
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button type="button" onClick={() => approveRequest?.(r.id).then(() => { showToast('已发送联系方式', 'success'); setPendingOwner((prev) => prev.filter((x) => x.id !== r.id)); }).catch((e: any) => showToast(e?.error || '操作失败', 'error'))} className="rounded-lg bg-baylink-green px-2.5 py-1.5 text-[11px] font-semibold text-white">同意并发送</button>
                    <button type="button" onClick={() => declineRequest?.(r.id).then(() => { showToast('已拒绝请求', 'info'); setPendingOwner((prev) => prev.filter((x) => x.id !== r.id)); }).catch((e: any) => showToast(e?.error || '操作失败', 'error'))} className="rounded-lg border border-black/[0.06] px-2.5 py-1.5 text-[11px] font-medium text-baylink-text-secondary">暂不发送</button>
                    <button type="button" onClick={() => r.requester?.id && onOpenChat(r.requester.id, r.requester.nickname, post.title)} className="rounded-lg border border-black/[0.06] px-2.5 py-1.5 text-[11px] font-medium text-baylink-text-secondary">先私信聊聊</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
