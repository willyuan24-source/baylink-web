import type { GuideEditorial } from './types';
// Hand-maintained from here on: first drafted from the article text by a lane tool (CNT-GUIDES-2, 10-14); edit this file.

// Facts from the article (SF.gov, San José 311, OAK311 and the 211 operators, read 2026-09-27). A 日常办事 and 长辈与家属 guide.
export const localHelpEditorial: GuideEditorial = {
  "slug": "bay-area-311-211-local-help-guide",
  "cover": {
    "question": {
      "zh": "路灯坏了、要找食物援助，该打哪个号码？",
      "en": "A broken streetlight, or need food help: which number?"
    },
    "title": {
      "zh": "先分清：911 救急，311 报修，211 找援助",
      "en": "Sort it first: 911 for emergencies, 311 for city repairs, 211 for help"
    },
    "answer": {
      "zh": "报修 311 · 援助 211",
      "en": "Repairs 311 · help 211"
    },
    "line": {
      "zh": "先判断危险 · 再看问题在哪个城市 · 保存编号",
      "en": "Check for danger · find the city · keep the case number"
    }
  },
  "keyFacts": [
    {
      "label": {
        "zh": "有即时危险",
        "en": "Immediate danger"
      },
      "value": {
        "zh": "打 911，不等网页工单",
        "en": "Call 911; don’t wait on a web ticket"
      }
    },
    {
      "label": {
        "zh": "城市设施",
        "en": "City facilities"
      },
      "value": {
        "zh": "311：坑洞、路灯、涂鸦、非法弃置",
        "en": "311: potholes, streetlights, graffiti, illegal dumping"
      },
      "source": 1
    },
    {
      "label": {
        "zh": "生活援助",
        "en": "Help with living costs"
      },
      "value": {
        "zh": "211：食物、住房、账单、家庭支持的转介；咨询免费",
        "en": "211: referrals for food, housing, bills and family support; asking is free"
      },
      "source": 6
    },
    {
      "label": {
        "zh": "没有 311 的城市",
        "en": "Cities without 311"
      },
      "value": {
        "zh": "从市府官网找 Report a problem 或 Public Works",
        "en": "Look for Report a problem or Public Works on the city site"
      }
    }
  ],
  "slides": [
    {
      "kind": "checklist",
      "kicker": {
        "zh": "先分类",
        "en": "Sort first"
      },
      "title": {
        "zh": "三个号码管三类事",
        "en": "Three numbers, three jobs"
      },
      "items": [
        {
          "zh": "911：火灾、严重医疗急症、正在发生的人身危险",
          "en": "911: fire, serious medical emergencies, danger happening now"
        },
        {
          "zh": "311：城市设施和市政信息",
          "en": "311: city facilities and city information"
        },
        {
          "zh": "211：食物、住房、账单、家庭支持的转介",
          "en": "211: referrals for food, housing, bills and family support"
        }
      ]
    },
    {
      "kind": "point",
      "kicker": {
        "zh": "各城入口",
        "en": "City by city"
      },
      "title": {
        "zh": "旧金山、San José、Oakland 各有入口",
        "en": "San Francisco, San José and Oakland each have their own"
      },
      "items": [
        {
          "zh": "SF311：市内拨 311，或从 SF.gov 进入",
          "en": "SF311: dial 311 in the city, or start at SF.gov"
        },
        {
          "zh": "San José 311：网站或应用选类别，保存跟踪号码",
          "en": "San José 311: pick a category on the site or app and keep the tracking number"
        },
        {
          "zh": "OAK311：一般问题走网页，正在发生的设施急事打官网电话",
          "en": "OAK311: routine issues online; urgent facility problems by the phone on the city site"
        }
      ],
      "source": 3
    },
    {
      "kind": "safety",
      "kicker": {
        "zh": "报修时",
        "en": "When you report"
      },
      "title": {
        "zh": "写清位置，不放私人资料",
        "en": "Pin the location, keep private data out"
      },
      "items": [
        {
          "zh": "地址、最近路口、道路哪一侧、发现时间",
          "en": "Address, nearest intersection, side of the street, when you noticed it"
        },
        {
          "zh": "照片只拍公共设施，避开人脸和车内物品",
          "en": "Photograph public facilities only, not faces or car contents"
        },
        {
          "zh": "保存编号，按原记录补充，不重复报",
          "en": "Keep the case number and add to it instead of reporting twice"
        }
      ]
    }
  ],
  "steps": [
    {
      "zh": "有危险先打 911；城市设施找 311；食物、住房和账单找 211。",
      "en": "Danger: 911 first; city facilities: 311; food, housing and bills: 211."
    },
    {
      "zh": "旧金山、San José、Oakland 用各自的 311 入口；其他城市从市府官网找报修页。",
      "en": "San Francisco, San José and Oakland have their own 311; elsewhere, find the report page on the city site."
    },
    {
      "zh": "写清地址、路口和影响，只拍公共设施，保存编号继续跟进。",
      "en": "Give the address, intersection and impact, photograph only public facilities, and follow up with the case number."
    }
  ]
};
