import { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, UserX, FileText, Phone, Send, Loader2, SmilePlus, Reply, X, ArrowDown, CornerDownLeft, MessageCircle } from 'lucide-react';
import { api } from '../../lib/api';
import Avatar from '../../components/Avatar';
import { ModalShell } from '../../components/ui/Modal';
import { confirmDialog } from '../../components/ui/confirm';
import { TrustBadge } from '../../components/TrustBadge';
import { isPlatformAdmin } from '../../components/UserTrustBadges';
import { ContactCardMessage } from '../../components/ContactCardMessage';
import { friendlyErrorMessage } from '../../lib/format';
import { translateText, useLocale } from '../../i18n/locale';
import type { Message, Conversation, UserData } from '../../lib/types';
import type { Socket } from 'socket.io-client';
import { mergeMessages, messageText, readServerMessage, readMessageDraft, saveMessageDraft, readPendingMessages, savePendingMessage, removePendingMessage, messageReadBatches, isReplyable, isNearMessageBottom, MESSAGE_REACTIONS, type MessageReaction, type DisplayMessage } from './messageState';

type ChatViewProps = {
  currentUser: UserData;
  conversation: Conversation;
  onClose: () => void;
  socket: Socket | null;
  onViewProfile?: (userId: string) => void;
  onToggleBlockUser?: (userId: string) => void;
  blockedUserIds?: string[];
  showToast?: (message: string, type?: 'success' | 'error' | 'info') => void;
};
const COMPOSER_EMOJI = ['👋', '😊', '👍', '❤️', '🙏', '🎉', '😂', '👀', '☕', '🌉', '🌿', '✨'];

export const ChatView = (props: ChatViewProps) => <ChatSession key={`${props.currentUser.id}:${props.conversation.id}`} {...props} />;

const ChatSession = ({ currentUser, conversation, onClose, socket, onViewProfile, onToggleBlockUser, blockedUserIds, showToast }: ChatViewProps) => {
  const locale = useLocale();
  const tr = (text: string) => translateText(text, locale);
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [input, setInput] = useState(() => readMessageDraft(currentUser.id, conversation.id));
  const [draftStored, setDraftStored] = useState(true);
  const [pendingDrafts, setPendingDrafts] = useState(() => readPendingMessages(currentUser.id, conversation.id));
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [reactionFor, setReactionFor] = useState<string | null>(null);
  const [reactionPending, setReactionPending] = useState<string | null>(null);
  const [newMessages, setNewMessages] = useState(0);
  const [atBottom, setAtBottom] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const active = useRef(true);
  const sendingRef = useRef(false);
  const reactionBusy = useRef(false);
  const draftRevision = useRef(0);
  const composing = useRef(false);
  const forceScroll = useRef(true);
  const knownIds = useRef(new Set<string>());
  const readInFlight = useRef(false);
  const readIds = useRef(new Set<string>());
  const markReadRef = useRef<() => void>(() => {});
  const other = conversation.otherUser;
  const blocked = !!blockedUserIds?.includes(other.id);
  const dateLocale = locale === 'en' ? 'en-US' : locale === 'zh-Hant' ? 'zh-TW' : 'zh-CN';

  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  useEffect(() => {
    const sync = () => { setPendingDrafts(readPendingMessages(currentUser.id, conversation.id)); };
    window.addEventListener('baylink:message-draft-updated', sync);
    return () => { window.removeEventListener('baylink:message-draft-updated', sync); };
  }, [currentUser.id, conversation.id]);
  const writeDraft = (text: string) => {
    setInput(text);
    setDraftStored(saveMessageDraft(currentUser.id, conversation.id, text));
  };

  const markRead = useCallback(async () => {
    if (!active.current || loading || loadError || readInFlight.current || document.visibilityState !== 'visible' || !isNearMessageBottom(scrollRef.current)) return;
    const batches = messageReadBatches(messages, readIds.current);
    if (!batches.length) return;
    readInFlight.current = true;
    let succeeded = false;
    try {
      for (const batch of batches) {
        if (!active.current || document.visibilityState !== 'visible' || !isNearMessageBottom(scrollRef.current)) return;
        await api.request(`/conversations/${conversation.id}/read`, { method: 'POST', body: JSON.stringify({ messageId: batch[batch.length - 1], messageIds: batch }) });
        if (!active.current) return;
        batch.forEach(id => readIds.current.add(id));
        window.dispatchEvent(new Event('baylink:messages-read'));
      }
      succeeded = true;
    } catch { /* Retry on the next actual read, reconnect or visibility change. */ }
    finally {
      readInFlight.current = false;
      if (active.current && succeeded) markReadRef.current();
    }
  }, [conversation.id, messages, loading, loadError]);
  useEffect(() => { markReadRef.current = () => { void markRead(); }; void markRead(); }, [markRead]);

  useEffect(() => {
    let cancelled = false;
    let inFlight = false;
    const controller = new AbortController();
    const load = async (initial = false) => {
      if (inFlight || cancelled || (!initial && document.visibilityState === 'hidden')) return;
      inFlight = true;
      if (initial) { setLoading(true); setLoadError(null); }
      try {
        const data = await api.request(`/conversations/${conversation.id}/messages`, { signal: controller.signal });
        if (!Array.isArray(data)) throw new Error('消息响应格式异常');
        const history = data.map(readServerMessage).filter((message): message is Message => !!message && (!message.conversationId || message.conversationId === conversation.id));
        if (cancelled) return;
        const unseen = history.filter(message => !knownIds.current.has(message.id) && message.senderId !== currentUser.id);
        if (!initial && unseen.length) {
          if (isNearMessageBottom(scrollRef.current) && document.visibilityState === 'visible') forceScroll.current = true;
          else setNewMessages(count => count + unseen.length);
        }
        history.forEach(message => knownIds.current.add(message.id));
        setMessages(previous => mergeMessages(previous, history));
        setLoadError(null);
      } catch (error) {
        if (!cancelled && initial) setLoadError(friendlyErrorMessage(error, '消息加载失败，请重试。'));
      } finally { inFlight = false; if (!cancelled && initial) setLoading(false); }
    };
    void load(true);
    const resume = () => { void load(); markReadRef.current(); };
    const interval = window.setInterval(resume, 15000);
    document.addEventListener('visibilitychange', resume);
    window.addEventListener('online', resume);
    socket?.on('connect', resume);
    return () => { cancelled = true; controller.abort(); window.clearInterval(interval); document.removeEventListener('visibilitychange', resume); window.removeEventListener('online', resume); socket?.off('connect', resume); };
  }, [conversation.id, currentUser.id, retryKey, socket]);

  useEffect(() => {
    if (!socket) return;
    const handleNewMessage = (value: unknown) => {
      const message = readServerMessage(value);
      if (!message || message.conversationId !== conversation.id || !active.current) return;
      if (!knownIds.current.has(message.id)) {
        knownIds.current.add(message.id);
        if (isNearMessageBottom(scrollRef.current) && document.visibilityState === 'visible') forceScroll.current = true;
        else if (message.senderId !== currentUser.id) setNewMessages(count => count + 1);
      }
      setMessages(previous => mergeMessages(previous, [message]));
    };
    const handleUpdatedMessage = (value: unknown) => {
      const message = readServerMessage(value);
      if (message?.conversationId === conversation.id && active.current) setMessages(previous => previous.some(item => item.id === message.id) ? mergeMessages(previous, [message]) : previous);
    };
    socket.on('new_message', handleNewMessage);
    socket.on('message_updated', handleUpdatedMessage);
    return () => { socket.off('new_message', handleNewMessage); socket.off('message_updated', handleUpdatedMessage); };
  }, [socket, conversation.id, currentUser.id]);

  useLayoutEffect(() => {
    if (!loading && forceScroll.current && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      forceScroll.current = false;
      setAtBottom(true);
      if (document.visibilityState === 'visible') setNewMessages(0);
    }
  }, [messages, loading]);
  useLayoutEffect(() => {
    if (inputRef.current) { inputRef.current.style.height = 'auto'; inputRef.current.style.height = `${Math.min(inputRef.current.scrollHeight, 144)}px`; }
  }, [input]);
  const jumpToLatest = () => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    setAtBottom(true); setNewMessages(0); markReadRef.current();
  };
  const handleScroll = () => {
    const bottom = isNearMessageBottom(scrollRef.current);
    setAtBottom(bottom);
    if (bottom && document.visibilityState === 'visible') { setNewMessages(0); markReadRef.current(); }
  };

  const send = async (type: Message['type'], content: string) => {
    if (sendingRef.current || !active.current || loading || loadError || blocked) return;
    const submitted = type === 'text' ? content.trim() : content;
    if (!submitted && type === 'text') return;
    const quoted = type === 'text' && replyTo && isReplyable(replyTo) ? replyTo : null;
    const optimistic: DisplayMessage = { id: `local:${crypto.randomUUID()}`, senderId: currentUser.id, conversationId: conversation.id, type, content: submitted, createdAt: Date.now(), delivery: 'sending', ...(quoted ? { replyTo: { id: quoted.id, senderId: quoted.senderId, content: quoted.content } } : {}) };
    const backupStored = type !== 'text' || savePendingMessage(currentUser.id, conversation.id, { id: optimistic.id, content, createdAt: optimistic.createdAt });
    const revision = draftRevision.current;
    forceScroll.current = true;
    setMessages(previous => [...previous, optimistic]);
    if (type === 'text') { writeDraft(''); setReplyTo(null); }
    if (!backupStored) setDraftStored(false);
    setEmojiOpen(false); sendingRef.current = true; setSending(true);
    try {
      const response = await api.request(`/conversations/${conversation.id}/messages`, { method: 'POST', body: JSON.stringify({ type, content: submitted, ...(quoted ? { replyToId: quoted.id } : {}) }) });
      const saved = readServerMessage(response);
      const validAck = saved && (!saved.conversationId || saved.conversationId === conversation.id);
      if (validAck && type === 'text') removePendingMessage(currentUser.id, conversation.id, optimistic.id);
      if (!active.current) return;
      if (validAck) {
        knownIds.current.add(saved.id);
        setMessages(previous => mergeMessages(previous, [saved], optimistic.id));
      } else {
        const history = await api.request(`/conversations/${conversation.id}/messages`);
        if (!Array.isArray(history)) throw new Error('暂时无法确认发送结果，请刷新消息。');
        if (active.current) {
          setMessages(previous => mergeMessages(previous, history.map(readServerMessage).filter((message): message is Message => !!message && (!message.conversationId || message.conversationId === conversation.id)), optimistic.id));
          setPendingDrafts(readPendingMessages(currentUser.id, conversation.id));
        }
      }
      if (active.current) window.dispatchEvent(new Event('baylink:messages-changed'));
    } catch (error) {
      if (!active.current) return;
      setMessages(previous => previous.map(message => message.id === optimistic.id ? { ...message, delivery: 'failed' } : message));
      if (type === 'text' && draftRevision.current === revision) { writeDraft(content); setReplyTo(quoted); }
      showToast?.(friendlyErrorMessage(error, '发送未确认，请刷新消息后再试。'), 'error');
    } finally { if (active.current) { sendingRef.current = false; setSending(false); } }
  };

  const reactTo = async (message: DisplayMessage, emoji: MessageReaction) => {
    if (reactionBusy.current || !active.current || !isReplyable(message) || blocked) return;
    reactionBusy.current = true; setReactionPending(message.id); setReactionFor(null);
    const selected = message.reactions?.some(reaction => reaction.emoji === emoji && reaction.userIds.includes(currentUser.id));
    try {
      const response = await api.request(`/conversations/${conversation.id}/messages/${encodeURIComponent(message.id)}/reaction`, { method: 'PUT', body: JSON.stringify({ emoji: selected ? null : emoji }) });
      if (!active.current) return;
      const saved = readServerMessage(response);
      if (!saved || saved.id !== message.id || (saved.conversationId && saved.conversationId !== conversation.id)) throw new Error('回应暂时未保存，请重试。');
      setMessages(previous => mergeMessages(previous, [saved]));
    } catch (error) { if (active.current) showToast?.(friendlyErrorMessage(error, '回应暂时未保存，请重试。'), 'error'); }
    finally { if (active.current) { reactionBusy.current = false; setReactionPending(null); } }
  };
  const insertEmoji = (emoji: string) => {
    const start = inputRef.current?.selectionStart ?? input.length;
    const end = inputRef.current?.selectionEnd ?? input.length;
    const next = (input.slice(0, start) + emoji + input.slice(end)).slice(0, 2000);
    draftRevision.current += 1; writeDraft(next); setEmojiOpen(false);
    requestAnimationFrame(() => { if (active.current) { inputRef.current?.focus(); inputRef.current?.setSelectionRange(start + emoji.length, start + emoji.length); } });
  };
  const senderName = (id: string) => id === currentUser.id ? currentUser.nickname : other.nickname;

  return (
    <ModalShell onClose={onClose} closeOnBackdrop={false} labelledBy="modern-chat-title" className="modern-chat-overlay">
      <section className="modern-chat" data-profile-theme={other.profileTheme || 'bay'}>
        <header className="modern-chat-header">
          <button type="button" onClick={onClose} className="modern-chat-icon" aria-label="返回"><ChevronLeft size={21} /></button>
          <button type="button" onClick={() => onViewProfile?.(other.id)} disabled={!onViewProfile} className="modern-chat-person" translate="no" aria-label={`${tr('查看资料')} · ${other.nickname}`}>
            <Avatar src={other.avatar} name={other.nickname} theme={other.profileTheme} size={11} />
            <span className="modern-chat-person-copy"><span className="modern-chat-name"><strong id="modern-chat-title" translate="no">{other.nickname}</strong><TrustBadge user={other} size={12} adminCompact /></span><span className="modern-chat-status" translate="no">{other.statusText || other.city || tr('在湾区，认识一个新邻居。')}</span></span>
          </button>
          {onToggleBlockUser && <button type="button" onClick={() => onToggleBlockUser(other.id)} className="modern-chat-icon" title={blocked ? '取消屏蔽' : '屏蔽用户'} aria-label={blocked ? '取消屏蔽' : '屏蔽用户'}><UserX size={17} /></button>}
        </header>
        {isPlatformAdmin(other) && <p className="modern-chat-admin">BAYLINK 管理员不会主动索要密码、验证码或付款信息。</p>}
        {(conversation.lastPostId || conversation.lastPostTitle) && <div className="modern-chat-context"><FileText size={17} aria-hidden="true" /><span>正在沟通</span>{conversation.lastPostId ? <Link to={`/posts/${encodeURIComponent(conversation.lastPostId)}`} onClick={onClose}><span translate="no">{conversation.lastPostTitle || tr('查看关联帖子')}</span></Link> : <strong translate="no">{conversation.lastPostTitle}</strong>}</div>}
        <div className="modern-chat-history" ref={scrollRef} onScroll={handleScroll} role="region" aria-label="聊天记录" tabIndex={0}>
          {loading && <p role="status" className="modern-chat-notice">正在加载消息…</p>}
          {loadError && <div role="alert" className="modern-chat-notice"><p>{loadError}</p><button type="button" onClick={() => setRetryKey(key => key + 1)}>重新加载</button></div>}
          {pendingDrafts.filter(draft => !messages.some(message => message.id === draft.id)).map(draft => <div className="modern-chat-pending" key={draft.id}>
            <p>还有一条发送结果未确认的消息。先刷新核实，避免重复发送。</p>
            <details><summary>未确认消息原文</summary><p translate="no">{draft.content}</p></details>
            <div><button type="button" onClick={() => setRetryKey(key => key + 1)}>刷新消息</button><button type="button" disabled={!!input} title={input ? '请先保存或发送当前草稿，再恢复这条消息。' : undefined} onClick={() => { if (!input) { draftRevision.current += 1; writeDraft(draft.content); inputRef.current?.focus(); } }}>恢复未确认消息</button><button type="button" onClick={() => { removePendingMessage(currentUser.id, conversation.id, draft.id); }}>删除本机副本</button></div>
          </div>)}
          {!loading && !loadError && messages.length === 0 && <div className="modern-chat-welcome"><Avatar src={other.avatar} name={other.nickname} theme={other.profileTheme} size={18} /><h2>一句你好，开启新的联系。</h2><p>聊聊你感兴趣的好物，或一个想请教的小问题。</p><button type="button" disabled={blocked} onClick={() => { draftRevision.current += 1; writeDraft(tr('你好！很高兴认识你 👋')); inputRef.current?.focus(); }}><MessageCircle size={16} />写一句招呼</button></div>}
          {messages.map((message, index) => {
            const mine = message.senderId === currentUser.id;
            const isContactCard = message.messageType === 'contact_card' || message.type === 'contact_card';
            const date = new Date(message.createdAt);
            const newDay = index === 0 || date.toDateString() !== new Date(messages[index - 1].createdAt).toDateString();
            const showAvatar = !mine && (index === 0 || messages[index - 1].senderId !== message.senderId || newDay);
            return <div className="modern-chat-message-group" key={message.id}>
              {newDay && <div className="modern-chat-day"><time dateTime={date.toISOString()}>{new Intl.DateTimeFormat(dateLocale, { month: 'short', day: 'numeric', weekday: 'short', ...(date.getFullYear() !== new Date().getFullYear() ? { year: 'numeric' } : {}) }).format(date)}</time></div>}
              <article className={`modern-chat-message ${mine ? 'is-mine' : ''}`} data-message-id={message.id} aria-label={new Intl.DateTimeFormat(dateLocale, { hour: 'numeric', minute: '2-digit' }).format(date)}>
                {!mine && <div className="modern-chat-avatar">{showAvatar && <Avatar src={other.avatar} name={other.nickname} theme={other.profileTheme} size={8} />}</div>}
                <div className="modern-chat-message-content">
                  {isContactCard && message.contactCard?.methods?.length ? <ContactCardMessage methods={message.contactCard.methods} isMine={mine} onCopied={(text, type) => showToast?.(text, type)} /> : <div className="modern-chat-bubble">
                    {message.replyTo && <blockquote className="modern-chat-quote" translate="no"><strong>{senderName(message.replyTo.senderId)}</strong><span>{message.replyTo.content}</span></blockquote>}
                    <p translate={message.content ? 'no' : undefined}>{messageText(message)}</p>
                    {message.delivery === 'sending' && <p className="modern-chat-delivery">发送中…</p>}
                    {message.delivery === 'failed' && <div className="modern-chat-delivery is-failed"><p>发送未确认，请刷新后确认是否送达。</p><button type="button" onClick={() => setRetryKey(key => key + 1)}>刷新消息</button>{message.type === 'text' && !input && <button type="button" onClick={() => { draftRevision.current += 1; writeDraft(message.content); }}>放回输入框</button>}</div>}
                  </div>}
                  <div className="modern-chat-message-footer"><time dateTime={date.toISOString()}>{new Intl.DateTimeFormat(dateLocale, { hour: 'numeric', minute: '2-digit' }).format(date)}</time>{isReplyable(message) && !blocked && <div className="modern-chat-message-actions"><button type="button" aria-label="引用回复" title="引用回复" onClick={() => { draftRevision.current += 1; setReplyTo(message); setReactionFor(null); inputRef.current?.focus(); }}><Reply size={14} /></button><button type="button" aria-label="添加回应" title="添加回应" aria-expanded={reactionFor === message.id} disabled={!!reactionPending} onClick={() => setReactionFor(reactionFor === message.id ? null : message.id)}>{reactionPending === message.id ? <Loader2 size={14} className="animate-spin" /> : <SmilePlus size={14} />}</button></div>}</div>
                  {message.reactions?.some(reaction => reaction.userIds.length) && <div className="modern-chat-reactions" aria-label="消息回应">{message.reactions.filter(reaction => reaction.userIds.length).map(reaction => <button type="button" key={reaction.emoji} translate="no" aria-label={`${reaction.emoji} · ${reaction.userIds.length}`} aria-pressed={reaction.userIds.includes(currentUser.id)} disabled={!!reactionPending || blocked || !isReplyable(message)} onClick={() => void reactTo(message, reaction.emoji as MessageReaction)}><span>{reaction.emoji}</span><span>{reaction.userIds.length}</span></button>)}</div>}
                  {reactionFor === message.id && <div className="modern-chat-reaction-picker" role="group" aria-label="选择回应表情">{MESSAGE_REACTIONS.map(emoji => <button type="button" key={emoji} translate="no" aria-label={emoji} onClick={() => void reactTo(message, emoji)}>{emoji}</button>)}<button type="button" aria-label="关闭回应选择" onClick={() => setReactionFor(null)}><X size={14} /></button></div>}
                </div>
              </article>
            </div>;
          })}
        </div>
        {(!atBottom || newMessages > 0) && <button type="button" className="modern-chat-jump" onClick={jumpToLatest}><ArrowDown size={15} />{newMessages ? <><span>新消息</span><span translate="no">{newMessages}</span></> : <span>回到最新消息</span>}</button>}
        <div className="modern-chat-composer">
          {blocked && <p className="modern-chat-blocked">已屏蔽此用户。取消屏蔽后可继续发送。</p>}
          {replyTo && <div className="modern-chat-reply-preview"><Reply size={17} /><div><span>回复给</span> <strong translate="no">{senderName(replyTo.senderId)}</strong><p translate="no">{replyTo.content}</p></div><button type="button" aria-label="取消引用回复" onClick={() => setReplyTo(null)}><X size={18} /></button></div>}
          {emojiOpen && <div className="modern-chat-emoji-picker" role="group" aria-label="选择消息表情">{COMPOSER_EMOJI.map(emoji => <button type="button" key={emoji} aria-label={emoji} translate="no" onClick={() => insertEmoji(emoji)}>{emoji}</button>)}</div>}
          <div className="modern-chat-compose-row">
            <button type="button" className="modern-chat-icon" disabled={blocked} aria-label="插入表情" aria-expanded={emojiOpen} onClick={() => setEmojiOpen(!emojiOpen)}><SmilePlus size={21} /></button>
            <textarea ref={inputRef} rows={1} className="modern-chat-input" placeholder={tr('写点什么，聊聊吧…')} aria-label={tr('消息内容')} translate="no" maxLength={2000} value={input} disabled={blocked} onChange={event => { draftRevision.current += 1; writeDraft(event.target.value); }} onCompositionStart={() => { composing.current = true; }} onCompositionEnd={() => { composing.current = false; }} onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey && !composing.current && !event.nativeEvent.isComposing && event.nativeEvent.keyCode !== 229) { event.preventDefault(); void send('text', input); } }} />
            <button type="button" className="modern-chat-send" disabled={!input.trim() || sending || loading || !!loadError || blocked} aria-label="发送消息" onClick={() => void send('text', input)}>{sending ? <Loader2 size={19} className="animate-spin" /> : <Send size={19} />}</button>
          </div>
          <div className="modern-chat-compose-meta"><button type="button" onClick={async () => { if (await confirmDialog({ title: '分享联系方式', message: '确定向对方分享你的联系方式？', confirmText: '分享' })) void send('contact-share', ''); }} disabled={sending || loading || !!loadError || blocked}><Phone size={13} />分享联系方式</button><span className="modern-chat-key-hint"><CornerDownLeft size={12} />Enter 发送 · Shift + Enter 换行</span><span translate="no">{input.length}/2000</span></div>
          <p className={`modern-chat-draft-note ${draftStored ? '' : 'is-error'}`} role="status">{draftStored ? '草稿仅保存在当前浏览器会话。' : '浏览器未能保存草稿，关闭前请先复制。'}</p>
        </div>
      </section>
    </ModalShell>
  );
};
