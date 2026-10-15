import type { GuideEditorial } from './types';
// Hand-maintained from here on: first drafted from the article text by a lane tool (CNT-GUIDES-2, 10-14); edit this file.

// Facts from the article (county alert systems, PG&E, SVP, Palo Alto, Air District and Ready.gov pages read 2026-09-27). A 日常办事 guide.
export const alertsEditorial: GuideEditorial = {
  "slug": "bay-area-alerts-outages-first-day-checklist",
  "cover": {
    "question": {
      "zh": "刚搬来，紧急通知和停电消息从哪里收？",
      "en": "Just moved: where do emergency alerts and outage news come from?"
    },
    "title": {
      "zh": "按县注册提醒，收藏停电和空气质量页面",
      "en": "Register for county alerts; bookmark outage and air quality pages"
    },
    "answer": {
      "zh": "按县注册本地提醒",
      "en": "Sign up by county"
    },
    "line": {
      "zh": "AlertSF · AC Alert · SMC Alert · AlertSCC · AlertMarin",
      "en": "AlertSF · AC Alert · SMC Alert · AlertSCC · AlertMarin"
    }
  },
  "keyFacts": [
    {
      "label": {
        "zh": "旧金山",
        "en": "San Francisco"
      },
      "value": {
        "zh": "AlertSF",
        "en": "AlertSF"
      },
      "source": 1
    },
    {
      "label": {
        "zh": "Alameda County",
        "en": "Alameda County"
      },
      "value": {
        "zh": "AC Alert",
        "en": "AC Alert"
      },
      "source": 2
    },
    {
      "label": {
        "zh": "San Mateo／Santa Clara",
        "en": "San Mateo / Santa Clara"
      },
      "value": {
        "zh": "SMC Alert／AlertSCC",
        "en": "SMC Alert / AlertSCC"
      },
      "source": 3
    },
    {
      "label": {
        "zh": "停电",
        "en": "Outages"
      },
      "value": {
        "zh": "先看账单上的供电单位；PG&E 用户收藏 Outage Center",
        "en": "Check your bill for your power provider; PG&E customers bookmark the Outage Center"
      },
      "source": 6
    }
  ],
  "slides": [
    {
      "kind": "checklist",
      "kicker": {
        "zh": "提醒",
        "en": "Alerts"
      },
      "title": {
        "zh": "按县注册，搬家后更新",
        "en": "Register by county; update after moving"
      },
      "items": [
        {
          "zh": "旧金山 AlertSF，Alameda County AC Alert",
          "en": "San Francisco: AlertSF; Alameda County: AC Alert"
        },
        {
          "zh": "San Mateo County SMC Alert，Santa Clara County AlertSCC",
          "en": "San Mateo County: SMC Alert; Santa Clara County: AlertSCC"
        },
        {
          "zh": "Marin County AlertMarin；搬家后删除旧地点",
          "en": "Marin County: AlertMarin; remove old locations after moving"
        }
      ]
    },
    {
      "kind": "point",
      "kicker": {
        "zh": "停电",
        "en": "Outages"
      },
      "title": {
        "zh": "供电单位不一定是 PG&E",
        "en": "Your power provider may not be PG&E"
      },
      "items": [
        {
          "zh": "PG&E：Outage Center 查范围和预计恢复",
          "en": "PG&E: the Outage Center for areas and restoration estimates"
        },
        {
          "zh": "Santa Clara 市：Silicon Valley Power",
          "en": "City of Santa Clara: Silicon Valley Power"
        },
        {
          "zh": "Palo Alto：市公用事业",
          "en": "Palo Alto: City of Palo Alto Utilities"
        }
      ],
      "source": 6
    },
    {
      "kind": "checklist",
      "kicker": {
        "zh": "家庭准备",
        "en": "Household"
      },
      "title": {
        "zh": "从现有用品开始",
        "en": "Start with what you have"
      },
      "items": [
        {
          "zh": "饮水、耐储食物、手电、备用电池、充电设备和收音机",
          "en": "Water, shelf-stable food, flashlights, spare batteries, chargers and a radio"
        },
        {
          "zh": "约好集合方式和外地联系人",
          "en": "Agree on a meeting plan and an out-of-area contact"
        },
        {
          "zh": "重要电话留一份纸本",
          "en": "Keep important numbers on paper"
        }
      ],
      "source": 11
    }
  ],
  "steps": [
    {
      "zh": "按所在县注册提醒，搬家后删除旧地点、更新电话。",
      "en": "Register with your county’s alert system; after moving, remove old locations and update numbers."
    },
    {
      "zh": "收藏实际供电单位的停电页面，空气质量和 Spare the Air 分开看。",
      "en": "Bookmark your actual power provider’s outage page; check air quality and Spare the Air separately."
    },
    {
      "zh": "按 Ready.gov 清单补用品，和家人约好联系办法。",
      "en": "Use Ready.gov’s list for supplies and agree on how the family stays in touch."
    }
  ]
};
