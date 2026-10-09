import { useState, useEffect } from 'react';
import { MessagesSquare, Search, Pin, PinOff, X, Inbox } from 'lucide-react';
import { api } from '../../lib/api';
import Avatar from '../../components/Avatar';
import { RowCard } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { ChipRow, FilterChip } from '../../components/ui/Chip';
import { EmptyState, ErrorState } from '../../components/ui/States';
import { SkeletonFeed } from '../../components/ui/SkeletonCard';
import { useUiCopy } from '../../components/ui/ui-copy';
import { friendlyErrorMessage } from '../../lib/format';
import { readMessageDraft, readMessagePins, saveMessagePins } from './messageState';
import { previewText } from './system-notice';
import { simplifySearch } from '../../i18n/locale';
import type { Conversation, UserData } from '../../lib/types';
import './messages-hub.css';

type MessagesListProps = {
  currentUser: UserData | null;
  onLoginNeeded?: () => void;
};

const isOffline = () => typeof navigator !== 'undefined' && navigator.onLine === false;

export const MessagesList = (props: MessagesListProps) => <ConversationList key={JSON.stringify([props.currentUser?.id, props.currentUser?.token])} {...props} />;

/** Conversation threads as RowCards (WEB-UI): avatar, name, last message without links or ids, time and unread count. */
const ConversationList = ({ currentUser, onLoginNeeded }: MessagesListProps) => {
  const { t, english, locale } = useUiCopy();
  const [convs, setConvs] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [offline, setOffline] = useState(isOffline);
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
        if (!Array.isArray(response)) throw new Error('Unexpected conversation list response');
        if (!cancelled) {
          const list = response.filter((conversation: Conversation) => conversation?.id && conversation.otherUser?.id);
          setConvs([...new Map(list.map((conversation: Conversation) => [conversation.id, conversation])).values()]);
          setError(null); setOffline(false);
        }
      } catch (err) {
        if (!cancelled) { setOffline(isOffline()); setError(friendlyErrorMessage(err, '') || 'error'); }
      } finally {
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
    const wentOffline = () => { setOffline(true); };
    const syncPins = () => { setPins(readMessagePins(userId)); };
    document.addEventListener('visibilitychange', resume);
    window.addEventListener('online', resume);
    window.addEventListener('offline', wentOffline);
    window.addEventListener('baylink:messages-read', resume);
    window.addEventListener('baylink:messages-changed', resume);
    window.addEventListener('storage', syncPins);
    return () => {
      cancelled = true; controller.abort(); window.clearInterval(interval);
      document.removeEventListener('visibilitychange', resume);
      window.removeEventListener('online', resume);
      window.removeEventListener('offline', wentOffline);
      window.removeEventListener('baylink:messages-read', resume);
      window.removeEventListener('baylink:messages-changed', resume);
      window.removeEventListener('storage', syncPins);
    };
  }, [userId, retryKey]);

  const togglePin = (id: string) => {
    if (!userId) return;
    if (!pins.includes(id) && pins.length >= 20) { setPinNotice(t('最多置顶 20 个对话，请先取消一个置顶。', 'You can pin up to 20 conversations. Unpin one to add another.')); return; }
    const next = pins.includes(id) ? pins.filter(pin => pin !== id) : [id, ...pins];
    if (!saveMessagePins(userId, next)) { setPinNotice(t('浏览器未能保存置顶设置，请稍后重试。', 'Your browser could not save this pin. Please try again.')); return; }
    setPins(next); setPinNotice('');
  };

  if (!currentUser) return <EmptyState icon={MessagesSquare} title={t('登录后查看消息', 'Sign in to see your messages')}
    body={t('私信、联系方式请求，以及小队和预约的通知，都会出现在这里。', 'Private messages, contact requests and group or booking updates arrive here.')}
    actions={<><Button variant="primary" onClick={onLoginNeeded}>{t('登录 / 注册', 'Log in / Sign up')}</Button><Button variant="text" to="/events">{t('先看看本周末去哪', 'See this weekend first')}</Button></>} />;

  const terms = simplifySearch(query.trim()).toLocaleLowerCase().split(/\s+/).filter(Boolean);
  const unreadConversations = convs.filter(conversation => (conversation.unreadCount || 0) > 0).length;
  const visible = convs.filter(conversation => {
    if (filter === 'unread' && !((conversation.unreadCount || 0) > 0)) return false;
    const haystack = simplifySearch([conversation.otherUser.nickname, conversation.otherUser.city, conversation.otherUser.statusText, conversation.lastMessage, conversation.lastPostTitle].filter(Boolean).join(' ')).toLocaleLowerCase();
    return terms.every(term => haystack.includes(term));
  }).sort((a, b) => Number(pins.includes(b.id)) - Number(pins.includes(a.id)) || b.updatedAt - a.updatedAt);
  const dateLocale = english ? 'en-US' : locale === 'zh-Hant' ? 'zh-TW' : 'zh-CN';
  const when = (time: number) => {
    const date = new Date(time);
    const today = new Date();
    return date.toDateString() === today.toDateString()
      ? new Intl.DateTimeFormat(dateLocale, { hour: 'numeric', minute: '2-digit' }).format(date)
      : new Intl.DateTimeFormat(dateLocale, { month: 'numeric', day: 'numeric', ...(date.getFullYear() !== today.getFullYear() ? { year: 'numeric' } : {}) }).format(date);
  };
  const failure = error && (offline
    ? <ErrorState title={t('网络已断开', 'You are offline')} body={t('连上网络后会自动刷新对话。', 'Conversations refresh by themselves when you are back online.')} onRetry={() => setRetryKey(key => key + 1)} homeTo={null} headingLevel="h3" />
    : <ErrorState title={t('对话暂时没能加载', 'Conversations did not load')} onRetry={() => setRetryKey(key => key + 1)} homeTo={null} headingLevel="h3" />);

  return <section className="msg-list" aria-labelledby="msg-list-title" aria-busy={loading && convs.length === 0}>
    <h2 id="msg-list-title" className="msg-list__title">{t('最近对话', 'Recent conversations')}</h2>
    {convs.length > 0 && <>
      <div className="msg-controls">
        <label className="msg-search"><Search size={18} aria-hidden="true" /><input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder={t('搜索联系人、最近消息或帖子', 'Search people, recent messages or posts')} aria-label={t('搜索对话', 'Search conversations')} />{query && <button type="button" aria-label={t('清除搜索', 'Clear search')} onClick={() => setQuery('')}><X size={18} aria-hidden="true" /></button>}</label>
        <ChipRow label={t('筛选对话', 'Filter conversations')}>
          <FilterChip selected={filter === 'all'} count={convs.length} onClick={() => setFilter('all')}>{t('全部', 'All')}</FilterChip>
          <FilterChip selected={filter === 'unread'} count={unreadConversations} onClick={() => setFilter('unread')}>{t('未读', 'Unread')}</FilterChip>
        </ChipRow>
      </div>
      <p className="msg-note">{t('置顶只保存在这个浏览器。', 'Pins are saved in this browser only.')}</p>
    </>}
    {pinNotice && <p className="msg-pin-note" role="status">{pinNotice}</p>}
    {failure}
    {loading && convs.length === 0 ? <SkeletonFeed rows count={4} />
      : visible.length > 0 ? <ul className="msg-threads">{visible.map(conversation => {
        const other = conversation.otherUser;
        const draft = readMessageDraft(currentUser.id, conversation.id);
        const pinned = pins.includes(conversation.id);
        const unread = Math.max(0, Number(conversation.unreadCount) || 0);
        const preview = conversation.lastMessage ? previewText(conversation.lastMessage, english) : t('点击开始聊天', 'Tap to start chatting');
        // translate="no": the name and message are the members' own words; every UI string here is already localised.
        return <li key={conversation.id} translate="no" data-profile-theme={other.profileTheme || 'bay'}>
          <RowCard className={unread ? 'msg-thread msg-thread--unread' : 'msg-thread'} title={other.nickname} to={`/messages/${encodeURIComponent(conversation.id)}`}
            thumb={<Avatar src={other.avatar} name={other.nickname} theme={other.profileTheme} size={14} />}
            date={<>{pinned && <>{t('已置顶', 'Pinned')} · </>}<time dateTime={new Date(conversation.updatedAt).toISOString()}>{when(conversation.updatedAt)}</time>{unread > 0 && <b className="msg-thread__unread" aria-label={t(`${unread} 条未读`, `${unread} unread`)}>{unread > 99 ? '99+' : unread}</b>}</>}
            meta={draft ? <><em className="msg-thread__draft">{t('草稿', 'Draft')}</em> {draft}</> : preview}
            trailing={<button type="button" className="msg-pin" aria-label={`${pinned ? t('取消置顶', 'Unpin conversation') : t('置顶对话', 'Pin conversation')} · ${other.nickname}`} aria-pressed={pinned} onClick={() => togglePin(conversation.id)}>{pinned ? <PinOff size={18} aria-hidden="true" /> : <Pin size={18} aria-hidden="true" />}</button>} />
        </li>;
      })}</ul>
        : !error && (convs.length
          ? <EmptyState icon={Inbox} headingLevel="h3" title={filter === 'unread' && !query ? t('消息都看完了。', "You're all caught up.") : t('没有找到这个对话', 'No matching conversations')}
            body={t('试试切换筛选，或搜索昵称和最近聊过的内容。', 'Try another filter, a name, or something you recently discussed.')}
            actions={<Button variant="secondary" onClick={() => { setQuery(''); setFilter('all'); }}>{t('查看全部对话', 'View all conversations')}</Button>} />
          : <EmptyState icon={Inbox} headingLevel="h3" title={t('还没有消息', 'No messages yet')}
            body={t('有人回复你的私信、请求联系方式，或小队和预约有变化时，会出现在这里。', 'Replies, contact requests and group or booking updates will appear here.')}
            actions={<Button variant="text" to="/events">{t('看看本周末去哪', 'See where to go this weekend')}</Button>} />)}
  </section>;
};
