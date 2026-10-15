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
const { guideTopicOf } = await import('../src/data/guide-topics');
const { setLocale } = await import('../src/i18n/locale');
afterEach(async () => { cleanup(); await act(async () => { await setLocale('zh-Hans', false); }); });

type Card = { slug: string; category: string; title: string; sourceCount: number };
const index = JSON.parse(readFileSync('src/data/generated/guides-index.json', 'utf8')) as Card[] | { guides: Card[] };
const cards = (Array.isArray(index) ? index : index.guides).map(({ slug, category, title, sourceCount }) => ({ slug, category, title, sourceCount }));
const typeCover = { tier: 'type', reason: 'no-image' } as never;
const arts = (list: Card[]) => list.map(guide => {
  const view = render(<GuideCover guide={guide} cover={typeCover} ratio="4:5" />);
  const art = view.container.querySelector('.ui-type-cover__art')!.getAttribute('data-art')!;
  cleanup();
  return art;
});

test('a /guides coded cover draws the same picture in every language, and one topic draws more than one picture', async () => {
  assert.ok(cards.length > 40, 'the generated guide index');
  const byTopic = new Map<string, Card[]>();
  for (const card of cards) byTopic.set(guideTopicOf(card), [...(byTopic.get(guideTopicOf(card)) ?? []), card]);
  const [, biggest] = [...byTopic].sort((a, b) => b[1].length - a[1].length)[0];
  const sample = biggest.slice(0, 12);
  const chinese = arts(sample);
  await act(async () => { await setLocale('en', false); });
  assert.deepEqual(arts(sample), chinese, 'the same drawing per guide in English');
  assert.ok(new Set(chinese).size > 1, `guides of one topic draw more than one picture (${[...new Set(chinese)].join(', ')})`);
});
