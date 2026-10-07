import { Link } from 'react-router-dom';
import { BookOpen, CalendarDays, Home, Sparkles, UserRound } from 'lucide-react';
import { primaryNavigationPath } from '../lib/ui-navigation';
import { useLocale } from '../i18n/locale';

export function SiteMobileNavigation({ pathname, notificationCount, hasNotification = false, onAsk }: {
  pathname: string; notificationCount: number; hasNotification?: boolean; onAsk: () => void;
}) {
  const current = primaryNavigationPath(pathname);
  const english = useLocale() === 'en';
  const links = [
    { href: '/', label: english ? 'Home' : '首页', icon: Home },
    { href: '/calendar', label: english ? 'Events' : '活动', icon: CalendarDays },
    { href: '/guides', label: english ? 'Guides' : '指南', icon: BookOpen },
    { href: '/me', label: english ? 'Me' : '我的', icon: UserRound },
  ];
  const link = ({ href, label, icon: Icon }: typeof links[number]) => <Link key={href} to={href} className={`site-mobile-item${current === href ? ' is-active' : ''}`} aria-current={current === href ? 'page' : undefined}><span className="site-mobile-icon"><Icon size={24} aria-hidden="true" />{href === '/me' && (hasNotification || notificationCount > 0) && <b className={notificationCount > 0 ? undefined : 'site-mobile-notification-dot'} aria-label={notificationCount > 0 ? (english ? `${notificationCount} unread messages` : `${notificationCount} 条未读消息`) : (english ? 'Unread notifications' : '有未读通知')}>{notificationCount > 0 ? Math.min(notificationCount, 99) : null}</b>}</span><span>{label}</span></Link>;
  return <nav className="site-mobile-nav" aria-label={english ? 'Main navigation' : '手机导航'}><div className="site-mobile-nav-items">{links.slice(0, 2).map(link)}<button type="button" className="site-mobile-item site-mobile-ask" onClick={onAsk} aria-label={english ? 'Ask BayBay' : '问 BayBay'}><Sparkles size={24} aria-hidden="true" /><span translate="no">BayBay</span></button>{links.slice(2).map(link)}</div></nav>;
}
