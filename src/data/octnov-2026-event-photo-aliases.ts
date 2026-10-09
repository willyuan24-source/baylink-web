/**
 * Venue photographs reviewed on 2026-10-07. Photo dates and event dates are
 * separate. See docs/octnov-2026-event-media-sources.md for source evidence.
 * These mappings only update media; they do not change event verification.
 */
const reusedPhotos = [
  {
    "key": "octnov-redwood-context",
    "sourceKey": "redwoods",
    "caption": "Reinhardt Redwood Regional Park，2026 年资料照片；展示活动所在公园，不是所列十一月导览现场、指定集合点或路线开放凭证。",
    "eventIds": [
      "nov2026-redwood-green-friday-hike",
      "nov2026-redwood-saturday-stroll"
    ]
  },
  {
    "key": "octnov-presidio-context",
    "sourceKey": "presidio",
    "caption": "Presidio Tunnel Tops，2023 年资料照片；展示活动所在园区，不是 2026 年历史导览或营火讲解现场，也不代表各活动的具体集合点。",
    "eventIds": [
      "nov2026-presidio-250-years-walk",
      "nov2026-presidio-campfire-history-talks"
    ]
  },
  {
    "key": "octnov-fort-point-context",
    "sourceKey": "sf-fort-point",
    "caption": "Fort Point 堡垒中庭，2023 年资料照片；展示历史讲解所在场地，不是 2026 年讲解现场，也不表示所有楼层当天开放。",
    "eventIds": [
      "nov2026-fort-point-history-talks"
    ]
  },
  {
    "key": "octnov-tilden-farm-context",
    "sourceKey": "community-tilden-little-farm",
    "caption": "Tilden Little Farm，2013 年 9 月资料照片；展示活动所在农场，不是 2026 年晚安农场活动现场、猪圈集合点或当天动物安排。",
    "eventIds": [
      "nov2026-tilden-good-night-farm"
    ]
  },
  {
    "key": "octnov-coyote-hills-context",
    "sourceKey": "expanded-coyote-hills",
    "caption": "Coyote Hills，2005 年山脊资料照片；展示活动所在公园，不是 2026 年 tule 手作现场或游客中心，参加活动不要求走图中山脊。",
    "eventIds": [
      "nov2026-coyote-hills-tule-work-play"
    ]
  },
  {
    "key": "octnov-ferry-market-context",
    "sourceKey": "ferry-market",
    "caption": "Ferry Building 外的农夫市集，2022 年 5 月资料照片；展示活动所在滨水街区，不是 2026 年 Market Memories 烹饪演示、讲者或当日摊位。",
    "eventIds": [
      "nov2026-foodwise-market-memories-demo"
    ]
  },
  {
    "key": "octnov-ardenwood-context",
    "sourceKey": "autumn-ardenwood",
    "caption": "Ardenwood Historic Farm 官方资料照片，拍摄年份未标；展示活动所在农场，不是 2026 年栗子点心制作现场、乡村厨房或当天花况。",
    "eventIds": [
      "nov2026-ardenwood-chestnut-treats"
    ]
  },
  {
    "key": "octnov-crab-cove-context",
    "sourceKey": "expanded-east-bay-alameda-beach",
    "caption": "Crown Memorial State Beach，2010 年资料照片；展示 Crab Cove 活动所在海滨公园，不是 2026 年观鸟现场、游客中心或保证可见鸟种的示意。",
    "eventIds": [
      "nov2026-crab-cove-bay-bird-morning"
    ]
  },
  {
    "key": "octnov-filoli-context",
    "sourceKey": "region-filoli-house",
    "caption": "Filoli 宅邸与庭园，2020 年资料照片；展示工作坊所在园区，不是 2026 年感恩节花艺课程、教室或成品，也不代表当季花况。",
    "eventIds": [
      "octnov-filoli-thanksgiving-flora-2026"
    ]
  },
  {
    "key": "octnov-hiller-context",
    "sourceKey": "expanded-peninsula-hiller",
    "caption": "Hiller 航空博物馆展厅，2015 年资料照片；展示活动所在馆舍，不是 2026 年周末体验现场，也不保证图中藏品或模拟器当天开放。",
    "eventIds": [
      "octnov-hiller-weekend-aviation-2026"
    ]
  }
] as const;

const newVenuePhotos = [
  {
    "key": "octnov-purisima-context",
    "eventIds": [
      "octnov-midpen-return-to-green-2026",
      "octnov-midpen-banana-slugs-2026"
    ]
  },
  {
    "key": "octnov-bear-creek-context",
    "eventIds": [
      "octnov-midpen-sawmills-seminary-2026"
    ]
  },
  {
    "key": "octnov-windy-hill-context",
    "eventIds": [
      "octnov-midpen-windy-hill-berries-2026",
      "octnov-midpen-take-a-hike-dog-2026"
    ]
  },
  {
    "key": "octnov-rancho-context",
    "eventIds": [
      "octnov-midpen-turkey-trot-2026"
    ]
  },
  {
    "key": "octnov-monte-bello-context",
    "eventIds": [
      "octnov-midpen-ferns-ancient-plants-2026"
    ]
  },
  {
    "key": "octnov-lexington-context",
    "eventIds": [
      "octnov-midpen-manzanita-morning-2026"
    ]
  },
  {
    "key": "octnov-california-theatre-context",
    "eventIds": [
      "octnov-opera-sj-fiddler-2026"
    ]
  },
  {
    "key": "octnov-fort-mason-context",
    "eventIds": [
      "nov2026-fort-mason-farmers-market",
      "nov2026-arion-press-public-tours"
    ]
  },
  {
    "key": "octnov-festival-pavilion-context",
    "eventIds": [
      "nov2026-sf-renegade-craft-winter"
    ]
  },
  {
    "key": "octnov-sj-performing-arts-context",
    "eventIds": [
      "octnov-san-jose-tommy-2026"
    ]
  },
  {
    "key": "octnov-los-altos-context",
    "eventIds": [
      "octnov-los-altos-lights-parade-2026"
    ]
  },
  {
    "key": "octnov-big-break-context",
    "eventIds": [
      "nov2026-big-break-accessible-winter-birding"
    ]
  }
] as const;

export const OCTNOV_EVENT_PHOTO_ALIASES = Object.fromEntries(
  reusedPhotos.map(({ key, sourceKey, caption }) => [key, { sourceKey, caption }]),
) as Record<string, { sourceKey: string; caption: string }>;

const eventPhotos = [...reusedPhotos, ...newVenuePhotos];

export const OCTNOV_EVENT_MEDIA_UPDATES = Object.fromEntries(
  eventPhotos.flatMap(({ key, eventIds }) => eventIds.map(id => [id, { imageKey: key }])),
) as Record<string, { imageKey: string }>;

export const OCTNOV_EVENT_CONTEXT_PHOTOS = Object.fromEntries(
  eventPhotos.map(({ key, eventIds }) => [key, { purpose: 'venue' as const, eventIds }]),
) as Record<string, { purpose: 'venue'; eventIds: readonly string[] }>;

