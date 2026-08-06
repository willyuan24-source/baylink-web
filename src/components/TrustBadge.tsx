// ✨ 信任徽章（委托 UserTrustBadges 组件）
import { UserTrustBadges } from './UserTrustBadges';
import type { UserData } from '../lib/types';

export const TrustBadge = ({ user, size = 16, showText = false, adminCompact = false }: { user: Partial<UserData>; size?: number; showText?: boolean; adminCompact?: boolean }) => (
  <UserTrustBadges user={user} size={size} showText={showText} adminCompact={adminCompact} />
);
