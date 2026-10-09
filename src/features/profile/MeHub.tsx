// 我的 /me hub pieces (WEB-ACCOUNT): the 2×2 tiles with 消息 first, the settings list and its sheets, the signed-out
// invitation. Copy is co-located t(zh, en); zh-Hant is the runtime conversion.
import { useState, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Bell, CalendarDays, ChevronRight, FileText, Globe2, Info, LifeBuoy, MessageCircle, ShieldCheck, Type, Users, type LucideIcon } from 'lucide-react';
import { Sheet } from '../../components/ui/Sheet';
import { Button } from '../../components/ui/Button';
import { useUiCopy } from '../../components/ui/ui-copy';
import { ReadingPreferencesCard } from '../../components/ReadingPreferences';
import { navigateSiteLanguage } from '../../components/LanguageRouter';
import { localizedUrl, setLocale, type Locale } from '../../i18n/locale';
import { useReadingSize, useSimpleDisplay } from '../../lib/reading-preferences';
import { useReaderLibrary } from '../../lib/reader-library';
import { useSavedPosts } from '../../lib/savedPosts';
import type { Library } from '../../lib/planner';
import './me-hub.css';

/** The site's positioning sentence (index.html title, manifest, About), shown under the name on /me (PROD-10). */
export function MePositioning() {
  const { t } = useUiCopy();
  return <p className="me-hub__positioning">{t('湾区去哪、怎么办——有来源的中文答案', 'Bay Area plans and practical answers, with sources')}</p>;
}

/**
 * The My Week count: the same set the My Week shelf lists (planner favorites, saved guides and saved listings).
 * null while the account library is still loading, so the tile never shows a wrong 0.
 * TODO(WEB-SAVES): replace with useSavedCount() from src/lib/saves.ts once it is on main.
 */
export function useMyWeekSavedCount(userId: string | undefined, library: { ready: boolean; data: Library }): number | null {
  const reader = useReaderLibrary();
  const posts = useSavedPosts(userId);
  if (!library.ready) return null;
  const keys = new Set(library.data.favorites.map(favorite => `${favorite.kind}:${favorite.id}`));
  for (const slug of reader.saved) keys.add(`guide:${slug}`);
  for (const post of posts) keys.add(`post:${post.id}`);
  return keys.size;
}

type TileProps = { icon: LucideIcon; title: string; detail?: string; primary?: boolean; badge?: { count: number; label: string } };
function TileBody({ icon: Icon, title, detail, badge }: TileProps) {
  return <>
    <span className="me-tile__icon" aria-hidden="true"><Icon strokeWidth={1.75} /></span>
    <span className="me-tile__title">{title}</span>
    {detail && <span className="me-tile__detail">{detail}</span>}
    {badge && badge.count > 0 && <b className="me-tile__badge" aria-label={badge.label}>{badge.count > 99 ? '99+' : badge.count}</b>}
  </>;
}

export type MeTilesProps = {
  signedIn: boolean;
  /** Unread messages plus pending contact requests (the header badge, app context messagesBadgeCount). */
  messagesCount: number;
  savedCount: number | null;
  onMyPosts?: () => void;
  onLogin?: () => void;
};

/** 消息 · 我的这周 · 我的发布 · 小队与预约 — each at least 88px tall; 消息 is first and carries the unread count (G1). */
export function MeTiles({ signedIn, messagesCount, savedCount, onMyPosts, onLogin }: MeTilesProps) {
  const { t } = useUiCopy();
  const unread = Math.max(0, Math.floor(messagesCount) || 0);
  const messageDetail = !signedIn ? t('登录后查看私信与联系请求', 'Sign in to see messages and contact requests')
    : unread ? t(`${unread} 条未读`, `${unread} unread`) : t('私信与联系请求', 'Messages and contact requests');
  const weekDetail = savedCount === null ? t('收藏与计划', 'Saved items and plans') : t(`收藏 ${savedCount} 项`, `${savedCount} saved`);
  return <ul className="me-tiles" aria-label={t('我的常用', 'My shortcuts')}>
    <li><Link to="/messages" className="me-tile" data-primary="" aria-label={unread ? t(`消息，${unread} 条未读`, `Messages, ${unread} unread`) : undefined}>
      <TileBody icon={MessageCircle} title={t('消息', 'Messages')} detail={messageDetail} badge={signedIn ? { count: unread, label: t(`${unread} 条未读`, `${unread} unread`) } : undefined} />
    </Link></li>
    <li><Link to="/my-week" className="me-tile"><TileBody icon={CalendarDays} title={t('我的这周', 'My week')} detail={weekDetail} /></Link></li>
    <li>{signedIn
      ? <button type="button" className="me-tile" onClick={onMyPosts}><TileBody icon={FileText} title={t('我的发布', 'My posts')} detail={t('管理帖子与发布状态', 'Manage your posts')} /></button>
      : <button type="button" className="me-tile" onClick={onLogin}><TileBody icon={FileText} title={t('我的发布', 'My posts')} detail={t('登录后管理', 'Sign in to manage')} /></button>}</li>
    <li><div className="me-tile">
      <span className="me-tile__icon" aria-hidden="true"><Users strokeWidth={1.75} /></span>
      <span className="me-tile__title">{t('小队与预约', 'Groups and bookings')}</span>
      <span className="me-tile__links">
        <Link to="/together?view=mine">{t('我的小队', 'My groups')}<ChevronRight size={16} aria-hidden="true" /></Link>
        <Link to="/me/bookings">{t('服务预约', 'Service bookings')}<ChevronRight size={16} aria-hidden="true" /></Link>
      </span>
    </div></li>
  </ul>;
}

type RowProps = { icon: LucideIcon; label: string; value?: string; tone?: 'danger' };
function RowBody({ icon: Icon, label, value }: RowProps) {
  return <>
    <Icon aria-hidden="true" strokeWidth={1.75} />
    <span className="me-row__text"><span className="me-row__label">{label}</span>{value && <span className="me-row__value">{value}</span>}</span>
    <ChevronRight aria-hidden="true" strokeWidth={1.75} />
  </>;
}
/** A settings row: a router link (`to`) or a button (`onClick`); 56px tall (60 in 简洁显示). */
export function MeRow(props: RowProps & ({ to: string; onClick?: undefined } | { onClick: () => void; to?: undefined })) {
  const { to, onClick, tone } = props;
  return to
    ? <Link to={to} className="me-row" data-tone={tone}><RowBody {...props} /></Link>
    : <button type="button" className="me-row" data-tone={tone} onClick={onClick}><RowBody {...props} /></button>;
}
export function MeList({ children, label }: { children: ReactNode; label: string }) {
  return <ul className="me-list" aria-label={label}>{children}</ul>;
}

const LANGUAGES: Array<{ id: Locale; label: string }> = [
  { id: 'zh-Hans', label: '简体中文' }, { id: 'zh-Hant', label: '繁體中文' }, { id: 'en', label: 'English' },
];

/** 字号与简洁显示 · 语言 rows with their sheets. Shared by the signed-in and signed-out hub. */
export function MeDisplaySettings() {
  const { t, locale } = useUiCopy();
  const location = useLocation();
  const size = useReadingSize();
  const simple = useSimpleDisplay();
  const [sheet, setSheet] = useState<'' | 'reading' | 'language'>('');
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const sizeLabel = size === 'extra-large' ? t('特大', 'Extra large') : size === 'large' ? t('大', 'Large') : t('标准', 'Standard');
  const readingValue = simple ? `${sizeLabel} · ${t('简洁显示已开启', 'Simple display on')}` : sizeLabel;
  const choose = async (next: Locale) => {
    if (busy) return;
    if (next === locale) { setSheet(''); return; }
    setBusy(true); setFailed(false);
    try {
      if (await setLocale(next, true, location.pathname)) navigateSiteLanguage(localizedUrl(location.pathname + location.search + location.hash, next));
      setSheet('');
    } catch { setFailed(true); }
    finally { setBusy(false); }
  };
  return <>
    <li><MeRow icon={Type} label={t('字号与简洁显示', 'Text size and simple display')} value={readingValue} onClick={() => setSheet('reading')} /></li>
    <li><MeRow icon={Globe2} label={t('语言', 'Language')} value={LANGUAGES.find(item => item.id === locale)?.label} onClick={() => setSheet('language')} /></li>
    <Sheet open={sheet === 'reading'} onClose={() => setSheet('')} title={t('字号与简洁显示', 'Text size and simple display')}>
      <ReadingPreferencesCard />
    </Sheet>
    <Sheet open={sheet === 'language'} onClose={() => setSheet('')} title={t('语言', 'Language')}>
      <ul className="me-language" translate="no">{LANGUAGES.map(item => <li key={item.id}>
        <button type="button" lang={item.id} aria-pressed={item.id === locale} disabled={busy} onClick={() => void choose(item.id)}>{item.label}</button>
      </li>)}</ul>
      {failed && <p role="alert" className="me-language-error">{t('语言加载失败，请重试。', 'Could not load this language. Please try again.')}</p>}
    </Sheet>
  </>;
}

/** Rows that need an account (通知, 隐私与账号) plus help; `view` opens the sub-view with a shareable URL (?view=…). */
export function MeAccountRows({ onView }: { onView: (view: 'notifications' | 'privacy' | 'support') => void }) {
  const { t } = useUiCopy();
  return <>
    <li><MeRow icon={Bell} label={t('通知', 'Notifications')} value={t('邮件与短信提醒', 'Email and SMS reminders')} onClick={() => onView('notifications')} /></li>
    <li><MeRow icon={ShieldCheck} label={t('隐私与账号', 'Privacy and account')} value={t('导出资料、退出所有登录、注销账号', 'Export data, sign out everywhere, delete account')} onClick={() => onView('privacy')} /></li>
    <li><MeRow icon={LifeBuoy} label={t('反馈与客服', 'Feedback and help')} value={t('告诉我们哪里不对', 'Tell us what is wrong')} onClick={() => onView('support')} /></li>
  </>;
}

export function MeAboutRow() {
  const { t } = useUiCopy();
  return <li><MeRow icon={Info} to="/about" label={t('关于与核验方法', 'About and how we verify')} /></li>;
}

export function MeLegal() {
  const { t } = useUiCopy();
  return <nav className="me-legal" aria-label={t('条款与隐私', 'Terms and privacy')}>
    <a href="/terms">{t('服务条款', 'Terms of service')}</a>
    <a href="/privacy">{t('隐私政策', 'Privacy policy')}</a>
    <a href="/sms-consent">{t('短信条款', 'SMS terms')}</a>
  </nav>;
}

/** Signed out: one honest invitation, then what still works on this device. */
export function MeGuestCard({ onLogin }: { onLogin: () => void }) {
  const { t } = useUiCopy();
  return <section className="me-guest-card" aria-labelledby="me-guest-title">
    <h2 id="me-guest-title">{t('登录后，BayBay 能帮你更多', 'Sign in and BayBay can do more for you')}</h2>
    <ul>
      <li>{t('收到私信和联系请求，一处查看', 'Messages and contact requests in one place')}</li>
      <li>{t('收藏和计划跟着账号走，换手机也在', 'Saved items and plans follow your account')}</li>
      <li>{t('参加小队、预约本地服务', 'Join groups and book local services')}</li>
    </ul>
    <Button variant="primary" onClick={onLogin}>{t('登录 / 注册', 'Sign in / Register')}</Button>
  </section>;
}
