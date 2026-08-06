// 消息页：联系方式请求收件箱 + 会话列表（/messages/:threadId 时主区留空，聊天由布局层覆盖渲染）
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../lib/api';
import { useApp } from '../app/context';
import { ContactRequestInboxPanel } from '../components/ContactRequestInboxPanel';
import { MessagesList } from '../features/messages/MessagesList';

export default function MessagesPage() {
  const navigate = useNavigate();
  const { threadId } = useParams();
  const {
    user, showToast, openChat, openConversation, openUserProfile,
    contactRequestRefreshKey, setContactRequestRefreshKey, setPendingContactRequestCount,
  } = useApp();

  if (threadId) return null;

  return (
    <div className="flex flex-col h-full w-full pb-[calc(env(safe-area-inset-bottom,0px)+6rem)] lg:pb-0 bg-baylink-bg">
      <div className="px-5 pt-safe-top pb-4 bg-white/75 backdrop-blur-xl sticky top-0 z-10 border-b border-black/[0.06]">
        <h2 className="type-page-title">消息</h2>
      </div>
      {user && (
        <ContactRequestInboxPanel
          refreshKey={contactRequestRefreshKey}
          fetchPending={async () => {
            const res = await api.getContactRequests('owner', 'pending');
            return res.requests || [];
          }}
          onApprove={async (id) => { await api.approveContactRequest(id); setContactRequestRefreshKey((k) => k + 1); }}
          onDecline={async (id) => { await api.declineContactRequest(id); setContactRequestRefreshKey((k) => k + 1); }}
          onOpenChat={(targetId, nickname, postTitle) => openChat(targetId, nickname, postTitle)}
          onOpenPost={(postId) => navigate(`/posts/${postId}`)}
          showToast={showToast}
          onCountChange={setPendingContactRequestCount}
        />
      )}
      <MessagesList currentUser={user} onOpenChat={openConversation} onOpenProfile={openUserProfile} />
    </div>
  );
}
