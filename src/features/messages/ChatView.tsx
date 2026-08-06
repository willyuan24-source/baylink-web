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

export const ChatView = ({ currentUser, conversation, onClose, socket, onViewProfile, onToggleBlockUser, blockedUserIds, showToast }: any) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await api.request(`/conversations/${conversation.id}/messages`);
        setMessages(data);
      } catch {}
    };
    load();
  }, [conversation.id]);

  useEffect(() => {
    if (!socket) return;
    const handleNewMessage = (msg: Message) => {
      if (msg.conversationId === conversation.id) {
        setMessages(prev => [...prev, msg]);
      }
    };
    socket.on('new_message', handleNewMessage);
    return () => { socket.off('new_message', handleNewMessage); };
  }, [socket, conversation.id]);

  useEffect(() => {
    scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight);
  }, [messages]);

  const send = async (type: Message['type'], content: string) => {
    if (sending) return;
    if (!content && type === 'text') return;
    const optimisticMsg: Message = { id: Date.now().toString(), senderId: currentUser.id, conversationId: conversation.id, type, content, createdAt: Date.now() };
    const prevInput = input;
    setMessages(prev => [...prev, optimisticMsg]);
    if (type === 'text') setInput('');
    setSending(true);
    try {
      await api.request(`/conversations/${conversation.id}/messages`, { method: 'POST', body: JSON.stringify({ type, content }) });
    } catch (err: any) {
      setMessages(prev => prev.filter((m) => m.id !== optimisticMsg.id));
      if (type === 'text') setInput(prevInput);
      showToast?.(friendlyErrorMessage(err, '发送失败，请稍后再试'), 'error');
    } finally {
      setSending(false);
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
                  {m.content}
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div className="border-t border-black/[0.06] px-3 pt-2.5 pb-safe-bar flex gap-2.5 items-center bg-white/80 backdrop-blur-xl shrink-0">
        <button
          type="button"
          onClick={async () => { if (await confirmDialog({ title: '分享联系方式', message: '确定向对方分享你的联系方式？', confirmText: '分享' })) send('contact-share', ''); }}
          disabled={sending}
          className="shrink-0 rounded-full border border-black/[0.06] bg-baylink-section/50 p-2.5 text-baylink-text-secondary transition hover:bg-baylink-section active:scale-95 disabled:opacity-50"
          aria-label="分享联系方式"
        >
          <Phone size={18} />
        </button>
        <input
          className="flex-1 bg-white border border-black/[0.06] rounded-full px-5 py-3 outline-none text-[15px] text-baylink-text placeholder:text-baylink-muted focus:border-baylink-green/40 focus:ring-2 focus:ring-baylink-green/15"
          placeholder="输入消息..."
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !sending && input.trim() && send('text', input)}
        />
        <button
          type="button"
          onClick={() => send('text', input)}
          disabled={!input.trim() || sending}
          className={`shrink-0 p-3 rounded-full text-white transition active:scale-90 disabled:opacity-50 ${input.trim() && !sending ? 'bg-baylink-green shadow-rest hover:bg-baylink-green-hover' : 'bg-baylink-border'}`}
          aria-label="发送消息"
        >
          {sending ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
        </button>
      </div>
    </ModalShell>
  );
};
