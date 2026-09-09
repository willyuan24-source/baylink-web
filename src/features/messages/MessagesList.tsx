import { useState, useEffect } from 'react';
import { MessageCircle, ChevronRight } from 'lucide-react';
import { api } from '../../lib/api';
import Avatar from '../../components/Avatar';
import { TrustBadge } from '../../components/TrustBadge';
import { ConversationListSkeleton } from '../../components/ui/Skeleton';
import { formatChineseDate, friendlyErrorMessage } from '../../lib/format';
import type { Conversation, UserData } from '../../lib/types';

type MessagesListProps = {
  currentUser: UserData | null;
  onOpenChat: (conv: Conversation) => void;
  onOpenProfile?: (userId: string) => void;
  onLoginNeeded?: () => void;
};

export const MessagesList = (props: MessagesListProps) => (
  <ConversationList key={props.currentUser?.id || 'guest'} {...props} />
);

const ConversationList = ({ currentUser, onOpenChat, onOpenProfile, onLoginNeeded }: MessagesListProps) => {
  const [convs, setConvs] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);
  const userId = currentUser?.id;

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    let inFlight = false;
    const controller = new AbortController();
    const load = async () => {
      if (inFlight || cancelled || document.visibilityState === 'hidden') return;
      inFlight = true;
      try {
        const response = await api.request('/conversations', { signal: controller.signal });
        if (!Array.isArray(response)) throw new Error('会话列表响应格式异常');
        if (!cancelled) {
          const list = response.filter((conversation: Conversation) => conversation?.id && conversation.otherUser?.id);
          setConvs([...new Map(list.map((conversation: Conversation) => [conversation.id, conversation])).values()]);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) setError(friendlyErrorMessage(err, '会话列表加载失败，请重试。'));
      } finally {
        inFlight = false;
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    const interval = window.setInterval(() => { void load(); }, 15000);
    const resume = () => { void load(); };
    document.addEventListener('visibilitychange', resume);
    window.addEventListener('online', resume);
    return () => {
      cancelled = true;
      controller.abort();
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', resume);
      window.removeEventListener('online', resume);
    };
  }, [userId, retryKey]);

  if (!currentUser) return (
    <div className="flex min-h-[300px] w-full flex-col items-center justify-center p-8 text-center">
      <div className="surface-card mb-4 flex h-20 w-20 items-center justify-center rounded-full"><MessageCircle size={32} className="text-baylink-muted" /></div>
      <h3 className="font-semibold text-baylink-text">登录后查看私信和联系方式请求</h3>
      <button type="button" onClick={onLoginNeeded} className="btn-primary mt-4 px-5 py-2.5">登录 / 注册</button>
    </div>
  );
  return (
    <div className="flex-1 overflow-y-auto p-4 pb-24 w-full bg-baylink-bg">
      {error && <div role="alert" className="surface-card mb-3 p-4 text-sm text-baylink-text-secondary"><p>{error}</p><button type="button" onClick={() => setRetryKey(key => key + 1)} className="mt-2 font-semibold text-baylink-green">重新加载</button></div>}
      {loading && convs.length === 0 ? <ConversationListSkeleton /> : convs.length > 0 ? (
        <div className="space-y-3">
          {convs.map(conversation => (
            <div key={conversation.id} className="surface-card flex min-h-[72px] items-center gap-3.5 p-4">
              <button type="button" onClick={() => onOpenProfile?.(conversation.otherUser.id)} disabled={!onOpenProfile} aria-label={`查看 ${conversation.otherUser.nickname} 的资料`} className="shrink-0 rounded-full">
                <Avatar src={conversation.otherUser.avatar} name={conversation.otherUser.nickname} size={12} />
              </button>
              <button type="button" onClick={() => onOpenChat(conversation)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                <div className="min-w-0 flex-1">
                  <div className="mb-0.5 flex items-start justify-between gap-2">
                    <span className="flex min-w-0 items-center gap-1 text-[17px] font-semibold text-baylink-text"><span className="truncate">{conversation.otherUser.nickname}</span><TrustBadge user={conversation.otherUser} size={12} /></span>
                    <span className="type-footnote shrink-0">{formatChineseDate(conversation.updatedAt)}</span>
                  </div>
                  <p className="truncate text-[14px] text-baylink-text-secondary">{conversation.lastMessage || '点击开始聊天'}</p>
                </div>
                <ChevronRight size={16} className="shrink-0 text-baylink-muted" />
              </button>
            </div>
          ))}
        </div>
      ) : !error && (
        <div className="surface-card mx-1 mt-8 px-6 py-10 text-center">
          <MessageCircle size={28} className="mx-auto mb-3 text-baylink-green" />
          <p className="text-[17px] font-semibold text-baylink-text">还没有消息</p>
          <p className="mt-2 text-[14px] leading-relaxed text-baylink-text-secondary">看到合适的房源、二手或服务，可以点「私信」开始沟通。</p>
        </div>
      )}
    </div>
  );
};
