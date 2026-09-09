// 用户公开资料弹层（湾区生活名片）
import { useState, useEffect, useCallback, useRef } from 'react';
import {
  X, MapPin, Instagram, ExternalLink, Shield, ChevronRight, Flag, UserX,
} from 'lucide-react';
import { api } from '../../lib/api';
import Avatar from '../../components/Avatar';
import { ModalShell } from '../../components/ui/Modal';
import { ProfileCardSkeleton } from '../../components/ui/Skeleton';
import { TrustBadge } from '../../components/TrustBadge';
import { TagPills } from '../../components/TagPills';
import { isPlatformAdmin } from '../../components/UserTrustBadges';
import { normalizePostImages } from '../../lib/constants';
import {
  getJoinDays, formatProfileLocation, normalizeInstagramUrl, normalizeWebsiteUrl,
  getPhoneVerificationTrustLabel, getOfficialTypeLabel, friendlyErrorMessage,
} from '../../lib/format';
import type { PublicUserProfile, UserData } from '../../lib/types';

export const UserProfileModal = ({ userId, onClose, currentUser, onChat, onOpenRecentPost, showToast, onReportUser, onToggleBlockUser, blockedUserIds, onLoginNeeded }: {
  userId: string;
  onClose: () => void;
  currentUser: UserData | null;
  onChat?: (targetId: string, nickname?: string) => void | Promise<unknown>;
  onOpenRecentPost?: (post: { id?: string; _id?: string }) => void;
  showToast?: (message: string, type?: 'success' | 'error' | 'info') => void;
  onReportUser?: (userId: string) => void;
  onToggleBlockUser?: (userId: string) => void;
  blockedUserIds?: string[];
  onLoginNeeded?: () => void;
}) => {
  const [profile, setProfile] = useState<PublicUserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [openingChat, setOpeningChat] = useState(false);
  const [pendingChat, setPendingChat] = useState<{ id: string; nickname: string } | null>(null);
  const openingChatRef = useRef(false);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setFailed(false);
      try {
        const result = await api.getUserPublicProfile(userId);
        if (!cancelled) setProfile(result);
      } catch {
        if (!cancelled) setFailed(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [userId, currentUser?.id]);

  const startChat = useCallback(async (target: { id: string; nickname: string }) => {
    if (!onChat || openingChatRef.current) return;
    openingChatRef.current = true;
    setOpeningChat(true);
    try {
      // Successful navigation closes this route. Calling onClose here would navigate back out of the new conversation.
      await onChat(target.id, target.nickname);
    } catch (e) {
      showToast?.(friendlyErrorMessage(e, '无法打开聊天，请重试。'), 'error');
    } finally {
      openingChatRef.current = false;
      setOpeningChat(false);
    }
  }, [onChat, showToast]);

  useEffect(() => {
    if (!currentUser || !pendingChat) return;
    setPendingChat(null);
    if (pendingChat.id !== currentUser.id) void startChat(pendingChat);
  }, [currentUser, pendingChat, startChat]);

  const handleChat = () => {
    if (!profile) return;
    const target = { id: profile.id, nickname: profile.nickname };
    if (!currentUser) {
      setPendingChat(target);
      onLoginNeeded?.();
      return;
    }
    void startChat(target);
  };

  const joinDays = profile ? getJoinDays(profile) : null;
  const locationLine = profile ? formatProfileLocation(profile.area, profile.city) : '';
  const profileTags = profile?.profileTags?.filter(Boolean) || [];
  const interests = profile?.interests?.filter(Boolean) || [];
  const hasTags = profileTags.length > 0 || interests.length > 0;
  const instaUrl = profile?.socialLinks?.instagram ? normalizeInstagramUrl(profile.socialLinks.instagram) : null;
  const websiteUrl = profile?.website ? normalizeWebsiteUrl(profile.website) : null;
  const xhsRaw = profile?.xiaohongshu?.trim() || '';
  const xhsUrl = xhsRaw && /^https?:\/\//i.test(xhsRaw) ? xhsRaw : null;
  const hasSocial = !!(instaUrl || websiteUrl || xhsRaw);
  const isBlocked = profile ? (blockedUserIds ? blockedUserIds.includes(profile.id) : profile.viewerHasBlockedUser) : false;

  return (
    <ModalShell onClose={onClose} label="湾区生活名片" className="fixed inset-0 z-[110] flex items-center justify-center bg-black/45 px-4 py-6 backdrop-blur-sm">
      <div className="flex max-h-[86vh] w-full max-w-md flex-col overflow-hidden rounded-[28px] bg-baylink-bg-alt shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-baylink-border/40 px-5 py-3">
          <h3 className="text-base font-bold text-baylink-text">湾区生活名片</h3>
          <button type="button" onClick={onClose} aria-label="关闭用户名片" className="rounded-full p-2 text-baylink-muted hover:bg-baylink-section"><X size={18} /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-3 sm:px-5">
          {loading ? (
            <ProfileCardSkeleton />
          ) : failed || !profile ? (
            <p className="py-12 text-center text-sm text-baylink-muted">无法查看该用户资料</p>
          ) : (
            <>
              <div className="rounded-2xl border border-baylink-green/15 bg-gradient-to-br from-baylink-green/[0.06] via-white to-[#FFF8F0]/80 p-4">
                <div className="flex items-start gap-3">
                  <Avatar src={profile.avatar} name={profile.nickname} size={16} className="shrink-0 ring-2 ring-white" />
                  <div className="min-w-0 flex-1">
                    <h4 className="text-lg font-bold text-baylink-text leading-tight">{profile.nickname}</h4>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1">
                      {!isPlatformAdmin(profile) && (
                        <span className="rounded-md bg-baylink-section px-1.5 py-px text-[11px] font-bold text-baylink-muted">社区居民</span>
                      )}
                      <TrustBadge user={profile} size={11} showText />
                    </div>
                    {isPlatformAdmin(profile) && (
                      <p className="mt-2 text-[11px] leading-relaxed text-emerald-800/90">
                        该账号为 BAYLINK 平台管理员，用于发布平台公告、湾区指南、推荐内容和安全提醒。
                      </p>
                    )}
                    {locationLine && (
                      <p className="mt-1.5 flex items-center gap-1 text-[11px] text-baylink-text-secondary">
                        <MapPin size={11} className="shrink-0 text-baylink-green/70" />
                        <span className="truncate">{locationLine}</span>
                      </p>
                    )}
                  </div>
                </div>
                <p className="mt-3 text-left text-[13px] leading-relaxed text-baylink-text-secondary">
                  {profile.bio?.trim() || 'TA 还没介绍自己，先看看最近发布吧。'}
                </p>
              </div>

              {hasTags && (
                <div className="mt-3 space-y-2.5 rounded-xl border border-baylink-border/40 bg-white p-3">
                  {profileTags.length > 0 && (
                    <div>
                      <p className="mb-1.5 text-[11px] font-semibold text-baylink-muted">身份标签</p>
                      <TagPills tags={profileTags} variant="profile" />
                    </div>
                  )}
                  {interests.length > 0 && (
                    <div>
                      <p className="mb-1.5 text-[11px] font-semibold text-baylink-muted">兴趣</p>
                      <TagPills tags={interests} variant="interest" />
                    </div>
                  )}
                </div>
              )}

              {hasSocial && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {instaUrl && (
                    <a href={instaUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-full border border-baylink-border/50 bg-white px-2.5 py-1 text-[11px] font-medium text-baylink-text-secondary hover:border-baylink-green/30">
                      <Instagram size={12} className="text-[#E1306C]" /> Instagram
                    </a>
                  )}
                  {xhsRaw && (
                    xhsUrl ? (
                      <a href={xhsUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-full border border-baylink-border/50 bg-white px-2.5 py-1 text-[11px] font-medium text-baylink-text-secondary hover:border-baylink-green/30">
                        小红书
                      </a>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full border border-baylink-border/50 bg-white px-2.5 py-1 text-[11px] font-medium text-baylink-text-secondary">
                        小红书 · {xhsRaw}
                      </span>
                    )
                  )}
                  {websiteUrl && (
                    <a href={websiteUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-full border border-baylink-border/50 bg-white px-2.5 py-1 text-[11px] font-medium text-baylink-text-secondary hover:border-baylink-green/30">
                      <ExternalLink size={11} /> 个人网站
                    </a>
                  )}
                </div>
              )}

              <div className="mt-3 rounded-xl border border-baylink-border/40 bg-white p-3 text-[11px] text-baylink-text-secondary">
                <p className="font-semibold text-baylink-text mb-2 text-xs">信任信息</p>
                <div className="space-y-1.5">
                  <p>已加入 BAYLINK <span className="font-medium text-baylink-text">{joinDays ?? '—'}</span> 天</p>
                  <p>发布 <span className="font-medium text-baylink-text">{profile.postCount}</span> 条本地信息</p>
                  <p>{getPhoneVerificationTrustLabel(profile.isPhoneVerified)}</p>
                  {profile.isOfficialVerified && (
                    <>
                      <p>资料审核：已通过</p>
                      {profile.officialVerification?.type && (
                        <p>认证类型：{getOfficialTypeLabel(profile.officialVerification.type)}</p>
                      )}
                    </>
                  )}
                </div>
              </div>

              <div className="mt-4">
                <h5 className="text-xs font-bold text-baylink-text">最近发布</h5>
                {profile.recentPosts.length > 0 ? (
                  <>
                  <p className="mb-2 text-[11px] text-baylink-muted">查看 TA 最近的本地信息</p>
                  <div className="space-y-2">
                    {profile.recentPosts.map((rp) => {
                      const postId = rp.id || rp._id;
                      return (
                      <button
                        key={postId || rp.title}
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!postId) {
                            showToast?.('帖子链接不可用', 'error');
                            return;
                          }
                          onOpenRecentPost?.(rp);
                        }}
                        className="flex w-full min-h-[56px] cursor-pointer gap-2 rounded-xl border border-baylink-border/50 bg-white p-3 text-left transition hover:border-baylink-green/30 hover:bg-baylink-green/[0.02] active:scale-[0.99]"
                      >
                        {normalizePostImages(rp)[0] ? (
                          <img src={normalizePostImages(rp)[0]} alt="" loading="lazy" decoding="async" className="h-12 w-12 shrink-0 rounded-lg object-cover" />
                        ) : (
                          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-baylink-section text-[11px] text-baylink-muted">无图</div>
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="line-clamp-1 text-sm font-semibold text-baylink-text">{rp.title}</div>
                          <div className="text-[11px] text-baylink-muted">{rp.city} · #{rp.category}</div>
                        </div>
                        <ChevronRight size={16} className="shrink-0 self-center text-gray-300" />
                      </button>
                    );})}
                  </div>
                  </>
                ) : (
                  <p className="mt-2 text-[11px] text-baylink-muted">TA 还没有发布过内容</p>
                )}
              </div>

              <p className="mt-4 flex items-start gap-1.5 rounded-xl bg-baylink-section/40 px-3 py-2.5 text-[11px] leading-relaxed text-baylink-muted">
                <Shield size={12} className="mt-px shrink-0 text-baylink-green/60" />
                交易前请核实对方信息，不要提前转账。遇到可疑行为可以举报或屏蔽。
              </p>
            </>
          )}
        </div>
        {!loading && profile && currentUser?.id !== profile.id && (
          <div className="border-t border-baylink-border/40 px-5 py-4 space-y-2">
            <button
              type="button"
                onClick={handleChat}
                disabled={openingChat || !onChat || !!isBlocked || !!profile.viewerIsBlockedByUser}
                className="w-full rounded-xl bg-baylink-green py-3 text-sm font-semibold text-white shadow-rest transition hover:bg-baylink-green-hover active:scale-[0.98] disabled:opacity-50"
            >
                {openingChat ? '正在打开聊天…' : isBlocked || profile.viewerIsBlockedByUser ? '当前无法私信' : currentUser ? '发私信' : '登录后发私信'}
            </button>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  if (!currentUser) { onLoginNeeded?.(); return; }
                  onReportUser?.(profile.id);
                }}
                className="flex flex-1 items-center justify-center gap-1 rounded-xl border border-baylink-border/60 py-2.5 text-xs font-semibold text-baylink-text-secondary hover:bg-baylink-section/50"
              >
                <Flag size={13} /> 举报用户
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!currentUser) { onLoginNeeded?.(); return; }
                  onToggleBlockUser?.(profile.id);
                }}
                className="flex flex-1 items-center justify-center gap-1 rounded-xl border border-baylink-border/60 py-2.5 text-xs font-semibold text-baylink-text-secondary hover:bg-baylink-section/50"
              >
                <UserX size={13} /> {isBlocked ? '取消屏蔽' : '屏蔽用户'}
              </button>
            </div>
          </div>
        )}
      </div>
    </ModalShell>
  );
};
