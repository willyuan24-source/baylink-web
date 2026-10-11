// The site chrome (WEB-SHELL2): skip link, header, <main>, global footer and the phone tab bar. Pure props, no data
// reads: AppLayout renders it with the live session, scripts/prerender.tsx with an anonymous reader, so the first paint of
// every prerendered page is this same markup (FA-07, REG-06; tests/site-chrome-parity.test.tsx compares the two).
import type { ReactNode } from 'react';
import { Link, type Location } from 'react-router-dom';
import { CalendarDays, LogOut, MessageCircle, Search, Settings, UserRound } from 'lucide-react';
import Avatar from './Avatar';
import { SiteNavigation } from './SiteNavigation';
import { SiteMobileNavigation } from './SiteMobileNavigation';
import { ReadingPreferencesButton } from './ReadingPreferences';
import { LanguageSwitcher } from './LanguageSwitcher';
import { useDisclosure } from './useDisclosure';
import { openSiteFeedback } from './site-feedback';
import { translateText, useLocale } from '../i18n/locale';
import { matchRoute } from '../app/route-table';
import { unprefixedPath } from '../lib/language-path';
import type { UserData } from '../lib/types';
import './site-chrome.css';

export type SiteChromeProps = {
  /** The real pathname: a post or profile overlay URL renders over a background page. */
  pathname: string;
  user: UserData | null;
  /** Unread messages plus pending contact requests, capped at 99 (G1). */
  messagesCount: number;
  onAsk: () => void;
  onSearch: () => void;
  /** Opens the sign-in dialog (a reader who is not signed in). */
  onLogin: () => void;
  /** 更多 → 账号设置 / 登录 (SiteNavigation's OPUS-contract prop). */
  onAccount: () => void;
  /** SiteNavigation's OPUS-contract prop; 发布 lives inside 邻里 only (G16). */
  onCreate: () => void;
  onLogout: () => void;
  /** AppLayout's router location (the language switch keeps an open overlay's real URL). */
  realLocation?: Location;
  children: ReactNode;
  /** Toasts, dialogs and overlays, after the chrome inside .site-app. */
  overlays?: ReactNode;
  /** Prerender only: the page this <main> was rendered for (boot-main.ts keeps it on screen until the app's page is ready). */
  prerenderPath?: string;
};

const noop = () => {};

export function SiteChrome({ pathname, user, messagesCount, onAsk, onSearch, onLogin, onAccount, onCreate, onLogout, realLocation, children, overlays, prerenderPath }: SiteChromeProps) {
  const locale = useLocale();
  const english = locale === 'en';
  const t = (zh: string, en: string) => english ? en : translateText(zh, locale);
  const path = unprefixedPath(pathname).replace(/\/$/, '') || '/';
  const route = matchRoute(path);
  const unread = messagesCount > 0;
  return <div className="site-app font-sans" data-chrome={route?.chrome}>
    <a href="#scroll-container" className="site-skip-link">{t('跳到主要内容', 'Skip to main content')}</a>
    <div className="site-workspace">
      <header className="site-topbar">
        <div className="site-topbar-inner">
          <SiteNavigation active={route?.section || ''} category="全部" homeActive={path === '/'} pathname={path} user={user} notification={unread} notificationCount={messagesCount} onCreate={onCreate} onAsk={onAsk} onAccount={onAccount} />
          <div className="site-header-utilities">
            <button type="button" className="site-command-trigger" onClick={onSearch} aria-label={t('搜索活动、指南，或问 BayBay', 'Search events and guides, or ask BayBay')} aria-keyshortcuts="Control+k Meta+k" title="Ctrl / ⌘ K">
              <Search size={20} aria-hidden="true" strokeWidth={1.75} /><span className="site-command-placeholder" aria-hidden="true">{t('搜活动、指南或问 BayBay', 'Search events, guides or ask BayBay')}</span>
            </button>
            <ReadingPreferencesButton />
            <LanguageSwitcher realLocation={realLocation} />
            {user ? <AccountMenu user={user} messagesCount={messagesCount} onLogout={onLogout} /> : <div className="site-topbar-actions"><button type="button" className="site-topbar-account" onClick={onLogin}><UserRound size={20} aria-hidden="true" strokeWidth={1.75} /><span>{t('登录', 'Sign in')}</span></button></div>}
          </div>
        </div>
      </header>
      <main className="site-main" id="scroll-container" tabIndex={-1} data-prerender-path={prerenderPath}>{children}</main>
      <SiteFooter />
      <SiteMobileNavigation pathname={path} notificationCount={messagesCount} hasNotification={unread} onAsk={onAsk} />
    </div>
    {overlays}
  </div>;
}

/** Desktop account menu (design.md §4.13): 消息 n · 我的这周 · 设置 · 退出. On phones the 我的 tab stands in for it. */
function AccountMenu({ user, messagesCount, onLogout }: { user: UserData; messagesCount: number; onLogout: () => void }) {
  const locale = useLocale();
  const english = locale === 'en';
  const t = (zh: string, en: string) => english ? en : translateText(zh, locale);
  const { details, summary, close } = useDisclosure();
  const unread = messagesCount > 0;
  return <div className="site-topbar-actions">
    <details className="site-account-menu" ref={details}>
      <summary ref={summary} className="site-topbar-account" aria-label={unread ? t(`账号菜单，消息 ${messagesCount} 条未读`, `Account menu, ${messagesCount} unread messages`) : t('账号菜单', 'Account menu')}>
        <Avatar theme={user.profileTheme} src={user.avatar} name={user.nickname} size={8} />
        {unread && <b className="site-header-notification" aria-hidden="true">{messagesCount}</b>}
      </summary>
      <div className="site-account-panel">
        <p className="site-account-name" translate="no">{user.nickname}</p>
        <nav aria-label={t('我的账号', 'My account')}>
          <Link to="/messages"><MessageCircle size={18} aria-hidden="true" strokeWidth={1.75} />{t('消息', 'Messages')}{unread && <b className="site-unread" aria-label={t(`${messagesCount} 条未读`, `${messagesCount} unread`)}>{messagesCount}</b>}</Link>
          <Link to="/my-week"><CalendarDays size={18} aria-hidden="true" strokeWidth={1.75} />{t('我的这周', 'My week')}</Link>
          <Link to="/me"><Settings size={18} aria-hidden="true" strokeWidth={1.75} />{t('设置', 'Settings')}</Link>
        </nav>
        <button type="button" onClick={() => { close(); onLogout(); }}><LogOut size={18} aria-hidden="true" strokeWidth={1.75} />{t('退出登录', 'Sign out')}</button>
      </div>
    </details>
  </div>;
}

/**
 * The global footer (plan §1): 关于与核验方法 · 反馈 · 内容目录 · 条款 · 隐私 · 短信说明, 13 px text on 44 px targets.
 * 反馈 is a button (WEB-FEEDBACK's sheet), so the prerendered footer has only same-language links (verify-release).
 */
export function SiteFooter({ onFeedback = openSiteFeedback }: { onFeedback?: () => void }) {
  const locale = useLocale();
  const english = locale === 'en';
  const t = (zh: string, en: string) => english ? en : translateText(zh, locale);
  return <footer className="site-footer">
    <div className="site-footer-inner">
      <p className="site-footer-brand"><strong>BAYLINK</strong><span>{t('湾区去哪、怎么办 · 有来源的中文答案', 'Where to go and how to get it done in the Bay, with sources')}</span></p>
      <nav aria-label={t('关于与帮助', 'About and help')}>
        <Link to="/about">{t('关于与核验方法', 'About & how we verify')}</Link>
        <button type="button" onClick={onFeedback}>{t('反馈', 'Feedback')}</button>
        <Link to="/archive">{t('内容目录', 'Directory')}</Link>
        <Link to="/terms">{t('条款', 'Terms')}</Link>
        <Link to="/privacy">{t('隐私', 'Privacy')}</Link>
        <Link to="/sms-consent">{t('短信说明', 'SMS terms')}</Link>
      </nav>
    </div>
  </footer>;
}

/** The chrome as the prerender paints it: an anonymous reader, no handlers (the app replaces it on boot). */
export function AnonymousSiteChrome({ pathname, children }: { pathname: string; children: ReactNode }) {
  return <SiteChrome pathname={pathname} user={null} messagesCount={0} onAsk={noop} onSearch={noop} onLogin={noop} onAccount={noop} onCreate={noop} onLogout={noop} prerenderPath={pathname}>{children}</SiteChrome>;
}
