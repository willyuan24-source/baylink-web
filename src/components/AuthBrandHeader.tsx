import { BRAND } from '../brandAssets';

type AuthBrandHeaderProps = {
  tagline?: string;
  compact?: boolean;
};

/** Shared BAYLINK lockup for auth-related modals */
export const AuthBrandHeader = ({
  tagline = '连接湾区真实生活信息',
  compact = false,
}: AuthBrandHeaderProps) => (
  <div className={`member-auth-brand ${compact ? 'member-auth-brand--compact' : ''}`}>
    <div className="member-auth-lockup">
      <img
        src={BRAND.baybayAvatar}
        alt=""
        className="member-auth-mascot"
        width={compact ? 32 : 36}
        height={compact ? 32 : 36}
      />
      <span className="member-auth-wordmark">
        BAYLINK
      </span>
    </div>
    <p className="member-auth-tagline">{tagline}</p>
  </div>
);
