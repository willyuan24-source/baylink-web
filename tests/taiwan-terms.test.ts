import assert from 'node:assert/strict';
import test from 'node:test';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { loadLocale, taiwanConverter, translateText } from '../src/i18n/locale';
import { SITE_TAIWAN_TERMS } from '../src/i18n/taiwan-terms';
import { guides } from '../src/data/guides';
import { MONTHLY_EVENTS } from '../src/data/monthly-edition';
import { simplifiedOnlyCharacters } from '../scripts/i18n-html-check.mjs';

const O = await import('opencc-js');
const require = createRequire(import.meta.url);
const simplifiedOnly = simplifiedOnlyCharacters(require('opencc-js/dict/STCharacters').default, require('opencc-js/dict/TSCharacters').default);
await loadLocale('zh-Hant');
// the runtime path: every 繁體 string the site and the game show goes through translateText (the game's too, via host.ts)
const hant = (text: string) => translateText(text, 'zh-Hant');

test('WEB-I18N 繁體 terms: the 10-11 audit’s words read as Taiwan writes them (I18N-SEO-07)', () => {
  const cases: [string, string][] = [
    ['湾区租房防骗指南：看房、转账、签合同前先检查什么', '灣區租房防騙指南：看房、轉帳、簽合同前先檢查什麼'],
    ['San Francisco Fleet Week：海湾与城市活动周', 'San Francisco Fleet Week：海灣與城市活動週'],
    ['联系发布者前，请确认手机号和帖子仍有效', '聯絡發布者前，請確認手機號碼和貼文仍有效'],
    ['点击网上预约，再用电子邮箱登录', '點選線上預約，再用電子信箱登入'],
    ['清单至少有效 14 天后才可能发券', '清單至少有效 14 天後才可能發券'],
    ['账户、账单与身份证明', '帳戶、帳單與身分證明'],
    ['空气质量与实时路况', '空氣品質與即時路況'],
    ['标签页和书签不受影响，抽签照旧', '標籤頁和書籤不受影響，抽籤照舊'],
    ['手机号码', '手機號碼'],
    ['加入这天计划；已加入 10/17 计划；常设计划', '加入這天計畫；已加入 10/17 計畫；常設計畫'],
    ['用户名与头像', '使用者名稱與大頭貼'],
    ['需签免责文件；官方签书活动', '需簽免責文件；官方簽書活動'],
    ['不保证实时余位，显示实时余票', '不保證即時餘位，顯示即時餘票'],
  ];
  for (const [zh, want] of cases) assert.equal(hant(zh), want, zh);
});

test('WEB-I18N 繁體 terms: no key matches across two words (the 10-12 review’s strings, the game’s included)', () => {
  const cases: [string, string][] = [
    // 实时 only before the word it qualifies: 事实|时间, 核实|时, 真实|时间 keep opencc's 實時
    ['按事实时间线提交', '按事實時間線提交'],
    ['核实时已满', '核實時已滿'],
    ['公开页面显示的已核实时段；', '公開頁面顯示的已核實時段；'],
    ['会报真实时间的', '會報真實時間的'],
    ['没有落实时，缩短行程', '沒有落實時，縮短行程'],
    ['实时', '實時'],
    // 用户名片 is the user's card, not 用户名 + 片
    ['关闭用户名片', '關閉使用者名片'],
    ['用户名片骨架', '使用者名片骨架'],
    // 籤 nouns keep 籤 under the 签 → 簽 rule
    ['金门签语饼厂', '金門籤語餅廠'],
    ['今日签：走一走', '今日籤：走一走'],
    ['今日签到', '今日簽到'],
    ['核对便签', '核對便籤'],
    ['好奇心叶签。', '好奇心葉籤。'],
    // guards: a longer word around a key
    ['在官网上预约', '在官網上預約'],
    ['世界面临', '世界面臨'],
    ['另按周边道路', '另按周邊道路'],
    ['活动周边停车', '活動周邊停車'],
    ['刷新纪录', '刷新紀錄'],
    ['可用户外场地', '可用戶外場地'],
    ['镜头像素', '鏡頭像素'],
    ['隐私信息', '隱私資訊'],
  ];
  for (const [zh, want] of cases) assert.equal(hant(zh), want, zh);
});

test('WEB-I18N 繁體 terms: every entry converts to Traditional and is stable under a second conversion', () => {
  const site = taiwanConverter(O, undefined, SITE_TAIWAN_TERMS);
  for (const [zh] of SITE_TAIWAN_TERMS.words) {
    const once = site(zh, true);
    assert.ok(![...once].some(character => simplifiedOnly.has(character)), `${zh} → ${once} is Traditional`);
    assert.equal(site(once, true), once, `${zh} → ${once}: converting twice changes nothing`);
    assert.equal(hant(zh), once, `${zh}: the runtime converter is this converter`);
  }
  // without terms the converter is the game lane's own (tests/opus-bay-w9-l-hant.test.ts tests it that way)
  assert.equal(taiwanConverter(O)('联系帖子', true), '聯繫帖子');
});

/** Every run of non-ASCII text in src (the site's and the game's text, data and generated dictionaries included). */
function sourceRuns(): string[] {
  const runs = new Set<string>();
  const walk = (directory: string) => {
    for (const name of readdirSync(directory)) {
      const path = join(directory, name);
      if (statSync(path).isDirectory()) walk(path);
      else if (/\.(?:ts|tsx|json)$/.test(name)) for (const match of readFileSync(path, 'utf8').matchAll(/[^\p{ASCII}]+/gu)) if (/[㐀-鿿]/.test(match[0])) runs.add(match[0]);
    }
  };
  walk('src');
  return [...runs];
}
/** What a key matching across a word boundary produces (the review's cases and their kin). */
const CROSSED = /即時[間段候]|[事落真]即時|核即時已|名稱片|簽語|今日簽(?!到)|[便葉]簽|官線上|世介面|週邊|重新整理[紀記]錄|使用者外|大頭貼素|關聯絡/u;

test('WEB-I18N 繁體 terms: the table crosses no word in any Chinese run of src, and makes none change on a second conversion', () => {
  const runs = sourceRuns();
  assert.ok(runs.length > 20000, `${runs.length} runs`);
  // the same converter without the site's table: a crossed word it already makes (opencc's own 圖書館週邊) is not the table's
  const plain = taiwanConverter(O);
  const crossed: string[] = [], unstable: string[] = [];
  for (const run of runs) {
    const once = hant(run);
    if (CROSSED.test(once) && !CROSSED.test(plain(run, true))) crossed.push(`${run} → ${once}`);
    const twice = hant(once);
    // opencc alone re-reads a few runs on a second pass (適合家庭 → 適閤家庭: 合家 is a phrase); the table adds none
    if (twice !== once && plain(plain(run, true), true) === plain(run, true)) unstable.push(`${run} → ${once} → ${twice}`);
  }
  assert.deepEqual(crossed.slice(0, 20), [], `${crossed.length} runs with a crossed word`);
  assert.deepEqual(unstable.slice(0, 20), [], `${unstable.length} runs the table makes change on a second conversion`);
});

test('WEB-I18N 繁體 terms: every guide and event title converts with no Simplified character left', () => {
  const left: string[] = [];
  for (const title of [...guides.map(guide => guide.title), ...guides.map(guide => guide.summary), ...MONTHLY_EVENTS.map(event => event.title)]) {
    const converted = hant(title);
    if ([...converted].some(character => simplifiedOnly.has(character))) left.push(`${title} → ${converted}`);
  }
  assert.deepEqual(left, []);
  assert.ok(!guides.some(guide => hant(guide.title).includes('籤合同')), '簽合同, never 籤合同');
});
