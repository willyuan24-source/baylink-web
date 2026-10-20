import { ChevronRight, MapPin } from 'lucide-react';
import { postAvailability } from '../lib/postAvailability';

export type BayBayMatchingPost = {
  id: string; title: string; city: string; budget: string; category?: string;
  confirmedAt?: number | null; createdAt: number; status?: 'active' | 'closed';
};

/** Real BAYLINK posts that match the question (at most 3): one row each, the panel's type and spacing tokens (UI9-BB). */
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
  return <section className="bb-posts" aria-label="站内真实帖子">
    <h3>站内真实帖子</h3>
    {note && <p className="bb-posts__note">{note}</p>}
    <div className="bb-posts__list">
      {matches.map(post => {
        const availability = postAvailability({ status: post.status, confirmedAt: post.confirmedAt, type: 'provider', category: '' });
        const path = `/posts/${encodeURIComponent(post.id)}`;
        return <a key={post.id} href={path} onClick={event => {
          if (event.button === 0 && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey) { event.preventDefault(); onNavigate(path); }
        }} className="bb-post">
          <div className="bb-post__top"><h4>{post.title}</h4><ChevronRight size={20} aria-hidden="true" /></div>
          <span className="bb-post__meta">
            {typeof post.city === 'string' && post.city && <span><MapPin size={16} aria-hidden="true" />{post.city}</span>}
            {typeof post.budget === 'string' && post.budget && <span>{post.budget}</span>}
          </span>
          <span className="bb-post__meta">{availability.label} · 查看实际帖子</span>
          <span className="bb-post__meta">{availability.detail}</span>
        </a>;
      })}
    </div>
  </section>;
};
