import type { FreebieOffer } from '../components/FreebieBoard';
import type { GuideSource } from './guides';

export type VerifiedExtraOffer = FreebieOffer & { verifiedAt: string };

/** Additional local benefits checked on 2026-09-15; weekly dates are rule-derived. */
export const additionalOctoberOffers: VerifiedExtraOffer[] = [
  {
    id: 'sonoma-county-museum-family-oct10', brand: 'MUSEUM OF SONOMA COUNTY',
    title: '10/10 Santa Rosa 博物馆免费家庭日', dateLabel: '10/10 周六 · 活动 11:00–13:00',
    startDate: '2026-10-10', endDate: '2026-10-10', availability: 'dated', kind: 'no-purchase',
    requirement: '官网已列出免费家庭日；家庭活动时段为 11:00–13:00，具体内容与参加方式以活动详情为准。',
    description: '425 Seventh Street, Santa Rosa。北湾家庭可把博物馆活动和市中心散步放在一起；这里列的是官方活动时段，其他时段入馆条件请先确认。',
    imageKey: 'culture-visit', imageNote: '看展主题插图，非该馆实景', sourceUrl: 'https://museumsc.org/events/', sourceLabel: 'Sonoma County Museum 十月官方日历',
    storeUrl: 'https://museumsc.org/visit/', verifiedAt: '2026-09-15',
  },
  {
    id: 'sfmoma-family-oct25', brand: 'SFMOMA · SAN FRANCISCO',
    title: '10/25 带孩子逛 SFMOMA，最多两位成人免费', dateLabel: '10/25 周日 · 门票提前两周开放',
    startDate: '2026-10-25', endDate: '2026-10-25', availability: 'dated', kind: 'reservation',
    requirement: '一名 18 岁及以下儿童或青少年随行，最多两位成人享免费普通入馆；加价特展需另购票。',
    description: '官方明确公布 10/25 家庭日，门票提前两周开放，具体节目稍后公布。151 Third Street；不要把这项家庭福利当成所有成人无条件免费日。',
    imageKey: 'culture-visit', imageNote: '家庭看展主题插图，非 SFMOMA 实景', sourceUrl: 'https://www.sfmoma.org/free-days/', sourceLabel: 'SFMOMA 免费家庭日与成人名额', verifiedAt: '2026-09-15',
  },
  {
    id: 'cantor-stanford-free', brand: 'CANTOR ARTS CENTER · STANFORD',
    title: 'Stanford 的 Cantor 美术馆常年免费', dateLabel: '常设福利 · 周二、周三闭馆',
    availability: 'ongoing', kind: 'no-purchase',
    requirement: '普通入馆免费，向公众开放；10 人及以上团体需提前登记。停车、咖啡厅与餐饮另付。',
    description: '328 Lomita Drive。官网现行时间为周一、周五 11:00–18:00，周四 11:00–20:00，周末 10:00–17:00；十月看展前再查临时调整。',
    imageKey: 'region-cantor', imageNote: 'Cantor 馆舍资料照片，非当前展览现场', sourceUrl: 'https://museum.stanford.edu/visit', sourceLabel: 'Cantor 官方免费入馆与现行开放时间', verifiedAt: '2026-09-15',
  },
  {
    id: 'sfpl-radon-detector-loan', brand: 'SAN FRANCISCO PUBLIC LIBRARY',
    title: 'SFPL 图书证可免费借氡探测器', dateLabel: '常设借用 · 最长 21 天',
    availability: 'ongoing', kind: 'reservation',
    requirement: '持 SFPL 图书证借用，可在线预约；设备先到先得，最长借期 21 天，用后须归还。',
    description: '图书馆 2026 年新增的家用设备服务，所有分馆均可办理，归还可到任一分馆。先查馆藏与预约队列，免费的是借用设备。',
    imageKey: 'library', imageNote: 'SFPL 馆舍资料照片，非探测器或现有库存', sourceUrl: 'https://sfpl.org/releases/2026/07/15/free-radon-detector-loan-program-promote-home-safety',
    sourceLabel: 'SFPL 免费设备借用公告', verifiedAt: '2026-09-15',
  },
  {
    id: 'berkeley-tool-lending', brand: 'BERKELEY PUBLIC LIBRARY',
    title: 'Berkeley 居民可免费借工具和厨房设备', dateLabel: '常设服务 · 须完成工具馆登记',
    availability: 'ongoing', kind: 'reservation',
    requirement: '仅限超过 18 岁的 Berkeley 居民或本市物业业主；须核验地址或产权并签借用文件，一次最多 10 件。',
    description: '1901 Russell Street。可先看工具库存，电钻、园艺工具和部分厨房设备能按需借用；一般图书证本身不能替代工具馆的居住资格审核。',
    imageKey: 'repair', imageNote: '工具主题资料照片，非该馆现场或现有库存', sourceUrl: 'https://www.berkeleypubliclibrary.org/locations/tool-lending-library/borrowing-tools',
    sourceLabel: 'Berkeley 工具馆借用资格', storeUrl: 'https://www.berkeleypubliclibrary.org/locations/tool-lending-library/tools', verifiedAt: '2026-09-15',
  },
  {
    id: 'ikea-emeryville-as-is-wednesdays', brand: 'IKEA EMERYVILLE',
    title: 'Emeryville IKEA 周三 As-is 区额外九折', dateLabel: '每周三 · 仅 Emeryville 实体店',
    availability: 'ongoing', kind: 'purchase',
    requirement: '须 IKEA Family 会员结账出示会员号，仅限标记 As-is 商品；不能叠加优惠、不追溯旧单，As-is 商品不可退。',
    description: '4400 Shellmound Street。官网现行规则为每周三额外减 10%，十月对应 10/7、14、21、28；库存会变，官网未公布结束日，出发前再核对。',
    imageKey: 'furniture-inspection', imageNote: '验货主题插图，非 IKEA 门店或实际库存', sourceUrl: 'https://www.ikea.com/us/en/stores/emeryville/', sourceLabel: 'IKEA Emeryville As-is 周三条款', verifiedAt: '2026-09-15',
  },
  {
    id: 'poppy-claro-doggie-dinners-fall', brand: 'POPPY & CLARO · SAN JOSÉ',
    title: '周五带狗出门：$6 三道宠物晚餐延长至秋季', dateLabel: '秋季每周五 · 17:00–20:00 露台',
    availability: 'check-local', kind: 'purchase',
    requirement: '$6 套餐供宠物狗享用，仅周五 17:00–20:00 露台、天气允许时供应；成人餐饮另付，先向店家确认座位与当日供应。',
    description: '50 West San Fernando Street。官网宣布延长至秋季；按周五规则，十月为 10/2、9、16、23、30，店方尚未公布最终结束日。',
    imageKey: 'dog', imageNote: '宠物主题资料照片，非餐厅现场或实际套餐', sourceUrl: 'https://www.poppyandclaro.com/', sourceLabel: 'Poppy & Claro 秋季 Doggie Dinners', verifiedAt: '2026-09-15',
  },
];

export const officialSources: GuideSource[] = additionalOctoberOffers.map((offer) => ({
  title: offer.sourceLabel,
  url: offer.sourceUrl,
  description: `2026 年 9 月 15 日核对：${offer.requirement}`,
}));
