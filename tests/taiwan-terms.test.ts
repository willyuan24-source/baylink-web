import assert from 'node:assert/strict';
import test from 'node:test';
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
    ['用户名与头像', '使用者名稱與大頭貼'],
  ];
  for (const [zh, want] of cases) assert.equal(hant(zh), want, zh);
});

test('WEB-I18N 繁體 terms: every value is Traditional, stable under a second conversion, and the game’s converter is unchanged', () => {
  const site = taiwanConverter(O, SITE_TAIWAN_TERMS);
  for (const [zh, tw] of SITE_TAIWAN_TERMS.words) {
    assert.ok(![...tw].some(character => simplifiedOnly.has(character)), `${tw} is Traditional`);
    assert.equal(site(tw, true), tw, `${zh} → ${tw} stays`);
    assert.equal(site(site(zh, true), true), site(zh, true), `${zh}: converting twice changes nothing`);
  }
  // the game's own converter (tests/opus-bay-w9-l-hant.test.ts) takes no site terms
  const game = taiwanConverter(O);
  assert.equal(game('联系帖子', true), '聯繫帖子');
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
