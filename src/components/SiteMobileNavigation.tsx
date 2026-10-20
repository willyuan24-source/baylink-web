import { Link } from 'react-router-dom';
import { BookOpen, CalendarDays, Home, UserRound } from 'lucide-react';
import { primaryNavigationPath } from '../lib/ui-navigation';
import { useLocale } from '../i18n/locale';
import { AiTag, OtterIcon } from './SiteNavigation';
import { bayBayWarmup, usePendingLink } from './site-chrome-hooks';

export function SiteMobileNavigation({ pathname, notificationCount, hasNotification = false, onAsk }: {
  pathname: string; notificationCount: number; hasNotification?: boolean; onAsk: () => void;
}) {
  const current = primaryNavigationPath(pathname);
  const english = useLocale() === 'en';
  const press = usePendingLink(pathname);
  const links = [
    { href: '/', label: english ? 'Home' : '首页', icon: Home },
    { href: '/events', label: english ? 'Events' : '活动', icon: CalendarDays },
    { href: '/guides', label: english ? 'Guides' : '指南', icon: BookOpen },
    { href: '/me', label: english ? 'Me' : '我的', icon: UserRound },
  ];
  // The tapped tab answers on pointerdown (data-pending: brand text + pill) until the route changes; aria-current stays
  // the pathname's (OPUS contract).
  const link = ({ href, label, icon: Icon }: typeof links[number]) => <Link key={href} to={href} className={`site-mobile-item${current === href ? ' is-active' : ''}`} aria-current={current === href ? 'page' : undefined} {...press(href, current === href)}><span className="site-mobile-icon"><Icon size={24} aria-hidden="true" strokeWidth={1.75} />{href === '/me' && (hasNotification || notificationCount > 0) && <b className={notificationCount > 0 ? undefined : 'site-mobile-notification-dot'} aria-label={notificationCount > 0 ? (english ? `${notificationCount} unread messages` : `${notificationCount} 条未读消息`) : (english ? 'Unread notifications' : '有未读通知')}>{notificationCount > 0 ? Math.min(notificationCount, 99) : null}</b>}</span><span>{label}</span></Link>;
  // The assistant's visible name is 问 BayBay under the otter, which carries a small AI tag (A6); the accessible name says
  // it is an AI helper. It never wraps: whenever the label would not fit one tab (大 / 特大 / 简洁显示, narrow phones, the
  // longer English label) the bar shows "BayBay" (site-chrome.css, the site-mobile-bar container). Both labels are direct
  // children of the button, so the bar's label rule (`.site-mobile-item>span`) covers them.
  const ask = <button type="button" className="site-mobile-item site-mobile-ask" onClick={onAsk} aria-label={english ? 'Ask BayBay (AI helper)' : '问 BayBay（AI 助手）'} {...bayBayWarmup}><span className="site-mobile-icon"><OtterIcon size={32} /><AiTag /></span><span className="site-mobile-ask-label">{english ? 'Ask BayBay' : '问 BayBay'}</span><span className="site-mobile-ask-short" aria-hidden="true">BayBay</span></button>;
  return <nav className="site-mobile-nav" aria-label={english ? 'Main navigation' : '手机导航'}><div className="site-mobile-nav-items">{links.slice(0, 2).map(link)}{ask}{links.slice(2).map(link)}</div></nav>;
}
