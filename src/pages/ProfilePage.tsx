// 「我的」页路由包装
import { useApp } from '../app/context';
import { ReadingPreferencesCard } from '../components/ReadingPreferences';
import { ProfileView } from '../features/profile/ProfileView';
import { NotificationPreferencesCard } from '../features/profile/NotificationPreferencesCard';
import './profile-page.css';

export default function ProfilePage() {
  const { user, setUser, setShowLogin, handleLogout, clearAccountSession, navigateToPost, showToast, openBlockedUsersModal } = useApp();
  return (
    <>
    <div className="member-profile-settings">
      <ReadingPreferencesCard />
      {user && <NotificationPreferencesCard key={`${user.id}:${user.token || ''}`} userId={user.id} />}
    </div>
    <ProfileView
      user={user}
      onLogin={() => setShowLogin(true)}
      onLogout={handleLogout}
      onSessionEnded={clearAccountSession || handleLogout}
      onOpenPost={navigateToPost}
      onUpdateUser={setUser}
      showToast={showToast}
      onOpenBlockedUsers={openBlockedUsersModal}
    />
    </>
  );
}
