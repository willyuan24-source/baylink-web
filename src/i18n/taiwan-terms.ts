/**
 * 繁體 term table for the whole site (WEB-I18N, RC-11 iv; I18N-SEO-07): the everyday Taiwan word where the mainland word
 * differs, and the characters opencc's cn → tw gets wrong in our text. Keys are Simplified, values Taiwan Traditional;
 * the converter applies them before opencc (longest key first), on top of the game's TAIWAN_WORDS (locale.ts). Loaded
 * with opencc, so the 简体 and English pages never carry it. Chosen from the words' frequency in the site's own text
 * (src/data, src/components, …) and the 10-11 繁體 audit; every value is stable under a second conversion
 * (tests/taiwan-terms.test.ts).
 */
export type TaiwanTerms = { words: readonly (readonly [string, string])[]; after: readonly (readonly [RegExp, string])[] };

export const SITE_TAIWAN_TERMS: TaiwanTerms = {
  words: [
    // 签 is 簽 (sign) except in a few nouns that keep 籤; opencc's default is 籤 (籤合同 in a scam-guide title)
    ['签', '簽'], ['标签', '標籤'], ['书签', '書籤'], ['抽签', '抽籤'], ['中签', '中籤'], ['求签', '求籤'], ['签筒', '籤筒'], ['牙签', '牙籤'],
    ['竹签', '竹籤'], ['价签', '價籤'], ['吊签', '吊籤'],
    // 帐: Taiwan writes accounts and bills with 帳 (帳戶、帳單、轉帳、結帳), opencc with 賬
    ['账', '帳'],
    // X 周 that names a week ("Fleet Week" 艦隊週, 活動週), not the surname or "around"
    ['活动周', '活動週'], ['艺术周', '藝術週'], ['舰队周', '艦隊週'], ['餐厅周', '餐廳週'], ['海军周', '海軍週'], ['手作周', '手作週'],
    ['短片周', '短片週'], ['商店周', '商店週'], ['科技周', '科技週'], ['设计周', '設計週'], ['美食周', '美食週'], ['电影周', '電影週'],
    ['首周', '首週'], ['按周', '按週'], ['几天后', '幾天後'], ['两天后', '兩天後'], ['数天后', '數天後'], ['三天后', '三天後'],
    // the everyday Taiwan word (UI and editorial text)
    ['帖子', '貼文'], ['发帖', '發文'], ['手机号码', '手機號碼'], ['手机号', '手機號碼'], ['点击', '點選'], ['网上', '線上'],
    ['用户名', '使用者名稱'], ['用户', '使用者'], ['身份', '身分'], ['电子邮箱', '電子信箱'], ['邮箱', '信箱'], ['私信', '私訊'],
    ['联系', '聯絡'], ['实时', '即時'], ['渠道', '管道'], ['宽带', '寬頻'], ['运营', '營運'], ['志愿者', '志工'], ['模板', '範本'],
    ['质量', '品質'], ['刷新', '重新整理'], ['点赞', '按讚'], ['头像', '大頭貼'], ['视频通话', '視訊通話'], ['视频会议', '視訊會議'],
    ['复印', '影印'], ['激活', '啟用'], ['服务器', '伺服器'], ['互联网', '網際網路'], ['退出登录', '登出'], ['打车', '叫車'],
    ['界面', '介面'], ['字体', '字型'], ['文本', '文字'],
  ],
  // "14 天后" is "14 days later" (後), not 天后 the goddess, which opencc's phrase table turns it into
  after: [[/(\d\s*)天后/g, '$1天後']],
};
