import { BRAND } from '../brandAssets';

type AuthBrandHeaderProps = {
  /** The positioning line, already in the reader's language (LoginModal: 湾区去哪、怎么办 · 有来源的中文答案, H34). */
  tagline: string;
  compact?: boolean;
};

/** Shared BAYLINK lockup for auth-related modals */
export const AuthBrandHeader = ({
  tagline,
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
