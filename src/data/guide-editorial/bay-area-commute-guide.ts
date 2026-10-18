import type { GuideEditorial } from './types';
// Hand-maintained from here on: first drafted from the article text by a lane tool (CNT-GUIDES-2, 10-14); edit this file.

// Facts from the article (BART, Caltrain and VTA instructions read 2026-10-07). A 新手必看 guide.
export const commuteEditorial: GuideEditorial = {
  "slug": "bay-area-commute-guide",
  "cover": {
    "question": {
      "zh": "BART、Caltrain、开车、拼车，通勤选哪个？",
      "en": "BART, Caltrain, driving or carpool: which commute?"
    },
    "title": {
      "zh": "先在真实上班时段试跑一次，再定路线",
      "en": "Do one trial run at real commute times before you decide"
    },
    "answer": {
      "zh": "同一天查去程和回程",
      "en": "Check both directions for the same day"
    },
    "line": {
      "zh": "门到门时间 · 往返成本 · 回家备选",
      "en": "Door-to-door time · round-trip cost · a backup way home"
    }
  },
  "keyFacts": [
    {
      "label": {
        "zh": "先写下",
        "en": "Write down first"
      },
      "value": {
        "zh": "具体地址、必须到达和通常离开的时间",
        "en": "The exact addresses, when you must arrive and when you usually leave"
      }
    },
    {
      "label": {
        "zh": "门到门时间",
        "en": "Door to door"
      },
      "value": {
        "zh": "步行、等车、换乘、停车和最后一公里都算进去",
        "en": "Count walking, waiting, transfers, parking and the last mile"
      }
    },
    {
      "label": {
        "zh": "Caltrain",
        "en": "Caltrain"
      },
      "value": {
        "zh": "不同服务停站不同；上车前要有有效车票，用 Clipper 记得下车刷卡",
        "en": "Stopping patterns differ; have a valid ticket before boarding and tap off with Clipper"
      },
      "source": 2
    },
    {
      "label": {
        "zh": "一定要有",
        "en": "Always have"
      },
      "value": {
        "zh": "错过一班或取消时的回家备选",
        "en": "A way home if you miss a train or it’s cancelled"
      }
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
        "zh": "同一天查去程和回程",
        "en": "Check both directions for the same day"
      },
      "items": [
        {
          "zh": "输入实际起终点和通勤日期",
          "en": "Enter your real start, end and travel date"
        },
        {
          "zh": "周末、节假日和晚归分别查",
          "en": "Check weekends, holidays and late trips separately"
        },
        {
          "zh": "保存主路线和错过一班后的下一条",
          "en": "Save the main route and the next option if you miss one"
        }
      ]
    },
    {
      "kind": "point",
      "kicker": {
        "zh": "官方工具",
        "en": "Official tools"
      },
      "title": {
        "zh": "用运营方的工具查车",
        "en": "Use the operators’ own tools"
      },
      "items": [
        {
          "zh": "BART 应用：实时发车、取消班次、电梯提醒和末班车",
          "en": "BART app: live departures, cancellations, elevator alerts and last trains"
        },
        {
          "zh": "Caltrain：选平日或周末时刻表，看实际停站",
          "en": "Caltrain: pick the weekday or weekend schedule and check actual stops"
        },
        {
          "zh": "VTA：用 Transit 查公交和轻轨",
          "en": "VTA: use Transit for buses and light rail"
        }
      ],
      "source": 1
    },
    {
      "kind": "checklist",
      "kicker": {
        "zh": "比较成本",
        "en": "Compare costs"
      },
      "title": {
        "zh": "开车和拼车按完整往返算",
        "en": "Count the whole round trip for driving and carpools"
      },
      "items": [
        {
          "zh": "公共交通：票价、接驳和车站停车费",
          "en": "Transit: fares, connections and station parking"
        },
        {
          "zh": "开车：油电、桥费、目的地停车和堵车时间",
          "en": "Driving: fuel or charging, tolls, parking and traffic time"
        },
        {
          "zh": "拼车：接送点、费用分摊、迟到和取消规则",
          "en": "Carpool: pick-up points, cost sharing, lateness and cancellations"
        }
      ]
    }
  ],
  "steps": [
    {
      "zh": "用实际起终点和日期，同一天查去程、回程和错过一班后的备选。",
      "en": "With your real addresses and date, check both directions and a backup if you miss one."
    },
    {
      "zh": "按你能到达的车站，用 BART、Caltrain、VTA 的官方工具查停站和接驳。",
      "en": "For the stations you can reach, check stops and connections in the BART, Caltrain and VTA tools."
    },
    {
      "zh": "开车和拼车按完整往返成本比，拼车也要有自己回家的办法。",
      "en": "Compare driving and carpools on the full round-trip cost, and keep your own way home."
    },
    {
      "zh": "在真实上班时段试跑，记下实际离家和到门时间。",
      "en": "Do a trial run at real commute times and note when you actually leave and arrive."
    },
    {
      "zh": "出门前再看服务提醒，备好车票或交通卡。",
      "en": "Before leaving, recheck service alerts and have your ticket or card ready."
    },
    {
      "zh": "Caltrain 1 月 1 日、Muni 1 月 4 日调价；BART 2026–27 财年不涨价，资金不足的应急方案还没决定。",
      "en": "Caltrain fares change January 1 and Muni fares January 4; BART has no increase in fiscal 2026–27, and its shortfall plan is not decided."
    }
  ]
};
