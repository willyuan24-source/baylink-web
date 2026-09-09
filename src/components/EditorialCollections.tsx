import { ArrowUpRight, Compass, KeyRound, MessagesSquare } from 'lucide-react';
import { Link } from 'react-router-dom';

const collections = [
  {
    id: 'settle-in',
    title: '安顿新生活',
    intro: '从抵达湾区的第一段路，到借书、办事与建立自己的日常。',
    icon: KeyRound,
    guides: [
      { slug: 'bay-area-airport-arrival-guide', label: '机场落地，怎么回家？' },
      { slug: 'bay-area-library-starter-guide', label: '从一张图书馆卡开始' },
      { slug: 'bay-area-newcomer-first-month-checklist', label: '新来湾区的第一个月' },
    ],
  },
  {
    id: 'ask-for-help',
    title: '找人帮忙，先讲清楚',
    intro: '把范围、时间与交付讲明白，让清洁、维修和翻译更好沟通。',
    icon: MessagesSquare,
    guides: [
      { slug: 'bay-area-cleaning-quote-checklist', label: '找清洁，先讲清报价范围' },
      { slug: 'bay-area-repair-request-guide', label: '找维修，怎样描述问题？' },
      { slug: 'bay-area-translation-service-guide', label: '找翻译，先确认交付要求' },
    ],
  },
  {
    id: 'weekend-nearby',
    title: '周末走近湾区',
    intro: '从东湾街区到北湾一日出行，留一点时间重新认识附近。',
    icon: Compass,
    guides: [
      { slug: 'east-bay-first-weekend-guide', label: '东湾的第一个周末' },
      { slug: 'north-bay-car-free-day-guide', label: '不自驾，去北湾走一天' },
      { slug: 'san-francisco-guide', label: '走近旧金山的日常' },
    ],
  },
];

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
        {collections.map(({ id, title, intro, icon: Icon, guides }, index) => (
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
        ))}
      </div>
    </section>
  );
}
