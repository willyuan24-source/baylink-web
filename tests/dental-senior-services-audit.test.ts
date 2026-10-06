import assert from 'node:assert/strict';
import test from 'node:test';
import { dentalSeniorServiceGuides } from '../src/data/guides-dental-senior-services';
import { guides, getGuideBySlug } from '../src/data/guides';
import { searchGuides } from '../src/lib/guide-search';
import { contentReviewQueue, guideContentReviewRecord } from '../src/lib/content-review';
import english from '../src/i18n/dental-senior-services-en.json';

const dentalSlug = 'bay-area-dental-care-insurance-low-cost-guide';
const seniorSlug = 'bay-area-chinese-senior-services-referral-guide';
const chinese = /[\u3400-\u9fff]/u;
const dictionary: Record<string, string> = english;
test('dental access failure remains manual and care eligibility is reviewed monthly without renewing source dates', () => {
  const rows = contentReviewQueue(dentalSeniorServiceGuides.map(guideContentReviewRecord), '2026-10-06');
  const dental = rows.find(row => row.id === dentalSlug)!;
  const senior = rows.find(row => row.id === seniorSlug)!;
  assert.equal(dental.status, 'manual-review');
  assert.match(dental.manualReviewReason || '', /DHCS dentist directory could not be read directly/);
  for (const row of [dental, senior]) {
    assert.equal(row.risk, 'health-legal-financial');
    assert.equal(row.cadenceDays, 30);
    assert.equal(row.dateMeaning, 'content-updated');
    assert.equal(row.verifiedAt, getGuideBySlug(row.id)!.updatedAt);
  }
  assert.equal(contentReviewQueue([senior], '2026-11-05')[0].status, 'due');
  assert.equal(contentReviewQueue([dental], '2026-11-05')[0].status, 'manual-review');
});
const textValues = (value: unknown): string[] => {
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return value.flatMap(textValues);
  if (value && typeof value === 'object') return Object.values(value).flatMap(textValues);
  return [];
};

test('dental and Chinese senior service routes are published once and findable in three reading languages', () => {
  for (const slug of [dentalSlug, seniorSlug]) {
    assert.equal(guides.filter(guide => guide.slug === slug).length, 1);
    assert.ok(getGuideBySlug(slug));
  }
  for (const query of ['牙医', '牙科', '牙齿', 'dental', 'dentist']) {
    assert.ok(searchGuides(guides, { query, locale: 'zh-Hans' }).some(({ guide }) => guide.slug === dentalSlug), query);
  }
  for (const query of ['中文老人', '中文长者', '长者服务', 'Chinese seniors', 'senior services']) {
    assert.ok(searchGuides(guides, { query, locale: 'zh-Hans' }).some(({ guide }) => guide.slug === seniorSlug), query);
  }
  assert.ok(searchGuides(guides, { query: '牙醫', locale: 'zh-Hant' }).some(({ guide }) => guide.slug === dentalSlug));
  assert.ok(searchGuides(guides, { query: '中文長者', locale: 'zh-Hant' }).some(({ guide }) => guide.slug === seniorSlug));
  assert.ok(searchGuides(guides, { query: 'dental care', locale: 'en' }).some(({ guide }) => guide.slug === dentalSlug));
  assert.ok(searchGuides(guides, { query: 'Chinese seniors', locale: 'en' }).some(({ guide }) => guide.slug === seniorSlug));
});

test('every reader-facing field has complete English copy and a bounded reviewed source claim', () => {
  for (const value of textValues(dentalSeniorServiceGuides).filter(value => chinese.test(value))) {
    assert.ok(Object.hasOwn(dictionary, value), `Missing English: ${value}`);
    assert.ok(dictionary[value].trim(), value);
    assert.doesNotMatch(dictionary[value], chinese, value);
  }
  for (const guide of dentalSeniorServiceGuides) {
    assert.equal(guide.updatedAt, '2026-10-06');
    assert.equal(guide.editionMonth, undefined);
    assert.ok(guide.blocks.some(block => block.type === 'template'));
    assert.match(guide.sourceNote || '', /不.*(?:判断个人|诊断牙病)/u);
    assert.ok(guide.sources.length >= 6);
    for (const source of guide.sources) {
      const url = new URL(source.url);
      assert.equal(url.protocol, 'https:');
      assert.ok(['medicare.gov', 'dhcs.ca.gov', 'nems.org', 'ucsf.edu', 'aging.ca.gov', 'selfhelpelderly.org', 'familybridges.org'].some(domain => url.hostname === domain || url.hostname.endsWith(`.${domain}`)), source.url);
    }
    assert.doesNotMatch(textValues(guide).join('\n'), /\$\s*\d|保证(?:免费|接诊|批准)/u);
  }
});

test('dental benefits keep the updated effective date, individual plan checks and real lower-cost routes', () => {
  const guide = getGuideBySlug(dentalSlug)!;
  const body = textValues(guide.blocks).join('\n');
  assert.match(body, /2027 年 7 月 1 日/u);
  assert.match(body, /不是所有成年人的牙科都取消/u);
  assert.match(body, /申请时间.*覆盖范围.*例外/u);
  assert.match(body, /不是免费诊所/u);
  assert.match(body, /每年重新登记/u);
  assert.match(body, /书面治疗计划|书面报价/u);
  assert.match(body, /不同.*诊所|诊所的规则不同/u);
  assert.match(guide.sourceNote!, /目录原站直接读取未成功/u);
  assert.ok(guide.sources.some(source => source.url.includes('medi-cal-dental-benefit-changes/')));
});

test('senior routes preserve geography, updated provider contacts and distinct care assessments', () => {
  const guide = getGuideBySlug(seniorSlug)!;
  const body = textValues(guide.blocks).join('\n');
  for (const county of ['San Francisco', 'San Mateo', 'Santa Clara', 'Alameda', 'Contra Costa', 'Marin', 'Sonoma', 'Napa', 'Solano']) assert.ok(body.includes(county), county);
  assert.match(body, /医生书面许可/u);
  assert.match(body, /415-677-7556/u);
  assert.match(body, /510-839-2022/u);
  assert.match(body, /510-763-9017/u);
  assert.match(body, /志愿陪伴不是医疗或全天居家照护/u);
  assert.match(body, /候补/u);
  assert.match(guide.sourceNote!, /不等于每个地点、时段和项目都可安排/u);
});
