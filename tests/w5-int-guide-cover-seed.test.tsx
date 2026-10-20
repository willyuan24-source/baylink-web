// W5-INT (WEB-VISUAL-2 H12 item 4 × WEB-GUIDES-READ's GuideCover): a guide's drawing belongs to the guide. GuideCover seeds
// the TypeCover with the slug, as the home GuideRail does, so /guides draws the same picture in zh-Hans and /en (before, the
// seed was the translated topic label) and guides of one topic do not all draw the same variant.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import test, { afterEach } from 'node:test';
import { JSDOM } from 'jsdom';
import React from 'react';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://www.baylink.us/guides' });
Object.assign(globalThis, { window: dom.window, document: dom.window.document, localStorage: dom.window.localStorage, HTMLElement: dom.window.HTMLElement, Node: dom.window.Node, IS_REACT_ACT_ENVIRONMENT: true });
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator });
registerHooks({ load(url, context, next) { return url.endsWith('.css') ? { format: 'module', shortCircuit: true, source: 'export {}' } : next(url, context); } });
const { render, cleanup, act } = await import('@testing-library/react');
const { GuideCover } = await import('../src/features/guides/GuideCover');
const { GuideTypeCover } = await import('../src/components/ui/cover-guide');
const { guideTopicOf } = await import('../src/data/guide-topics');
const { setLocale } = await import('../src/i18n/locale');
afterEach(async () => { cleanup(); await act(async () => { await setLocale('zh-Hans', false); }); });

type Card = { slug: string; category: string; title: string; sourceCount: number; hook?: { zh: string; en: string }; hi?: { zh: string; en: string } };
const index = JSON.parse(readFileSync('src/data/generated/guides-index.json', 'utf8')) as Card[] | { guides: Card[] };
const cards = (Array.isArray(index) ? index : index.guides).map(({ slug, category, title, sourceCount, hook, hi }) => ({ slug, category, title, sourceCount, hook, hi }));
const typeCover = { tier: 'type', reason: 'no-image' } as never;
const covers = (list: Card[]) => list.map(guide => {
  const view = render(<GuideCover guide={guide} cover={typeCover} ratio="4:5" face={GuideTypeCover} />);
  const root = view.container.querySelector('[data-cover="type"]')!;
  const found = { family: root.getAttribute('data-family')!, mark: root.getAttribute('data-mark')!, key: root.getAttribute('data-key')! };
  cleanup();
  return found;
});

// UI9-C: a guide's coded cover is the headline (or number) family, keyed by the guide: the same family and mark in zh-Hans
// and /en (the mark follows the topic, the variant the slug, never the translated label), and each guide prints its own hook.
test('a /guides coded cover keeps its family and mark in every language, and guides of one topic print their own hooks', async () => {
  assert.ok(cards.length > 40, 'the generated guide index');
  const byTopic = new Map<string, Card[]>();
  for (const card of cards) byTopic.set(guideTopicOf(card), [...(byTopic.get(guideTopicOf(card)) ?? []), card]);
  const [, biggest] = [...byTopic].sort((a, b) => b[1].length - a[1].length)[0];
  const sample = biggest.slice(0, 12);
  const chinese = covers(sample);
  await act(async () => { await setLocale('en', false); });
  const english = covers(sample);
  assert.deepEqual(english.map(({ family, mark }) => `${family}/${mark}`), chinese.map(({ family, mark }) => `${family}/${mark}`), 'the same family and mark per guide in English');
  assert.equal(new Set(chinese.map(cover => cover.key)).size, sample.length, 'no two guides of one topic print the same hook');
  for (const cover of [...chinese, ...english]) assert.ok(cover.key.trim(), 'every coded guide cover prints a hook');
});
