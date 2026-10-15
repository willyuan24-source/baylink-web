import type { GuideEditorial } from './types';

// Facts from the article (SSA, Medicare, FBI IC3, FTC, DOJ OVC and CDSS APS pages read 2026-10-14). 长辈与家属.
export const elderScamEditorial: GuideEditorial = {
  "slug": "bay-area-elder-scam-prevention-guide",
  "cover": {
    "question": {
      "zh": "电话里说孙子出事、说你犯了法，要你马上转钱？",
      "en": "A call says a grandchild is in trouble, or you broke the law, and you must pay now?"
    },
    "title": {
      "zh": "先挂断，用自己存的号码打回去",
      "en": "Hang up, then call back on a number you saved"
    },
    "answer": {
      "zh": "长者诈骗热线 833-372-8311",
      "en": "Elder fraud hotline 833-372-8311"
    },
    "line": {
      "zh": "挂断 · 打回 · 不按指定方式付款",
      "en": "Hang up · call back · never pay their way"
    },
    "phone": {
      "label": {
        "zh": "全国长者诈骗热线",
        "en": "National Elder Fraud Hotline"
      },
      "number": "833-372-8311",
      "tel": "+18333728311"
    }
  },
  "keyFacts": [
    {
      "label": {
        "zh": "诈骗的四个信号",
        "en": "Four signs of a scam"
      },
      "value": {
        "zh": "冒充熟悉的机构；说有麻烦或中奖；催你马上行动；指定付款方式",
        "en": "Posing as a known agency; a problem or prize; pressure to act now; a set way to pay"
      },
      "source": 1
    },
    {
      "label": {
        "zh": "来电要你这样付款，就是骗子",
        "en": "A caller who demands these is a scammer"
      },
      "value": {
        "zh": "要你买礼品卡、金条、加密货币，或电汇、寄现金",
        "en": "Gift cards, gold bars, crypto, wire transfers or mailed cash"
      },
      "source": 1
    },
    {
      "label": {
        "zh": "冒充中国警方",
        "en": "Fake Chinese police"
      },
      "value": {
        "zh": "FBI：专找在美华人；号码像官方，也证明不了是官方",
        "en": "FBI: targets the US-based Chinese community; an official-looking number proves nothing"
      },
      "source": 3
    },
    {
      "label": {
        "zh": "长者被熟人骗钱",
        "en": "Elder exploited by someone they know"
      },
      "value": {
        "zh": "加州成人保护服务 1-833-401-0832，24 小时",
        "en": "California Adult Protective Services 1-833-401-0832, 24 hours"
      },
      "source": 6
    }
  ],
  "contacts": [
    {
      "name": {
        "zh": "全国长者诈骗热线（司法部）",
        "en": "National Elder Fraud Hotline (Justice Department)"
      },
      "number": "833-372-8311",
      "tel": "+18333728311",
      "note": {
        "zh": "60 岁以上被骗；周一到周五美东时间 10:00–18:00",
        "en": "Fraud against anyone 60+; Monday–Friday 10 a.m.–6 p.m. Eastern"
      },
      "source": 5
    },
    {
      "name": {
        "zh": "加州成人保护服务（APS）",
        "en": "California Adult Protective Services (APS)"
      },
      "number": "1-833-401-0832",
      "tel": "+18334010832",
      "note": {
        "zh": "输入邮编转到所在县，24 小时",
        "en": "Enter a ZIP code to reach the county; 24 hours"
      },
      "source": 6
    },
    {
      "name": {
        "zh": "Medicare 诈骗举报",
        "en": "Medicare fraud reports"
      },
      "number": "1-800-633-4227",
      "tel": "+18006334227",
      "note": {
        "zh": "1-800-MEDICARE",
        "en": "1-800-MEDICARE"
      },
      "source": 2
    }
  ],
  "slides": [
    {
      "kind": "checklist",
      "kicker": {
        "zh": "三步",
        "en": "Three steps"
      },
      "title": {
        "zh": "挂断、打回、不按指定方式付款",
        "en": "Hang up, call back, don’t pay their way"
      },
      "items": [
        {
          "zh": "先挂断或不回复，找信得过的人商量",
          "en": "Hang up or don’t reply; talk to someone you trust"
        },
        {
          "zh": "用手机里存的号码打回去；联系不上就问其他家人",
          "en": "Call back on the number saved in your phone; if you can’t reach them, call other family"
        },
        {
          "zh": "来电要你用礼品卡、金条、加密货币、电汇或寄现金付款：就是骗子",
          "en": "A caller who demands gift cards, gold, crypto, wires or mailed cash is a scammer"
        }
      ],
      "source": 1
    },
    {
      "kind": "point",
      "kicker": {
        "zh": "冒充中国警方",
        "en": "Fake Chinese police"
      },
      "title": {
        "zh": "FBI：这类骗局专找在美华人",
        "en": "FBI: these schemes target the US-based Chinese community"
      },
      "body": {
        "zh": "说你涉嫌金融犯罪，不付钱就逮捕或施暴；来电号码会伪装成公安部门或中国领事馆。在 ic3.gov 选“冒充中国官员”报案。",
        "en": "They say you’re a suspect in a financial crime and threaten arrest or violence; caller ID may be spoofed as a Public Security Bureau or a Chinese consulate. Report it at ic3.gov under Chinese Authority Impersonation."
      },
      "source": 3
    },
    {
      "kind": "contacts",
      "kicker": {
        "zh": "被骗后",
        "en": "After a scam"
      },
      "title": {
        "zh": "马上打这几个电话",
        "en": "Call these right away"
      },
      "phones": [
        {
          "label": {
            "zh": "全国长者诈骗热线",
            "en": "National Elder Fraud Hotline"
          },
          "number": "833-372-8311",
          "tel": "+18333728311"
        },
        {
          "label": {
            "zh": "加州成人保护服务",
            "en": "California Adult Protective Services"
          },
          "number": "1-833-401-0832",
          "tel": "+18334010832"
        },
        {
          "label": {
            "zh": "Medicare 诈骗举报",
            "en": "Medicare fraud line"
          },
          "number": "1-800-633-4227",
          "tel": "+18006334227"
        }
      ]
    },
    {
      "kind": "safety",
      "kicker": {
        "zh": "骗子的说法",
        "en": "Scammers’ lines"
      },
      "title": {
        "zh": "听到这些，就是骗局",
        "en": "If you hear these, it’s a scam"
      },
      "items": [
        {
          "zh": "要冻结你的社安号码",
          "en": "Your Social Security number will be suspended"
        },
        {
          "zh": "先交钱才能领生活费调整",
          "en": "Pay to get your cost-of-living adjustment"
        },
        {
          "zh": "把钱转到“受保护的账户”",
          "en": "Move your money to a “protected” account"
        },
        {
          "zh": "派人上门收现金或金条",
          "en": "Someone will come to collect cash or gold"
        }
      ],
      "source": 1
    }
  ],
  "steps": [
    {
      "zh": "先挂断，用自己存的号码打回去问清，不用礼品卡、电汇或现金付款。",
      "en": "Hang up, check on a number you saved, and never pay by gift card, wire or cash."
    },
    {
      "zh": "冒充社安局、中国警方、亲人急事和 Medicare，是最常见的说法。",
      "en": "Fake Social Security, Chinese police, family emergencies and Medicare are the most common stories."
    },
    {
      "zh": "打给银行；60 岁以上打 833-372-8311，再到 IC3 和 FTC 报告。",
      "en": "Call your bank; if 60 or older, call 833-372-8311, then report to IC3 and the FTC."
    },
    {
      "zh": "长者被熟人骗钱或被忽视，打 1-833-401-0832。",
      "en": "If someone they know takes an elder’s money or neglects them, call 1-833-401-0832."
    }
  ]
};
