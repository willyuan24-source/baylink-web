import assert from 'node:assert/strict';
import test from 'node:test';
import { MONTHLY_EVENTS } from '../src/data/monthly-edition';
import { currentOpenings } from '../src/data/local-discoveries';
import { currentFreebies } from '../src/data/october-offers';
import { PLANNER_EVENTS } from '../src/data/planner-catalog';
import { guides } from '../src/data/guides';
import { FILLER_SENTENCES } from '../src/data/editorial-overlay/apply';
import { readerPlanLines } from '../src/features/detail/reader-text';
import { loadLocale, translateText } from '../src/i18n/locale';
import { discoveryCheckedAt } from '../scripts/discovery-checked-at';
import { openingChip } from '../src/lib/event-facts';
import { fitSize, textWidth } from '../src/lib/share-card-svg';

/** CNT-HOTFIX-2 (2026-10-13 source reads, docs/source-reads-2026-10.md "CNT-HOTFIX-2"). */
const event = (id: string) => { const item = MONTHLY_EVENTS.find(row => row.id === id); assert.ok(item, id); return item; };
const HAN = /[㐀-鿿]/u;

// Library systems whose own pages say their programs are free (SFPL, SMCL, SJPL, Marin, SCCLD, Sonoma).
const POLICY_FREE = [
  'smcl-millbrae-chinese-storytime-oct-2026', 'smcl-portola-valley-mid-autumn-lantern-2026', 'smcl-brisbane-sugar-skull-2026',
  'smcl-san-carlos-ofrenda-musical-2026', 'smcl-foster-city-nidhi-chanani-2026', 'smcl-pacifica-robotics-team5940-2026',
  'smcl-atherton-diwali-henna-2026', 'smcl-portola-valley-nahuatl-prints-2026', 'smcl-brisbane-puzzle-swap-2026',
  'smcl-brisbane-zuni-water-jar-2026', 'smcl-north-fair-oaks-diwali-henna-2026', 'smcl-belmont-friends-book-sale-nov-2026',
  'smcl-pacifica-ofrenda-musical-nov14-2026', 'smcl-san-carlos-friends-book-sale-nov15-2026', 'sjpl-almaden-sounds-of-south-asia-2026',
  'sjpl-berryessa-diwali-2026', 'sjpl-village-square-thanksgiving-2026', 'marin-bolinas-saturday-crafts-nov14-2026',
  'marin-corte-madera-quiltmaking-talk-2026', 'marin-point-reyes-librito-concert-2026', 'sccl-campbell-friends-book-sale-nov14-2026',
  'sf-main-halloween-costume-swap-oct15-2026', 'sf-halloween-broadside-printing-oct17-2026', 'sf-marina-library-open-house-oct17-2026',
  'octnov-healdsburg-tech-help-2026', 'octnov-petaluma-ancestral-sounds-2026',
];
// Systems with no such policy page (ACL, CCCL, Napa County, San Leandro) and no "free" on the event page stay unknown.
const NO_POLICY = [
  'acl-cherryland-chinese-storytimes-oct24-2026', 'acl-dublin-halloween-crafts-costume-2026', 'ccclib-crockett-halloween-hullabaloo-2026',
  'ccclib-hercules-library-20th-2026', 'r2-calistoga-ghost-stories-2026', 'r2-american-canyon-halloween-party-2026', 'san-leandro-trick-storytime-2026',
];

test('H69: library programs are free where the library system publishes that policy, and only there', async () => {
  await loadLocale('en');
  for (const id of POLICY_FREE) {
    const item = event(id);
    assert.equal(item.cost, 'free', id);
    assert.match(item.costLabel, /^(图书馆活动免费|免费入场)/u, id);
    assert.doesNotMatch(translateText(item.costLabel, 'en'), HAN, `${id} has English`);
    assert.equal(PLANNER_EVENTS.find(row => row.id === id)!.planning?.admissionUsd, 0, `${id}: free entry is $0 for the planner`);
  }
  const almaden = event('sjpl-almaden-20th-harvest-festival-2026');
  assert.equal(almaden.cost, 'mixed', 'free entry, ticketed haunted hallway, pumpkin patch, games and crafts');
  assert.equal(almaden.price?.free, true);
  assert.equal(PLANNER_EVENTS.find(row => row.id === almaden.id)!.planning?.admissionUsd, null);
  for (const id of NO_POLICY) assert.equal(event(id).cost, 'unknown', id);
});

test('H70: the Millbrae storytime is for children of any age (SMCL: "Children of all ages")', async () => {
  await loadLocale('en');
  const storytime = event('smcl-millbrae-chinese-storytime-oct-2026');
  assert.equal(storytime.ageChip, '儿童（任何年龄）');
  assert.deepEqual(storytime.audience, ['儿童与家长']);
  assert.equal(translateText(storytime.ageChip!, 'en'), 'Children (any age)');
  assert.equal(translateText('儿童与家长', 'en'), 'Children and parents');
});

test('H59: BORP shows both published celebration times in every language and says to arrive by 15:00', async () => {
  await loadLocale('en');
  const borp = event('berkeley-borp-adaptive-sports-expo-oct17-2026');
  assert.match(borp.dateLabel, /15:00 或 15:30/);
  assert.doesNotMatch(borp.dateLabel, /15:30–17:30/, 'the label no longer gives the FAQ time as the only one');
  const line = borp.plan.find(text => text.includes('社区庆祝'))!;
  for (const fact of ['15:00–16:30', '15:30–17:30', '15:00 前到']) assert.ok(line.includes(fact), fact);
  const english = translateText(line, 'en');
  for (const fact of ['3:00–4:30 pm', '3:30–5:30 pm', 'arrive by 3 pm']) assert.ok(english.includes(fact), fact);
  assert.doesNotMatch(english, HAN);
  assert.doesNotMatch(translateText(borp.dateLabel, 'en'), HAN);
  assert.equal(translateText(line, 'zh-Hant').includes('15:00–16:30'), true);
});

test('H68: paid events keep no copied cost line or filler; opening labels drop "first day not verified" tails', () => {
  for (const id of ['sf-young-miko-2026', 'sf-exploratorium-after-dark-15-oct2026']) {
    const lines = readerPlanLines(event(id));
    assert.ok(lines.length > 0, id);
    assert.ok(!lines.some(line => line.startsWith('费用与参加条件') || FILLER_SENTENCES.some(filler => line.includes(filler))), `${id}: ${lines.join(' | ')}`);
  }
  assert.ok(!event('sf-potrero-hill-festival-oct17-2026').plan.some(line => line.includes('FAQ：')), 'no line that only pointed at a dropped link');
  for (const shop of currentOpenings) assert.doesNotMatch(shop.dateLabel, /未核实|非确认|首营业日未公布|仅为媒体报道的预计开业窗口/u, shop.id);
  const capriciano = currentOpenings.find(shop => shop.id === 'roundup-capriciano-santarosa-2026')!;
  assert.equal(capriciano.dateLabel, '2026 年初秋已开业', 'status-open shops keep 已: a season alone reads as a forecast');
});

test('driver-licence guide: the 10-day rule is not extended by booking, links the statute, and says how many proofs of address', async () => {
  await loadLocale('en');
  const guide = guides.find(item => item.slug === 'california-driver-license-id-preparation-guide')!;
  const blocks = guide.blocks as { type: string; text?: string; title?: string; url?: string }[];
  const start = blocks.findIndex(block => block.type === 'heading' && block.text?.startsWith('新居民'));
  const section = blocks.slice(start, blocks.findIndex((block, index) => index > start && block.type === 'heading'));
  assert.ok(section.some(block => block.type === 'paragraph' && block.text!.includes('12505(c)') && block.text!.includes('法条没有因递交申请或预约 DMV 而延长这 10 天的规定')));
  assert.ok(section.some(block => block.type === 'link' && block.url === 'https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=VEH&sectionNum=12505.'));
  assert.ok(section.some(block => block.type === 'paragraph' && /普通驾照至少一份.*REAL ID 要两份/u.test(block.text!)));
  assert.ok(section.some(block => block.type === 'paragraph' && block.text!.includes('材料一时不齐，也要按时递交申请和费用')));
  for (const block of section) for (const text of [block.text, block.title]) if (text && HAN.test(text)) assert.doesNotMatch(translateText(text, 'en'), HAN, text);
});

test('SSA guide: ten years in the U.S. is not the same as 40 work credits', async () => {
  await loadLocale('en');
  const guide = guides.find(item => item.slug === 'bay-area-social-security-retirement-preparation-guide')!;
  const paragraph = (guide.blocks as { type: string; text?: string }[]).find(block => block.type === 'paragraph' && block.text?.includes('住满十年'))!;
  assert.ok(paragraph.text!.includes('缴社安税的工作'));
  assert.match(translateText(paragraph.text!, 'en'), /ten years of living in the U\.S\. is not the same as 40 credits/);
});

test('discovery context: checkedAt is the newest verifiedAt in the data, not the build day', () => {
  assert.equal(discoveryCheckedAt([{ verifiedAt: '2026-10-02' }, {}, { verifiedAt: '2026-10-07' }, { verifiedAt: '2026-09-30' }]), '2026-10-07');
  const newest = [...currentFreebies, ...currentOpenings].map(item => item.verifiedAt).filter(Boolean).sort().at(-1);
  assert.equal(discoveryCheckedAt([...currentFreebies, ...currentOpenings]), newest);
  assert.throws(() => discoveryCheckedAt([{}]));
});

test('opening chips fit the share card cover in every language (374 px at the 44 px floor)', async () => {
  await loadLocale('en');
  // renderShareCardSvg prints openingChip as the cover's big text: fitSize(text, coverWidth - 96, 128, 44), not clipped.
  const fits = (text: string) => textWidth(text, fitSize(text, 374, 128, 44)) <= 374;
  const chips = currentOpenings.map(shop => openingChip(shop, '2026-10-14'));
  for (let month = 1; month <= 12; month++) for (const day of ['09', '28', '30']) {
    if (month === 2 && day === '30') continue;
    const openedOn = `2026-${String(month).padStart(2, '0')}-${day}`;
    for (const status of ['open', 'soft_open'] as const) chips.push(openingChip({ status, openedOn }, '2026-12-31'));
    chips.push(openingChip({ status: 'announced', openedOn }, '2026-01-01'));
  }
  for (const chip of chips) for (const text of [chip.zh, translateText(chip.zh, 'zh-Hant'), chip.en]) assert.ok(fits(text), `${text}: ${textWidth(text, fitSize(text, 374, 128, 44)).toFixed(0)} px`);
});
