import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { commuteGuide } from '../src/data/guide-commute-refresh';
import { guides } from '../src/data/guides';
import english from '../src/i18n/commute-guide-refresh-en.json';
import { loadLocale, translateEditorial } from '../src/i18n/locale';

const texts = (value: unknown): string[] => typeof value === 'string' ? [value] : Array.isArray(value) ? value.flatMap(texts) : value && typeof value === 'object' ? Object.values(value).flatMap(texts) : [];
const chinese = /[\u3400-\u9fff]/u;

test('refreshed commute article keeps its existing route and supplies practical next steps', () => {
  assert.equal(guides.filter(guide => guide.slug === commuteGuide.slug).length, 1);
  assert.equal(guides.find(guide => guide.slug === commuteGuide.slug), commuteGuide);
  assert.equal(commuteGuide.priority, 'P0');
  assert.equal(commuteGuide.updatedAt, '2026-10-07');
  const body = texts(commuteGuide.blocks).join('\n');
  assert.match(body, /去程和回程/);
  assert.match(body, /错过一班/);
  assert.match(body, /有效车票/);
  assert.match(body, /下车刷卡/);
  assert.ok(commuteGuide.blocks.some(block => block.type === 'template' && block.text.includes('实际去程／回程总时间')));
  assert.equal(commuteGuide.blocks.filter(block => block.type === 'link').length, 3);
  for (const source of commuteGuide.sources) assert.ok(['www.bart.gov', 'www.caltrain.com', 'www.vta.org'].includes(new URL(source.url).hostname));
  assert.match(commuteGuide.sourceNote!, /没有实测你的路线/);
  assert.match(commuteGuide.sourceNote!, /只代表本篇内容更新/);
});

test('all commute copy has registered English and converts to traditional Chinese', async () => {
  const dictionary: Record<string, string> = english;
  for (const source of texts(commuteGuide).filter(text => chinese.test(text))) {
    assert.ok(Object.hasOwn(dictionary, source), `Missing English: ${source}`);
    assert.ok(dictionary[source].trim());
    assert.doesNotMatch(dictionary[source], chinese);
  }
  const sources: string[] = JSON.parse(readFileSync(new URL('../scripts/english-sources.json', import.meta.url), 'utf8'));
  assert.ok(sources.includes('src/i18n/commute-guide-refresh-en.json'));
  await loadLocale('zh-Hant');
  const traditional = translateEditorial(commuteGuide, 'zh-Hant');
  assert.match(traditional.title, /灣區/);
  assert.match(traditional.summary, /確認|核對/);
  assert.equal(traditional.slug, commuteGuide.slug);
  assert.equal(traditional.sources[0].url, commuteGuide.sources[0].url);
});
