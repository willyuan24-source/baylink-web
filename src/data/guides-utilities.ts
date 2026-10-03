import type { Guide } from './guides';
import type { UtilityCity } from './utility-types';
import eastSf from './utilities-east-sf.json';
import peninsulaSouth from './utilities-peninsula-south.json';
import north from './utilities-north.json';
import telecom from './utilities-telecom.json';

const order = ['San Francisco', 'San Mateo', 'Santa Clara', 'Alameda', 'Contra Costa', 'Marin', 'Napa', 'Sonoma', 'Solano'];
export const UTILITY_CITIES: UtilityCity[] = [...eastSf, ...peninsulaSouth, ...north].map(city => ({...city,county:city.county.replace(/ County$/,'')})).filter(city => !city.city.startsWith('Unincorporated ')).sort((a,b) => order.indexOf(a.county) - order.indexOf(b.county) || a.city.localeCompare(b.city));

export const utilityGuides: Guide[] = [{
  "slug": "bay-area-city-utilities-internet-phone-directory",
  "title": "湾区 101 城水电、垃圾、宽带与手机联络大全",
  "subtitle": "按城市找负责单位，把开户、搬家转户和停用安排清楚",
  "summary": "覆盖湾区九县 101 个建制城市和镇的住宅供水、电力、垃圾服务入口，并汇总主要宽带与手机公司的官方客服、地址查询及搬家办理链接。",
  "category": "newcomer",
  "categoryLabel": "搬家与公用事业",
  "emoji": "🏠",
  "audience": [
    "准备搬家、开户或停用服务的人",
    "新居民、租客与房屋住户"
  ],
  "tags": [
    "日常办事",
    "水电",
    "供水",
    "垃圾回收",
    "宽带",
    "手机通讯",
    "搬家转户",
    "客服电话",
    "PG&E",
    "101 cities"
  ],
  "priority": "P0",
  "featuredOnHome": true,
  "recommendedForCategories": [
    "moving",
    "rent",
    "other"
  ],
  "readMinutes": 12,
  "updatedAt": "2026-10-02",
  "sourceNote": "官方网页核验于 2026-10-02。城市目录用于定位负责机构；供水和垃圾边界、住宅类型、房东统一账单及实际可安装宽带都须按完整住址确认。电话为各来源公布的客服，不代表全天接听。本文不替读者开户或提交个人资料。",
  "sources": [
    {
      "title": "AT&T Prepaid",
      "url": "https://www.att.com/support/prepaid/",
      "description": "预付费客服与后付费客服使用不同专线。"
    },
    {
      "title": "Verizon Prepaid",
      "url": "https://www.verizon.com/support/prepaid-billing-payment-faqs/",
      "description": "预付费账户、账单与付款帮助。"
    },
    {
      "title": "CPUC：社区电力与配电公司的分工",
      "url": "https://www.cpuc.ca.gov/consumer-support/consumer-programs-and-services/electrical-energy-and-energy-efficiency/community-choice-aggregation-and-direct-access-/consumer-information-on-ccas---frequently-asked-questions",
      "description": "CCA 采购电力，配电公司仍负责输配电、抄表、账单及停电处理。"
    },
    {
      "title": "Redwood City：Peninsula Clean Energy 更名为 WestLight Energy",
      "url": "https://www.redwoodcity.org/departments/public-works/environmental-initiatives/energy/peninsula-clean-energy",
      "description": "2026-07-01 起使用新名称；保留旧名称方便对照账单和旧资料。"
    },
    {
      "title": "ABAG：湾区九县与 101 个城市和镇",
      "url": "https://www.abag.ca.gov/about-abag/what-we-do/how-we-govern",
      "description": "本文城市覆盖范围；不将湾区以外城市或县内非建制社区算入 101 城。"
    },
    {
      "title": "PG&E：开户、停用和搬家转移",
      "url": "https://www.pge.com/en/account/service-requests/start-stop-transfer-service.html",
      "description": "住宅开户及跨地址迁移；更换账户持有人与搬家并非相同操作。"
    },
    {
      "title": "加州公用事业委员会：宽带地址地图",
      "url": "https://www.broadbandmap.ca.gov/",
      "description": "可按地址查看申报覆盖。核验时页面所列资料截至 2024-12-31，地图结果需要向运营商再次确认。"
    },
    {
      "title": "Mint：转号前保持旧服务有效",
      "url": "https://www.mintmobile.com/help/should-i-cancel-existing-service-before-i-transfer-number-to-mint-mobile/",
      "description": "转入号码需要原运营商服务仍有效；转号前向新运营商确认具体步骤。"
    },
    {
      "title": "PG&E：官方联系方式",
      "url": "https://www.pge.com/en/contact-us.html",
      "description": "客服、服务请求和紧急情况入口分开列出。"
    },
    {
      "title": "Etheric Networks",
      "url": "https://ethericnetworks.com/support/",
      "description": "官方客服与办理入口；城市卡片中的机构链接另列在对应城市内。"
    },
    {
      "title": "Starlink",
      "url": "https://starlink.com/support",
      "description": "官方客服与办理入口；城市卡片中的机构链接另列在对应城市内。"
    },
    {
      "title": "Xfinity / Comcast",
      "url": "https://www.xfinity.com/support/contact-us",
      "description": "官方客服与办理入口；城市卡片中的机构链接另列在对应城市内。"
    },
    {
      "title": "AT&T Internet / Fiber / Internet Air",
      "url": "https://www.att.com/support/",
      "description": "官方客服与办理入口；城市卡片中的机构链接另列在对应城市内。"
    },
    {
      "title": "Sonic",
      "url": "https://www.sonic.com/support",
      "description": "官方客服与办理入口；城市卡片中的机构链接另列在对应城市内。"
    },
    {
      "title": "Astound Broadband",
      "url": "https://www.astound.com/contact-us/",
      "description": "官方客服与办理入口；城市卡片中的机构链接另列在对应城市内。"
    },
    {
      "title": "T-Mobile 5G Home Internet",
      "url": "https://www.t-mobile.com/contact-us",
      "description": "官方客服与办理入口；城市卡片中的机构链接另列在对应城市内。"
    },
    {
      "title": "Verizon Home Internet",
      "url": "https://www.verizon.com/support/contact-us/",
      "description": "官方客服与办理入口；城市卡片中的机构链接另列在对应城市内。"
    },
    {
      "title": "Sail Internet",
      "url": "https://sailinternet.com/res-support/",
      "description": "官方客服与办理入口；城市卡片中的机构链接另列在对应城市内。"
    },
    {
      "title": "Monkeybrains",
      "url": "https://www.monkeybrains.net/",
      "description": "官方客服与办理入口；城市卡片中的机构链接另列在对应城市内。"
    },
    {
      "title": "Metro by T-Mobile",
      "url": "https://www.metrobyt-mobile.com/contact-us",
      "description": "官方客服与办理入口；城市卡片中的机构链接另列在对应城市内。"
    },
    {
      "title": "Cricket Wireless",
      "url": "https://www.cricketwireless.com/contactus",
      "description": "官方客服与办理入口；城市卡片中的机构链接另列在对应城市内。"
    },
    {
      "title": "Mint Mobile",
      "url": "https://www.mintmobile.com/help/how-do-i-contact-mint-mobile/",
      "description": "官方客服与办理入口；城市卡片中的机构链接另列在对应城市内。"
    },
    {
      "title": "Visible",
      "url": "https://www.visible.com/m/help/contact-us.html",
      "description": "官方客服与办理入口；城市卡片中的机构链接另列在对应城市内。"
    },
    {
      "title": "Google Fi Wireless",
      "url": "https://fi.google.com/about/support-simple",
      "description": "官方客服与办理入口；城市卡片中的机构链接另列在对应城市内。"
    },
    {
      "title": "Boost Mobile",
      "url": "https://help.boostmobile.com/docs/contact-our-support-teams",
      "description": "官方客服与办理入口；城市卡片中的机构链接另列在对应城市内。"
    },
    {
      "title": "US Mobile",
      "url": "https://www.usmobile.com/help/docs/troubleshooting-and-setup/contact-us",
      "description": "官方客服与办理入口；城市卡片中的机构链接另列在对应城市内。"
    },
    {
      "title": "Consumer Cellular",
      "url": "https://www.consumercellular.com/contact",
      "description": "官方客服与办理入口；城市卡片中的机构链接另列在对应城市内。"
    }
  ],
  "blocks": [
    {
      "type": "paragraph",
      "text": "搬家先查负责机构，再安排生效日期。下方按县归类，覆盖 San Francisco、San Mateo、Santa Clara、Alameda、Contra Costa、Marin、Napa、Sonoma 和 Solano 的 101 个建制城市和镇；可搜英文城市名、常用中文名或服务商。"
    },
    {
      "type": "tip",
      "title": "租客先确认：哪些由房东或物业统一开户",
      "text": "水费、污水费或垃圾费可能包含在租金、HOA 或物业账单中。先看租约并问物业是否需要你单独开户；即使城市有服务商，也不表示租客一定能直接改账户。这里的水是住宅供水入口，污水收费可能由另一机构负责。"
    },
    {
      "type": "heading",
      "text": "按城市找水、电与垃圾服务"
    },
    {
      "type": "utility-directory",
      "title": "城市联络目录",
      "text": "展开城市查看客服、办理官网和服务区提醒。电话号码可在手机上点击拨打；部分电话含分机时保留原文。每个城市另有宽带地址查询和下方通讯联络表的入口。",
      "cities": UTILITY_CITIES
    },
    {
      "type": "heading",
      "text": "Internet：先查地址，再联系运营商"
    },
    {
      "type": "paragraph",
      "text": "以下是可逐一查询的主要宽带公司，不表示每家公司覆盖全部城市或每栋楼。先查加州宽带地图，再把完整街道地址和房号输入公司官网。地图有数据时差；最终以公司确认能安装的产品、端口和预约为准。也要问物业是否已有楼宇统一网络或安装许可要求。"
    },
    {
      "type": "contact-directory",
      "title": "宽带客服与搬家入口",
      "text": "光纤、有线与固定无线的可用性分别查。若更换公司，先确认新网络能用，再安排旧服务结束，并保留设备归还凭证。",
      "anchor": "utility-internet-contacts",
      "contacts": telecom.internet
    },
    {
      "type": "heading",
      "text": "手机通讯：各大运营商联系表"
    },
    {
      "type": "contact-directory",
      "title": "手机账号、账单与转号帮助",
      "text": "手机客服通常不按湾区城市划分。联系与你签约和出账单的品牌；使用某家底层网络，不代表可以找该网络品牌处理另一家公司的账单。",
      "anchor": "utility-mobile-contacts",
      "contacts": telecom.mobile
    },
    {
      "type": "heading",
      "text": "真正改好水电：搬家办理清单"
    },
    {
      "type": "checklist",
      "items": [
        "核对新旧完整地址、房号、入住／交钥匙日期，以及水电垃圾分别由谁开户。",
        "准备账户持有人姓名、联系电话、邮箱、旧账号和机构要求的身份或租住材料；仅在官方安全渠道提交。",
        "向每家机构明确说 Start service、Stop service 或 Move/Transfer service，分别确认旧址停用日和新址启用日。",
        "问清开户费／押金、是否需预约入户、房屋原来已断水断电时的恢复流程，以及确认编号。",
        "垃圾服务确认住宅类型、收集日、垃圾桶是否随房保留，以及账单寄送地址。",
        "入住后实测服务；迁出后核对最后账单、退款和自动扣款。网页显示申请已提交，还要保存机构确认的生效日期。"
      ]
    },
    {
      "type": "heading",
      "text": "PG&E、市营电力和社区电力分别找谁"
    },
    {
      "type": "paragraph",
      "text": "多数城市的电力接入与搬家开户找 PG&E；Alameda、Palo Alto、Santa Clara 和 Healdsburg 则有市营电力，按城市卡片办理。PG&E 的住宅客服是 877-660-6789。若账单同时出现 Ava Community Energy、MCE、WestLight Energy（原 Peninsula Clean Energy）、San José Clean Energy、Silicon Valley Clean Energy、Sonoma Clean Power 或 CleanPowerSF，它们通常涉及发电供应方案；停送电、线路和开户应先找实际配电服务方。天然气服务也要单独确认，不能因为电力是市营就推断燃气相同。"
    },
    {
      "type": "link",
      "title": "PG&E 官方开户、停用与转移服务",
      "text": "PG&E 说明一般不能直接把账户换成另一人的名字：通常是旧持有人停用、新持有人以自己的资料开户，并协调同一天生效；特殊情况依官方流程。",
      "url": "https://www.pge.com/en/account/service-requests/start-stop-transfer-service.html"
    },
    {
      "type": "heading",
      "text": "住在非建制社区或城市边界怎么办"
    },
    {
      "type": "paragraph",
      "text": "Castro Valley、San Lorenzo、Alamo、Kensington、El Sobrante、North Fair Oaks、Marin City 等社区不计入上面的 101 个建制城市。邮寄地址写某座城市，也不保证位于该市服务范围。先问房东／物业现有账单单位，再按所在县、供水区和垃圾特许服务区核对；不要直接套用最近城市的号码。私人水井、化粪池、特殊园区和商业物业不适用普通住宅分工。"
    },
    {
      "type": "heading",
      "text": "联系时可以直接照着问"
    },
    {
      "type": "template",
      "title": "开户／搬家询问模板",
      "text": "你好，我要在 [日期] 搬入／搬离 [完整地址及房号]。请确认该地址是否属于你们的住宅服务区，以及应由租客还是房东开户。\n我要办理 [开户／停用／搬家转移]，旧址是 [地址]。请确认生效日期、所需材料、费用或押金、是否需要到场，以及办理完成的确认编号。\n如你们不负责这处地址，请问应该联系哪个机构或查看哪张服务区地图？"
    },
    {
      "type": "link",
      "title": "继续看：手机、银行与首张账单",
      "text": "设备兼容、转号、首张账单与取消争议的具体流程。",
      "url": "/guides/bay-area-phone-bank-first-bill-guide"
    },
    {
      "type": "link",
      "title": "继续看：水电、宽带与手机年度复核",
      "text": "服务接通后，再比较全年成本和适用的减免项目。",
      "url": "/guides/bay-area-household-bills-annual-review-2026"
    }
  ]
}];
