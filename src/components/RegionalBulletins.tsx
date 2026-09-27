import { ArrowUpRight } from 'lucide-react';
import { regionalBulletins } from '../data/late-september-local';
import { recordProductEvent } from '../lib/product-events';

export function RegionalBulletins({ today }: { today: string }) {
  const items = regionalBulletins.filter(item => item.expiresAt >= today);
  if (!items.length) return null;
  return <section className="regional-bulletins" id="monthly-news" aria-labelledby="monthly-news-heading">
    <div className="bl-monthly-section-heading"><div><span className="bl-monthly-eyebrow">AROUND THE BAY</span><h2 id="monthly-news-heading">五区生活快讯</h2></div><p>交通、图书馆与生活服务的近期变动，按地区快速查阅。</p></div>
    <div className="regional-bulletins-grid">{items.map(item => <article key={item.id}>
      <span className="regional-bulletin-region">{item.label}</span>
      <h3>{item.title}</h3>
      <p className="regional-bulletin-date">{item.dateLabel}</p>
      <p>{item.summary}</p>
      <a href={item.sourceUrl} target="_blank" rel="noopener noreferrer" onClick={() => recordProductEvent('official_source_click')}>{item.sourceLabel}<ArrowUpRight size={14} aria-hidden="true" /></a>
      <small>已核对 <time dateTime={item.verifiedAt}>{item.verifiedAt}</time></small>
    </article>)}</div>
  </section>;
}
