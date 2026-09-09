import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, Bookmark, ChevronDown, Loader2, RotateCw } from 'lucide-react';
import { useSavedPosts } from '../lib/savedPosts';
import { api } from '../lib/api';
import type { PostData } from '../lib/types';
import { BookmarkButton } from './BookmarkButton';
import { PostAvailabilityBadge } from './PostAvailabilityBadge';

type Lookup = { state: 'ready'; post: PostData } | { state: 'unavailable' | 'error' };
type LookupSession = { controller: AbortController; requested: Set<string>; queue: string[]; active: number; pump: () => void };
export function SavedPostsPanel({ userId }: { userId?: string }) {
  const saved = useSavedPosts(userId);
  const [open, setOpen] = useState(false);
  const [limit, setLimit] = useState(6);
  const [retry, setRetry] = useState(0);
  const [lookup, setLookup] = useState<Record<string, Lookup>>({});
  const sessionRef = useRef<LookupSession | null>(null);
  const visibleKey = JSON.stringify(saved.slice(0, limit).map((item) => item.id));
  useEffect(() => {
    setLookup({});
    if (!open) return;
    const controller = new AbortController();
    const session: LookupSession = { controller, requested: new Set(), queue: [], active: 0, pump: () => {} };
    session.pump = () => {
      while (!controller.signal.aborted && session.active < 6 && session.queue.length) {
        const id = session.queue.shift()!;
        session.active += 1;
        api.request(`/posts/${encodeURIComponent(id)}`, { signal: controller.signal }).then((data) => {
          if (!controller.signal.aborted) setLookup((previous) => ({ ...previous, [id]: data.id === id ? { state: 'ready', post: data } : { state: 'error' } }));
        }).catch((error: unknown) => {
          if (controller.signal.aborted) return;
          const status = error && typeof error === 'object' && 'status' in error ? error.status : null;
          setLookup((previous) => ({ ...previous, [id]: { state: status === 404 || status === 403 ? 'unavailable' : 'error' } }));
        }).finally(() => {
          session.active -= 1;
          session.pump();
        });
      }
    };
    sessionRef.current = session;
    return () => {
      controller.abort();
      if (sessionRef.current === session) sessionRef.current = null;
    };
  }, [open, retry, userId]);

  useEffect(() => {
    const session = sessionRef.current;
    if (!open || !session || session.controller.signal.aborted) return;
    const ids: string[] = JSON.parse(visibleKey);
    for (const id of ids) {
      if (session.requested.has(id)) continue;
      session.requested.add(id);
      session.queue.push(id);
    }
    session.pump();
  }, [open, visibleKey, retry, userId]);

  return <section className="saved-posts-panel" aria-label="我的收藏">
    <button type="button" className="saved-posts-toggle" aria-expanded={open} aria-controls="saved-posts-list" onClick={() => setOpen((value) => !value)}><Bookmark size={21} /><span><strong>我的收藏 <b>{saved.length}</b></strong><small>保存在此设备，方便下次回来继续看</small></span><ChevronDown size={19} className={open ? 'is-open' : ''} /></button>
    {open && <div id="saved-posts-list" className="saved-posts-list">
      <p className="saved-posts-note">{userId ? '当前账号在此浏览器的收藏。' : '当前访客在此浏览器的收藏。'}切换设备不会同步；打开时会重新检查信息状态。</p>
      {!saved.length && <div className="saved-posts-empty"><p>看到感兴趣的房源、服务或好物，点一下“收藏”。</p><Link to="/">去发现本地信息 <ArrowUpRight size={15} /></Link></div>}
      {saved.slice(0, limit).map((item) => {
        const result = lookup[item.id];
        const current = result?.state === 'ready' ? result.post : null;
        return <article key={item.id} className="saved-post-item">
          <div><span className="saved-post-meta">{current?.category || item.category} · {current?.city || item.city || '湾区'}</span><h3 translate="no">{current ? <Link to={`/posts/${encodeURIComponent(item.id)}`}>{current.title}<ArrowUpRight size={15} /></Link> : item.title}</h3>
            {current ? <div className="saved-post-facts"><strong>{current.budget ? <span translate="no">{current.budget}</span> : '详情见介绍'}</strong><PostAvailabilityBadge post={current} /></div> : !result ? <p role="status"><Loader2 size={13} className="animate-spin" /> 正在检查信息…</p> : result.state === 'unavailable' ? <p>这条信息目前不可访问，可以移除收藏。</p> : <p>暂时无法检查，请稍后重试。</p>}
          </div><BookmarkButton post={current || item} userId={userId} />
        </article>;
      })}
      {saved.length > limit && <button type="button" className="saved-post-more" onClick={() => setLimit((value) => value + 6)}>查看更多收藏</button>}
      {saved.length > 0 && <button type="button" className="saved-post-more" onClick={() => setRetry((value) => value + 1)}><RotateCw size={14} /> 重新检查状态</button>}
    </div>}
  </section>;
}
