// 聊天全屏视图（socket 实时 + 乐观发送）
import { useState, useEffect, useRef } from 'react';
import { ChevronLeft, UserX, FileText, Phone, Send, Loader2 } from 'lucide-react';
import { api } from '../../lib/api';
import Avatar from '../../components/Avatar';
import { ModalShell } from '../../components/ui/Modal';
import { confirmDialog } from '../../components/ui/confirm';
import { TrustBadge } from '../../components/TrustBadge';
import { isPlatformAdmin } from '../../components/UserTrustBadges';
import { ContactCardMessage } from '../../components/ContactCardMessage';
import { friendlyErrorMessage } from '../../lib/format';
import type { Message } from '../../lib/types';
import type { Conversation, UserData } from '../../lib/types';
import type { Socket } from 'socket.io-client';
import { mergeMessages, messageText, readServerMessage, restoreFailedDraft, type DisplayMessage } from './messageState';

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

export const ChatView = (props: ChatViewProps) => (
  <ChatSession key={`${props.currentUser.id}:${props.conversation.id}`} {...props} />
);

const ChatSession = ({ currentUser, conversation, onClose, socket, onViewProfile, onToggleBlockUser, blockedUserIds, showToast }: ChatViewProps) => {
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const active = useRef(true);
  const sendingRef = useRef(false);
  const draftRevision = useRef(0);
  const composing = useRef(false);

  useEffect(() => {
    active.current = true;
    return () => { active.current = false; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    const load = async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const data = await api.request(`/conversations/${conversation.id}/messages`, { signal: controller.signal });
        if (!Array.isArray(data)) throw new Error('消息响应格式异常');
        const history = data.map(readServerMessage).filter((message): message is Message => !!message);
        if (!cancelled) setMessages(previous => mergeMessages(history, previous.filter(message => message.delivery !== 'failed')));
      } catch (error) {
        if (!cancelled) setLoadError(friendlyErrorMessage(error, '消息加载失败，请重试。'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => { cancelled = true; controller.abort(); };
  }, [conversation.id, retryKey]);

  useEffect(() => {
    if (!socket) return;
    const handleNewMessage = (value: unknown) => {
      const msg = readServerMessage(value);
      if (msg && msg.conversationId === conversation.id) {
        setMessages(prev => mergeMessages(prev, [msg]));
      }
    };
    socket.on('new_message', handleNewMessage);
    return () => { socket.off('new_message', handleNewMessage); };
  }, [socket, conversation.id]);

  useEffect(() => {
    scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight);
  }, [messages]);

  const send = async (type: Message['type'], content: string) => {
    if (sendingRef.current || !active.current || loading || loadError) return;
    const submittedContent = type === 'text' ? content.trim() : content;
    if (!submittedContent && type === 'text') return;
    const optimisticMsg: DisplayMessage = { id: `local:${crypto.randomUUID()}`, senderId: currentUser.id, conversationId: conversation.id, type, content: submittedContent, createdAt: Date.now(), delivery: 'sending' };
    const revision = draftRevision.current;
    setMessages(prev => [...prev, optimisticMsg]);
    if (type === 'text') setInput('');
    sendingRef.current = true;
    setSending(true);
    try {
      const response = await api.request(`/conversations/${conversation.id}/messages`, { method: 'POST', body: JSON.stringify({ type, content: submittedContent }) });
      if (!active.current) return;
      const saved = readServerMessage(response);
      if (saved) {
        setMessages(prev => mergeMessages(prev, [saved], optimisticMsg.id));
      } else {
        // Older API envelopes may not include the created message. Read back the server history.
        const history = await api.request(`/conversations/${conversation.id}/messages`);
        if (!Array.isArray(history)) throw new Error('暂时无法确认发送结果，请刷新消息。');
        if (active.current) setMessages(prev => mergeMessages(prev, history.map(readServerMessage).filter((message): message is Message => !!message), optimisticMsg.id));
      }
    } catch (err) {
      if (!active.current) return;
      setMessages(prev => prev.map(message => message.id === optimisticMsg.id ? { ...message, delivery: 'failed' } : message));
      if (type === 'text') setInput(current => restoreFailedDraft(current, content, draftRevision.current === revision));
      showToast?.(friendlyErrorMessage(err, '发送未确认，请刷新消息后再试。'), 'error');
    } finally {
      if (active.current) { sendingRef.current = false; setSending(false); }
    }
  };

  const chromeIconBtn = 'shrink-0 rounded-full bg-white/75 backdrop-blur-xl border border-black/[0.04] p-2 text-baylink-text shadow-rest transition hover:bg-white active:scale-95';

  return (
    <ModalShell onClose={onClose} closeOnBackdrop={false} label={`与 ${conversation.otherUser.nickname} 的对话`} className="fixed inset-0 bg-baylink-bg z-[100] flex flex-col">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-black/[0.06] bg-white/75 backdrop-blur-xl pt-safe-top shrink-0">
        <button type="button" onClick={onClose} className={chromeIconBtn} aria-label="返回"><ChevronLeft size={20} /></button>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="truncate text-[17px] font-semibold text-baylink-text">{conversation.otherUser.nickname}</span>
            <TrustBadge user={conversation.otherUser} size={11} showText adminCompact />
          </div>
        </div>
        <button type="button" onClick={() => onViewProfile?.(conversation.otherUser.id)} className="shrink-0 rounded-xl border border-black/[0.06] bg-white/80 px-2.5 py-1.5 text-[11px] font-semibold text-baylink-text hover:bg-baylink-section/60">
          查看资料
        </button>
        <button
          type="button"
          onClick={() => onToggleBlockUser?.(conversation.otherUser.id)}
          className="shrink-0 rounded-xl border border-black/[0.06] bg-white/80 px-2.5 py-1.5 text-baylink-text-secondary hover:bg-baylink-section/60"
          title={blockedUserIds?.includes(conversation.otherUser.id) ? '取消屏蔽' : '屏蔽用户'}
          aria-label={blockedUserIds?.includes(conversation.otherUser.id) ? '取消屏蔽' : '屏蔽用户'}
        >
          <UserX size={14} className="inline" />
        </button>
      </div>

      {isPlatformAdmin(conversation.otherUser) && (
        <div className="mx-4 mt-2 mb-0 rounded-xl border border-emerald-200/80 bg-emerald-50/80 px-3.5 py-2.5">
          <p className="text-[11px] leading-relaxed text-emerald-900">
            BAYLINK 管理员不会主动索要密码、验证码或付款信息。
          </p>
        </div>
      )}

      <div className="mx-4 mt-3 mb-1 flex items-center gap-2.5 rounded-2xl border border-baylink-green/10 bg-baylink-green/[0.08] px-3.5 py-2.5">
        <div className="shrink-0 rounded-lg bg-white/70 p-1.5 border border-baylink-green/10">
          <FileText size={14} className="text-baylink-green" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="type-caption text-baylink-muted">正在沟通</div>
          <div className="text-[13px] font-medium text-baylink-text line-clamp-1">{conversation.lastPostTitle || '互助需求沟通'}</div>
        </div>
        <span className="type-caption shrink-0 rounded-full border border-baylink-green/10 bg-white/70 px-2 py-0.5 text-baylink-text-secondary">交易前请核实</span>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2.5" ref={scrollRef}>
        {loading && <p role="status" className="text-center text-sm text-baylink-text-secondary">正在加载消息…</p>}
        {loadError && <div role="alert" className="surface-card p-4 text-sm text-baylink-text-secondary"><p>{loadError}</p><button type="button" onClick={() => setRetryKey(key => key + 1)} className="mt-2 font-semibold text-baylink-green">重新加载</button></div>}
        {!loading && !loadError && messages.length === 0 && <p className="py-6 text-center text-sm text-baylink-text-secondary">还没有聊天记录，可以先打个招呼。</p>}
        {messages.map((m, i) => {
          const isMine = m.senderId === currentUser.id;
          const nextMsg = messages[i + 1];
          const showOtherAvatar = !isMine && (!nextMsg || nextMsg.senderId === currentUser.id);
          const isContactCard = m.messageType === 'contact_card' || m.type === 'contact_card';
          return (
            <div key={m.id} className={`flex items-end gap-1.5 ${isMine ? 'justify-end' : 'justify-start'}`}>
              {!isMine && !isContactCard && (
                showOtherAvatar ? (
                  <Avatar
                    src={conversation.otherUser.avatar}
                    name={conversation.otherUser.nickname}
                    size={7}
                    className="shrink-0 self-end mb-1"
                  />
                ) : (
                  <div className="mb-1 w-7 h-7 shrink-0 self-end" aria-hidden />
                )
              )}
              {isContactCard && m.contactCard?.methods?.length ? (
                <ContactCardMessage
                  methods={m.contactCard.methods}
                  isMine={isMine}
                  onCopied={(msg, type) => showToast?.(msg, type)}
                />
              ) : (
                <div
                  className={`max-w-[75%] px-4 py-3 rounded-2xl text-[15px] leading-relaxed ${
                    isMine
                      ? 'bg-baylink-ink text-white shadow-rest rounded-tr-md'
                      : 'bg-white border border-black/[0.04] text-baylink-text shadow-rest rounded-tl-md'
                  }`}
                >
                  <p className="whitespace-pre-wrap break-words">{messageText(m)}</p>
                  {m.delivery === 'sending' && <p className="mt-1 text-xs opacity-80">发送中…</p>}
                  {m.delivery === 'failed' && <div className="mt-2 text-xs"><p>发送未确认，请刷新后确认是否送达。</p><button type="button" className="mt-1 underline" onClick={() => setRetryKey(key => key + 1)}>刷新消息</button>{m.type === 'text' && !input && <button type="button" className="ml-3 underline" onClick={() => { draftRevision.current += 1; setInput(m.content); }}>放回输入框</button>}</div>}
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div className="border-t border-black/[0.06] px-3 pt-2.5 pb-safe-bar flex gap-2.5 items-center bg-white/80 backdrop-blur-xl shrink-0">
        <button
          type="button"
          onClick={async () => { if (await confirmDialog({ title: '分享联系方式', message: '确定向对方分享你的联系方式？', confirmText: '分享' })) void send('contact-share', ''); }}
          disabled={sending || loading || !!loadError}
          className="shrink-0 rounded-full border border-black/[0.06] bg-baylink-section/50 p-2.5 text-baylink-text-secondary transition hover:bg-baylink-section active:scale-95 disabled:opacity-50"
          aria-label="分享联系方式"
        >
          <Phone size={18} />
        </button>
        <input
          className="flex-1 bg-white border border-black/[0.06] rounded-full px-5 py-3 outline-none text-[15px] text-baylink-text placeholder:text-baylink-muted focus:border-baylink-green/40 focus:ring-2 focus:ring-baylink-green/15"
          placeholder="输入消息..."
          aria-label="消息内容"
          maxLength={2000}
          value={input}
          onChange={e => { draftRevision.current += 1; setInput(e.target.value); }}
          onCompositionStart={() => { composing.current = true; }}
          onCompositionEnd={() => { composing.current = false; }}
          onKeyDown={e => { if (e.key === 'Enter' && !composing.current && !e.nativeEvent.isComposing && e.nativeEvent.keyCode !== 229) { e.preventDefault(); void send('text', input); } }}
        />
        <button
          type="button"
          onClick={() => send('text', input)}
          disabled={!input.trim() || sending || loading || !!loadError}
          className={`shrink-0 p-3 rounded-full text-white transition active:scale-90 disabled:opacity-50 ${input.trim() && !sending ? 'bg-baylink-green shadow-rest hover:bg-baylink-green-hover' : 'bg-baylink-border'}`}
          aria-label="发送消息"
        >
          {sending ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
        </button>
      </div>
    </ModalShell>
  );
};
