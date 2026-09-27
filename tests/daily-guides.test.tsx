import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { StaticRouter } from 'react-router';
import { guides, getGuideBySlug } from '../src/data/guides';
import { DAILY_GUIDE_TOPICS } from '../src/data/daily-guide-topics';
import { DailyGuideTopics } from '../src/components/DailyGuideTopics';
import { getGuideMedia } from '../src/data/guide-media';
import { searchGuides } from '../src/lib/guide-search';
import { loadLocale, translateEditorial } from '../src/i18n/locale';
import ui from '../src/data/daily-life-ui-en.json';

const additions = DAILY_GUIDE_TOPICS.map(topic => getGuideBySlug(topic.slug)!);

test('daily essentials connect every task to a sourced guide with a usable checklist and template', () => {
  const html = renderToStaticMarkup(<StaticRouter location="/guides"><DailyGuideTopics onOpenGuide={() => {}} /></StaticRouter>);
  const search = searchGuides(guides, { query: '日常办事' });
  for (const topic of DAILY_GUIDE_TOPICS) {
    const guide = getGuideBySlug(topic.slug);
    assert.ok(guide, topic.slug);
    assert.ok(html.includes(`/guides/${topic.slug}`));
    assert.ok(search.some(result => result.guide.slug === topic.slug));
    assert.ok(guide.sources.length >= 4);
    assert.ok(guide.blocks.some(block => block.type === 'checklist' && block.items.length >= 4));
    assert.ok(guide.blocks.some(block => block.type === 'template' && block.text.length > 60));
    assert.ok(guide.blocks.some(block => block.type === 'link' && block.url.startsWith('https://')));
    assert.ok(guide.sources.every(source => new URL(source.url).protocol === 'https:'));
  }
});

test('daily topics, complete articles, templates and image credits work in English', async () => {
  await loadLocale('en');
  const translated = translateEditorial({ topics: DAILY_GUIDE_TOPICS, additions, media: additions.map(getGuideMedia), ui: Object.keys(ui) }, 'en');
  assert.doesNotMatch(JSON.stringify(translated), /[\u3400-\u9fff]/);
  for (const [query, slug] of [
    ['street parking', 'bay-area-street-parking-first-time-guide'],
    ['FasTrak', 'bay-area-fastrak-bridge-express-lanes-guide'],
    ['hazardous waste', 'bay-area-bulky-items-ewaste-hhw-guide'],
    ['power outage', 'bay-area-alerts-outages-first-day-checklist'],
    ['ESL', 'bay-area-free-esl-adult-learning-guide'],
    ['211', 'bay-area-311-211-local-help-guide'],
  ]) assert.ok(searchGuides(guides, { query, locale: 'en' }).some(result => result.guide.slug === slug), query);
});
