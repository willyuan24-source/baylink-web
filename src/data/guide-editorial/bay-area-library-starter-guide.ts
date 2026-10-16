import type { GuideEditorial } from './types';
// Hand-maintained (CNT-GUIDES-3 review, 10-16): the library starter guide's own 30 秒看懂, so the card leads with getting a
// card instead of the first museum-pass sentence the automatic card would quote. Every fact is already in the article.

// Facts from the article (Oakland, Berkeley, SFPL, Marin County Free Library, San Mateo County and CuriOdyssey pages). 新手指南.
export const libraryStarterEditorial: GuideEditorial = {
  "slug": "bay-area-library-starter-guide",
  "cover": {
    "question": {
      "zh": "刚搬来湾区，图书馆卡怎么办、能用来做什么？",
      "en": "New to the Bay Area: how do I get a library card, and what can it do?"
    },
    "title": {
      "zh": "先在顺路的馆办卡；一张卡还能借博物馆票和公园通行证",
      "en": "Get a card at a branch on your route; it also borrows museum and park passes"
    },
    "answer": {
      "zh": "Oakland、Berkeley 面向加州居民",
      "en": "Oakland and Berkeley: open to California residents"
    },
    "line": {
      "zh": "办卡 · 数字课程 · 博物馆票 · 公园通行证 · 活动",
      "en": "Cards · online courses · museum passes · park passes · events"
    }
  },
  "keyFacts": [
    {
      "label": {
        "zh": "Oakland 办卡",
        "en": "Oakland card"
      },
      "value": {
        "zh": "面向加州居民；线上申请后，借实体书前还要完成身份核验",
        "en": "Open to California residents; after applying online, verify your identity before borrowing physical books"
      },
      "source": 1
    },
    {
      "label": {
        "zh": "Berkeley 办卡",
        "en": "Berkeley card"
      },
      "value": {
        "zh": "面向加州居民，本人到馆领卡；缺地址证明可看 Easy Access Card",
        "en": "Open to California residents; pick up the card in person; no proof of address: see the Easy Access Card"
      },
      "source": 2
    },
    {
      "label": {
        "zh": "博物馆票",
        "en": "Museum passes"
      },
      "value": {
        "zh": "旧金山居民用 SFPL Discover & Go 预约，同时最多 2 个",
        "en": "SF residents book through SFPL Discover & Go, up to 2 at a time"
      },
      "source": 5
    },
    {
      "label": {
        "zh": "公园通行证",
        "en": "Park passes"
      },
      "value": {
        "zh": "Marin 借期 1 周；San Mateo County 县图书馆借期 3 周",
        "en": "Marin: 1 week; San Mateo County libraries: 3 weeks"
      },
      "source": 7
    }
  ],
  "slides": [
    {
      "kind": "point",
      "kicker": {
        "zh": "先分清",
        "en": "Know first"
      },
      "title": {
        "zh": "湾区没有统一的借书系统",
        "en": "The Bay Area has no single library system"
      },
      "body": {
        "zh": "申请、领卡、续期和数字权限各馆不一；按你要办的那一馆的办卡页准备材料。",
        "en": "Applying, pickup, renewal and digital access differ from library to library; prepare from the card page of the library you’re joining."
      },
      "source": 1
    },
    {
      "kind": "checklist",
      "kicker": {
        "zh": "办卡",
        "en": "Getting a card"
      },
      "title": {
        "zh": "办卡前准备",
        "en": "Before you apply"
      },
      "items": [
        {
          "zh": "打开所选图书馆的办卡页，看适用哪种卡",
          "en": "Open the library’s card page and see which card fits you"
        },
        {
          "zh": "按该馆清单准备证件和地址材料",
          "en": "Bring the ID and address documents on its list"
        },
        {
          "zh": "记下卡号、登录入口和核验下一步",
          "en": "Note your card number, login link and next verification step"
        },
        {
          "zh": "卡号、PIN 不发在公开帖子里",
          "en": "Never post your card number or PIN publicly"
        }
      ],
      "source": 1
    },
    {
      "kind": "compare",
      "kicker": {
        "zh": "用卡借票",
        "en": "Passes"
      },
      "title": {
        "zh": "博物馆票和公园通行证",
        "en": "Museum and park passes"
      },
      "items": [
        {
          "zh": "旧金山：SFPL Discover & Go，同时最多 2 个预约，最多提前 3 个月",
          "en": "San Francisco: SFPL Discover & Go, up to 2 reservations, up to 3 months ahead"
        },
        {
          "zh": "Marin：Discover & Go 要年满 14 岁、住在 Marin 县",
          "en": "Marin: Discover & Go for Marin County residents 14 and older"
        },
        {
          "zh": "Marin 公园通行证：借期 1 周，没人排队可续借两次",
          "en": "Marin park passes: 1 week, renewable twice if no one is waiting"
        },
        {
          "zh": "San Mateo County：县公园通行证借期 3 周",
          "en": "San Mateo County: county park pass for 3 weeks"
        }
      ],
      "source": 5
    },
    {
      "kind": "point",
      "kicker": {
        "zh": "出门前再打印",
        "en": "Print last"
      },
      "title": {
        "zh": "Discover & Go 的票打印后取消不了",
        "en": "A printed Discover & Go pass can’t be canceled"
      },
      "body": {
        "zh": "票一打印或下载就取消不了，出门前再打印。",
        "en": "Once a pass is printed or downloaded it can’t be canceled, so print it just before you go."
      },
      "source": 5
    },
    {
      "kind": "checklist",
      "kicker": {
        "zh": "数字资源",
        "en": "Online learning"
      },
      "title": {
        "zh": "从图书馆入口进入",
        "en": "Start from the library’s link"
      },
      "items": [
        {
          "zh": "SFPL eLearning 按主题列出语言学习和职业技能资源",
          "en": "SFPL eLearning lists language and career resources by topic"
        },
        {
          "zh": "部分课程只能在加州境内访问",
          "en": "Some courses work only inside California"
        },
        {
          "zh": "被要求付费，先返回馆方入口",
          "en": "Asked to pay? Go back to the library’s link"
        }
      ],
      "source": 3
    }
  ],
  "steps": [
    {
      "zh": "先挑顺路的分馆；各馆的办卡规则不一样。",
      "en": "Pick a branch on your usual route; each library has its own card rules."
    },
    {
      "zh": "Oakland 和 Berkeley 面向加州居民：Oakland 线上申请后要核验身份，Berkeley 本人到馆领卡。",
      "en": "Oakland and Berkeley serve California residents: Oakland verifies your identity after you apply online; Berkeley cards are picked up in person."
    },
    {
      "zh": "数字课程从馆方入口进入；被要求付费，先退回入口。",
      "en": "Open online courses from the library’s link; if asked to pay, go back to it."
    },
    {
      "zh": "旧金山用 SFPL Discover & Go 订博物馆票；Marin 和 San Mateo County 的图书馆借公园通行证。",
      "en": "San Francisco: museum passes through SFPL Discover & Go; Marin and San Mateo County libraries lend park passes."
    },
    {
      "zh": "先选日期、分馆和年龄，再看单场要不要报名、有没有候补。",
      "en": "Pick a date, branch and age range, then see whether the event needs registration or has a waitlist."
    },
    {
      "zh": "自习、开会、打印和电脑预约，按到访馆的规定。",
      "en": "Study space, meetings, printing and computer booking follow the branch’s own rules."
    },
    {
      "zh": "留一个固定的到馆时间，一次完成一件事。",
      "en": "Set a regular library visit and do one thing each time."
    }
  ]
};
