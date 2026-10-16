import type { GuideEditorial } from './types';
// Hand-maintained from here on: first drafted from the article text by a lane tool (CNT-GUIDES-2, 10-14); edit this file.

// Facts from the article (BART, Caltrain, VTA and Clipper pages read 2026-10-14). On the home 日常办事 rail.
export const withoutCarEditorial: GuideEditorial = {
  "slug": "bay-area-without-car-guide",
  "cover": {
    "question": {
      "zh": "在湾区没有车，能生活吗？",
      "en": "Can you live in the Bay Area without a car?"
    },
    "title": {
      "zh": "能，前提是住处、常去的地方和晚归能用公共交通接起来",
      "en": "Yes, if home, your regular places and late trips connect by transit"
    },
    "answer": {
      "zh": "BART 每天午夜收车",
      "en": "BART stops at midnight"
    },
    "line": {
      "zh": "BART · Caltrain · 公交 · 买菜 · 晚归",
      "en": "BART · Caltrain · buses · groceries · late trips"
    }
  },
  "keyFacts": [
    {
      "label": {
        "zh": "BART 运营时间",
        "en": "BART hours"
      },
      "value": {
        "zh": "工作日 5:00、周六 6:00、周日 8:00 开始，午夜 12:00 收车",
        "en": "Starts 5 a.m. weekdays, 6 a.m. Saturdays, 8 a.m. Sundays; ends at midnight"
      },
      "source": 1
    },
    {
      "label": {
        "zh": "车票",
        "en": "Fares"
      },
      "value": {
        "zh": "BART 全线只卖 Clipper，实体卡 $3，也能放进手机",
        "en": "BART sells only Clipper; a card costs $3, or add it to your phone"
      },
      "source": 1
    },
    {
      "label": {
        "zh": "坐车省钱",
        "en": "Saving on fares"
      },
      "value": {
        "zh": "65 岁以上长者卡坐 BART 减 62.5%；Clipper START 单程五折",
        "en": "65+: Senior Clipper takes 62.5% off BART; Clipper START halves single rides"
      },
      "source": 5
    },
    {
      "label": {
        "zh": "找房时",
        "en": "When house-hunting"
      },
      "value": {
        "zh": "离车站多远、附近有没有地方买菜，和预算放在同一层",
        "en": "Distance to the station and nearby groceries rank with the budget"
      }
    }
  ],
  "slides": [
    {
      "kind": "compare",
      "kicker": {
        "zh": "主干",
        "en": "Main lines"
      },
      "title": {
        "zh": "BART 和 Caltrain 各管一段",
        "en": "BART and Caltrain cover different corridors"
      },
      "items": [
        {
          "zh": "BART：旧金山、东湾和部分半岛、南湾节点",
          "en": "BART: San Francisco, the East Bay and some Peninsula and South Bay hubs"
        },
        {
          "zh": "Caltrain：San Francisco 到 Palo Alto、Mountain View、Sunnyvale、San Jose",
          "en": "Caltrain: San Francisco to Palo Alto, Mountain View, Sunnyvale, San Jose"
        },
        {
          "zh": "最后一公里靠 Muni、VTA 和本地公交",
          "en": "The last mile is Muni, VTA and local buses"
        }
      ]
    },
    {
      "kind": "checklist",
      "kicker": {
        "zh": "提前想好",
        "en": "Plan ahead"
      },
      "title": {
        "zh": "买菜、机场和晚归的备用方案",
        "en": "Backups for groceries, airports and late nights"
      },
      "items": [
        {
          "zh": "常去超市能否步行或一趟公交到",
          "en": "Can you walk or take one bus to your usual store?"
        },
        {
          "zh": "大采购是否适合配送",
          "en": "Would delivery work for big shops?"
        },
        {
          "zh": "晚归时有没有安全可行的备用方案",
          "en": "Is there a safe backup for late nights?"
        }
      ]
    },
    {
      "kind": "point",
      "kicker": {
        "zh": "省钱",
        "en": "Saving"
      },
      "title": {
        "zh": "长者卡和 Clipper START",
        "en": "Senior cards and Clipper START"
      },
      "body": {
        "zh": "65 岁以上办长者 Clipper 卡，坐 BART 票价减 62.5%；19–64 岁、收入符合条件的湾区居民可以申请 Clipper START，单程票五折。",
        "en": "At 65 or older, a Senior Clipper card takes 62.5% off BART; residents aged 19–64 who meet the income limit get half off single rides with Clipper START."
      },
      "source": 5
    }
  ],
  "steps": [
    {
      "zh": "先看住处和常去的地方能否用公共交通接起来。",
      "en": "First check whether home and your regular places connect by transit."
    },
    {
      "zh": "BART 跑主干、Caltrain 跑半岛到南湾；BART 每天午夜收车。",
      "en": "BART runs the trunk lines, Caltrain the Peninsula to the South Bay; BART stops at midnight."
    },
    {
      "zh": "最后一公里看 Muni、VTA 和本地公交，晚上回家的最后一趟先查好。",
      "en": "Plan the last mile on Muni, VTA and local buses, and know the last ride home."
    },
    {
      "zh": "买菜、机场、搬东西和晚归，提前想好备用方案。",
      "en": "Have backups for groceries, airports, moving things and late nights."
    },
    {
      "zh": "找房时把离车站多远、附近有没有地方买菜，和预算一起看。",
      "en": "When house-hunting, weigh distance to transit and groceries with the budget."
    }
  ]
};
