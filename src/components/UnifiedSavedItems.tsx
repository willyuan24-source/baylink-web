import { useLayoutEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Heart } from 'lucide-react';
import { getGuideBySlug } from '../data/guides';
import { favoritePath, favoriteTitle, type Favorite } from '../lib/planner';
import { useReaderLibrary, toggleSavedGuide } from '../lib/reader-library';
import { useSavedPosts, toggleSavedPost } from '../lib/savedPosts';
import { getStoredUser } from '../lib/session';
import { translateText, useLocale } from '../i18n/locale';

export function UnifiedSavedItems({ userId, favorites, ready, busy, error, onToggleFavorite }: {
  userId?: string; favorites: Favorite[]; ready: boolean; busy: boolean; error: string;
  onToggleFavorite: (favorite: Favorite) => Promise<unknown>;
}) {
  const locale = useLocale();
  const t = (zh: string, en: string) => locale === 'en' ? en : translateText(zh, locale);
  const reader = useReaderLibrary();
  const posts = useSavedPosts(userId);
  const [status, setStatus] = useState('');
  const [removing, setRemoving] = useState(false);
  const countUnknown = !!error && !ready;
  const owner = useRef(userId);
  const mutationLock = useRef(false);
  useLayoutEffect(() => { owner.current = userId; mutationLock.current = false; setStatus(''); setRemoving(false); }, [userId]);
  const items = new Map<string, { kind: string; id: string; title: string; path: string; local: boolean; favorite?: Favorite }>();
  for (const favorite of favorites) items.set(`${favorite.kind}:${favorite.id}`, {
    ...favorite, title: favoriteTitle(favorite), path: favoritePath(favorite), local: !userId, favorite,
  });
  for (const slug of reader.saved) {
    const guide = getGuideBySlug(slug);
    if (!guide) continue;
    const key = `guide:${slug}`;
    const existing = items.get(key);
    if (existing) existing.local = true;
    else items.set(key, { kind: 'guide', id: slug, title: guide.title, path: `/guides/${slug}`, local: true });
  }
  for (const post of posts) items.set(`post:${post.id}`, { kind: 'post', id: post.id, title: post.title, path: `/posts/${encodeURIComponent(post.id)}`, local: true });
  const remove = async (item: (typeof items extends Map<string, infer T> ? T : never)) => {
    if (mutationLock.current || busy) return;
    const operationOwner = userId;
    mutationLock.current = true;
    setRemoving(true); setStatus('');
    try {
      if (item.favorite) {
        if (!ready) return;
        const result = await onToggleFavorite(item.favorite);
        if (!result) return;
        if (owner.current !== operationOwner) return;
        if (userId && getStoredUser()?.id !== userId) return;
      }
      let persisted = true;
      if (item.kind === 'guide' && reader.saved.includes(item.id)) persisted = toggleSavedGuide(item.id).persisted;
      if (item.kind === 'post') {
        const post = posts.find(post => post.id === item.id);
        if (post) {
          const result = toggleSavedPost(window.localStorage, userId, post);
          if (result.error) { setStatus(t(result.error, 'Your browser could not update this saved listing. Try again.')); return; }
        }
      }
      setStatus(persisted ? t('已取消收藏。', 'Removed from saved items.') : t('当前页面已移除，但浏览器未允许保存修改，刷新后可能恢复。', 'Removed for this visit. Your browser could not save the change, so it may return after a refresh.'));
    } catch { if (owner.current === operationOwner) setStatus(t('暂时无法取消收藏，请重试。', 'This item could not be removed. Try again.')); }
    finally { if (owner.current === operationOwner) { mutationLock.current = false; setRemoving(false); } }
  };
  return <section className="week-favorites" id="saved" aria-label={t('统一收藏', 'All saved items')}>
    <div className="planner-section-head"><h2><Heart size={20} />{t('想留着再看', 'Saved for another day')}</h2><span aria-label={countUnknown ? t('账号收藏暂时未知', 'Account saved items unavailable') : undefined}>{countUnknown ? '—' : items.size}</span></div>
    <p className="planner-note">{t('活动、地点、指南和邻里信息都在这里。标注「本机」的收藏只留在当前浏览器。', 'Events, places, guides and neighborhood listings are together here. Items marked “This device” stay in this browser.')}</p>
    {error && <p role="status" className="planner-note">{countUnknown ? t('账号收藏暂时无法读取；下方仍可查看本机收藏。请使用上方入口重试。', 'Account saved items could not be loaded. Device items remain below; use the retry control above.') : t('更新失败，保留已读取的收藏；请重试。', 'The update failed. Previously loaded saved items remain; try again.')}</p>}
    {!items.size && !error && <p className="planner-note">{t('找到喜欢的内容后，点「收藏」即可从这里找回。', 'Save something you like and return to it here.')}</p>}
    <ul>{[...items.entries()].map(([key, item]) => {
      const title = item.kind === 'post' ? item.title : translateText(item.title, locale);
      return <li key={key}>
      <Link to={item.path}><span translate={item.kind === 'post' ? 'no' : undefined}>{title}</span></Link>
      <small>{item.local && userId && item.favorite ? t('本机及账号', 'Device and account') : item.local ? t('本机', 'This device') : t('账号同步', 'Account synced')}</small>
      <button type="button" disabled={removing || busy || (!!item.favorite && !ready)} aria-label={`${t('取消收藏', 'Remove saved item')}: ${title}`} onClick={() => void remove(item)}>{t('取消收藏', 'Remove')}</button>
    </li>; })}</ul>
    {status && <p role="status" className="planner-note">{status}</p>}
  </section>;
}
