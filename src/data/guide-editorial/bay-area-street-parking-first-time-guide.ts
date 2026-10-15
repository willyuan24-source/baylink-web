import type { GuideEditorial } from './types';
// Hand-maintained from here on: first drafted from the article text by a lane tool (CNT-GUIDES-2, 10-14); edit this file.

// Facts from the article (SFMTA, Oakland, San Jose, ParkSJ and San Mateo pages read 2026-09-27). A 日常办事 guide.
export const streetParkingEditorial: GuideEditorial = {
  "slug": "bay-area-street-parking-first-time-guide",
  "cover": {
    "question": {
      "zh": "看到空位，能直接停吗？",
      "en": "Found an empty space: can I just park?"
    },
    "title": {
      "zh": "先读完整组路牌，再付停车费",
      "en": "Read the whole sign set before you pay"
    },
    "answer": {
      "zh": "先读路牌，再付款",
      "en": "Read the signs, then pay"
    },
    "line": {
      "zh": "扫街 · 限时 · 临时禁停 · 车库",
      "en": "Sweeping · time limits · temporary bans · garages"
    }
  },
  "keyFacts": [
    {
      "label": {
        "zh": "没有统一免费时段",
        "en": "No Bay-wide free hours"
      },
      "value": {
        "zh": "同一城市不同街段、道路两侧和活动日期都可能不同",
        "en": "Rules can differ by block, side of the street and event date, even within one city"
      }
    },
    {
      "label": {
        "zh": "旧金山人行横道",
        "en": "SF crosswalks"
      },
      "value": {
        "zh": "驶近一侧通常留出 20 英尺；有路缘外扩时 15 英尺",
        "en": "Usually leave 20 feet on the approach side; 15 feet with a curb extension"
      },
      "source": 2
    },
    {
      "label": {
        "zh": "手机续费",
        "en": "Paying by phone"
      },
      "value": {
        "zh": "超不过现场最长停留，也盖不住禁停时段",
        "en": "It can’t exceed the posted maximum stay or cover a no-parking period"
      },
      "source": 3
    },
    {
      "label": {
        "zh": "旧金山咪表",
        "en": "SF meters"
      },
      "value": {
        "zh": "官方明确不接受二维码付款",
        "en": "Officially no QR-code payments"
      },
      "source": 3
    }
  ],
  "slides": [
    {
      "kind": "checklist",
      "kicker": {
        "zh": "第一步",
        "en": "Step one"
      },
      "title": {
        "zh": "整组路牌从上读到下",
        "en": "Read the whole sign set"
      },
      "items": [
        {
          "zh": "星期、时段、最长停留和许可例外",
          "en": "Days, hours, maximum stay and permit exceptions"
        },
        {
          "zh": "扫街、装卸、通勤拖车和临时施工牌",
          "en": "Sweeping, loading, commute tow-away and temporary construction signs"
        },
        {
          "zh": "跨午夜停车，连次日一起看",
          "en": "Overnight? Read the next day’s rules too"
        }
      ]
    },
    {
      "kind": "point",
      "kicker": {
        "zh": "按城市",
        "en": "By city"
      },
      "title": {
        "zh": "别把邻城的规则套过来",
        "en": "Don’t borrow the next city’s rules"
      },
      "items": [
        {
          "zh": "旧金山：咪表、扫街和居民许可分别看",
          "en": "San Francisco: meters, sweeping and residential permits separately"
        },
        {
          "zh": "Oakland：用官方扫街地图和当年节假日表",
          "en": "Oakland: the official sweeping map and this year’s holiday list"
        },
        {
          "zh": "San Jose：看咪表和路牌的最长停留，久停查 ParkSJ 车库",
          "en": "San Jose: the maximum stay on meters and signs; ParkSJ garages for longer stays"
        }
      ]
    },
    {
      "kind": "safety",
      "kicker": {
        "zh": "付款后",
        "en": "After paying"
      },
      "title": {
        "zh": "付了钱也会被罚的情况",
        "en": "When paying still gets you a ticket"
      },
      "items": [
        {
          "zh": "超过现场最长停留",
          "en": "Staying past the posted maximum"
        },
        {
          "zh": "进入禁停时段",
          "en": "Running into a no-parking period"
        },
        {
          "zh": "在旧金山用二维码付咪表",
          "en": "Paying an SF meter by QR code"
        }
      ],
      "source": 3
    }
  ],
  "steps": [
    {
      "zh": "整组路牌按箭头范围读完，路口、车道出入口和消防栓附近另有限制。",
      "en": "Read every sign within its arrows; intersections, driveways and hydrants have their own limits."
    },
    {
      "zh": "按所在城市和当天日期查，不套用邻城规则。",
      "en": "Check the city and today’s date; don’t apply another city’s rules."
    },
    {
      "zh": "付款后也要守最长停留和禁停时段；旧金山咪表不收二维码付款。",
      "en": "Paying doesn’t extend the maximum stay or override no-parking times; SF meters take no QR payments."
    },
    {
      "zh": "拍下路牌，设回车提醒，备一个车库。",
      "en": "Photograph the signs, set a return reminder and keep a garage in mind."
    }
  ]
};
