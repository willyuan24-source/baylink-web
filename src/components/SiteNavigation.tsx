import { Link, useLocation } from 'react-router-dom';
import { BookOpen, CalendarDays, Home, ShieldCheck, Sparkles, TramFront, UserRound, Users } from 'lucide-react';
import { BRAND } from '../brandAssets';
import { primaryNavigationPath } from '../lib/ui-navigation';
import { useLocale } from '../i18n/locale';
import type { UserData } from '../lib/types';
import Avatar from './Avatar';
import { unprefixedPath } from '../lib/language-path';

type Props = {
  active: string; category: string; homeActive: boolean; user: UserData | null;
  notification: boolean; notificationCount: number; onCreate: () => void;
  onAsk: () => void; onAccount: () => void;
};

export function SiteNavigation({ user, notification, notificationCount, onAsk, onAccount }: Props) {
  const pathname = unprefixedPath(useLocation().pathname).replace(/\/$/, '') || '/';
  const current = primaryNavigationPath(pathname);
  const locale = useLocale();
  const english = locale === 'en';
  const anonymousName = english ? 'Neighbor' : locale === 'zh-Hant' ? '鄰居' : '邻居';
  const links = [
    { href: '/', label: english ? 'Home' : '首页', icon: Home },
    { href: '/calendar', label: english ? 'Events' : '活动', icon: CalendarDays },
    { href: '/guides', label: english ? 'Guides' : '指南', icon: BookOpen },
    { href: '/me', label: english ? 'My space' : '我的', icon: UserRound },
  ];
  const link = ({ href, label, icon: Icon }: typeof links[number]) => <Link key={href} to={href} aria-current={current === href ? 'page' : undefined} className={`site-nav-link${current === href ? ' is-active' : ''}`}><Icon size={20} aria-hidden="true" /><span>{label}</span>{href === '/me' && notification && <b className="site-unread" aria-label={english ? 'Unread messages' : '未读消息'}>{notificationCount || '•'}</b>}</Link>;
  return <aside className="site-sidebar site-sidebar--focused"><Link to="/" className="site-brand" aria-label="BAYLINK 首页"><img src={BRAND.logoHorizontal} alt="BAYLINK" width="180" height="48" /><span>{english ? 'Local life, with sources' : '湾区生活，有据可查'}</span></Link><nav className="site-nav" aria-label={english ? 'Main navigation' : '主要导航'}>{links.slice(0, 2).map(link)}<button type="button" className="site-nav-link site-nav-ask" onClick={onAsk}><Sparkles size={20} aria-hidden="true" /><span>{english ? 'Ask BayBay' : '问 BayBay'}</span></button>{links.slice(2).map(link)}</nav><nav className="site-secondary-nav" aria-label={english ? 'More discoveries' : '更多探索'}><Link to="/category/rent"><Users size={18} aria-hidden="true" />{english ? 'Neighborhood board' : '邻里信息'}</Link><Link to="/opus-bay?from=nav" aria-current={pathname === '/opus-bay' || pathname === '/play' ? 'page' : undefined} reloadDocument><TramFront size={18} aria-hidden="true" />{english ? '3D San Francisco' : '3D 旧金山'}</Link><Link to="/about"><ShieldCheck size={18} aria-hidden="true" />{english ? 'About & sources' : '关于与核验方法'}</Link></nav><div className="site-sidebar-bottom"><button type="button" onClick={onAccount} className="site-account"><Avatar theme={user?.profileTheme} src={user?.avatar} name={user?.nickname || anonymousName} size={10} /><span><strong translate={user?.nickname ? 'no' : undefined}>{user?.nickname || (english ? 'Sign in' : '登录')}</strong><small>{user ? english ? 'Account settings' : '账号设置' : english ? 'Saved items work without signing in' : '不登录也能收藏与查指南'}</small></span></button><div className="site-legal"><Link to="/terms">{english ? 'Terms' : '条款'}</Link><Link to="/privacy">{english ? 'Privacy' : '隐私'}</Link><Link to="/sms-consent">{english ? 'SMS' : '短信说明'}</Link><span>© {new Date().getFullYear()} BAYLINK</span></div></div></aside>;
}
