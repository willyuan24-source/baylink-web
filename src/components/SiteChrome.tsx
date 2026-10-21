// The site chrome (WEB-SHELL2): skip link, header, <main>, global footer and the phone tab bar. Pure props, no data
// reads: AppLayout renders it with the live session, scripts/prerender.tsx with an anonymous reader, so the first paint of
// every prerendered page is this same markup (FA-07, REG-06; tests/site-chrome-parity.test.tsx compares the two).
import { Suspense, useEffect, useState, type ReactNode } from 'react';
import { Link, useLocation, type Location } from 'react-router-dom';
import { Search, UserRound } from 'lucide-react';
import { SiteNavigation } from './SiteNavigation';
import { SiteMobileNavigation } from './SiteMobileNavigation';
import { ReadingPreferencesButton } from './ReadingPreferences';
import { LanguageSwitcher } from './LanguageSwitcher';
import { lazyChunk } from '../lib/chunk-recovery';
import { ChunkBoundary } from './ChunkBoundary';
import { openSiteFeedback } from './site-feedback';
import { translateText, useLocale } from '../i18n/locale';
import { matchRoute } from '../app/route-table';
import { unprefixedPath } from '../lib/language-path';
import { METHOD_HREF, SITE_IDENTITY, footerClaim, primaryNavigationPath } from '../lib/ui-navigation';
import { scrollBehavior } from '../lib/motion';
import type { UserData } from '../lib/types';
import './site-chrome.css';

// The signed-in account menu (avatar, 消息, 我的这周, 设置, 退出) is its own chunk: a guest never needs it, and the shell
// every page downloads stays at its budget. A same-size placeholder holds its box while it loads, or if it cannot load
// (ChunkBoundary).
const loadAccountMenu = () => import('./AccountMenu');
const AccountMenu = lazyChunk(loadAccountMenu, m => m.AccountMenu);

export type SiteChromeProps = {
  /** The real pathname: a post or profile overlay URL renders over a background page. */
  pathname: string;
  user: UserData | null;
  /** Unread messages plus pending contact requests, capped at 99 (G1). */
  messagesCount: number;
  onAsk: () => void;
  onSearch: () => void;
  /** A header control's own chunk (the Aa sheet) could not load: AppLayout says so in a toast; the page stays. */
  onUnavailable?: (lostChunk: boolean) => void;
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

export function SiteChrome({ pathname, user, messagesCount, onAsk, onSearch, onAccount, onCreate, onLogout, onUnavailable, realLocation, children, overlays, prerenderPath }: SiteChromeProps) {
  const locale = useLocale();
  const english = locale === 'en';
  const t = (zh: string, en: string) => english ? en : translateText(zh, locale);
  const path = unprefixedPath(pathname).replace(/\/$/, '') || '/';
  const route = matchRoute(path);
  const unread = messagesCount > 0;
  // The one account tool (content arrangement §2): 我的 for a guest, the avatar menu once signed in. On /me it is the page;
  // on its sub-pages (/my-week, /me/bookings, /messages) it marks the section.
  const mine = primaryNavigationPath(path) === '/me' ? path === '/me' ? 'page' : 'true' : undefined;
  const accountBox = <span className="site-topbar-actions"><span className="site-topbar-account site-tool" aria-hidden="true" /></span>;
  return <div className="site-app font-sans" data-chrome={route?.chrome}>
    <a href="#scroll-container" className="site-skip-link">{t('跳到主要内容', 'Skip to main content')}</a>
    <div className="site-workspace">
      <header className="site-topbar">
        <div className="site-topbar-inner">
          <SiteNavigation active={route?.section || ''} category="全部" homeActive={path === '/'} pathname={path} user={user} notification={unread} notificationCount={messagesCount} onCreate={onCreate} onAsk={onAsk} onAccount={onAccount} />
          <div className="site-header-utilities">
            <button type="button" className="site-command-trigger site-tool" onClick={onSearch} aria-label={t('搜索活动、指南，或问 BayBay', 'Search events and guides, or ask BayBay')} aria-keyshortcuts="Control+k Meta+k" title="Ctrl / ⌘ K">
              <Search size={20} aria-hidden="true" strokeWidth={1.75} /><span className="site-command-placeholder" aria-hidden="true">{t('搜活动、指南或问 BayBay', 'Search events, guides or ask BayBay')}</span><kbd className="site-command-kbd" aria-hidden="true">⌘K</kbd>
            </button>
            <ReadingPreferencesButton onUnavailable={onUnavailable} />
            <LanguageSwitcher realLocation={realLocation} />
            {user ? <ChunkBoundary key={user.id} fallback={accountBox}><Suspense fallback={accountBox}><AccountMenu user={user} messagesCount={messagesCount} current={mine} onLogout={onLogout} /></Suspense></ChunkBoundary> : <div className="site-topbar-actions"><Link to="/me" className="site-topbar-account site-tool" aria-current={mine}><UserRound size={20} aria-hidden="true" strokeWidth={1.75} /><span>{t('我的', 'Me')}</span></Link></div>}
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

/**
 * The page's own image credits (G12): HOME, EVENTS and GUIDES put id="page-credits" and data-count="<n>" on their credit
 * <details>. A block that already ends the page carries data-credits-at-end and needs no second entry; anywhere else the
 * footer offers "↑ 本页图片来源 (n)", which opens the block, scrolls to it and focuses its summary. Read after every route
 * change and whenever the page adds, removes or relabels the block (no polling; the link is the footer's last row, so
 * it never moves anything above it).
 */
function usePageCredits() {
  const { pathname } = useLocation();
  const [count, setCount] = useState<number | null>(null);
  useEffect(() => {
    const read = () => {
      const block = document.getElementById('page-credits');
      setCount(block && !block.hasAttribute('data-credits-at-end') ? Math.max(0, Number(block.getAttribute('data-count')) || 0) : null);
    };
    read();
    const main = document.getElementById('scroll-container');
    if (!main || typeof MutationObserver === 'undefined') return;
    const observer = new MutationObserver(read);
    observer.observe(main, { childList: true, subtree: true, attributes: true, attributeFilter: ['id', 'data-count', 'data-credits-at-end'] });
    return () => observer.disconnect();
  }, [pathname]);
  return count;
}

function openPageCredits() {
  const block = document.getElementById('page-credits');
  if (!block) return;
  block.setAttribute('data-revealed', '');
  if (block instanceof HTMLDetailsElement) block.open = true;
  block.scrollIntoView({ behavior: scrollBehavior(), block: 'start' });
  const target = block.querySelector<HTMLElement>('summary') ?? block;
  if (target === block && !block.hasAttribute('tabindex')) block.tabIndex = -1;
  target.focus({ preventScroll: true });
}

/**
 * The global footer (content arrangement §5): the otter, BAYLINK and the tagline; one line on what the site is, with
 * 免费 · 不用登录 under captain decision 4 (lib/ui-navigation.ts footerClaim); 关于 BAYLINK · 我们怎么核对 · 反馈 at 16px;
 * 内容目录 · 条款 · 隐私 · 短信说明 at 14px (简洁显示 drops 内容目录); the page's image credits last, when it has a block
 * mid-page. 反馈 is a button (WEB-FEEDBACK's sheet), so the prerendered footer has only same-language links (verify-release).
 */
export function SiteFooter({ onFeedback = openSiteFeedback }: { onFeedback?: () => void }) {
  const locale = useLocale();
  const english = locale === 'en';
  const t = (zh: string, en: string) => english ? en : translateText(zh, locale);
  const pick = (copy: { zh: string; en: string }) => t(copy.zh, copy.en);
  const credits = usePageCredits();
  return <footer className="site-footer">
    <div className="site-footer-inner">
      <div className="site-footer-about">
        <p className="site-footer-brand"><img src="/brand/otter.svg" alt="" width={32} height={32} /><strong translate="no">BAYLINK</strong><span>{t('湾区去哪、怎么办 · 有来源的中文答案', 'Where to go and how to get it done in the Bay, with sources')}</span></p>
        <p className="site-footer-line">{pick(SITE_IDENTITY)}<span className="site-footer-claim"> · {pick(footerClaim())}</span></p>
      </div>
      <nav className="site-footer-links" aria-label={t('关于与帮助', 'About and help')}>
        <p className="site-footer-row site-footer-row--main">
          <Link to="/about">{t('关于 BAYLINK', 'About BAYLINK')}</Link>
          <Link to={METHOD_HREF}>{t('我们怎么核对', 'How we check')}</Link>
          <button type="button" onClick={onFeedback}>{t('反馈', 'Feedback')}</button>
        </p>
        <p className="site-footer-row">
          <Link to="/archive" className="site-footer-archive">{t('内容目录', 'Directory')}</Link>
          <Link to="/terms">{t('条款', 'Terms')}</Link>
          <Link to="/privacy">{t('隐私', 'Privacy')}</Link>
          <Link to="/sms-consent">{t('短信说明', 'SMS terms')}</Link>
        </p>
        {credits !== null && <p className="site-footer-row site-footer-row--credits"><button type="button" className="site-footer-credits" onClick={openPageCredits}><span aria-hidden="true">↑ </span>{t('本页图片来源', 'Image sources on this page')}{credits > 0 && ` (${credits})`}</button></p>}
      </nav>
    </div>
  </footer>;
}

/** The chrome as the prerender paints it: an anonymous reader, no handlers (the app replaces it on boot). */
export function AnonymousSiteChrome({ pathname, children }: { pathname: string; children: ReactNode }) {
  return <SiteChrome pathname={pathname} user={null} messagesCount={0} onAsk={noop} onSearch={noop} onAccount={noop} onCreate={noop} onLogout={noop} prerenderPath={pathname}>{children}</SiteChrome>;
}
