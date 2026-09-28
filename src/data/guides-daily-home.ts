import type { Guide } from './guides';

const base = {
  priority: 'P1' as const, featuredOnHome: false, recommendedForCategories: ['other', 'service'],
  readMinutes: 5, updatedAt: '2026-09-27',
  sourceNote: '官方资料核验于 2026 年 9 月 27 日。本文帮助查找办理入口；资格、受理物品、预约、收费及实时状态请以主管机构最新页面为准。',
};
const cta = { type: 'cta' as const, title: '继续完善本地生活清单', text: '把搬家、公共服务和日常办事一起安排。', primaryLabel: '查看更多生活攻略', primaryAction: 'guides' as const };

export const dailyHomeGuides: Guide[] = [
  {
    ...base, slug: 'bay-area-bulky-items-ewaste-hhw-guide', category: 'service', categoryLabel: '生活服务',
    title: '旧家具、电子垃圾、剩余油漆：湾区清理前先找对入口',
    subtitle: '按物品、城市清运商与县居民资格分开办理',
    summary: '区分大件预约、电子回收和家庭危险废物，按地区查受理范围，避免搬到路边才发现不能收。',
    emoji: '♻️', audience: ['准备搬家', '整理家中杂物'], tags: ['日常办事', '大件清运', '电子回收', '家庭危险废物', '本地办事'],
    sources: [
      { title: 'Recology SF · Bulky Item Collection', url: 'https://www.recology.com/recology-san-francisco/residential-curbside-collection/', description: '核对住宅账户、住房类型与预约条件。' },
      { title: 'Recology SF · Household Hazardous Waste', url: 'https://www.recology.com/recology-san-francisco/hazardous-waste/', description: '危险废物与大件清运分开确认。' },
      { title: 'San Mateo County Health · HHW', url: 'https://www.smchealth.org/hhw', description: '县居民送交与预约入口。' },
      { title: 'Santa Clara County · HHW', url: 'https://hhw.santaclaracounty.gov/drop-household-waste', description: '查看预约、居住证明及 Palo Alto 例外。' },
      { title: 'StopWaste · Recycling & Disposal', url: 'https://www.stopwaste.org/recycling-disposal', description: 'Alameda County 居民设施与受理查询。' },
      { title: 'Marin Household Hazardous Waste Facility', url: 'https://marinhhw.com/', description: '核对居民服务、接受物品与开放日期。' },
      { title: 'Novato Sanitary District · HHW', url: 'https://novatosan.com/services/household-hazardous-waste-program/', description: 'Novato 另查本地设施与日期。' },
    ],
    blocks: [
      { type: 'paragraph', text: '搬家清理最容易卡住的，是把沙发、旧电脑和剩余油漆当成同一车垃圾。先写物品清单，再找对应服务；县级家庭危险废物项目不等于所在城市的大件清运。邻居用过的免费次数，也未必适用于你的住宅账户。' },
      { type: 'heading', text: '先分三类，再预约搬运' },
      { type: 'list', items: [
        '家具与床垫：先找垃圾账单上的清运商，确认租客能否直接预约、件数、费用和摆放时段。未获确认前不要放到路边。',
        '电脑与电子设备：按具体物品查电子回收清单；小电器、电视、电池的去处可能不同，不能直接套用普通回收桶规则。',
        '油漆、清洁剂等家庭危险废物：先核对接受范围。标签不明、泄漏或损坏的物品先联系项目人员，取得指导后再安排送交。',
      ] },
      { type: 'heading', text: '按居住地区找官方入口' },
      { type: 'list', items: [
        '旧金山：Recology 大件项目按有效住宅账户及住房类型核资格；危险废物另走 HHW 服务。',
        '半岛：San Mateo County HHW 先预约；家具上门仍向所在城市清运商确认。',
        '南湾：Santa Clara County HHW 要预约并核对居住证明；Palo Alto 居民使用市级项目。',
        '东湾：Alameda County 居民从 StopWaste 查设施；常设点无需预约，但仍要查开放日和接受物品。其他县另查当地项目。',
        '北湾：Marin 从 Marin HHW 查起，Novato 另查本地设施；不能把 Marin 的资格延用到 Sonoma 或 Napa。',
      ] },
      { type: 'heading', text: '把受理确认放在搬运之前' },
      { type: 'paragraph', text: '拍清物品外观、记下数量和大致尺寸，先询问接受范围与收费。县居民项目通常针对自己家庭产生的废物，商业、承包商或代收物品要另查。预约地址可能在确认后才提供，使用确认信导航；不要凭旧地图直接出发，也不要把普通送交费当成所有物品的统一价格。' },
      { type: 'checklist', items: ['确认城市、县与清运商服务范围。', '逐项核对接受清单、数量限制和费用。', '保存预约及官方要求的居住证明说明。', '与物业确认搬运、摆放及通道安排。'] },
      { type: 'template', title: '可复制：向清运商询问', text: '您好，我想处理以下家庭物品：〔品名、数量、大致尺寸〕。请问是否接受、需上门预约还是送交、费用及数量限制是什么？租客如何办理？请提供官方准备要求和确认后的摆放或到达说明。' },
      { type: 'link', title: '查询旧金山大件预约条件', text: '先确认资格，再选搬运日期。', url: 'https://www.recology.com/recology-san-francisco/residential-curbside-collection/' },
      { type: 'link', title: '查询 Alameda County 回收去处', text: '其他地区请使用文末对应县的官方入口。', url: 'https://www.stopwaste.org/recycling-disposal' }, cta,
    ],
  },
  {
    ...base, slug: 'bay-area-alerts-outages-first-day-checklist', category: 'safety', categoryLabel: '安全与准备',
    title: '搬到湾区的第一天：把提醒、停电与家庭准备设好',
    subtitle: '先认住址所属县和供电单位，再保存随时找得到的入口',
    summary: '用一份简短清单设置本地提醒、收藏停电和空气质量页面，并和家人约好联系办法。',
    emoji: '🔦', audience: ['新来湾区', '搬家后更新资料'], tags: ['日常办事', '本地提醒', '停电查询', '空气质量', '家庭准备'],
    sources: [
      { title: 'AlertSF', url: 'https://www.alertsf.org/', description: '旧金山官方提醒注册入口。' },
      { title: 'Alameda County Health · AC Alert', url: 'https://health.alamedacountyca.gov/alerts-announcements/ac-alert/', description: 'Alameda County 本地提醒与注册说明。' },
      { title: 'San Mateo County · SMC Alert', url: 'https://www.smcgov.org/dem/smc-alert', description: '按地址设置接收渠道。' },
      { title: 'Santa Clara County · AlertSCC', url: 'https://oem.santaclaracounty.gov/sign-up-for-alerts', description: '注册或更新地点及语言偏好。' },
      { title: 'Marin County Sheriff · AlertMarin', url: 'https://marinsheriff.gov/emergency-services/emergency-alert-and-warning-tools', description: 'Marin 提醒系统与适用范围。' },
      { title: 'PG&E · Outages & Safety', url: 'https://www.pge.com/en/outages-and-safety.html', description: '查看、报告停电并设置更新。' },
      { title: 'Silicon Valley Power · Outages and Alerts', url: 'https://www.siliconvalleypower.com/svp-and-community/outages-and-alerts', description: 'Santa Clara 市供电服务另查此处。' },
      { title: 'City of Palo Alto Utilities · Outages', url: 'https://www.paloalto.gov/Departments/Utilities/Utilities-Services-Safety/Outages', description: 'Palo Alto 市供电服务另查此处。' },
      { title: 'Bay Area Air District · Current Air Quality', url: 'https://www.baaqmd.gov/About-Air-Quality/Current-Air-Quality', description: '区分监测、预报与空气质量提醒。' },
      { title: 'Bay Area Air District · Spare the Air', url: 'https://www.baaqmd.gov/about-air-quality/spare-the-air/?sc_lang=en', description: '订阅提醒并查看当天公告。' },
      { title: 'Ready.gov · Build a Kit', url: 'https://www.ready.gov/kit', description: '按家庭人数和需要补齐应急用品。' },
    ],
    blocks: [
      { type: 'paragraph', text: '入住后先完成几个能长期使用的小设置：知道本地通知从哪里来、停电去哪里查、手机没电时怎样联系家人。这份清单适合平时准备；收到实际警报时，阅读发布机构、影响地点、时间和行动要求，按最新指示行动。' },
      { type: 'heading', text: '提醒按县注册，搬家后更新' },
      { type: 'list', items: [
        '旧金山使用 AlertSF；Alameda County 使用 AC Alert。东湾其他县需要另找所在地官方系统。',
        'San Mateo County 使用 SMC Alert；Santa Clara County 使用 AlertSCC，别把城市与县混淆。',
        'Marin County 使用 AlertMarin；北湾其他县另查当地入口。注册时按系统要求核对住址和接收方式。',
        '可按需要添加工作或家人所在地点；搬家后删除旧地点、更新电话，确认设置已经保存。注册完成不保证每次通知都能送达。',
      ] },
      { type: 'heading', text: '停电与空气质量分别查' },
      { type: 'paragraph', text: '先看账单确认实际供电单位。PG&E 用户收藏 Outage Center，查看停电范围、更新时间与预计恢复信息；预计时间可能调整。Santa Clara 市的 Silicon Valley Power、Palo Alto 市公用事业有自己的入口，不能只看 PG&E。空气质量使用 Air District 页面，分清监测数据和预报；Spare the Air 是另一类公告，不等于街区即时读数。' },
      { type: 'heading', text: '用现有用品开始，约好联系办法' },
      { type: 'paragraph', text: '按 Ready.gov 清单检查饮水、耐储食物、手电、备用电池、充电设备与收音机，再补家庭及宠物所需用品。选定集合方式和外地联系人，把重要电话留一份纸本；和物业确认楼内通知渠道及出口，不等网络中断才查。用品定期检查有效期，出门前按最新天气、空气质量和官方指示调整安排。' },
      { type: 'checklist', items: ['完成所属县提醒注册并核对地点。', '收藏实际供电单位的停电入口。', '分别收藏空气质量与 Spare the Air。', '检查照明、通信电量和家庭用品。', '与家人确认联系办法并保存纸本。'] },
      { type: 'template', title: '可复制：家庭准备小卡', text: '本地提醒：〔系统名〕\n供电查询：〔官方页面〕\n集合办法：〔约定〕\n失联时联系顺序：〔家人／外地联系人〕\n用品位置：〔约定〕\n下次检查：〔日期〕\n填写后仅供家庭保存，不必发布个人资料。' },
      { type: 'link', title: '打开 PG&E 停电中心入口', text: '按实际供电单位选择查询页面。', url: 'https://www.pge.com/en/outages-and-safety.html' },
      { type: 'link', title: '查看湾区空气质量', text: '读取数据时间与对应地区。', url: 'https://www.baaqmd.gov/About-Air-Quality/Current-Air-Quality' },
      { type: 'link', title: '打开 Ready.gov 用品清单', text: '从已有物品开始，逐项补齐。', url: 'https://www.ready.gov/kit' }, cta,
    ],
  },
];
