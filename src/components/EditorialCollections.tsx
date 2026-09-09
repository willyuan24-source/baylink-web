import { ArrowUpRight, Compass, KeyRound, MessagesSquare } from 'lucide-react';
import { Link } from 'react-router-dom';
import { editorialCollections } from '../data/editorial-collections';

const icons = [KeyRound, MessagesSquare, Compass];

/** Small editorial link data keeps full article content out of the homepage bundle. */
export function EditorialCollections({ compact = false }: { compact?: boolean }) {
  return (
    <section className={`editorial-collections ${compact ? 'editorial-collections--compact' : ''}`} aria-label="BAYLINK 编辑专题">
      <header className="editorial-collections__heading">
        <span className="editorial-collections__eyebrow">THE LOCAL EDIT</span>
        <h2>{compact ? '生活灵感，按主题看。' : '把生活的小事，慢慢理顺。'}</h2>
        {!compact && <p>把相关指南放在一起，陪你从一个问题，走到下一步。</p>}
      </header>
      <div className="editorial-collections__grid">
        {editorialCollections.map(({ id, title, intro, guides }, index) => {
          const Icon = icons[index] || Compass;
          return (
          <article key={id} className="editorial-collection" data-collection={id}>
            <div className="editorial-collection__label"><span className="editorial-collection__icon"><Icon size={compact ? 19 : 24} strokeWidth={1.65} aria-hidden="true" /></span><span className="editorial-collection__number">专题 {String(index + 1).padStart(2, '0')}</span></div>
            <h3>{title}</h3>
            <p className="editorial-collection__intro">{intro}</p>
            <ol className="editorial-collection__links">
              {(compact ? guides.slice(0, 1) : guides).map((guide) => (
                <li key={guide.slug}><Link to={`/guides/${guide.slug}`}><span>{guide.label}</span><ArrowUpRight size={16} aria-hidden="true" /></Link></li>
              ))}
            </ol>
          </article>
          );
        })}
      </div>
    </section>
  );
}
