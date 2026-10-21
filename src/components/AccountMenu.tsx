import { Link } from 'react-router-dom';
import { CalendarDays, LogOut, MessageCircle, Settings } from 'lucide-react';
import Avatar from './Avatar';
import { useDisclosure } from './useDisclosure';
import { translateText, useLocale } from '../i18n/locale';
import type { UserData } from '../lib/types';
import './account-menu.css';

/** Desktop account menu (design.md §4.13): 消息 n · 我的这周 · 设置 · 退出. On phones the 我的 tab stands in for it. */
export function AccountMenu({ user, messagesCount, current, onLogout }: { user: UserData; messagesCount: number; current?: 'page' | 'true'; onLogout: () => void }) {
  const locale = useLocale();
  const english = locale === 'en';
  const t = (zh: string, en: string) => english ? en : translateText(zh, locale);
  const { details, summary, close } = useDisclosure();
  const unread = messagesCount > 0;
  return <div className="site-topbar-actions">
    <details className="site-account-menu" ref={details}>
      <summary ref={summary} className={`site-topbar-account site-tool${current ? ' is-current' : ''}`} aria-label={unread ? t(`账号菜单，消息 ${messagesCount} 条未读`, `Account menu, ${messagesCount} unread messages`) : t('账号菜单', 'Account menu')}>
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

