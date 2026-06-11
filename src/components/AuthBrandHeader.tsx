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
  <div className={`flex flex-col items-center text-center ${compact ? 'mb-4' : 'mb-5'}`}>
    <div className="mb-2 flex items-center gap-2">
      <img
        src={BRAND.baybayAvatar}
        alt=""
        className={`${compact ? 'h-8 w-8 rounded-lg' : 'h-9 w-9 rounded-xl'} shrink-0 object-cover ring-1 ring-baylink-green/20`}
        width={compact ? 32 : 36}
        height={compact ? 32 : 36}
      />
      <span className={`${compact ? 'text-base' : 'text-lg'} font-bold tracking-tight text-baylink-text`}>
        BAYLINK
      </span>
    </div>
    <p className="max-w-[220px] text-[11px] leading-relaxed text-baylink-muted">{tagline}</p>
  </div>
);
