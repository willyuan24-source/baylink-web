import type { Guide, GuideCategory } from './guides';
import photoCredits from './guide-photo-credits.json';
import guidePhotos from './guide-photo-assets.json';
import eventMedia from './event-media-assets.json';
import originalArt from './art-media-assets.json';
import dealPromos from './deal-promo-assets.json';
import communityFreebies from './community-freebie-media.json';
import everydayFreebies from './everyday-freebie-media.json';
import targetFreebies from './target-freebie-media.json';
import readingRouteMedia from './reading-route-media.json';

export type GuideImage = {
  src: string;
  alt: string;
  caption: string;
  credit: string;
  creditUrl?: string;
  licenseUrl?: string;
  kind: 'photo' | 'illustration' | 'poster';
  width: number;
  height: number;
  fullFrame?: boolean;
  srcSet?: string;
};

const illustration = (name: string, alt: string, caption: string): GuideImage => ({
  src: `/guides/editorial/${name}.webp`, alt, caption, credit: 'BAYLINK · AI 原创插图', kind: 'illustration', width: 1536, height: 1024,
});

export const GUIDE_IMAGES: Record<string, GuideImage> = {
  settling: illustration('settling-in-illustration', '室友在阳光照进的新居里整理纸箱、钥匙和生活用品', '从把行李放下，到让一个地方像家。情境插图，不代表真实房源。'),
  weekend: illustration('weekend-illustration', '海湾、公园步道和野餐场景交织的周末插图', '给周末留一些散步和坐下来的时间。情境插图，不是导航地图。'),
  everyday: illustration('everyday-illustration', '社区市集、自行车、阅读角与日常维修的生活插图', '买菜、学习、照顾住处，慢慢建立自己的生活节奏。情境插图。'),
};

const photoCaptions: Record<string, [string, string]> = {
  coast: ['Half Moon Bay 海滩、沙岸与海岸植被', 'Half Moon Bay State Beach，2014 年实景。海滩入口与当天开放情况以公园公告为准。'],
  redwoods: ['Reinhardt Redwood 区域公园内绿荫覆盖的步道', 'Reinhardt Redwood Regional Park，2026 年实景。此图不表示某段步道当前开放。'],
  presidio: ['Presidio Tunnel Tops 的草坡、步道与远处海湾', 'Presidio Tunnel Tops，2023 年实景。不同草坪、餐桌和游乐区的使用规则不同。'],
  neighborhood: ['旧金山 Alamo Square 旁色彩各异的维多利亚式住宅', '旧金山 Alamo Square 街景，2022 年摄。展示街区风貌，不是本站在租房源。'],
  lake: ['Lake Merritt 水面与 Oakland 城市天际线', '从 Lake Merritt 看 Oakland，2008 年资料照片；用于呈现湖区环境，不代表最新城市景观。'],
  train: ['停靠 Santa Clara 车站的 Caltrain 电力列车', 'Caltrain 电力列车在 Santa Clara，2024 年摄。乘车前另查现行班次与停站。'],
  sanjose: ['远眺 San Jose 的住宅街区与市中心建筑', 'San Jose 街区与市中心，2008 年资料照片，不代表当前城市全貌。'],
  bay: ['从湾面眺望有薄雾的金门大桥与船行水迹', '从水面看金门大桥，2011 年资料照片。用于呈现湾景，不对应特定渡轮航线。'],
};
for (const photo of photoCredits) {
  const [alt, caption] = photoCaptions[photo.key];
  GUIDE_IMAGES[photo.key] = { src: photo.src, alt, caption, credit: `${photo.author} · ${photo.license} · 已缩放压缩，卡片裁切`, creditUrl: photo.sourceUrl, licenseUrl: photo.licenseUrl.replace(/^http:/, 'https:'), kind: 'photo', width: photo.width, height: photo.height };
}
for (const { key, ...asset } of [...guidePhotos, ...eventMedia, ...originalArt, ...dealPromos, ...communityFreebies, ...everydayFreebies, ...targetFreebies, ...readingRouteMedia]) {
  GUIDE_IMAGES[key] = { ...asset, kind: asset.kind as GuideImage['kind'] };
}
for (const image of Object.values(GUIDE_IMAGES)) image.srcSet ??= `${image.src.replace('.webp', '-small.webp')} 480w, ${image.src} ${image.width}w`;

const bySlug: Record<string, [string, string]> = {
  'golden-gate-park-free-car-free-day-guide': ['ggp-conservatory', 'jfk-promenade'],
  'palo-alto-baylands-family-walk-guide': ['baylands-marsh', 'baylands-gull'],
  'bay-area-freebies-deals-2026-09': ['september-freebies', 'deal-85c-september'],
  'bay-area-rental-scam-guide': ['rental-scam', 'rental-viewing'],
  'rental-lease-checklist-before-signing': ['lease-review', 'moving-handover'],
  'bay-area-first-rental-process': ['rental-viewing', 'lease-review'],
  'bay-area-where-to-live-first-month': ['sanmateo', 'train'],
  'bay-area-newcomer-first-month-checklist': ['settling', 'utilities-setup'],
  'bay-area-roommate-guide': ['roommate-agreement', 'lease-review'],
  'bay-area-commute-guide': ['train', 'bart'],
  'bay-area-without-car-guide': ['bart', 'train'],
  'bay-area-airport-arrival-guide': ['sfo', 'bart'],
  'peninsula-living-guide': ['burlingame', 'sanmateo'],
  'south-bay-living-guide': ['sanjose', 'sanjose-city'],
  'bay-area-regions-explained': ['bay', 'lake'],
  'san-francisco-guide': ['neighborhood', 'presidio'],
  'san-jose-guide': ['sanjose-city', 'sanjose'],
  'east-bay-first-weekend-guide': ['lake', 'bart'],
  'north-bay-car-free-day-guide': ['sausalito', 'bay'],
  'bay-area-library-starter-guide': ['library', 'everyday'],
  'half-moon-bay-coastal-half-day-guide': ['coast', 'weekend'],
  'reinhardt-redwood-first-walk-guide': ['redwoods', 'weekend'],
  'bay-area-farmers-market-shopping-guide': ['ferry-market', 'produce'],
  'rainy-day-museum-family-guide': ['museum', 'lake'],
  'presidio-picnic-day-guide': ['presidio', 'weekend'],
  'bay-area-dog-park-first-outing-guide': ['dog-park', 'dog'],
  'bay-area-used-trading-safety-guide': ['secondhand-check', 'digital-safety'],
  'move-in-move-out-checklist': ['moving-handover', 'lease-review'],
  'local-service-safety-guide': ['service-quote', 'repair'],
  'baylink-safety-guide': ['digital-safety', 'secondhand-check'],
  'bay-area-moving-checklist': ['moving-plan', 'moving-handover'],
  'bay-area-used-furniture-appliance-guide': ['furniture-inspection', 'moving-plan'],
  'baylink-posting-guide-for-trust': ['posting-trust', 'service-quote'],
  'bay-area-cleaning-quote-checklist': ['cleaning-quote', 'service-quote'],
  'bay-area-repair-request-guide': ['repair', 'service-quote'],
  'bay-area-translation-service-guide': ['translation-documents', 'digital-safety'],
  'bay-area-part-time-job-safety-guide': ['part-time-safety', 'digital-safety'],
  'bay-area-utilities-address-change-guide': ['utilities-setup', 'moving-plan'],
  'california-driver-license-id-preparation-guide': ['driver-id-prep', 'translation-documents'],
};

const categoryImages: Record<GuideCategory, string> = { rent: 'settling', roommate: 'settling', used: 'everyday', service: 'everyday', commute: 'weekend', newcomer: 'settling', city: 'weekend', safety: 'everyday', events: 'weekend' };

export const getGuideMedia = (guide: Guide): { cover: GuideImage; inline: { afterHeading: number; image: GuideImage }[] } => {
  const mapped = bySlug[guide.slug];
  const cover = GUIDE_IMAGES[mapped?.[0] || categoryImages[guide.category]];
  const inline = mapped ? GUIDE_IMAGES[mapped[1]] : undefined;
  return { cover, inline: inline && inline !== cover ? [{ afterHeading: Math.min(2, guide.blocks.filter(block => block.type === 'heading').length), image: inline }] : [] };
};
