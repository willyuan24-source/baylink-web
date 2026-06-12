import { BadgeCheck, Shield, ShieldCheck } from 'lucide-react';

export type TrustBadgeUser = {
  role?: string;
  isAdmin?: boolean;
  isPhoneVerified?: boolean;
  isOfficialVerified?: boolean;
};

export const isPlatformAdmin = (user?: TrustBadgeUser | null) =>
  !!user && (user.isAdmin === true || user.role === 'admin');

type AdminBadgeProps = {
  size?: number;
  showText?: boolean;
  compact?: boolean;
};

export const AdminBadge = ({ size = 12, showText = true, compact = false }: AdminBadgeProps) => (
  <span
    className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-emerald-600 to-teal-600 px-2 py-0.5 font-semibold text-white shadow-sm"
    title="BAYLINK 平台管理员"
  >
    <Shield size={size} className="shrink-0" />
    {showText && (
      <span className="text-[10px] leading-none">{compact ? '管理员' : 'BAYLINK 管理员'}</span>
    )}
  </span>
);

type UserTrustBadgesProps = {
  user?: TrustBadgeUser | null;
  size?: number;
  showText?: boolean;
  /** Shorter admin label for tight spaces (e.g. comments) */
  adminCompact?: boolean;
};

export const UserTrustBadges = ({
  user,
  size = 16,
  showText = false,
  adminCompact = false,
}: UserTrustBadgesProps) => {
  if (!user) return null;

  if (isPlatformAdmin(user)) {
    return (
      <span className="inline-flex flex-wrap items-center gap-1">
        <AdminBadge size={size} showText={showText} compact={adminCompact} />
        {user.isPhoneVerified && (
          <span
            className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-1.5 py-0.5 text-blue-600"
            title="手机验证已完成"
          >
            <ShieldCheck size={size} fill="#3B82F6" className="text-white" />
            {showText && <span className="text-[10px] font-bold">已验证</span>}
          </span>
        )}
      </span>
    );
  }

  const phoneVerified = !!user.isPhoneVerified;
  const officialVerified = !!user.isOfficialVerified;
  if (!phoneVerified && !officialVerified) return null;

  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      {phoneVerified && (
        <span
          className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-1.5 py-0.5 text-blue-600"
          title="手机验证已完成"
        >
          <ShieldCheck size={size} fill="#3B82F6" className="text-white" />
          {showText && <span className="text-[10px] font-bold">已验证</span>}
        </span>
      )}
      {officialVerified && (
        <span
          className="inline-flex items-center gap-1 rounded-full border border-yellow-200 bg-yellow-50 px-1.5 py-0.5 text-yellow-600"
          title="BAYLINK 官方认证账号"
        >
          <BadgeCheck size={size} fill="#FBBF24" className="text-white" />
          {showText && <span className="text-[10px] font-bold">官方认证</span>}
        </span>
      )}
    </span>
  );
};
