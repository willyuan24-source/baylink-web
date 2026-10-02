import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test, { after } from 'node:test';

/**
 * Wave 9 · lane R (W9-R5): the catalog's words as the game shows them (review R§6: 「售票详情页本次触发等待页，未核实余票」 on
 * Renée Fleming's card — in English "The ticket details page displayed a waiting screen during this check" —,
 * 「收录核实日之后的三场」 / 「节目页时长约…」 on the opera's, two sentences joined by a bare space). data/publicText.ts drops
 * the editors' working clauses, keeps the honest ones without 「本次」, and punctuates joined sentences, in zh and in en;
 * every event's shown fields pass it clean (all regions: a relaxed 这周去哪 shows the Bay's too).
 */

const L = await import('../src/i18n/locale');
const { publicText, publicLines, INTERNAL_RE, INTERNAL_EN_RE } = await import('../src/opus-bay/data/publicText');
const CATALOG = JSON.parse(fs.readFileSync(path.resolve('public/planner-catalog.json'), 'utf8')) as { events: { id: string; region: string; summary?: string; costLabel?: string; dateLabel?: string; plan?: string[] }[] };
const FLEMING = '费用与参加条件：票价尚未核实，以官方购票页为准 按场次购买门票；售票详情页本次触发等待页，未核实余票';
const OPERA = '英语歌剧呈现玛丽女王的权力与命运；收录核实日之后的三场。10 月 4 日午场后有艺术家交流。';
const OPERA_DATE = '9/29–10/4 · 9/29、10/2 19:30；10/4 14:00；节目页时长约 2 小时 51 分钟';
after(async () => { await L.setLocale('zh-Hans', false); });

test('W9-R5 publicText (zh): the working notes go, the honest uncertainty stays without 本次, joined sentences get a ；', () => {
  assert.equal(publicText(FLEMING), '费用与参加条件：票价尚未核实，以官方购票页为准；按场次购买门票；未核实余票');
  assert.equal(publicText(OPERA), '英语歌剧呈现玛丽女王的权力与命运；10 月 4 日午场后有艺术家交流。');
  assert.equal(publicText(OPERA_DATE), '9/29–10/4 · 9/29、10/2 19:30；10/4 14:00；时长约 2 小时 51 分钟');
  assert.equal(publicText('食物饮料另购；本次未找到单独入场费说明。'), '食物饮料另购；未找到单独入场费说明。');
  assert.equal(publicText('官方页面提供购票入口，座位实时票价及费用未在本次取得。 所有观众均需票'), '官方页面提供购票入口，座位实时票价及费用未取得。所有观众均需票');
  assert.equal(publicText('市历列活动18:00开始；电影日落后放映，具体结束时间本次未复核。'), '市历列活动18:00开始；电影日落后放映，具体结束时间未复核。');
  assert.equal(publicText('单场详情点击本次被阻；只确认系列公告中的日期、场地与免费，不补造具体时刻。'), '只确认系列公告中的日期、场地与免费。');
  assert.equal(publicText('票价尚未核实，以官方购票页为准'), '票价尚未核实，以官方购票页为准', 'honest, kept as it is');
  assert.equal(publicText('Ferry Building 外 · 2nd Street'), 'Ferry Building 外 · 2nd Street', 'Latin words keep their spaces');
  assert.equal(publicText(undefined), '');
  assert.deepEqual(publicLines(['费用与参加条件：售票详情页触发等待页。', '出发前：带水']), ['出发前：带水'], 'a line left with only its heading goes');
});

test('W9-R5 publicText (en): the site’s translation of the original, then the same filter in English', async () => {
  await L.setLocale('en', false);
  assert.equal(publicText(FLEMING, 'en'), 'Cost and eligibility: Ticket prices have not been verified; check the official ticket page. Purchase tickets for a specific performance.');
  assert.equal(publicText(OPERA, 'en'), 'This English-language opera explores Queen Mary\'s power and fate. An artist discussion follows the October 4 matinee.');
  assert.equal(publicText(OPERA_DATE, 'en'), '9/29–10/4 · 9/29 and 10/2 at 19:30; 10/4 at 14:00. Running time: about 2 hours 51 minutes.');
  const ad = publicText('费用与参加条件：普通After Dark官网参考价$22.95；该场最终票价及附加项目按票页 需购票；Tactile Dome等附加项目另订另付。', 'en');
  assert.match(ad, /\$22\.95; check this session's ticket page/, `a price is not a sentence end: ${ad}`);
  assert.equal(publicText('没有翻译的一句话', 'en'), '没有翻译的一句话', 'not in the dictionary: the zh text for the site runtime');
  assert.equal(publicText('费用与参加条件：票价尚未核实，以官方购票页为准 通过场馆官方售票入口购票；票价与余票请以官方售票页为准', 'en'), 'Costs and participation: Ticket prices have not been verified; check official ticketing. Buy through the venue\'s official ticket link. Check the official ticket page for prices and availability.');
});

test('W9-R5 every event’s shown fields (summary, cost, date, plan) carry no working note after the filter, zh and en', async () => {
  await L.setLocale('en', false);
  let changed = 0;
  let checked = 0;
  for (const e of CATALOG.events) {
    for (const s of [e.summary, e.costLabel, e.dateLabel, ...(e.plan ?? [])]) {
      if (!s) continue;
      checked++;
      const zh = publicText(s);
      if (zh !== s) changed++;
      assert.doesNotMatch(zh, INTERNAL_RE, `${e.id}: ${zh}`);
      assert.doesNotMatch(zh, /[㐀-鿿。；]\s+[㐀-鿿]/,`${e.id}: two sentences still joined by a space: ${zh}`);
      const en = publicText(s, 'en');
      if (!/[㐀-鿿]/.test(en)) assert.doesNotMatch(en, INTERNAL_EN_RE, `${e.id} (en): ${en}`);
      assert.ok(en.trim().length > 0 || zh.trim().length === 0, `${e.id}: the English text vanished: ${s}`);
    }
  }
  assert.ok(checked > 500 && changed >= 20, `the filter changed ${changed} of ${checked} catalog texts (Fleming, the opera, the joined ones …)`);
});
