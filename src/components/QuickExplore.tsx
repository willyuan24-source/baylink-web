import { useState } from 'react';
import { ArrowRight, BookOpen, CornerDownLeft, Home, Search, Sparkles, X } from 'lucide-react';
import { CATEGORIES } from '../lib/constants';
import { getSlugFromCategory } from '../routing';
import { ModalShell } from './ui/Modal';

export function QuickExplore({ onClose, onSearch, onNavigate, onAsk }: { onClose: () => void; onSearch: (value: string) => void; onNavigate: (path: string) => void; onAsk: () => void }) {
  const [query, setQuery] = useState('');
  const run = (action: () => void) => { onClose(); action(); };
  const search = () => { if (query.trim()) run(() => onSearch(query.trim())); };
  return (
    <ModalShell onClose={onClose} label="快速搜索与导航" className="quick-explore-overlay">
      <div className="quick-explore" onClick={(event) => event.stopPropagation()}>
        <form onSubmit={(event) => { event.preventDefault(); search(); }} className="quick-search-form"><Search size={22} /><input aria-label="快速搜索" autoFocus placeholder="想在湾区找什么？" value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && event.nativeEvent.isComposing) event.preventDefault(); }} /><button type="button" aria-label="关闭搜索" onClick={onClose}><X size={20} /></button></form>
        <div className="quick-explore-body">
          {query.trim() && <button type="button" className="quick-result is-highlighted" onClick={search}><Search size={19} /><span>搜索「{query.trim()}」<small>查找房源、服务和邻里信息</small></span><CornerDownLeft size={17} /></button>}
          <p className="site-nav-label">快速前往</p>
          {[{ text: '发现湾区', sub: '浏览本地资源与需求', path: '/', icon: Home }, { text: '湾区生活指南', sub: '租房、通勤、搬家，少走弯路', path: '/guides', icon: BookOpen }].map(({ text, sub, path, icon: Icon }) => <button type="button" key={path} onClick={() => run(() => onNavigate(path))} className="quick-result"><Icon size={19} /><span>{text}<small>{sub}</small></span><ArrowRight size={17} /></button>)}
          <button type="button" onClick={() => run(onAsk)} className="quick-result"><Sparkles size={19} /><span>问问 BayBay<small>整理需求，找到生活的下一步</small></span><ArrowRight size={17} /></button>
          <p className="site-nav-label">按分类探索</p><div className="quick-categories">{CATEGORIES.filter((item) => !query.trim() || item.includes(query.trim()) || query.trim().length > 2).map((item) => <button type="button" key={item} onClick={() => run(() => onNavigate(`/category/${getSlugFromCategory(item)}`))}>{item}</button>)}</div>
        </div>
        <footer><span>输入关键词后按 Enter 搜索</span><span><kbd>Esc</kbd> 关闭</span></footer>
      </div>
    </ModalShell>
  );
}
