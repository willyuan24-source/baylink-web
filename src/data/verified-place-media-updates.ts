import type { FreebieOffer } from '../components/FreebieBoard';

/**
 * Reviewed venue-to-photo matches, 2026-10-05. Sources and original photo dates
 * stay on the registered photograph; these aliases only clarify its use beside
 * an event. No event/offer facts or verification dates are changed here.
 */
const venuePhotos = [
  {
    key: 'verified-sf-main-library', sourceKey: 'library',
    caption: '旧金山公共图书馆总馆中庭，2013 年资料照片；展示活动所在馆舍，不是所列 2026 年活动现场或具体活动房间。',
    eventIds: [
      'sf-mandarin-conversation-oct6-2026', 'sfpl-career-coaching-oct8-2026',
      'sfpl-writing-gravity-oct8-2026', 'sfpl-garden-green-bin-oct10-2026',
      'sf-main-halloween-costume-swap-oct15-2026', 'sf-filbookfest-2026',
      'sf-halloween-broadside-printing-oct17-2026', 'sf-financial-planning-day-oct24-2026',
    ],
  },
  {
    key: 'verified-ardenwood-farm', sourceKey: 'autumn-ardenwood',
    caption: 'Ardenwood Historic Farm 官网资料照片；展示活动所在农场，不是 2026 年丰收节现场，也不保证当天花况、作物或项目。',
    eventIds: ['fremont-ardenwood-harvest-2026'],
  },
  {
    key: 'verified-sonoma-barracks', sourceKey: 'autumn-sonoma',
    caption: 'California State Parks 发布的 Sonoma Barracks 室内资料照片；展示活动所在历史场地，不是 2026 年活动现场、户外电影区域或当日布置。',
    eventIds: ['sonoma-womens-suffrage-2026', 'sonoma-dia-movie-night-2026'],
  },
  {
    key: 'verified-hiller-museum', sourceKey: 'expanded-peninsula-hiller',
    caption: 'Hiller 航空博物馆展厅与藏品，2015 年资料照片；不是 2026 年 Paint-A-Plane 现场，也不表示可涂画的指定飞机或材料。',
    eventIds: ['san-carlos-hiller-halloween-paint-plane-2026'],
  },
  {
    key: 'verified-san-mateo-b-street', sourceKey: 'sanmateo',
    caption: 'San Mateo 的 B Street 街道与建筑，2023 年资料照片；展示活动街区，不是 2026 年万圣节活动现场或现行封街示意。',
    eventIds: ['san-mateo-boos-brews-2026'],
  },
  {
    key: 'verified-yerba-buena-gardens', sourceKey: 'coverage-yerba-buena',
    caption: 'Yerba Buena Gardens，2023 年资料照片；展示活动所在园区，不是 2026 年书市、儿童游行现场或具体舞台位置。',
    eventIds: ['litquake-out-loud-2026', 'sf-halloween-hoopla-2026'],
  },
  {
    key: 'verified-ferry-building', sourceKey: 'ferry-market',
    caption: 'Ferry Building 外的农夫市集，2022 年 5 月资料照片；展示活动所在滨水街区，不是 2026 年饺子节、Latine Makers Market 或当日摊位与商品。',
    eventIds: ['ferry-plaza-farmers-market-2026-autumn', 'sf-foodwise-latine-makers-oct3-2026', 'sf-world-of-dumplings-2026'],
  },
  {
    key: 'verified-napa-library', sourceKey: 'roundup-north-napa',
    caption: 'Napa 市中心公共图书馆外观，2012 年资料照片；展示 580 Coombs Street 的馆舍，不是 2026 年故事会、课程、读书会现场或活动房间。',
    eventIds: ['napa-musictime-halloween-2026', 'r2-napa-spooky-stories-2026', 'r2-napa-tarot-basics-2026', 'r2-napa-horror-bookclub-2026'],
  },
  {
    key: 'verified-coyote-hills', sourceKey: 'expanded-coyote-hills',
    caption: 'Coyote Hills 湿地，2005 年山脊资料照片；展示活动所在公园，不是 2026 年 Ohlone 聚会现场或游客中心，参加活动不要求走图中山脊。',
    eventIds: ['fremont-ohlone-gathering-2026'],
  },
  {
    key: 'verified-fishermans-wharf', sourceKey: 'sf-wharf',
    caption: 'Fisherman’s Wharf 街区招牌，2016 年资料照片；展示活动所在街区，不是 2026 年 Chowder Fest 现场或 Little Embarcadero 集合点；店招与价格不代表现行信息。',
    eventIds: ['sf-fishermans-wharf-chowder-fest-2026'],
  },
] as const;

export const VERIFIED_PLACE_PHOTO_ALIASES = Object.fromEntries(
  venuePhotos.map(({ key, sourceKey, caption }) => [key, { sourceKey, caption }]),
) as Record<string, { sourceKey: string; caption: string }>;

export const VERIFIED_EVENT_PLACE_MEDIA_UPDATES = Object.fromEntries(
  venuePhotos.flatMap(({ key, eventIds }) => eventIds.map(id => [id, { imageKey: key }])),
) as Record<string, { imageKey: string }>;

// Beresford Park is not B Street. Keep the recycling event factual and text-only
// until a photograph of its actual location or official event poster is available.
VERIFIED_EVENT_PLACE_MEDIA_UPDATES['san-mateo-shred-ewaste-october-2026'] = { imageKey: '' };

// A U.S. Navy public-domain photograph of the Blue Angels at the 2024 Fleet Week,
// reviewed 2026-10-07. It shows a past edition of this event, not a venue alias,
// so it is not a contextual photo approval; its caption dates it to 2024.
VERIFIED_EVENT_PLACE_MEDIA_UPDATES['san-francisco-fleet-week-2026'] = { imageKey: 'dvids-blue-angels-sffw-2024' };

export const VERIFIED_EVENT_CONTEXT_PHOTOS = Object.fromEntries(
  venuePhotos.map(({ key, eventIds }) => [key, { purpose: 'venue' as const, eventIds }]),
) as Record<string, { purpose: 'venue'; eventIds: readonly string[] }>;

export const VERIFIED_OFFER_PLACE_MEDIA_UPDATES: Record<string, Partial<FreebieOffer>> = {
  'chm-museums-on-us-oct3-4': {
    imageKey: 'expanded-south-bay-computer-history',
    imageNote: 'Computer History Museum 外观，2025 年资料照片；不代表活动当日或具体展品',
  },
  'rosie-riveter-richmond-free': {
    imageKey: 'autumn-rosie',
    imageNote: 'NPS 官方游客教育中心入口资料照片；入馆安排以当日公告为准',
  },
};
