import { useId } from 'react';
import { ArrowUpRight, MapPin } from 'lucide-react';

const areas = [
  { name: '北湾', city: 'Marin · Napa · Sonoma', x: 30, y: 19 },
  { name: '旧金山', city: 'San Francisco · Daly City', x: 28, y: 43 },
  { name: '中半岛', city: 'San Mateo · Redwood City', x: 35, y: 68 },
  { name: '东湾', city: 'Oakland · Fremont · Berkeley', x: 75, y: 43 },
  { name: '南湾', city: 'San Jose · Sunnyvale · Cupertino', x: 68, y: 82 },
];

export function RegionExplorer({ selected, onSelect }: { selected: string; onSelect: (region: string) => void }) {
  const patternId = useId();
  const area = areas.find((item) => item.name === selected);
  return <section className="region-explorer">
    <div className="bay-section-kicker"><MapPin size={14} /> FIND YOUR NEIGHBORHOOD</div>
    <div className="bay-section-heading"><h2>你的生活，在哪一湾？</h2><ArrowUpRight size={19} /></div>
    <p>点选地区，发现身边的信息。</p>
    <div className="region-map">
      <svg viewBox="0 0 300 270" aria-hidden="true" className="region-map-art"><defs><pattern id={patternId} width="14" height="14" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r=".7" fill="#BCCCB9" /></pattern></defs><rect width="300" height="270" fill="#F0F4EB" /><rect width="300" height="270" fill={`url(#${patternId})`} /><path d="M155 -15 C 88 30 149 37 133 78 S 155 120 172 157 S 193 195 201 211 C 226 188 191 169 194 139 S 151 93 169 63 S 220 38 187 -15Z" fill="#C8DDD6" /><path d="M150 11 C132 36 167 48 152 76 S155 132 180 156 S187 184 201 202" fill="none" stroke="#fff" strokeWidth="2" strokeDasharray="3 6" /><path d="M54 90 L190 111 M108 198 L223 173" stroke="#FFFFFF" strokeWidth="5" fill="none" /><path d="M55 89 L190 110 M108 197 L223 172" stroke="#C0CCC0" strokeWidth="1" strokeDasharray="4 4" fill="none" /><text x="140" y="112" fill="#6C9585" fontSize="8" transform="rotate(48 140 112)" letterSpacing="2">SAN FRANCISCO BAY</text></svg>
      {areas.map((item) => <button key={item.name} type="button" className={`region-map-pin ${selected === item.name ? 'is-active' : ''}`} style={{ left: `${item.x}%`, top: `${item.y}%` }} aria-pressed={selected === item.name} onClick={() => onSelect(selected === item.name ? '全部' : item.name)}><span /><b>{item.name}</b></button>)}
      <span className="region-map-caption">地区示意 · 非精确地图</span>
    </div>
    <div className="region-selection"><span><strong>{area?.name || '整个湾区'}</strong><small>{area?.city || '每一湾，都有值得连接的邻居'}</small></span><button type="button" onClick={() => onSelect('全部')} disabled={!area}>查看全部</button></div>
  </section>;
}
