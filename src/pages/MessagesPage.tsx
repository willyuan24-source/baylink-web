// 消息页：联系方式请求收件箱 + 会话列表（/messages/:threadId 时主区留空，聊天由布局层覆盖渲染）
import { Link, useParams } from 'react-router-dom';
import { MessageCircle, LockKeyhole, ArrowLeft } from 'lucide-react';
import { api } from '../lib/api';
import { useApp } from '../app/context';
import { ContactRequestInboxPanel } from '../components/ContactRequestInboxPanel';
import { MessagesList } from '../features/messages/MessagesList';

export default function MessagesPage() {
  const { threadId } = useParams();
  const {
    user, showToast, openChat, openConversation, openUserProfile, openPostById, setShowLogin,
    contactRequestRefreshKey, setContactRequestRefreshKey, setPendingContactRequestCount,
    chatRouteStatus, chatRouteError, retryChatRoute,
  } = useApp();

  if (threadId) {
    if (user && chatRouteStatus === 'ready') return null;
    const title = !user ? '登录后查看这段对话'
      : chatRouteStatus === 'not-found' ? '无法打开这段对话'
        : chatRouteStatus === 'error' ? '对话加载失败' : '正在加载对话…';
    const description = !user ? '登录你的 BAYLINK 账号后继续。'
      : chatRouteStatus === 'not-found' ? '对话不存在，或当前账号无法访问。'
        : chatRouteStatus === 'error' ? chatRouteError || '请检查网络后重试。' : '正在安全读取你的会话。';
    return (
      <div className="member-route-state">
        <div className="member-empty-card">
          <span className="member-empty-icon"><LockKeyhole size={30} aria-hidden="true" /></span>
          <h1>{title}</h1>
          <p>{description}</p>
          <div className="mt-5 flex flex-wrap justify-center gap-3">
            {!user && <button type="button" onClick={() => setShowLogin(true)} className="member-primary">登录 / 注册</button>}
            {user && chatRouteStatus === 'error' && <button type="button" onClick={retryChatRoute} className="member-primary">重试</button>}
            <Link to="/messages" className="member-secondary"><ArrowLeft size={15} aria-hidden="true" />返回消息列表</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="member-messages-page">
      <div className="member-page-heading">
        <div><span className="member-eyebrow">STAY CONNECTED</span><h1>消息</h1><p>每一段湾区生活，从一句你好开始。</p></div>
        <span className="member-heading-icon"><MessageCircle size={24} aria-hidden="true" /></span>
      </div>
      {user && (
        <ContactRequestInboxPanel
          key={user.id}
          refreshKey={contactRequestRefreshKey}
          fetchPending={async () => {
            const res = await api.getContactRequests('owner', 'pending');
            return res.requests || [];
          }}
          onApprove={async (id) => { await api.approveContactRequest(id); setContactRequestRefreshKey((k) => k + 1); }}
          onDecline={async (id) => { await api.declineContactRequest(id); setContactRequestRefreshKey((k) => k + 1); }}
          onOpenChat={(targetId, nickname, postTitle) => openChat(targetId, nickname, postTitle)}
          onOpenPost={openPostById}
          showToast={showToast}
          onCountChange={setPendingContactRequestCount}
        />
      )}
      <MessagesList currentUser={user} onOpenChat={openConversation} onOpenProfile={openUserProfile} onLoginNeeded={() => setShowLogin(true)} />
    </div>
  );
}
