// 「我的」页：个人名片 / 信任信息 / 官方认证 / 子视图入口（含管理员入口）
import { useState } from 'react';
import {
  LogOut, MapPin, Edit, Instagram, ExternalLink, BadgeCheck, Phone, UserX,
  ChevronRight, Info, Flag,
} from 'lucide-react';
import { BRAND } from '../../brandAssets';
import { api, safeParse } from '../../lib/api';
import Avatar from '../../components/Avatar';
import { TrustBadge } from '../../components/TrustBadge';
import { TagPills } from '../../components/TagPills';
import { OfficialVerificationModal } from '../../components/OfficialVerificationModal';
import {
  calcProfileCompletion, formatProfileLocation, getJoinDays, getMyOfficialTrustLabel,
  getOfficialTypeLabel, getPhoneVerificationTrustLabel, normalizeInstagramUrl, normalizeWebsiteUrl,
} from '../../lib/format';
import type { UserData } from '../../lib/types';
import { AdminOfficialVerificationsView, AdminReportsView } from '../admin/AdminViews';
import { EditProfileModal } from './EditProfileModal';
import { InfoPage, MyPostsView } from './ProfileSubViews';

const getOfficialVerificationStatusLabel = (user: UserData) => getMyOfficialTrustLabel(user);

export const ProfileView = ({ user, onLogout, onLogin, onOpenPost, onUpdateUser, showToast, onOpenBlockedUsers }: any) => {
  const [subView, setSubView] = useState<'menu' | 'my_posts' | 'support' | 'about' | 'edit_profile' | 'admin_reports' | 'admin_official'>('menu');
  const [showOfficialModal, setShowOfficialModal] = useState(false);
  const officialStatus = user?.officialVerification?.status || (user?.isOfficialVerified ? 'approved' : 'none');
  const joinDays = user ? getJoinDays(user) : null;
  const completion = user ? calcProfileCompletion(user) : 0;
  const locationLine = user ? formatProfileLocation(user.area, user.city) : '';
  const myProfileTags = user?.profileTags?.filter(Boolean) || [];
  const myInterests = user?.interests?.filter(Boolean) || [];
  const myInsta = user?.socialLinks?.instagram ? normalizeInstagramUrl(user.socialLinks.instagram) : null;
  const myWebsite = user?.website ? normalizeWebsiteUrl(user.website) : null;
  const myXhs = user?.xiaohongshu?.trim() || '';

  if (!user) return (
    <div className="flex-1 flex flex-col items-center justify-center p-8 max-w-sm mx-auto w-full">
      <img
        src={BRAND.baybayAvatar}
        alt="BayBay"
        className="mb-6 h-20 w-20 rounded-[24px] object-cover shadow-rest ring-2 ring-baylink-green/15"
        width={80}
        height={80}
      />
      <h2 className="text-2xl font-bold text-baylink-text mb-2">欢迎来到 BAYLINK</h2>
      <p className="text-baylink-muted text-center mb-8 text-sm leading-relaxed">连接湾区华人邻里，找房、二手、本地服务和生活指南都在这里。</p>
      <button onClick={onLogin} className="w-full btn-primary py-3.5 rounded-2xl font-bold shadow-rest active:scale-[0.98] transition">立即登录 / 注册</button>
      <a href="/guides" className="mt-4 text-[12px] text-baylink-muted hover:text-baylink-green transition">
        刚来湾区？先看看 <span className="font-semibold text-baylink-green">湾区生活指南</span>
      </a>
    </div>
  );

  return (
    <div className="flex-1 relative w-full h-full bg-[#FAFAFA]">
      {subView === 'menu' && (
        <div className="p-6 pt-8 w-full h-full overflow-y-auto pb-24">
          <div className="flex justify-between items-center mb-6"><h1 className="text-2xl font-black text-gray-900">我的名片</h1><button onClick={onLogout} className="p-2 bg-white rounded-full text-red-500 shadow-sm hover:bg-red-50"><LogOut size={20} /></button></div>

          {user.accountStatus === 'limited' && (
            <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              你的账号部分功能受到限制，暂时无法发布内容或发送私信。
            </div>
          )}
          {user.accountStatus === 'suspended' && (
            <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              你的账号当前受到限制，部分功能暂时不可用。
            </div>
          )}

          {completion < 100 && (
            <div className="mb-4 rounded-2xl border border-baylink-green/20 bg-baylink-green/[0.06] px-4 py-3">
              <p className="text-sm font-bold text-baylink-text">资料完成度 {completion}%</p>
              <p className="mt-0.5 text-[11px] text-baylink-muted leading-snug">完善地区、兴趣和简介，让附近用户更容易认识你。</p>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-baylink-section">
                <div className="h-full rounded-full bg-baylink-green transition-all" style={{ width: `${completion}%` }} />
              </div>
            </div>
          )}

          <div className="bg-white p-5 rounded-[1.75rem] shadow-soft-glow mb-4 relative overflow-hidden group border border-baylink-border/30">
            <div className="absolute top-0 right-0 w-28 h-28 bg-gradient-to-br from-green-100/80 to-transparent rounded-full -mr-8 -mt-8" />
            <div className="flex items-start gap-4 relative z-10">
              <Avatar src={user.avatar} name={user.nickname} size={16} className="shadow-md border-2 border-white shrink-0" />
              <div className="min-w-0 flex-1">
                <h2 className="text-xl font-black text-gray-900 flex items-center gap-2 flex-wrap">{user.nickname} <TrustBadge user={user} size={14} /></h2>
                {locationLine && (
                  <p className="mt-1 flex items-center gap-1 text-[11px] text-baylink-text-secondary">
                    <MapPin size={11} className="text-baylink-green/70 shrink-0" />{locationLine}
                  </p>
                )}
                <p className="text-xs text-gray-500 mt-1 line-clamp-2 leading-relaxed">{user.bio || '写一句介绍，展示你的本地生活名片'}</p>
                {joinDays != null && <p className="text-[10px] text-baylink-muted mt-1">加入 {joinDays} 天</p>}
              </div>
              <button onClick={() => setSubView('edit_profile')} className="p-2.5 bg-baylink-section rounded-xl hover:bg-baylink-green/10 transition shrink-0" title="编辑资料"><Edit size={16} className="text-baylink-green" /></button>
            </div>
            {(myProfileTags.length > 0 || myInterests.length > 0) && (
              <div className="mt-4 space-y-2 relative z-10">
                {myProfileTags.length > 0 && <TagPills tags={myProfileTags} variant="profile" />}
                {myInterests.length > 0 && <TagPills tags={myInterests} variant="interest" />}
              </div>
            )}
            {(myInsta || myWebsite || myXhs) && (
              <div className="mt-3 flex flex-wrap gap-2 relative z-10">
                {myInsta && (
                  <a href={myInsta} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-full border border-baylink-border/50 bg-baylink-bg px-2 py-0.5 text-[10px] text-baylink-text-secondary">
                    <Instagram size={11} /> Instagram
                  </a>
                )}
                {myXhs && <span className="rounded-full border border-baylink-border/50 bg-baylink-bg px-2 py-0.5 text-[10px] text-baylink-text-secondary">小红书 · {myXhs}</span>}
                {myWebsite && (
                  <a href={myWebsite} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-full border border-baylink-border/50 bg-baylink-bg px-2 py-0.5 text-[10px] text-baylink-text-secondary">
                    <ExternalLink size={10} /> 网站
                  </a>
                )}
              </div>
            )}
          </div>

          <div className="mb-4 rounded-[1.5rem] border border-baylink-border/40 bg-white p-4 shadow-sm">
            <p className="text-xs font-bold text-gray-500 mb-2">信任信息</p>
            <div className="space-y-1 text-[11px] text-gray-600">
              {joinDays != null && <p>已加入 BAYLINK <span className="font-medium text-gray-900">{joinDays}</span> 天</p>}
              <p>{getPhoneVerificationTrustLabel(user.isPhoneVerified)}</p>
              <p>{getMyOfficialTrustLabel(user)}</p>
              {(officialStatus === 'approved' || user.isOfficialVerified) && user.officialVerification?.type && (
                <p>认证类型：{getOfficialTypeLabel(user.officialVerification.type)}</p>
              )}
            </div>
          </div>

          <div className="mb-4 rounded-[1.5rem] border border-amber-200/60 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <BadgeCheck size={18} className="shrink-0 text-amber-500" />
                  <span className="font-bold text-gray-900">官方认证</span>
                  {(officialStatus === 'approved' || user.isOfficialVerified) && <TrustBadge user={user} size={12} />}
                </div>
                <p className="mt-1 text-[11px] text-gray-500">{getOfficialVerificationStatusLabel(user)}</p>
                {officialStatus === 'rejected' && user.officialVerification?.rejectionReason && (
                  <p className="mt-1 text-[10px] text-red-500 line-clamp-2">{user.officialVerification.rejectionReason}</p>
                )}
              </div>
              {officialStatus === 'pending' ? (
                <span className="shrink-0 rounded-lg bg-amber-50 px-3 py-1.5 text-[10px] font-bold text-amber-700">审核中</span>
              ) : (officialStatus === 'approved' || user.isOfficialVerified) ? (
                <span className="shrink-0 rounded-lg bg-amber-50 px-3 py-1.5 text-[10px] font-bold text-amber-700">已通过</span>
              ) : (
                <button type="button" onClick={() => setShowOfficialModal(true)} className="shrink-0 rounded-lg bg-gray-900 px-3 py-1.5 text-[10px] font-bold text-white">
                  {officialStatus === 'rejected' ? '重新申请' : '申请认证'}
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-6">
            <button onClick={() => setSubView('my_posts')} className="bg-white p-5 rounded-[1.5rem] shadow-sm hover:shadow-md transition text-left group"><div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center text-orange-600 mb-3 group-hover:scale-110 transition"><Edit size={20} /></div><div className="font-bold text-gray-900">我的发布</div><div className="text-[10px] text-gray-400">管理帖子</div></button>
            <button onClick={() => setSubView('support')} className="bg-white p-5 rounded-[1.5rem] shadow-sm hover:shadow-md transition text-left group"><div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 mb-3 group-hover:scale-110 transition"><Phone size={20} /></div><div className="font-bold text-gray-900">联系客服</div><div className="text-[10px] text-gray-400">帮助支持</div></button>
          </div>
          <button onClick={onOpenBlockedUsers} className="mb-4 w-full bg-white p-5 rounded-[1.5rem] shadow-sm hover:shadow-md transition flex items-center justify-between group">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center text-gray-600 group-hover:scale-110 transition"><UserX size={20} /></div>
              <div><div className="font-bold text-gray-900">已屏蔽用户</div><div className="text-[10px] text-gray-400">管理私信屏蔽名单</div></div>
            </div>
            <ChevronRight size={18} className="text-gray-300" />
          </button>
          <button onClick={() => setSubView('about')} className="w-full bg-white p-5 rounded-[1.5rem] shadow-sm hover:shadow-md transition flex items-center justify-between group"><div className="flex items-center gap-4"><div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center text-purple-600 group-hover:scale-110 transition"><Info size={20} /></div><div className="font-bold text-gray-900">关于我们</div></div><ChevronRight size={18} className="text-gray-300" /></button>
          <div className="mt-6 flex flex-wrap justify-center gap-x-4 gap-y-1 text-[11px] text-gray-400">
            <a href="/terms" className="hover:text-baylink-green transition">服务条款</a>
            <a href="/privacy" className="hover:text-baylink-green transition">隐私政策</a>
            <a href="/sms-consent" className="hover:text-baylink-green transition">短信条款</a>
          </div>
          {user.role === 'admin' && (
            <>
              <button onClick={() => setSubView('admin_official')} className="mt-4 w-full bg-white p-5 rounded-[1.5rem] shadow-sm hover:shadow-md transition flex items-center justify-between group">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-amber-50 rounded-full flex items-center justify-center text-amber-600 group-hover:scale-110 transition"><BadgeCheck size={20} /></div>
                  <div><div className="font-bold text-gray-900">官方认证审核</div><div className="text-[10px] text-gray-400">查看并处理认证申请</div></div>
                </div>
                <ChevronRight size={18} className="text-gray-300" />
              </button>
              <button onClick={() => setSubView('admin_reports')} className="mt-4 w-full bg-white p-5 rounded-[1.5rem] shadow-sm hover:shadow-md transition flex items-center justify-between group">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-red-50 rounded-full flex items-center justify-center text-red-500 group-hover:scale-110 transition"><Flag size={20} /></div>
                  <div><div className="font-bold text-gray-900">举报管理</div><div className="text-[10px] text-gray-400">查看并处理用户举报</div></div>
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
