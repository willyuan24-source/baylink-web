/** Original BAYLINK social artwork. Copy records a dated editorial snapshot. */
export type PerksPosterCard = {
  sourceId: string;
  name: string;
  reward: string;
  details: string[];
  tag: string;
  icon: 'beauty' | 'cup' | 'cake' | 'cookie' | 'popcorn' | 'bread' | 'film' | 'farm' | 'print' | 'art' | 'seed' | 'park' | 'gift';
};

export type PerksPoster = {
  id: string;
  topic: 'birthday' | 'everyday' | 'retail';
  title: string;
  headline: [string, string];
  subtitle: string;
  edition: string;
  path: string;
  guidePath: string;
  cards: PerksPosterCard[];
};

export const PERKS_POSTER_CHECKED = '2026-10-04';
export const perksPosters: PerksPoster[] = [
  {
    id: 'birthday-01', topic: 'birthday', title: '生日福利 01：美妆与甜蜜小礼',
    headline: ['生日福利', '把小确幸领回家'], subtitle: '美妆、饮品、蛋糕 · 先看门槛，再去领取', edition: 'BIRTHDAY / 01',
    path: '/social/perks-2026-10/baylink-birthday-01.png', guidePath: '/guides/bay-area-birthday-perks',
    cards: [
      { sourceId: 'sephora-birthday', name: 'Sephora', reward: '生日月美妆小礼', details: ['加入 Beauty Insider', '店内领取无需购物', '网领需税前商品满 $25'], tag: '生日月 · 礼品依库存', icon: 'beauty' },
      { sourceId: 'roundup-ulta-birthday-gift-2026', name: 'Ulta Beauty', reward: '生日月专属赠礼', details: ['生日月前注册并填写生日', '开启营销通知；店领无需购物', '网购或自提需消费'], tag: 'Ulta Beauty Rewards · 需有效券', icon: 'beauty' },
      { sourceId: 'dutch-bros-birthday-2026', name: 'Dutch Bros', reward: '生日饮品一杯', details: ['App 入会并填写生日', '生日当天入会，次日到券', '饮品券有效期 30 天'], tag: '提前注册更从容', icon: 'cup' },
      { sourceId: 'nothing-bundt-cakes-birthday-bundtlet', name: 'Nothing Bundt Cakes', reward: '单人份 Bundtlet', details: ['年满 18 岁 · Bundtastic 会员', '提前登记生日', '收到生日邮件至生日后 7 天'], tag: '带着生日券去领取', icon: 'cake' },
    ],
  },
  {
    id: 'birthday-02', topic: 'birthday', title: '生日福利 02：零食、电影与咖啡',
    headline: ['生日仪式感', '这几份也别漏掉'], subtitle: '有的要提前入会，有的还需要历史消费', edition: 'BIRTHDAY / 02',
    path: '/social/perks-2026-10/baylink-birthday-02.png', guidePath: '/guides/bay-area-birthday-perks',
    cards: [
      { sourceId: 'chick-fil-a-birthday-2026', name: 'Chick-fil-A', reward: '曲奇 / 布朗尼二选一', details: ['基础 One 会员生日礼', '至少提前 24 小时填写生日', '生日券 30 天内用；周日休息'], tag: '不同等级奖励有差别', icon: 'cookie' },
      { sourceId: 'amc-birthday-popcorn-2026', name: 'AMC Theatres', reward: '生日月大桶爆米花', details: ['免费 Stubs Insider 会员', '生日月首日前至少 30 天', '入会并填生日；生日月内兑换'], tag: '先注册，再安排电影', icon: 'popcorn' },
      { sourceId: 'panera-birthday-2026', name: 'Panera Bread', reward: '单份烘焙小点心', details: ['基础 MyPanera 会员', '提前填写生日，无需购物', '到账后 7 天内用；限价看券'], tag: '记得查看账户奖励', icon: 'bread' },
      { sourceId: 'roundup-starbucks-birthday-2026', name: 'Starbucks', reward: '指定饮品或食品', details: ['生日前至少 7 天入会并填生日', '每年生日前须有赚星交易', 'Green 当天 / Gold 7 天', 'Reserve 30 天；以等级为准'], tag: '有历史消费门槛', icon: 'cup' },
    ],
  },
  {
    id: 'everyday-01', topic: 'everyday', title: '湾区免费日常：五区六个好去处',
    headline: ['湾区日常', '免费也有好生活'], subtitle: '不等生日 · 从图书馆到周末散步', edition: 'EVERYDAY / 03',
    path: '/social/perks-2026-10/baylink-everyday-01.png', guidePath: '/guides/bay-area-everyday-free-perks',
    cards: [
      { sourceId: 'sfpl-kanopy-streaming', name: 'SFPL · Kanopy', reward: '在家免费看片', details: ['需有效旧金山公共图书馆卡', '播放额度以登录页面为准'], tag: '旧金山', icon: 'film' },
      { sourceId: 'tilden-little-farm-free', name: 'Tilden Little Farm', reward: '逛农场 · 免费停车', details: ['可近距离观察农场动物', '现已禁止公众投喂'], tag: '东湾 · Berkeley', icon: 'farm' },
      { sourceId: 'smcl-free-printing', name: 'San Mateo County Libraries', reward: '每天最多免费印 25 页', details: ['双面每一面计页；限 SMCL 馆', '选择分馆提交，同馆取件'], tag: '半岛 · 县图书馆系统', icon: 'print' },
      { sourceId: 'palo-alto-art-center-free', name: 'Palo Alto Art Center', reward: '免费逛艺术展', details: ['普通展览免费入场', '课程另计；先查开放安排'], tag: '半岛 · Palo Alto', icon: 'art' },
      { sourceId: 'sjpl-free-seed-library', name: 'San José Public Library', reward: '带回一份免费种子', details: ['无需图书证', '仅取当季所需；品种依库存'], tag: '南湾 · 种子图书馆', icon: 'seed' },
      { sourceId: 'marin-library-parking-passes', name: 'Marin County Free Library', reward: '借一周公园停车证', details: ['持图书证预约借用', '仅适用特定停车场及日间'], tag: '北湾 · Marin', icon: 'park' },
    ],
  },
  {
    id: 'retail-01', topic: 'retail', title: '十月门店福利：赠品、手作与买赠',
    headline: ['十月门店福利', '四场先收藏'], subtitle: '日期、会员、年龄与消费条件 · 出发前查本店', edition: 'RETAIL / 04',
    path: '/social/perks-2026-10/baylink-retail-01.png', guidePath: '/guides/bay-area-retail-freebies-family-deals',
    cards: [
      { sourceId: 'lowes-mrbeast-swarms-oct24-2026', name: 'Lowe’s · MrBeast', reward: '两只限定 Swarms 玩具', details: ['10/24 · 起始时间先问本店', '首 100 名 MyLowe’s Rewards 会员', '提前准备会员账户', '本店赠品库存须再确认'], tag: '限量赠送 · 送完为止', icon: 'gift' },
      { sourceId: 'target-eos-pouch-oct10-2026', name: 'Target · eos', reward: '买 eos，送绒毛拉链包', details: ['10/10 · 12:00–16:00', '16 岁及以上 · 需购买 eos', '合资格购买条件向本店确认', '仅参与门店，按官网名单选店'], tag: '需消费 · 赠完即止', icon: 'beauty' },
      { sourceId: 'michaels-halloween-fest-oct17-2026', name: 'Michaels', reward: '免费万圣节手作与游戏', details: ['10/17 · 10:00–12:00', '4 岁以上 · 家长陪同', '先选本店确认活动与材料'], tag: '无需购物 · 赠品依现场', icon: 'art' },
      { sourceId: 'lakeshore-castle-oct10-2026', name: 'Lakeshore Learning', reward: '免费城堡主题手作', details: ['10/10 · 11:00–15:00', '官方 2026 日历所列场次', '出发前向本店确认安排'], tag: '无需购物 · 活动可能调整', icon: 'art' },
    ],
  },
];

export const perksPosterCaption = (poster: PerksPoster, translate: (text: string) => string): string => [
  `BAYLINK | ${translate(poster.title)}`,
  translate('收藏这份清单，领取前先确认会员、日期与门店条件。'),
  '',
  ...poster.cards.map((card, index) => `${index + 1}. ${card.name} — ${translate(card.reward)}\n${card.details.map(translate).join('；')}`),
  '',
  `${translate('图文静态快照，核验日期')}：${PERKS_POSTER_CHECKED}`,
  translate('奖励、库存及适用条件可能调整，请通过攻略内官网链接复核。'),
  `https://www.baylink.us${poster.guidePath}`,
  poster.topic === 'retail' ? '#BAYLINK #BayArea #Freebies #湾区优惠' : poster.topic === 'everyday' ? '#BAYLINK #BayArea #LocalPerks #湾区生活' : '#BAYLINK #BayArea #BirthdayPerks #湾区生活',
].join('\n');
