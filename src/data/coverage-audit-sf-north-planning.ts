import type { PlanningFacts, PlanningSchedule } from '../lib/planner';

/** Published event windows checked 2026-09-29; not live availability or bookings. */
export const COVERAGE_AUDIT_SF_NORTH_PLANNING: Record<string, PlanningFacts> = {
  "sf-potrero-hill-festival-oct17-2026": { setting: 'outdoor', admissionUsd: null, reservation: 'unknown', programTimeUnconfirmed: true },
  "sf-sunday-streets-excelsior-oct18-2026": {
    "setting": "outdoor",
    "admissionUsd": 0,
    "reservation": "unknown"
  },
  "sausalito-toast-street-fair-oct17-2026": {
    "setting": "outdoor",
    "admissionUsd": 0,
    "reservation": "unknown"
  },
  "sf-nexus-party-oct1-2026": {
    "setting": "indoor",
    "admissionUsd": 25,
    "reservation": "required"
  },
  "sf-fall-show-oct15-18-2026": {
    "setting": "indoor",
    "admissionUsd": null,
    "reservation": "required"
  },
  "sf-inner-sunset-flea-oct11-2026": {
    "setting": "outdoor",
    "admissionUsd": null,
    "reservation": "unknown"
  }
};

/** Windows are exact event dates. Visiting part of a window is an editable plan. */
export const COVERAGE_AUDIT_SF_NORTH_SCHEDULES: Record<string, PlanningSchedule> = {
  "sf-potrero-hill-festival-oct17-2026": {
    sourceUrl: 'https://potrerofestival.com/', verifiedAt: '2026-09-29', validFrom: '2026-10-17', validThrough: '2026-10-17',
    note: "已核 10/17 10:00 开始，但主办方首页列 17:00 结束，同站 FAQ 列 16:00；完整时段待核，不据此保证结束时间或生成已确认的访问窗口。入场费未知，餐饮和商品另购。",
  },
  "sf-sunday-streets-excelsior-oct18-2026": {
    "sourceUrl": "https://sfrecpark.org/Calendar.aspx?EID=10817",
    "verifiedAt": "2026-09-29",
    "validFrom": "2026-10-18",
    "validThrough": "2026-10-18",
    "dates": {
      "2026-10-18": [
        {
          "open": "11:00",
          "close": "16:00"
        }
      ]
    },
    "note": "11:00–16:00 为免费街区活动窗口；具体设备、轮候与现场项目另核，餐饮和购物另付。"
  },
  "sausalito-toast-street-fair-oct17-2026": {
    "sourceUrl": "https://www.sausalito.gov/departments/parks-and-recreation/events/a-toast-to-sausalito-beer-wine-spirits-festival",
    "verifiedAt": "2026-09-29",
    "validFrom": "2026-10-17",
    "validThrough": "2026-10-17",
    "dates": {
      "2026-10-17": [
        {
          "open": "13:00",
          "close": "17:00"
        }
      ]
    },
    "note": "13:00–17:00 为街区节窗口，入场免费；规划只计免费逛街区，品饮手环与餐饮另付。手环早鸟 $40 至 9/30，常规 $45、当天 $55，另加手续费；2025 节目不可当作 2026 承诺。"
  },
  "sf-nexus-party-oct1-2026": {
    "sourceUrl": "https://www.moadsf.org/event/moad-ybca-present-the-nexus-party-the-official-party-of-sf-bay-area-black-art-week",
    "verifiedAt": "2026-09-29",
    "validFrom": "2026-10-01",
    "validThrough": "2026-10-01",
    "dates": {
      "2026-10-01": [
        {
          "open": "20:00",
          "close": "23:30"
        }
      ]
    },
    "note": "20:00–23:30 为 YBCA 单场派对；公众票 $25，会员 $20 须登录验证。规划按公众票计算，附加费、剩余票量及年龄条件待核，不含其他艺术周活动。"
  },
  "sf-fall-show-oct15-18-2026": {
    "sourceUrl": "https://sffallshow.org/about/",
    "verifiedAt": "2026-09-29",
    "validFrom": "2026-10-15",
    "validThrough": "2026-10-18",
    "dates": {
      "2026-10-15": [
        {
          "open": "10:30",
          "close": "19:00"
        }
      ],
      "2026-10-16": [
        {
          "open": "10:30",
          "close": "19:00"
        }
      ],
      "2026-10-17": [
        {
          "open": "10:30",
          "close": "19:00"
        }
      ],
      "2026-10-18": [
        {
          "open": "11:00",
          "close": "17:00"
        }
      ]
    },
    "note": "10/15–10/17 开放 10:30–19:00；10/18 为 11:00–17:00。本条排除 10/14 晚宴。门票金额待核，讲座须另有对应票，停车另付；不采用售票页顶部的 10:00。"
  },
  "sf-inner-sunset-flea-oct11-2026": {
    "sourceUrl": "https://sunsetmercantilesf.com/innersunsetflea/",
    "verifiedAt": "2026-09-29",
    "validFrom": "2026-10-11",
    "validThrough": "2026-10-11",
    "dates": {
      "2026-10-11": [
        {
          "open": "10:00",
          "close": "16:00"
        }
      ]
    },
    "note": "10/11 的市集窗口为 10:00–16:00。主办方列免费亲子活动，入场费未单列确认；食品、二手商品和手作另购，不保证免费糖果或其他赠品。"
  }
};
