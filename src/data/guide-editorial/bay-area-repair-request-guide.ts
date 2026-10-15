import type { GuideEditorial } from './types';
// Hand-maintained from here on: first drafted from the article text by a lane tool (CNT-GUIDES-2, 10-14); edit this file.

// Facts from the article (PG&E gas-leak safety and CSLB pages read 2026-09-08). On the home 日常办事 rail.
export const repairRequestEditorial: GuideEditorial = {
  "slug": "bay-area-repair-request-guide",
  "cover": {
    "question": {
      "zh": "家里东西坏了，怎么报修才少跑一趟？",
      "en": "Something broke at home: how do I report it in one go?"
    },
    "title": {
      "zh": "说清现象、时间和型号，再分开问诊断费和维修费",
      "en": "Describe symptoms, timing and model, then ask about diagnosis and repair fees separately"
    },
    "answer": {
      "zh": "闻到燃气：先离开，再打 911",
      "en": "Gas smell: get out, then call 911"
    },
    "line": {
      "zh": "安全 · 描述 · 查承包商 · 报价 · 留档",
      "en": "Safety · description · contractor check · quote · records"
    }
  },
  "keyFacts": [
    {
      "label": {
        "zh": "闻到燃气味",
        "en": "Smell gas"
      },
      "value": {
        "zh": "立即远离现场，到安全位置打 911，再联系 PG&E",
        "en": "Leave at once, call 911 from a safe place, then PG&E"
      },
      "source": 1
    },
    {
      "label": {
        "zh": "租房",
        "en": "Renting"
      },
      "value": {
        "zh": "先向房东或物业报修，保留通知时间",
        "en": "Report to the landlord or manager first and keep the time you told them"
      }
    },
    {
      "label": {
        "zh": "承包商执照",
        "en": "Contractor license"
      },
      "value": {
        "zh": "用 CSLB 官方查询入口查名称、号码、状态和分类",
        "en": "Use CSLB’s lookup for name, number, status and classification"
      },
      "source": 2
    },
    {
      "label": {
        "zh": "报价",
        "en": "Quotes"
      },
      "value": {
        "zh": "CSLB 建议按相同范围取得多份书面报价",
        "en": "CSLB recommends several written quotes for the same scope"
      },
      "source": 3
    }
  ],
  "slides": [
    {
      "kind": "safety",
      "kicker": {
        "zh": "有危险",
        "en": "Danger"
      },
      "title": {
        "zh": "先离开现场，不等报价",
        "en": "Leave first; don’t wait for a quote"
      },
      "items": [
        {
          "zh": "闻到燃气：远离现场，到安全位置打 911，再联系 PG&E",
          "en": "Gas smell: leave, call 911 from a safe place, then PG&E"
        },
        {
          "zh": "冒烟、火花、裸露电线附近有积水：别继续用或拆机",
          "en": "Smoke, sparks or water near exposed wires: stop using or opening it"
        }
      ],
      "source": 1
    },
    {
      "kind": "checklist",
      "kicker": {
        "zh": "描述问题",
        "en": "Describe it"
      },
      "title": {
        "zh": "维修人员需要这些信息",
        "en": "What the technician needs"
      },
      "items": [
        {
          "zh": "现象和错误代码",
          "en": "Symptoms and error codes"
        },
        {
          "zh": "出现时间和频率",
          "en": "When it started and how often"
        },
        {
          "zh": "品牌型号和已做的操作",
          "en": "Brand, model and what you’ve tried"
        }
      ]
    },
    {
      "kind": "point",
      "kicker": {
        "zh": "报价",
        "en": "Quotes"
      },
      "title": {
        "zh": "诊断费和维修费分开问",
        "en": "Ask about diagnosis and repair separately"
      },
      "items": [
        {
          "zh": "上门或诊断收费，能否抵扣维修",
          "en": "Callout or diagnostic fee, and whether it counts toward the repair"
        },
        {
          "zh": "人工和零件怎么算",
          "en": "How labor and parts are priced"
        },
        {
          "zh": "新增工作要先经你同意",
          "en": "Extra work needs your approval first"
        }
      ],
      "source": 3
    }
  ],
  "steps": [
    {
      "zh": "闻到燃气或看到冒烟、火花，先离开现场，再打 911 和 PG&E。",
      "en": "Gas smell, smoke or sparks: leave first, then call 911 and PG&E."
    },
    {
      "zh": "用现象、时间线和型号描述问题，租房先找房东或物业。",
      "en": "Describe symptoms, timeline and model; renters go to the landlord or manager first."
    },
    {
      "zh": "需要执照的工作，用 CSLB 官方查询入口查承包商。",
      "en": "For licensed work, look the contractor up on CSLB."
    },
    {
      "zh": "诊断费、人工和零件分开问，新增工作要先经你同意。",
      "en": "Ask about diagnosis, labor and parts separately; extra work needs your approval."
    },
    {
      "zh": "完工后保存工单、收据和保修说明。",
      "en": "Afterward keep the work order, receipts and warranty."
    },
    {
      "zh": "照着模板写报修，详细地址私下提供。",
      "en": "Use the template and share the exact address privately."
    }
  ]
};
