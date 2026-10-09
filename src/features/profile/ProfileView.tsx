// 我的 /me: profile header, the 2×2 tiles (消息 first, G1), settings, my exploration, profile checks and admin tools.
// Sub-views live in ?view= so 通知 and 隐私与账号 can be linked to directly (from /messages, emails, support).
import { useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { LogOut, Edit, BadgeCheck, Eye, UserX, ChevronLeft, ShieldCheck, Flag, Radar } from 'lucide-react';
import Avatar from '../../components/Avatar';
import { api } from '../../lib/api';
import { TrustBadge } from '../../components/TrustBadge';
import { OfficialVerificationModal } from '../../components/OfficialVerificationModal';
import {
  getJoinDays, getMyOfficialTrustLabel,
  getOfficialTypeLabel, getPhoneVerificationTrustLabel,
} from '../../lib/format';
import { usePlannerLibrary } from '../../lib/planner-library';
import type { UserData, PostData } from '../../lib/types';
import { AdminOfficialVerificationsView, AdminReportsView } from '../admin/AdminViews';
import { EditProfileModal } from './EditProfileModal';
import { InfoPage, MyPostsView } from './ProfileSubViews';
import { ProfileShareButton } from './ProfileIdentity';
import { useProfileSessionGuard } from './useProfileSessionGuard';
import { AdminSourceMonitor } from '../source-monitor/AdminSourceMonitor';
import { ProfilePersonalSpace } from './ProfilePersonalSpace';
import { PrivacySecurity } from './PrivacySecurity';
import { NotificationPreferencesCard } from './NotificationPreferencesCard';
import { useUiCopy } from '../../components/ui/ui-copy';
import { MeAboutRow, MeAccountRows, MeDisplaySettings, MeGuestCard, MeLegal, MeList, MePositioning, MeRow, MeTiles, useMyWeekSavedCount } from './MeHub';
import './me-hub.css';

type ProfileViewProps = {
  user: UserData | null;
  onLogout: () => void;
  onSessionEnded?: () => void;
  onLogin: () => void;
  onOpenPost: (post: PostData) => void;
  onUpdateUser: (user: UserData) => void;
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  onOpenBlockedUsers: () => void;
  /** Unread messages + pending contact requests (app context messagesBadgeCount). */
  messagesCount?: number;
};

const VIEWS = ['notifications', 'privacy', 'support', 'my_posts', 'edit', 'admin_reports', 'admin_official', 'admin_sources'] as const;
type MeView = typeof VIEWS[number];
const isView = (value: string | null): value is MeView => !!value && (VIEWS as readonly string[]).includes(value);

/** ?view= sub-views: opening one adds a history entry, so the phone back button returns to the hub. */
function useMeView() {
  const [params] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const requested = params.get('view');
  const view: MeView | 'menu' = isView(requested) ? requested : 'menu';
  const open = (next: MeView) => navigate({ pathname: location.pathname, search: `?view=${next}` }, { state: { meView: true } });
  const back = () => {
    if ((location.state as { meView?: boolean } | null)?.meView) navigate(-1);
    else navigate({ pathname: location.pathname, search: '' }, { replace: true });
  };
  return { view, open, back };
}

export const ProfileView = (props: ProfileViewProps) => props.user
  ? <ProfileSession key={JSON.stringify([props.user.id, props.user.token])} {...props} user={props.user} />
  : <GuestHub onLogin={props.onLogin} />;

function GuestHub({ onLogin }: { onLogin: () => void }) {
  const { t } = useUiCopy();
  const library = usePlannerLibrary(undefined);
  const savedCount = useMyWeekSavedCount(undefined, library);
  return <div className="me-hub" data-signed-out="">
    <header className="me-hub__header" data-guest="">
      <div className="me-hub__heading"><h1 className="me-hub__name">{t('我的 BAYLINK', 'My BAYLINK')}</h1><MePositioning /></div>
    </header>
    <MeGuestCard onLogin={onLogin} />
    <MeTiles signedIn={false} messagesCount={0} savedCount={savedCount} onLogin={onLogin} />
    <section className="me-section" aria-labelledby="me-settings-title">
      <h2 id="me-settings-title" className="me-section__title">{t('设置', 'Settings')}</h2>
      <MeList label={t('设置', 'Settings')}>
        <MeDisplaySettings />
        <MeAboutRow />
      </MeList>
    </section>
    <MeLegal />
  </div>;
}

const ProfileSession = ({ user, onLogout, onSessionEnded, onOpenPost, onUpdateUser, showToast, onOpenBlockedUsers, messagesCount = 0 }: ProfileViewProps & { user: UserData }) => {
  const { t } = useUiCopy();
  const isCurrentSession = useProfileSessionGuard(user);
  const { view, open, back } = useMeView();
  const library = usePlannerLibrary(user.id);
  const savedCount = useMyWeekSavedCount(user.id, library);
  const [showOfficialModal, setShowOfficialModal] = useState(false);
  const officialStatus = user.officialVerification?.status || (user.isOfficialVerified ? 'approved' : 'none');
  const officialApproved = officialStatus === 'approved' || !!user.isOfficialVerified;
  const joinDays = getJoinDays(user);
  const admin = user.role === 'admin';

  if (view === 'notifications') return <section className="me-subview" aria-labelledby="me-notifications-title">
    <button type="button" className="me-back" onClick={back}><ChevronLeft size={18} aria-hidden="true" />{t('返回我的', 'Back to Me')}</button>
    <h1 id="me-notifications-title" className="me-subview__title">{t('通知', 'Notifications')}</h1>
    <NotificationPreferencesCard key={`${user.id}:${user.token || ''}`} userId={user.id} />
  </section>;
  if (view === 'privacy') return <div className="me-subview">
    <PrivacySecurity user={user} onBack={back} onUpdateUser={onUpdateUser} onSessionEnded={onSessionEnded || onLogout} />
  </div>;
  if (view === 'support') return <InfoPage title={t('反馈与客服', 'Feedback and help')} storageKey="baylink_support" user={user} onBack={back} showToast={showToast} />;
  if (view === 'my_posts') return <MyPostsView user={user} onBack={back} onOpenPost={onOpenPost} />;
  if (view === 'edit') return <EditProfileModal user={user} onClose={back} onUpdate={onUpdateUser} showToast={showToast} />;
  if (view === 'admin_official' && admin) return <AdminOfficialVerificationsView onBack={back} showToast={showToast} />;
  if (view === 'admin_reports' && admin) return <AdminReportsView onBack={back} showToast={showToast} />;
  if (view === 'admin_sources' && admin) return <AdminSourceMonitor onBack={back} />;

  return (
    <div className="me-hub">
      <header className="me-hub__header">
        <div className="me-hub__avatar"><Avatar src={user.avatar} name={user.nickname} theme={user.profileTheme} size={18} /></div>
        <div className="me-hub__heading">
          <h1 className="me-hub__name"><span translate="no">{user.nickname || 'BAYLINK'}</span><TrustBadge user={user} size={15} /></h1>
          <MePositioning />
        </div>
      </header>
      <div className="me-hub__actions">
        <button type="button" onClick={() => open('edit')}><Edit size={16} aria-hidden="true" />{t('编辑资料', 'Edit profile')}</button>
        <Link to={`/users/${encodeURIComponent(user.id)}`}><Eye size={16} aria-hidden="true" />{t('查看公开名片', 'View public card')}</Link>
        <ProfileShareButton userId={user.id} nickname={user.nickname} />
      </div>
      {user.accountStatus === 'limited' && <p className="me-hub__notice" role="status">{t('你的账号部分功能受到限制，暂时无法发布内容或发送私信。', 'Some features of your account are limited: you cannot post or send messages for now.')}</p>}
      {user.accountStatus === 'suspended' && <p className="me-hub__notice" data-tone="danger" role="status">{t('你的账号当前受到限制，部分功能暂时不可用。', 'Your account is restricted and some features are unavailable for now.')}</p>}

      <MeTiles signedIn messagesCount={messagesCount} savedCount={savedCount} onMyPosts={() => open('my_posts')} />

      <section className="me-section" aria-labelledby="me-settings-title">
        <h2 id="me-settings-title" className="me-section__title">{t('设置', 'Settings')}</h2>
        <MeList label={t('设置', 'Settings')}>
          <MeDisplaySettings />
          <MeAccountRows onView={open} />
          <li><MeRow icon={UserX} label={t('已屏蔽用户', 'Blocked users')} value={t('管理私信屏蔽名单', 'Manage who cannot message you')} onClick={onOpenBlockedUsers} /></li>
          <MeAboutRow />
          <li><MeRow icon={LogOut} label={t('退出登录', 'Sign out')} tone="danger" onClick={onLogout} /></li>
        </MeList>
      </section>

      <section className="me-section" aria-labelledby="me-explore-title">
        <h2 id="me-explore-title" className="me-section__title">{t('我的探索', 'My exploration')}</h2>
        <ProfilePersonalSpace user={user} onEdit={() => open('edit')} library={library} />
      </section>

      <section className="me-section" aria-labelledby="me-trust-title">
        <h2 id="me-trust-title" className="me-section__title">{t('资料与认证', 'Profile and verification')}</h2>
        <div className="me-panel">
          <h3 className="me-panel__title"><ShieldCheck aria-hidden="true" strokeWidth={1.75} />{t('信任信息', 'Trust details')}</h3>
          {joinDays != null && <p>{t(`已加入 BAYLINK ${joinDays} 天`, `Joined BAYLINK ${joinDays} days ago`)}</p>}
          <p>{getPhoneVerificationTrustLabel(user.isPhoneVerified)}</p>
          <p>{getMyOfficialTrustLabel(user)}</p>
          {officialApproved && user.officialVerification?.type && <p>{t('认证类型：', 'Verification type: ')}{getOfficialTypeLabel(user.officialVerification.type)}</p>}
        </div>
        <div className="me-panel">
          <div className="me-panel__row">
            <h3 className="me-panel__title"><BadgeCheck aria-hidden="true" strokeWidth={1.75} />{t('资料审核', 'Profile review')}{officialApproved && <TrustBadge user={user} size={12} />}</h3>
            {officialStatus === 'pending' ? <span className="me-panel__status">{t('审核中', 'In review')}</span>
              : officialApproved ? <span className="me-panel__status">{t('已通过', 'Approved')}</span>
                : <button type="button" onClick={() => setShowOfficialModal(true)}>{officialStatus === 'rejected' ? t('重新申请', 'Apply again') : t('申请认证', 'Apply for verification')}</button>}
          </div>
          <p>{getMyOfficialTrustLabel(user)}</p>
          {officialStatus === 'rejected' && user.officialVerification?.rejectionReason && <p translate="no">{user.officialVerification.rejectionReason}</p>}
        </div>
      </section>

      {admin && <section className="me-section" aria-labelledby="me-admin-title">
        <h2 id="me-admin-title" className="me-section__title">{t('管理', 'Admin')}</h2>
        <MeList label={t('管理', 'Admin')}>
          <li><MeRow icon={Radar} label={t('来源变更监测', 'Source change monitor')} onClick={() => open('admin_sources')} /></li>
          <li><MeRow icon={BadgeCheck} label={t('资料审核管理', 'Profile review queue')} value={t('查看并处理资料审核申请', 'Review verification requests')} onClick={() => open('admin_official')} /></li>
          <li><MeRow icon={Flag} label={t('举报管理', 'Reports')} value={t('查看并处理用户举报', 'Review user reports')} onClick={() => open('admin_reports')} /></li>
        </MeList>
      </section>}

      <MeLegal />
      {showOfficialModal && (
        <OfficialVerificationModal
          isOpen={showOfficialModal}
          onClose={() => setShowOfficialModal(false)}
          onSubmit={(payload) => api.submitOfficialVerification(payload)}
          onSuccess={(updatedUser) => {
            if (!isCurrentSession()) return;
            const nextUser = { ...user, ...updatedUser };
            try { localStorage.setItem('currentUser', JSON.stringify(nextUser)); } catch { /* The server has saved the application. */ }
            onUpdateUser(nextUser);
          }}
          showToast={(message, type) => { if (isCurrentSession()) showToast(message, type); }}
        />
      )}
    </div>
  );
};
