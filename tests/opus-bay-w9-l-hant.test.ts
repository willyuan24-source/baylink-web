import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

/**
 * Wave 9 · lane L · 繁體 quality (lane L (2), w8 NEXT P0-4, R§6 语言与本地化 row 1): the site's cn → tw converter
 * (src/i18n/locale.ts taiwanConverter) is safe to run twice — the game's pick() output is a JSX child the site converts
 * again (i18n/host.ts), and opencc's stock cn → tw turned 馬里納區 into 馬裡納區, 小傢伙 into 小傢夥, 花崗岩 into 花崗巖 —
 * and it uses the everyday Taiwan word for the mainland words the review found (設置 → 設定, 信息 → 資訊, 意大利 → 義大利,
 * 帶娃 → 帶小孩, 米 → 公尺) and 裡 where 里 means "in" (旅行本裡, 海裡).
 */

const O = await import('opencc-js');
const L = await import('../src/i18n/locale');
const ROOT = path.resolve(import.meta.dirname, '..');

/** every string literal with a Han character in src/opus-bay (code only; the voice tables excluded: never shown) */
function opusLiterals(): string[] {
  const out = new Set<string>();
  const re = /(['"`])((?:\\.|(?!\1)[^\\\n])*?\p{Script=Han}(?:\\.|(?!\1)[^\\\n])*?)\1/gu;
  const walk = (d: string) => {
    for (const f of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, f.name);
      if (f.isDirectory()) walk(p);
      else if (/\.(ts|tsx)$/.test(f.name) && !/^voiceW\d/.test(f.name)) for (const m of fs.readFileSync(p, 'utf8').matchAll(re)) out.add(m[2]);
    }
  };
  walk(path.join(ROOT, 'src/opus-bay'));
  return [...out];
}

test('W9-L 繁體: the stock cn → tw is not idempotent (the bug), the site\'s converter is', () => {
  const stock = O.Converter({ from: 'cn', to: 'tw' });
  const tw = L.taiwanConverter(O);
  const cases: [string, string][] = [
    ['马里纳区', '馬里納區'], ['小家伙', '小傢伙'], ['花岗岩', '花崗岩'], ['里维拉壁画预计 2028 年起展出', '里維拉壁畫預計 2028 年起展出'],
    ['克莱门特街 · 里士满区', '克萊門特街 · 里士滿區'], ['公园坡顶，有个金色的小家伙。', '公園坡頂，有個金色的小傢伙。'],
  ];
  for (const [zh, want] of cases) {
    assert.notEqual(stock(stock(zh)), stock(zh), `the stock converter was idempotent on ${zh}: the bug is gone upstream`);
    const once = tw(zh);
    assert.equal(once, want, zh);
    assert.equal(tw(once), once, `${zh}: a second pass changes ${once}`);
    assert.equal(tw(tw(once)), once, `${zh}: a third pass`);
  }
  // already-Traditional text that the converter itself made stays as it is inside a longer string too
  assert.equal(tw(`你好，${tw('马里纳区')}！`), '你好，馬里納區！');
});

test('W9-L 繁體: every Chinese literal of the game converts once and stays (the whole of src/opus-bay)', () => {
  const tw = L.taiwanConverter(O);
  const lits = opusLiterals();
  assert.ok(lits.length > 4000, `${lits.length} literals`);
  const moved: string[] = [];
  for (const s of lits) { const a = tw(s); if (tw(a) !== a) moved.push(`${s} → ${a} → ${tw(a)}`); }
  assert.deepEqual(moved, []);
});

test('W9-L 繁體: on the game page, Taiwan words, 裡 for "in", 公尺 for metres; nothing else moves', () => {
  const conv = L.taiwanConverter(O), tw = (s: string) => conv(s, true);
  const want: [string, string][] = [
    ['设置', '設定'], ['设置（Esc）', '設定（Esc）'], ['活动信息来自 BAYLINK 编辑整理', '活動資訊來自 BAYLINK 編輯整理'], ['在意大利手工做的', '在義大利手工做的'],
    ['适合带娃', '適合帶小孩'], ['地图数据', '地圖資料'], ['网络不太稳', '網路不太穩'], ['搜索地点', '搜尋地點'], ['游戏菜单', '遊戲選單'],
    ['也可以用鼠标拖', '也可以用滑鼠拖'], ['手机把游戏的图形内存收回了', '手機把遊戲的圖形記憶體收回了'], ['屏幕上会亮出它的名字', '螢幕上會亮出它的名字'],
    ['已加入想去 · 旅行本里可以一键带去 BAYLINK 安排', '已加入想去 · 旅行本裡可以一鍵帶去 BAYLINK 安排'], ['隧道里不能下车', '隧道裡不能下車'],
    ['游戏里约 1 分钟 · 现实约 2.5 公里', '遊戲裡約 1 分鐘 · 現實約 2.5 公里'], ['全垒打会直接“扑通”掉进海里！', '全壘打會直接“撲通”掉進海裡！'],
    ['量好了，拍张照——都放回海里啦！', '量好了，拍張照——都放回海裡啦！'], ['看海里！冲浪的人坐在板上等浪呢。', '看海裡！衝浪的人坐在板上等浪呢。'],
    ['海特-阿什伯里（嬉皮区）', '海特-阿什伯里（嬉皮區）'], ['建在公交中心屋顶上', '建在轉運中心屋頂上'], ['Ned Kahn 的《公交喷泉》', 'Ned Kahn 的《公車噴泉》'],
    ['桥塔离水面 227 米', '橋塔離水面 227 公尺'], ['主跨 1,280 米', '主跨 1,280 公尺'], ['约 15,000 平方米铜板', '約 15,000 平方公尺銅板'], ['（约 94 米）', '（約 94 公尺）'],
    ['巴松管', '低音管'], ['施特劳斯', '史特勞斯'],
  ];
  for (const [zh, tr] of want) assert.equal(tw(zh), tr, zh);
  // untouched: 米 that is not a length, the words the site keeps, plain Latin
  for (const [zh, tr] of [['米饭', '米飯'], ['米色的墙', '米色的牆'], ['3 米其林星', '3 米其林星'], ['玉米', '玉米'], ['这里', '這裡'], ['面包', '麵包'], ['乾隆', '乾隆'], ['国际橙围巾', '國際橙圍巾'], ['Fort Point 🌉 2026', 'Fort Point 🌉 2026']] as const) assert.equal(tw(zh), tr, zh);
  // every TAIWAN_WORDS value is stable, with the words and without
  for (const [, v] of L.TAIWAN_WORDS) { assert.equal(tw(v), v, v); assert.equal(conv(v), v, v); }
  // the rest of the site reads as before (its own tests pin 收起設置): the words only where asked
  assert.equal(conv('收起设置'), '收起設置');
  assert.equal(conv('桥塔离水面 227 米'), '橋塔離水面 227 米');
  // and the game's whole text stays put with the words too
  const moved: string[] = [];
  for (const s of opusLiterals()) { const a = tw(s); if (tw(a) !== a) moved.push(`${s} → ${a} → ${tw(a)}`); }
  assert.deepEqual(moved, []);
});

test('W9-L 繁體: translateText (the site\'s runtime) uses it — pick() then the JSX pass give the same text', async () => {
  await L.loadLocale('zh-Hant');
  for (const zh of ['你好，马里纳区！1915 年的世博会就在这儿办的。', '公园坡顶，有个金色的小家伙。', '中间那块大石头是整块花岗岩，喷泉就绕着它流。', '设置', '七站都在你的旅行本里啦。']) {
    const once = L.translateText(zh, 'zh-Hant');
    assert.equal(L.translateText(once, 'zh-Hant'), once, zh);
  }
  assert.equal(L.translateText('马里纳区 · 梅森堡', 'zh-Hant'), '馬里納區 · 梅森堡');
  // off the game's page (no location here) the site's words stay; on /opus-bay the Taiwan words apply
  assert.equal(L.translateText('设置', 'zh-Hant'), '設置');
  const g = globalThis as { location?: { pathname: string } };
  g.location = { pathname: '/opus-bay' };
  try {
    assert.equal(L.translateText('设置', 'zh-Hant'), '設定');
    assert.equal(L.translateText(L.translateText('七站都在你的旅行本里啦。', 'zh-Hant'), 'zh-Hant'), '七站都在你的旅行本裡啦。');
    g.location = { pathname: '/opus-bayou' };
    assert.equal(L.translateText('设置', 'zh-Hant'), '設置');
  } finally { delete g.location; }
});
