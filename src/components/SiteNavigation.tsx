import { useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { BookOpen, CalendarDays, ChevronDown, Compass, Ellipsis, MessageCircle, ShieldCheck, Sparkles, TramFront, UserRound, Users, Wrench } from 'lucide-react';
import { BRAND } from '../brandAssets';
import { primaryNavigationPath } from '../lib/ui-navigation';
import { matchRoute } from '../app/route-table';
import { useLocale } from '../i18n/locale';
import type { UserData } from '../lib/types';
import { unprefixedPath } from '../lib/language-path';

type Props = {
  active: string; category: string; homeActive: boolean; user: UserData | null;
  notification: boolean; notificationCount: number;
  /** Kept for callers and the OPUS contract; 发布 now lives only inside 邻里 (D20, G16), not in the header. */
  onCreate: () => void;
  onAsk: () => void; onAccount: () => void;
  /** The real URL. AppLayout passes it because /posts/:id and /users/:id render over a background page (useLocation sees that). */
  pathname?: string;
};

export function SiteNavigation({ user, notification, notificationCount, onAsk, onAccount, pathname: realPathname }: Props) {
  const location = useLocation();
  const pathname = unprefixedPath(realPathname ?? location.pathname).replace(/\/$/, '') || '/';
  const current = primaryNavigationPath(pathname);
  // 邻里 (/category, /posts, /users), about and legal pages belong to 更多: it shows as current there, 首页 never does.
  const moreCurrent = matchRoute(pathname)?.section === 'more';
  const english = useLocale() === 'en';
  const disclosure = useRef<HTMLDetailsElement>(null);
  const summary = useRef<HTMLElement>(null);

  useEffect(() => {
    if (disclosure.current) disclosure.current.open = false;
  }, [location.pathname, location.search, location.hash]);

  useEffect(() => {
    const dismissOutside = (event: Event) => {
      const menu = disclosure.current;
      if (menu?.open && event.target instanceof Node && !menu.contains(event.target)) menu.open = false;
    };
    const dismissWithKeyboard = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || !disclosure.current?.open) return;
      event.preventDefault();
      disclosure.current.open = false;
      summary.current?.focus();
    };
    document.addEventListener('pointerdown', dismissOutside);
    document.addEventListener('focusin', dismissOutside);
    document.addEventListener('keydown', dismissWithKeyboard);
    return () => {
      document.removeEventListener('pointerdown', dismissOutside);
      document.removeEventListener('focusin', dismissOutside);
      document.removeEventListener('keydown', dismissWithKeyboard);
    };
  }, []);

  const activate = (action: () => void) => {
    if (disclosure.current) disclosure.current.open = false;
    summary.current?.focus();
    action();
  };
  const unread = notification && <b className="site-unread" aria-label={english ? 'Unread messages' : '未读消息'}>{notificationCount || '•'}</b>;
  const links = [
    { href: '/', label: english ? 'Home' : '首页' },
    { href: '/events', label: english ? 'Events' : '活动' },
    { href: '/guides', label: english ? 'Guides' : '指南' },
  ];
  const here = (path: string) => pathname === path ? 'page' : undefined;

  return <div className="site-header-navigation">
    <Link to="/" className="site-header-brand" aria-label={english ? 'BAYLINK home' : 'BAYLINK 首页'}><img src={BRAND.logoHorizontal} alt="BAYLINK" width="160" height="43" /></Link>
    <nav className="site-nav site-header-primary" aria-label={english ? 'Main navigation' : '主要导航'}>
      {links.map(({ href, label }) => <Link key={href} to={href} aria-current={current === href ? 'page' : undefined} className={`site-nav-link${current === href ? ' is-active' : ''}`}>{label}</Link>)}
      <button type="button" className="site-nav-link site-nav-ask" onClick={onAsk}><Sparkles size={17} aria-hidden="true" /><span>{english ? 'Ask BayBay' : '问 BayBay'}</span></button>
    </nav>
    {/* RC-8(ii): the panel stays in the DOM while closed (the OPUS contract reads its 3D link from static markup). */}
    <details className="site-navigation-more" ref={disclosure}>
      <summary ref={summary} aria-label={english ? 'More navigation' : '更多导航'} aria-current={moreCurrent ? 'true' : undefined} className={moreCurrent ? 'is-active' : undefined}><span>{english ? 'More' : '更多'}</span><ChevronDown className="site-more-chevron" size={14} aria-hidden="true" /><Ellipsis className="site-more-icon" size={22} aria-hidden="true" />{notification && <i className="site-more-notification" aria-label={english ? 'Unread notifications' : '有未读通知'} />}</summary>
      <div className="site-navigation-panel" onClick={event => {
        if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || !(event.target as Element).closest('a')) return;
        summary.current?.focus({ preventScroll: true });
        if (disclosure.current) disclosure.current.open = false;
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
          {/* The directory moves to the global footer with WEB-SHELL2; until then it stays reachable here. */}
          <Link to="/archive" aria-current={here('/archive')}><BookOpen size={18} aria-hidden="true" />{english ? 'Published directory' : '已发布内容目录'}</Link>
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
