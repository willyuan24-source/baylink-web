// 「我的」页路由包装
import { useApp } from '../app/context';
import { ProfileView } from '../features/profile/ProfileView';

export default function ProfilePage() {
  const { user, setUser, setShowLogin, handleLogout, navigateToPost, showToast, openBlockedUsersModal } = useApp();
  return (
    <ProfileView
      user={user}
      onLogin={() => setShowLogin(true)}
      onLogout={handleLogout}
      onOpenPost={navigateToPost}
      onUpdateUser={setUser}
      showToast={showToast}
      onOpenBlockedUsers={openBlockedUsersModal}
    />
  );
}
