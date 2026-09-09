import { ArrowUpRight, MapPin } from 'lucide-react';
import { postAvailability } from '../lib/postAvailability';

export type BayBayMatchingPost = {
  id: string; title: string; city: string; budget: string; category?: string;
  confirmedAt?: number | null; createdAt: number; status?: 'active' | 'closed';
};

export const BayBayMatchingPosts = ({ posts, note, onNavigate }: {
  posts: unknown; note?: string | null; onNavigate: (path: string) => void;
}) => {
  const seen = new Set<string>();
  const matches: BayBayMatchingPost[] = Array.isArray(posts) ? posts.filter((post): post is BayBayMatchingPost => {
    if (!post || typeof post !== 'object' || typeof post.id !== 'string' || !post.id.trim()
      || typeof post.title !== 'string' || !post.title.trim() || seen.has(post.id)) return false;
    seen.add(post.id);
    return true;
  }).slice(0, 3) : [];
  if (!matches.length && !note) return null;
  return <section className="mt-4 border-t border-baylink-border pt-4" aria-label="站内真实帖子">
    <h3 className="text-sm font-semibold text-baylink-text">站内真实帖子</h3>
    {note && <p className="mt-1 text-xs leading-relaxed text-baylink-text-secondary">{note}</p>}
    <div className="mt-2 space-y-2">
      {matches.map(post => {
        const availability = postAvailability({ status: post.status, confirmedAt: post.confirmedAt, type: 'provider', category: '' });
        const path = `/posts/${encodeURIComponent(post.id)}`;
        return <a key={post.id} href={path} onClick={event => {
          if (event.button === 0 && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey) { event.preventDefault(); onNavigate(path); }
        }} className="block min-h-11 rounded-xl border border-baylink-border bg-white p-3 text-baylink-text transition hover:border-baylink-green focus-visible:outline focus-visible:outline-2 focus-visible:outline-baylink-green">
          <div className="flex items-start justify-between gap-2"><h4 className="text-sm font-semibold leading-relaxed">{post.title}</h4><ArrowUpRight size={16} className="mt-1 shrink-0" aria-hidden="true" /></div>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-baylink-text-secondary">
            {typeof post.city === 'string' && post.city && <span className="inline-flex items-center gap-1"><MapPin size={12} aria-hidden="true" />{post.city}</span>}
            {typeof post.budget === 'string' && post.budget && <span>{post.budget}</span>}
          </div>
          <p className="mt-2 text-xs leading-relaxed text-baylink-text-secondary">{availability.label} · 查看实际帖子</p>
          <p className="mt-1 text-[11px] leading-relaxed text-baylink-text-secondary">{availability.detail}</p>
        </a>;
      })}
    </div>
  </section>;
};
