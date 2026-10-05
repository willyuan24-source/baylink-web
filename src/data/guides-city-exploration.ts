import type { Guide } from './guides';
import { CITY_COUNTIES, type CityExploration } from './city-exploration-types';
import eastSf from './city-exploration-east-sf.json';
import peninsulaSouth from './city-exploration-peninsula-south.json';
import north from './city-exploration-north.json';
import currentEast from './city-current-east-sf.json';
import currentSouth from './city-current-peninsula-south.json';
import currentNorth from './city-current-north.json';
import type { CityCurrentUpdate } from './city-current-types';

// Keep the editorial image chosen for the actual notice. A city landscape is
// not evidence of a workshop, concert, recycling service or admission offer.
export const CITY_CURRENT_UPDATES = [...currentEast, ...currentSouth, ...currentNorth] as CityCurrentUpdate[];
const currentByCity = new Map(CITY_CURRENT_UPDATES.map(update => [update.city, update]));

export const CITY_EXPLORATIONS: CityExploration[] = ([...eastSf, ...peninsulaSouth, ...north] as CityExploration[]).map(city => ({ ...city, currentUpdate: currentByCity.get(city.city) })).sort((a,b) => CITY_COUNTIES.indexOf(a.county as typeof CITY_COUNTIES[number]) - CITY_COUNTIES.indexOf(b.county as typeof CITY_COUNTIES[number]) || a.city.localeCompare(b.city));

export const cityExplorationGuides: Guide[] = [{
  "slug": "bay-area-101-city-exploration-living-guide",
  "title": "湾区 101 城探索与生活指南：每座城市都值得认识",
  "subtitle": "逐城看近期资讯、活动、景点、半日路线与居民资源",
  "summary": "覆盖湾区九县 101 个城市和镇，每城补充近期资讯或官方日历、配图与核对日期，并连接本市接下来的活动。另有景点、半日路线、交通停车、新居民建议与老居民资源。",
  "category": "city",
  "categoryLabel": "城市探索与在地生活",
  "emoji": "🧭",
  "audience": [
    "第一次来湾区的游客",
    "刚搬到新城市的人",
    "想重新认识身边小城的居民"
  ],
  "tags": [
    "日常办事",
    "城市攻略",
    "景点",
    "半日游",
    "图书馆",
    "社区活动",
    "101 cities",
    "San Francisco",
    "San Mateo",
    "Santa Clara",
    "Alameda",
    "Contra Costa",
    "Marin",
    "Napa",
    "Sonoma",
    "Solano"
  ],
  "priority": "P0",
  "featuredOnHome": true,
  "recommendedForCategories": [
    "other",
    "ride",
    "moving"
  ],
  "readMinutes": 20,
  "updatedAt": "2026-10-05",
  "sourceNote": "城市资料于 2026/10/2 建立，本轮在 2026/10/5 补充各城景点与资讯；新条目另列核验日期，未重查的旧资料保留原日期。半日路线为编辑建议，不是实时导航或开放保证。市内、附近与跨市景点明确区分；出发前查预约、施工、停车及开放公告。",
  "sources": [
    {
      "title": "ABAG: How We Govern",
      "url": "https://www.abag.ca.gov/about-abag/what-we-do/how-we-govern",
      "description": "本文九县 101 个建制城市和镇的范围依据。"
    },
    {
      "title": "511: Travel information and FAQ",
      "url": "https://511.org/about/faq",
      "description": "交通警报和区域出行入口；具体班次与路线规划需另查运营机构。"
    },
    {
      "title": "California State Parks: Reservation Information",
      "url": "https://www.parks.ca.gov/?page_id=31906",
      "description": "从具体公园页面查公告、设施和预约，不能把公园名等同于已订好名额。"
    },
    {
      "title": "National Park Service: Active Alerts",
      "url": "https://www.nps.gov/planyourvisit/alerts.htm?v=1",
      "description": "国家公园管理单位发布的关闭、限制和出行提醒。"
    }
  ],
  "blocks": [
    {
      "type": "paragraph",
      "text": "不必把湾区当成一串必须打卡的地名。游客先找住处附近的一条好走路线；新居民先知道去哪里办事、借书和参加活动；住久的人可以从一个没去过的公园、一门社区课或邻城的历史街区重新开始。下面每座城市都有独立资料卡，可搜索城市名、景点或资源，也可按县筛选。"
    },
    {
      "type": "heading",
      "text": "先按你的情况决定看什么"
    },
    {
      "type": "list",
      "items": [
        "来玩：先读“值得去的地方”和“半日怎么安排”，一天优先选同城或同一方向；海岸、山路和跨湾行程单独留余量。",
        "刚搬来：先读“从哪里开始”，收藏本城官网与实际负责的图书馆、康乐部门；再打开水电垃圾目录核对住址对应单位。",
        "住久了：看“再发现身边资源”，从能重复参加的课程、图书馆项目和近家步道开始；具体报名日、资格和余位由官方确认。",
        "需要找本周活动：打开城市卡片内的官方活动或资源入口，再对照站内日历；目录未列某个活动，不代表当地没有活动。"
      ]
    },
    {
      "type": "tip",
      "title": "地址上的城市名，不一定是行政边界",
      "text": "卡片区分“市内去处”“附近延伸”和“跨市界延伸”。附近的山林、州立公园、校园或县属景点可以是好行程；大型公园和步道也可能跨越多个管辖区。地图按钮按具体地点查找，出行前再确认入口、停车场和可走路段。"
    },
    {
      "type": "heading",
      "text": "按城市查：景点、路线、生活与官方入口"
    },
    {
      "type": "city-exploration",
      "title": "九县城市资料库",
      "text": "展开城市卡片查看完整内容。半日安排是可调整的起点，不要求一天走完所有地点；山路、户外步道与预约场馆可独立安排。",
      "cities": CITY_EXPLORATIONS
    },
    {
      "type": "heading",
      "text": "把查询结果变成能执行的一天"
    },
    {
      "type": "checklist",
      "items": [
        "选一个主目的地，再加一个可取消的近处备选；把午饭、厕所和休息算进去。",
        "打开地点官网检查当天公告、馆舍开放、预约和适用票种；把确认邮件保存离线。",
        "按实际入口查路线；公共交通同时确认去程、回程与最后一段步行，驾车核对停车规则。",
        "同行有推车、轮椅或体力限制时，查看官方无障碍说明和坡度／路面信息，再决定走哪一段。",
        "离家当天复查天气、交通及公园公告；把仍不确定的地点换成已确认的备选。"
      ]
    },
    {
      "type": "template",
      "title": "我的城市半日清单",
      "text": "城市：\n日期／同行人：\n主目的地与实际入口：\n可取消的第二站：\n交通方式／去程／返程：\n需预约项目及确认状态：\n停车、吃饭、厕所与休息：\n当天需再查的施工或天气：\n下雨或体力不够的替代方案："
    },
    {
      "type": "heading",
      "text": "继续查：搬家、购物、活动与具体景点"
    },
    {
      "type": "link",
      "url": "/guides/bay-area-city-utilities-internet-phone-directory",
      "title": "按城市查水电、垃圾、宽带和电话",
      "text": "搬入、搬出和换地址时，按实际住址找负责机构。"
    },
    {
      "type": "link",
      "url": "/guides/bay-area-outlets-malls-shopping-guide",
      "title": "Outlet、Mall 与购物街区",
      "text": "按购物目的挑地方，再查品牌、交通停车与退货条件。"
    },
    {
      "type": "link",
      "url": "/calendar",
      "title": "按日期找活动",
      "text": "站内已核验活动可按日期和地区查看；报名状态仍以官方为准。"
    },
    {
      "type": "link",
      "url": "/explore",
      "title": "继续读景点深度攻略",
      "text": "热门景点另有参观顺序、预约及周边路线资料。"
    },
    {
      "type": "link",
      "url": "https://511.org/",
      "title": "查区域交通警报",
      "text": "511 提供区域交通信息；具体公交班次及旅程规划请查运营方。"
    }
  ]
}];
