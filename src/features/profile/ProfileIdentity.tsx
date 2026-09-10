import { useState, type ReactNode } from 'react';
import { ExternalLink, Instagram, Linkedin, MapPin, Share2, Sparkles } from 'lucide-react';
import Avatar from '../../components/Avatar';
import { TrustBadge } from '../../components/TrustBadge';
import { formatProfileLocation, normalizeInstagramUrl } from '../../lib/format';
import { translateText, useLocale } from '../../i18n/locale';
import type { UserData } from '../../lib/types';
import { resolveProfileTheme, safeProfileLink, profileShareUrl } from './profile-personality';

export type ProfileIdentityData = Pick<UserData, 'nickname' | 'avatar' | 'bio' | 'city' | 'area' | 'profileTags' | 'interests' | 'website' | 'xiaohongshu' | 'socialLinks' | 'role' | 'isPhoneVerified' | 'isOfficialVerified' | 'officialVerification'> & {
  profileTheme?: string; statusText?: string; coverImage?: string;
};

export function ProfileIdentity({ profile, children, preview = false }: { profile: ProfileIdentityData; children?: ReactNode; preview?: boolean }) {
  const theme = resolveProfileTheme(profile.profileTheme);
  const [failedCover, setFailedCover] = useState('');
  const location = formatProfileLocation(profile.area, profile.city);
  const tags = profile.profileTags?.filter(Boolean) || [];
  const interests = profile.interests?.filter(Boolean) || [];
  const instagram = profile.socialLinks?.instagram ? safeProfileLink(normalizeInstagramUrl(profile.socialLinks.instagram) || '') : null;
  const linkedin = safeProfileLink(profile.socialLinks?.linkedin);
  const website = safeProfileLink(profile.website);
  const xhs = profile.xiaohongshu?.trim();
  const xhsUrl = xhs && /^https?:\/\//i.test(xhs) ? safeProfileLink(xhs) : null;
  return <section className={`profile-identity profile-theme-${theme}${preview ? ' profile-identity--preview' : ''}`} aria-label={preview ? '名片即时预览' : '公开个人名片'} data-profile-theme={theme}>
    <div className="profile-identity-cover">
      <div className="profile-identity-landscape" aria-hidden="true"><span /><span /><span /></div>
      {profile.coverImage && failedCover !== profile.coverImage && <img src={profile.coverImage} alt="个人封面" onError={() => setFailedCover(profile.coverImage || '')} />}
      <span className="profile-identity-stamp">BAYLINK · BAY AREA</span>
    </div>
    <div className="profile-identity-body">
      <div className="profile-identity-avatar"><Avatar src={profile.avatar} name={profile.nickname} size={24} theme={theme} className="profile-avatar-image" /></div>
      <div className="profile-identity-name"><h2 translate="no">{profile.nickname || 'BAYLINK'}</h2><TrustBadge user={{ ...profile, profileTheme: theme }} size={15} /></div>
      {location && <p className="profile-identity-location"><MapPin size={14} aria-hidden="true" /><span translate="no">{location}</span></p>}
      {profile.statusText?.trim() && <p className="profile-identity-status"><Sparkles size={14} aria-hidden="true" /><span translate="no">{profile.statusText.trim()}</span></p>}
      <p className="profile-identity-bio">{profile.bio?.trim() ? <span translate="no">{profile.bio.trim()}</span> : '一点兴趣，一段日常，都是认识你的开始。'}</p>
      {tags.length > 0 && <div className="profile-identity-tags" aria-label="身份标签">{tags.map(tag => <span key={tag} translate="no">{tag}</span>)}</div>}
      {interests.length > 0 && <div className="profile-identity-interests" aria-label="兴趣">{interests.map(tag => <span key={tag} translate="no">{tag}</span>)}</div>}
      {(instagram || linkedin || website || xhs) && <div className="profile-identity-social" aria-label="社交链接">
        {instagram && <a href={instagram} target="_blank" rel="noopener noreferrer"><Instagram size={14} />Instagram</a>}
        {linkedin && <a href={linkedin} target="_blank" rel="noopener noreferrer"><Linkedin size={14} />LinkedIn</a>}
        {website && <a href={website} target="_blank" rel="noopener noreferrer"><ExternalLink size={14} />个人网站</a>}
        {xhs && (xhsUrl ? <a href={xhsUrl} target="_blank" rel="noopener noreferrer"><ExternalLink size={14} />小红书</a> : <span>小红书 · <span translate="no">{xhs}</span></span>)}
      </div>}
      {children && <div className="profile-identity-actions">{children}</div>}
    </div>
  </section>;
}


export function ProfileShareButton({ userId, nickname }: { userId: string; nickname: string }) {
  const locale = useLocale();
  const [status, setStatus] = useState('');
  const [fallback, setFallback] = useState(false);
  const url = profileShareUrl(userId, locale);
  const share = async () => {
    setFallback(false); setStatus('');
    if (navigator.share) {
      try { await navigator.share({ title: `${nickname} · BAYLINK`, text: translateText('在 BAYLINK 认识这位湾区邻居。', locale), url }); return; }
      catch (error) { if (error instanceof Error && error.name === 'AbortError') return; }
    }
    try { await navigator.clipboard.writeText(url); setStatus('名片链接已复制。'); }
    catch { setFallback(true); setStatus('请复制下方名片链接。'); }
  };
  return <div className="profile-share"><button type="button" onClick={share}><Share2 size={15} />分享名片</button>{status && <p role="status">{status}</p>}{fallback && <label><span>名片分享链接</span><input aria-label="名片分享链接" readOnly value={url} onFocus={event => event.currentTarget.select()} /></label>}</div>;
}
