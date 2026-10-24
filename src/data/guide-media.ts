import officialOfferMedia from './official-offer-media-2026-10.json';
import octnovMedia from './octnov-2026-media.json';
import octnovExtraMedia from './octnov-2026-extra-media.json';
import octnovEventMedia from './octnov-2026-event-media.json';
import federalPublicDomainMedia from './federal-pd-media.json';
import guideCommonsPhotos from './guide-commons-photos-2026-10.json';
import officialEventMedia from './official-event-media.json';
import officialOpeningMedia from './official-opening-media.json';
import guidePhotos1019 from './guide-photos-2026-10-19.json';
import categoryStockPhotos from './category-stock-photos.json';
import venuePhotoMedia from './venue-photo-media.json';
import homeTileStockPhotos from './home-tile-stock-photos.json';
import { OCTNOV_EVENT_PHOTO_ALIASES } from './octnov-2026-event-photo-aliases';
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
import { ladderSrcSet, readExtraLadder, readLadder, registrySources } from './image-ladder';
import mediaRightsOverlay from './media-rights-overlay.json';
import aiCoverApprovals from './ai-cover-approvals.json';
import { venues as venuePhotoTable } from './venue-photos.json';

/**
 * Why BAYLINK may show an image (structured record shape from a4 `federal-pd-media.json`; read by getCover). `stock`: a
 * licensed stock photograph of a category (Unsplash / Pexels, a named photographer, never AI; UI9-IMAGES ③), with the
 * photographer in `credit`, the photo page in `creditUrl` and `evidenceUrl`, and the licence in `licenseUrl`.
 */
export type MediaRightsBasis = 'official' | 'permission' | 'press-kit' | 'promo-editorial' | 'public-domain' | 'cc' | 'owner' | 'ai' | 'stock';
/**
 * What a picture shows for the records that use it (UI9-IMAGES DECISIONS 22): `item` the record's own image (①), `venue`
 * the place it happens at (②, approved once per venue in src/data/venue-photos.json), `category` a stock or AI picture of
 * its kind of activity (③④, src/data/category-photos.json), `tile` the photo under a home entry tile (DECISIONS 27,
 * src/data/home-tile-photos.json): a navigation image, never a record's cover (coverOk false). Absent on today's records,
 * which keep their old rules.
 */
export type ImageSubject = 'item' | 'venue' | 'category' | 'tile';
export type MediaRights = {
  basis: MediaRightsBasis;
  /** The page that shows the licence, press-kit terms or permission. */
  evidenceUrl?: string;
  /** When a permission was granted (YYYY-MM-DD). */
  grantedAt?: string;
  /** Where the image may be used, in plain words ("same-event coverage only"). */
  scope?: string;
  /** May the image appear in promotion (share cards, ads), not only beside its own coverage. */
  promoAllowed?: boolean;
};

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
  /** Dominant colour placeholder (`#rgb`) from the image manifest. */
  lqip?: string;
  /** Crop focus in percent, [x, y]; posters and full-frame art are never cropped, so they have none. */
  focal?: readonly number[];
  /** Editor approval (true) or veto (false) for use as a listing cover; absent means not reviewed yet. */
  coverOk?: boolean;
  /** Today's records keep a prose string; structured records come from the source JSON or media-rights-overlay.json. */
  rights?: string | MediaRights;
  /** BAYLINK's own photograph (owner or editor on location): the only source of the 实拍 label. */
  ownShot?: boolean;
  /** Capture date of an own shot (YYYY-MM-DD). */
  shotAt?: string;
  /** A view of BAYLINK's 3D world (scene3d-postcards.ts), never a photograph. */
  scene3d?: boolean;
  /** What the picture shows for the records that use it (ImageSubject). */
  subject?: ImageSubject;
  /** The owner approved this AI illustration as a ④ cover: set only from src/data/ai-cover-approvals.json, never by hand. */
  aiCoverApproved?: boolean;
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
  'audit-dental-preparation': { src: '/guides/editorial/audit-dental-preparation.webp', width: 1080, height: 720, kind: 'illustration', alt: '牙科预约准备矢量示意图，牙齿图形连接保险核对清单与电话联系入口', caption: 'BAYLINK AI 辅助原创矢量示意图；说明先核对牙科保障、再联系诊所准备预约，不是机构实景、官方保险卡、诊疗建议或资格结果。', credit: 'BAYLINK · AI 辅助原创矢量示意图' },
  'audit-senior-service-routes': { src: '/guides/editorial/audit-senior-service-routes.webp', width: 1080, height: 720, kind: 'illustration', alt: '长者服务矢量示意图，两位长者旁分别连接餐食、日间陪伴与县级转介图形', caption: 'BAYLINK AI 辅助原创矢量示意图；帮助分清长者餐食、日间服务与当地转介，不是具体机构、真实参加者、实际菜单或个人服务资格承诺。', credit: 'BAYLINK · AI 辅助原创矢量示意图' },
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
for (const { key, ...asset } of [...octnovMedia, ...octnovExtraMedia, ...octnovEventMedia]) GUIDE_IMAGES[key] = { ...asset, kind: asset.kind as GuideImage['kind'] };
// U.S. government photographs that DVIDS marks public domain; each record keeps its source page and VIRIN.
for (const { key, ...asset } of federalPublicDomainMedia) GUIDE_IMAGES[key] = { ...asset, kind: 'photo' };
// CNT-MEDIA-4 (owner approval 2026-10-16): Wikimedia Commons photos for the 办事 and 长辈 guides, each with its author, licence
// and licence link in the credit, and 示意图 at the start of the caption when the place is outside California. The download
// record (original URL, retrieval time, SHA-256, SHA-1 matching Commons) is scripts/data/guide-commons-photos-downloads.json.
for (const { key, ...asset } of guideCommonsPhotos) GUIDE_IMAGES[key] = { ...asset, kind: 'photo', rights: asset.rights as MediaRights };
// CNT-MEDIA-5 (owner approval 2026-10-19): SFMTA's Kirkland Yard photo, SFPL's Main Library skylight (both the agency's own,
// credited and linked) and Carol M. Highsmith's public-domain photo of HHS in Washington, D.C. (示意图, never a cover). Download
// records: scripts/data/guide-photos-2026-10-19-downloads.json.
for (const { key, ...asset } of guidePhotos1019) GUIDE_IMAGES[key] = { ...asset, kind: 'photo', rights: asset.rights as MediaRights };
// UI9-IMG-B1b (owner approval in chat 2026-10-21 09:28 PT, 「圖片全部批准」): licensed stock photos of the photo categories
// (UI9-IMAGES ③ 示意图), from Unsplash and Wikimedia Commons, each with its photographer, page and licence; never a picture of
// a listed event or venue. src/data/category-photos.json maps each category to its keys. Download and page-read records:
// scripts/data/category-stock-photos-downloads.json; sources: docs/category-media-sources-2026-10-21.md.
for (const { key, ...asset } of categoryStockPhotos) GUIDE_IMAGES[key] = { ...asset, kind: 'photo', subject: 'category', rights: asset.rights as MediaRights };
// UI9-IMG-B2 (owner DECISIONS 33, chat 2026-10-23: 「關於圖片方面，只要你分析過後，覺得合適，更好，就可以通過」; captain approval
// and an independent skeptic recheck 2026-10-23): venue photos (②) of 16 venues, from Wikimedia Commons (author and licence in
// the credit) and three venues' own location pages (官方场馆图, promoAllowed false). src/data/venue-photos.json names each
// venue's records. Download records: scripts/data/venue-photo-media-downloads.json; sources: docs/b2-media-sources-2026-10-23.md.
for (const { key, ...asset } of venuePhotoMedia) GUIDE_IMAGES[key] = { ...asset, kind: 'photo', subject: 'venue', rights: asset.rights as MediaRights };
// UI9-IMG-B1b2 (owner approval in chat 2026-10-21 16:51 PT, 「圖片都過，沒問題」): the photos under the home's eight entry tiles
// (UI9-IMAGES DECISIONS 27), Unsplash, each with its photographer, page and licence. Navigation images: no 示意图 badge, never a
// card's cover (coverOk false, never in a card pool), listed in the home's image credits. src/data/home-tile-photos.json maps
// each tile to its photo and approved spares. Download records: scripts/data/home-tile-photos-downloads.json.
for (const { key, ...asset } of homeTileStockPhotos) GUIDE_IMAGES[key] = { ...asset, kind: 'photo', subject: 'tile', coverOk: false, rights: asset.rights as MediaRights };
// Organisers' own event images (owner decision 2026-10-08), labelled 官方图 through their credit.
// Posters, key art, collages and graphics are 'poster' so no surface calls them photos.
// The JSON keeps the event id and artwork class; the download record (source URL, retrieval time, hash) is in
// scripts/data/official-event-media-downloads.json, outside the bundle. Pages get what they render plus the crop
// focus and rights basis the cover resolver reads.
const officialEventImage = ({ src, width, height, alt, caption, credit, creditUrl, kind, fullFrame, focal, rights }: (typeof officialEventMedia)[number] | (typeof officialOpeningMedia)[number]) => ({
  src, width, height, alt, caption, credit, creditUrl, kind: kind === 'poster' ? 'poster' as const : 'photo' as const,
  ...(fullFrame ? { fullFrame } : { focal }), rights: rights as MediaRights,
});
for (const record of officialEventMedia) GUIDE_IMAGES[record.key] = officialEventImage(record);
// CNT-MEDIA-5 (owner approval in chat 2026-10-19): new shops' own images, the same way. Each record names its opening
// (`openingId`, read by local-discoveries) and whether it is a photo of the shop's food or space or the brand's product image
// (`artwork: 'product'`, whose caption says so and never calls it the shop or its stock). Download records:
// scripts/data/official-opening-media-downloads.json.
for (const record of officialOpeningMedia) GUIDE_IMAGES[record.key] = officialEventImage(record);
GUIDE_IMAGES['secondhand-check'].caption = '先检查实物，再确认交易条件。二手交易情境原创插图，不代表真实市集或活动现场。';

// Reuse verified regional photographs with their original attribution intact.
for (const { key, ...asset } of [...expandedInlandMedia, ...expandedCoastMedia, ...dailyLifeMedia]) {
  GUIDE_IMAGES[key] = { ...asset, kind: 'photo' };
}

for (const [key, { sourceKey, caption }] of Object.entries({ ...VERIFIED_PLACE_PHOTO_ALIASES, ...OCTNOV_EVENT_PHOTO_ALIASES })) {
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
  // CNT-YEAREND: the holiday hours guide keeps its category illustration as cover; the DMV office photo stands in the DMV / SSA step.
  'bay-area-holiday-hours-thanksgiving-new-year-2026': ['everyday', 'commons-dmv-eureka-office'],
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
  'oakland-lake-merritt-omca-half-day': ['venue-omca', 'region-lake-merritt'],
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
  // CNT-MEDIA-5: SFPL's own Main Library photo is the cover; the 2013 Commons atrium photo ('library') stays on the other guides.
  'bay-area-library-starter-guide': ['official-sfpl-main-library-skylight', 'everyday'],
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

// D8 image ladder: every registered image's srcset (480/800/1200) and placeholder colour come from the generated
// table (`npm run images:variants`); the media records no longer carry srcset strings of their own
// (scripts/codemods/registry-srcset.mjs), which kept about 2–4 KB gzip off every page that loads this registry.
// A table generated for a different image list is ignored as a whole, so a stale table falls back to the plain
// `-small` 480w + original pair (the original alone up to 480 wide) instead of naming rungs that may not exist.
const ladder = readLadder(registrySources(Object.values(GUIDE_IMAGES)));
const NO_RUNGS = { medium: false, large: false };
for (const image of Object.values(GUIDE_IMAGES)) {
  const entry = ladder.get(image.src);
  if (entry) {
    image.srcSet = ladderSrcSet(image.src, image.width, entry);
    image.lqip = entry.lqip;
  } else image.srcSet ??= ladderSrcSet(image.src, image.width, NO_RUNGS);
}

/**
 * AI illustrations the owner approved as ④ covers, each with the owner's own words and the day (UI9-IMAGES DECISIONS 25:
 * only a chat approval counts; a pre-ticked review page does not). `for` names the records (`kind:id`) or categories
 * (`category:<id>`) it may cover; coverCandidates() reads it. Only these keys get `aiCoverApproved`.
 */
export type AiCoverApproval = { key: string; ownerQuote: string; approvedAt: string; page?: string; for?: string[] };
export const AI_COVER_APPROVALS: readonly AiCoverApproval[] = (aiCoverApprovals as { approvals: AiCoverApproval[] }).approvals;
for (const { key } of AI_COVER_APPROVALS) {
  const image = GUIDE_IMAGES[key];
  if (image?.kind === 'illustration' && !image.scene3d) GUIDE_IMAGES[key] = { ...image, aiCoverApproved: true };
}
/**
 * The photos of src/data/venue-photos.json (②, approved once per venue) are the only keys with `subject: 'venue'`, so that
 * table is the one place that says a photo is its venue's: cover.ts then lets every record held there use it (the 8-year
 * rule kept). Photographs only; an illustration is never a venue photo.
 */
export const VENUE_PHOTO_KEYS: ReadonlySet<string> = new Set(venuePhotoTable.flatMap(venue => venue.imageKeys));
for (const key of VENUE_PHOTO_KEYS) {
  const image = GUIDE_IMAGES[key];
  if (image?.kind === 'photo') GUIDE_IMAGES[key] = { ...image, subject: 'venue' };
}

type MediaRightsOverlayEntry = Pick<GuideImage, 'coverOk' | 'focal' | 'ownShot' | 'shotAt'> & { rights?: MediaRights };
/**
 * Editorial media facts (coverOk, focal, shotAt, ownShot, structured rights), keyed by image key and applied after every
 * other registration so no later map can undo a veto or a rights record. Each entry covers its own key only: an alias
 * that reuses a file needs its own entry. tests/media-rights-overlay.test.ts validates the shapes.
 */
export function applyMediaRightsOverlay(images: Record<string, GuideImage>, overlay: Readonly<Record<string, MediaRightsOverlayEntry>>) {
  for (const [key, entry] of Object.entries(overlay)) {
    const image = images[key];
    if (!image) continue;
    images[key] = { ...image, ...entry };
  }
}
applyMediaRightsOverlay(GUIDE_IMAGES, mediaRightsOverlay as Record<string, MediaRightsOverlayEntry>);

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
bySlug['bay-area-dental-care-insurance-low-cost-guide'] = ['audit-dental-preparation', 'translation-documents'];
bySlug['bay-area-chinese-senior-services-referral-guide'] = ['audit-senior-service-routes', 'everyday'];
// CNT-GUIDES-2 (H71): the three new elder guides have no cover photograph until owner-approved images arrive (CNT-MEDIA-2).
// Their cover is their category illustration, which every list and the page render as a coded cover with the guide's
// one-line answer. Reusing City Hall, the Clipper photo or the Chinatown gate would take those photos away from the 311,
// Muni/Clipper and first-72-hours guides on the one-image-per-page guides index, and City Hall on a 冒充官员 scam guide
// could read as an endorsement. The inline pictures are the already-reviewed context photos.
bySlug['bay-area-elder-scam-prevention-guide'] = ['everyday', 'digital-safety'];
bySlug['bay-area-senior-transit-clipper-discounts-guide'] = ['weekend', 'train'];
// CNT-MEDIA-4 (owner approval 10-16): the resource map's 长者服务 section (heading 2) shows the Commons senior centre photo
// instead of the generic library photo.
bySlug['bay-area-chinese-language-resource-map'] = ['everyday', 'commons-ggp-senior-center-side'];
/**
 * CNT-MEDIA-4: the owner-approved Commons photos in the articles, as [afterHeading, image key]: the section each photo belongs
 * to, so a long guide gets a picture every step or two (H22). GuideDetail shows a pilot step's pictures outside its
 * 展开原文与来源 fold, with the step's diagram. They are not list covers: these pilot guides' coded covers print the guide's
 * first answer ("先打 800-510-2020"), which a photo cover would drop (owner decision in the CNT-MEDIA-4 PR). The two 示意图
 * photos (an SSA office in New York, HHS in Washington, D.C.) are vetoed as covers anyway (coverOk false).
 */
export const GUIDE_EXTRA_INLINE: Readonly<Record<string, readonly (readonly [number, string])[]>> = {
  'california-driver-license-id-preparation-guide': [[3, 'commons-dmv-eureka-office'], [6, 'commons-dmv-sacramento-hq']],
  // CNT-YEAREND: a 2026/2027 figures section now comes before 第四步, so the SSA office photo moves with that step (heading 5).
  'bay-area-social-security-retirement-preparation-guide': [[5, 'commons-ssa-corning-ny']],
  // CNT-MEDIA-5: the owner-approved public-domain Highsmith photo of the same HHS building replaces the CC BY-SA one in step 2
  // (two photos of one building in one guide would repeat); 'commons-hhs-washington-dc' stays registered.
  'bay-area-medicare-hicap-medi-cal-guide': [[2, 'loc-highsmith-hhs-humphrey-building-2012'], [3, 'commons-dhcs-sacramento']],
  // CNT-MEDIA-5: SFMTA's photo of Muni buses in the step about riding Muni free.
  'bay-area-senior-transit-clipper-discounts-guide': [[1, 'commons-clipper-embarcadero'], [3, 'official-sfmta-kirkland-yard-2023']],
  'bay-area-rental-scam-guide': [[2, 'commons-nema-sf']],
  'bay-area-chinese-senior-services-referral-guide': [[1, 'commons-ggp-senior-center-front']],
  'bay-area-chinese-language-resource-map': [[6, 'commons-chinatown-ywca-chsa']],
};

Object.assign(bySlug, {
  "sf-autumn-art-half-day-2026": [
    "octnov-sfmoma-context",
    "coverage-yerba-buena"
  ],
  "east-bay-redwoods-green-friday-2026": [
    "redwoods",
    "redwoods"
  ],
  "half-moon-bay-autumn-coast-2026": [
    "coast",
    "coast"
  ],
  "alviso-autumn-wetlands-2026": [
    "autumn-alviso",
    "autumn-alviso"
  ]
});

bySlug['sonoma-autumn-art-plaza-2026'] = ['octnov-sonoma-plaza-context', 'octnov-sonoma-plaza-context'];

const categoryImages: Record<GuideCategory, string> = { rent: 'settling', roommate: 'settling', used: 'everyday', service: 'everyday', commute: 'weekend', newcomer: 'settling', city: 'weekend', safety: 'everyday', events: 'weekend', education: 'school-sf' };

const localizedServiceImages = new WeakMap<GuideImage, Partial<Record<'en' | 'zh-Hant', GuideImage>>>();
function localizedServiceImage(image: GuideImage): GuideImage {
  const locale = getLocale();
  if (!image.src.startsWith('/guides/public-services/') || locale === 'zh-Hans') return image;
  const cached = localizedServiceImages.get(image) || {};
  const previous = cached[locale];
  if (previous) return previous;
  const suffix = locale === 'en' ? '-en' : '-hant';
  const src = image.src.replace('.webp', `${suffix}.webp`);
  const entry = readExtraLadder(src);
  const localized = entry
    ? { ...image, src, srcSet: ladderSrcSet(src, image.width, entry), lqip: entry.lqip }
    : { ...image, src, srcSet: `${src.replace('.webp', '-small.webp')} 480w, ${src} ${image.width}w` };
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
  const headings = guide.blocks.filter(block => block.type === 'heading').length;
  const extra = (GUIDE_EXTRA_INLINE[guide.slug] ?? []).map(([afterHeading, key]) => ({ afterHeading: Math.min(afterHeading, headings), image: GUIDE_IMAGES[key] }));
  return { cover, inline: [...(inline && inline !== cover ? [{ afterHeading: Math.min(headingPosition, headings), image: inline }] : []), ...extra]
    .sort((a, b) => a.afterHeading - b.afterHeading) };
};
