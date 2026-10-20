import { lazy, Suspense, useEffect, useState } from 'react';
import { EnglishOnly } from './EnglishOnly';
import { ChevronRight, Clock3, Heart, Sparkles, X } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import type { Guide } from '../data/guides';
import { getGuideBySlug } from '../data/guides';
import { getGuideMedia } from '../data/guide-media';
import { clearReadingHistory, rememberGuide, useReaderLibrary } from '../lib/reader-library';
import type { ReaderNotice } from '../features/saves/GuideSaveButton';
import { translateText, useLocale } from '../i18n/locale';
import { EditorialShareActions } from './EditorialShareActions';
import { guideShare } from '../lib/editorial-share';
import { bayBayPageQuestions } from '../lib/baybay-conversation';

// The save button and the save store behind it load on their own (route JS budgets, plan §3.0 rule 8); until then the
// same button stands disabled in its place, which is also what prerendered HTML shows.
const GuideSaveButton = lazy(() => import('../features/saves/GuideSaveButton'));
const ReadingShelfSaved = lazy(() => import('../features/saves/ReadingShelfSaved'));

/** The guide's 收藏 is the one save model (src/lib/saves.ts): the same list as My Week, kept with the account when signed in. */
export function GuideReaderActions({ guide, onAsk }: { guide: Guide; onAsk?: (question: string) => void }) {
  const locale = useLocale();
  const t = (zh: string, en: string) => locale === 'en' ? en : translateText(zh, locale);
  const [status, setStatus] = useState('');
  const [error, setError] = useState<ReaderNotice | null>(null);
  useEffect(() => { rememberGuide(guide.slug); }, [guide.slug]);
  return <div className="reader-actions-wrap">
    <div className="reader-actions" aria-label={t('文章操作', 'Article actions')}>
      <Suspense fallback={<button type="button" disabled><Heart size={16} />{t('收藏', 'Save')}</button>}><GuideSaveButton slug={guide.slug} onStatus={setStatus} onError={setError} /></Suspense>
      <EditorialShareActions item={guideShare(guide)} />
      {onAsk && <button type="button" onClick={() => onAsk(guide.category === 'education' ? bayBayPageQuestions(`/guides/${guide.slug}`)[1].question : `我正在读《${guide.title}》。请结合这篇指南，帮我整理最值得做的三件事和出发前需要确认的事项。`)}><Sparkles size={16} />{guide.category === 'education' ? '让 BayBay 整理入学步骤' : '让 BayBay 帮我整理'}</button>}
      <Link to="/my-week#saved">{t('我的收藏', 'My saved items')}<ChevronRight size={14} /></Link>
    </div>
    {status && <p className="reader-status" role="status">{status}</p>}
    {error && <p className="reader-status" role="alert">{error.text}{error.retry && <> <button type="button" onClick={error.retry}>{t('重新读取收藏', 'Reload saved items')}</button></>}</p>}
  </div>;
}

/** Saved guides (from the one save list) and the reading history, which stays in this browser. */
export function ReadingShelf({ compact = false }: { compact?: boolean }) {
  return <Suspense fallback={<ReadingShelfView compact={compact} saved={null} />}><ReadingShelfSaved compact={compact} /></Suspense>;
}

/** The shelf's saved guides; null while the save list loads. `known` is false while a signed-in list is still unread. */
export type ShelfSaved = { ids: string[]; known: boolean; busy: (slug: string) => boolean; remove: (slug: string) => void };

/** The shelf itself; ReadingShelfSaved (loaded on its own) supplies the saved guides. */
export function ReadingShelfView({ compact = false, saved: savedList }: { compact?: boolean; saved: ShelfSaved | null }) {
  const locale = useLocale();
  const t = (zh: string, en: string) => locale === 'en' ? en : translateText(zh, locale);
  const { recent } = useReaderLibrary();
  const saved = savedList?.ids ?? [];
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
    <div className="reader-shelf-heading"><div><EnglishOnly><span className="reader-eyebrow">Your little corner</span></EnglishOnly><h2 id="reader-shelf-title">{compact ? '把喜欢的湾区，留给下次。' : '你的阅读角落'}</h2></div>{compact && <Link to="/my-week#saved">我的收藏<ChevronRight size={15} /></Link>}</div>
    <div className="reader-shelf-tabs" role="group" aria-label="阅读记录">
      <button type="button" aria-pressed={active === 'saved'} onClick={() => switchTab('saved')}><Heart size={15} />我的收藏 {savedList?.known ? saved.length : '—'}</button>
      <button type="button" aria-pressed={active === 'recent'} onClick={() => switchTab('recent')}><Clock3 size={15} />最近读过</button>
      {!compact && recent.length > 0 && active === 'recent' && <button type="button" className="reader-clear" onClick={() => { const persisted = clearReadingHistory(); setNotice(persisted ? '阅读记录已清除，收藏仍保留。' : '浏览器未允许修改阅读记录。'); }}>清除阅读记录</button>}
    </div>
    {entries.length ? <div className="reader-shelf-grid">{entries.slice(0, expanded ? 80 : compact ? 3 : 6).map(guide => {
      const cover = getGuideMedia(guide).cover;
      return <div className="reader-shelf-item" key={guide.slug}><Link to={`/guides/${guide.slug}`}><img src={cover.src} srcSet={cover.srcSet} sizes="96px" alt="" width={96} height={76} loading="lazy" /><span><strong>{guide.title}</strong><small>{guide.categoryLabel} · {guide.readMinutes} 分钟</small></span></Link>{active === 'saved' && <button type="button" title="取消收藏" aria-label={`取消收藏：${guide.title}`} disabled={!savedList || savedList.busy(guide.slug)} onClick={() => savedList?.remove(guide.slug)}><X size={14} /></button>}</div>;
    })}</div> : <p className="reader-shelf-empty">{t('遇到喜欢的攻略，点一下文章里的「收藏」，下次从这里继续发现。', 'When a guide is worth keeping, tap Save in the article and find it here next time.')}</p>}
    {!compact && entries.length > 6 && <button type="button" className="reader-more" onClick={() => setExpanded(value => !value)}>{expanded ? '收起' : `查看全部 ${entries.length} 篇`}</button>}
    {!compact && <p className="reader-local-note">{t('收藏和「我的这周」是同一份，登录后跟着账号走；阅读记录只留在这个浏览器。', 'Saved guides are the same list as My Week and follow your account when you sign in. Reading history stays in this browser.')}{notice && <span role="status"> {notice}</span>}</p>}
  </section>;
}
