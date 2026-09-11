// 用户公开资料弹层（湾区生活名片）
import { useState, useEffect, useCallback, useRef } from 'react';
import {
  X, Shield, ChevronRight, Flag, UserX, Sparkles,
} from 'lucide-react';
import { api } from '../../lib/api';
import { ModalShell } from '../../components/ui/Modal';
import { ProfileCardSkeleton } from '../../components/ui/Skeleton';
import { isPlatformAdmin } from '../../components/UserTrustBadges';
import { normalizePostImages } from '../../lib/constants';
import {
  getJoinDays,
  getPhoneVerificationTrustLabel, getOfficialTypeLabel, friendlyErrorMessage,
} from '../../lib/format';
import type { PublicUserProfile, UserData } from '../../lib/types';
import { ProfileIdentity, ProfileShareButton } from '../profile/ProfileIdentity';
import { commonProfileInterests } from '../profile/profile-personality';
import { translateText, useLocale } from '../../i18n/locale';

type UserProfileModalProps = {
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
};
export const UserProfileModal = (props: UserProfileModalProps) => <UserProfileSession key={props.userId} {...props} />;
const UserProfileSession = ({ userId, onClose, currentUser, onChat, onOpenRecentPost, showToast, onReportUser, onToggleBlockUser, blockedUserIds, onLoginNeeded }: UserProfileModalProps) => {
  const locale = useLocale();
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
      setProfile(null);
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
  }, [userId, currentUser?.id, currentUser?.token]);

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
  const commonInterests = currentUser?.id !== profile?.id ? commonProfileInterests(currentUser?.interests, profile?.interests) : [];
  const isBlocked = profile ? (blockedUserIds ? blockedUserIds.includes(profile.id) : profile.viewerHasBlockedUser) : false;

  return (
    <ModalShell onClose={onClose} label="湾区生活名片" className="fixed inset-0 z-[110] flex items-center justify-center bg-black/45 px-4 py-6 backdrop-blur-sm">
      <div className="flex max-h-[86vh] w-full max-w-lg flex-col overflow-hidden rounded-[28px] bg-baylink-bg-alt shadow-2xl" onClick={(e) => e.stopPropagation()}>
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
              <ProfileIdentity profile={profile}>
                <ProfileShareButton userId={profile.id} nickname={profile.nickname} />
              </ProfileIdentity>
              {isPlatformAdmin(profile) && <p className="profile-admin-note">该账号为 BAYLINK 平台管理员，用于发布平台公告、湾区指南、推荐内容和安全提醒。</p>}
              {commonInterests.length > 0 && <section className="profile-common-interests" aria-label="你们的共同兴趣"><h3><Sparkles size={15} />你们的共同兴趣</h3><p>从共同喜欢的事，开始一段对话。</p><div>{commonInterests.map(interest => <span key={interest} translate="no">{interest}</span>)}</div></section>}

              <div className="mt-3 rounded-xl border border-baylink-border/40 bg-white p-3 text-[11px] text-baylink-text-secondary">
                <p className="font-semibold text-baylink-text mb-2 text-xs">信任信息</p>
                <div className="space-y-1.5">
                  {joinDays != null && <p>{translateText('已加入 BAYLINK {days} 天', locale).replace('{days}', String(joinDays))}</p>}
                  <p>{translateText('已发布 {count} 条本地信息', locale).replace('{count}', String(profile.postCount))}</p>
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
                          <div className="line-clamp-1 text-sm font-semibold text-baylink-text" translate="no">{rp.title}</div>
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
        {!loading && !failed && profile && currentUser?.id !== profile.id && (
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
