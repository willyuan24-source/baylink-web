import { useState } from 'react';
import { ArrowDown, ArrowUpRight, CalendarDays, MapPin, Store } from 'lucide-react';
import { Link } from 'react-router-dom';
import { septemberOpenings, type SeptemberOpening } from '../data/september-openings';
import { GUIDE_IMAGES } from '../data/guide-media';
import { GuideImageLightbox } from './GuideVisuals';
import { translateText, useLocale } from '../i18n/locale';

export const OPENINGS_GUIDE_SLUG = 'bay-area-new-openings-2026-09';
const regionLabels = { sf: '旧金山', 'east-bay': '东湾', 'south-bay': '南湾', peninsula: '半岛', 'north-bay': '北湾' };
const openingMap = (shop: SeptemberOpening) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${shop.name} ${shop.address} ${shop.city}`)}`;

function OpeningCard({ shop }: { shop: SeptemberOpening }) {
  const [zoomed, setZoomed] = useState(false);
  const image = GUIDE_IMAGES[shop.imageKey];
  const label = shop.openingType === 'opening-celebration' ? '开业庆典' : shop.status === 'open' ? '已开业' : '开业预告';
  return <article className="bl-opening-card" aria-labelledby={`opening-${shop.id}`}>
    {image && <figure className="bl-opening-photo">
      <button type="button" onClick={() => setZoomed(true)} aria-label={`${translateText('查看大图')}：${shop.name}`}>
        <img src={image.src} srcSet={image.srcSet} sizes="(max-width: 639px) calc(100vw - 40px), (max-width: 1023px) 50vw, 430px" alt={image.alt} width={image.width} height={image.height} loading="lazy" decoding="async" />
        <span>{image.kind === 'illustration' ? 'AI 原创插图' : image.kind === 'poster' ? '官方宣传图' : '资料照片'}</span>
      </button>
    </figure>}
    <div className="bl-opening-copy">
      <div className="bl-opening-topline"><span className={`bl-opening-status bl-opening-status--${shop.status}`}>{label}</span><span>{shop.category}</span></div>
      <h3 id={`opening-${shop.id}`}>{shop.name}</h3>
      <p className="bl-opening-date"><CalendarDays size={14} aria-hidden="true" />{shop.dateLabel}</p>
      <p className="bl-opening-location"><MapPin size={14} aria-hidden="true" />{shop.city} · {shop.address}</p>
      <p>{shop.summary}</p>
      <div className="bl-opening-tip"><strong>怎么安排</strong><p>{shop.editorTip}</p></div>
      <div className="bl-opening-links"><a href={shop.officialUrl} target="_blank" rel="noopener noreferrer">商家入口 <ArrowUpRight size={14} aria-hidden="true" /></a><a href={openingMap(shop)} target="_blank" rel="noopener noreferrer">查看位置 <MapPin size={14} aria-hidden="true" /></a></div>
      <details className="bl-opening-source"><summary>开业消息与图片来源</summary><a href={shop.sourceUrl} target="_blank" rel="noopener noreferrer">{shop.sourceLabel} <ArrowUpRight size={12} aria-hidden="true" /></a><p>核对 {shop.verifiedAt}</p>{image && <><p>{image.caption}</p>{image.creditUrl && <a href={image.creditUrl} target="_blank" rel="noopener noreferrer">{image.credit}</a>}</>}</details>
    </div>
    {zoomed && image && <GuideImageLightbox image={image} onClose={() => setZoomed(false)} />}
  </article>;
}

export function MonthlyOpenings({ today }: { today: string }) {
  useLocale();
  const [status, setStatus] = useState<'all' | 'open' | 'announced'>('all');
  const [region, setRegion] = useState('all');
  const [expanded, setExpanded] = useState(false);
  const archived = today.slice(0, 7) !== '2026-09';
  const openCount = septemberOpenings.filter(shop => shop.status === 'open').length;
  const filtered = septemberOpenings.filter(shop => (status === 'all' || shop.status === status) && (region === 'all' || shop.region === region));
  const visible = expanded ? filtered : filtered.slice(0, 6);
  return <section id="monthly-openings" className="bl-monthly-openings" aria-labelledby="monthly-openings-heading">
    <div className="bl-monthly-section-heading"><div><span className="bl-monthly-eyebrow">NEW AROUND THE CORNER</span><h2 id="monthly-openings-heading">{archived ? '本期新店记录' : '九月，新开的一扇门。'}</h2></div><p>咖啡、晚餐与街区新面孔。先确认开门，再安排这一趟。</p></div>
    <div className="bl-openings-note"><Store size={20} aria-hidden="true" /><p>{archived ? '这是九月的开业消息快照，当前营业情况请查商家公告。' : '已开业、开业庆典与预告分别标示。庆典日期不等于首日营业；推荐基于公开资料整理，尚未实地探店。'}</p></div>
    <div className="bl-openings-controls">
      <div className="bl-openings-filters" role="group" aria-label="按开业状态筛选">{([
        ['all', '全部新店', septemberOpenings.length], ['open', '已开业', openCount], ['announced', '预告与庆典', septemberOpenings.length - openCount],
      ] as const).map(([value, label, count]) => <button key={value} type="button" aria-pressed={status === value} onClick={() => { setStatus(value); setExpanded(false); }}>{label}<span>{count}</span></button>)}</div>
      <label className="bl-openings-region"><MapPin size={16} aria-hidden="true" /><span className="sr-only">新店所在地区</span><select aria-label="新店所在地区" value={region} onChange={event => { setRegion(event.target.value); setExpanded(false); }}><option value="all">所有新店地区</option>{Object.entries(regionLabels).filter(([key]) => septemberOpenings.some(shop => shop.region === key)).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
    </div>
    {visible.length ? <div className="bl-opening-grid">{visible.map(shop => <OpeningCard key={shop.id} shop={shop} />)}</div> : <div className="bl-monthly-empty"><Store size={28} aria-hidden="true" /><p>这个地区暂没有符合条件的已核实新店。</p><button type="button" onClick={() => { setStatus('all'); setRegion('all'); }}>查看全部新店</button></div>}
    <div className="bl-openings-footer">{filtered.length > visible.length && <button type="button" onClick={() => setExpanded(true)}>展开其余新店 <ArrowDown size={15} aria-hidden="true" /></button>}<Link to={`/guides/${OPENINGS_GUIDE_SLUG}`}>收藏新店手册 <ArrowUpRight size={15} aria-hidden="true" /></Link></div>
  </section>;
}
