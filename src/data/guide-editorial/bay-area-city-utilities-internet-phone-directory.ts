import type { GuideEditorial } from './types';

// Facts from the article (city, PG&E, CPUC and provider pages read 2026-10-02). A 新手必看 and 日常办事 directory.
export const utilitiesEditorial: GuideEditorial = {
  "slug": "bay-area-city-utilities-internet-phone-directory",
  "cover": {
    "question": {
      "zh": "搬家要开水电、垃圾和网络，先找谁？",
      "en": "Moving: who do I call for water, power, trash and internet?"
    },
    "title": {
      "zh": "先问房东或物业，再按城市找服务商",
      "en": "Ask the landlord or manager first, then find providers by city"
    },
    "answer": {
      "zh": "PG&E 住宅客服 877-660-6789",
      "en": "PG&E residential: 877-660-6789"
    },
    "line": {
      "zh": "水 · 电 · 垃圾 · 宽带 · 手机",
      "en": "Water · power · trash · internet · phone"
    },
    "phone": {
      "label": {
        "zh": "PG&E 住宅客服",
        "en": "PG&E residential service"
      },
      "number": "877-660-6789",
      "tel": "+18776606789"
    }
  },
  "keyFacts": [
    {
      "label": {
        "zh": "租客先问",
        "en": "Renters ask first"
      },
      "value": {
        "zh": "水费、污水费或垃圾费有时含在租金、HOA 或物业账单里",
        "en": "Water, sewer or trash are sometimes in rent, HOA or property bills"
      }
    },
    {
      "label": {
        "zh": "电力",
        "en": "Electricity"
      },
      "value": {
        "zh": "多数城市找 PG&E；Alameda、Palo Alto、Santa Clara 和 Healdsburg 有市营电力",
        "en": "Most cities: PG&E; Alameda, Palo Alto, Santa Clara and Healdsburg run their own"
      },
      "source": 9
    },
    {
      "label": {
        "zh": "宽带",
        "en": "Internet"
      },
      "value": {
        "zh": "先查加州宽带地图，再用完整地址和房号问公司能装什么",
        "en": "Check the California broadband map, then ask providers with your full address and unit"
      },
      "source": 7
    },
    {
      "label": {
        "zh": "非建制社区",
        "en": "Unincorporated areas"
      },
      "value": {
        "zh": "Castro Valley、San Lorenzo 等不在 101 城内；按县、供水区和垃圾服务区查",
        "en": "Castro Valley, San Lorenzo and others aren’t among the 101 cities; check county, water and waste districts"
      },
      "source": 5
    }
  ],
  "contacts": [
    {
      "name": {
        "zh": "PG&E 住宅客服",
        "en": "PG&E residential customer service"
      },
      "number": "877-660-6789",
      "tel": "+18776606789",
      "note": {
        "zh": "开户、停用和搬家转移",
        "en": "Start, stop and move service"
      },
      "source": 9
    }
  ],
  "slides": [
    {
      "kind": "checklist",
      "kicker": {
        "zh": "搬家办理",
        "en": "Moving service"
      },
      "title": {
        "zh": "每家机构说清三件事",
        "en": "Tell each provider three things"
      },
      "items": [
        {
          "zh": "Start service、Stop service 或 Move/Transfer service",
          "en": "Start service, Stop service or Move/Transfer service"
        },
        {
          "zh": "旧址停用日和新址启用日",
          "en": "The stop date at the old address and start date at the new one"
        },
        {
          "zh": "开户费或押金、是否预约入户、办理编号",
          "en": "Setup fee or deposit, access appointment, reference number"
        }
      ],
      "source": 6
    },
    {
      "kind": "point",
      "kicker": {
        "zh": "电力",
        "en": "Electricity"
      },
      "title": {
        "zh": "配电公司和社区电力分开找",
        "en": "Delivery utility and community power are different"
      },
      "body": {
        "zh": "账单上出现 MCE、CleanPowerSF 等名称，通常是发电供应方案；停送电、线路和开户先找实际配电服务方。",
        "en": "Names such as MCE or CleanPowerSF on a bill usually mean a generation plan; for outages, lines and accounts, start with the delivery utility."
      },
      "source": 3
    },
    {
      "kind": "safety",
      "kicker": {
        "zh": "城市边界",
        "en": "City lines"
      },
      "title": {
        "zh": "邮寄地址写的城市，未必是服务区",
        "en": "A mailing city isn’t always the service area"
      },
      "items": [
        {
          "zh": "先问房东或物业现在的账单单位",
          "en": "Ask the landlord or manager who bills the property now"
        },
        {
          "zh": "按县、供水区和垃圾特许服务区查",
          "en": "Check the county, water district and waste franchise area"
        },
        {
          "zh": "私人水井、化粪池和商业物业另有安排",
          "en": "Private wells, septic and commercial properties work differently"
        }
      ],
      "source": 5
    }
  ],
  "steps": [
    {
      "zh": "在城市卡片里找水、电和垃圾的负责单位。",
      "en": "Find the water, power and trash providers in the city entries."
    },
    {
      "zh": "宽带先查地图，再用完整地址问公司。",
      "en": "For internet, check the map, then ask providers with your full address."
    },
    {
      "zh": "手机按运营商联系表找客服；转号前旧服务保持有效。",
      "en": "Use the carrier contact list; keep old service active until a number transfer is done."
    },
    {
      "zh": "每家机构分别办开户、停用或转移，记下生效日期和办理编号。",
      "en": "Start, stop or move each service separately and note the dates and reference numbers."
    },
    {
      "zh": "多数城市找 PG&E，市营电力城市按城市卡片办，燃气单独问。",
      "en": "Most cities use PG&E; municipal-power cities use their city entries; ask about gas separately."
    },
    {
      "zh": "非建制社区按县、供水区和垃圾服务区查。",
      "en": "In unincorporated areas, check county, water and waste districts."
    },
    {
      "zh": "照着模板问服务区、开户人和生效日期。",
      "en": "Use the template to ask about service area, account holder and dates."
    }
  ]
};
