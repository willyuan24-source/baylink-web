import { useState, useEffect } from 'react';
import { MessageCircle, ChevronRight, ArrowUpRight, MessagesSquare, Search, Pin, PinOff, X, Inbox } from 'lucide-react';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api';
import Avatar from '../../components/Avatar';
import { TrustBadge } from '../../components/TrustBadge';
import { ConversationListSkeleton } from '../../components/ui/Skeleton';
import { formatChineseDate, friendlyErrorMessage } from '../../lib/format';
import { readMessageDraft, readMessagePins, saveMessagePins } from './messageState';
import { simplifySearch, translateText, useLocale } from '../../i18n/locale';
import type { Conversation, UserData } from '../../lib/types';

type MessagesListProps = {
  currentUser: UserData | null;
  onOpenChat: (conv: Conversation) => void;
  onOpenProfile?: (userId: string) => void;
  onLoginNeeded?: () => void;
};

export const MessagesList = (props: MessagesListProps) => <ConversationList key={props.currentUser?.id || 'guest'} {...props} />;

const ConversationList = ({ currentUser, onOpenChat, onOpenProfile, onLoginNeeded }: MessagesListProps) => {
  const locale = useLocale();
  const tr = (text: string) => translateText(text, locale);
  const [convs, setConvs] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [pins, setPins] = useState(() => currentUser ? readMessagePins(currentUser.id) : []);
  const [pinNotice, setPinNotice] = useState('');
  const userId = currentUser?.id;

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    let inFlight = false;
    let refreshQueued = false;
    const controller = new AbortController();
    const load = async () => {
      if (cancelled || document.visibilityState === 'hidden') return;
      if (inFlight) { refreshQueued = true; return; }
      inFlight = true;
      try {
        const response = await api.request('/conversations', { signal: controller.signal });
        if (!Array.isArray(response)) throw new Error('会话列表响应格式异常');
        if (!cancelled) {
          const list = response.filter((conversation: Conversation) => conversation?.id && conversation.otherUser?.id);
          setConvs([...new Map(list.map((conversation: Conversation) => [conversation.id, conversation])).values()]);
          setError(null);
        }
      } catch (err) { if (!cancelled) setError(friendlyErrorMessage(err, '会话列表加载失败，请重试。')); }
      finally {
        inFlight = false;
        if (!cancelled) {
          setLoading(false);
          if (refreshQueued) { refreshQueued = false; void load(); }
        }
      }
    };
    void load();
    const interval = window.setInterval(() => { void load(); }, 15000);
    const resume = () => { void load(); };
    const syncPins = () => { setPins(readMessagePins(userId)); };
    document.addEventListener('visibilitychange', resume);
    window.addEventListener('online', resume);
    window.addEventListener('baylink:messages-read', resume);
    window.addEventListener('baylink:messages-changed', resume);
    window.addEventListener('storage', syncPins);
    return () => {
      cancelled = true; controller.abort(); window.clearInterval(interval);
      document.removeEventListener('visibilitychange', resume);
      window.removeEventListener('online', resume);
      window.removeEventListener('baylink:messages-read', resume);
      window.removeEventListener('baylink:messages-changed', resume);
      window.removeEventListener('storage', syncPins);
    };
  }, [userId, retryKey]);

  const togglePin = (id: string) => {
    if (!userId) return;
    if (!pins.includes(id) && pins.length >= 20) { setPinNotice(tr('最多置顶 20 个对话，请先取消一个置顶。')); return; }
    const next = pins.includes(id) ? pins.filter(pin => pin !== id) : [id, ...pins];
    if (!saveMessagePins(userId, next)) { setPinNotice(tr('浏览器未能保存置顶设置，请稍后重试。')); return; }
    setPins(next); setPinNotice('');
  };

  if (!currentUser) return <div className="member-messages-guest"><div className="member-empty-card"><div className="member-message-art" aria-hidden="true"><span><MessagesSquare size={38} strokeWidth={1.5} /></span><i /><b /></div><span className="member-eyebrow">YOUR NEIGHBORHOOD INBOX</span><h2>身边的联系，都在这里。</h2><p>登录后查看私信和联系方式请求，<br className="hidden sm:block" />与感兴趣的房源、好物和服务发布者直接沟通。</p><button type="button" onClick={onLoginNeeded} className="member-primary mt-6">登录 / 注册<ArrowUpRight size={17} aria-hidden="true" /></button><Link to="/" className="member-text-action mt-4">先逛逛社区 <ChevronRight size={14} aria-hidden="true" /></Link></div></div>;

  const terms = simplifySearch(query.trim()).toLocaleLowerCase().split(/\s+/).filter(Boolean);
  const unreadConversations = convs.filter(conversation => (conversation.unreadCount || 0) > 0).length;
  const visible = convs.filter(conversation => {
    if (filter === 'unread' && !((conversation.unreadCount || 0) > 0)) return false;
    const haystack = simplifySearch([conversation.otherUser.nickname, conversation.otherUser.city, conversation.otherUser.statusText, conversation.lastMessage, conversation.lastPostTitle].filter(Boolean).join(' ')).toLocaleLowerCase();
    return terms.every(term => haystack.includes(term));
  }).sort((a, b) => Number(pins.includes(b.id)) - Number(pins.includes(a.id)) || b.updatedAt - a.updatedAt);
  return <div className={`member-conversations modern-inbox ${convs.length ? 'has-conversations' : ''}`}>
    <div className="modern-inbox-intro"><div><span className="member-eyebrow">A LITTLE CLOSER</span><h2>把联系，留在身边。</h2><p>从一次问候，到一个聊得来的邻居。</p></div><div className="modern-inbox-art" aria-hidden="true"><MessageCircle size={31} /><span>👋</span></div></div>
    <div className="modern-inbox-controls"><label className="modern-inbox-search"><Search size={17} aria-hidden="true" /><input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="搜索联系人、最近消息或帖子" aria-label="搜索对话" />{query && <button type="button" aria-label="清除搜索" onClick={() => setQuery('')}><X size={16} /></button>}</label><div className="modern-inbox-filters" role="group" aria-label="筛选对话"><button type="button" aria-pressed={filter === 'all'} onClick={() => setFilter('all')}>全部<span translate="no">{convs.length}</span></button><button type="button" aria-pressed={filter === 'unread'} onClick={() => setFilter('unread')}>未读<span translate="no">{unreadConversations}</span></button></div></div>
    <div className="modern-inbox-list-label"><span>最近对话</span><span><Pin size={12} aria-hidden="true" />置顶仅保存在此浏览器</span></div>
    {pinNotice && <p className="modern-inbox-notice" role="status">{pinNotice}</p>}
    {error && <div role="alert" className="member-message-error"><p>{error}</p><button type="button" onClick={() => setRetryKey(key => key + 1)} className="member-text-action mt-2">重新加载</button></div>}
    {loading && convs.length === 0 ? <ConversationListSkeleton /> : visible.length > 0 ? <div className="modern-inbox-list">{visible.map(conversation => {
      const other = conversation.otherUser;
      const draft = readMessageDraft(currentUser.id, conversation.id);
      const pinned = pins.includes(conversation.id);
      const unread = Math.max(0, Number(conversation.unreadCount) || 0);
      return <div key={conversation.id} className={`modern-inbox-row ${unread ? 'has-unread' : ''} ${pinned ? 'is-pinned' : ''}`} data-profile-theme={other.profileTheme || 'bay'}>
        <button type="button" onClick={() => onOpenProfile?.(other.id)} disabled={!onOpenProfile} translate="no" aria-label={`${tr('查看资料')} · ${other.nickname}`} className="modern-inbox-avatar"><Avatar src={other.avatar} name={other.nickname} theme={other.profileTheme} size={13} /></button>
        <button type="button" onClick={() => onOpenChat(conversation)} className="modern-inbox-conversation"><span className="modern-inbox-row-heading"><span className="modern-inbox-name"><strong translate="no">{other.nickname}</strong><TrustBadge user={other} size={12} />{pinned && <Pin size={12} aria-label={tr('已置顶')} />}</span><time dateTime={new Date(conversation.updatedAt).toISOString()}>{formatChineseDate(conversation.updatedAt)}</time></span>{other.statusText && <span className="modern-inbox-person-status" translate="no">{other.statusText}</span>}<span className="modern-inbox-preview"><span className="modern-inbox-preview-text">{draft ? <><em>草稿</em><span translate="no">{draft}</span></> : conversation.lastMessage ? <span translate="no">{conversation.lastMessage}</span> : <span>点击开始聊天</span>}</span>{unread > 0 && <span className="modern-inbox-unread" aria-label={`${tr('未读消息')} · ${unread}`} translate="no">{unread > 99 ? '99+' : unread}</span>}</span></button>
        <button type="button" className="modern-inbox-pin" translate="no" aria-label={`${tr(pinned ? '取消置顶' : '置顶对话')} · ${other.nickname}`} aria-pressed={pinned} onClick={() => togglePin(conversation.id)}>{pinned ? <PinOff size={15} /> : <Pin size={15} />}</button>
      </div>;
    })}</div> : !error && <div className="member-empty-card member-empty-card--compact"><span className="member-empty-icon"><Inbox size={28} aria-hidden="true" /></span><h2>{convs.length ? filter === 'unread' && !query ? '消息都看完了。' : '没有找到这个对话' : '还没有消息'}</h2><p>{convs.length ? '试试切换筛选，或搜索昵称和最近聊过的内容。' : '看到合适的房源、二手或服务，可以点「私信」开始沟通。'}</p>{convs.length ? <button type="button" className="member-secondary mt-5" onClick={() => { setQuery(''); setFilter('all'); }}>查看全部对话</button> : <Link to="/" className="member-secondary mt-5">发现身边好物与服务<ArrowUpRight size={16} aria-hidden="true" /></Link>}</div>}
  </div>;
};
