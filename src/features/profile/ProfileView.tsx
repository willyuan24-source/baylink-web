// 「我的」页：个人名片 / 信任信息 / 资料审核 / 子视图入口（含管理员入口）
import { useState } from 'react';
import {
  LogOut, Edit, BadgeCheck, Phone, UserX, Eye, MapPin,
  ChevronRight, Info, Flag, ArrowUpRight, House, MessageCircle, Sparkles,
} from 'lucide-react';
import { BRAND } from '../../brandAssets';
import { api, safeParse } from '../../lib/api';
import { TrustBadge } from '../../components/TrustBadge';
import { SavedPostsPanel } from '../../components/SavedPostsPanel';
import { OfficialVerificationModal } from '../../components/OfficialVerificationModal';
import {
  calcProfileCompletion, getJoinDays, getMyOfficialTrustLabel,
  getOfficialTypeLabel, getPhoneVerificationTrustLabel,
} from '../../lib/format';
import type { UserData } from '../../lib/types';
import { AdminOfficialVerificationsView, AdminReportsView } from '../admin/AdminViews';
import { EditProfileModal } from './EditProfileModal';
import { InfoPage, MyPostsView } from './ProfileSubViews';
import { ProfileIdentity, ProfileShareButton } from './ProfileIdentity';
import { Link } from 'react-router-dom';

const getOfficialVerificationStatusLabel = (user: UserData) => getMyOfficialTrustLabel(user);

export const ProfileView = ({ user, onLogout, onLogin, onOpenPost, onUpdateUser, showToast, onOpenBlockedUsers }: any) => {
  const [subView, setSubView] = useState<'menu' | 'my_posts' | 'support' | 'about' | 'edit_profile' | 'admin_reports' | 'admin_official'>('menu');
  const [showOfficialModal, setShowOfficialModal] = useState(false);
  const officialStatus = user?.officialVerification?.status || (user?.isOfficialVerified ? 'approved' : 'none');
  const joinDays = user ? getJoinDays(user) : null;
  const completion = user ? calcProfileCompletion(user) : 0;


  if (!user) return (
    <div className="member-profile-guest">
      <div className="member-page-heading"><div><span className="member-eyebrow">MAKE YOURSELF AT HOME</span><h1>我的 BAYLINK</h1></div></div>
      <SavedPostsPanel />
      <section className="member-welcome-card">
        <div className="member-welcome-copy">
          <span className="member-welcome-label"><span /> 你好，新邻居</span>
          <h2>让湾区，<br />多一点熟悉。</h2>
          <p>找到需要的，分享拥有的。<br />从这一刻开始，连接属于你的湾区生活。</p>
          <button onClick={onLogin} className="member-primary member-primary--lime">立即登录 / 注册<ArrowUpRight size={18} aria-hidden="true" /></button>
        </div>
        <div className="member-welcome-art" aria-hidden="true">
          <div className="member-welcome-orbit" />
          <img src={BRAND.baybayAvatar} alt="" width={160} height={160} />
          <span className="member-welcome-sticker"><MapPin size={14} /> BAY AREA, CA</span>
        </div>
      </section>
      <div className="member-welcome-benefits">
        <div><span><House size={22} aria-hidden="true" /></span><h3>发现身边资源</h3><p>房源、二手好物与本地服务</p></div>
        <div><span><MessageCircle size={22} aria-hidden="true" /></span><h3>与邻里聊一聊</h3><p>私信沟通，按需请求联系方式</p></div>
        <div><span><Sparkles size={22} aria-hidden="true" /></span><h3>分享你的生活</h3><p>发布资源，让需要的人发现你</p></div>
      </div>
      <a href="/guides" className="member-guide-link"><span>刚来湾区？先看看 <strong>湾区生活指南</strong></span><ArrowUpRight size={18} aria-hidden="true" /></a>
    </div>
  );

  return (
    <div className="member-profile-shell">
      {subView === 'menu' && (
        <div className="member-profile-content">
          <div className="member-page-heading"><div><span className="member-eyebrow">YOUR NEIGHBORHOOD PROFILE</span><h1>我的名片</h1><p>认识彼此，从一张真实的生活名片开始。</p></div><button onClick={onLogout} aria-label="退出登录" className="member-logout"><LogOut size={18} /><span>退出</span></button></div>

          {user.accountStatus === 'limited' && (
            <div className="member-profile-wide rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              你的账号部分功能受到限制，暂时无法发布内容或发送私信。
            </div>
          )}
          {user.accountStatus === 'suspended' && (
            <div className="member-profile-wide rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              你的账号当前受到限制，部分功能暂时不可用。
            </div>
          )}


          <div className="member-profile-personality">
            <ProfileIdentity profile={user}>
              <button type="button" onClick={() => setSubView('edit_profile')}><Edit size={15} />编辑资料</button>
              <Link to={`/users/${encodeURIComponent(user.id)}`}><Eye size={15} />查看公开名片</Link>
              <ProfileShareButton userId={user.id} nickname={user.nickname} />
            </ProfileIdentity>
          </div>

          {completion < 100 && (
            <div className="member-profile-completion">
              <div className="min-w-0 flex-1"><p className="text-sm font-semibold text-baylink-text">资料完成度 {completion}%</p><p className="mt-1 text-xs text-baylink-text-secondary leading-relaxed">完善地区、兴趣和简介，让附近用户更容易认识你。</p><div className="member-completion-track" role="progressbar" aria-label="资料完成度" aria-valuenow={completion} aria-valuemin={0} aria-valuemax={100}><span style={{ width: `${completion}%` }} /></div></div>
              <button type="button" onClick={() => setSubView('edit_profile')} className="member-text-action shrink-0">去完善<ArrowUpRight size={15} aria-hidden="true" /></button>
            </div>
          )}

          <SavedPostsPanel key={user.id} userId={user.id} />

          <div className="member-profile-panel">
            <h2 className="member-panel-title">信任信息</h2>
            <div className="space-y-2 text-xs leading-relaxed text-baylink-text-secondary">
              {joinDays != null && <p>已加入 BAYLINK <span className="font-medium text-gray-900">{joinDays}</span> 天</p>}
              <p>{getPhoneVerificationTrustLabel(user.isPhoneVerified)}</p>
              <p>{getMyOfficialTrustLabel(user)}</p>
              {(officialStatus === 'approved' || user.isOfficialVerified) && user.officialVerification?.type && (
                <p>认证类型：{getOfficialTypeLabel(user.officialVerification.type)}</p>
              )}
            </div>
          </div>

          <div className="member-profile-panel member-verification-panel">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <BadgeCheck size={18} className="shrink-0 text-baylink-green" />
                  <h2 className="font-semibold text-baylink-text">资料审核</h2>
                  {(officialStatus === 'approved' || user.isOfficialVerified) && <TrustBadge user={user} size={12} />}
                </div>
                <p className="mt-2 text-xs leading-relaxed text-baylink-text-secondary">{getOfficialVerificationStatusLabel(user)}</p>
                {officialStatus === 'rejected' && user.officialVerification?.rejectionReason && (
                  <p className="mt-1 text-[11px] text-red-500 line-clamp-2" translate="no">{user.officialVerification.rejectionReason}</p>
                )}
              </div>
              {officialStatus === 'pending' ? (
                <span className="shrink-0 rounded-lg bg-amber-50 px-3 py-1.5 text-[11px] font-bold text-amber-700">审核中</span>
              ) : (officialStatus === 'approved' || user.isOfficialVerified) ? (
                <span className="shrink-0 rounded-lg bg-amber-50 px-3 py-1.5 text-[11px] font-bold text-amber-700">已通过</span>
              ) : (
                <button type="button" onClick={() => setShowOfficialModal(true)} className="member-verification-action">
                  {officialStatus === 'rejected' ? '重新申请' : '申请认证'}
                </button>
              )}
            </div>
          </div>

          <div className="member-profile-actions">
            <button onClick={() => setSubView('my_posts')} className="member-action-tile"><span className="member-action-icon"><Edit size={22} /></span><ArrowUpRight size={18} className="member-action-arrow" aria-hidden="true" /><strong>我的发布</strong><span>管理帖子与发布状态</span></button>
            <button onClick={() => setSubView('support')} className="member-action-tile"><span className="member-action-icon member-action-icon--warm"><Phone size={22} /></span><ArrowUpRight size={18} className="member-action-arrow" aria-hidden="true" /><strong>联系客服</strong><span>获取帮助与支持</span></button>
          </div>
          <button onClick={onOpenBlockedUsers} className="member-menu-row">
            <div className="flex items-center gap-4">
              <div className="member-menu-icon"><UserX size={20} /></div>
              <div><div className="font-bold text-gray-900">已屏蔽用户</div><div className="text-[11px] text-baylink-muted">管理私信屏蔽名单</div></div>
            </div>
            <ChevronRight size={18} className="text-gray-300" />
          </button>
          <button onClick={() => setSubView('about')} className="member-menu-row"><div className="flex items-center gap-4"><div className="member-menu-icon"><Info size={20} /></div><div className="font-semibold text-baylink-text">关于我们</div></div><ChevronRight size={18} className="text-baylink-muted" /></button>
          <div className="member-profile-legal">
            <a href="/terms" className="hover:text-baylink-green transition">服务条款</a>
            <a href="/privacy" className="hover:text-baylink-green transition">隐私政策</a>
            <a href="/sms-consent" className="hover:text-baylink-green transition">短信条款</a>
          </div>
          {user.role === 'admin' && (
            <>
              <button onClick={() => setSubView('admin_official')} className="member-menu-row">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-amber-50 rounded-full flex items-center justify-center text-amber-600 group-hover:scale-110 transition"><BadgeCheck size={20} /></div>
                  <div><div className="font-bold text-gray-900">资料审核管理</div><div className="text-[11px] text-baylink-muted">查看并处理资料审核申请</div></div>
                </div>
                <ChevronRight size={18} className="text-gray-300" />
              </button>
              <button onClick={() => setSubView('admin_reports')} className="member-menu-row">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-red-50 rounded-full flex items-center justify-center text-red-500 group-hover:scale-110 transition"><Flag size={20} /></div>
                  <div><div className="font-bold text-gray-900">举报管理</div><div className="text-[11px] text-baylink-muted">查看并处理用户举报</div></div>
                </div>
                <ChevronRight size={18} className="text-gray-300" />
              </button>
            </>
          )}
        </div>
      )}
      {showOfficialModal && (
        <OfficialVerificationModal
          isOpen={showOfficialModal}
          onClose={() => setShowOfficialModal(false)}
          onSubmit={(payload) => api.submitOfficialVerification(payload)}
          onSuccess={(updatedUser) => {
            const stored = localStorage.getItem('currentUser');
            const current = stored ? safeParse(stored) : {};
            const nextUser = { ...current, ...updatedUser };
            localStorage.setItem('currentUser', JSON.stringify(nextUser));
            onUpdateUser(nextUser);
          }}
          showToast={showToast}
        />
      )}
      {subView === 'admin_official' && <AdminOfficialVerificationsView onBack={() => setSubView('menu')} showToast={showToast} />}
      {subView === 'admin_reports' && <AdminReportsView onBack={() => setSubView('menu')} showToast={showToast} />}
      {subView === 'edit_profile' && <EditProfileModal user={user} onClose={() => setSubView('menu')} onUpdate={onUpdateUser} showToast={showToast} />}
      {subView === 'my_posts' && <MyPostsView user={user} onBack={() => setSubView('menu')} onOpenPost={onOpenPost} />}
      {subView === 'support' && <InfoPage title="联系客服" storageKey="baylink_support" user={user} onBack={() => setSubView('menu')} showToast={showToast} />}
      {subView === 'about' && <InfoPage title="关于我们" storageKey="baylink_about" user={user} onBack={() => setSubView('menu')} showToast={showToast} />}
    </div>
  );
};
