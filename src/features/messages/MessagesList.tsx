import { useState, useEffect } from 'react';
import { MessageCircle, ChevronRight, ArrowUpRight, MessagesSquare } from 'lucide-react';
import { Link } from 'react-router-dom';
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
    <div className="member-messages-guest">
      <div className="member-empty-card">
        <div className="member-message-art" aria-hidden="true"><span><MessagesSquare size={38} strokeWidth={1.5} /></span><i /><b /></div>
        <span className="member-eyebrow">YOUR NEIGHBORHOOD INBOX</span>
        <h2>身边的联系，都在这里。</h2>
        <p>登录后查看私信和联系方式请求，<br className="hidden sm:block" />与感兴趣的房源、好物和服务发布者直接沟通。</p>
        <button type="button" onClick={onLoginNeeded} className="member-primary mt-6">登录 / 注册<ArrowUpRight size={17} aria-hidden="true" /></button>
        <Link to="/" className="member-text-action mt-4">先逛逛社区 <ChevronRight size={14} aria-hidden="true" /></Link>
      </div>
    </div>
  );
  return (
    <div className="member-conversations">
      <div className="member-list-label"><span>最近对话</span><MessageCircle size={15} aria-hidden="true" /></div>
      {error && <div role="alert" className="member-message-error"><p>{error}</p><button type="button" onClick={() => setRetryKey(key => key + 1)} className="member-text-action mt-2">重新加载</button></div>}
      {loading && convs.length === 0 ? <ConversationListSkeleton /> : convs.length > 0 ? (
        <div className="member-conversation-list">
          {convs.map(conversation => (
            <div key={conversation.id} className="member-conversation-row">
              <button type="button" onClick={() => onOpenProfile?.(conversation.otherUser.id)} disabled={!onOpenProfile} aria-label={`查看 ${conversation.otherUser.nickname} 的资料`} className="shrink-0 rounded-full">
                <Avatar src={conversation.otherUser.avatar} name={conversation.otherUser.nickname} size={12} />
              </button>
              <button type="button" onClick={() => onOpenChat(conversation)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                <div className="min-w-0 flex-1">
                  <div className="mb-0.5 flex items-start justify-between gap-2">
                    <span className="flex min-w-0 items-center gap-1 text-[15px] font-semibold text-baylink-text"><span className="truncate">{conversation.otherUser.nickname}</span><TrustBadge user={conversation.otherUser} size={12} /></span>
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
        <div className="member-empty-card member-empty-card--compact">
          <span className="member-empty-icon"><MessageCircle size={28} aria-hidden="true" /></span>
          <h2>还没有消息</h2>
          <p>看到合适的房源、二手或服务，<br />可以点「私信」开始沟通。</p>
          <Link to="/" className="member-secondary mt-5">发现身边好物与服务<ArrowUpRight size={16} aria-hidden="true" /></Link>
        </div>
      )}
    </div>
  );
};
