import { useEffect, useState } from 'react';
import { Bookmark, Check, ChevronRight, Clock3, Copy, Share2, Sparkles, X } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import type { Guide } from '../data/guides';
import { getGuideBySlug } from '../data/guides';
import { getGuideMedia } from '../data/guide-media';
import { clearReadingHistory, rememberGuide, toggleSavedGuide, useReaderLibrary } from '../lib/reader-library';
import { SITE_URL } from '../lib/seo';

export function GuideReaderActions({ guide, onAsk }: { guide: Guide; onAsk?: (question: string) => void }) {
  const { saved } = useReaderLibrary();
  const isSaved = saved.includes(guide.slug);
  const [status, setStatus] = useState('');
  const [shareFallback, setShareFallback] = useState(false);
  const url = `${SITE_URL}/guides/${guide.slug}`;
  useEffect(() => { rememberGuide(guide.slug); }, [guide.slug]);
  const save = () => {
    const result = toggleSavedGuide(guide.slug);
    setStatus(result.saved
      ? result.persisted ? '已加入稍后读。在生活指南的「我的收藏」中找回。' : '浏览器未允许保存，刷新后可能丢失。'
      : '已取消收藏。');
  };
  const share = async () => {
    setShareFallback(false);
    if (navigator.share) {
      try { await navigator.share({ title: guide.title, text: guide.summary, url }); setStatus('分享菜单已完成。'); return; }
      catch (error) { if (error instanceof Error && error.name === 'AbortError') return; }
    }
    try { await navigator.clipboard.writeText(url); setStatus('文章链接已复制，可以发给朋友。'); }
    catch { setShareFallback(true); setStatus('请复制下方文章链接。'); }
  };
  return <div className="reader-actions-wrap">
    <div className="reader-actions" aria-label="文章操作">
      <button type="button" onClick={save} aria-pressed={isSaved}>{isSaved ? <Check size={16} /> : <Bookmark size={16} />}{isSaved ? '已收藏' : '收藏 · 稍后读'}</button>
      <button type="button" onClick={share}><Share2 size={16} />分享给朋友</button>
      {onAsk && <button type="button" onClick={() => onAsk(`我正在读《${guide.title}》。请结合这篇指南，帮我整理最值得做的三件事和出发前需要确认的事项。`)}><Sparkles size={16} />让 BayBay 帮我整理</button>}
      <Link to="/guides?view=saved">我的收藏<ChevronRight size={14} /></Link>
    </div>
    {status && <p className="reader-status" role="status">{status}</p>}
    {shareFallback && <label className="reader-share-fallback"><Copy size={15} /><span className="sr-only">文章分享链接</span><input readOnly value={url} onFocus={event => event.currentTarget.select()} /></label>}
  </div>;
}

export function ReadingShelf({ compact = false }: { compact?: boolean }) {
  const { saved, recent } = useReaderLibrary();
  const [params, setParams] = useSearchParams();
  const [localTab, setLocalTab] = useState<'saved' | 'recent' | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [notice, setNotice] = useState('');
  const forcedSaved = params.get('view') === 'saved';
  const active = forcedSaved ? 'saved' : localTab || (saved.length ? 'saved' : 'recent');
  const entries = (active === 'saved' ? saved : recent).map(getGuideBySlug).filter((guide): guide is Guide => !!guide);
  if (!saved.length && !recent.length && (compact || !forcedSaved)) return null;
  const switchTab = (next: 'saved' | 'recent') => {
    setLocalTab(next); setExpanded(false);
    if (forcedSaved && next !== 'saved') setParams(current => { const values = new URLSearchParams(current); values.delete('view'); return values; }, { replace: true, preventScrollReset: true });
  };
  return <section className={`reader-shelf${compact ? ' reader-shelf--compact' : ''}`} aria-labelledby="reader-shelf-title">
    <div className="reader-shelf-heading"><div><span className="reader-eyebrow">YOUR LITTLE CORNER</span><h2 id="reader-shelf-title">{compact ? '把喜欢的湾区，留给下次。' : '你的阅读角落'}</h2></div>{compact && <Link to="/guides?view=saved">我的收藏<ChevronRight size={15} /></Link>}</div>
    <div className="reader-shelf-tabs" role="group" aria-label="阅读记录">
      <button type="button" aria-pressed={active === 'saved'} onClick={() => switchTab('saved')}><Bookmark size={15} />我的收藏 {saved.length}</button>
      <button type="button" aria-pressed={active === 'recent'} onClick={() => switchTab('recent')}><Clock3 size={15} />最近读过</button>
      {!compact && recent.length > 0 && active === 'recent' && <button type="button" className="reader-clear" onClick={() => { const persisted = clearReadingHistory(); setNotice(persisted ? '阅读记录已清除，收藏仍保留。' : '浏览器未允许修改阅读记录。'); }}>清除阅读记录</button>}
    </div>
    {entries.length ? <div className="reader-shelf-grid">{entries.slice(0, expanded ? 80 : compact ? 3 : 6).map(guide => {
      const cover = getGuideMedia(guide).cover;
      return <div className="reader-shelf-item" key={guide.slug}><Link to={`/guides/${guide.slug}`}><img src={cover.src} srcSet={cover.srcSet} sizes="96px" alt="" width={96} height={76} loading="lazy" /><span><strong>{guide.title}</strong><small>{guide.categoryLabel} · {guide.readMinutes} 分钟</small></span></Link>{active === 'saved' && <button type="button" title="取消收藏" aria-label={`取消收藏：${guide.title}`} onClick={() => { toggleSavedGuide(guide.slug); }}><X size={14} /></button>}</div>;
    })}</div> : <p className="reader-shelf-empty">遇到喜欢的攻略，点一下文章里的「收藏 · 稍后读」，下次从这里继续发现。</p>}
    {!compact && entries.length > 6 && <button type="button" className="reader-more" onClick={() => setExpanded(value => !value)}>{expanded ? '收起' : `查看全部 ${entries.length} 篇`}</button>}
    {!compact && <p className="reader-local-note">无需登录，保存在当前浏览器；换设备或清除浏览器数据后不会同步。{notice && <span role="status"> {notice}</span>}</p>}
  </section>;
}
