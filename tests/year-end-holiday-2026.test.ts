import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { getGuideBySlug, type Guide } from '../src/data/guides';
import { GUIDE_EDITORIAL } from '../src/data/guide-editorial';
import { guideTopicOf } from '../src/data/guide-topics';

// CNT-YEAREND (2026-10-17): 2027 figures beside the 2026 ones, dates that must not be merged, figures that are not published yet,
// and one holiday-hours guide whose every agency line keeps its own evidence level.

const HOLIDAY = 'bay-area-holiday-hours-thanksgiving-new-year-2026';
const texts = (value: unknown): string[] => typeof value === 'string' ? [value] : Array.isArray(value) ? value.flatMap(texts) : value && typeof value === 'object' ? Object.values(value).flatMap(texts) : [];
const body = (slug: string) => texts(getGuideBySlug(slug)!.blocks).join('\n');
const guide = (slug: string): Guide => { const found = getGuideBySlug(slug); assert.ok(found, slug); return found; };

test('the holiday guide is one dated guide with a 30-second record, filed under 日常办事 and linked from the guides that need it', () => {
  const holiday = guide(HOLIDAY);
  assert.equal(holiday.editionStartDate, '2026-11-26');
  assert.equal(holiday.editionThroughDate, '2027-01-01');
  assert.equal(holiday.updatedAt, '2026-10-17');
  assert.ok(GUIDE_EDITORIAL[HOLIDAY], '30-second record');
  assert.equal(guideTopicOf(holiday), 'documents');
  assert.ok(holiday.sources.length >= 30, `${holiday.sources.length} sources`);
  for (const source of holiday.sources) assert.match(source.url, /^https:\/\//u);
  for (const slug of ['california-driver-license-id-preparation-guide', 'bay-area-social-security-retirement-preparation-guide', 'bay-area-medicare-hicap-medi-cal-guide',
    'bay-area-commute-guide', 'bay-area-senior-transit-clipper-discounts-guide', 'bay-area-library-starter-guide']) {
    assert.ok(guide(slug).blocks.some(block => block.type === 'link' && block.url === `/guides/${HOLIDAY}`), `${slug} links to the holiday guide`);
  }
});

test('every agency line covers the six dates and names the evidence behind each', () => {
  const holiday = guide(HOLIDAY);
  const LABEL = /【(?:日期表|常设规则|县政府公告|县假日表|未公布)/u;
  const sections = ['DMV 和社安局（SSA）', '九个县的社会服务（福利）办公室', '八个图书馆系统', '五家公交'];
  let lines = 0;
  for (const heading of sections) {
    const at = holiday.blocks.findIndex(block => block.type === 'heading' && block.text === heading);
    assert.ok(at >= 0, heading);
    const list = holiday.blocks.slice(at + 1).find(block => block.type === 'list');
    assert.ok(list && list.type === 'list', `${heading}: list`);
    for (const item of list.items) {
      lines++;
      assert.match(item, LABEL, item.slice(0, 40));
      if (item.startsWith('Muni 跨年夜')) continue; // the New Year's Eve fare note under the Muni line
      for (const day of ['11/26', '11/27', '12/24', '12/25', '12/31', '1/1']) {
        assert.ok(item.includes(day) || item.includes('六天') || (day === '11/27' && /感恩节次日|次日/u.test(item)) || (day === '12/24' && /平安夜/u.test(item)), `${item.slice(0, 30)}: ${day}`);
      }
    }
  }
  assert.equal(lines, 2 + 9 + 8 + 6, 'DMV + SSA, nine counties, eight library systems, five transit agencies (+ the Muni New Year’s Eve note)');
  // The three rules from the research notes, said once, up front.
  const text = body(HOLIDAY);
  assert.match(text, /不是每个窗口的营业公告/u);
  assert.match(text, /没有说网上服务停止/u);
  assert.match(text, /本身不保证跨年夜加班或免费乘车/u);
  // Muni's New Year's Eve free-fare item belongs to the fare changes that start January 4, 2027, so 2026 stays unannounced.
  const muniEve = holiday.blocks.flatMap(block => (block.type === 'list' ? block.items : [])).find(item => item.startsWith('Muni 跨年夜'));
  assert.ok(muniEve && muniEve.includes('2027 年 1 月 4 日起生效') && muniEve.includes('【未公布】'), 'Muni New Year’s Eve line');
  assert.doesNotMatch(muniEve ?? '', /【常设规则】/u);
  assert.equal(holiday.editionMonth, '2027-01', 'edition month follows editionThroughDate so related cards and BayBay keep the guide through January 1');
  // Nothing unannounced is presented as open as usual.
  assert.doesNotMatch(text, /照常|正常开放|正常营业/u);
});

test('Social Security shows 2027 beside 2026, and the federal SSI standard apart from California’s SSP', () => {
  const text = body('bay-area-social-security-retirement-preparation-guide');
  for (const figure of ['2.8%', '3.6%', '$1,890', '$1,970', '$994', '$1,029', '$1,491', '$1,544', '$24,480', '$25,560', '$65,160', '$67,920']) assert.ok(text.includes(figure), figure);
  assert.match(text, /SSP/u);
  assert.match(text, /2026 年 12 月 31 日/u);
  assert.doesNotMatch(text, /\$7,880/u, 'no computed four-credit total');
});

test('figures that are not published stay unpublished, in the agency’s words, never rolled forward', () => {
  const medicare = body('bay-area-medicare-hicap-medi-cal-guide');
  assert.match(medicare, /2027 年的这三个金额还没公布/u);
  assert.match(medicare, /What you pay in 2026/u);
  assert.doesNotMatch(medicare, /2027 年[^。]{0,20}Part B[^。]{0,10}\$\d/u);
  // Medi-Cal: who the asset test applies to, the per-person step after July 2027, and the 10-person cap.
  assert.match(medicare, /只适用于这几类人/u);
  assert.match(medicare, /\$1,550/u);
  assert.match(medicare, /最多按 10 人计算/u);
  const tax = body('bay-area-free-tax-help-vita-calfile-guide');
  assert.match(tax, /没有全项目统一的收入上限/u);
  assert.match(tax, /IRS 还没公布/u);
  assert.match(tax, /不是个人报税的开放日/u);
  assert.match(tax, /2023、2024 和 2025 税务年度/u);
  const transit = body('bay-area-senior-transit-clipper-discounts-guide');
  assert.match(transit, /2027 年的上限还没公布/u);
  assert.match(transit, /2026 年的上限是一人家庭 \$31,920/u);
});

test('Muni, Lifeline and Caltrain dates stay separate, and the retired MuniMobile single ride is gone', () => {
  const muni = body('bay-area-october-muni-clipper-payment-update-2026');
  for (const line of ['1 月 1 日：Lifeline', '1 月 3 日：按 SFMTA 公布的退场计划，MuniMobile', '1 月 4 日：Muni 新票价']) assert.ok(muni.includes(line), line);
  assert.doesNotMatch(muni, /停售的只是单程票/u);
  const transit = body('bay-area-senior-transit-clipper-discounts-guide');
  assert.doesNotMatch(transit, /Clipper 或 MuniMobile/u);
  assert.match(transit, /2027 年 1 月 4 日起：Clipper 单程 \$1\.50/u);
  assert.match(transit, /长者 Clipper 卡只看年龄/u);
  const commute = body('bay-area-commute-guide');
  assert.match(commute, /Caltrain（2027 年 1 月 1 日起）/u);
  assert.match(commute, /BART 另有一份资金不足时的应急方案/u);
});

test('minimum wage and CalFresh: one sourced line each, CalFresh presented as current since 10/1/2026', () => {
  const job = guide('bay-area-part-time-job-safety-guide');
  assert.match(body(job.slug), /全州最低工资从 2027 年 1 月 1 日起是每小时 \$17\.40/u);
  assert.ok(job.sources.some(source => source.url.includes('dir.ca.gov')));
  const help = guide('bay-area-311-211-local-help-guide');
  assert.match(body(help.slug), /从 2026 年 10 月起、到 2027 年 9 月底的这一年度，每月最高额是 1 人 \$306.*已经在用/u);
  assert.ok(help.sources.some(source => source.url.includes('cdss.ca.gov')));
});

test('the holiday guide and the new lines have English', () => {
  const files: string[] = JSON.parse(readFileSync(new URL('../scripts/english-sources.json', import.meta.url), 'utf8'));
  assert.ok(files.includes('src/data/holiday-hours-2026-en.json'));
  const dictionary: Record<string, string> = Object.assign({}, ...files.map(file => JSON.parse(readFileSync(new URL(`../${file.replace('src/i18n/../', 'src/')}`, import.meta.url), 'utf8'))));
  const SKIP = new Set(['slug', 'url', 'category', 'priority', 'updatedAt', 'editionMonth', 'editionStartDate', 'editionThroughDate', 'emoji']);
  const strings = (value: unknown, key = ''): string[] => SKIP.has(key) ? [] : typeof value === 'string' ? [value] : Array.isArray(value) ? value.flatMap(item => strings(item)) : value && typeof value === 'object' ? Object.entries(value).flatMap(([name, item]) => strings(item, name)) : [];
  for (const slug of [HOLIDAY, 'bay-area-part-time-job-safety-guide', 'bay-area-311-211-local-help-guide']) {
    for (const text of strings(guide(slug)).filter(item => /[㐀-鿿]/u.test(item))) {
      assert.ok(Object.hasOwn(dictionary, text.trim().replace(/\s+/g, ' ')) || Object.hasOwn(dictionary, text), `${slug}: ${text.slice(0, 50)}`);
      assert.doesNotMatch(dictionary[text] ?? dictionary[text.trim().replace(/\s+/g, ' ')], /[㐀-鿿]/u, text.slice(0, 50));
    }
  }
});
