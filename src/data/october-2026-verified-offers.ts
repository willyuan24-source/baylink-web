import type { FreebieOffer } from '../components/FreebieBoard';

/** Newly added benefits checked against official sources on 2026-10-02. */
export const october2026NewOffers: FreebieOffer[] = [
  {
    "id": "ybca-free-wednesdays",
    "region": "sf",
    "brand": "YBCA · SAN FRANCISCO",
    "title": "每周三免费逛 YBCA，展厅开放至晚上八点",
    "dateLabel": "每周三 · 11:00–20:00",
    "availability": "ongoing",
    "kind": "no-purchase",
    "requirement": "所有访客周三普通展厅免费，无需居民或会员资格；电影、演出与特别活动另看各自票务。",
    "description": "701 Mission Street。10 月对应 7、14、21、28 日，按每周规则换算；可安排下班后看展，工作坊是否登记以当日节目页为准。",
    "imageKey": "culture-visit",
    "imageNote": "文化参观主题插图，非 YBCA 展厅实景",
    "sourceUrl": "https://ybca.org/visit/",
    "sourceLabel": "YBCA 官方免费周三与开放时间",
    "storeUrl": "https://ybca.org/calendar/",
    "verifiedAt": "2026-10-02"
  },
  {
    "id": "presidio-field-station-free",
    "region": "sf",
    "brand": "PRESIDIO FIELD STATION",
    "title": "免费进自然探索站，周末带孩子随到随玩",
    "dateLabel": "周三至周五 11:00–16:00；周末 10:00–17:00",
    "availability": "ongoing",
    "kind": "no-purchase",
    "requirement": "面向所有人免费，家庭散客无需门票或预约；学校及青少年团体建议提前安排。",
    "description": "603 Mason Street，紧邻 Tunnel Tops 的 Outpost 游乐区。室内可看自然标本与探索工具，适合雾天短时亲子活动；周一、周二不按常规开放。",
    "imageKey": "presidio",
    "imageNote": "Presidio Tunnel Tops 资料照片，非 Field Station 室内",
    "sourceUrl": "https://presidio.gov/explore/attractions/field-station",
    "sourceLabel": "Presidio 官方免费入场与家庭参观问答",
    "verifiedAt": "2026-10-02"
  },
  {
    "id": "sf-city-guides-free-walks",
    "region": "sf",
    "brand": "SAN FRANCISCO CITY GUIDES",
    "title": "跟志愿导览认识 SF 街区，常规散步免费",
    "dateLabel": "长期项目 · 日期与路线以官方排期为准",
    "availability": "ongoing",
    "kind": "reservation",
    "requirement": "常规公开导览免费，需官网提前登记；建议捐款属于自愿，不是强制门票或导游小费。私人团另收费。",
    "description": "选真实可报名的路线，再按确认邮件到集合点。每条路线的坡度、时长与终点不同；需要无台阶路线时先联系主办方确认。",
    "imageKey": "neighborhood",
    "imageNote": "旧金山街区资料照片，非某场导览集合点",
    "sourceUrl": "https://www.sfcityguides.org/about-us/faqs/",
    "sourceLabel": "City Guides 免费、预约与捐款规则",
    "storeUrl": "https://www.sfcityguides.org/",
    "verifiedAt": "2026-10-02"
  },
  {
    "id": "sfmoma-free-public-art-spaces",
    "region": "sf",
    "brand": "SFMOMA · SAN FRANCISCO",
    "title": "不买门票，也能看 SFMOMA 公共艺术区",
    "dateLabel": "开馆时适用 · 周三闭馆",
    "availability": "ongoing",
    "kind": "no-purchase",
    "requirement": "所有人可免票进入指定公共艺术空间，主要位于一、二层；收费展厅不包含，咖啡与购物另付。",
    "description": "151 Third Street。适合先体验 30–60 分钟再决定是否购票深逛；按馆内标识区分公共空间与验票区域，当前作品以 Free to See 页面为准。",
    "imageKey": "culture-visit",
    "imageNote": "文化参观主题插图，非 SFMOMA 当前展品",
    "sourceUrl": "https://www.sfmoma.org/visit/free-to-see/",
    "sourceLabel": "SFMOMA 官方 Free to See 范围",
    "storeUrl": "https://www.sfmoma.org/visit/",
    "verifiedAt": "2026-10-02"
  },
  {
    "id": "gggp-sf-resident-free-admission",
    "region": "sf",
    "brand": "GARDENS OF GOLDEN GATE PARK",
    "title": "SF 居民凭住址证明，三座花园普通入场免费",
    "dateLabel": "长期福利 · 按各园开放时间",
    "availability": "ongoing",
    "kind": "no-purchase",
    "requirement": "限 SF 居民：显示 SF 地址的加州驾照或身份证，或近期水电账单／租约加照片证件；官方接受手机上的证明图片。",
    "description": "适用于植物园、日本茶园与 Conservatory of Flowers。外地亲友分别按自身资格购票或选免费时段；特展、活动与节目可能另付，不自动免全家票。",
    "imageKey": "ggp-conservatory",
    "imageNote": "Conservatory of Flowers 资料照片，福利同时适用于另外两园",
    "sourceUrl": "https://gggp.org/tickets/",
    "sourceLabel": "GGGP 官方免费资格与居住证明规则",
    "verifiedAt": "2026-10-02"
  },
  {
    "id": "famsf-bay-area-free-saturdays",
    "region": "sf",
    "brand": "DE YOUNG / LEGION OF HONOR",
    "title": "湾区九县居民，周六普通美术馆门票免费",
    "dateLabel": "每周六 · 先查当日票务与例外",
    "availability": "ongoing",
    "kind": "no-purchase",
    "requirement": "限 Alameda、Contra Costa、Marin、Napa、San Francisco、San Mateo、Santa Clara、Solano、Sonoma 九县居民；只保证普通入馆，特展另核对。",
    "description": "UCSF 2026 信息与 SF Ballet 馆方合作页可交叉核对项目规则。当天余票未核验，出发前查馆方票务及住址证明要求；选 de Young 或 Legion of Honor 一馆慢看即可。",
    "imageKey": "culture-visit",
    "imageNote": "文化参观主题插图，非两馆展览实景",
    "sourceUrl": "https://myfamilysandbox.ucsf.edu/news/free-saturdays-at-the-s-f-fine-arts-museums",
    "sourceLabel": "UCSF 2026 两馆 Free Saturdays 规则",
    "storeUrl": "https://www.famsf.org/events/free-saturdays-de-young",
    "verifiedAt": "2026-10-02"
  }
];

/** Apply by id after existing offer collections are assembled. */
export const october2026OfferUpdates: Record<string, Partial<FreebieOffer>> = {
  "sfpl-discover-go": {
    "verifiedAt": "2026-10-02",
    "region": "sf",
    "dateLabel": "长期福利 · 最多同时两项预约",
    "requirement": "须为 San Francisco 市县居民，持本人 SFPL 图书证；Teacher Card 不适用。票券限实名预约者在指定日期使用，人数和儿童同行要求依场馆。",
    "description": "每月 1 日放出新月份，最多同时两项预约。先核对出行时间，再下载或打印：一旦下载／打印就不能取消。名额与免费或折扣范围以登录后的票券为准。",
    "sourceUrl": "https://sfpl.libanswers.com/faq/97385",
    "sourceLabel": "SFPL 官方 Discover & Go 预约与取消规则"
  },
  "sfmoma-family-oct25": {
    "verifiedAt": "2026-10-02",
    "region": "sf",
    "description": "10/25 官方主题已公布为 K-Pop, Art, and Beyond，包含手作、SFPL 故事时间、寻宝与舞会。门票提前两周开放；最多两位成人须有一名 18 岁及以下孩子同行，加价特展另付。"
  }
};
