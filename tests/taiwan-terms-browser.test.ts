import assert from 'node:assert/strict';
import test from 'node:test';

/**
 * The 繁體 term table (src/i18n/taiwan-terms.ts) reaches the converter the browser installs, not only Node's
 * (I18N-SEO-07, RC-11 iv). locale.ts tells Node from the browser by `process.getBuiltinModule` (Node loads opencc's full
 * build synchronously; a browser build may load 繁體 another way, as WEB-DATA-SPLIT's lean phrase table does). This file
 * runs in its own test process and hides that switch before locale.ts loads and while 繁體 loads, so loadLocale takes
 * the browser's path, whatever that path is.
 */
const builtin = Object.getOwnPropertyDescriptor(process, 'getBuiltinModule');
Object.defineProperty(process, 'getBuiltinModule', { value: undefined, configurable: true, writable: true });
let L: typeof import('../src/i18n/locale');
try {
  L = await import('../src/i18n/locale');
  await L.loadLocale('zh-Hant');
} finally {
  if (builtin) Object.defineProperty(process, 'getBuiltinModule', builtin);
  else delete (process as { getBuiltinModule?: unknown }).getBuiltinModule;
}

test('WEB-I18N 繁體 terms: the browser’s 繁體 converter applies the site’s term table', () => {
  const hant = (text: string) => L.translateText(text, 'zh-Hant');
  assert.equal(hant('湾区租房防骗指南：看房、转账、签合同前先检查什么'), '灣區租房防騙指南：看房、轉帳、簽合同前先檢查什麼');
  assert.equal(hant('联系发布者前，请确认手机号和帖子仍有效'), '聯絡發布者前，請確認手機號碼和貼文仍有效');
  assert.equal(hant('San Francisco Fleet Week：海湾与城市活动周'), 'San Francisco Fleet Week：海灣與城市活動週');
  assert.equal(hant('显示实时余票；按事实时间线提交'), '顯示即時餘票；按事實時間線提交');
  assert.equal(hant('金门签语饼厂'), '金門籤語餅廠');
});
