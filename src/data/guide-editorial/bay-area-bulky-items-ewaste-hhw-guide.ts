import type { GuideEditorial } from './types';

// Facts from the article (Recology, county HHW and StopWaste pages read 2026-09-27). A 日常办事 guide.
export const bulkyItemsEditorial: GuideEditorial = {
  "slug": "bay-area-bulky-items-ewaste-hhw-guide",
  "cover": {
    "question": {
      "zh": "旧沙发、旧电脑、剩油漆，能一起扔吗？",
      "en": "Old sofa, old computer, leftover paint: one trip?"
    },
    "title": {
      "zh": "分成三类，各找各的入口",
      "en": "Three kinds of waste, three different routes"
    },
    "answer": {
      "zh": "先问清受理，再搬运",
      "en": "Get acceptance before you haul"
    },
    "line": {
      "zh": "大件 · 电子回收 · 家庭危险废物",
      "en": "Bulky items · e-waste · household hazardous waste"
    }
  },
  "keyFacts": [
    {
      "label": {
        "zh": "家具与床垫",
        "en": "Furniture and mattresses"
      },
      "value": {
        "zh": "找垃圾账单上的清运商，问清预约、件数、费用和摆放时段",
        "en": "Ask the hauler on your trash bill about booking, limits, fees and set-out times"
      }
    },
    {
      "label": {
        "zh": "电子设备",
        "en": "Electronics"
      },
      "value": {
        "zh": "按具体物品查电子回收清单",
        "en": "Check the exact item on the e-waste list"
      }
    },
    {
      "label": {
        "zh": "油漆、清洁剂",
        "en": "Paint and cleaners"
      },
      "value": {
        "zh": "走家庭危险废物（HHW）项目，先查接受范围",
        "en": "Household hazardous waste (HHW) programs; check what they accept"
      }
    },
    {
      "label": {
        "zh": "旧金山",
        "en": "San Francisco"
      },
      "value": {
        "zh": "Recology 大件项目按有效住宅账户及住房类型核资格",
        "en": "Recology bulky pickup depends on an active residential account and housing type"
      },
      "source": 1
    }
  ],
  "slides": [
    {
      "kind": "checklist",
      "kicker": {
        "zh": "三类",
        "en": "Three kinds"
      },
      "title": {
        "zh": "先分类，再预约",
        "en": "Sort first, then book"
      },
      "items": [
        {
          "zh": "家具与床垫：城市清运商",
          "en": "Furniture and mattresses: the city hauler"
        },
        {
          "zh": "电脑与电子设备：电子回收",
          "en": "Computers and electronics: e-waste recycling"
        },
        {
          "zh": "油漆、清洁剂：家庭危险废物项目",
          "en": "Paint and cleaners: household hazardous waste"
        }
      ]
    },
    {
      "kind": "point",
      "kicker": {
        "zh": "按地区",
        "en": "By area"
      },
      "title": {
        "zh": "各县的 HHW 入口不同",
        "en": "Each county has its own HHW route"
      },
      "items": [
        {
          "zh": "半岛：San Mateo County HHW 先预约",
          "en": "Peninsula: book San Mateo County HHW"
        },
        {
          "zh": "南湾：Santa Clara County HHW 要预约，会查居住证明",
          "en": "South Bay: Santa Clara County HHW needs an appointment and checks residency"
        },
        {
          "zh": "东湾：Alameda County 居民从 StopWaste 查设施",
          "en": "East Bay: Alameda County residents start at StopWaste"
        },
        {
          "zh": "北湾：Marin HHW；Novato 另有本地设施",
          "en": "North Bay: Marin HHW; Novato has its own facility"
        }
      ]
    },
    {
      "kind": "safety",
      "kicker": {
        "zh": "搬运前",
        "en": "Before hauling"
      },
      "title": {
        "zh": "对方答复之前，东西先别放到路边",
        "en": "Keep items off the curb until they answer"
      },
      "items": [
        {
          "zh": "拍清物品外观，记下数量和尺寸",
          "en": "Photograph items and note quantities and sizes"
        },
        {
          "zh": "商业、承包商或代收物品要另查",
          "en": "Business, contractor and collected waste are separate"
        },
        {
          "zh": "按预约回信里的地址前往",
          "en": "Go to the address in your booking reply"
        }
      ]
    }
  ],
  "steps": [
    {
      "zh": "家具、电子设备和危险废物分开处理，对方答复前别放到路边。",
      "en": "Handle furniture, electronics and hazardous waste separately; nothing at the curb before you hear back."
    },
    {
      "zh": "按居住县找官方入口：旧金山 Recology，半岛、南湾、东湾、北湾各有 HHW 项目。",
      "en": "Use your county’s route: Recology in San Francisco, HHW programs on the Peninsula, South Bay, East Bay and North Bay."
    },
    {
      "zh": "先拍照、记数量、问受理和收费，再预约搬运。",
      "en": "Photograph, count, ask about acceptance and fees, then book."
    }
  ]
};
