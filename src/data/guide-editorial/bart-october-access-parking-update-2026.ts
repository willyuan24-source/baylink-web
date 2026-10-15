import type { GuideEditorial } from './types';

// Facts from the article (BART advisory, elevator status page and West Oakland notice re-read 2026-10-14). On the 长辈与家属 hub.
export const bartOctoberEditorial: GuideEditorial = {
  "slug": "bart-october-access-parking-update-2026",
  "cover": {
    "question": {
      "zh": "坐轮椅或推婴儿车，24th St. Mission 能进站吗？",
      "en": "Wheelchair or stroller: can I get into 24th St. Mission?"
    },
    "title": {
      "zh": "街面电梯还在修：改用 16th St. Mission 或 Glen Park",
      "en": "The street elevator is still out: use 16th St. Mission or Glen Park"
    },
    "answer": {
      "zh": "出发前打 510-834-5438",
      "en": "Call 510-834-5438 first"
    },
    "line": {
      "zh": "Mission 电梯 · West Oakland 停车和接送",
      "en": "Mission elevator · West Oakland parking and pick-up"
    },
    "phone": {
      "label": {
        "zh": "BART 电梯状态",
        "en": "BART elevator status"
      },
      "number": "510-834-5438",
      "tel": "+15108345438"
    }
  },
  "keyFacts": [
    {
      "label": {
        "zh": "街面电梯预计恢复",
        "en": "Street elevator back"
      },
      "value": {
        "zh": "公告写 10 月 23 日，电梯状态页写 10 月 15 日",
        "en": "Advisory: October 23; status page: October 15"
      },
      "source": 3
    },
    {
      "label": {
        "zh": "替代车站",
        "en": "Alternatives"
      },
      "value": {
        "zh": "16th St. Mission 或 Glen Park；Muni 14、14R、49 沿 Mission Street 平行",
        "en": "16th St. Mission or Glen Park; Muni 14, 14R and 49 run along Mission Street"
      },
      "source": 1
    },
    {
      "label": {
        "zh": "West Oakland 停车",
        "en": "West Oakland parking"
      },
      "value": {
        "zh": "约 200 个先到先停日租车位，含 11 个无障碍位",
        "en": "About 200 first-come daily spaces, 11 of them accessible"
      },
      "source": 2
    },
    {
      "label": {
        "zh": "普通接送",
        "en": "Regular pick-up"
      },
      "value": {
        "zh": "Chester 南向靠 7th，或 7th 西向靠 Center；无障碍接送在站前原位置",
        "en": "Southbound Chester at 7th or westbound 7th at Center; accessible pick-up stays in front of the station"
      },
      "source": 2
    }
  ],
  "slides": [
    {
      "kind": "contacts",
      "kicker": {
        "zh": "Mission",
        "en": "Mission"
      },
      "title": {
        "zh": "两个日期不一致，出发前打电话",
        "en": "Two dates disagree: call before you go"
      },
      "body": {
        "zh": "公告写 10 月 23 日恢复，电梯状态页写 10 月 15 日。打电话查电梯是否运行。",
        "en": "The advisory says October 23 and the status page October 15. Call to check whether the elevator is running."
      },
      "phones": [
        {
          "label": {
            "zh": "BART 电梯状态",
            "en": "BART elevator status"
          },
          "number": "510-834-5438",
          "tel": "+15108345438"
        },
        {
          "label": {
            "zh": "BART 电梯热线",
            "en": "BART elevator line"
          },
          "number": "888-235-3828",
          "tel": "+18882353828"
        }
      ],
      "source": 3
    },
    {
      "kind": "checklist",
      "kicker": {
        "zh": "West Oakland",
        "en": "West Oakland"
      },
      "title": {
        "zh": "停车和接送换了地方",
        "en": "Parking and pick-up have moved"
      },
      "items": [
        {
          "zh": "移除约 240 个车位，剩约 200 个日租车位",
          "en": "About 240 spaces removed, about 200 daily spaces left"
        },
        {
          "zh": "普通接送：Chester 南向靠 7th，7th 西向靠 Center",
          "en": "Regular pick-up: southbound Chester at 7th, westbound 7th at Center"
        },
        {
          "zh": "无障碍接送仍在站前原位置",
          "en": "Accessible pick-up stays in front of the station"
        }
      ],
      "source": 2
    },
    {
      "kind": "point",
      "kicker": {
        "zh": "替代",
        "en": "Alternatives"
      },
      "title": {
        "zh": "需要电梯就换站",
        "en": "Need an elevator? Use another station"
      },
      "items": [
        {
          "zh": "16th St. Mission 或 Glen Park",
          "en": "16th St. Mission or Glen Park"
        },
        {
          "zh": "Muni 14、14R、49 沿 Mission Street 在 16th 和 24th 街之间与 BART 平行",
          "en": "Muni 14, 14R and 49 run parallel to BART on Mission Street between 16th and 24th"
        }
      ],
      "source": 1
    }
  ],
  "steps": [
    {
      "zh": "街面电梯两个预计日期不一致：出发前打 510-834-5438，需要电梯就改用 16th St. Mission 或 Glen Park。",
      "en": "The two return dates disagree: call 510-834-5438 before you go, and use 16th St. Mission or Glen Park if you need an elevator."
    },
    {
      "zh": "West Oakland 剩约 200 个日租车位；普通接送改到 Chester 和 7th，无障碍接送在站前原位置。",
      "en": "West Oakland has about 200 daily spaces left; regular pick-up moved to Chester and 7th, accessible pick-up stays in front."
    }
  ]
};
