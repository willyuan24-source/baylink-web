import officialOfferMedia from './official-offer-media-2026-10.json';
import publicServiceMedia from './public-service-media.json';
import { getLocale } from '../i18n/locale';
import { VERIFIED_PLACE_PHOTO_ALIASES } from './verified-place-media-updates';
import extraEast from './city-roundup-extra-media-east.json';
import extraSouth from './city-roundup-extra-media-south.json';
import extraNorth from './city-roundup-extra-media-north.json';
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
import sfAttractionMedia from './attractions-sf-media.json';
import regionalAttractionMedia from './attractions-regions-media.json';
import expandedInlandMedia from './attractions-expanded-inland-media.json';
import expandedCoastMedia from './attractions-expanded-coast-media.json';
import freshSeptemberMedia from './fresh-september-media.json';
import septemberUpdateMedia from './september-update-media.json';
import octoberMedia from './october-media.json';
import communityEditorialMedia from './community-editorial-media.json';
import communityOpeningMedia from './community-opening-media.json';
import communityPlaceMedia from './community-place-media.json';
import autumnGuideMedia from './autumn-guide-media.json';
import contentCoverageMedia from './content-coverage-media.json';
import dailyLifeMedia from './daily-life-media.json';
import schoolMedia from './schools-media.json';
import schoolCampusMedia from './schools-campus-media.json';
import septemberRefreshMedia from './september-refresh-media.json';
import shoppingMedia from './shopping-media.json';
import cityRoundupMedia from './city-roundup-media.json';
import { currentOpenings as septemberOpenings } from './local-discoveries';

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
  'november-theater': { src: '/guides/november/theater.webp', width: 1536, height: 1024, kind: 'illustration', alt: '暖光舞台上大人与儿童演唱，台下家庭观看音乐剧的原创插画', caption: '舞台表演主题原创插图，不代表任何具体演出、角色造型、官方海报或剧院实景。', credit: 'BAYLINK · AI 原创插图' },
  'november-community': { src: '/guides/november/autumn-community.webp', width: 1536, height: 1024, kind: 'illustration', alt: '秋日市集、亲子手作与湿地观鸟交织的原创插画', caption: '秋季社区活动主题原创插图，不代表所列活动现场、场馆位置或实际天气。', credit: 'BAYLINK · AI 原创插图' },
  'november-stargazing': { src: '/guides/november/stargazing.webp', width: 1536, height: 1024, kind: 'illustration', alt: '成年人和亲子家庭在橡树林山坡用望远镜观察星空的插画', caption: '观星主题原创插图，不代表 Sugarloaf 或其他天文台实景；实际能见度与节目依天气及主办方安排。', credit: 'BAYLINK · AI 原创插图' },
  'autumn-new-shops': { src: '/guides/editorial/autumn-new-shops.webp', width: 1536, height: 1024, kind: 'illustration', alt: '秋日湾区街角的咖啡店、烘焙店与行人插画', caption: '新店探索情境插画，不代表所列门店的实景、位置或商品。', credit: 'BAYLINK · AI 原创插图' },
  'audit-social-security-preparation': { src: '/guides/editorial/audit-social-security-preparation.webp', width: 1080, height: 720, kind: 'illustration', alt: '退休准备矢量示意图，工作收入记录旁连接一个待选择月份的日历', caption: 'BAYLINK AI 辅助原创矢量示意图；说明先核对工作记录、再比较领取月份，不是 SSA 官方表格、账户截图、福利金额或个人资格判断。', credit: 'BAYLINK · AI 辅助原创矢量示意图' },
  'audit-naturalization-preparation': { src: '/guides/editorial/audit-naturalization-preparation.webp', width: 1080, height: 720, kind: 'illustration', alt: '入籍准备矢量示意图，网站入口、放大镜下的材料清单与整理好的文件夹', caption: 'BAYLINK AI 辅助原创矢量示意图；说明从官方入口核对路径并整理材料，不是政府印章、USCIS 表格、公民证书或申请通过承诺。', credit: 'BAYLINK · AI 辅助原创矢量示意图' },
  settling: illustration('settling-in-illustration', '室友在阳光照进的新居里整理纸箱、钥匙和生活用品', '从把行李放下，到让一个地方像家。情境插图，不代表真实房源。'),
  weekend: illustration('weekend-illustration', '海湾、公园步道和野餐场景交织的周末插图', '给周末留一些散步和坐下来的时间。情境插图，不代表真实活动现场或导航地图。'),
  everyday: illustration('everyday-illustration', '社区市集、自行车、阅读角与日常维修的生活插图', '买菜、学习、照顾住处，慢慢建立自己的生活节奏。社区生活情境插图，不代表某场实际活动。'),
};

const photoCaptions: Record<string, [string, string]> = {
  coast: ['Half Moon Bay 海滩、沙岸与海岸植被', 'Half Moon Bay State Beach，2014 年实景。海滩入口与当天开放情况以公园公告为准。'],
  redwoods: ['Reinhardt Redwood 区域公园内绿荫覆盖的步道', 'Reinhardt Redwood Regional Park，2026 年实景。此图不表示某段步道当前开放。'],
  presidio: ['Presidio Tunnel Tops 的草坡、步道与远处海湾', 'Presidio Tunnel Tops，2023 年资料照片；不代表 2026 年庆典现场或当天场地布置。'],
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
for (const { key, ...asset } of [...officialOfferMedia, ...guidePhotos, ...eventMedia, ...originalArt, ...dealPromos, ...communityFreebies, ...everydayFreebies, ...targetFreebies, ...readingRouteMedia, ...sfAttractionMedia, ...regionalAttractionMedia, ...freshSeptemberMedia, ...septemberUpdateMedia, ...octoberMedia, ...communityEditorialMedia, ...communityOpeningMedia, ...communityPlaceMedia, ...autumnGuideMedia, ...contentCoverageMedia, ...schoolMedia, ...septemberRefreshMedia, ...shoppingMedia, ...cityRoundupMedia, ...[extraEast, extraSouth, extraNorth].flatMap(collection => Array.isArray(collection) ? collection : Object.entries(collection).map(([key, asset]) => ({ key, ...asset })))]) {
  GUIDE_IMAGES[key] = { ...asset, kind: asset.kind as GuideImage['kind'] };
}
for (const { key, ...asset } of publicServiceMedia) GUIDE_IMAGES[key] = { ...asset, kind: 'illustration' };
GUIDE_IMAGES['secondhand-check'].caption = '先检查实物，再确认交易条件。二手交易情境原创插图，不代表真实市集或活动现场。';
for (const image of Object.values(GUIDE_IMAGES)) image.srcSet ??= `${image.src.replace('.webp', '-small.webp')} 480w, ${image.src} ${image.width}w`;

// Reuse verified regional photographs with their original attribution intact.
for (const { key, ...asset } of [...expandedInlandMedia, ...expandedCoastMedia, ...dailyLifeMedia]) {
  GUIDE_IMAGES[key] = { ...asset, kind: 'photo' };
}

for (const [key, { sourceKey, caption }] of Object.entries(VERIFIED_PLACE_PHOTO_ALIASES)) {
  GUIDE_IMAGES[key] = { ...GUIDE_IMAGES[sourceKey], caption };
}
GUIDE_IMAGES['guide-bart-update-context'] = {
  ...GUIDE_IMAGES.bart,
  caption: 'Coliseum 站的 BART 新一代列车，2024 年资料照片；展示 BART 交通系统，不是 Mission 电梯、West Oakland 停车场或 Pleasant Hill 施工现场。',
};

const bySlug: Record<string, [string, string]> = {
  'bay-area-free-tax-help-vita-calfile-guide': ['public-service-tax', 'translation-documents'],
  'bay-area-medicare-hicap-medi-cal-guide': ['public-service-medicare', 'coverage-laptop'],
  'california-tenant-deposit-rights-help-guide': ['public-service-tenant', 'lease-review'],
  'east-bay-november-nature-programs-2026': ['november-community', 'expanded-coyote-hills'],
  'san-francisco-autumn-food-markets-2026': ['ferry-market', 'november-community'],
  'peninsula-south-bay-november-nature-walks-2026': ['garden-walk', 'weekend'],
  'peninsula-south-bay-autumn-farmers-markets-2026': ['november-community', 'neighborhood-table'],
  'north-bay-markets-nature-culture-through-november-15-2026': ['november-community', 'november-stargazing'],
  'bay-area-freebies-deals-2026-11': ['official-lowes-firefighting-plane-2026', 'official-target-eos-2026'],
  'bay-area-november-first-half-planner-2026': ['weekend', 'november-community'],
  'bay-area-november-resident-dates-2026': ['everyday', 'train'],
  'bay-area-birthday-perks': ['freebie-sephora-birthday', 'freebie-sephora-birthday'],
  'bay-area-retail-freebies-family-deals': ['official-lowes-firefighting-plane-2026', 'freebie-ikea-coffee'],
  'bay-area-everyday-free-perks': ['library', 'community-tilden-little-farm'],
  'bay-area-street-parking-first-time-guide': ['coverage-classic-car', 'neighborhood'],
  'bay-area-fastrak-bridge-express-lanes-guide': ['daily-bridge', 'digital-safety'],
  'bay-area-bulky-items-ewaste-hhw-guide': ['daily-recycling', 'settling'],
  'bay-area-alerts-outages-first-day-checklist': ['daily-alerts', 'settling'],
  'bay-area-free-esl-adult-learning-guide': ['daily-learning', 'coverage-laptop'],
  'bay-area-311-211-local-help-guide': ['daily-city-hall', 'neighborhood'],
  'sf-lands-end-sutro-baths-walk-guide': ['expanded-lands-end', 'expanded-sutro'],
  'sf-mission-dolores-murals-walk-guide': ['expanded-dolores-park', 'culture-visit'],
  'point-reyes-bear-valley-first-visit-guide': ['expanded-point-reyes', 'weekend'],
  'angel-island-ferry-first-day-guide': ['expanded-angel-island', 'weekend'],
  'san-carlos-hiller-aviation-half-day-guide': ['expanded-peninsula-hiller', 'culture-visit'],
  'san-mateo-coyote-point-bayfront-guide': ['expanded-peninsula-coyote-point', 'weekend'],
  'mountain-view-computer-history-shoreline-guide': ['expanded-south-bay-computer-history', 'expanded-south-bay-shoreline'],
  'san-jose-egyptian-museum-rose-garden-guide': ['expanded-south-bay-rosicrucian', 'garden-walk'],
  'alameda-uss-hornet-shoreline-day-guide': ['expanded-east-bay-hornet', 'expanded-east-bay-alameda-beach'],
  'fremont-coyote-hills-short-walk-guide': ['expanded-coyote-hills', 'weekend'],
  'bart-october-access-parking-update-2026': ['guide-bart-update-context', 'guide-bart-update-context'],
  'san-jose-digital-help-sj-access-update-2026': ['everyday', 'coverage-laptop'],
  'sccld-sharks-library-card-september-2026': ['community-library-card', 'library'],
  'bay-area-ai-week-tech-week-first-timer-guide-2026': ['coverage-laptop', 'digital-safety'],
  'bay-area-october-muni-clipper-payment-update-2026': ['autumn-clipper', 'train'],
  'sf-sunset-dunes-october-coastal-walk-2026': ['autumn-sunset', 'weekend'],
  'san-mateo-japanese-garden-october-guide-2026': ['autumn-sanmateo', 'garden-walk'],
  'alviso-marina-october-birdwatching-guide-2026': ['autumn-alviso', 'weekend'],
  'fremont-ardenwood-october-farm-guide-2026': ['autumn-ardenwood', 'october-family-nature'],
  'richmond-rosie-free-history-october-guide-2026': ['autumn-rosie', 'culture-visit'],
  'martinez-shoreline-october-short-walk-guide-2026': ['autumn-martinez', 'weekend'],
  'pleasanton-saturday-market-museum-guide-october-2026': ['autumn-pleasanton', 'everyday'],
  'marin-sunday-market-october-local-guide-2026': ['autumn-marin', 'neighborhood-table'],
  'sonoma-plaza-history-october-day-guide-2026': ['autumn-sonoma', 'culture-visit'],
  'napa-bothe-october-redwood-picnic-guide-2026': ['autumn-napa', 'weekend'],
  'bay-area-october-weekend-planner-2026': ['autumn-neighbors', 'coast'],
  'half-moon-bay-october-pumpkin-coast-guide-2026': ['fresh-hmb-pumpkins', 'coast'],
  'san-jose-october-family-history-farm-guide-2026': ['community-history-park', 'october-family-nature'],
  'east-bay-tilden-october-family-guide-2026': ['community-tilden-little-farm', 'october-family-nature'],
  'north-bay-china-camp-october-culture-guide-2026': ['community-china-camp-village', 'october-north-bay-culture'],
  'bay-area-october-library-museum-pass-guide-2026': ['library', 'library'],
  'bay-area-freebies-deals-2026-10': ['official-lowes-firefighting-plane-2026', 'freebie-ikea-coffee'],
  'bay-area-coastal-cleanup-2026-guide': ['fresh-ocean-beach', 'fresh-treasure-island'],
  'half-moon-bay-pumpkin-season-2026-guide': ['fresh-pumpkin-parade', 'fresh-hmb-pumpkins'],
  'berkeley-campus-botanical-garden-half-day': ['region-berkeley-campus', 'region-berkeley-garden'],
  'oakland-lake-merritt-omca-half-day': ['region-omca', 'region-lake-merritt'],
  'stanford-cantor-campus-art-walk': ['region-stanford-quad', 'region-cantor'],
  'filoli-house-garden-day-trip': ['region-filoli-house', 'region-filoli-conservatory'],
  'san-jose-tech-japantown-day-trip': ['region-tech', 'region-japantown'],
  'hakone-gardens-saratoga-half-day': ['region-hakone', 'region-hakone-bridge'],
  'muir-woods-reservation-day-trip': ['region-muir-boardwalk', 'region-muir-redwoods'],
  'sausalito-waterfront-ferry-half-day': ['region-sausalito', 'region-sausalito-waterfront'],
  'sf-golden-gate-bridge-fort-point-guide': ['sf-bridge', 'sf-fort-point'],
  'sf-fishermans-wharf-pier39-guide': ['sf-pier39', 'sf-wharf'],
  'sf-alcatraz-booking-day-guide': ['sf-alcatraz', 'sf-cellhouse'],
  'sf-chinatown-north-beach-walk-guide': ['sf-chinatown', 'sf-northbeach'],
  'sf-palace-fine-arts-marina-guide': ['sf-palace', 'sf-marina'],
  'golden-gate-park-free-car-free-day-guide': ['ggp-conservatory', 'jfk-promenade'],
  'palo-alto-baylands-family-walk-guide': ['baylands-marsh', 'baylands-gull'],
  'bay-area-freebies-deals-2026-09': ['deal-85c-september', 'freebie-sephora-birthday'],
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
  'rainy-day-museum-family-guide': ['museum', 'region-tech'],
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

Object.assign(bySlug, {
  'sf-school-district-enrollment-guide': ['school-sf', 'school-campus-sf-state'],
  'east-bay-school-district-enrollment-guide': ['school-east', 'region-berkeley-campus'],
  'peninsula-school-district-enrollment-guide': ['school-peninsula', 'region-stanford-quad'],
  'south-bay-school-district-enrollment-guide': ['school-south', 'school-east'],
  'north-bay-school-district-enrollment-guide': ['school-north', 'school-peninsula'],
});
for (const { key, ...asset } of schoolCampusMedia) {
  if (!Object.values(GUIDE_IMAGES).some(image => image.src === asset.src)) GUIDE_IMAGES[key] = { ...asset, kind: asset.kind as GuideImage['kind'] };
}

// The introductory routes revisit these same places and services. Reuse their
// credited reference photos and labelled illustrations, including original dates.
export const FIRST_VISIT_GUIDE_MEDIA: Record<string, [string, string]> = {
  'sf-first-72-hours-car-free-october-2026': ['sf-chinatown', 'presidio'],
  'bay-area-airport-first-night-decision-october-2026': ['sfo', 'bart'],
  'bay-area-first-7-30-days-action-plan-october-2026': ['settling', 'utilities-setup'],
  'bay-area-cross-bay-commute-home-base-october-2026': ['train', 'bay'],
  'sf-first-visit-tickets-waterfront-october-2026': ['sf-alcatraz', 'sf-bridge'],
  'sf-free-culture-eligibility-october-2026': ['ggp-conservatory', 'library'],
  'sf-family-rain-fog-car-free-october-2026': ['presidio', 'culture-visit'],
};
Object.assign(bySlug, FIRST_VISIT_GUIDE_MEDIA);

// These process guides reuse credited context images, never evidence of a current appointment, class or inventory.
export const READER_GUIDE_MEDIA: Record<string, [string, string]> = {
  "bay-area-visitor-coast-redwoods-return-plan-2026": [
    "region-muir-boardwalk",
    "coast"
  ],
  "sf-visitor-luggage-restrooms-lost-property-2026": [
    "sfo",
    "bart"
  ],
  "sf-visitor-meals-markets-dietary-booking-2026": [
    "ferry-market",
    "produce"
  ],
  "bay-area-first-doctor-insurance-network-guide": [
    "settling",
    "coverage-laptop"
  ],
  "bay-area-k12-midyear-enrollment-guide": [
    "school-east",
    "school-south"
  ],
  "bay-area-phone-bank-first-bill-guide": [
    "digital-safety",
    "coverage-laptop"
  ],
  "bay-area-household-bills-annual-review-2026": [
    "coverage-laptop",
    "utilities-setup"
  ],
  "bay-area-build-recurring-community-routine-2026": [
    "library",
    "redwoods"
  ],
  "bay-area-borrow-tools-repair-before-buying-2026": [
    "repair",
    "secondhand-check"
  ]
};
Object.assign(bySlug, READER_GUIDE_MEDIA);
bySlug['bay-area-city-utilities-internet-phone-directory'] = ['utilities-setup', 'coverage-laptop'];
bySlug['bay-area-outlets-malls-shopping-guide'] = ['shopping-stonestown', 'region-japantown'];
// The region-wide directory uses the existing credited Bay panorama as context.
bySlug['bay-area-101-city-exploration-living-guide'] = ['bay', 'train'];
bySlug['bay-area-useful-apps-platforms-guide'] = ['coverage-laptop', 'train'];
bySlug['bay-area-social-security-retirement-preparation-guide'] = ['audit-social-security-preparation', 'coverage-laptop'];
bySlug['bay-area-naturalization-official-path-guide'] = ['audit-naturalization-preparation', 'translation-documents'];

const categoryImages: Record<GuideCategory, string> = { rent: 'settling', roommate: 'settling', used: 'everyday', service: 'everyday', commute: 'weekend', newcomer: 'settling', city: 'weekend', safety: 'everyday', events: 'weekend', education: 'school-sf' };

const localizedServiceImages = new WeakMap<GuideImage, Partial<Record<'en' | 'zh-Hant', GuideImage>>>();
function localizedServiceImage(image: GuideImage): GuideImage {
  const locale = getLocale();
  if (!image.src.startsWith('/guides/public-services/') || locale === 'zh-Hans') return image;
  const cached = localizedServiceImages.get(image) || {};
  const previous = cached[locale];
  if (previous) return previous;
  const suffix = locale === 'en' ? '-en' : '-hant';
  const localized = { ...image, src: image.src.replace('.webp', `${suffix}.webp`), srcSet: image.srcSet?.replaceAll('-small.webp', `${suffix}-small.webp`).replace(/(?<!-small)\.webp(?=\s)/g, `${suffix}.webp`) };
  cached[locale] = localized;
  localizedServiceImages.set(image, cached);
  return localized;
}

export const getGuideMedia = (guide: Guide): { cover: GuideImage; inline: { afterHeading: number; image: GuideImage }[] } => {
  if (guide.slug === 'bay-area-new-openings-2026-09') {
    const images = septemberOpenings.map((shop, index) => ({ afterHeading: index + 1, image: GUIDE_IMAGES[shop.imageKey] })).filter(item => !!item.image && item.image.kind !== 'illustration');
    return { cover: images[0]?.image || GUIDE_IMAGES.everyday, inline: images.slice(1) };
  }
  const mapped = bySlug[guide.slug];
  const cover = localizedServiceImage(GUIDE_IMAGES[mapped?.[0] || categoryImages[guide.category]]);
  const inline = mapped ? GUIDE_IMAGES[mapped[1]] : undefined;
  const headingPosition = ['sf-school-district-enrollment-guide', 'east-bay-school-district-enrollment-guide'].includes(guide.slug) ? 3 : 2;
  return { cover, inline: inline && inline !== cover ? [{ afterHeading: Math.min(headingPosition, guide.blocks.filter(block => block.type === 'heading').length), image: inline }] : [] };
};
