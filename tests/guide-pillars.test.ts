import assert from 'node:assert/strict';
import test from 'node:test';
import { guides, getGuideBySlug, type Guide, type GuideBlock } from '../src/data/guides';
import { GUIDE_EDITORIAL } from '../src/data/guide-editorial';
import { OFFICIAL_FIGURES } from '../src/data/guide-editorial/official-figures';
import { GUIDE_TOPICS, guideTopicOf } from '../src/data/guide-topics';

// CNT-GUIDES (Wave 3): every topic has a 30-second pillar, new official figures are registered with a read and still printed,
// pillar prose stays plain (GUIDE-E), editor notes never reach readers, and 新手必看 is a short, current list (CNT-15).

const REWRITTEN = [
  'bay-area-chinese-senior-services-referral-guide', 'bay-area-medicare-hicap-medi-cal-guide', 'bay-area-dental-care-insurance-low-cost-guide',
  'bay-area-social-security-retirement-preparation-guide', 'bay-area-naturalization-official-path-guide', 'bay-area-free-tax-help-vita-calfile-guide',
  'california-tenant-deposit-rights-help-guide', 'california-driver-license-id-preparation-guide', 'bay-area-newcomer-first-month-checklist',
  'bay-area-rental-scam-guide',
];

const articleText = (guide: Guide) => JSON.stringify([guide.title, guide.subtitle, guide.summary, guide.blocks, guide.sources, guide.sourceNote ?? '']);
const bodyText = (block: GuideBlock): string => {
  switch (block.type) {
    case 'paragraph': case 'heading': return block.text;
    case 'list': case 'checklist': return block.items.join('\n');
    case 'template': case 'tip': case 'link': case 'cta': return `${'title' in block && block.title ? block.title : ''}\n${block.text}`;
    case 'route': return `${block.title}\n${block.text}\n${block.stops.map(stop => stop.title + stop.text).join('\n')}`;
    default: return '';
  }
};
const cjk = (text: string) => (text.match(/[㐀-鿿]/gu) || []).length;
// The 10-11 GUIDE audit's hedging measure (audit-1011/GUIDE/tools/data.mts), per 1,000 Chinese characters of body text.
const HEDGE = /确认|核对|核实|不能|不要|不等于|不代表|不保证|不承诺|为准|可能|另付|另计|以.{0,6}为准/gu;
const hedgesPerK = (guide: Guide) => {
  const body = guide.blocks.map(bodyText).join('\n');
  return 1000 * (body.match(HEDGE) || []).length / Math.max(1, cjk(body));
};
const strings = (value: unknown, key = ''): string[] => {
  if (['url', 'slug', 'cover', 'mapUrl', 'storeUrl', 'sourceUrl', 'directoryUrl', 'visitUrl', 'phone'].includes(key)) return [];
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return value.flatMap(item => strings(item));
  if (value && typeof value === 'object') return Object.entries(value).flatMap(([name, item]) => strings(item, name));
  return [];
};

test('every guide topic has at least one pillar with a carousel and 30 秒看懂', () => {
  for (const topic of GUIDE_TOPICS) {
    const pillars = Object.keys(GUIDE_EDITORIAL).filter(slug => {
      const guide = getGuideBySlug(slug);
      return guide && (topic.id === 'elders' ? slug === 'bay-area-chinese-senior-services-referral-guide' : guideTopicOf(guide) === topic.id);
    });
    assert.ok(pillars.length >= 1, `${topic.id}: no pillar`);
  }
});

test('every new official figure is registered with a dated read and still printed in its guide', () => {
  assert.ok(OFFICIAL_FIGURES.length >= 20);
  for (const figure of OFFICIAL_FIGURES) {
    const guide = getGuideBySlug(figure.slug);
    assert.ok(guide, figure.slug);
    assert.match(figure.url, /^https:\/\//u);
    assert.match(figure.readOn, /^2026-10-\d{2}$/u);
    assert.ok(figure.quote.length >= 20, `${figure.figure}: quote`);
    assert.ok(articleText(guide).includes(figure.figure), `${figure.slug}: ${figure.figure} is no longer in the article`);
  }
  // Every dollar amount in a rewritten pillar is one of the registered reads.
  for (const slug of REWRITTEN) {
    for (const amount of articleText(getGuideBySlug(slug)!).match(/\$\s*[\d,.]*\d/gu) ?? []) {
      assert.ok(OFFICIAL_FIGURES.some(figure => figure.slug === slug && figure.figure === amount), `${slug}: ${amount} has no registered read`);
    }
  }
});

test('pillars stay plain: hedging at most 12 per 1,000 characters on every pillar, at most 8 on the rewritten ten (GUIDE-E)', () => {
  // Every guide with a 30 秒看懂 card counts as a pillar in the audit (MASTER-PLAN §3.2 acceptance: ≤12).
  for (const slug of Object.keys(GUIDE_EDITORIAL)) {
    const perK = hedgesPerK(getGuideBySlug(slug)!);
    const ceiling = REWRITTEN.includes(slug) ? 8 : 12;
    assert.ok(perK <= ceiling, `${slug}: ${perK.toFixed(1)} hedges per 1,000 characters (ceiling ${ceiling})`);
  }
});

test('every source a pillar card cites has a circled mark (GuideFactCards prints ①–⑬; a higher index falls back to [14])', () => {
  for (const [slug, editorial] of Object.entries(GUIDE_EDITORIAL)) {
    const cited = [...editorial.keyFacts.map(fact => fact.source), ...(editorial.contacts ?? []).map(contact => contact.source), ...editorial.slides.map(slide => slide.source)];
    for (const source of cited) if (source !== undefined) assert.ok(source <= 13, `${slug}: source ${source}`);
  }
});

test('no editor or pipeline notes reach readers in any guide', () => {
  const NOTE = /本次直接读取|读取返回|返回 ?403|HTTP 403|可检索说明|未完成全页人工核验|直接读取未成功|本轮|本包|(?<!登)录入|抓取/u;
  for (const guide of guides) for (const text of strings(guide)) assert.doesNotMatch(text, NOTE, `${guide.slug}: ${text.slice(0, 80)}`);
});

test('新手必看 is at most eight current settling-in and anti-scam guides', () => {
  const essential = guides.filter(guide => guide.priority === 'P0');
  assert.ok(essential.length >= 4 && essential.length <= 8, `${essential.length} guides marked 新手必看`);
  for (const guide of essential) {
    assert.ok(guide.updatedAt >= '2026-10-01', `${guide.slug}: updated ${guide.updatedAt}`);
    assert.ok(['housing', 'documents', 'transport', 'health'].includes(guideTopicOf(guide)), `${guide.slug}: ${guideTopicOf(guide)}`);
  }
});

// CNT-GUIDES-2 (10-14): the 13 May/June guides re-read on official pages (H13), the 30-second records for every 长辈与家属,
// 新手必看 and 日常办事 guide (H08), and three new elder guides (H71) whose numbers and phones are each registered with a read.
const RE_DATED = [
  'bay-area-roommate-guide', 'rental-lease-checklist-before-signing', 'bay-area-used-trading-safety-guide', 'move-in-move-out-checklist',
  'local-service-safety-guide', 'bay-area-regions-explained', 'bay-area-where-to-live-first-month', 'baylink-safety-guide',
  'bay-area-first-rental-process', 'bay-area-without-car-guide', 'bay-area-moving-checklist', 'bay-area-used-furniture-appliance-guide',
  'baylink-posting-guide-for-trust',
];
const NEW_ELDER_GUIDES = ['bay-area-elder-scam-prevention-guide', 'bay-area-senior-transit-clipper-discounts-guide', 'bay-area-chinese-language-resource-map'];
const PHONE = /(?:1-)?(?:\(\d{3}\) |\d{3}[-.])\d{3}[-.]\d{4}/gu;

test('the 13 May/June guides are re-dated after a read and, with every 30-second guide added in October, stay at most 8 hedges per 1,000 characters', () => {
  for (const slug of RE_DATED) assert.ok(getGuideBySlug(slug)!.updatedAt >= '2026-10-14', `${slug}: ${getGuideBySlug(slug)!.updatedAt}`);
  assert.equal(guides.filter(guide => guide.updatedAt < '2026-07-01').length, 0, 'no published guide still shows a May/June date');
  for (const slug of [...RE_DATED, ...Object.keys(GUIDE_EDITORIAL).filter(slug => !REWRITTEN.includes(slug))]) {
    const perK = hedgesPerK(getGuideBySlug(slug)!);
    assert.ok(perK <= 8, `${slug}: ${perK.toFixed(1)} hedges per 1,000 characters`);
  }
});

test('the three new elder guides register every dollar amount and phone number with a dated official read', () => {
  for (const slug of NEW_ELDER_GUIDES) {
    const guide = getGuideBySlug(slug)!;
    assert.ok(guide, slug);
    assert.ok(GUIDE_EDITORIAL[slug], `${slug}: 30-second record`);
    const article = articleText(guide);
    const registered = (figure: string) => OFFICIAL_FIGURES.some(row => row.slug === slug && row.figure === figure && row.readOn === '2026-10-14');
    for (const amount of article.match(/\$\s*[\d,.]*\d/gu) ?? []) assert.ok(registered(amount), `${slug}: ${amount} has no registered read`);
    for (const phone of article.match(PHONE) ?? []) assert.ok(registered(phone), `${slug}: ${phone} has no registered read`);
  }
});

// H13 review (10-15): the rent and used-goods checklists say their don'ts once, in one 注意 list after the how-to sections;
// the other sections stay affirmative ("能不能…" and "要不要…" questions are not directives).
const WATCH_OUT_GUIDES = ['move-in-move-out-checklist', 'rental-lease-checklist-before-signing', 'bay-area-used-trading-safety-guide', 'bay-area-used-furniture-appliance-guide'];
const DIRECTIVE = /(?<!能)不能|(?<!要)不要|不建议|(?<![特分区个告类级性派识辨鉴差])别(?![人墅的处])/u;

test('the rent and used-goods checklists keep their don\'ts in one 注意 list', () => {
  for (const slug of WATCH_OUT_GUIDES) {
    const blocks = getGuideBySlug(slug)!.blocks;
    const at = blocks.flatMap((block, index) => block.type === 'heading' && block.text === '注意' ? [index] : []);
    assert.equal(at.length, 1, `${slug}: one 注意 heading`);
    const list = blocks[at[0] + 1];
    assert.equal(list?.type, 'checklist', `${slug}: the 注意 heading opens a checklist`);
    assert.ok(list.type === 'checklist' && list.items.length >= 3 && list.items.every(item => DIRECTIVE.test(item)), `${slug}: every 注意 item is a don't`);
    const elsewhere = blocks.filter((_, index) => index !== at[0] && index !== at[0] + 1).flatMap(block => bodyText(block).split('\n'));
    assert.deepEqual(elsewhere.filter(line => DIRECTIVE.test(line)), [], `${slug}: no don'ts outside the 注意 list`);
  }
});
