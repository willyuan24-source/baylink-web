import assert from 'node:assert/strict';
import test from 'node:test';
import { guides } from '../src/data/guides';
import { ANTI_FRAUD_SLUGS, ELDER_HUB_SLUGS, GUIDE_TOPICS, GUIDE_TOPIC_BY_SLUG, GUIDE_TOPIC_SLUGS, guideSlugsForTopic, guideTopicOf } from '../src/data/guide-topics';

const catalog = new Set(guides.map(guide => guide.slug));

test('seven topics in D22 order, 长辈与家属 first, each with Chinese and English copy', () => {
  assert.deepEqual(GUIDE_TOPICS.map(topic => topic.zh), ['长辈与家属', '医疗保险', '证件与移民', '住房', '出行', '省钱福利', '周末出游']);
  for (const topic of GUIDE_TOPICS) {
    assert.match(topic.en, /^[A-Z][A-Za-z &]+$/, topic.id);
    assert.ok(topic.summary.zh && /^[A-Z]/.test(topic.summary.en), topic.id);
    assert.doesNotMatch(topic.summary.en, /[㐀-鿿]/, topic.id);
  }
});

test('every catalog guide is filed under exactly one topic, and the map names no unknown guide', () => {
  const listed = Object.values(GUIDE_TOPIC_SLUGS).flat();
  assert.deepEqual(listed.filter(slug => !catalog.has(slug)), [], 'unknown slugs in src/data/guide-topics.ts');
  assert.deepEqual(listed.filter((slug, index) => listed.indexOf(slug) !== index), [], 'a slug filed twice');
  assert.ok(listed.length >= 141, `${listed.length} filed`);
  // A guide published after the map still lands somewhere (category fallback), so content PRs keep passing;
  // file it in GUIDE_TOPIC_SLUGS when you see it here.
  const unfiled = [...catalog].filter(slug => !GUIDE_TOPIC_BY_SLUG[slug]);
  if (unfiled.length) console.warn(`Guides without a topic in src/data/guide-topics.ts (category fallback used): ${unfiled.join(', ')}`);
  for (const guide of guides) assert.ok(GUIDE_TOPICS.some(topic => topic.id === guideTopicOf(guide)), guide.slug);
  assert.equal(guideTopicOf({ slug: 'a-new-guide', category: 'commute' }), 'transport');
});

test('the 长辈与家属 hub lists at least eight published guides in reading order, starting with whom to call', () => {
  assert.ok(ELDER_HUB_SLUGS.length >= 8);
  assert.equal(new Set(ELDER_HUB_SLUGS).size, ELDER_HUB_SLUGS.length);
  assert.deepEqual(ELDER_HUB_SLUGS.filter(slug => !catalog.has(slug)), []);
  assert.deepEqual(ELDER_HUB_SLUGS.slice(0, 3), ['bay-area-chinese-senior-services-referral-guide', 'bay-area-medicare-hicap-medi-cal-guide', 'bay-area-social-security-retirement-preparation-guide']);
  assert.deepEqual(guideSlugsForTopic('elders', guides), ELDER_HUB_SLUGS);
  assert.deepEqual(guideSlugsForTopic('elders', guides.filter(guide => guide.slug !== ELDER_HUB_SLUGS[1])), ELDER_HUB_SLUGS.filter((_, index) => index !== 1));
});

test('topic chips cover the catalog, schools are 新来安顿 errands and 防骗 is a cross-tag', () => {
  const byTopic = Object.fromEntries(GUIDE_TOPICS.map(topic => [topic.id, guideSlugsForTopic(topic.id, guides)]));
  for (const topic of GUIDE_TOPICS) assert.ok(byTopic[topic.id].length >= 3, topic.id);
  // Every guide shows under its own topic chip (a guide filed under 长辈与家属 is in the hub).
  for (const guide of guides) assert.ok(byTopic[guideTopicOf(guide)].includes(guide.slug), guide.slug);
  for (const guide of guides.filter(guide => guide.category === 'education')) assert.equal(guideTopicOf(guide), 'documents', guide.slug);
  assert.deepEqual(ANTI_FRAUD_SLUGS.filter(slug => !catalog.has(slug)), []);
  assert.ok(ANTI_FRAUD_SLUGS.every(slug => guideTopicOf({ slug, category: '' }) !== 'elders'));
});
