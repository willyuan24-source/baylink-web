import assert from 'node:assert/strict';
import test from 'node:test';
import { benefitsCitizenshipGuides } from '../src/data/guides-benefits-citizenship';
import english from '../src/data/guides-benefits-citizenship-en.json';

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
    // Dollar figures and individualized guarantees would require a fresh agency decision.
    assert.doesNotMatch(textValues(guide).join('\n'), /\$\s*\d|每月(?:保证)?领取\d/u);
    assert.equal(guide.editionMonth, undefined);
  }
});

test('every reader-facing Chinese field has an English translation including source access limits', () => {
  for (const value of textValues(benefitsCitizenshipGuides).filter(value => chinese.test(value))) {
    assert.ok(Object.hasOwn(dictionary, value), `Missing translation: ${value}`);
    assert.ok(dictionary[value].trim(), value);
    assert.doesNotMatch(dictionary[value], chinese, value);
  }
  const naturalization = benefitsCitizenshipGuides.find(guide => guide.slug.includes('naturalization'))!;
  assert.match(dictionary[naturalization.sourceNote!], /403.*not completed/u);
});

test('retirement timing and naturalization test versions cannot be treated as one universal rule', () => {
  const retirement = benefitsCitizenshipGuides.find(guide => guide.slug.includes('retirement'))!;
  const retirementText = textValues(retirement.blocks).join('\n');
  assert.match(retirementText, /四个月.*下一个月/u);
  assert.match(retirementText, /延后退休金不表示可以延后医保报名/u);
  assert.match(retirementText, /家庭福利|配偶／前配偶或遗属/u);
  const naturalization = benefitsCitizenshipGuides.find(guide => guide.slug.includes('naturalization'))!;
  const naturalizationText = textValues(naturalization.blocks).join('\n');
  assert.match(naturalizationText, /递交日期.*适用版本/u);
  assert.match(naturalizationText, /不要把这一规则套用到另一版本/u);
  assert.match(naturalizationText, /年龄与年限要同时满足/u);
  assert.match(naturalization.sourceNote || '', /403.*未完成全页人工核验/u);
});
