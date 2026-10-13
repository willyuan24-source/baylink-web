import { Link, useLocation } from 'react-router-dom';
import { CalendarDays, ChevronDown, Compass, Ellipsis, MessageCircle, MessageSquareText, ShieldCheck, TramFront, UserRound, Users, Wrench } from 'lucide-react';
import { BRAND } from '../brandAssets';
import { primaryNavigationPath } from '../lib/ui-navigation';
import { matchRoute } from '../app/route-table';
import { useLocale } from '../i18n/locale';
import type { UserData } from '../lib/types';
import { unprefixedPath } from '../lib/language-path';
import { useDisclosure } from './useDisclosure';
import { openSiteFeedback } from './site-feedback';

type Props = {
  active: string; category: string; homeActive: boolean; user: UserData | null;
  notification: boolean; notificationCount: number;
  /** Kept for callers and the OPUS contract; 发布 now lives only inside 邻里 (D20, G16), not in the header. */
  onCreate: () => void;
  onAsk: () => void; onAccount: () => void;
  /** The real URL. AppLayout passes it because /posts/:id and /users/:id render over a background page (useLocation sees that). */
  pathname?: string;
};

/** The otter that stands for BayBay in the header and the tab bar (public/brand/otter.svg; decorative, the label names it). */
export const OtterIcon = ({ size = 24 }: { size?: number }) => <img className="site-otter" src="/brand/otter.svg" alt="" width={size} height={size} aria-hidden="true" />;

export function SiteNavigation({ user, notification, notificationCount, onAsk, onAccount, pathname: realPathname }: Props) {
  const location = useLocation();
  const pathname = unprefixedPath(realPathname ?? location.pathname).replace(/\/$/, '') || '/';
  const current = primaryNavigationPath(pathname);
  // 邻里 (/category, /posts, /users), about and legal pages belong to 更多: it shows as current there, 首页 never does.
  const moreCurrent = matchRoute(pathname)?.section === 'more';
  const english = useLocale() === 'en';
  const { details, summary, close, closeToSummary } = useDisclosure();

  const activate = (action: () => void) => {
    closeToSummary();
    action();
  };
  const unread = notification && <b className="site-unread" aria-label={english ? 'Unread messages' : '未读消息'}>{notificationCount || '•'}</b>;
  // G55 (HOMEIA-12): 我的 is a primary destination on desktop too, for guests as well (the phone tab bar has it); /me,
  // /me/bookings, /my-week and /messages highlight it (route-table section 'me').
  const links = [
    { href: '/', label: english ? 'Home' : '首页' },
    { href: '/events', label: english ? 'Events' : '活动' },
    { href: '/guides', label: english ? 'Guides' : '指南' },
    { href: '/me', label: english ? 'Me' : '我的' },
  ];
  const here = (path: string) => pathname === path ? 'page' : undefined;
  // On /my-week and /messages the 更多 panel's own link is the page; 我的 marks the section (one aria-current="page").
  const primaryCurrent = (href: string) => current !== href ? undefined : href === '/me' && pathname !== '/me' ? 'true' : 'page';

  return <div className="site-header-navigation">
    <Link to="/" className="site-header-brand" aria-label={english ? 'BAYLINK home' : 'BAYLINK 首页'}><img src={BRAND.logoHorizontal} alt="BAYLINK" width="160" height="43" /></Link>
    <nav className="site-nav site-header-primary" aria-label={english ? 'Main navigation' : '主要导航'}>
      {links.map(({ href, label }) => <Link key={href} to={href} aria-current={primaryCurrent(href)} className={`site-nav-link${current === href ? ' is-active' : ''}`}>{label}</Link>)}
      <button type="button" className="site-nav-link site-nav-ask" onClick={onAsk}><OtterIcon size={22} /><span>{english ? 'Ask BayBay' : '问 BayBay'}</span></button>
    </nav>
    {/* RC-8(ii): the panel stays in the DOM while closed (the OPUS contract reads its 3D link from static markup). */}
    <details className="site-navigation-more" ref={details}>
      <summary ref={summary} aria-label={english ? 'More navigation' : '更多导航'} aria-current={moreCurrent ? 'true' : undefined} className={moreCurrent ? 'is-active' : undefined}><span>{english ? 'More' : '更多'}</span><ChevronDown className="site-more-chevron" size={14} aria-hidden="true" /><Ellipsis className="site-more-icon" size={22} aria-hidden="true" />{notification && <i className="site-more-notification" aria-label={english ? 'Unread notifications' : '有未读通知'} />}</summary>
      <div className="site-navigation-panel" onClick={event => {
        if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || !(event.target as Element).closest('a')) return;
        closeToSummary();
      }}>
        <nav className="site-secondary-nav" aria-label={english ? 'More discoveries' : '更多探索'}>
          {/* G1: the inbox is two taps from any page (更多 → 消息) and carries the unread count. */}
          {user && <Link to="/messages" aria-current={pathname === '/messages' || pathname.startsWith('/messages/') ? 'page' : undefined}><MessageCircle size={18} aria-hidden="true" />{english ? 'Messages' : '消息'}{unread}</Link>}
          <Link to="/my-week" aria-current={here('/my-week')}><CalendarDays size={18} aria-hidden="true" />{english ? 'My week' : '我的这周'}</Link>
          <Link to="/category/rent" aria-current={pathname.startsWith('/category/') ? 'page' : undefined}><Users size={18} aria-hidden="true" />{english ? 'Neighborhood board (beta)' : '邻里信息（测试中）'}</Link>
          <Link to="/explore" aria-current={here('/explore')}><Compass size={18} aria-hidden="true" />{english ? 'Explore places' : '按地区找景点'}</Link>
          <Link to="/tools" aria-current={here('/tools')}><Wrench size={18} aria-hidden="true" />{english ? 'Everyday tools' : '生活工具箱'}</Link>
          <Link to="/opus-bay?from=nav" aria-current={pathname === '/opus-bay' || pathname === '/play' ? 'page' : undefined} reloadDocument><TramFront size={18} aria-hidden="true" />{english ? '3D San Francisco' : '3D 旧金山'}</Link>
          <Link to="/about" aria-current={here('/about')}><ShieldCheck size={18} aria-hidden="true" />{english ? 'About & sources' : '关于与核验方法'}</Link>
          {/* Plan §1: 反馈与报错 opens WEB-FEEDBACK's sheet. The published directory moved to the global footer. */}
          <button type="button" onClick={() => { close(); openSiteFeedback(); }}><MessageSquareText size={18} aria-hidden="true" />{english ? 'Feedback & error reports' : '反馈与报错'}</button>
        </nav>
        <div className="site-navigation-account">
          <button type="button" onClick={() => activate(onAccount)}><UserRound size={18} aria-hidden="true" />{user ? english ? 'Account settings' : '账号设置' : english ? 'Sign in / Register' : '登录 / 注册'}</button>
          {!user && <p>{english ? 'Save guides and plans without signing in.' : '不登录也能收藏与查指南'}</p>}
        </div>
        <nav className="site-navigation-legal" aria-label={english ? 'Legal information' : '条款与隐私'}><Link to="/terms">{english ? 'Terms' : '条款'}</Link><Link to="/privacy">{english ? 'Privacy' : '隐私'}</Link><Link to="/sms-consent">{english ? 'SMS' : '短信说明'}</Link></nav>
      </div>
    </details>
  </div>;
}
