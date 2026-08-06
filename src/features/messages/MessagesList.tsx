// 会话列表
import { useState, useEffect } from 'react';
import { MessageCircle, ChevronRight } from 'lucide-react';
import { api } from '../../lib/api';
import Avatar from '../../components/Avatar';
import { TrustBadge } from '../../components/TrustBadge';
import { formatChineseDate } from '../../lib/format';
import type { Conversation, UserData } from '../../lib/types';

export const MessagesList = ({ currentUser, onOpenChat, onOpenProfile }: { currentUser: UserData | null; onOpenChat: (conv: Conversation) => void; onOpenProfile?: (userId: string) => void }) => {
  const [convs, setConvs] = useState<Conversation[]>([]);
  useEffect(() => { if (!currentUser) return; const load = async () => { try { const res = await api.request('/conversations'); if (Array.isArray(res)) setConvs(res); } catch {} }; load(); const i = setInterval(load, 5000); return () => clearInterval(i); }, [currentUser]);
  if (!currentUser) return (
    <div className="flex-1 flex flex-col items-center justify-center p-8 text-center w-full min-h-[300px] bg-baylink-bg">
      <div className="surface-card w-20 h-20 rounded-full flex items-center justify-center mb-4"><MessageCircle size={32} className="text-baylink-muted" /></div>
      <h3 className="font-semibold text-baylink-text mb-2">请先登录</h3>
    </div>
  );
  return (
    <div className="flex-1 overflow-y-auto p-4 pb-24 w-full bg-baylink-bg">
      {convs.length > 0 ? (
        <div className="space-y-3">
          {convs.map(c => (
            <div
              key={c.id}
              onClick={() => onOpenChat(c)}
              className="surface-card flex min-h-[72px] items-center gap-3.5 p-4 cursor-pointer transition hover:border-baylink-green/15 active:scale-[0.99]"
            >
              <div onClick={(e) => { e.stopPropagation(); onOpenProfile?.(c.otherUser.id); }} className="shrink-0 cursor-pointer">
                <Avatar src={c.otherUser.avatar} name={c.otherUser.nickname} size={12} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-start gap-2 mb-0.5">
                  <span
                    onClick={(e) => { e.stopPropagation(); onOpenProfile?.(c.otherUser.id); }}
                    className="text-[17px] font-semibold text-baylink-text flex items-center gap-1 cursor-pointer hover:text-baylink-green truncate"
                  >
                    {c.otherUser.nickname} <TrustBadge user={c.otherUser} size={12} />
                  </span>
                  <span className="type-footnote shrink-0">{formatChineseDate(c.updatedAt)}</span>
                </div>
                <p className="text-[14px] text-baylink-text-secondary truncate">{c.lastMessage || '点击开始聊天'}</p>
              </div>
              <ChevronRight size={16} className="text-baylink-muted opacity-50 shrink-0" />
            </div>
          ))}
        </div>
      ) : (
        <div className="surface-card mx-1 mt-8 px-6 py-10 text-center">
          <MessageCircle size={28} className="mx-auto mb-3 text-baylink-green/60" />
          <p className="text-[17px] font-semibold text-baylink-text">还没有消息</p>
          <p className="mt-2 text-[14px] leading-relaxed text-baylink-text-secondary">看到合适的房源、二手或服务，可以点「私信」开始沟通。</p>
        </div>
      )}
    </div>
  );
};
