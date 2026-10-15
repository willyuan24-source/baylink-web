import type { GuideEditorial } from './types';

// Facts from the article (FasTrak, Golden Gate and 511 pages read 2026-09-27). A 日常办事 guide.
export const fastrakEditorial: GuideEditorial = {
  "slug": "bay-area-fastrak-bridge-express-lanes-guide",
  "cover": {
    "question": {
      "zh": "过桥、走快速车道，FasTrak 怎么付？",
      "en": "Bridges and express lanes: how does FasTrak work?"
    },
    "title": {
      "zh": "桥费和快速车道分开算",
      "en": "Bridge tolls and express lanes are billed separately"
    },
    "answer": {
      "zh": "金门桥只收南向",
      "en": "Golden Gate: southbound only"
    },
    "line": {
      "zh": "过桥 · Express Lanes · 租车 · 催缴短信",
      "en": "Bridges · Express Lanes · rentals · toll texts"
    }
  },
  "keyFacts": [
    {
      "label": {
        "zh": "金门桥",
        "en": "Golden Gate Bridge"
      },
      "value": {
        "zh": "只向进入旧金山的南向收费，现场不收现金",
        "en": "Charges southbound into San Francisco only; no cash at the bridge"
      },
      "source": 2
    },
    {
      "label": {
        "zh": "车牌账户",
        "en": "Plate accounts"
      },
      "value": {
        "zh": "只能付桥费，走不了快速车道",
        "en": "Pay bridge tolls only; no express lane access"
      },
      "source": 5
    },
    {
      "label": {
        "zh": "快速车道合乘",
        "en": "Express lane carpools"
      },
      "value": {
        "zh": "I-580 两人可免，US-101 普通两人车半价；都要有合适设备",
        "en": "I-580: two people ride free; US-101: ordinary two-person vehicles pay half; a suitable tag is required"
      },
      "source": 3
    },
    {
      "label": {
        "zh": "催缴短信",
        "en": "Toll texts"
      },
      "value": {
        "zh": "FasTrak 不通过带网站链接的短信催款",
        "en": "FasTrak doesn’t ask for payment by text with a website link"
      },
      "source": 7
    }
  ],
  "slides": [
    {
      "kind": "compare",
      "kicker": {
        "zh": "两种收费",
        "en": "Two kinds of toll"
      },
      "title": {
        "zh": "桥费和快速车道各算各的",
        "en": "Bridges and express lanes are separate"
      },
      "items": [
        {
          "zh": "过桥：按桥名、方向和车辆类别收费",
          "en": "Bridges: by bridge, direction and vehicle type"
        },
        {
          "zh": "快速车道：普通车道仍可选，进入前看价格和营运时段",
          "en": "Express lanes: optional; check price and hours before entering"
        },
        {
          "zh": "合乘优惠套不到收费桥上",
          "en": "Express lane carpool discounts don’t apply to bridges"
        }
      ],
      "source": 3
    },
    {
      "kind": "checklist",
      "kicker": {
        "zh": "租车",
        "en": "Rentals"
      },
      "title": {
        "zh": "取车时问清三件事",
        "en": "Ask three things at pickup"
      },
      "items": [
        {
          "zh": "代付包括桥梁，还是也包括快速车道",
          "en": "Does the plan cover bridges only, or express lanes too?"
        },
        {
          "zh": "另收多少服务费",
          "en": "What service fees apply?"
        },
        {
          "zh": "自付时怎样退出方案",
          "en": "How do you opt out to pay yourself?"
        }
      ],
      "source": 6
    },
    {
      "kind": "safety",
      "kicker": {
        "zh": "短信",
        "en": "Texts"
      },
      "title": {
        "zh": "收到“今天到期”，先别点链接",
        "en": "“Due today”? Don’t tap the link"
      },
      "items": [
        {
          "zh": "手动打开 bayareafastrak.org 查记录",
          "en": "Open bayareafastrak.org yourself to check"
        },
        {
          "zh": "不在短信页面填支付资料",
          "en": "Never enter payment details from a text"
        },
        {
          "zh": "对照行程日期、桥名和租车区间",
          "en": "Compare trip dates, bridge and rental period"
        }
      ],
      "source": 7
    }
  ],
  "steps": [
    {
      "zh": "先分清过哪座桥、走不走快速车道，两种收费分开算。",
      "en": "Separate which bridge you cross from whether you use an express lane; they bill apart."
    },
    {
      "zh": "车牌账户只付桥费；走快速车道要有 FasTrak 账户、设备和设对人数的 Flex。",
      "en": "Plate accounts pay bridges only; express lanes need a FasTrak account, a tag and a Flex set to your occupancy."
    },
    {
      "zh": "自有车查登记和设备；租车先问代付范围和服务费。",
      "en": "Own car: check registration and tag; rental: ask about coverage and fees first."
    },
    {
      "zh": "收到催缴短信，从官网独立查记录再付款。",
      "en": "Got a toll text? Check records on the official site yourself before paying."
    }
  ]
};
