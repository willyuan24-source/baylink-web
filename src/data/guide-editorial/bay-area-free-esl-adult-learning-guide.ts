import type { GuideEditorial } from './types';

// Facts from the article (CCSF, Oakland, San Mateo, Santa Clara and College of Marin pages read 2026-09-27). A 日常办事 guide.
export const freeEslEditorial: GuideEditorial = {
  "slug": "bay-area-free-esl-adult-learning-guide",
  "cover": {
    "question": {
      "zh": "想免费学英语，从哪里报名？",
      "en": "Free English classes: where do I sign up?"
    },
    "title": {
      "zh": "从成人学校和社区学院开始，能每周稳定到场最重要",
      "en": "Start with adult schools and community colleges; showing up every week matters most"
    },
    "answer": {
      "zh": "先选一所，按地区找课",
      "en": "Pick one school in your area"
    },
    "line": {
      "zh": "旧金山 · 东湾 · 半岛 · 南湾 · 北湾",
      "en": "San Francisco · East Bay · Peninsula · South Bay · North Bay"
    }
  },
  "keyFacts": [
    {
      "label": {
        "zh": "旧金山",
        "en": "San Francisco"
      },
      "value": {
        "zh": "CCSF 非学分 ESL：先申请入学和分级，再选校区或线上班",
        "en": "CCSF noncredit ESL: apply and take placement, then choose a campus or online class"
      },
      "source": 1
    },
    {
      "label": {
        "zh": "南湾",
        "en": "South Bay"
      },
      "value": {
        "zh": "Santa Clara Adult Education 有免费英语课，注册时安排说明会和分级",
        "en": "Santa Clara Adult Education offers free English classes with orientation and placement"
      },
      "source": 5
    },
    {
      "label": {
        "zh": "Noncredit",
        "en": "Noncredit"
      },
      "value": {
        "zh": "非学分课程，也要报名，不会自动换成学位学分",
        "en": "Not for credit; still needs enrollment and doesn’t convert to degree credit"
      }
    },
    {
      "label": {
        "zh": "免费以外",
        "en": "Beyond tuition"
      },
      "value": {
        "zh": "问书本、材料、停车和交通费",
        "en": "Ask about books, materials, parking and transport costs"
      }
    }
  ],
  "slides": [
    {
      "kind": "point",
      "kicker": {
        "zh": "先分清",
        "en": "Know the difference"
      },
      "title": {
        "zh": "Noncredit 和 credit 不一样",
        "en": "Noncredit and credit are different"
      },
      "body": {
        "zh": "Noncredit 是非学分课程：也要报名，不是随到随上；credit 课程可用于学业衔接，能否计入具体项目要问辅导员。",
        "en": "Noncredit courses don’t award credit and still need enrollment; credit courses can support further study, so ask a counselor how they count."
      }
    },
    {
      "kind": "checklist",
      "kicker": {
        "zh": "按地区",
        "en": "By area"
      },
      "title": {
        "zh": "五个地区的入口",
        "en": "Where to start in five areas"
      },
      "items": [
        {
          "zh": "旧金山：CCSF Noncredit ESL",
          "en": "San Francisco: CCSF Noncredit ESL"
        },
        {
          "zh": "东湾：Oakland Adult & Career Education",
          "en": "East Bay: Oakland Adult & Career Education"
        },
        {
          "zh": "半岛：San Mateo Adult & Career Education",
          "en": "Peninsula: San Mateo Adult & Career Education"
        },
        {
          "zh": "南湾：Santa Clara Adult Education",
          "en": "South Bay: Santa Clara Adult Education"
        },
        {
          "zh": "北湾：College of Marin",
          "en": "North Bay: College of Marin"
        }
      ]
    },
    {
      "kind": "checklist",
      "kicker": {
        "zh": "报名",
        "en": "Enrolling"
      },
      "title": {
        "zh": "拿到座位之前",
        "en": "Until you have a seat"
      },
      "items": [
        {
          "zh": "完成分级或说明会，再注册具体班级",
          "en": "Finish placement or orientation, then enroll in a class"
        },
        {
          "zh": "满班就问候补和下一轮招生",
          "en": "If full, ask about the waitlist and next intake"
        },
        {
          "zh": "保存注册结果，记下开课日和教室",
          "en": "Save your enrollment and note the start date and room"
        }
      ]
    }
  ],
  "steps": [
    {
      "zh": "Noncredit 是非学分课程，也要报名；各校的资格单独问。",
      "en": "Noncredit courses still need enrollment; ask each school about eligibility."
    },
    {
      "zh": "按地区找课：旧金山 CCSF，东湾 Oakland，半岛 San Mateo，南湾 Santa Clara，北湾 College of Marin。",
      "en": "By area: CCSF in San Francisco, Oakland in the East Bay, San Mateo on the Peninsula, Santa Clara in the South Bay, College of Marin in the North Bay."
    },
    {
      "zh": "完成分级或说明会再注册班级，满班就问候补。",
      "en": "Finish placement or orientation before enrolling; if full, ask about the waitlist."
    }
  ]
};
