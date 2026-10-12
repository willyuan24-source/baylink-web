/**
 * 繁體 term table for the whole site (WEB-I18N, RC-11 iv; I18N-SEO-07): the everyday Taiwan word where the mainland word
 * differs, and the characters opencc's cn → tw gets wrong in our text. Chosen from the words' frequency in the site's own
 * text (src/**, the game's included) and the 10-11 繁體 audit. Loaded with opencc, so the 简体 and English pages never
 * carry it.
 *
 * Keys are Simplified. The converter (locale.ts taiwanConverter) applies them before opencc, longest key first and with
 * no word boundaries, so a short key could match across two words (事实|时间 read as 事即時間). Three rules prevent that:
 *   - a word that is only safe beside the word it qualifies goes in as phrases (实时 is 即時 in 实时余票, 实时到站 …;
 *     elsewhere opencc's 實時 stands);
 *   - a guard is a phrase mapped to itself: the converter leaves it to opencc, and a shorter key can no longer start
 *     inside it (官网 before 网上 in 官网上, 世界 before 界面 in 世界面临, 按周边 before 按周). The converter guards each
 *     guard's converted form too, so a second pass over converted text (a JSX child) changes nothing;
 *   - tests/taiwan-terms.test.ts converts every Chinese run in src/** with the table and fails on the sequences these
 *     mistakes produce, and on any run a second conversion would change.
 * A value is written in Traditional, or left in Simplified where opencc's own conversion of it is the Taiwan text.
 */
export type TaiwanTerms = { words: readonly (readonly [string, string])[]; after: readonly (readonly [RegExp, string])[] };

/** Phrases the converter leaves to opencc (see above). */
const guard = (...phrases: string[]) => phrases.map(phrase => [phrase, phrase] as const);

/** "X 周" that names a week (Fleet Week 艦隊週, 活動週), not the surname or "around" (X 周边 stays 周邊). */
const WEEKS: readonly (readonly [string, string])[] = [
  ['活动周', '活動週'], ['艺术周', '藝術週'], ['舰队周', '艦隊週'], ['餐厅周', '餐廳週'], ['海军周', '海軍週'], ['手作周', '手作週'],
  ['短片周', '短片週'], ['商店周', '商店週'], ['科技周', '科技週'], ['设计周', '設計週'], ['美食周', '美食週'], ['电影周', '電影週'],
  ['首周', '首週'], ['按周', '按週'],
];

/**
 * 实时 is 即時 before the word it qualifies. A bare 实时 key would split 核实|时已满, 事实|时间线 and 真实|时间 (核即時已滿,
 * 事即時間線); a phrase is never cut that way. Values in Simplified are converted by opencc after the table; the six
 * written in Traditional carry a Taiwan word of their own (視訊, 資料, 公車, 資訊, 連網, 訊息).
 */
const REAL_TIME: readonly (readonly [string, string])[] = [
  ...['余票', '余位', '余量', '剩余', '库存', '价格', '票价', '状态', '页面', '到站', '警报', '导航', '航班', '提醒', '发车', '路线', '路况',
    '预计', '运行', '服务', '看房', '交通', '列车', '班次', '可用', '设施', '查询', '聊天', '优惠', '景况', '核验', '开放', '开门', '更新',
    '位置', '天气', '翻译', '通知', '动态', '定位', '共享', '监控', '追踪', '显示', '播报', '字幕', '对话', '互动', '回复', '排队', '人流', '车况']
    .map(word => ['实时' + word, '即时' + word] as const),
  ['实时视频', '即時視訊'], ['实时数据', '即時資料'], ['实时公交', '即時公車'], ['实时信息', '即時資訊'], ['实时联网', '即時連網'], ['实时消息', '即時訊息'],
];

export const SITE_TAIWAN_TERMS: TaiwanTerms = {
  words: [
    // 签 is 簽 (sign: 簽合同, 須簽免責, 簽書) except in the nouns that keep 籤. opencc writes 籤 for every 签 it has no
    // phrase for (籤合同 in a scam-guide title, 須籤, 籤書: 39 places in the site's text), while 籤 is a closed list of nouns
    ['签', '簽'], ['标签', '標籤'], ['书签', '書籤'], ['抽签', '抽籤'], ['中签', '中籤'], ['求签', '求籤'], ['签筒', '籤筒'], ['牙签', '牙籤'],
    ['竹签', '竹籤'], ['价签', '價籤'], ['吊签', '吊籤'], ['签语', '籤語'], ['今日签', '今日籤'], ['今日签到', '今日簽到'], ['便签', '便籤'],
    ['叶签', '葉籤'], ['灵签', '靈籤'], ['上上签', '上上籤'], ['下下签', '下下籤'], ['签诗', '籤詩'],
    // 帐: Taiwan writes accounts and bills with 帳 (帳戶、帳單、轉帳、結帳), opencc with 賬
    ['账', '帳'],
    ...WEEKS, ...guard(...WEEKS.map(([week]) => week + '边')),
    ['大采购', '大採購'], ['竹影后', '竹影後'], ['几天后', '幾天後'], ['两天后', '兩天後'], ['数天后', '數天後'], ['三天后', '三天後'],
    ...REAL_TIME,
    // the everyday Taiwan word (UI and editorial text)
    ['帖子', '貼文'], ['发帖', '發文'], ['手机号码', '手機號碼'], ['手机号', '手機號碼'], ['点击', '點選'], ['网上', '線上'],
    ['用户名', '使用者名稱'], ['用户名片', '使用者名片'], ['用户', '使用者'], ['身份', '身分'], ['电子邮箱', '電子信箱'], ['邮箱', '信箱'],
    ['私信', '私訊'], ['私信息', '私資訊'], ['联系', '聯絡'], ['渠道', '管道'], ['宽带', '寬頻'], ['运营', '營運'], ['志愿者', '志工'],
    ['模板', '範本'], ['质量', '品質'], ['刷新', '重新整理'], ['点赞', '按讚'], ['头像', '大頭貼'], ['视频通话', '視訊通話'],
    ['视频会议', '視訊會議'], ['复印', '影印'], ['激活', '啟用'], ['服务器', '伺服器'], ['互联网', '網際網路'], ['退出登录', '登出'],
    ['打车', '叫車'], ['界面', '介面'],
    // the words above where a longer word around them means something else: 官网|上, 世界|面临, 可用|户外, 镜头|像素, 刷新|纪录
    ...guard('官网', '内网', '外网', '联网', '电网', '渔网', '球网', '铁丝网', '蜘蛛网', '防护网', '世界', '用户外', '头像素', '刷新纪录', '刷新记录'),
  ],
  // "14 天后" is "14 days later" (後), not 天后 the goddess, which opencc's phrase table turns it into
  after: [[/(\d\s*)天后/g, '$1天後']],
};
