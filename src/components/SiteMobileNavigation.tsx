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
    { href: '/events', label: english ? 'Events' : '活动', icon: CalendarDays },
    { href: '/guides', label: english ? 'Guides' : '指南', icon: BookOpen },
    { href: '/me', label: english ? 'Me' : '我的', icon: UserRound },
  ];
  const link = ({ href, label, icon: Icon }: typeof links[number]) => <Link key={href} to={href} className={`site-mobile-item${current === href ? ' is-active' : ''}`} aria-current={current === href ? 'page' : undefined}><span className="site-mobile-icon"><Icon size={24} aria-hidden="true" />{href === '/me' && (hasNotification || notificationCount > 0) && <b className={notificationCount > 0 ? undefined : 'site-mobile-notification-dot'} aria-label={notificationCount > 0 ? (english ? `${notificationCount} unread messages` : `${notificationCount} 条未读消息`) : (english ? 'Unread notifications' : '有未读通知')}>{notificationCount > 0 ? Math.min(notificationCount, 99) : null}</b>}</span><span>{label}</span></Link>;
  // The assistant's visible name is 问 BayBay (product naming table). It never wraps: below 375 px, and whenever 大 / 特大 /
  // 简洁显示 or the longer English label would not fit one tab, the bar shows 问问 / Ask (editorial-refinement.css, the
  // site-mobile-bar container); the accessible name stays 问 BayBay. Both labels are direct children, so the bar's 13 px
  // label rule (`.site-mobile-item>span`) covers them in English too.
  const ask = <button type="button" className="site-mobile-item site-mobile-ask" onClick={onAsk} aria-label={english ? 'Ask BayBay' : '问 BayBay'}><Sparkles size={24} aria-hidden="true" /><span className="site-mobile-ask-label">{english ? 'Ask BayBay' : '问 BayBay'}</span><span className="site-mobile-ask-short" aria-hidden="true">{english ? 'Ask' : '问问'}</span></button>;
  return <nav className="site-mobile-nav" aria-label={english ? 'Main navigation' : '手机导航'}><div className="site-mobile-nav-items">{links.slice(0, 2).map(link)}{ask}{links.slice(2).map(link)}</div></nav>;
}
