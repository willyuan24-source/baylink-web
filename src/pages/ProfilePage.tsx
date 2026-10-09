// 「我的」页路由包装: the hub reads the header's unread count, so 消息 shows the same number as the badge (G1).
import { useApp } from '../app/context';
import { ProfileView } from '../features/profile/ProfileView';

export default function ProfilePage() {
  const { user, setUser, setShowLogin, handleLogout, clearAccountSession, navigateToPost, showToast, openBlockedUsersModal, messagesBadgeCount } = useApp();
  return (
    <ProfileView
      user={user}
      onLogin={() => setShowLogin(true)}
      onLogout={handleLogout}
      onSessionEnded={clearAccountSession || handleLogout}
      onOpenPost={navigateToPost}
      onUpdateUser={setUser}
      showToast={showToast}
      onOpenBlockedUsers={openBlockedUsersModal}
      messagesCount={messagesBadgeCount}
    />
  );
}
