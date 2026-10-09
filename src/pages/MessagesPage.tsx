// 消息 /messages: three round entries (联系请求 · 小队 · 预约), a notifications-off prompt, contact requests and the
// conversation list. /messages/:threadId keeps the main area for the route states; the thread itself is the
// layout's ChatView overlay.
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { CalendarCheck, UserPlus, Users } from 'lucide-react';
import { api } from '../lib/api';
import { useApp } from '../app/context';
import { ContactRequestInboxPanel } from '../components/ContactRequestInboxPanel';
import { PageHeader } from '../components/ui/HeroCard';
import { Button } from '../components/ui/Button';
import { EmptyState, ErrorState } from '../components/ui/States';
import { SkeletonFeed } from '../components/ui/SkeletonCard';
import { useUiCopy } from '../components/ui/ui-copy';
import { MessagesList } from '../features/messages/MessagesList';
import { useAnyReminderOn } from '../features/profile/notification-settings';
import { readerError } from '../features/messages/reader-error';
import '../features/messages/messages-hub.css';

function ThreadRouteState() {
  const { t, locale } = useUiCopy();
  const { user, setShowLogin, chatRouteStatus, chatRouteError, retryChatRoute } = useApp();
  const back = <Button variant="text" to="/messages">{t('返回消息列表', 'Back to messages')}</Button>;
  return <div className="msg-state">
    {!user ? <EmptyState title={t('登录后查看这段对话', 'Sign in to view this conversation')} body={t('登录你的 BAYLINK 账号后继续。', 'Log in to your BAYLINK account to continue.')}
      actions={<><Button variant="primary" onClick={() => setShowLogin(true)}>{t('登录 / 注册', 'Log in / Sign up')}</Button>{back}</>} />
      : chatRouteStatus === 'not-found' ? <EmptyState title={t('无法打开这段对话', 'Unable to open this conversation')} body={t('对话不存在，或当前账号无法访问。', "This conversation doesn't exist, or your current account can't access it.")} actions={back} />
        : chatRouteStatus === 'error' ? <ErrorState title={t('对话加载失败', 'Conversation failed to load')} body={readerError(chatRouteError || '', locale, '') || t('请检查网络后重试。', 'Check your connection and try again.')} onRetry={retryChatRoute} homeTo="/messages" />
          : <div><p className="msg-note" role="status">{t('正在安全读取你的会话…', 'Opening your conversation…')}</p><SkeletonFeed rows count={3} /></div>}
  </div>;
}

export default function MessagesPage() {
  const { threadId } = useParams();
  const { t } = useUiCopy();
  const {
    user, showToast, openChat, openPostById, setShowLogin,
    contactRequestRefreshKey, setContactRequestRefreshKey, setPendingContactRequestCount,
    chatRouteStatus,
  } = useApp();
  const [pending, setPending] = useState<number | null>(null);
  const [requestsOpen, setRequestsOpen] = useState(false);
  const remindersOn = useAnyReminderOn(threadId ? undefined : user?.id);

  if (threadId) return user && chatRouteStatus === 'ready' ? null : <ThreadRouteState />;

  const openRequests = () => {
    setRequestsOpen(true);
    window.requestAnimationFrame?.(() => document.getElementById('contact-requests')?.scrollIntoView?.({ block: 'start', behavior: 'auto' }));
  };
  return (
    <div className="msg-hub">
      <PageHeader title={t('消息', 'Messages')} lede={user ? t('私信、联系方式请求，以及小队和预约的通知。', 'Private messages, contact requests, and group and booking updates.') : undefined} />
      {user && <ul className="msg-rounds" aria-label={t('消息分类', 'Message types')}>
        <li><button type="button" className="msg-round" aria-expanded={requestsOpen} aria-controls={requestsOpen || pending ? 'contact-requests' : undefined} onClick={openRequests}>
          <span className="msg-round__icon" aria-hidden="true"><UserPlus strokeWidth={1.75} /></span>
          <span className="msg-round__label">{t('联系请求', 'Contact requests')}</span>
          {!!pending && <b className="msg-round__count" aria-label={t(`${pending} 个待处理`, `${pending} waiting`)}>{pending > 99 ? '99+' : pending}</b>}
        </button></li>
        <li><Link className="msg-round" to="/together?view=mine">
          <span className="msg-round__icon" aria-hidden="true"><Users strokeWidth={1.75} /></span>
          <span className="msg-round__label">{t('小队', 'Groups')}</span>
        </Link></li>
        <li><Link className="msg-round" to="/me/bookings">
          <span className="msg-round__icon" aria-hidden="true"><CalendarCheck strokeWidth={1.75} /></span>
          <span className="msg-round__label">{t('预约', 'Bookings')}</span>
        </Link></li>
      </ul>}
      {user && remindersOn === false && <div className="msg-prompt" role="note">
        <p>{t('站外提醒未开启：有新私信时，不会收到邮件或短信。', 'Reminders are off: you will not get an email or text when a message arrives.')}</p>
        <Link to="/me?view=notifications">{t('去开启', 'Turn them on')}</Link>
      </div>}
      {user && (
        <ContactRequestInboxPanel
          key={`${user.id}:${user.token}`}
          id="contact-requests"
          refreshKey={contactRequestRefreshKey}
          expanded={requestsOpen}
          onExpandedChange={setRequestsOpen}
          showEmpty={requestsOpen}
          fetchPending={async () => {
            const res = await api.getContactRequests('owner', 'pending');
            return res.requests || [];
          }}
          onApprove={async (id) => { await api.approveContactRequest(id); setContactRequestRefreshKey((k) => k + 1); }}
          onDecline={async (id) => { await api.declineContactRequest(id); setContactRequestRefreshKey((k) => k + 1); }}
          onOpenChat={(targetId, nickname, postTitle) => openChat(targetId, nickname, postTitle)}
          onOpenPost={openPostById}
          showToast={showToast}
          onCountChange={(count) => { setPending(count); setPendingContactRequestCount(count); }}
        />
      )}
      <MessagesList currentUser={user} onLoginNeeded={() => setShowLogin(true)} />
    </div>
  );
}
