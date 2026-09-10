import { Link } from 'react-router-dom';
import { ArrowUpRight, BookOpen, Compass, Home, MapPin, MessageCircle, Plus, ShieldCheck, Sparkles, UserRound, Wrench } from 'lucide-react';
import { BRAND } from '../brandAssets';
import { CATEGORIES } from '../lib/constants';
import { getSlugFromCategory } from '../routing';
import type { UserData } from '../lib/types';
import Avatar from './Avatar';

type Props = {
  active: string;
  category: string;
  homeActive: boolean;
  user: UserData | null;
  notification: boolean;
  notificationCount: number;
  onCreate: () => void;
  onAsk: () => void;
  onAccount: () => void;
};

export function SiteNavigation({ active, category, homeActive, user, notification, notificationCount, onCreate, onAsk, onAccount }: Props) {
  const links = [
    { href: '/', label: '发现湾区', sub: 'Discover', icon: Home, current: homeActive },
    { href: '/guides', label: '生活指南', sub: 'Local guides', icon: BookOpen, current: active === 'guides' },
    { href: '/explore', label: '景点探索', sub: 'Places & day trips', icon: MapPin, current: active === 'explore' },
    { href: '/tools', label: '生活工具箱', sub: 'Everyday tools', icon: Wrench, current: active === 'tools' },
    { href: '/recommend', label: '编辑精选', sub: 'Our picks', icon: Compass, current: active === 'notifications' },
    { href: '/messages', label: '消息', sub: 'Conversations', icon: MessageCircle, current: active === 'messages' },
    { href: '/me', label: '我的空间', sub: 'My space', icon: UserRound, current: active === 'profile' },
  ];
  return (
    <aside className="site-sidebar">
      <Link to="/" className="site-brand" aria-label="BAYLINK 首页"><img src={BRAND.logoHorizontal} alt="BAYLINK" width="180" height="48" /><span>湾区生活，从这里连接</span></Link>
      <div className="site-nav-label">YOUR BAY AREA, CONNECTED</div>
      <nav className="site-nav" aria-label="主要导航">
        {links.map(({ href, label, sub, icon: Icon, current }) => <Link key={href} to={href} aria-current={current ? 'page' : undefined} className={`site-nav-link ${current ? 'is-active' : ''}`}><Icon size={20} strokeWidth={current ? 2 : 1.7} /><span>{label}<small>{sub}</small></span>{href === '/messages' && notification && <b className="site-unread">{notificationCount || '•'}</b>}{current && <span className="site-nav-dot" />}</Link>)}
      </nav>
      <button type="button" onClick={onCreate} className="site-publish"><Plus size={19} /> 发布信息<ArrowUpRight size={16} /></button>
      <div className="site-category-nav">
        <div className="site-nav-label">探索生活分类</div>
        <div>{CATEGORIES.map((label) => <Link key={label} to={`/category/${getSlugFromCategory(label)}`} aria-current={category === label && homeActive ? 'page' : undefined} className={category === label && homeActive ? 'is-active' : ''}>{label}</Link>)}</div>
      </div>
      <button type="button" className="site-baybay-note" onClick={onAsk}><Sparkles size={17} /><span>生活小事，问问 BayBay<small>你的 AI 湾区生活助手</small></span><ArrowUpRight size={15} /></button>
      <div className="site-sidebar-bottom">
        <Link to="/guides/baylink-safety-guide" className="site-safety-link"><ShieldCheck size={15} /> 安心连接，从了解开始</Link>
        <button type="button" onClick={onAccount} className="site-account"><Avatar theme={user?.profileTheme} src={user?.avatar} name={user?.nickname || '邻居'} size={10} /><span><strong translate={user?.nickname ? 'no' : undefined}>{user?.nickname || '你好，新邻居'}</strong><small>{user ? '查看我的空间' : '登录，开启你的湾区生活'}</small></span><ArrowUpRight size={16} /></button>
        <div className="site-legal"><Link to="/terms">条款</Link><Link to="/privacy">隐私</Link><Link to="/sms-consent">短信说明</Link><span>© {new Date().getFullYear()} BAYLINK</span></div>
      </div>
    </aside>
  );
}
