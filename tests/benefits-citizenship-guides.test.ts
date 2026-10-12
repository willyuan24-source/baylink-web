import assert from 'node:assert/strict';
import test from 'node:test';
import { benefitsCitizenshipGuides } from '../src/data/guides-benefits-citizenship';
import english from '../src/data/guides-benefits-citizenship-en.json';
import { OFFICIAL_FIGURES } from '../src/data/guide-editorial/official-figures';

const chinese = /[\u3400-\u9fff]/u;
const dictionary: Record<string, string> = english;
const textValues = (value: unknown): string[] => {
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return value.flatMap(textValues);
  if (value && typeof value === 'object') return Object.values(value).flatMap(textValues);
  return [];
};

test('benefits and citizenship advice retains official sources and consultation boundaries', () => {
  for (const guide of benefitsCitizenshipGuides) {
    const expectedDomain = guide.slug.includes('naturalization') ? 'uscis.gov' : 'ssa.gov';
    for (const source of guide.sources) {
      const url = new URL(source.url);
      assert.equal(url.protocol, 'https:');
      assert.ok(url.hostname === expectedDomain || url.hostname.endsWith(`.${expectedDomain}`), source.url);
    }
    assert.match(guide.sourceNote || '', /不.*(?:判断资格|资格结论)/u);
    assert.ok(guide.blocks.some(block => block.type === 'template'));
    // Dollar figures only where an official page was read (OFFICIAL_FIGURES); never an individual monthly amount.
    const text = textValues(guide).join('\n');
    for (const amount of text.match(/\$\s*[\d,.]*\d/gu) ?? []) {
      assert.ok(OFFICIAL_FIGURES.some(figure => figure.slug === guide.slug && figure.figure === amount), `${guide.slug}: ${amount} has no official read`);
    }
    assert.doesNotMatch(text, /每月(?:保证)?领取\d/u);
    assert.equal(guide.editionMonth, undefined);
  }
});

test('every reader-facing Chinese field has an English translation and no editor notes reach readers', () => {
  for (const value of textValues(benefitsCitizenshipGuides).filter(value => chinese.test(value))) {
    assert.ok(Object.hasOwn(dictionary, value), `Missing translation: ${value}`);
    assert.ok(dictionary[value].trim(), value);
    assert.doesNotMatch(dictionary[value], chinese, value);
  }
  for (const value of textValues(benefitsCitizenshipGuides)) assert.doesNotMatch(value, /本次|403|读取返回|可检索说明/u, value);
});

test('retirement timing and naturalization test versions cannot be treated as one universal rule', () => {
  const retirement = benefitsCitizenshipGuides.find(guide => guide.slug.includes('retirement'))!;
  const retirementText = textValues(retirement.blocks).join('\n');
  assert.match(retirementText, /四个月.*下一个月/u);
  assert.match(retirementText, /延后退休金不表示可以延后医保报名/u);
  assert.match(retirementText, /家庭福利|配偶／前配偶或遗属/u);
  const naturalization = benefitsCitizenshipGuides.find(guide => guide.slug.includes('naturalization'))!;
  const naturalizationText = textValues(naturalization.blocks).join('\n');
  assert.match(naturalizationText, /递交日期.*2025 年 10 月 20 日或以后递交的人考 2025 版/u);
  assert.match(naturalizationText, /之前递交的人考 2008 版/u);
  assert.match(naturalizationText, /年龄与年限要同时满足/u);
  // GUIDE-F: the old "naturalization interview and test" URL (find-study-materials-and-resources/…) is a 404; the guide
  // links Study for the Test, and its sources keep that page at its current URL (learn-about-citizenship/…, CNT-HOTFIX).
  const naturalizationUrls = textValues(naturalization).join('\n');
  assert.doesNotMatch(naturalizationUrls, /find-study-materials-and-resources\/the-naturalization-interview-and-test/u);
  assert.match(naturalizationUrls, /find-study-materials-and-resources\/study-for-the-test/u);
});
