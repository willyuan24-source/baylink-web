import { useState, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { CalendarDays, ChevronDown, Compass, Ellipsis, MessageCircle, MessageSquareText, ShieldCheck, TramFront, UserRound, Users, Wrench } from 'lucide-react';
import { BRAND } from '../brandAssets';
import { FREE_NO_SIGN_IN, footerClaim, primaryNavigationPath } from '../lib/ui-navigation';
import { matchRoute } from '../app/route-table';
import { bayBayWarmup, usePendingLink } from './site-chrome-hooks';
import { useLocale } from '../i18n/locale';
import type { UserData } from '../lib/types';
import { unprefixedPath } from '../lib/language-path';
import { useDisclosure } from './useDisclosure';
import { openSiteFeedback } from './site-feedback';
import { COMMUNITY_VISIBLE } from '../data/site-flags';

type Props = {
  active: string; category: string; homeActive: boolean; user: UserData | null;
  notification: boolean; notificationCount: number;
  /** Kept for callers and the OPUS contract; 发布 now lives only inside 邻里 (D20, G16), not in the header. */
  onCreate: () => void;
  onAsk: () => void; onAccount: () => void;
  /** The real URL. AppLayout passes it because /posts/:id and /users/:id render over a background page (useLocation sees that). */
  pathname?: string;
  /** A phone's language choices (SiteChrome, UI9-R2 OD7): the first row of the ••• sheet, rendered only while it is open,
      so the prerendered header keeps one language switch (verify-release reads that one). It gets the sheet's close: a
      choice (the current language too) closes the sheet with focus on •••, never on a row that is about to unmount. */
  language?: (close: () => void) => ReactNode;
};

/** The otter that stands for BayBay in the header and the tab bar (public/brand/otter.svg; decorative, the label names it). */
export const OtterIcon = ({ size = 24 }: { size?: number }) => <img className="site-otter" src="/brand/otter.svg" alt="" width={size} height={size} aria-hidden="true" />;

/** The lockup's vector placeholder (site-chrome.css) paints only until the PNG is in: `data-loaded` on load, or at mount
    for a PNG that arrived before the app did (an image that fails keeps the placeholder). */
const markLogoLoaded = (img: HTMLImageElement | null) => { if (img?.complete && img.naturalWidth) img.dataset.loaded = ''; };

/** The small "AI" tag on every 问 BayBay entry in the chrome (A6: BayBay is named an AI helper wherever it is offered). */
export const AiTag = () => <span className="site-ai-tag" aria-hidden="true" translate="no">AI</span>;

export function SiteNavigation({ user, notification, notificationCount, onAsk, onAccount, pathname: realPathname, language }: Props) {
  const location = useLocation();
  const pathname = unprefixedPath(realPathname ?? location.pathname).replace(/\/$/, '') || '/';
  const current = primaryNavigationPath(pathname);
  // 邻里 (/category, /posts, /users), about and legal pages belong to 更多: it shows as current there, 首页 never does.
  const moreCurrent = matchRoute(pathname)?.section === 'more';
  const english = useLocale() === 'en';
  const { details, summary, close, closeToSummary } = useDisclosure();
  const [moreOpen, setMoreOpen] = useState(false);
  const press = usePendingLink(pathname);

  const activate = (action: () => void) => {
    closeToSummary();
    action();
  };
  const unread = notification && <b className="site-unread" aria-label={english ? 'Unread messages' : '未读消息'}>{notificationCount || '•'}</b>;
  // Content arrangement §2: 首页 · 活动 · 指南 · 问 BayBay [AI] · 更多. 我的 is the header's account tool (SiteChrome).
  const links = [
    { href: '/', label: english ? 'Home' : '首页' },
    { href: '/events', label: english ? 'Events' : '活动' },
    { href: '/guides', label: english ? 'Guides' : '指南' },
  ];
  const here = (path: string) => pathname === path ? 'page' : undefined;

  return <div className="site-header-navigation">
    <Link to="/" className="site-header-brand" aria-label={english ? 'BAYLINK home' : 'BAYLINK 首页'}><img src={BRAND.logoHorizontal} alt="BAYLINK" width="160" height="40" ref={markLogoLoaded} onLoad={event => { event.currentTarget.dataset.loaded = ''; }} /></Link>
    <nav className="site-nav site-header-primary" aria-label={english ? 'Main navigation' : '主要导航'}>
      {links.map(({ href, label }) => <Link key={href} to={href} aria-current={current === href ? 'page' : undefined} className={`site-nav-link${current === href ? ' is-active' : ''}`} {...press(href, current === href)}>{label}</Link>)}
      <button type="button" className="site-nav-link site-nav-ask" onClick={onAsk} aria-label={english ? 'Ask BayBay (AI helper)' : '问 BayBay（AI 助手）'} {...bayBayWarmup}><OtterIcon size={22} /><span>{english ? 'Ask BayBay' : '问 BayBay'}</span><AiTag /></button>
    </nav>
    {/* RC-8(ii): the panel stays in the DOM while closed (the OPUS contract reads its 3D link from static markup). */}
    <details className="site-navigation-more" ref={details} onToggle={event => setMoreOpen(event.currentTarget.open)}>
      <summary ref={summary} aria-label={english ? 'More navigation' : '更多导航'} aria-current={moreCurrent ? 'true' : undefined} className={`site-tool${moreCurrent ? ' is-active' : ''}`}><span>{english ? 'More' : '更多'}</span><ChevronDown className="site-more-chevron" size={16} aria-hidden="true" strokeWidth={1.75} /><Ellipsis className="site-more-icon" size={22} aria-hidden="true" strokeWidth={1.75} />{notification && <i className="site-more-notification" aria-label={english ? 'Unread notifications' : '有未读通知'} />}</summary>
      <div className="site-navigation-panel" onClick={event => {
        if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || !(event.target as Element).closest('a')) return;
        closeToSummary();
      }}>
        {moreOpen && language?.(closeToSummary)}
        {/* Content arrangement §4: places first, then about and feedback, then the account; the legal links are the footer's. */}
        <nav className="site-secondary-nav" aria-label={english ? 'More discoveries' : '更多探索'}>
          {/* G1: the inbox is two taps from any page (更多 → 消息) and carries the unread count. */}
          {user && <Link to="/messages" aria-current={pathname === '/messages' || pathname.startsWith('/messages/') ? 'page' : undefined}><MessageCircle size={20} aria-hidden="true" strokeWidth={1.75} />{english ? 'Messages' : '消息'}{unread}</Link>}
          <Link to="/my-week" aria-current={here('/my-week')}><CalendarDays size={20} aria-hidden="true" strokeWidth={1.75} />{english ? 'My week' : '我的这周'}</Link>
          <Link to="/explore" aria-current={here('/explore')}><Compass size={20} aria-hidden="true" strokeWidth={1.75} />{english ? 'Explore places' : '按地区找景点'}</Link>
          <Link to="/tools" aria-current={here('/tools')}><Wrench size={20} aria-hidden="true" strokeWidth={1.75} />{english ? 'Everyday tools' : '生活工具箱'}</Link>
          <Link to="/opus-bay?from=nav" aria-current={pathname === '/opus-bay' || pathname === '/play' ? 'page' : undefined} reloadDocument><TramFront size={20} aria-hidden="true" strokeWidth={1.75} />{english ? '3D San Francisco' : '3D 旧金山'}</Link>
          {COMMUNITY_VISIBLE && <Link to="/category/rent" className="site-more-community" aria-current={pathname.startsWith('/category/') ? 'page' : undefined}><Users size={20} aria-hidden="true" strokeWidth={1.75} />{english ? 'Neighborhood board' : '邻里信息'}<span className="site-more-chip">{english ? 'Beta' : '测试中'}</span></Link>}
        </nav>
        <nav className="site-secondary-nav site-secondary-nav--about" aria-label={english ? 'About and feedback' : '关于与反馈'}>
          <Link to="/about" aria-current={here('/about')}><ShieldCheck size={20} aria-hidden="true" strokeWidth={1.75} />{english ? 'About BAYLINK · How we check' : '关于 BAYLINK · 我们怎么核对'}</Link>
          {/* Plan §1: 反馈与报错 opens WEB-FEEDBACK's sheet. */}
          <button type="button" onClick={() => { close(); openSiteFeedback(); }}><MessageSquareText size={20} aria-hidden="true" strokeWidth={1.75} />{english ? 'Feedback & error reports' : '反馈与报错'}</button>
        </nav>
        <div className="site-navigation-account">
          <button type="button" onClick={() => activate(onAccount)}><UserRound size={20} aria-hidden="true" strokeWidth={1.75} />{user ? english ? 'Account settings' : '账号设置' : english ? 'Sign in / Register' : '登录 / 注册'}</button>
          {/* Captain decision 4: the same rule as the footer's 免费 · 不用登录. */}
          {!user && footerClaim() === FREE_NO_SIGN_IN && <p>{english ? 'Browse, save and ask BayBay without signing in.' : '不用登录也能浏览、收藏和问 BayBay'}</p>}
        </div>
      </div>
    </details>
  </div>;
}
