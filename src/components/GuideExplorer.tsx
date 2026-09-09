import { useState } from 'react';
import { ArrowRight, ArrowUpRight, MapPin } from 'lucide-react';
import { Link } from 'react-router-dom';
import { getGuideBySlug } from '../data/guides';
import { GUIDE_IMAGES, getGuideMedia } from '../data/guide-media';
import { handleGuideLinkClick } from './GuideCard';

const IDEAS = [
  { label: '去海边', slug: 'half-moon-bay-coastal-half-day-guide', place: 'HALF MOON BAY', note: '风有点大，日程可以慢一点。', detail: '海岸短走 / 看海休息 / 随时折返' },
  { label: '走进树林', slug: 'reinhardt-redwood-first-walk-guide', place: 'EAST BAY', note: '把脚步放轻，把绿色看仔细。', detail: '公园步道 / 出发查开放公告 / 量力而行' },
  { label: '买点新鲜的', slug: 'bay-area-farmers-market-shopping-guide', place: 'NEIGHBORHOOD LIFE', note: '让一袋新鲜食材，安排这周的餐桌。', detail: '市集准备 / 询问产地 / 按需购买' },
  { label: '雨天也出门', slug: 'rainy-day-museum-family-guide', place: 'INDOOR EXPLORING', note: '换一种天气，也换一种发现。', detail: '场馆选择 / 预约核对 / 带孩子慢慢看' },
  { label: '铺开野餐垫', slug: 'presidio-picnic-day-guide', place: 'SAN FRANCISCO', note: '坐在草地上，也算认真过周末。', detail: '公园选点 / 野餐准备 / 散步收尾' },
  { label: '带狗一起走', slug: 'bay-area-dog-park-first-outing-guide', place: 'WITH YOUR DOG', note: '出门前，先读懂这片公园的规则。', detail: '牵引范围 / 随身用品 / 清理与礼让' },
];

export function GuideExplorer({ onOpenGuide }: { onOpenGuide: (slug: string) => void }) {
  const [selected, setSelected] = useState(0);
  const idea = IDEAS[selected];
  const guide = getGuideBySlug(idea.slug);
  if (!guide) return null;
  const { cover } = getGuideMedia(guide);
  return <section className="bl-guide-explorer" aria-labelledby="guide-explorer-title">
    <div className="bl-guide-explorer-heading"><div><span className="bl-guide-eyebrow">MAKE A LITTLE ROOM FOR LIFE</span><h2 id="guide-explorer-title">今天，想怎么过？</h2></div><span>新写的攻略，新的小期待。</span></div>
    <div className="bl-guide-mood-picker" role="group" aria-label="选择周末灵感">{IDEAS.map((item, index) => <button type="button" key={item.slug} aria-pressed={selected === index} onClick={() => setSelected(index)}>{item.label}</button>)}</div>
    <div className="bl-guide-explorer-feature" aria-live="polite">
      <Link className="bl-guide-explorer-image" to={`/guides/${guide.slug}`} onClick={event => handleGuideLinkClick(event, () => onOpenGuide(guide.slug))} aria-label={`阅读${guide.title}`}><img src={cover.src} srcSet={cover.srcSet} sizes="(max-width: 639px) calc(100vw - 40px), 650px" width={cover.width} height={cover.height} alt={cover.alt} loading="lazy" decoding="async" /><span>{cover.kind === 'photo' ? '实景照片' : 'AI 原创插图'} <ArrowUpRight size={16} /></span></Link>
      <div className="bl-guide-explorer-copy"><span className="bl-guide-eyebrow"><MapPin size={13} /> {idea.place}</span><h3>{idea.note}</h3><p>{guide.summary}</p><span className="bl-guide-explorer-detail">{idea.detail}</span><Link to={`/guides/${guide.slug}`} onClick={event => handleGuideLinkClick(event, () => onOpenGuide(guide.slug))}>读这篇攻略 <ArrowRight size={17} /></Link><small>{guide.readMinutes} 分钟阅读 · 附官方资料</small></div>
    </div>
  </section>;
}

export function GuideImageCredits() {
  return <details className="bl-guide-image-credits"><summary>关于图片与授权</summary><p>实景照片保留作者与拍摄年份，文章图注说明地点；资料照片不代表实时景况。BAYLINK 的 AI 原创插图用于表达生活情境。网页图片已缩放压缩，卡片按版面裁切。</p><ul>{Object.entries(GUIDE_IMAGES).filter(([,image]) => image.kind === 'photo').map(([key, image]) => <li key={key}><a href={image.creditUrl} target="_blank" rel="noopener noreferrer">{image.alt}</a><span>{image.credit}</span><a href={image.licenseUrl} target="_blank" rel="noopener noreferrer">查看图片授权 <ArrowUpRight size={12} /></a></li>)}</ul></details>;
}
