import type { GuideEditorial } from './types';
// Hand-maintained from here on: first drafted from the article text by a lane tool (CNT-GUIDES-2, 10-14); edit this file.

// Facts from the article (platform pages read 2026-10-02). A 新手必看 and 日常办事 guide.
export const usefulAppsEditorial: GuideEditorial = {
  "slug": "bay-area-useful-apps-platforms-guide",
  "cover": {
    "question": {
      "zh": "刚到湾区，手机里先装哪些 App？",
      "en": "New to the Bay Area: which apps first?"
    },
    "title": {
      "zh": "先装这周真的会用的，再按住址和通勤补齐",
      "en": "Install what you’ll use this week, then fill in by address and commute"
    },
    "answer": {
      "zh": "按身份选一组 App",
      "en": "Pick a set for your situation"
    },
    "line": {
      "zh": "游客 · 刚搬来 · 长期居民 · 中文用户",
      "en": "Visitors · newcomers · residents · Chinese speakers"
    }
  },
  "keyFacts": [
    {
      "label": {
        "zh": "游客",
        "en": "Visitors"
      },
      "value": {
        "zh": "地图 + Uber 或 Lyft + 交通支付，再选一个餐馆或活动平台",
        "en": "Maps + Uber or Lyft + transit payment, then one dining or events app"
      }
    },
    {
      "label": {
        "zh": "刚搬来",
        "en": "Newcomers"
      },
      "value": {
        "zh": "加住房搜索、能送到家的买菜平台、优惠资讯，以及图书馆与市政入口",
        "en": "Add housing search, a grocery app that delivers to you, deals, and your library and city links"
      }
    },
    {
      "label": {
        "zh": "中文用户",
        "en": "Chinese speakers"
      },
      "value": {
        "zh": "比较 HungryPanda、Fantuan、Weee! 和 Dealmoon，地址和配送分别看",
        "en": "Compare HungryPanda, Fantuan, Weee! and Dealmoon; check address and delivery for each"
      }
    },
    {
      "label": {
        "zh": "比价",
        "en": "Comparing"
      },
      "value": {
        "zh": "外卖和买菜用同一篮商品，比含配送、服务费、税和小费的总额",
        "en": "Use the same basket and compare totals with delivery, fees, tax and tip"
      }
    }
  ],
  "slides": [
    {
      "kind": "checklist",
      "kicker": {
        "zh": "按身份选",
        "en": "By situation"
      },
      "title": {
        "zh": "先选一组，不必一次装全",
        "en": "Start with one set, not everything"
      },
      "items": [
        {
          "zh": "游客：地图、叫车、交通支付",
          "en": "Visitors: maps, rides, transit payment"
        },
        {
          "zh": "刚搬来：住房搜索、买菜、优惠资讯、图书馆和市政入口",
          "en": "Newcomers: housing search, groceries, deals, library and city links"
        },
        {
          "zh": "长期居民：按实际账单判断会员值不值；用图书馆数字资源减少重复订阅",
          "en": "Residents: judge memberships by your actual bills; library digital resources cut duplicate subscriptions"
        }
      ]
    },
    {
      "kind": "point",
      "kicker": {
        "zh": "三件事",
        "en": "Three things"
      },
      "title": {
        "zh": "App、会员和服务范围分开看",
        "en": "App, membership and service area are separate"
      },
      "body": {
        "zh": "能下载 App，只说明你能装上；送不送你的住址、哪些功能收费，要另看。下载从官方入口进商店，看清开发者。",
        "en": "Being able to download an app only means you can install it; delivery to your address and paid features are separate questions. Download through official links and check the developer."
      }
    },
    {
      "kind": "checklist",
      "kicker": {
        "zh": "十分钟",
        "en": "Ten minutes"
      },
      "title": {
        "zh": "装完先做这几项设置",
        "en": "Set these up after installing"
      },
      "items": [
        {
          "zh": "填对实际城市、地址或搜索范围",
          "en": "Enter your real city, address or search area"
        },
        {
          "zh": "看服务地区、费用和续费；免费试用记下到期日",
          "en": "Check service area, fees and renewals; note when free trials end"
        },
        {
          "zh": "只给必要的通知和定位权限",
          "en": "Grant only the notifications and location you need"
        }
      ]
    }
  ],
  "steps": [
    {
      "zh": "游客、刚搬来、长期居民和中文用户各选一组，先装这周会用的。",
      "en": "Visitors, newcomers, residents and Chinese speakers each pick a set; install what you’ll use this week."
    },
    {
      "zh": "按用途查目录，从官方入口下载。",
      "en": "Find apps by purpose and download through official links."
    },
    {
      "zh": "同类平台用相同条件比较最终总价和等待时间。",
      "en": "Compare similar platforms on the same terms: final total and wait time."
    },
    {
      "zh": "填对地址，记下试用到期日，只开必要权限。",
      "en": "Enter the right address, note trial end dates and grant only needed permissions."
    },
    {
      "zh": "配合 101 城、水电和 311 指南找本地入口。",
      "en": "Use the 101-city, utilities and 311 guides for local links."
    }
  ]
};
